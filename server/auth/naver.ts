import { config, type Env, redact } from '../config.ts'

/**
 * 네이버 로그인. 네이버에서 받는 것은 이용자 식별자(id) 하나뿐이다 — 이름 · 이메일은 요청하지 않는다.
 *  1. GET /api/auth/naver → 네이버 로그인 화면으로 보낸다. 되돌아올 때 맞춰 볼 state를 쿠키에 둔다 (10분).
 *  2. GET /api/auth/naver/callback → state를 맞춰 보고, 네이버에서 id를 받아 로그인 쿠키(서명한 id)를 준다.
 *     계정 취향이 이미 있든 없든 화면 /login/done으로 보낸다 (기기 취향을 올릴지는 화면이 정한다). 실패하면 첫 화면(/).
 *  3. POST /api/auth/logout → 로그인 쿠키를 지운다.
 * 로그인 쿠키는 "id.만료시각.서명" — 서명은 SESSION_SECRET으로 만든 HMAC-SHA256이다 (Web Crypto, 라이브러리 없음).
 */

const SESSION = 'seatme_session'
const STATE = 'seatme_naver_state'
const SESSION_DAYS = 180
const NAVER_ID = /^[\w-]{1,128}$/

export async function naverLogin(request: Request, env: Env): Promise<Response> {
  if (!env.NAVER_CLIENT_ID || !env.SESSION_SECRET) return Response.json({ error: 'LOGIN_NOT_CONFIGURED' }, { status: 503 })
  const state = base64url(crypto.getRandomValues(new Uint8Array(16)))
  const query = new URLSearchParams({
    response_type: 'code', client_id: env.NAVER_CLIENT_ID, redirect_uri: callbackUrl(request), state,
  })
  return redirect(`${config.naverAuthUrl}/authorize?${query}`,
    cookie(STATE, state, 600, '/api/auth/naver/callback'))
}

export async function naverCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const state = url.searchParams.get('state')
  const code = url.searchParams.get('code')
  const clearState = cookie(STATE, '', 0, '/api/auth/naver/callback')
  // 사용자가 네이버에서 취소하면 code 없이 error=access_denied로 돌아온다
  if (!env.NAVER_CLIENT_ID || !env.NAVER_CLIENT_SECRET || !env.SESSION_SECRET
    || !code || !state || state !== readCookie(request, STATE))
    return redirect('/', clearState)
  try {
    const id = await naverId(env, code, state)
    if (id === null) return redirect('/', clearState)
    const expires = Date.now() + SESSION_DAYS * 24 * 3600_000
    const payload = `${id}.${expires}`
    const session = `${payload}.${base64url(await crypto.subtle.sign('HMAC', await key(env.SESSION_SECRET), utf8(payload)))}`
    return redirect('/login/done', clearState, cookie(SESSION, session, SESSION_DAYS * 24 * 3600, '/'))
  } catch (e) {
    console.warn(redact(`네이버 로그인 실패: ${e instanceof Error ? e.message : e}`, env))
    return redirect('/', clearState)
  }
}

export function logout(): Response {
  return new Response(null, { status: 204, headers: { 'Set-Cookie': cookie(SESSION, '', 0, '/') } })
}

/** 로그인 쿠키가 맞으면 네이버 id, 없거나 틀리거나 만료됐으면 null. */
export async function sessionUser(request: Request, env: Env, now: number): Promise<string | null> {
  const value = readCookie(request, SESSION)
  if (!value || !env.SESSION_SECRET) return null
  const [id, expires, signature] = value.split('.')
  if (!id || !NAVER_ID.test(id) || !/^\d+$/.test(expires ?? '') || Number(expires) <= now || !signature) return null
  const bytes = fromBase64url(signature)
  if (bytes === null) return null
  // verify는 서명을 끝까지 비교한다 (몇 글자째에서 틀렸는지 시간으로 새지 않는다)
  const ok = await crypto.subtle.verify('HMAC', await key(env.SESSION_SECRET), bytes, utf8(`${id}.${expires}`))
  return ok ? id : null
}

/** code → 접근 토큰 → 이용자 id. 네이버가 오류로 답하면 null. */
async function naverId(env: Env, code: string, state: string): Promise<string | null> {
  const signal = AbortSignal.timeout(config.naverTimeoutMs)
  const query = new URLSearchParams({
    grant_type: 'authorization_code', client_id: env.NAVER_CLIENT_ID!, client_secret: env.NAVER_CLIENT_SECRET!, code, state,
  })
  // 네이버 문서대로 값은 주소에 싣는다. 이 주소는 로그에 남기지 않는다 (wrangler.jsonc에서 traces 꺼 둠)
  const token = await (await fetch(`${config.naverAuthUrl}/token?${query}`, { method: 'POST', signal })).json() as
    { access_token?: unknown; error?: unknown; error_description?: unknown }
  if (typeof token.access_token !== 'string') {
    console.warn(redact(`네이버 토큰 발급 실패: ${String(token.error)} (${String(token.error_description)})`, env))
    return null
  }
  const me = await (await fetch(`${config.naverApiUrl}/v1/nid/me`, {
    headers: { Authorization: `Bearer ${token.access_token}` }, signal,
  })).json() as { response?: { id?: unknown } }
  const id = me.response?.id
  return typeof id === 'string' && NAVER_ID.test(id) ? id : null
}

/** 네이버 앱에 등록한 콜백 주소와 같아야 한다: 배포 주소 · 내 컴퓨터(5173) 둘 다 등록한다. */
function callbackUrl(request: Request): string {
  return `${new URL(request.url).origin}/api/auth/naver/callback`
}

function redirect(location: string, ...cookies: string[]): Response {
  const headers = new Headers({ Location: location })
  for (const c of cookies) headers.append('Set-Cookie', c)
  return new Response(null, { status: 302, headers })
}

// SameSite=Lax: 네이버에서 돌아오는 이동(주소창 GET)에는 실리고, 다른 사이트가 몰래 보내는 PUT · POST에는 안 실린다
function cookie(name: string, value: string, maxAge: number, path: string): string {
  return `${name}=${value}; Max-Age=${maxAge}; Path=${path}; HttpOnly; Secure; SameSite=Lax`
}

function readCookie(request: Request, name: string): string | null {
  for (const part of (request.headers.get('Cookie') ?? '').split(';')) {
    const [k, v] = part.trim().split('=')
    if (k === name && v !== undefined) return v
  }
  return null
}

function key(secret: string) {
  return crypto.subtle.importKey('raw', utf8(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

const utf8 = (text: string) => new TextEncoder().encode(text)

function base64url(data: ArrayBuffer | Uint8Array): string {
  return btoa(String.fromCharCode(...new Uint8Array(data))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function fromBase64url(text: string): Uint8Array | null {
  try {
    return Uint8Array.from(atob(text.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0))
  } catch {
    return null
  }
}
