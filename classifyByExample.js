import fs from 'fs';
import path from 'path';

const examples = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'examples.json'), 'utf-8')
);

function similarity(a, b) {
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = new Set([...wordsA].filter(w => wordsB.has(w)));
  return intersection.size / Math.max(wordsA.size, wordsB.size);
}

function classifyByExample(content) {
  let bestMatch = { type: 'Outro', score: 0 };

  for (const example of examples) {
    const score = similarity(content, example.sample);
    if (score > bestMatch.score) {
      bestMatch = { type: example.type, score };
    }
  }

  return bestMatch.score > 0.2 ? bestMatch.type : 'Outro';
}

module.exports = classifyByExample;
