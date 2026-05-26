import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { extractDocumentMetadata } from "../metadata.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fixturePath = path.join(__dirname, "..", "fixtures", "metadata-extraction-cases.json");
const cases = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

let titleHits = 0;
let yearHits = 0;

const failures = [];

for (const testCase of cases) {
  const actual = extractDocumentMetadata(testCase.text);
  const titleOk = actual.title === testCase.expected.title;
  const yearOk = actual.year === testCase.expected.year;

  if (titleOk) titleHits += 1;
  if (yearOk) yearHits += 1;

  if (!titleOk || !yearOk) {
    failures.push({
      name: testCase.name,
      expected: testCase.expected,
      actual,
    });
  }
}

const total = cases.length;

console.log(`Casos avaliados: ${total}`);
console.log(`Precisão título: ${titleHits}/${total} (${toPercent(titleHits, total)})`);
console.log(`Precisão ano: ${yearHits}/${total} (${toPercent(yearHits, total)})`);

if (failures.length) {
  console.log("\nFalhas:");
  for (const failure of failures) {
    console.log(`- ${failure.name}`);
    console.log(`  esperado: ${JSON.stringify(failure.expected)}`);
    console.log(`  recebido: ${JSON.stringify(failure.actual)}`);
  }
  process.exitCode = 1;
}

function toPercent(value, totalCount) {
  return ((value / totalCount) * 100).toFixed(1) + "%";
}
