/**
 * Remoção de cabeçalho e rodapé institucional antes de classificar.
 *
 * Documento de câmara municipal costuma abrir com um bloco fixo — aviso de
 * assinatura digital, endereço, CEP, telefone, site, e-mail, nome da Casa —
 * que se repete em toda página e é idêntico entre documentos. Se esse bloco
 * entra na classificação, todo documento fica parecido com todo outro: foi o
 * que aconteceu no acervo de Franco da Rocha, onde 683 documentos viraram
 * "Ata de Sessão" sem que existisse uma única ata.
 *
 * A limpeza é genérica de propósito (nada específico de uma Casa): descarta
 * linha que se repete no próprio documento — cabeçalho e rodapé se repetem
 * página a página, o conteúdo não — e linha que é só dado de contato.
 */

/** Linha que carrega apenas identificação/contato da Casa, não conteúdo. */
const LINHA_INSTITUCIONAL = [
  /assinad[oa]\s+digitalmente/i,
  /autenticidade\s+das\s+assinaturas/i,
  /leitura\s+do\s+qr\s*code/i,
  /\bCEP:?\s*\d{5}-?\d{3}\b/i,
  /\btelefone:?\s*\(?\d{2}\)?\s*\d{4,5}-?\d{4}/i,
  /\bwww\.[a-z0-9.-]+\.(?:gov\.br|com\.br|br)\b/i,
  /\be-?mail:?\s*\S+@\S+/i,
  /^\s*p[áa]gina\s+\d+(\s+de\s+\d+)?\s*$/i,
  /^\s*\d+\s*$/,
];

const MIN_LINHAS_PARA_DEDUPLICAR = 8;

function normalizaChave(linha) {
  return linha
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * @param {string} texto Texto bruto do OCR.
 * @returns {{ texto: string, removidas: number }}
 */
export function stripBoilerplate(texto) {
  const linhas = String(texto || '').split('\n');
  if (linhas.length < MIN_LINHAS_PARA_DEDUPLICAR) {
    return { texto: String(texto || ''), removidas: 0 };
  }

  // Linha que aparece mais de uma vez é cabeçalho/rodapé de página, não conteúdo.
  const frequencia = new Map();
  for (const linha of linhas) {
    const chave = normalizaChave(linha);
    if (chave.length < 12) continue; // linha curta repete por acaso
    frequencia.set(chave, (frequencia.get(chave) || 0) + 1);
  }

  let removidas = 0;
  const limpas = linhas.filter(linha => {
    const chave = normalizaChave(linha);

    if (chave.length >= 12 && (frequencia.get(chave) || 0) > 1) {
      removidas += 1;
      return false;
    }
    if (LINHA_INSTITUCIONAL.some(padrao => padrao.test(linha))) {
      removidas += 1;
      return false;
    }
    return true;
  });

  const texto_limpo = limpas.join('\n').replace(/\n{3,}/g, '\n\n').trim();

  // Se a limpeza comeu quase tudo, o documento era curto ou atípico: devolve o original.
  if (texto_limpo.length < 40) {
    return { texto: String(texto || ''), removidas: 0 };
  }
  return { texto: texto_limpo, removidas };
}

export default stripBoilerplate;
