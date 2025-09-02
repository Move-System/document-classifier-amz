import { OpenAI } from "openai";
import fs from "fs";
import { cosineSimilarity } from "./utils/cosineSimilarity.js";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const examples = JSON.parse(fs.readFileSync('examples.json', 'utf8'));

async function generateEmbedding(text) {
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return res.data[0].embedding;
}
 
export async function classify(text) {
  const inputVector = await generateEmbedding(text);

  let bestMatch = { type: null, score: -1 };

  for (const ex of examples) {
    if (!ex.embedding.length) {
      ex.embedding = await generateEmbedding(ex.text);
    }

    const score = cosineSimilarity(inputVector, ex.embedding);
    if (score > bestMatch.score) {
      bestMatch = { type: ex.type, score };
    }
  }

  return bestMatch;
}
