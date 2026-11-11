#!/usr/bin/env bash
# Valida o título do PR: formato Type(Escopo): descrição AB#<id>
# e que o card AB#<id> existe no Azure Boards e está em atividade (não fechado).
# Publica/atualiza um comentário no PR com os dados do card.
#
# Uso:   validate-card.sh "<pr_title>" "<pr_number>" "<repo>"
# Env:   AZURE_DEVOPS_PAT (obrigatório), AZURE_ORG (default MoveSystem),
#        GH_TOKEN (para comentar). Depende de curl, jq, gh.
set -uo pipefail

TITLE="${1:-}"
PR="${2:-}"
REPO="${3:-}"
ORG="${AZURE_ORG:-MoveSystem}"
MARKER="<!-- card-check -->"

# ── upsert de comentário (por marcador, não colide com o comentário do Sonar) ──
upsert_comment() {
  local body="$1" id
  id=$(gh api "repos/$REPO/issues/$PR/comments" --paginate \
        --jq ".[] | select(.body | contains(\"$MARKER\")) | .id" 2>/dev/null | head -1)
  local full
  full="$MARKER"$'\n'"$body"
  if [ -n "$id" ]; then
    gh api -X PATCH "repos/$REPO/issues/comments/$id" -f body="$full" >/dev/null 2>&1 || true
  else
    gh api -X POST "repos/$REPO/issues/$PR/comments" -f body="$full" >/dev/null 2>&1 || true
  fi
}

reprovar() { echo "::error::$1"; [ -n "$PR" ] && upsert_comment "### ❌ Validação do card do Azure"$'\n'"$1"; exit 1; }

# 1) Formato do título: Type(Escopo): descrição
if ! printf '%s' "$TITLE" | grep -qE '^[A-Z][A-Za-z]+\([^)]+\) *:.+'; then
  reprovar "Título fora do padrão. Use: \`Type(Escopo): descrição AB#1234\` — recebido: \`$TITLE\`"
fi

# 2) Extrair o card AB#<id>
NUM=$(printf '%s' "$TITLE" | grep -oiE 'AB#[0-9]+' | head -1 | grep -oE '[0-9]+')
if [ -z "$NUM" ]; then
  reprovar "Nenhum card do Azure no título (esperado \`AB#1234\`). Título: \`$TITLE\`"
fi

# 3) Precisa do PAT do Azure
if [ -z "${AZURE_DEVOPS_PAT:-}" ]; then
  reprovar "Secret \`AZURE_DEVOPS_PAT\` não configurado — não é possível validar o card AB#$NUM."
fi

# 4) Consultar o work item no Azure DevOps
HTTP=$(curl -s -m 30 -u ":$AZURE_DEVOPS_PAT" -w '\n%{http_code}' \
  "https://dev.azure.com/$ORG/_apis/wit/workitems/$NUM?api-version=7.0")
CODE=$(printf '%s' "$HTTP" | tail -1)
BODY=$(printf '%s' "$HTTP" | sed '$d')

if [ "$CODE" = "401" ] || [ "$CODE" = "203" ]; then
  reprovar "Falha de autenticação no Azure (código $CODE). Verifique o \`AZURE_DEVOPS_PAT\` (escopo Work Items: Read)."
fi
if [ "$CODE" != "200" ] || ! printf '%s' "$BODY" | jq -e '.fields' >/dev/null 2>&1; then
  reprovar "Card **AB#$NUM** não encontrado no Azure (org \`$ORG\`, HTTP $CODE). Confira o número no título."
fi

T=$(printf '%s' "$BODY" | jq -r '.fields."System.Title" // "?"')
TYPE=$(printf '%s' "$BODY" | jq -r '.fields."System.WorkItemType" // "?"')
STATE=$(printf '%s' "$BODY" | jq -r '.fields."System.State" // "?"')
WHO=$(printf '%s' "$BODY" | jq -r '.fields."System.AssignedTo".displayName // "não atribuído"')
URL="https://dev.azure.com/$ORG/_workitems/edit/$NUM"

# 5) Estado deve ser de atividade em andamento (não fechado/removido)
case "$STATE" in
  Removed|Closed|Done|Resolved|Completed)
    reprovar "Card **AB#$NUM** existe mas está **$STATE** (não é atividade em andamento).
- **$TYPE**: $T
- Responsável: $WHO
- [Abrir card]($URL)"
    ;;
esac

upsert_comment "### ✅ Card do Azure válido
- **AB#$NUM** — $TYPE: _${T}_
- Estado: **$STATE**
- Responsável: $WHO
- [Abrir card]($URL)"
echo "Card AB#$NUM OK — $TYPE / $STATE"
