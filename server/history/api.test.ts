/**
 * 검색 · 여행 기록 창구 확인. 네이버 자리에는 이 테스트가 띄운 가짜 서버, KV 자리에는 Map이 앉아 있다.
 * 규칙은 server/history/api.ts 머리 주석이 기준이다.
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
const server = http.createServer((req, res) => {
  const [path, query = ''] = (req.url ?? '').split('?')
  const json = (body: unknown) => res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(body))
  if (path === '/token') {
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

const PASSENGERS = { adult: 2, child: 1, infant: 1 }
const HISTORY = {
  searches: [{ from: 'GMP', to: 'CJU', date: '2026-12-01', returnDate: '2026-12-03', passengers: PASSENGERS, at: 1000 }],
  picks: [{ from: 'GMP', to: 'CJU', dep: '09:30' }],
  trips: [{ from: 'GMP', to: 'CJU', date: '2026-12-01', passengers: PASSENGERS, airline: '제주항공', flight: '7C115', dep: '09:30', seat: '12A', score: 88, rating: 5, at: 2000 }],
}

async function headersOf(): Promise<{ Cookie: string }> {
  return { Cookie: `seatme_session=${cookieOf(await login(), 'seatme_session')}` }
}

test('로그인 안 했으면 401', async () => {
  for (const method of ['GET', 'PUT']) {
    const res = await call('/api/history', { method, body: method === 'PUT' ? JSON.stringify(HISTORY) : undefined })
    assert.equal(res.status, 401)
    assert.deepEqual(await res.json(), { error: 'NOT_LOGGED_IN' })
  }
})

test('저장 → 읽기, 모르는 칸은 버린다', async () => {
  const headers = await headersOf()
  assert.deepEqual(await (await call('/api/history', { headers })).json(), { history: null })
  const put = await call('/api/history', { method: 'PUT', headers, body: JSON.stringify({ ...HISTORY, extra: 1 }) })
  assert.equal(put.status, 204)
  assert.deepEqual(JSON.parse(store.get('history:user_1')!), HISTORY)
  assert.deepEqual(await (await call('/api/history', { headers })).json(), { history: HISTORY })
})

test('취향과 열쇠가 겹치지 않는다', async () => {
  const headers = await headersOf()
  await call('/api/history', { method: 'PUT', headers, body: JSON.stringify(HISTORY) })
  const put = await call('/api/profile', { method: 'PUT', headers, body: JSON.stringify(PROFILE) })
  assert.equal(put.status, 204)
  assert.deepEqual(JSON.parse(store.get('user_1')!), PROFILE)
  assert.deepEqual(JSON.parse(store.get('history:user_1')!), HISTORY)
})

test('틀리면 400 INVALID_HISTORY', async () => {
  const headers = await headersOf()
  const [search] = HISTORY.searches
  const [pick] = HISTORY.picks
  const [trip] = HISTORY.trips
  const withSearch = (patch: object) => ({ ...HISTORY, searches: [{ ...search, ...patch }] })
  const withTrip = (patch: object) => ({ ...HISTORY, trips: [{ ...trip, ...patch }] })
  const bodies = ['', 'null', '[]',
    JSON.stringify({ picks: [], trips: [] }),
    JSON.stringify({ ...HISTORY, searches: Array(31).fill(search) }),
    JSON.stringify({ ...HISTORY, picks: [{ ...pick, dep: '24:00' }] }),
    ...[{ to: 'GMP' }, { to: 'ICN' }, { date: '2026-02-30' }, { returnDate: '2026-11-30' },
      { passengers: { adult: 0, child: 0, infant: 0 } }, { passengers: { adult: 1, child: 0, infant: 2 } },
      { passengers: { adult: 5, child: 5, infant: 0 } }, { at: -1 }].map(p => JSON.stringify(withSearch(p))),
    ...[{ seat: '12a' }, { score: 101 }, { rating: 0 }, { rating: 4.5 }].map(p => JSON.stringify(withTrip(p)))]
  for (const body of bodies) {
    const res = await call('/api/history', { method: 'PUT', headers, body })
    assert.equal(res.status, 400, body)
    assert.deepEqual(await res.json(), { error: 'INVALID_HISTORY' })
  }
})

test('창구 방식', async () => {
  assert.equal((await call('/api/history', { method: 'POST' })).status, 405)
})
