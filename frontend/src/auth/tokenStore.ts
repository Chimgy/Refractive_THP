// The refresh token now lives in an httpOnly cookie set by the backend —
// invisible to JS by design, so there's nothing to store here for it. Only
// the access token is kept, in memory only (never survives a reload).
export type Tokens = {
  accessToken: string | null;
};

let tokens: Tokens = {
  accessToken: null,
};

export function getTokens(): Tokens {
  return tokens;
}

export function setTokens(next: Tokens): void {
  tokens = next;
}

export function clearTokens(): void {
  tokens = { accessToken: null };
}
