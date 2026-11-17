/**
 * 이메일 회원가입 · 로그인 · 비밀번호 찾기 · 탈퇴 확인. 보관함 자리에는 Map, 시도 제한 자리에는 세기만 하는 가짜,
 * Brevo 자리에는 받은 메일을 모아 두는 가짜 서버가 앉아 있다. 규칙은 server/auth/email.ts 머리 주석이 기준이다.
 */
import assert from 'node:assert/strict'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { after, before, beforeEach, mock, test } from 'node:test'
import { config, type Env } from '../config.ts'
import { handle } from '../index.ts'

const REAL_CONFIG = { ...config }
const store = new Map<string, string>()
const tries = new Map<string, number>()
const ENV: Env = {
  SESSION_SECRET: 'session-secret', BREVO_API_KEY: 'brevo-key', MAIL_FROM: 'from@example.com',
  PROFILES: { get: async k => store.get(k) ?? null, put: async (k, v) => store.set(k, v), delete: async k => store.delete(k) },
  LOGIN_LIMIT: { limit: async ({ key }) => ({ success: tries.set(key, (tries.get(key) ?? 0) + 1).get(key)! <= 10 }) },
}

// 가짜 Brevo: 키가 맞으면 메일을 mails에 모은다. brevoDown이면 500
const mails: { to: string; text: string; from: string }[] = []
let brevoDown = false
const server = http.createServer((req, res) => {
  let body = ''
  req.on('data', chunk => (body += chunk))
  req.on('end', () => {
    if (brevoDown || req.headers['api-key'] !== 'brevo-key') return res.writeHead(500).end('{"message":"down"}')
    const mail = JSON.parse(body)
    mails.push({ to: mail.to[0].email, text: mail.textContent, from: mail.sender.email })
    res.writeHead(201, { 'Content-Type': 'application/json' }).end('{"messageId":"m"}')
  })
})
let logs = ''
mock.method(console, 'warn', (...args: unknown[]) => { logs += args.join(' ') + '\n' })
before(async () => {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  Object.assign(config, { brevoUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, mailTimeoutMs: 500 })
})
after(() => {
  Object.assign(config, REAL_CONFIG)
  server.closeAllConnections()
  server.close()
})
beforeEach(() => {
  tries.clear()
  brevoDown = false
})

const post = (path: string, body: unknown, env = ENV, cookie = '') =>
  handle(new Request(`https://seatme.test${path}`, { method: 'POST', body: JSON.stringify(body), headers: { Cookie: cookie } }), env)
const session = (res: Response) => res.headers.getSetCookie().find(c => c.startsWith('seatme_session='))?.split(';')[0]
const profileOf = async (cookie: string | undefined) =>
  (await handle(new Request('https://seatme.test/api/profile', { headers: { Cookie: cookie ?? '' } }), ENV)).json()

/** 인증번호를 요청하고 메일로 온 6자리를 돌려준다. */
async function codeFor(email: string, purpose: 'signup' | 'reset'): Promise<string> {
  const res = await post('/api/auth/code', { email, purpose })
  assert.equal(res.status, 204)
  return /\d{6}/.exec(mails.at(-1)!.text)![0]
}
async function signUp(email: string, password = 'secret1', nickname = '닉') {
  return post('/api/auth/signup', { email, code: await codeFor(email, 'signup'), password, nickname })
}

test('인증번호 메일 → 회원가입 → 로그인 쿠키 → 마이 화면 닉네임 · 취향 창구를 그대로 쓴다', async () => {
  const code = await codeFor(' Me@Example.com ', 'signup')
  assert.deepEqual({ to: mails.at(-1)!.to, from: mails.at(-1)!.from }, { to: 'me@example.com', from: 'from@example.com' })
  const res = await post('/api/auth/signup', { email: 'me@example.com', code, password: 'secret1', nickname: ' 문호 ' })
  assert.equal(res.status, 201)
  assert.deepEqual(await profileOf(session(res)), { profile: null, nickname: '문호' })
  // 비밀번호 · 인증번호는 그대로 두지 않고, 쓴 인증번호는 지운다
  const saved = store.get('email:me@example.com')!
  assert.doesNotMatch(saved, /secret1/)
  assert.match(JSON.parse(saved).id, /^~[0-9a-f]{32}$/)
  assert.equal([...store.keys()].some(k => k.startsWith('code:')), false)
})

test('남의 이메일로는 가입할 수 없다: 인증번호가 없거나 틀리면 400 WRONG_CODE, 5번 틀리면 맞는 번호도 안 된다', async () => {
  const body = { email: 'victim@example.com', password: 'secret1', nickname: '가짜' }
  for (const code of [undefined, '000000', 123456]) {
    const res = await post('/api/auth/signup', { ...body, code })
    assert.equal(res.status, 400)
    assert.deepEqual(await res.json(), { error: 'WRONG_CODE' })
  }
  const code = await codeFor('victim@example.com', 'signup')
  const wrong = code === '111111' ? '222222' : '111111'
  for (let i = 0; i < 5; i++) await post('/api/auth/signup', { ...body, code: wrong })
  assert.equal((await post('/api/auth/signup', { ...body, code })).status, 400)
  assert.equal(store.has('email:victim@example.com'), false)
})

test('인증번호는 가입 · 찾기 용도가 서로 섞이지 않고, 10분이 지나면 쓸 수 없다', async () => {
  await signUp('mix@example.com')
  const reset = await codeFor('mix@example.com', 'reset')
  assert.equal((await post('/api/auth/signup', { email: 'mix2@example.com', code: reset, password: 'secret1', nickname: 'a' })).status, 400)
  const code = await codeFor('late@example.com', 'signup')
  const later = Date.now() + 10 * 60_000 + 1
  mock.method(Date, 'now', () => later)
  try {
    assert.equal((await post('/api/auth/signup', { email: 'late@example.com', code, password: 'secret1', nickname: 'a' })).status, 400)
  } finally {
    mock.restoreAll()
    mock.method(console, 'warn', (...args: unknown[]) => { logs += args.join(' ') + '\n' })
  }
})

test('인증번호 요청: 이미 가입 409, 없는 계정 찾기 404, 1분 안에 또 429, 칸이 틀리면 400, 메일이 안 가면 502', async () => {
  await signUp('dup@example.com')
  assert.equal((await post('/api/auth/code', { email: 'DUP@example.com ', purpose: 'signup' })).status, 409)
  assert.equal((await post('/api/auth/code', { email: 'none@example.com', purpose: 'reset' })).status, 404)
  await codeFor('again@example.com', 'signup')
  assert.equal((await post('/api/auth/code', { email: 'again@example.com', purpose: 'signup' })).status, 429)
  for (const body of [null, { email: 'no-at', purpose: 'signup' }, { email: 'a@b.com' }, { email: 'a@b.com', purpose: 'x' }])
    assert.equal((await post('/api/auth/code', body)).status, 400, JSON.stringify(body))
  brevoDown = true
  const res = await post('/api/auth/code', { email: 'down@example.com', purpose: 'signup' })
  assert.equal(res.status, 502)
  assert.deepEqual(await res.json(), { error: 'MAIL_FAILED' })
  assert.doesNotMatch(logs, /brevo-key/)
  // 못 보냈으면 1분을 기다리지 않고 바로 다시 요청할 수 있다
  brevoDown = false
  tries.clear() // 이 테스트에서 이미 같은 IP로 10번을 썼다
  await codeFor('down@example.com', 'signup')
  // 이메일은 열쇠에 그대로 남지 않는다
  assert.equal([...store.keys()].some(k => k.startsWith('code:') && k.includes('@')), false)
})

test('가입 칸이 틀리면 400', async () => {
  const good = { email: 'new@example.com', password: 'secret1', nickname: '닉', code: '123456' }
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
  const signedUp = await signUp('log@example.com', 'secret1', '로그')
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

test('비밀번호 찾기: 새 비밀번호로 로그인, 예전 비밀번호 · 예전 로그인 쿠키는 쓸 수 없다 (남이 먼저 가입한 계정 되찾기)', async () => {
  const squatter = session(await signUp('owner@example.com', 'squat12', '가짜'))
  const code = await codeFor('owner@example.com', 'reset')
  assert.equal((await post('/api/auth/reset', { email: 'owner@example.com', code: '999999x', password: 'mine123' })).status, 400)
  const res = await post('/api/auth/reset', { email: 'owner@example.com', code, password: 'mine123' })
  assert.equal(res.status, 204)
  assert.deepEqual(await profileOf(session(res)), { profile: null, nickname: '가짜' })
  assert.equal((await post('/api/auth/login', { email: 'owner@example.com', password: 'squat12' })).status, 401)
  assert.equal((await post('/api/auth/login', { email: 'owner@example.com', password: 'mine123' })).status, 204)
  assert.deepEqual(await profileOf(squatter), { error: 'NOT_LOGGED_IN' })
  // 같은 번호로 두 번 바꾸지 못한다, 칸이 틀리면 400 INVALID_RESET
  assert.deepEqual(await (await post('/api/auth/reset', { email: 'owner@example.com', code, password: 'again12' })).json(), { error: 'WRONG_CODE' })
  assert.deepEqual(await (await post('/api/auth/reset', { email: 'owner@example.com', code, password: '123' })).json(), { error: 'INVALID_RESET' })
})

test('회원 탈퇴: 취향 · 기록 · 계정이 지워지고, 같은 이메일로 다시 가입할 수 있다', async () => {
  const cookie = session(await signUp('bye@example.com'))!
  const { id } = JSON.parse(store.get('email:bye@example.com')!)
  const put = (path: string, body: unknown) =>
    handle(new Request(`https://seatme.test${path}`, { method: 'PUT', body: JSON.stringify(body), headers: { Cookie: cookie } }), ENV)
  assert.equal((await put('/api/profile', { seatPosition: 'always-aisle', sunlight: 1, quietness: 2, turbulence: 3, quickExit: 4, view: 5 })).status, 204)
  assert.equal((await put('/api/history', { searches: [], picks: [], trips: [] })).status, 204)
  assert.equal((await post('/api/auth/withdraw', null)).status, 401)
  const res = await post('/api/auth/withdraw', null, ENV, cookie)
  assert.equal(res.status, 204)
  assert.match(res.headers.get('Set-Cookie')!, /seatme_session=; Max-Age=0/)
  assert.equal([...store.keys()].some(k => k.includes(id) || k.includes('bye@')), false)
  assert.deepEqual(await profileOf(cookie), { error: 'NOT_LOGGED_IN' })
  assert.equal((await signUp('bye@example.com')).status, 201)
})

test('회원 탈퇴: 예전에 가입해 계정 기록에 이메일이 없어도 (migrations/0002가 채우기 전) 취향 · 기록은 지운다', async () => {
  const cookie = session(await signUp('old@example.com'))!
  const { id } = JSON.parse(store.get('email:old@example.com')!)
  store.set(`account:${id}`, JSON.stringify({ nickname: '옛' }))
  store.set(id, '{}')
  assert.equal((await post('/api/auth/withdraw', null, ENV, cookie)).status, 204)
  assert.equal(store.has(id) || store.has(`account:${id}`), false)
})

test('같은 이메일로 너무 많이 시도하면 429 — 맞는 비밀번호도', async () => {
  await signUp('many@example.com')
  for (let i = 0; i < 10; i++) await post('/api/auth/login', { email: 'many@example.com', password: 'wrong12' })
  const res = await post('/api/auth/login', { email: 'many@example.com', password: 'secret1' })
  assert.equal(res.status, 429)
  assert.deepEqual(await res.json(), { error: 'TOO_MANY_TRIES' })
})

test('같은 IP에서 여러 이메일로 너무 많이 시도하면 429 — 다른 IP는 그대로', async () => {
  const login = (email: string, ip: string) => handle(new Request('https://seatme.test/api/auth/login', {
    method: 'POST', body: JSON.stringify({ email, password: 'wrong12' }), headers: { 'CF-Connecting-IP': ip } }), ENV)
  for (let i = 0; i < 10; i++) assert.equal((await login(`u${i}@example.com`, '1.1.1.1')).status, 401)
  assert.equal((await login('u10@example.com', '1.1.1.1')).status, 429)
  assert.equal((await login('u10@example.com', '2.2.2.2')).status, 401)
})

test('로그아웃한 쿠키는 서버에서도 못 쓴다 — 다른 기기 쿠키는 그대로', async () => {
  const phone = session(await signUp('out@example.com'))!
  const laptop = session(await post('/api/auth/login', { email: 'out@example.com', password: 'secret1' }))!
  assert.equal((await post('/api/auth/logout', null, ENV, phone)).status, 204)
  assert.deepEqual(await profileOf(phone), { error: 'NOT_LOGGED_IN' })
  assert.deepEqual(await profileOf(laptop), { profile: null, nickname: '닉' })
  // 가짜 쿠키로는 보관함에 아무것도 적지 않는다
  const before = store.size
  await post('/api/auth/logout', null, ENV, 'seatme_session=~abc.99999999999999.fake')
  assert.equal(store.size, before)
})

test('비밀값 · 보관함 · 메일 키가 없으면 503, POST만 받는다', async () => {
  for (const path of ['/api/auth/signup', '/api/auth/login', '/api/auth/code', '/api/auth/reset'])
    assert.equal((await post(path, {}, {})).status, 503, path)
  assert.equal((await post('/api/auth/code', { email: 'a@b.com', purpose: 'signup' }, { ...ENV, BREVO_API_KEY: undefined })).status, 503)
  for (const path of ['/api/auth/login', '/api/auth/code', '/api/auth/reset', '/api/auth/withdraw'])
    assert.equal((await handle(new Request(`https://seatme.test${path}`), ENV)).status, 405, path)
})
