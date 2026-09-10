import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { detectDocumentType } from "../documentFeatures.js";

const exemplos = JSON.parse(readFileSync(new URL("../examples.json", import.meta.url), "utf8"));
const tiposComExemplo = new Set(exemplos.map((e) => e.type));

/**
 * classify() monta os candidatos a partir de examples.json e so depois aplica o
 * boost de detectDocumentType. Tipo sem exemplo nunca entra na disputa, entao
 * reconhecer o padrao nao adianta nada — o documento cai em outra especie com
 * score baixo. Foi o que aconteceu com Despacho e Projeto de Lei.
 */
test("todo tipo detectavel por padrao tem exemplo em examples.json", () => {
  const detectaveis = [
    ["Despacho", "DESPACHO: Em votação, aprovada por unanimidade."],
    ["Projeto de Lei", "PROJETO DE LEI Nº 48/2025\nDispõe sobre a criação do programa municipal."],
    ["Projeto de Lei Complementar", "PROJETO DE LEI COMPLEMENTAR Nº 5/2025\nAltera o Código Tributário."],
    ["Veto", "VETO TOTAL AO AUTÓGRAFO Nº 55/2025 referente ao Projeto de Lei nº 53/2025."],
    ["Autógrafo", "AUTÓGRAFO Nº 55/2025\nA Mesa faz saber que o Plenário aprovou."],
    ["Moção", "MOÇÃO Nº 30/2025\nApresento moção referente ao transporte coletivo."],
    ["Indicação", "INDICAÇÃO Nº 744/2025\nIndico a pavimentação da via."],
    ["Requerimento", "REQUERIMENTO Nº 8/2025\nRequeiro informações à Secretaria."],
  ];

  for (const [esperado, texto] of detectaveis) {
    const detectado = detectDocumentType(texto)[0]?.type;
    assert.equal(detectado, esperado, `padrão de "${esperado}" não casou`);
    assert.ok(
      tiposComExemplo.has(esperado),
      `"${esperado}" é detectado mas não tem exemplo em examples.json — nunca poderá ser retornado`
    );
  }
});

test("todo exemplo tem tipo e texto utilizavel", () => {
  for (const [i, e] of exemplos.entries()) {
    assert.ok(e.type && typeof e.type === "string", `exemplo ${i} sem tipo`);
    assert.ok(e.text && e.text.trim().length > 40, `exemplo ${i} (${e.type}) tem texto curto demais`);
    assert.ok(Array.isArray(e.embedding), `exemplo ${i} (${e.type}) sem campo embedding`);
  }
});

test("o veto que cita autografo continua sendo veto", () => {
  const matches = detectDocumentType(
    "VETO 5 / 2025\nVETO TOTAL AO AUTÓGRAFO Nº 055/2025 ORIUNDO DO PROJETO DE LEI Nº 053/2025."
  );

  assert.equal(matches[0]?.type, "Veto");
  assert.ok(!matches.some((m) => m.type === "Autógrafo"));
});
