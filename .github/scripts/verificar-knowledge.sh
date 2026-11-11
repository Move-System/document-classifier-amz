#!/usr/bin/env bash
# Segunda barreira da ADR-0012: confere no CI que o ponteiro do submodule knowledge/ que vem
# no PR esta em dia com origin/main do docs-ia-projects.
#
# Por que existe: o gate local (pre-commit) so vale em quem rodou knowledge/scripts/instalar-hooks.sh.
# Nao ha como forcar isso em cada clone — a ADR-0012 ja registrava a checagem no CI como o
# proximo degrau. Aqui ela sai do papel.
#
# Nao precisa do submodule clonado: le o gitlink direto da arvore e compara pela API.
#
# Uso:   verificar-knowledge.sh [<pr_number>] [<repo_full>]
# Env:   KNOWLEDGE_PAT (obrigatorio — leitura no docs-ia-projects, que e privado)
#        GH_TOKEN (para comentar no PR), KNOWLEDGE_REPO (default Move-System/docs-ia-projects)
set -uo pipefail

PR="${1:-}"
REPO="${2:-}"
FONTE="${KNOWLEDGE_REPO:-Move-System/docs-ia-projects}"
MARKER="<!-- knowledge-check -->"

upsert_comment() {
  [ -n "$PR" ] && [ -n "$REPO" ] || return 0
  local body="$1" id full
  id=$(gh api "repos/$REPO/issues/$PR/comments" --paginate \
        --jq ".[] | select(.body | contains(\"$MARKER\")) | .id" 2>/dev/null | head -1)
  full="$MARKER"$'\n'"$body"
  if [ -n "$id" ]; then
    gh api -X PATCH "repos/$REPO/issues/comments/$id" -f body="$full" >/dev/null 2>&1 || true
  else
    gh api -X POST "repos/$REPO/issues/$PR/comments" -f body="$full" >/dev/null 2>&1 || true
  fi
}

reprovar() { echo "::error::$1"; upsert_comment "### ❌ knowledge/ desatualizado (ADR-0012)"$'\n'"$1"; exit 1; }
avisar()   { echo "::warning::$1"; }

# 1) Este repositorio consome knowledge/?
if [ ! -f .gitmodules ] || ! grep -q 'path *= *knowledge' .gitmodules 2>/dev/null; then
  echo "Repositorio sem o submodule knowledge/ — nada a checar."
  exit 0
fi

# 2) Ponteiro que o PR carrega (gitlink na arvore — nao precisa do submodule inicializado)
PONTEIRO=$(git ls-files -s -- knowledge 2>/dev/null | awk '{print $2}')
if [ -z "$PONTEIRO" ]; then
  reprovar "\`.gitmodules\` declara \`knowledge\`, mas nao ha gitlink de \`knowledge/\` na arvore. Submodule quebrado."
fi

# 3) Sem PAT nao da para ler o docs-ia-projects (privado). Falhar aqui e proposital: o modo
#    de falha que esta ADR corrige e justamente o "nao consegui checar, entao deixa passar".
if [ -z "${KNOWLEDGE_PAT:-}" ]; then
  reprovar "Secret \`KNOWLEDGE_PAT\` nao configurado — nao da para verificar se \`knowledge/\` esta em dia. Configure um PAT com leitura em \`$FONTE\`."
fi

# 4) Comparar ponteiro -> main na origem
RESP=$(GH_TOKEN="$KNOWLEDGE_PAT" gh api "repos/$FONTE/compare/$PONTEIRO...main" 2>&1)
if [ $? -ne 0 ]; then
  case "$RESP" in
    *"No common ancestor"*|*"not found"*|*"Not Found"*|*"404"*)
      reprovar "Ponteiro \`${PONTEIRO:0:8}\` nao existe em \`$FONTE\` (ou o PAT nao tem leitura la). Rode: \`git submodule update --remote knowledge && git add knowledge\`" ;;
    *)
      reprovar "Falha ao consultar \`$FONTE\`: \`$(printf '%s' "$RESP" | head -2 | tr '\n' ' ')\`" ;;
  esac
fi

STATUS=$(printf '%s' "$RESP" | jq -r '.status')
ATRAS=$(printf '%s' "$RESP" | jq -r '.ahead_by')

case "$STATUS" in
  identical)
    echo "✓ knowledge/ em dia com $FONTE@main (${PONTEIRO:0:8})."
    upsert_comment "### ✅ knowledge/ em dia (ADR-0012)"$'\n'"Ponteiro \`${PONTEIRO:0:8}\` == \`$FONTE@main\`."
    exit 0 ;;
  behind)
    # Ponteiro a FRENTE de main: branch testando conhecimento nao mergeado. Mesmo criterio do
    # pre-commit — avisa e passa, para nao dar falso positivo.
    avisar "knowledge/ aponta para um commit ainda nao mergeado em $FONTE@main — passando."
    exit 0 ;;
  diverged)
    avisar "knowledge/ aponta para fora da linha de $FONTE@main — confira o submodule. Passando (mesmo criterio do pre-commit)."
    exit 0 ;;
  ahead)
    reprovar "\`knowledge/\` esta **$ATRAS commit(s) atras** de \`$FONTE@main\` (ponteiro \`${PONTEIRO:0:8}\`).

Atualize e inclua o ponteiro no PR:
\`\`\`bash
git submodule update --remote knowledge && git add knowledge
git commit -m \"Chore(Knowledge): atualiza o submodule AB#<id>\"
\`\`\`" ;;
  *)
    reprovar "Resposta inesperada ao comparar \`${PONTEIRO:0:8}\` com \`$FONTE@main\` (status: \`$STATUS\`)." ;;
esac
