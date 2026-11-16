/**
 * 네이버 로그인 + 내 취향 창구 확인. 네이버 자리에는 이 테스트가 띄운 가짜 서버, KV 자리에는 Map이 앉아 있다.
 * 규칙은 server/auth/naver.ts · server/profile/api.ts 머리 주석이 기준이다.
 */
import assert from 'node:assert/strict'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { after, before, mock, test } from 'node:test'
import { config, type Env } from '../config.ts'
import { handle } from '../index.ts'

const REAL_CONFIG = { ...config }
const store = new Map<string, string>()
const ENV: Env = {
  NAVER_CLIENT_ID: 'client-id', NAVER_CLIENT_SECRET: 'client-secret', SESSION_SECRET: 'session-secret',
  PROFILES: { get: async k => store.get(k) ?? null, put: async (k, v) => store.set(k, v) },
}
const PROFILE = { seatPosition: 'always-aisle', sunlight: 1, quietness: 2, turbulence: 3, quickExit: 4, view: 5 }

// 가짜 네이버: code "good"이면 토큰을, 그 토큰이면 id "user_1"을 준다
let tokenQuery = ''
const server = http.createServer((req, res) => {
  const [path, query = ''] = (req.url ?? '').split('?')
  const json = (body: unknown) => res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(body))
  if (path === '/token') {
    tokenQuery = query
    return json(new URLSearchParams(query).get('code') === 'good' ? { access_token: 'tok' } : { error: 'invalid_request' })
  }
  if (path === '/v1/nid/me' && req.headers.authorization === 'Bearer tok') return json({ resultcode: '00', response: { id: 'user_1' } })
  json({ resultcode: '024' })
})

let logs = ''
mock.method(console, 'warn', (...args: unknown[]) => { logs += args.join(' ') + '\n' })

before(async () => {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  Object.assign(config, { naverAuthUrl: base, naverApiUrl: base, naverTimeoutMs: 300 })
})
after(() => {
  Object.assign(config, REAL_CONFIG)
  server.closeAllConnections()
  server.close()
})

const call = (path: string, init: RequestInit = {}, env = ENV) => handle(new Request(`https://seatme.test${path}`, init), env)
const cookieOf = (res: Response, name: string) =>
  res.headers.getSetCookie().find(c => c.startsWith(`${name}=`))?.split(';')[0].slice(name.length + 1)

/** 로그인 1~2단계를 끝까지 돌고 로그인 쿠키 값을 돌려준다. */
async function login(code = 'good'): Promise<Response> {
  const start = await call('/api/auth/naver')
  const state = new URL(start.headers.get('Location')!).searchParams.get('state')!
  return call(`/api/auth/naver/callback?code=${code}&state=${state}`, { headers: { Cookie: `seatme_naver_state=${state}` } })
}

test('로그인 시작은 네이버로 보내고, 되돌아올 주소 · state를 싣는다', async () => {
  const res = await call('/api/auth/naver')
  assert.equal(res.status, 302)
  const to = new URL(res.headers.get('Location')!)
  assert.equal(to.searchParams.get('client_id'), 'client-id')
  assert.equal(to.searchParams.get('redirect_uri'), 'https://seatme.test/api/auth/naver/callback')
  assert.equal(cookieOf(res, 'seatme_naver_state'), to.searchParams.get('state'))
  // 이름 · 이메일 같은 추가 정보를 달라고 하지 않는다
  assert.equal(to.searchParams.get('scope'), null)
  // 비밀값이 없으면 시작하지 않는다
  assert.equal((await call('/api/auth/naver', {}, {})).status, 503)
})

test('로그인 → 취향 저장 → 다른 기기(같은 쿠키)에서 읽기 → 로그아웃', async () => {
  const done = await login()
  assert.equal(done.status, 302)
  assert.equal(done.headers.get('Location'), '/login/done')
  assert.match(tokenQuery, /client_secret=client-secret/)
  const session = cookieOf(done, 'seatme_session')!
  assert.match(session, /^user_1\.\d+\.[\w-]+$/)
  const headers = { Cookie: `other=1; seatme_session=${session}` }

  assert.deepEqual(await (await call('/api/profile', { headers })).json(), { profile: null, nickname: null })
  const put = await call('/api/profile', { method: 'PUT', headers, body: JSON.stringify({ ...PROFILE, extra: 1 }) })
  assert.equal(put.status, 204)
  assert.deepEqual(JSON.parse(store.get('user_1')!), PROFILE) // 모르는 칸은 버린다
  // 다시 로그인해도(새 쿠키) 같은 계정 값이 나온다
  const again = { Cookie: `seatme_session=${cookieOf(await login(), 'seatme_session')}` }
  assert.deepEqual(await (await call('/api/profile', { headers: again })).json(), { profile: PROFILE, nickname: null })

  const out = await call('/api/auth/logout', { method: 'POST' })
  assert.equal(out.status, 204)
  assert.match(out.headers.getSetCookie()[0], /^seatme_session=; Max-Age=0;/)
})

test('취향 칸이 틀리면 400 — /api/recommend와 같은 규칙', async () => {
  const headers = { Cookie: `seatme_session=${cookieOf(await login(), 'seatme_session')}` }
  for (const body of ['', '{', 'null', '[]',
    JSON.stringify({ ...PROFILE, seatPosition: 'middle' }), JSON.stringify({ ...PROFILE, sunlight: 6 }),
    JSON.stringify({ ...PROFILE, view: '5' }), JSON.stringify({ ...PROFILE, quietness: 2.5 }),
    JSON.stringify({ ...PROFILE, quickExit: undefined })]) {
    const res = await call('/api/profile', { method: 'PUT', headers, body })
    assert.equal(res.status, 400, body)
    assert.deepEqual(await res.json(), { error: 'INVALID_PROFILE' })
  }
})

test('로그인 쿠키가 없거나 고쳐졌거나 만료됐으면 401', async () => {
  const session = cookieOf(await login(), 'seatme_session')!
  const [id, expires, signature] = session.split('.')
  const past = String(Date.now() - 1)
  for (const cookie of ['', 'seatme_session=', `seatme_session=user_2.${expires}.${signature}`,
    `seatme_session=${id}.${Number(expires) + 1}.${signature}`, `seatme_session=${id}.${past}.${signature}`,
    `seatme_session=${id}.${expires}.!!!`, `seatme_session=${id}.${expires}`]) {
    const res = await call('/api/profile', { headers: { Cookie: cookie } })
    assert.equal(res.status, 401, cookie)
    assert.deepEqual(await res.json(), { error: 'NOT_LOGGED_IN' })
  }
  // 다른 서명 키로 만든 쿠키는 통하지 않는다
  const otherKey = { ...ENV, SESSION_SECRET: 'other' }
  assert.equal((await call('/api/profile', { headers: { Cookie: `seatme_session=${session}` } }, otherKey)).status, 401)
})

test('state가 다르거나, 취소했거나, 네이버가 거절하면 로그인 쿠키 없이 첫 화면으로', async () => {
  const start = await call('/api/auth/naver')
  const state = new URL(start.headers.get('Location')!).searchParams.get('state')!
  for (const [query, cookie] of [
    [`code=good&state=${state}`, 'seatme_naver_state=other'], // 다른 사람이 만든 로그인 주소
    [`code=good&state=${state}`, ''],
    [`error=access_denied&state=${state}`, `seatme_naver_state=${state}`], // 네이버에서 취소
  ]) {
    const res = await call(`/api/auth/naver/callback?${query}`, { headers: { Cookie: cookie } })
    assert.equal(res.headers.get('Location'), '/', query)
    assert.equal(cookieOf(res, 'seatme_session'), undefined)
  }
  logs = ''
  const refused = await login('bad')
  assert.equal(refused.headers.get('Location'), '/')
  assert.equal(cookieOf(refused, 'seatme_session'), undefined)
  assert.doesNotMatch(logs, /client-secret/)
})

test('창구마다 받는 방식이 정해져 있다', async () => {
  assert.equal((await call('/api/profile', { method: 'POST' })).status, 405)
  assert.equal((await call('/api/auth/logout')).status, 405)
  assert.equal((await call('/api/auth/naver', { method: 'PUT' })).status, 405)
})
