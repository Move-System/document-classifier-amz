const HEADER_WINDOW_LINES = 12;
const MAX_EMBEDDING_INPUT_CHARS = 2000;

const TYPE_PATTERNS = [
  { type: "Projeto de Decreto Legislativo", patterns: [/projeto\s+de\s+decreto\s+legislativo/i, /\bpdl\b/i] },
  { type: "Projeto de Resolução", patterns: [/projeto\s+de\s+resolu[cç][aã]o/i, /\bprj\b/i] },
  { type: "Proposta de Emenda à Lei Orgânica", patterns: [/proposta\s+de\s+emenda\s+[àa]\s+lei\s+org[aâ]nica/i, /\bpelo\b/i] },
  { type: "Lei Complementar", patterns: [/lei\s+complementar/i] },
  { type: "Lei Ordinária", patterns: [/lei\s+ordin[aá]ria/i] },
  { type: "Decreto Legislativo", patterns: [/decreto\s+legislativo/i] },
  { type: "Decreto Municipal", patterns: [/decreto\s+municipal/i] },
  { type: "Resolução Municipal", patterns: [/resolu[cç][aã]o\s+municipal/i] },
  { type: "Moção de Louvor", patterns: [/mo[cç][aã]o\s+de\s+louvor/i, /em\s+reconhecimento\b/i] },
  { type: "Moção de Congratulação", patterns: [/mo[cç][aã]o\s+de\s+congratula[cç][aã]o/i, /congratula[-\s]*se/i] },
  { type: "Moção de Repúdio", patterns: [/mo[cç][aã]o\s+de\s+rep[uú]dio/i, /repudia\b/i] },
  { type: "Mensagem", patterns: [/^mensagem\b/im, /mensagem\s+n?[º°o.]?\s*\d+/i] },
  { type: "Súmula", patterns: [/^s[úu]mula\b/im, /s[úu]mula\s+n?[º°o.]?\s*\d+/i] },
  { type: "Nota de Pesar", patterns: [/nota\s+de\s+pesar/i] },
  { type: "Voto de Louvor", patterns: [/voto\s+de\s+louvor/i] },
  { type: "Relatório de Fiscalização", patterns: [/relat[oó]rio\s+de\s+fiscaliza[cç][aã]o/i, /constata\s+irregularidades/i] },
  { type: "Comunicação Interna", patterns: [/\bcomunica[cç][aã]o\s+interna\b/i, /^\s*ci\s+n?[º°o.]?/im] },
  { type: "Edital de Licitação", patterns: [/edital/i, /licita[cç][aã]o/i, /preg[aã]o/i] },
  { type: "Termo de Cooperação", patterns: [/termo\s+de\s+coopera[cç][aã]o/i, /estabelece\s+parceria/i] },
  { type: "Ata de Sessão", patterns: [/ata\s+da\s+\d+/i, /sess[aã]o\s+ordin[aá]ria/i] },
  { type: "Parecer Técnico", patterns: [/parecer\s+t[eé]cnico/i, /^\s*parecer\s+n?[º°o.]?/im] },
  { type: "Requerimento", patterns: [/requerimento/i, /\brequeiro\b/i] },
  { type: "Indicação", patterns: [/indica[cç][aã]o/i, /\bindico\b/i] },
  { type: "Ofício", patterns: [/of[ií]cio/i, /encaminhamos\s+o\s+presente\s+of[ií]cio/i] },
  { type: "Portaria", patterns: [/portaria/i] },
  { type: "Ato", patterns: [/^ato\b/im, /ato\s+da\s+presid[eê]ncia/i] },
  { type: "Memorando", patterns: [/memorando/i] },
  { type: "Lei", patterns: [/^lei\b/im] },
  { type: "Decreto", patterns: [/^decreto\b/im] },
];

const TYPE_ALIASES = new Map([
  ["decreto", ["Decreto", "Decreto Municipal", "Decreto Legislativo"]],
  ["decreto municipal", ["Decreto Municipal", "Decreto"]],
  ["decreto legislativo", ["Decreto Legislativo", "Projeto de Decreto Legislativo"]],
  ["lei", ["Lei", "Lei Ordinária", "Lei Complementar"]],
  ["lei ordinaria", ["Lei Ordinária", "Lei"]],
  ["lei complementar", ["Lei Complementar", "Lei"]],
  ["resolucao", ["Resolução Municipal", "Projeto de Resolução"]],
  ["resolucao municipal", ["Resolução Municipal", "Projeto de Resolução"]],
  ["oficio", ["Ofício"]],
  ["indicacao", ["Indicação"]],
  ["requerimento", ["Requerimento"]],
  ["mocao de louvor", ["Moção de Louvor"]],
  ["mensagem", ["Mensagem"]],
  ["sumula", ["Súmula"]],
  ["ato", ["Ato"]],
  ["portaria", ["Portaria"]],
  ["memorando", ["Memorando"]],
]);

const STOPWORDS = new Set([
  "a", "ao", "aos", "as", "à", "às", "com", "da", "das", "de", "do", "dos",
  "e", "em", "na", "nas", "no", "nos", "o", "os", "ou", "para", "por", "que",
  "se", "ser", "um", "uma", "sobre"
]);

export function buildEmbeddingInput(text) {
  const normalized = normalizeText(text);
  if (!normalized) return "";

  const lines = normalized.split("\n").slice(0, HEADER_WINDOW_LINES);
  const header = lines.join(" ");
  const firstParagraph = normalized.replace(/\n+/g, " ").slice(0, 1800);

  return `${header}\n${firstParagraph}`.trim().slice(0, MAX_EMBEDDING_INPUT_CHARS);
}

export function detectDocumentType(text) {
  const normalized = normalizeText(text);
  const header = normalized.split("\n").slice(0, HEADER_WINDOW_LINES).join("\n");

  const matches = [];

  for (const entry of TYPE_PATTERNS) {
    const hitCount = entry.patterns.filter((pattern) => pattern.test(header)).length;
    if (!hitCount) continue;

    matches.push({
      type: entry.type,
      strength: Math.min(1, 0.45 + (hitCount - 1) * 0.2),
    });
  }

  return matches.sort((left, right) => right.strength - left.strength);
}

export function calculateLexicalScore(leftText, rightText) {
  const leftTokens = tokenize(leftText);
  const rightTokens = tokenize(rightText);

  if (!leftTokens.length || !rightTokens.length) return 0;

  const leftSet = new Set(leftTokens);
  const rightSet = new Set(rightTokens);
  let intersection = 0;

  for (const token of leftSet) {
    if (rightSet.has(token)) intersection += 1;
  }

  return intersection / Math.max(leftSet.size, rightSet.size);
}

export function resolveTypeBoost(type, detectedTypes) {
  if (!detectedTypes.length) return 0;

  const normalizedType = normalizeTypeKey(type);
  const aliases = new Set([type, ...(TYPE_ALIASES.get(normalizedType) || [])]);

  let boost = 0;

  for (const match of detectedTypes) {
    if (match.type === type) {
      boost = Math.max(boost, 0.55 + match.strength * 0.35);
      continue;
    }

    if (aliases.has(match.type)) {
      boost = Math.max(boost, 0.18 + match.strength * 0.18);
    }
  }

  return boost;
}

function tokenize(text) {
  return normalizeText(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

function normalizeTypeKey(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeText(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
