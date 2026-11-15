/**
 * 창구 GET /api/recommend 확인 (추천 창구의 규칙은 이 주석이 기준이다). 좌석과 점수는 계산만으로 정한다.
 * 공공데이터는 날씨 한 줄(weatherNote)을 붙이려고 기상청 단기예보만 부른다. 기상청 자리에는 이 테스트가 띄운 가짜 서버가 앉아 있다.
 *
 * 받는 칸 — 화면이 항공편을 고를 때 /api/flights에서 받은 값과 취향을 그대로 실어 보낸다:
 *  - from · to · date: /api/flights와 같은 규칙 (공항 GMP · CJU · PUS, 날짜는 오늘 ~ 1년 뒤).
 *  - flight: 편명 (앞 두 글자가 항공사). dep · arr: "HH:mm" 한국 시각. aircraftCode: 공항공사 기종 코드.
 *    도착이 출발보다 이르면 다음 날 도착으로 세고, 그렇게 센 비행 시간이 3시간을 넘으면 틀린 값이다.
 *  - seatMap: 계산에 쓸 배치도 id. 그 항공사 + 기종의 후보 중 하나여야 한다.
 *  - sunlight · view · quietness · turbulence · quickExit: 1~5 정수 (1은 "전혀 신경 안 씀").
 *  - seatPosition: always-aisle · prefer-aisle · any · prefer-window · always-window.
 *
 * 200 {aircraft, seatMapId, sun{left, right}, seats[3], weatherNote}:
 *  - aircraft: 기종 화면 이름. seatMapId: 계산에 쓴 배치도 (좌석 목록은 /api/seatmaps/{id}로 따로 받는다).
 *  - sun: 비행 중 왼쪽 · 오른쪽 창의 햇빛 세기 0~1.
 *  - seats: 일반석 TOP 3 {rank, seat, score, scores, features, tradeoff, unsure}. 등받이가 고정이라고 확인된 좌석은 나오지 않는다.
 *    score는 0~100 정수. scores는 항목별 점수 0~1 (sunlight · view · quietness · turbulence · quickExit · position).
 *    features는 잘 맞는 항목 이름(점수 0.7 이상, 최대 4개, 없으면 []), tradeoff는 가장 아쉬운 항목 이름(점수 0.7 미만 중 하나, 없으면 null).
 *    unsure는 항공사가 알려 주지 않은 정보로 어림한 항목 이름이다 (없으면 []): 창문 · 날개 위 여부를 모르는 창가의 view,
 *    화장실 위치를 모르는 배치의 quietness, 날개 위치를 모르는 배치의 turbulence. 점수는 있지만 화면은 "모름"으로 보여 준다.
 *    같은 항목이 features와 tradeoff 양쪽에 나오지 않고, unsure 항목은 어느 쪽에도 나오지 않는다. 문구는 화면이 만든다.
 *  - weatherNote: 출발 · 도착 공항의 기상청 예보로 만든 설명 한 줄, 없으면 null. 점수는 바꾸지 않는다. 이 한 줄만 서버가 문장으로 준다.
 *    흐림(SKY 4)이나 비 · 눈(PTY 1~4) 예보가 있으면 "출발할 때 김포공항 흐림 예보라 햇빛 걱정이 적어요 (11일 23시 발표 예보 기준)",
 *    두 공항 다 없으면 "출발 · 도착 공항 모두 흐림 · 비 예보가 없어요 (…)". 구름많음(SKY 3)은 흐림으로 치지 않는다.
 *    예보는 출발 · 도착 시각에 가장 가까운 것을 쓴다 (1시간 30분 안). 그런 예보가 없거나(4~5일 넘는 비행) 기상청이 답하지 않거나
 *    햇빛이 없는 밤 비행이면 null이고, 추천은 그대로 나간다.
 *
 * 오류: 값이 틀리거나 빠지면 400 {"error": "INVALID_QUERY"} (seatMap이 그 편의 후보가 아닐 때도).
 * 그 항공사 + 기종의 배치도가 하나도 없으면 404 {"error": "SEAT_MAP_NOT_READY"} (기종을 모르는 편도 여기).
 */
import assert from 'node:assert/strict'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { after, before, beforeEach, mock, test } from 'node:test'
import { config } from '../config.ts'
import { handle } from '../index.ts'
import { fromKst, kst } from '../kst.ts'
import { seatMaps } from '../seatmap/repository.ts'
import { forecast as kmaForecast } from '../weather/kma.ts'
import { rank } from './scorer.ts'

const ENV = { KMA_SERVICE_KEY: 'kma-test-key+/=' }
const REAL_CONFIG = { ...config }

/** 오늘(한국 날짜)에서 며칠 뒤. */
const day = (offset: number) => kst(Date.now() + offset * 86400_000).slice(0, 10)
const DAY = day(7)

// 가짜 기상청 — 기본은 죽어 있다(500). 테스트가 kmaBody를 채우면 그 예보를 돌려준다
let kmaBody: string | null = null
let kmaLastQuery = ''
const server = http.createServer((req, res) => {
  kmaLastQuery = (req.url ?? '').split('?')[1] ?? ''
  res.writeHead(kmaBody === null ? 500 : 200).end(kmaBody ?? '기상청 점검 중')
})

// 서버가 남기는 기록(console.warn)을 모은다 — 인증키가 섞이지 않는지 본다
let logs = ''
mock.method(console, 'warn', (...args: unknown[]) => { logs += args.join(' ') + '\n' })

before(async () => {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  Object.assign(config, { kmaBaseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, kmaTimeoutMs: 300 })
})
after(() => {
  Object.assign(config, REAL_CONFIG)
  server.closeAllConnections()
  server.close()
})
beforeEach(() => { // 기상청은 기본으로 죽어 있다
  kmaBody = null
  kmaLastQuery = ''
  logs = ''
})

// oxlint-disable-next-line typescript/no-explicit-any
const json = (res: Response): Promise<any> => res.json()

/** 김포→제주 제주항공 7C115 14:10~15:20 B738 + 기본 취향에서, change의 칸만 바꾸거나(null이면 빼고) 부른다. */
function recommend(change: Record<string, string | null> = {}): Promise<Response> {
  const query: Record<string, string | null> = {
    from: 'GMP', to: 'CJU', date: DAY, flight: '7C115', dep: '14:10', arr: '15:20', aircraftCode: 'B738',
    seatMap: '7C-B738-189', sunlight: '5', view: '3', quietness: '4', turbulence: '4', quickExit: '2',
    seatPosition: 'prefer-window', ...change,
  }
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) if (value !== null) params.set(key, value)
  return handle(new Request('http://x/api/recommend?' + params), ENV)
}

async function assertError(res: Response, status: number, error: string, label: string) {
  assert.equal(res.status, status, label)
  assert.equal((await json(res)).error, error, label)
}

/** 기상청 단기예보 한 줄: 그 날 · 그 시각의 SKY(1 맑음 · 3 구름많음 · 4 흐림) 또는 PTY(0 없음 · 1 비 …) 값. */
const forecastLine = (date: string, time: string, category: string, value: number) =>
  `{"baseDate":"20261111","baseTime":"2300","category":"${category}","fcstDate":"${date}","fcstTime":"${time}","fcstValue":"${value}","nx":57,"ny":126}`

const kmaJson = (...items: string[]) =>
  `{"response":{"header":{"resultCode":"00","resultMsg":"NORMAL_SERVICE"},"body":{"dataType":"JSON","items":{"item":[${items.join(',')}]},"pageNo":1,"numOfRows":2000,"totalCount":${items.length}}}}`

test('일반석_TOP_3를_돌려준다', async () => {
  const result = await recommend()

  assert.equal(result.status, 200)
  const body = await json(result)
  assert.deepEqual(Object.keys(body), ['aircraft', 'seatMapId', 'sun', 'seats', 'weatherNote'])
  assert.equal(body.aircraft, 'B737-800')
  assert.equal(body.seatMapId, '7C-B738-189')
  assert.deepEqual(body.seats.map((s: { rank: number }) => s.rank), [1, 2, 3])
  assert.deepEqual(Object.keys(body.seats[0]), ['rank', 'seat', 'score', 'scores', 'features', 'tradeoff', 'unsure'])
  assert.deepEqual(Object.keys(body.seats[0].scores), ['sunlight', 'view', 'quietness', 'turbulence', 'quickExit', 'position'])
  assert.ok(Number.isInteger(body.seats[0].score) && body.seats[0].score >= 0 && body.seats[0].score <= 100)
})

test('오후_편은_가는_방향에_따라_해가_드는_쪽과_추천_좌석의_좌우가_반대다', async () => {
  const south = await json(await recommend()) // 김포→제주 14:10, 해는 서쪽(오른쪽)
  assert.ok(south.sun.left === 0)
  assert.ok(south.sun.right > 0.2)
  assert.ok(south.seats[0].seat.endsWith('A'))

  const north = await json(await recommend({ from: 'CJU', to: 'GMP' }))
  assert.ok(north.sun.right === 0)
  assert.ok(north.sun.left > 0.2)
  assert.ok(north.seats[0].seat.endsWith('F'))
})

test('같은_편명도_시각이_다르면_햇빛이_다르다', async () => {
  const morning = await json(await recommend({ dep: '09:00', arr: '10:10' })) // 오전에는 해가 동쪽(왼쪽)
  assert.ok(morning.sun.left > 0.2)
  assert.ok(morning.sun.right === 0)

  const night = await json(await recommend({ dep: '22:00', arr: '23:10' }))
  assert.ok(night.sun.left === 0)
  assert.ok(night.sun.right === 0)
})

test('햇빛을_신경_안_쓰면_좌우_점수_차이가_없다', async () => {
  const { seats } = await json(await recommend({ sunlight: '1' }))

  // 같은 열의 왼쪽 창가와 오른쪽 창가가 같은 점수로 나란히 온다
  assert.ok(seats[0].seat.endsWith('A'))
  assert.ok(seats[1].seat.endsWith('F'))
  assert.equal(seats[1].score, seats[0].score)
})

test('날개_위치를_모르는_배치도_흔들림_점수를_어림해서_준다', async () => {
  const result = await recommend({ flight: 'ZE201', seatMap: 'ZE-B738-189' })

  assert.equal(result.status, 200)
  const { seats } = await json(result)
  assert.equal(typeof seats[0].scores.turbulence, 'number')
  assert.ok(seats[0].unsure.includes('turbulence'))
  assert.ok(!seats.flatMap((s: { features: string[] }) => s.features).includes('turbulence'))
})

test('모든_배치도에서_오류_없이_세_좌석이_나온다', () => {
  const profile = { sunlight: 5, view: 3, quietness: 4, turbulence: 4, quickExit: 2, seatPosition: 'prefer-window' }
  for (const map of seatMaps.all()) {
    const fixed = map.seats.filter(s => s.noRecline === true).map(s => s.seat)
    const ranked = rank(map, { left: 0.3, right: 0 }, profile)
    assert.ok(ranked.length >= 3, map.id)
    assert.ok(!ranked.some(s => fixed.includes(s.seat)), map.id) // 등받이 고정 좌석은 추천하지 않는다
  }
})

test('값이_틀리거나_빠지면_400', async () => {
  const wrong: Record<string, string> = {
    from: 'ICN',
    to: 'GMP', // 출발과 같다
    date: day(-1),
    flight: '7C',
    dep: '9:00',
    arr: '25:00',
    sunlight: '0',
    view: '6',
    quietness: 'abc',
    turbulence: '2.5',
    quickExit: '',
    seatPosition: 'window',
    seatMap: 'KE-A321-174', // 있는 배치도지만 이 편(제주항공 B738)의 후보가 아니다
  }
  for (const [key, value] of Object.entries(wrong))
    await assertError(await recommend({ [key]: value }), 400, 'INVALID_QUERY', `${key}=${value}`)

  for (const key of Object.keys(wrong))
    await assertError(await recommend({ [key]: null }), 400, 'INVALID_QUERY', `${key} 없음`)
})

test('비행_시간이_3시간을_넘으면_400', async () => {
  for (const arr of ['13:00', '14:10', '17:11']) // 출발 14:10보다 이르거나 같으면 다음 날 도착으로 센다
    await assertError(await recommend({ arr }), 400, 'INVALID_QUERY', 'arr=' + arr)
  assert.equal((await recommend({ dep: '23:30', arr: '00:40' })).status, 200) // 자정을 넘기는 1시간 10분
})

test('배치도가_없는_항공사와_기종이면_404', async () => {
  const changes: Record<string, string>[] = [
    { aircraftCode: 'A321' }, // 제주항공 A321은 배치도가 없다
    { aircraftCode: '' }, // 기종을 모르는 편
    { flight: 'XX123' },
  ]
  for (const change of changes)
    await assertError(await recommend(change), 404, 'SEAT_MAP_NOT_READY', JSON.stringify(change))
})

test('흐림_예보면_날씨_한_줄이_붙고_기상청이_죽어도_추천은_그대로다', async () => {
  const tomorrow = day(1)
  const down = await recommend({ date: tomorrow }) // 기상청이 500으로 죽어 있다
  assert.equal(down.status, 200)
  const downBody = await json(down)
  assert.equal(downBody.weatherNote, null)

  // 출발 14:10에 가장 가까운 14시는 흐림, 도착 15:20에 가장 가까운 15시는 맑음
  const date = tomorrow.replaceAll('-', '')
  kmaBody = kmaJson(forecastLine(date, '1400', 'SKY', 4), forecastLine(date, '1400', 'PTY', 0),
    forecastLine(date, '1500', 'SKY', 1), forecastLine(date, '1500', 'PTY', 0))
  const cloudy = await json(await recommend({ date: tomorrow }))
  assert.match(cloudy.weatherNote, /^출발할 때 김포공항 흐림 예보라 햇빛 걱정이 적어요 \(\d+일 \d+시 발표 예보 기준\)$/)
  // 날씨는 설명만 붙인다. 좌석과 점수는 그대로다
  assert.deepEqual(cloudy.seats, downBody.seats)
})

// ── JavaScript로 옮기면서 새로 생기는 문제 ──

// 표를 일반 객체로 찾으면 constructor · toString 같은 이름이 "있는 값"으로 나온다
test('객체_기본_속성_이름은_틀린_값이다 (JS)', async () => {
  for (const [name, value] of [['seatPosition', 'constructor'], ['seatPosition', 'toString'], ['from', '__proto__'], ['seatMap', 'constructor']])
    await assertError(await recommend({ [name]: value }), 400, 'INVALID_QUERY', `${name}=${value}`)
  await assertError(await recommend({ aircraftCode: 'constructor' }), 404, 'SEAT_MAP_NOT_READY', 'aircraftCode=constructor')
})

// undefined는 JSON에서 칸이 통째로 사라진다. 없음은 null로 나가야 한다
test('모름_칸은_null로_나가고_빠지지_않는다 (JS)', async () => {
  const body = await json(await recommend({ sunlight: '1', view: '1', quietness: '1', turbulence: '1', quickExit: '1', seatPosition: 'any' }))
  assert.ok(Object.hasOwn(body, 'weatherNote'))
  assert.equal(body.weatherNote, null)
  for (const seat of body.seats) {
    assert.deepEqual(Object.keys(seat), ['rank', 'seat', 'score', 'scores', 'features', 'tradeoff', 'unsure'])
    assert.equal(seat.tradeoff, null) // 전부 신경 안 쓰면 아쉬운 항목이 없다
  }
})

// Worker의 시계는 UTC다. 한국 00:00~08:59에는 UTC 날짜가 어제다
test('한국_자정_직후에도_발표_날짜는_한국_날짜다 (JS)', async () => {
  kmaBody = kmaJson(forecastLine('20261115', '1400', 'SKY', 4), forecastLine('20261115', '1400', 'PTY', 0))
  const when = fromKst('2026-11-15', '14:10')

  // 한국 11-15 01:00 → 가장 최근 발표는 한국 14일 23시
  const late = await kmaForecast(ENV, 'GMP', when, fromKst('2026-11-15', '01:00'))
  assert.ok(kmaLastQuery.includes('base_date=20261114&base_time=2300'), kmaLastQuery)
  assert.deepEqual(late, { sky: 4, pty: 0, announced: fromKst('2026-11-14', '23:00') })

  // 한국 11-15 02:20 → 02시 발표 (15분 뒤부터 받을 수 있다). 02:10이면 아직 23시 발표
  await kmaForecast(ENV, 'GMP', when, fromKst('2026-11-15', '02:20'))
  assert.ok(kmaLastQuery.includes('base_date=20261115&base_time=0200'), kmaLastQuery)
  await kmaForecast(ENV, 'GMP', when, fromKst('2026-11-15', '02:10'))
  assert.ok(kmaLastQuery.includes('base_date=20261114&base_time=2300'), kmaLastQuery)

  for (const part of ['serviceKey=kma-test-key%2B%2F%3D', 'nx=57', 'ny=126', 'dataType=JSON', 'numOfRows=2000'])
    assert.ok(kmaLastQuery.includes(part), part)
})

test('가장_가까운_예보를_쓰고_1시간_30분보다_멀면_없는_것이다 (JS)', async () => {
  const now = fromKst('2026-11-15', '09:00')
  kmaBody = kmaJson(forecastLine('20261115', '1200', 'SKY', 1), forecastLine('20261115', '1500', 'SKY', 4), forecastLine('20261115', '1500', 'PTY', 1))
  assert.equal((await kmaForecast(ENV, 'GMP', fromKst('2026-11-15', '13:20'), now))?.sky, 1) // 12시가 80분, 15시가 100분
  assert.deepEqual(await kmaForecast(ENV, 'GMP', fromKst('2026-11-15', '13:40'), now), { sky: 4, pty: 1, announced: fromKst('2026-11-15', '08:00') })
  assert.equal((await kmaForecast(ENV, 'GMP', fromKst('2026-11-15', '13:30'), now))?.sky, 1) // 같은 거리면 이른 쪽
  assert.equal(await kmaForecast(ENV, 'GMP', fromKst('2026-11-15', '16:31'), now), null) // 91분
  assert.equal(await kmaForecast(ENV, 'GMP', fromKst('2026-11-20', '09:01'), now), null) // 5일보다 멀면 묻지 않는다
  assert.equal(await kmaForecast({}, 'GMP', fromKst('2026-11-15', '13:20'), now), null) // 인증키가 없으면 묻지 않는다
})

// 공공데이터는 글자 자리에 숫자를 보내기도 한다 (Java는 알아서 글자로 바꿨다)
test('숫자로_온_칸도_읽는다 (JS)', async () => {
  const now = fromKst('2026-11-15', '09:00')
  kmaBody = kmaJson('{"category":"SKY","fcstDate":20261115,"fcstTime":1400,"fcstValue":4}', '{"category":"PTY","fcstDate":20261115,"fcstTime":1400,"fcstValue":3}')
  assert.deepEqual(await kmaForecast(ENV, 'GMP', fromKst('2026-11-15', '14:10'), now), { sky: 4, pty: 3, announced: fromKst('2026-11-15', '08:00') })

  // 읽을 수 없는 값이 섞이면 예보가 없는 것으로 본다
  kmaBody = kmaJson('{"category":"SKY","fcstDate":"20261115","fcstTime":"1400","fcstValue":"흐림"}')
  assert.equal(await kmaForecast(ENV, 'GMP', fromKst('2026-11-15', '14:10'), now), null)
})

test('연결이_안_될_때도_로그에_인증키가_없다 (JS)', async () => {
  const fakeUrl = config.kmaBaseUrl
  try {
    config.kmaBaseUrl = 'http://127.0.0.1:1' // 닫힌 포트
    const result = await recommend({ date: day(1) })
    assert.equal(result.status, 200)
    const body = await json(result)
    assert.equal(body.weatherNote, null)
    assert.equal(body.seats.length, 3)
    assert.ok(logs.includes('기상청'), logs)
    for (const secret of ['kma-test-key', 'serviceKey']) assert.ok(!logs.includes(secret), logs)
  } finally {
    config.kmaBaseUrl = fakeUrl
  }
})

// JSON이 아닌 답을 읽다 난 오류 문구에는 답의 앞머리가 들어 있다 (키에서 한 글자 빠진 조각은 가릴 수 없다)
test('기상청이_요청_주소를_되돌려_보내도_로그에_인증키_조각이_없다 (JS)', async () => {
  kmaBody = 'ma-test-key%2B%2F%3D&dataType=JSON&numOfRows=2000'
  const body = await json(await recommend({ date: day(1) }))
  assert.equal(body.weatherNote, null)
  assert.ok(logs.includes('기상청 예보 실패'), logs)
  assert.ok(!logs.includes('ma-test'), logs)
})
