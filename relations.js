// relations.js - VERSÃO FINAL
export function extractDocumentsRelations(text) {
  const relations = [];
  
  // Regex definitiva para documentos legais
  const regex = /(altera|revoga|modifica|atualiza|complementa|consolida|derroga|republica|anula)[^.,;\n]{0,150}?(lei complementar|lei|ato|decreto|portaria|resolução|deliberação|instrução normativa)[^\d]{0,30}(n?[º°o.]?\s*\d{1,5}(?:\/\d{2,4})?)(?:,?\s*(?:de\s+)?(\d{1,2}\s+de\s+[\wç]+\s+de\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4}|\d{4})|\s+de\s+(\d{1,2}\s+de\s+[\wç]+\s+de\s+\d{4}))?/gi;

  let match;
  while ((match = regex.exec(text)) !== null) {
    if (!match[3]) continue;

    const relationType = normalizeRelation(match[1]);
    const docType = normalizeDocType(match[2]);
    const number = cleanDocumentNumber(match[3]);
    
    // Captura datas dos grupos 4 ou 5
    const rawDate = (match[4] || match[5] || '').trim();
    const fullContext = match[0].trim();

    relations.push({
      relation: relationType,
      type: docType,
      number: number,
      raw: `${docType} ${number}`,
      date: parseDateInfo(rawDate),
      context: fullContext.substring(0, 200)
    });
  }

  return mergeDuplicateRelations(relations);
}

// Função robusta para parse de datas
function parseDateInfo(rawDate) {
  if (!rawDate) return { raw: '', iso: null, year: null };
  
  // Tenta extrair o ano primeiro
  const yearMatch = rawDate.match(/\d{4}/);
  const year = yearMatch ? parseInt(yearMatch[0]) : null;
  
  // Parse completo quando possível
  let isoDate = null;
  try {
    isoDate = parseBrazilianDate(rawDate)?.toISOString() || null;
  } catch (e) {
    console.warn(`Falha ao parsear data: ${rawDate}`, e);
  }
  
  return { raw: rawDate, iso: isoDate, year };
}

// Função para mesclar relações duplicadas
function mergeDuplicateRelations(relations) {
  const merged = {};
  
  relations.forEach(rel => {
    const key = `${rel.type}|${rel.number}`;
    if (!merged[key] || !merged[key].date.raw) {
      merged[key] = {
        ...rel,
        // Mantém o contexto mais completo
        context: merged[key] 
          ? `${merged[key].context}; ${rel.context}` 
          : rel.context
      };
    }
  });
  
  return Object.values(merged);
}


function parseBrazilianDate(dateStr) {
  if (!dateStr) return null;
  
  // Formato "15 de julho de 2023"
  const longFormat = dateStr.match(/(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})/i);
  if (longFormat) {
    const months = {
      'janeiro': 0, 'fevereiro': 1, 'março': 2, 'abril': 3,
      'maio': 4, 'junho': 5, 'julho': 6, 'agosto': 7,
      'setembro': 8, 'outubro': 9, 'novembro': 10, 'dezembro': 11
    };
    
    const day = parseInt(longFormat[1]);
    const month = months[longFormat[2].toLowerCase()];
    const year = parseInt(longFormat[3]);
    
    if (month !== undefined) return new Date(year, month, day);
  }
  
  // Formato "15/07/2023"
  const shortFormat = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (shortFormat) {
    return new Date(
      parseInt(shortFormat[3]),
      parseInt(shortFormat[2]) - 1,
      parseInt(shortFormat[1])
    );
  }
  
  // Apenas ano "2023"
  const yearOnly = dateStr.match(/^\d{4}$/);
  if (yearOnly) {
    return new Date(parseInt(yearOnly[0]), 0, 1);
  }
  
  return null;
}


// Funções auxiliares
function normalizeRelation(relation) {
  const map = {
    'altera': 'ALTERAÇÃO', 'revoga': 'REVOGAÇÃO', 
    'modifica': 'MODIFICAÇÃO', 'complementa': 'COMPLEMENTO',
    'derroga': 'DERROGAÇÃO', 'republica': 'REPUBLICAÇÃO',
    'anula': 'ANULAÇÃO'
  };
  return map[relation.toLowerCase()] || relation.toUpperCase();
}

function normalizeDocType(type) {
  const types = {
    'lei complementar': 'LEI COMPLEMENTAR',
    'lei': 'LEI',
    'decreto': 'DECRETO',
    'portaria': 'PORTARIA',
    'resolução': 'RESOLUÇÃO'
  };
  return types[type.toLowerCase()] || type.toUpperCase();
}

function cleanDocumentNumber(num) {
  return num.toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[º°]/g, '.')
    .replace(/^N\.?/, '')
    .replace(/O\./, '.');
}