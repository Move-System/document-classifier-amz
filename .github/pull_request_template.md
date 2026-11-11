<!--
Título do PR (obrigatório, validado pelo CI):
  Type(Escopo): descrição AB#NNNN
  ex.: Feat(Sessão): tela de auditoria de integração AB#1457
O card AB#NNNN precisa existir no Azure Boards e estar em atividade.
-->

## Problema
<!-- O que estava errado / faltando. -->

## Solução
<!-- O que foi feito, em alto nível. -->

## Detalhes
<!-- Pontos de implementação relevantes, rotas/telas, consumo da API SGVP. -->

## Como validar
<!-- Passos para conferir (telas, fluxos, comandos). -->

---
### Checklist da esteira (ver `documentation/PADROES_CI_CD.md`)
- [ ] `scripts/preflight.sh` passou localmente
- [ ] Título no formato `Type(Escopo): ... AB#NNNN` com card aberto no Azure
- [ ] Pint e Prettier aplicados nos arquivos alterados
- [ ] Cobertura do código novo ≥ 80% (diff-cover e Sonar `new_coverage`)
- [ ] Sem issues novas do Sonar; sem `env()` fora de `config/*`
