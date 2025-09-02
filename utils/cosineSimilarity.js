export function cosineSimilarity(a, b) {
    const dotProduct = a.reduce((acc, val, i) => acc + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((acc, val) => acc + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((acc, val) => acc + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
}