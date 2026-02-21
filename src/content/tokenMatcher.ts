const INVISIBLE_TEXT_CHARS = /[\u200B-\u200F\u2060\uFEFF]/g;

export const normalizeTokenText = (value: string): string =>
  value.normalize("NFKC").replace(INVISIBLE_TEXT_CHARS, "").replace(/\s+/g, " ").trim().toLowerCase();

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const matchesTokenBoundary = (text: string, token: string): boolean => {
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(token)}($|[^\\p{L}\\p{N}])`, "iu");
  return pattern.test(text);
};

const matchesSpacedAsciiToken = (text: string, token: string): boolean => {
  const sequence = token
    .split("")
    .map((char) => escapeRegExp(char))
    .join("[\\s\\p{P}\\p{S}]+");
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${sequence}($|[^\\p{L}\\p{N}])`, "iu");
  return pattern.test(text);
};

export const hasToken = (value: string, token: string): boolean => {
  const normalized = normalizeTokenText(value);
  if (!normalized) {
    return false;
  }

  const normalizedToken = normalizeTokenText(token);
  if (!normalizedToken) {
    return false;
  }

  if (/^[a-z]+$/i.test(normalizedToken)) {
    return matchesTokenBoundary(normalized, normalizedToken) || matchesSpacedAsciiToken(normalized, normalizedToken);
  }

  return normalized.includes(normalizedToken) || matchesTokenBoundary(normalized, normalizedToken);
};

export const hasAnyToken = (value: string, tokens: string[]): boolean => {
  return tokens.some((token) => hasToken(value, token));
};
