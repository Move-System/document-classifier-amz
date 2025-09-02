import express from 'express';
import dotenv from 'dotenv';
import { classify } from './classify.js';
import { extractDocumentsRelations } from './relations.js';
import { encoding_for_model } from '@dqbd/tiktoken';

dotenv.config();

const app = express();
app.use(express.json());

const enc = encoding_for_model('gpt-3.5-turbo'); // só usado pra contar tokens
const MAX_TOKENS = 8192;

// 🧠 Função segura pra cortar texto sem quebrar caracteres
function truncateByToken(text,maxTokens)  {
  const tokens = enc.encode(text);

  if (tokens.length <= maxTokens) return text;

  const slicedTokens = tokens.slice(0, maxTokens);
  const decoded = enc.decode(slicedTokens);

  // Calcula quantos caracteres reais manter
  let totalBytes = 0;
  let charCount = 0;

  while (charCount < text.length && totalBytes < Buffer.byteLength(decoded)) {
    totalBytes += Buffer.byteLength(text[charCount]);
    charCount++;
  }

  return text.slice(0, charCount);
}

app.post('/classify', async (req, res) => {
  const { text } = req.body;

  if (!text) return res.status(400).json({ error: 'Texto é obrigatório' });

  try {
    const tokenCount = enc.encode(text).length;

    if (tokenCount > MAX_TOKENS) {
      console.warn(`Texto com ${tokenCount} tokens foi cortado para ${MAX_TOKENS}.`);
    }

    const safeText = truncateByToken(text, MAX_TOKENS);

    const type = await classify(safeText);
    const relation = await extractDocumentsRelations(safeText);

    const result = { ...type, relation };
    res.json(result);
    console.log(result);
  } catch (err) {
    console.error(err);
    if (
      err.response?.status === 400 &&
      err.response.data?.error?.message?.includes('maximum context length')
    ) {
      return res.status(413).json({ error: 'Texto muito grande para o modelo da OpenAI' });
    }
    res.status(500).json({ error: 'Ocorreu um erro ao classificar o texto' });
  }
});

app.listen(3001, () => {
  console.log('🔥 Microserviço de classificação rodando em http://localhost:3001');
});
