const REFRESH_TOKEN_KEY = 'thp.refreshToken';

export type Tokens = {
  accessToken: string | null;
  refreshToken: string | null;
};

let tokens: Tokens = {
  accessToken: null,
  refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY),
};

const listeners = new Set<(tokens: Tokens) => void>();

export function getTokens(): Tokens {
  return tokens;
}

export function setTokens(next: Tokens): void {
  tokens = next;
  if (next.refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, next.refreshToken);
  } else {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
  listeners.forEach((listener) => listener(tokens));
}

export function clearTokens(): void {
  setTokens({ accessToken: null, refreshToken: null });
}

export function subscribeToTokens(listener: (tokens: Tokens) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
