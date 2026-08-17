// Fuzzy-matches OCR-extracted line descriptions against a business's existing products.
// No external dependency: normalized Levenshtein similarity plus a SKU/barcode exact-match boost.

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function similarity(a, b) {
  const normA = a.trim().toLowerCase();
  const normB = b.trim().toLowerCase();
  if (!normA || !normB) return 0;
  if (normA === normB) return 1;
  const maxLen = Math.max(normA.length, normB.length);
  return 1 - levenshtein(normA, normB) / maxLen;
}

const MATCH_THRESHOLD = 0.55;

/**
 * @param {string} description OCR-extracted line description
 * @param {Array} products candidate products for the business (must include id, name, sku)
 * @param {number} topN how many suggestions to return
 */
function matchProduct(description, products, topN = 3) {
  const scored = products
    .map((product) => {
      const nameScore = similarity(description, product.name);
      const skuScore = product.sku ? similarity(description, product.sku) : 0;
      const score = Math.max(nameScore, skuScore);
      return { productId: product.id, name: product.name, sku: product.sku, score };
    })
    .sort((a, b) => b.score - a.score);

  const suggestions = scored.slice(0, topN);
  const best = suggestions[0];
  return {
    matchedProductId: best && best.score >= MATCH_THRESHOLD ? best.productId : null,
    confidence: best ? best.score : 0,
    suggestions,
  };
}

module.exports = { matchProduct, similarity, MATCH_THRESHOLD };
