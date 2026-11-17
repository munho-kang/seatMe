import type { Env } from '../config.ts'
import { base64url, sessionCookie } from './naver.ts'

/**
 * 이메일 회원가입 · 로그인. 로그인 쿠키는 네이버 로그인과 같은 것을 준다 (./naver.ts sessionCookie) — 취향 · 기록 창구는 그대로 쓴다.
 *  - POST /api/auth/signup 몸통 { email, password, nickname } → 201 + 로그인 쿠키.
 *    이메일은 앞뒤 빈칸을 빼고 소문자로 맞춘다. 비밀번호 6 ~ 128글자, 닉네임 1 ~ 20글자(앞뒤 빈칸 뺌).
 *    틀리면 400 INVALID_SIGNUP, 이미 있는 이메일이면 409 EMAIL_TAKEN.
 *  - POST /api/auth/login 몸통 { email, password } → 204 + 로그인 쿠키. 이메일이 없거나 비밀번호가 틀리면 401 WRONG_LOGIN
 *    (어느 쪽이 틀렸는지 알려 주지 않는다).
 *  - 같은 이메일(로그인) · 같은 IP(회원가입)로 1분에 10번을 넘기면 429 TOO_MANY_TRIES (wrangler.jsonc의 LOGIN_LIMIT).
 *    단, Cloudflare는 기계마다 따로 세고 늦게 맞춰서 정확하지 않다 (2026-11-16 배포 주소에서 측정: 하나씩 30번은 전부 통과,
 *    한꺼번에 40번은 3번만 429). 몰아치는 시도를 늦추는 정도다.
 *    ponytail: 정확한 횟수 제한이 필요하면 Durable Object 하나에 이메일별로 센다
 * 보관함은 취향과 같은 PROFILES(D1 표 kv):
 *  - `email:<이메일>` → { id, salt, hash, iterations } — 비밀번호는 PBKDF2-SHA256으로 섞은 값만 둔다 (Web Crypto, 라이브러리 없음)
 *  - `account:<id>` → { nickname } — 마이 화면 이름 (/api/profile이 같이 돌려준다)
 * 계정 id는 ~ + 무작위 32글자라 네이버 id와 겹치지 않는다.
 */

// 50,000번 섞기 = 이 컴퓨터에서 약 4ms. 무료 요금제 계산 한도가 10ms라 더 올리지 않는다 (Workers 최대는 100,000번)
// ponytail: 유료 요금제로 바꾸면 100,000으로 올린다. 저장한 값에 횟수가 같이 있어 예전 계정도 그대로 로그인된다
const ITERATIONS = 50_000
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function signup(request: Request, env: Env): Promise<Response> {
  if (!env.SESSION_SECRET || !env.PROFILES) return Response.json({ error: 'LOGIN_NOT_CONFIGURED' }, { status: 503 })
  if (!(await allowed(env, `signup:${request.headers.get('CF-Connecting-IP') ?? ''}`))) return tooMany()
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const email = readEmail(body?.email)
  const password = body?.password
  const nickname = typeof body?.nickname === 'string' ? body.nickname.trim() : ''
  if (email === null || typeof password !== 'string' || password.length < 6 || password.length > 128
    || nickname.length < 1 || nickname.length > 20)
    return Response.json({ error: 'INVALID_SIGNUP' }, { status: 400 })
  // ponytail: 보관함에 "없을 때만 쓰기"가 없어, 같은 이메일로 동시에 가입하면 나중 것이 남는다. 사람이 늘면 d1Store에 INSERT OR IGNORE 쓰기를 더한다
  if ((await env.PROFILES.get(`email:${email}`)) !== null) return Response.json({ error: 'EMAIL_TAKEN' }, { status: 409 })
  const id = `~${[...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('')}`
  const salt = base64url(crypto.getRandomValues(new Uint8Array(16)))
  const hash = await hashPassword(password, salt, ITERATIONS)
  await env.PROFILES.put(`account:${id}`, JSON.stringify({ nickname }))
  await env.PROFILES.put(`email:${email}`, JSON.stringify({ id, salt, hash, iterations: ITERATIONS }))
  return new Response(null, { status: 201, headers: { 'Set-Cookie': await sessionCookie(id, env.SESSION_SECRET) } })
}

export async function emailLogin(request: Request, env: Env): Promise<Response> {
  if (!env.SESSION_SECRET || !env.PROFILES) return Response.json({ error: 'LOGIN_NOT_CONFIGURED' }, { status: 503 })
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const email = readEmail(body?.email)
  const password = body?.password
  const wrong = () => Response.json({ error: 'WRONG_LOGIN' }, { status: 401 })
  if (email === null || typeof password !== 'string' || password.length > 128) return wrong()
  if (!(await allowed(env, `login:${email}`))) return tooMany()
  const saved = await env.PROFILES.get(`email:${email}`)
  if (saved === null) return wrong()
  const user = JSON.parse(saved) as { id: string; salt: string; hash: string; iterations: number }
  if (!same(await hashPassword(password, user.salt, user.iterations), user.hash)) return wrong()
  return new Response(null, { status: 204, headers: { 'Set-Cookie': await sessionCookie(user.id, env.SESSION_SECRET) } })
}

/** 마이 화면에 보여 줄 닉네임. 네이버 계정이거나 없으면 null. */
export async function nicknameOf(id: string, env: Env): Promise<string | null> {
  if (!id.startsWith('~') || !env.PROFILES) return null
  const saved = await env.PROFILES.get(`account:${id}`)
  return saved === null ? null : (JSON.parse(saved) as { nickname: string }).nickname
}

function readEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  return email.length <= 254 && EMAIL.test(email) ? email : null
}

async function hashPassword(password: string, salt: string, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations }, key, 256)
  return base64url(bits)
}

/** 끝까지 다 비교한다 (몇 글자째에서 틀렸는지 시간으로 새지 않는다). */
function same(a: string, b: string): boolean {
  let diff = a.length ^ b.length
  for (let i = 0; i < Math.min(a.length, b.length); i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function allowed(env: Env, key: string): Promise<boolean> {
  return env.LOGIN_LIMIT ? (await env.LOGIN_LIMIT.limit({ key })).success : true
}

const tooMany = () => Response.json({ error: 'TOO_MANY_TRIES' }, { status: 429 })
