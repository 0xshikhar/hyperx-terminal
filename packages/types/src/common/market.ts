const STABLE_QUOTE_ALIASES = new Set(["USD", "USDC", "USDT"]);
const MARKET_SUFFIX_PATTERN = /(?:[-_]?PERP)$/i;

export type MarketSymbolParts = {
  base: string;
  quote: string;
  isPerp: boolean;
};

function sanitizeMarketSymbol(symbol: string): string {
  return symbol.trim().toUpperCase().replace(/\s+/g, "").replace(/\//g, "-").replace(/_/g, "-");
}

function splitMarketSymbol(symbol: string): MarketSymbolParts {
  const cleaned = sanitizeMarketSymbol(symbol);
  const withoutPerp = cleaned.replace(MARKET_SUFFIX_PATTERN, "");
  const pieces = withoutPerp.split("-").filter(Boolean);

  if (pieces.length < 2) {
    return {
      base: withoutPerp,
      quote: "USD",
      isPerp: MARKET_SUFFIX_PATTERN.test(cleaned),
    };
  }

  const quote = pieces[pieces.length - 1];
  const base = pieces.slice(0, -1).join("-");

  return {
    base,
    quote,
    isPerp: MARKET_SUFFIX_PATTERN.test(cleaned),
  };
}

function normalizeQuoteForInternal(quote: string): string {
  return STABLE_QUOTE_ALIASES.has(quote) ? "USD" : quote;
}

function normalizeQuoteForVenue(quote: string): string {
  return STABLE_QUOTE_ALIASES.has(quote) ? "USDC" : quote;
}

export function normalizeMarketSymbol(symbol: string): string {
  const { base, quote } = splitMarketSymbol(symbol);
  return `${base}-${normalizeQuoteForInternal(quote)}`;
}

export function fromParadexMarketSymbol(symbol: string): string {
  return normalizeMarketSymbol(symbol);
}

export function toParadexMarketSymbol(symbol: string): string {
  const { base, quote } = splitMarketSymbol(symbol);
  return `${base}-${normalizeQuoteForInternal(quote)}-PERP`;
}

export function toMarketDisplaySymbol(symbol: string): string {
  const { base, quote } = splitMarketSymbol(symbol);
  return `${base}/${normalizeQuoteForVenue(normalizeQuoteForInternal(quote))}`;
}
