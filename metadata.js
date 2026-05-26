const YEAR_PATTERN = /\b(19|20)\d{2}\b/g;
const DOCUMENT_NUMBER_YEAR_PATTERN =
  /\b(?:n[º°o.]?\s*)?(\d{1,5}(?:\.\d{3})*)(?:\/|-)(\d{4})\b/i;

const STOP_LINES = [
  /^art\.?\s*\d+/i,
  /^considerando\b/i,
  /^par[aá]grafo\b/i,
];

export function extractDocumentMetadata(text) {
  const lines = splitMeaningfulLines(text);
  const header = lines.slice(0, 6);
  const headerText = header.join(" ");

  const documentYear = extractYear(headerText);
  const title = extractTitle(header);

  return {
    title,
    year: documentYear,
  };
}

function splitMeaningfulLines(text) {
  return text
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function extractYear(text) {
  const numberYearMatch = text.match(DOCUMENT_NUMBER_YEAR_PATTERN);
  if (numberYearMatch) {
    return Number(numberYearMatch[2]);
  }

  const years = [...text.matchAll(YEAR_PATTERN)].map((match) => Number(match[0]));
  return years.length ? years[0] : null;
}

function extractTitle(lines) {
  const leadingTitle = extractLeadingTitle(lines);
  if (leadingTitle) return leadingTitle;

  for (const line of lines) {
    const inlineTitle = extractInlineTitle(line);
    if (inlineTitle) return inlineTitle;
  }

  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (STOP_LINES.some((pattern) => pattern.test(line))) break;

    const candidate = cleanupTitle(line);
    if (candidate) return candidate;
  }

  return null;
}

function extractLeadingTitle(lines) {
  if (lines.length < 2) return null;

  const firstLine = cleanupTitle(lines[0]);
  const secondLine = lines[1];

  if (!firstLine) return null;
  if (!looksLikeDocumentIdentifier(secondLine)) return null;

  return firstLine;
}

function extractInlineTitle(line) {
  const separators = [" – ", " — ", " - ", ": "];

  for (const separator of separators) {
    const separatorIndex = line.indexOf(separator);
    if (separatorIndex === -1) continue;

    const candidate = cleanupTitle(line.slice(separatorIndex + separator.length));
    if (candidate) return candidate;
  }

  return null;
}

function cleanupTitle(value) {
  const cleaned = normalizeWhitespace(
    value
      .replace(/^ementa[:\s-]*/i, "")
      .replace(/^assunto[:\s-]*/i, "")
      .replace(/^objeto[:\s-]*/i, "")
  );

  if (!cleaned) return null;
  if (/^(19|20)\d{2}$/.test(cleaned)) return null;
  if (STOP_LINES.some((pattern) => pattern.test(cleaned))) return null;

  return cleaned
    .replace(/\s*[.;]\s*$/g, "")
    .trim() || null;
}

function looksLikeDocumentIdentifier(value) {
  return /(?:^|\s)(?:n[º°o.]?\s*)?\d{1,5}(?:\s*\/\s*|\s*-\s*)(19|20)\d{2}\b/i.test(value);
}
