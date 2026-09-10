import test from "node:test";
import assert from "node:assert/strict";
import { stripBoilerplate } from "../boilerplate.js";
import { buildEmbeddingInput, detectDocumentType } from "../documentFeatures.js";

/** Cabeçalho institucional real, repetido página a página como o OCR entrega. */
const CABECALHO = [
  "Este documento foi assinado digitalmente. Para verificar a autenticidade das assinaturas, utilize a leitura do QR code na última página.",
  "Praça da Liberdade, n° 10 - Centro - Franco da Rocha - CEP: 07850-903 Telefone: (11) 4449-1444",
  "www.camarafrancodarocha.sp.gov.br / e-mail: cmfr@camarafrancodarocha.sp.gov.br",
  "Câmara Municipal de Franco da Rocha",
  "Praça da Liberdade, n° 10 - Centro - Franco da Rocha - CEP: 07850-903 Telefone: (11) 4449-1444",
].join("\n");

function comCabecalho(corpo) {
  return `${CABECALHO}\n${corpo}\nCâmara Municipal de Franco da Rocha\n1`;
}

test("descarta cabecalho e rodape institucional, preserva o corpo", () => {
  const { texto, removidas } = stripBoilerplate(
    comCabecalho("Senhor Presidente,\nINDICO na forma regimental a construção de muro de arrimo.")
  );

  assert.ok(removidas >= 5);
  assert.match(texto, /muro de arrimo/);
  assert.doesNotMatch(texto, /4449-1444/);
  assert.doesNotMatch(texto, /assinado digitalmente/i);
});

test("nao esvazia documento curto sem cabecalho", () => {
  const original = "MOÇÃO Nº 3/2025\nApresento moção de aplauso.";
  assert.equal(stripBoilerplate(original).texto, original);
});

test("classifica indicacao mesmo soterrada pelo cabecalho", () => {
  const matches = detectDocumentType(
    comCabecalho("Senhor Presidente,\nINDICO na forma regimental a instalação de iluminação pública na Rua Himalaia.")
  );

  assert.equal(matches[0]?.type, "Indicação");
});

test("o cabecalho nao domina o texto enviado ao embedding", () => {
  const entrada = buildEmbeddingInput(comCabecalho("Senhor Presidente,\nINDICO a pavimentação da Rua Afonso Pena."));

  assert.match(entrada, /Afonso Pena/);
  assert.doesNotMatch(entrada, /4449-1444/);
});

test("despacho vence a propositura que ele despacha", () => {
  // O despacho cita o número da indicação; sem a regra decisiva ele era
  // classificado como se fosse a própria indicação.
  const matches = detectDocumentType(
    comCabecalho("DESPACHO: Em votação, aprovada por unanimidade. Em 28 de maio de 2025.\nDESPACHO DA INDICAÇÃO Nº 746/2025")
  );

  assert.equal(matches[0]?.type, "Despacho");
  assert.equal(matches.length, 1, "regra decisiva devolve só o despacho");
});

test("projeto de lei nao vira lei, e o complementar nao vira projeto de lei", () => {
  const projeto = detectDocumentType("PROJETO DE LEI Nº 32/2024\nA Câmara Municipal faz saber que o solene plenário aprovou.");
  assert.equal(projeto[0]?.type, "Projeto de Lei");
  assert.ok(!projeto.some((m) => m.type === "Lei"));

  const complementar = detectDocumentType("PROJETO DE LEI COMPLEMENTAR Nº 5/2025\nAltera o Código Tributário Municipal.");
  assert.equal(complementar[0]?.type, "Projeto de Lei Complementar");
  assert.ok(!complementar.some((m) => m.type === "Projeto de Lei"));
});

test("a preposicao 'pelo' nao classifica como emenda a lei organica", () => {
  // /\bpelo\b/i casava a preposição corrente e produzia falso positivo em massa.
  const matches = detectDocumentType(
    "INDICAÇÃO Nº 744/2025\nIndico a limpeza do terreno, solicitada pelo morador e pelo síndico do condomínio."
  );

  assert.ok(!matches.some((m) => m.type === "Proposta de Emenda à Lei Orgânica"));
  assert.equal(matches[0]?.type, "Indicação");
});

test("mencionar licitacao nao transforma o documento em edital", () => {
  const matches = detectDocumentType(
    "REQUERIMENTO Nº 8/2025\nRequeiro informações sobre a licitação da coleta de resíduos."
  );

  assert.ok(!matches.some((m) => m.type === "Edital de Licitação"));
  assert.equal(matches[0]?.type, "Requerimento");
});

test("ata exige a palavra ata, nao so 'sessao ordinaria'", () => {
  const naoEhAta = detectDocumentType(
    "INDICAÇÃO Nº 12/2025\nLida na Sessão Ordinária de 3 de março, solicito reparo na via."
  );
  assert.ok(!naoEhAta.some((m) => m.type === "Ata de Sessão"));

  const ehAta = detectDocumentType("ATA DA 57ª SESSÃO ORDINÁRIA\nAos três dias do mês de março reuniu-se o plenário.");
  assert.equal(ehAta[0]?.type, "Ata de Sessão");
});

test("mocao sem qualificacao e reconhecida, e a especifica prevalece", () => {
  const generica = detectDocumentType("MOÇÃO Nº 30/2025\nApresento moção referente ao transporte coletivo.");
  assert.equal(generica[0]?.type, "Moção");

  const louvor = detectDocumentType("MOÇÃO DE LOUVOR Nº 4/2025\nEm reconhecimento aos serviços prestados.");
  assert.equal(louvor[0]?.type, "Moção de Louvor");
  assert.ok(!louvor.some((m) => m.type === "Moção"));
});
