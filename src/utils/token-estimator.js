// Lightweight token estimator. Re-used by file-scanner for project size
// estimation and by use/update for live prompt budgeting. Heuristic only:
// English / Chinese / code-symbols are weighted differently because tokenizers
// like cl100k segment them at very different rates. Not exact, but good
// enough to flag obvious over-budget prompts.

function estimateTokensForContent(content) {
  let enCount = 0;
  let cnCount = 0;
  let codeCount = 0;

  for (const char of content) {
    const code = char.codePointAt(0);
    if (code >= 0x4e00 && code <= 0x9fff) {
      cnCount++;
    } else if ((code >= 0x0020 && code <= 0x007e) || code === 0x000a || code === 0x000d) {
      if (/[a-zA-Z0-9\s]/.test(char)) {
        enCount++;
      } else {
        codeCount++;
      }
    }
  }

  return Math.round(enCount * 0.3 + cnCount * 0.6 + codeCount * 0.4);
}

// Compare an estimate against a provider budget. Returns a structured result
// so callers can render UI or print CLI warnings without re-doing the math.
function evaluatePromptBudget(prompt, maxTokens) {
  const estimate = estimateTokensForContent(prompt || '');
  const budget = Number.isFinite(maxTokens) ? Number(maxTokens) : null;
  let status = 'ok';
  let ratio = null;
  if (budget && budget > 0) {
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
