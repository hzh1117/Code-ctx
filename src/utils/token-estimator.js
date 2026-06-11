// Lightweight token estimator. Re-used by file-scanner for project size
// estimation and by use/update for live prompt budgeting.
//
// Uses a word-boundary-aware heuristic that better approximates BPE
// tokenization (cl100k_base / o200k_base):
//   - English words: ~1 token per 4 chars (BPE averages ~3.5-4.5 chars/token)
//   - CJK characters: ~1 token per 1.5 chars (most CJK chars are 1-2 tokens)
//   - Code symbols/punctuation: ~1 token per 2 chars (BPE splits aggressively)
//   - Whitespace within words: absorbed into adjacent tokens
//   - Numbers: ~1 token per 3 digits
//
// Accuracy: within ~15% of tiktoken for typical English/Chinese/code mixed
// content, which is sufficient for budget warnings and strategy selection.

function estimateTokensForContent(content) {
  if (!content) return 0;

  let tokenCount = 0;
  // Split into segments by whitespace, then classify each segment
  const segments = content.split(/(\s+)/);

  for (const segment of segments) {
    if (!segment) continue;

    // Pure whitespace — typically merged with adjacent tokens by BPE
    if (/^\s+$/.test(segment)) {
      // Leading/trailing whitespace is free; mid-content whitespace is
      // absorbed into the preceding token. Count only standalone blocks.
      tokenCount += Math.max(0, Math.ceil(segment.length / 4) - 1);
      continue;
    }

    // CJK characters (each is typically 1-2 tokens)
    const cjkMatches = segment.match(/[一-鿿㐀-䶿豈-﫿]/g);
    if (cjkMatches) {
      tokenCount += Math.ceil(cjkMatches.length * 0.65);
    }

    // Numbers (3-4 digits per token in BPE)
    const numberMatches = segment.match(/\d+/g);
    if (numberMatches) {
      for (const num of numberMatches) {
        tokenCount += Math.max(1, Math.ceil(num.length / 3));
      }
    }

    // English words and code tokens — count by word boundaries
    const wordMatches = segment.match(/[a-zA-Z_][a-zA-Z0-9_]*/g);
    if (wordMatches) {
      for (const word of wordMatches) {
        // Short words (1-3 chars) are usually 1 token; longer words get
        // BPE-split at ~4 chars per token
        if (word.length <= 3) {
          tokenCount += 1;
        } else {
          tokenCount += Math.ceil(word.length / 4);
        }
      }
    }

    // Punctuation and symbols — BPE often maps common ones to single tokens
    const symbolMatches = segment.match(/[^a-zA-Z0-9_一-鿿㐀-䶿豈-﫿\s]/g);
    if (symbolMatches) {
      // Common single-char operators/brackets are usually 1 token each;
      // sequences of special chars may merge
      tokenCount += Math.ceil(symbolMatches.length * 0.7);
    }
  }

  return Math.max(1, Math.round(tokenCount));
}

// Compare an estimate against a provider budget. Returns a structured result
// so callers can render UI or print CLI warnings without re-doing the math.
function evaluatePromptBudget(prompt, maxTokens) {
  const estimate = estimateTokensForContent(prompt || '');
  const budget = Number.isFinite(maxTokens) ? Number(maxTokens) : null;
  let status = 'ok';
  let ratio = null;
  if (budget !== null && budget > 0) {
    ratio = estimate / budget;
    if (ratio >= 1) status = 'over';
    else if (ratio >= 0.8) status = 'warn';
  }
  return {
    estimate,
    maxTokens: budget,
    status,
    ratio
  };
}

module.exports = { estimateTokensForContent, evaluatePromptBudget };
