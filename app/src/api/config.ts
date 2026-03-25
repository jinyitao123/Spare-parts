/** Weave backend base URL — resolved at build time or falls back to proxy in dev. */
export const WEAVE_BASE_URL = import.meta.env.VITE_WEAVE_URL ?? '/api'

/** JWT token — for dev, obtained from /v1/auth/token; for prod, injected by auth flow. */
let _token = ''

export function setToken(t: string) { _token = t }
export function getToken() { return _token }
