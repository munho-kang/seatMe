/**
 * 이메일 회원가입 · 로그인 확인. KV 자리에는 Map, 시도 제한 자리에는 세기만 하는 가짜가 앉아 있다.
 * 규칙은 server/auth/email.ts 머리 주석이 기준이다.
 */
import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import type { Env } from '../config.ts'
import { handle } from '../index.ts'

const store = new Map<string, string>()
const tries = new Map<string, number>()
const ENV: Env = {
  SESSION_SECRET: 'session-secret',
  PROFILES: { get: async k => store.get(k) ?? null, put: async (k, v) => store.set(k, v) },
  LOGIN_LIMIT: { limit: async ({ key }) => ({ success: tries.set(key, (tries.get(key) ?? 0) + 1).get(key)! <= 10 }) },
}
beforeEach(() => tries.clear())
const post = (path: string, body: unknown, env = ENV) =>
  handle(new Request(`https://seatme.test${path}`, { method: 'POST', body: JSON.stringify(body) }), env)
const session = (res: Response) => res.headers.getSetCookie().find(c => c.startsWith('seatme_session='))?.split(';')[0]
const profileOf = async (cookie: string | undefined) =>
  (await handle(new Request('https://seatme.test/api/profile', { headers: { Cookie: cookie ?? '' } }), ENV)).json()

test('회원가입 → 로그인 쿠키 → 마이 화면 닉네임 · 취향 창구를 그대로 쓴다', async () => {
  const res = await post('/api/auth/signup', { email: ' Me@Example.com ', password: 'secret1', nickname: ' 문호 ' })
  assert.equal(res.status, 201)
  assert.deepEqual(await profileOf(session(res)), { profile: null, nickname: '문호' })
  // 비밀번호는 그대로 두지 않는다
  const saved = store.get('email:me@example.com')!
  assert.doesNotMatch(saved, /secret1/)
  assert.match(JSON.parse(saved).id, /^~[0-9a-f]{32}$/)
})

test('같은 이메일(대소문자 · 빈칸 달라도)로는 다시 가입할 수 없다', async () => {
  await post('/api/auth/signup', { email: 'dup@example.com', password: 'secret1', nickname: 'a' })
  const res = await post('/api/auth/signup', { email: 'DUP@example.com ', password: 'other12', nickname: 'b' })
  assert.equal(res.status, 409)
  assert.deepEqual(await res.json(), { error: 'EMAIL_TAKEN' })
  assert.equal(session(res), undefined)
})

test('가입 칸이 틀리면 400', async () => {
  const good = { email: 'new@example.com', password: 'secret1', nickname: '닉' }
  for (const body of [null, [], { ...good, email: 'no-at' }, { ...good, email: 'a@b' }, { ...good, password: '12345' },
    { ...good, password: 'x'.repeat(129) }, { ...good, password: 123456 }, { ...good, nickname: '  ' },
    { ...good, nickname: 'x'.repeat(21) }, { ...good, email: undefined }]) {
    const res = await post('/api/auth/signup', body)
    assert.equal(res.status, 400, JSON.stringify(body))
    assert.deepEqual(await res.json(), { error: 'INVALID_SIGNUP' })
  }
  assert.equal(store.has('email:new@example.com'), false)
})

test('로그인: 맞으면 같은 계정, 이메일이 없거나 비밀번호가 틀리면 똑같이 401', async () => {
  const signedUp = await post('/api/auth/signup', { email: 'log@example.com', password: 'secret1', nickname: '로그' })
  const ok = await post('/api/auth/login', { email: 'LOG@example.com', password: 'secret1' })
  assert.equal(ok.status, 204)
  assert.deepEqual(await profileOf(session(ok)), await profileOf(session(signedUp)))
  for (const body of [{ email: 'log@example.com', password: 'secret2' }, { email: 'none@example.com', password: 'secret1' },
    { email: 'log@example.com' }, {}, null]) {
    const res = await post('/api/auth/login', body)
    assert.equal(res.status, 401, JSON.stringify(body))
    assert.deepEqual(await res.json(), { error: 'WRONG_LOGIN' })
    assert.equal(session(res), undefined)
  }
})

test('같은 이메일로 너무 많이 시도하면 429 — 맞는 비밀번호도', async () => {
  await post('/api/auth/signup', { email: 'many@example.com', password: 'secret1', nickname: 'm' })
  for (let i = 0; i < 10; i++) await post('/api/auth/login', { email: 'many@example.com', password: 'wrong12' })
  const res = await post('/api/auth/login', { email: 'many@example.com', password: 'secret1' })
  assert.equal(res.status, 429)
  assert.deepEqual(await res.json(), { error: 'TOO_MANY_TRIES' })
})

test('비밀값 · 보관함이 없으면 503, POST만 받는다', async () => {
  assert.equal((await post('/api/auth/signup', {}, {})).status, 503)
  assert.equal((await post('/api/auth/login', {}, {})).status, 503)
  assert.equal((await handle(new Request('https://seatme.test/api/auth/login'), ENV)).status, 405)
})
