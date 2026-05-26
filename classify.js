import { OpenAI } from "openai";
import fs from "fs";
import { cosineSimilarity } from "./utils/cosineSimilarity.js";
import {
  buildEmbeddingInput,
  calculateLexicalScore,
  detectDocumentType,
  resolveTypeBoost,
} from "./documentFeatures.js";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const examples = JSON.parse(fs.readFileSync('examples.json', 'utf8'));
const TOP_EXAMPLES_PER_TYPE = 3;
const SEMANTIC_WEIGHT = 0.8;
const LEXICAL_WEIGHT = 0.2;

async function generateEmbedding(text) {
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return res.data[0].embedding;
}
 
export async function classify(text) {
  const embeddingInput = buildEmbeddingInput(text);
  const inputVector = await generateEmbedding(embeddingInput);
  const detectedTypes = detectDocumentType(text);
  const typeScores = new Map();

  for (const ex of examples) {
    if (!ex.embedding.length) {
      ex.embedding = await generateEmbedding(buildEmbeddingInput(ex.text));
    }

    const semanticScore = cosineSimilarity(inputVector, ex.embedding);
    const lexicalScore = calculateLexicalScore(embeddingInput, ex.text);
    const combinedScore =
      semanticScore * SEMANTIC_WEIGHT +
      lexicalScore * LEXICAL_WEIGHT;

    if (!typeScores.has(ex.type)) {
      typeScores.set(ex.type, []);
    }

    typeScores.get(ex.type).push(combinedScore);
  }

  let bestMatch = { type: null, score: -1 };

  for (const [type, scores] of typeScores.entries()) {
    const topScores = scores.sort((left, right) => right - left).slice(0, TOP_EXAMPLES_PER_TYPE);
    const averageScore =
      topScores.reduce((total, score) => total + score, 0) / topScores.length;
    const boostedScore = averageScore + resolveTypeBoost(type, detectedTypes);

    if (boostedScore > bestMatch.score) {
      bestMatch = { type, score: boostedScore };
    }
  }

  return bestMatch;
}
