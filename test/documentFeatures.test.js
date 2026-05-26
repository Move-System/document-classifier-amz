import test from "node:test";
import assert from "node:assert/strict";
import {
  buildEmbeddingInput,
  calculateLexicalScore,
  detectDocumentType,
  resolveTypeBoost,
} from "../documentFeatures.js";

test("detecta indicacao pelo cabecalho e verbo de iniciativa", () => {
  const matches = detectDocumentType(
    "INDICAÇÃO Nº 328/2024\nIndico ao Executivo a manutenção da iluminação pública na Rua das Flores."
  );

  assert.equal(matches[0]?.type, "Indicação");
  assert.ok(matches[0]?.strength >= 0.6);
});

test("detecta requerimento mesmo com texto curto", () => {
  const matches = detectDocumentType(
    "REQUERIMENTO Nº 12/2024\nRequeiro informações ao Secretário Municipal de Saúde."
  );

  assert.equal(matches[0]?.type, "Requerimento");
});

test("detecta mocao de louvor quando o texto explicita o tipo", () => {
  const matches = detectDocumentType(
    "Apresento à Douta Mesa, obedecidas as formalidades regimentais, ouvindo o Excelso\nPlenário, MOÇÃO DE LOUVOR em Reconhecimento à Trajetória Artística e Inspiradora de Lucas José"
  );

  assert.equal(matches[0]?.type, "Moção de Louvor");
  assert.ok(resolveTypeBoost("Moção de Louvor", matches) > 0.75);
});

test("detecta mensagem quando o cabecalho encaminha projeto", () => {
  const matches = detectDocumentType(
    "MENSAGEM Nº 18/2024\nEncaminha à apreciação desta Casa o Projeto de Lei que dispõe sobre a reestruturação administrativa."
  );

  assert.equal(matches[0]?.type, "Mensagem");
  assert.ok(resolveTypeBoost("Mensagem", matches) > 0.75);
});

test("detecta sumula pelo cabecalho explicito", () => {
  const matches = detectDocumentType(
    "SÚMULA Nº 12/2024\nDispõe sobre o entendimento consolidado da comissão quanto à tramitação de proposições."
  );

  assert.equal(matches[0]?.type, "Súmula");
  assert.ok(resolveTypeBoost("Súmula", matches) > 0.75);
});

test("reforca compatibilidade entre lei ordinaria e lei", () => {
  const detectedTypes = detectDocumentType(
    "LEI ORDINÁRIA Nº 2.100/2024\nInstitui o Programa de Incentivo Fiscal."
  );

  assert.ok(resolveTypeBoost("Lei Ordinária", detectedTypes) > 0.35);
  assert.ok(resolveTypeBoost("Lei", detectedTypes) > 0.15);
});

test("prioriza tipo especifico de decreto legislativo", () => {
  const detectedTypes = detectDocumentType(
    "DECRETO LEGISLATIVO Nº 45/2024\nConcede título de Cidadão Honorário."
  );

  assert.ok(
    resolveTypeBoost("Decreto Legislativo", detectedTypes) >
      resolveTypeBoost("Decreto Municipal", detectedTypes)
  );
});

test("usa apenas o cabecalho e o inicio do texto no embedding input", () => {
  const input = buildEmbeddingInput(
    "OFÍCIO Nº 114/2023\nComunicamos a realização da Sessão Solene.\n\n" +
      "Corpo ".repeat(800)
  );

  assert.match(input, /OFÍCIO Nº 114\/2023/);
  assert.ok(input.length < 2200);
});

test("score lexical diferencia textos com vocabulario parecido", () => {
  const similar = calculateLexicalScore(
    "Indico ao Executivo a instalação de lombadas na avenida central",
    "Indico a implantação de lombadas para segurança na avenida central"
  );
  const distant = calculateLexicalScore(
    "Indico ao Executivo a instalação de lombadas na avenida central",
    "Nota de pesar pelo falecimento do servidor municipal"
  );

  assert.ok(similar > distant);
  assert.ok(similar > 0.2);
});
