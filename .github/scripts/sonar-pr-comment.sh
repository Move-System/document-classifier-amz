#!/usr/bin/env bash
# Posta/atualiza (por marcador) um comentário no PR com o Quality Gate + a LISTA
# de problemas do código novo, cada um com link direto para a issue no SonarQube.
#
# Por que o analysisId: o SonarQube Community NÃO isola análise por branch/PR —
# toda análise sobrescreve o mesmo projeto. Se um segundo PR roda logo depois, o
# gate "atual do projeto" passa a refletir a análise dele, e o resultado do
# primeiro "some". Aqui lemos o analysisId DESTE scan (report-task.txt gerado
# pelo scanner) e pedimos o gate/issues daquela análise específica — o comentário
# do PR fica fiel ao que ESTE PR analisou.
#
# Uso: sonar-pr-comment.sh <projectKey> <prNumber>
# Env: SONAR_HOST_URL, SONAR_TOKEN, GH_TOKEN, GITHUB_REPOSITORY. Depende de jq e gh.
set -uo pipefail

PROJECT="${1:?projectKey}"
PR="${2:?prNumber}"
[ -z "${PR}" ] && { echo "sem número de PR — nada a comentar"; exit 0; }
REPO="${GITHUB_REPOSITORY:?}"
HOST="${SONAR_HOST_URL%/}"
MARKER="<!-- sonar-gate -->"
DASH="$HOST/dashboard?id=${PROJECT}"
sq() { curl -s -m 30 -u "${SONAR_TOKEN}:" "$@"; }

# analysisId DESTE scan (via report-task.txt gerado pelo scanner — path varia:
# build/sonar/ no Gradle, .scannerwork/ na scan-action).
RT=$(find . -name report-task.txt 2>/dev/null | head -1)
ANALYSIS=""
if [ -n "$RT" ]; then
  CETASK=$(grep -E '^ceTaskId=' "$RT" | cut -d= -f2- | tr -d '\r')
  [ -n "$CETASK" ] && ANALYSIS=$(sq "$HOST/api/ce/task?id=$CETASK" | jq -r '.task.analysisId // empty')
fi

# Gate: prioriza a análise DESTE PR; sem ela, cai no estado atual do projeto.
if [ -n "$ANALYSIS" ]; then
  JSON=$(sq "$HOST/api/qualitygates/project_status?analysisId=$ANALYSIS")
else
  JSON=$(sq "$HOST/api/qualitygates/project_status?projectKey=$PROJECT")
fi

if ! echo "$JSON" | jq -e '.projectStatus' >/dev/null 2>&1; then
  BODY=$(printf '### ⚠️ SonarQube\nNão foi possível obter o Quality Gate (servidor indisponível?).\n\n[Ver dashboard](%s)' "$DASH")
else
  STATUS=$(echo "$JSON" | jq -r '.projectStatus.status')
  case "$STATUS" in
    OK)    ICON="✅"; TXT="PASSOU" ;;
    ERROR) ICON="❌"; TXT="REPROVOU" ;;
    *)     ICON="ℹ️"; TXT="$STATUS" ;;
  esac
  # Ratings vêm como 1..5 na API — mostra A..E (mais legível). Demais métricas literais.
  CONDS=$(echo "$JSON" | jq -r '
    def rat(v): {"1":"A","2":"B","3":"C","4":"D","5":"E"}[v] // v;
    .projectStatus.conditions[]
    | (if .status=="OK" then "✅" else "❌" end) as $i
    | (if (.metricKey|endswith("_rating")) then rat(.actualValue) else .actualValue end) as $val
    | (if (.metricKey|endswith("_rating")) then rat(.errorThreshold) else .errorThreshold end) as $lim
    | "- \($i) `\(.metricKey)` = \($val) (limite \(.comparator) \($lim))"')
  [ -z "$CONDS" ] && CONDS="_(sem condições avaliadas em código novo)_"

  # Problemas do CÓDIGO NOVO, ordenados por severidade, com link direto p/ cada issue.
  ISSUES=$(sq "$HOST/api/issues/search?componentKeys=$PROJECT&resolved=false&inNewCodePeriod=true&ps=15&s=SEVERITY&asc=false" \
    | jq -r --arg h "$HOST" --arg p "$PROJECT" '
      .issues[]? |
      (if .type=="BUG" then "🐛" elif .type=="VULNERABILITY" then "🔒" else "⚠️" end) as $ic |
      ((.component|split(":")|last) + ":" + ((.line // 0)|tostring)) as $loc |
      "- \($ic) **\(.severity)** · [`\($loc)`](\($h)/project/issues?id=\($p)&open=\(.key)&inNewCodePeriod=true) · `\(.rule)` — \(.message)"')

  PROB=""
  [ -n "$ISSUES" ] && PROB=$(printf '\n\n**Problemas a resolver (código novo):**\n%s' "$ISSUES")
  BODY=$(printf '### %s SonarQube Quality Gate: **%s**\n\n%s%s\n\n[Abrir no SonarQube](%s) · <sub>análise deste PR · projeto `%s`</sub>' \
    "$ICON" "$TXT" "$CONDS" "$PROB" "$DASH" "$PROJECT")
fi

FULL="$MARKER"$'\n'"$BODY"
ID=$(gh api "repos/$REPO/issues/$PR/comments" --paginate \
      --jq ".[] | select(.body | contains(\"$MARKER\")) | .id" 2>/dev/null | head -1)
if [ -n "$ID" ]; then
  gh api -X PATCH "repos/$REPO/issues/comments/$ID" -f body="$FULL" >/dev/null 2>&1 || true
else
  gh api -X POST "repos/$REPO/issues/$PR/comments" -f body="$FULL" >/dev/null 2>&1 || true
fi
