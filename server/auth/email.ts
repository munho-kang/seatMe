import { config, type Env, redact } from '../config.ts'
import { base64url, logout, sessionCookie, sessionUser } from './naver.ts'

/**
 * 이메일 회원가입 · 로그인 · 비밀번호 찾기 · 회원 탈퇴. 로그인 쿠키는 네이버 로그인과 같은 것을 준다 (./naver.ts sessionCookie).
 * 가입과 비밀번호 찾기는 그 주소로 보낸 6자리 인증번호를 넣어야 한다 — 남의 이메일로 먼저 가입해 주인을 막지 못하게 (2026-11-17).
 *  - POST /api/auth/code 몸통 { email, purpose: 'signup' | 'reset' } → 204, 인증번호 메일을 보낸다 (Brevo, 10분 동안 맞음).
 *    가입인데 이미 있는 이메일이면 409 EMAIL_TAKEN, 찾기인데 없는 이메일이면 404 NO_ACCOUNT
 *    (가입 화면이 어차피 가입 여부를 알려 주므로 숨기지 않는다). 칸이 틀리면 400 INVALID_EMAIL,
 *    같은 이메일로 1분 안에 다시 요청하면 429 TOO_MANY_TRIES, 메일을 못 보내면 502 MAIL_FAILED.
 *    인증번호는 이메일당 하나(새로 받으면 앞 번호는 버린다), 5번 틀리면 버린다, 맞으면 바로 지운다.
 *  - POST /api/auth/signup 몸통 { email, code, password, nickname } → 201 + 로그인 쿠키.
 *    이메일은 앞뒤 빈칸을 빼고 소문자로 맞춘다. 비밀번호 6 ~ 128글자, 닉네임 1 ~ 20글자(앞뒤 빈칸 뺌).
 *    틀리면 400 INVALID_SIGNUP, 이미 있는 이메일이면 409 EMAIL_TAKEN, 인증번호가 틀리거나 지났으면 400 WRONG_CODE.
 *  - POST /api/auth/reset 몸통 { email, code, password } → 204 + 로그인 쿠키. 비밀번호를 바꾸고, 그 전에 받은
 *    로그인 쿠키는 모두 쓸 수 없게 된다 (남이 먼저 가입한 이메일도 주인이 이걸로 되찾는다).
 *    칸이 틀리면 400 INVALID_RESET, 인증번호가 틀리면 400 WRONG_CODE.
 *  - POST /api/auth/login 몸통 { email, password } → 204 + 로그인 쿠키. 이메일이 없거나 비밀번호가 틀리면 401 WRONG_LOGIN
 *    (어느 쪽이 틀렸는지 알려 주지 않는다).
 *  - POST /api/auth/withdraw (로그인 쿠키) → 204, 계정의 취향 · 기록 · 이메일 계정을 지우고 로그아웃한다. 로그인 안 했으면 401.
 *    네이버 계정은 SeatMe에 남은 것만 지운다 (네이버의 연결 끊기는 네이버 설정에서 — 접근 토큰을 보관하지 않아 대신 못 한다).
 *  - 같은 이메일(로그인) · 같은 IP(회원가입 · 인증번호)로 1분에 10번을 넘기면 429 TOO_MANY_TRIES (wrangler.jsonc의 LOGIN_LIMIT).
 *    단, Cloudflare는 기계마다 따로 세고 늦게 맞춰서 정확하지 않다 (2026-11-16 배포 주소에서 측정: 하나씩 30번은 전부 통과,
 *    한꺼번에 40번은 3번만 429). 몰아치는 시도를 늦추는 정도다.
 *    ponytail: 정확한 횟수 제한이 필요하면 Durable Object 하나에 이메일별로 센다
 * 보관함은 취향과 같은 PROFILES(D1 표 kv):
 *  - `email:<이메일>` → { id, salt, hash, iterations } — 비밀번호는 PBKDF2-SHA256으로 섞은 값만 둔다 (Web Crypto, 라이브러리 없음)
 *  - `account:<id>` → { nickname, email, resetAt? } — 마이 화면 이름 (/api/profile이 같이 돌려준다), 탈퇴할 때 지울 이메일,
 *    마지막으로 비밀번호를 바꾼 시각 (./naver.ts sessionUser가 그 전 쿠키를 막는다)
 *  - `code:<이메일의 SHA-256>` → { purpose, hash, expires, sentAt, tries } — 가입하지 않고 떠난 사람의 이메일이 남지 않게 열쇠도 섞는다
 * 계정 id는 ~ + 무작위 32글자라 네이버 id와 겹치지 않는다.
 */

// 50,000번 섞기 = 이 컴퓨터에서 약 4ms. 무료 요금제 계산 한도가 10ms라 더 올리지 않는다 (Workers 최대는 100,000번)
// ponytail: 유료 요금제로 바꾸면 100,000으로 올린다. 저장한 값에 횟수가 같이 있어 예전 계정도 그대로 로그인된다
const ITERATIONS = 50_000
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CODE_MINUTES = 10
const CODE_TRIES = 5
const RESEND_MS = 60_000

type Purpose = 'signup' | 'reset'
type SavedEmail = { id: string; salt: string; hash: string; iterations: number }
type SavedCode = { purpose: Purpose; hash: string; expires: number; sentAt: number; tries: number }

export async function sendCode(request: Request, env: Env): Promise<Response> {
  if (!env.SESSION_SECRET || !env.PROFILES || !env.BREVO_API_KEY || !env.MAIL_FROM)
    return Response.json({ error: 'LOGIN_NOT_CONFIGURED' }, { status: 503 })
  if (!(await allowed(env, `code:${request.headers.get('CF-Connecting-IP') ?? ''}`))) return tooMany()
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const email = readEmail(body?.email)
  const purpose = body?.purpose
  if (email === null || (purpose !== 'signup' && purpose !== 'reset')) return Response.json({ error: 'INVALID_EMAIL' }, { status: 400 })
  const taken = (await env.PROFILES.get(`email:${email}`)) !== null
  if (purpose === 'signup' && taken) return emailTaken()
  if (purpose === 'reset' && !taken) return Response.json({ error: 'NO_ACCOUNT' }, { status: 404 })
  const key = await codeKey(email)
  const before = await env.PROFILES.get(key)
  const now = Date.now()
  if (before !== null && now - (JSON.parse(before) as SavedCode).sentAt < RESEND_MS) return tooMany()
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0')
  const saved: SavedCode = { purpose, hash: await codeHash(email, code, env.SESSION_SECRET), expires: now + CODE_MINUTES * 60_000, sentAt: now, tries: 0 }
  await env.PROFILES.put(key, JSON.stringify(saved))
  try {
    await sendMail(env, email, `[SeatMe] 인증번호 ${code}`,
      `SeatMe ${purpose === 'signup' ? '회원가입' : '비밀번호 찾기'} 인증번호는 ${code} 이에요.\n`
      + `${CODE_MINUTES}분 안에 화면에 넣어 주세요.\n\n직접 요청하지 않았다면 이 메일은 지워도 돼요.`)
  } catch (e) {
    await env.PROFILES.delete(key)
    console.warn(redact(`인증번호 메일을 보내지 못했어요: ${e instanceof Error ? e.message : e}`, env))
    return Response.json({ error: 'MAIL_FAILED' }, { status: 502 })
  }
  return new Response(null, { status: 204 })
}

export async function signup(request: Request, env: Env): Promise<Response> {
  if (!env.SESSION_SECRET || !env.PROFILES) return Response.json({ error: 'LOGIN_NOT_CONFIGURED' }, { status: 503 })
  if (!(await allowed(env, `signup:${request.headers.get('CF-Connecting-IP') ?? ''}`))) return tooMany()
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const email = readEmail(body?.email)
  const password = body?.password
  const nickname = typeof body?.nickname === 'string' ? body.nickname.trim() : ''
  if (email === null || !goodPassword(password) || nickname.length < 1 || nickname.length > 20)
    return Response.json({ error: 'INVALID_SIGNUP' }, { status: 400 })
  if ((await env.PROFILES.get(`email:${email}`)) !== null) return emailTaken()
  // 인증번호는 그 메일함 주인만 안다. 같은 번호로 동시에 두 번 가입해도 둘 다 주인이라 나중 것이 남아도 괜찮다
  if (!(await spendCode(env, email, body?.code, 'signup'))) return wrongCode()
  const id = `~${[...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('')}`
  await env.PROFILES.put(`account:${id}`, JSON.stringify({ nickname, email }))
  await env.PROFILES.put(`email:${email}`, JSON.stringify(await newPassword(id, password)))
  return new Response(null, { status: 201, headers: { 'Set-Cookie': await sessionCookie(id, env.SESSION_SECRET) } })
}

export async function resetPassword(request: Request, env: Env): Promise<Response> {
  if (!env.SESSION_SECRET || !env.PROFILES) return Response.json({ error: 'LOGIN_NOT_CONFIGURED' }, { status: 503 })
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const email = readEmail(body?.email)
  const password = body?.password
  if (email === null || !goodPassword(password)) return Response.json({ error: 'INVALID_RESET' }, { status: 400 })
  if (!(await allowed(env, `login:${email}`))) return tooMany()
  const saved = await env.PROFILES.get(`email:${email}`)
  if (saved === null || !(await spendCode(env, email, body?.code, 'reset'))) return wrongCode()
  const { id } = JSON.parse(saved) as SavedEmail
  const account = JSON.parse(await env.PROFILES.get(`account:${id}`) ?? '{}') as Record<string, unknown>
  await env.PROFILES.put(`account:${id}`, JSON.stringify({ ...account, email, resetAt: Date.now() }))
  await env.PROFILES.put(`email:${email}`, JSON.stringify(await newPassword(id, password)))
  return new Response(null, { status: 204, headers: { 'Set-Cookie': await sessionCookie(id, env.SESSION_SECRET) } })
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
  const user = JSON.parse(saved) as SavedEmail
  if (!same(await hashPassword(password, user.salt, user.iterations), user.hash)) return wrong()
  return new Response(null, { status: 204, headers: { 'Set-Cookie': await sessionCookie(user.id, env.SESSION_SECRET) } })
}

export async function withdraw(request: Request, env: Env): Promise<Response> {
  const id = await sessionUser(request, env, Date.now())
  if (id === null || !env.PROFILES) return Response.json({ error: 'NOT_LOGGED_IN' }, { status: 401 })
  const account = await env.PROFILES.get(`account:${id}`)
  const email = account === null ? undefined : (JSON.parse(account) as { email?: string }).email
  if (email) await env.PROFILES.delete(`email:${email}`)
  for (const key of [`account:${id}`, id, `history:${id}`]) await env.PROFILES.delete(key)
  return logout()
}

/** 마이 화면에 보여 줄 닉네임. 네이버 계정이거나 없으면 null. */
export async function nicknameOf(id: string, env: Env): Promise<string | null> {
  if (!id.startsWith('~') || !env.PROFILES) return null
  const saved = await env.PROFILES.get(`account:${id}`)
  return saved === null ? null : (JSON.parse(saved) as { nickname: string }).nickname
}

/** 인증번호가 맞으면 지우고 true. 틀리면 틀린 횟수를 하나 올린다. */
async function spendCode(env: Env, email: string, code: unknown, purpose: Purpose): Promise<boolean> {
  const key = await codeKey(email)
  const text = await env.PROFILES!.get(key)
  if (text === null || typeof code !== 'string') return false
  const saved = JSON.parse(text) as SavedCode
  if (saved.purpose !== purpose || saved.expires < Date.now() || saved.tries >= CODE_TRIES) return false
  if (!same(await codeHash(email, code.trim(), env.SESSION_SECRET!), saved.hash)) {
    await env.PROFILES!.put(key, JSON.stringify({ ...saved, tries: saved.tries + 1 }))
    return false
  }
  await env.PROFILES!.delete(key)
  return true
}

async function sendMail(env: Env, to: string, subject: string, text: string): Promise<void> {
  const response = await fetch(config.brevoUrl, {
    method: 'POST',
    headers: { 'api-key': env.BREVO_API_KEY!, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ sender: { name: 'SeatMe', email: env.MAIL_FROM }, to: [{ email: to }], subject, textContent: text }),
    signal: AbortSignal.timeout(config.mailTimeoutMs),
  })
  if (!response.ok) throw new Error(`Brevo ${response.status}: ${await response.text()}`)
}

function readEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  return email.length <= 254 && EMAIL.test(email) ? email : null
}

function goodPassword(password: unknown): password is string {
  return typeof password === 'string' && password.length >= 6 && password.length <= 128
}

async function newPassword(id: string, password: string): Promise<SavedEmail> {
  const salt = base64url(crypto.getRandomValues(new Uint8Array(16)))
  return { id, salt, hash: await hashPassword(password, salt, ITERATIONS), iterations: ITERATIONS }
}

async function hashPassword(password: string, salt: string, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations }, key, 256)
  return base64url(bits)
}

const sha256 = async (text: string) => base64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
const codeKey = async (email: string) => `code:${await sha256(email)}`
// 비밀값을 섞어, 보관함을 본 사람도 6자리를 다 넣어 보며 맞히지 못하게 한다
const codeHash = (email: string, code: string, secret: string) => sha256(`${secret}:${email}:${code}`)

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
const emailTaken = () => Response.json({ error: 'EMAIL_TAKEN' }, { status: 409 })
const wrongCode = () => Response.json({ error: 'WRONG_CODE' }, { status: 400 })
