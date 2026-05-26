import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { extractDocumentMetadata } from "../metadata.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturePath = path.join(__dirname, "..", "fixtures", "metadata-extraction-cases.json");
const cases = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

for (const testCase of cases) {
  test(`metadata: ${testCase.name}`, () => {
    const actual = extractDocumentMetadata(testCase.text);
    assert.deepEqual(actual, testCase.expected);
  });
}
