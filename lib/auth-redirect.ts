export function safeInternalPath(value: string | null | undefined, fallback = '/dashboard') {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback

  try {
    const url = new URL(value, 'https://swiftrbx.invalid')
    if (url.origin !== 'https://swiftrbx.invalid') return fallback
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return fallback
  }
}

export function getAuthReturnPath() {
  if (typeof window === 'undefined') return '/dashboard'
  return safeInternalPath(new URLSearchParams(window.location.search).get('next'))
}

export function authRouteHref(route: '/login' | '/register', next: string) {
  return `${route}?${new URLSearchParams({ next: safeInternalPath(next) }).toString()}`
}
