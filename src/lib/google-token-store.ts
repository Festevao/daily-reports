interface TokenData {
  accessToken: string
  refreshToken: string
  email: string
}

const store = new Map<string, TokenData>()

export function setTokens(data: TokenData): void {
  store.set('default', data)
}

export function getTokens(): TokenData | undefined {
  return store.get('default')
}

export function clearTokens(): void {
  store.delete('default')
}
