/**
 * 창구 GET /api/flights 확인. 국토부·공항공사 자리에는 이 테스트가 띄운 가짜 서버가 앉아 있다.
 * 요청 확인 규칙, 공항 코드 바꾸기, 편명 합치기, 그리고 상황 4가지:
 * ① 항공편 0개 → 200 빈 목록 · ② 국토부 실패 → 502 · ③ 잘못된 요청 → 400 · ④ 기종 모름 → 기종 칸만 비움.
 *
 * 항공편 한 개는 10칸이다 (이 창구의 약속은 이 주석이 전부다).
 * 앞 5칸은 국토부 답: airline(항공사 이름) · flightNumber · departureTime "14:10" · arrivalTime · duration.
 * 뒤 5칸은 공항공사 답과 좌석 배치도:
 *  - aircraft: 화면 이름 ("B738" → "B737-800"). 표에 없는 코드는 코드 그대로, 짝이 없으면 "".
 *  - aircraftCode: 공항공사 코드 ("B738"), 짝이 없으면 "".
 *  - seatMapReady: 편명 앞 두 글자(항공사) + 기종 코드의 배치도가 하나라도 있으면 true.
 *  - seatMaps: 후보 배치도 id 목록. 대표가 맨 앞이고, 없으면 [].
 *  - seatMapConfirmed: 후보가 정확히 하나로 정해졌으면 true (당일 편의 등록번호로 정해질 때 등).
 *    단, 항공사에 배치가 더 있는데 일부만 옮겨 적은 조합(파라타 A320)은 후보가 하나여도 false (등록번호로 정해질 때만 true).
 * 편명이 두 글자보다 짧거나 표에 없는 기종이어도 오류 없이 "배치도 없음"으로 나간다.
 */
import assert from 'node:assert/strict'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { after, before, beforeEach, mock, test } from 'node:test'
import { type KacItem, nearestRecord } from '../aircraft/kac.ts'
import { config } from '../config.ts'
import { handle } from '../index.ts'
import { fromKst, kst } from '../kst.ts'
import { notDeparted, validDay } from './flights.ts'
import type { Flight } from './molit.ts'

const ENV = { MOLIT_SERVICE_KEY: 'test-key+/=', KAC_API_KEY: 'kac-test-key' }
const REAL_CONFIG = { ...config }

// 가짜 국토부 서버 — 테스트마다 돌려줄 응답(몸통·상태·지연)을 바꿔 끼운다
// 가짜 공항공사 서버(/kac) — pageNo번째 쪽을 돌려주고, kacFailFromPage 쪽부터는 500으로 실패한다
const fake = {
  molitBody: '', molitStatus: 200, molitDelayMs: 0, molitCalls: 0, molitLastQuery: '',
  kacPages: [] as string[], kacFailFromPage: Infinity, kacDelayMs: 0, kacCalls: 0, kacLastQuery: '',
}
const server = http.createServer((req, res) => {
  const [path, query = ''] = (req.url ?? '').split('?')
  const send = (delayMs: number, status: number, body: string) =>
    setTimeout(() => res.writeHead(status, { 'Content-Type': 'application/json;charset=UTF-8' }).end(body), delayMs).unref()
  if (path.startsWith('/kac')) {
    fake.kacCalls++
    fake.kacLastQuery = query
    const page = Number(/pageNo=(\d+)/.exec(query)?.[1] ?? 1)
    send(fake.kacDelayMs, page >= fake.kacFailFromPage ? 500 : 200, fake.kacPages[page - 1] ?? kacPage(0))
  } else {
    fake.molitCalls++
    fake.molitLastQuery = query
    send(fake.molitDelayMs, fake.molitStatus, fake.molitBody)
  }
})

// 서버가 남기는 기록(console.warn)을 모은다 — 인증키가 섞이지 않는지 본다
let logs = ''
mock.method(console, 'warn', (...args: unknown[]) => { logs += args.join(' ') + '\n' })

before(async () => {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as AddressInfo).port
  Object.assign(config, {
    molitBaseUrl: `http://127.0.0.1:${port}`, molitTimeoutMs: 300,
    kacBaseUrl: `http://127.0.0.1:${port}/kac`, kacTimeoutMs: 300,
  })
})
after(() => {
  Object.assign(config, REAL_CONFIG)
  server.closeAllConnections()
  server.close()
})
beforeEach(() => {
  Object.assign(fake, {
    molitBody: molitJson('""'), // 기본은 "항공편 0개" 정상 응답
    molitStatus: 200, molitDelayMs: 0, molitCalls: 0, molitLastQuery: '',
    kacPages: [], kacFailFromPage: Infinity, kacDelayMs: 0, kacCalls: 0, kacLastQuery: '',
  })
  logs = ''
})

/** 오늘(한국 날짜)에서 며칠 뒤. */
const day = (offset: number) => kst(Date.now() + offset * 86400_000).slice(0, 10)
const VALID_DATE = day(7)
const VALID_DATE_MOLIT = VALID_DATE.replaceAll('-', '') // 국토부는 20261113 모양
const PAST_DATE = day(-1)

// ── 도우미 ──

const get = (path: string) => handle(new Request('http://x' + path), ENV)
const search = (from: string, to: string, date: string) => get('/api/flights?' + new URLSearchParams({ from, to, date }))
// oxlint-disable-next-line typescript/no-explicit-any
const json = (res: Response): Promise<any> => res.json()

async function assertInvalid(res: Response) {
  assert.equal(res.status, 400)
  assert.equal((await json(res)).error, 'INVALID_QUERY')
  assert.equal(fake.molitCalls, 0)
}
async function assertUpstream(res: Response) {
  assert.equal(res.status, 502)
  assert.equal((await json(res)).error, 'UPSTREAM_UNAVAILABLE')
}

/** 국토부 정상 응답 포장. items 자리에 목록(JSON 배열)·항목 하나(객체)·빈 글자("")를 그대로 넣는다. */
function molitJson(items: string): string {
  const body = items === '""' ? '""' : `{"item":${items}}`
  return `{"response":{"header":{"resultCode":"00","resultMsg":"NORMAL SERVICE."},"body":{"items":${body},"numOfRows":500,"pageNo":1,"totalCount":2}}}`
}
const D = VALID_DATE_MOLIT
const molitOne = (airline: string, flightNo: string) =>
  molitJson(`{"airlineNm":"${airline}","arrPlandTime":${D}1520,"depPlandTime":${D}1410,"vihicleId":"${flightNo}"}`)

/** 국토부 정상 응답: 14:10 7C115, 14:35 LJ569 */
function twoMolitFlights() {
  fake.molitBody = molitJson(`[
    {"airlineNm":"제주항공","arrPlandTime":${D}1520,"depPlandTime":${D}1410,"vihicleId":"7C115"},
    {"airlineNm":"진에어","arrPlandTime":${D}1545,"depPlandTime":${D}1435,"vihicleId":"LJ569"}
  ]`)
}

/** 공항공사 기록 한 건 — 실제 응답의 칸을 그대로 갖췄다. */
function kacItem(flightNo: string, hhmm: string, io: string, airport: string, city: string, code: string, reg = 'HL0000'): string {
  return `{"airFln":"${flightNo}","airlineEnglish":"AIRLINE","airlineKorean":"항공사","airport":"${airport}","aplRegNo":"${reg}","arrivedEng":"","arrivedKor":"","boardingEng":"","boardingKor":"","cdsrYn":"N","city":"${city}","etd":"","fid":"","gate":"1","icaoApmCd":"${code}","io":"${io}","line":"국내","rmkEng":"","rmkKor":"","std":"${D}${hhmm}"}`
}

/** 공항공사 정상 응답 한 쪽. totalCount는 모든 쪽을 합친 기록 수 (한 쪽 100건으로 쪽 수를 센다: 101이면 2쪽). */
function kacPage(totalCount: number, ...items: string[]): string {
  return `{"response":{"header":{"resultCode":"00","resultMsg":"NORMAL SERVICE."},"body":{"numOfRows":100,"pageNo":1,"totalCount":${totalCount},"items":{"item":[${items.join(',')}]}}}}`
}

// ── 상황 ③ 잘못된 요청 → 400, 국토부에는 묻지 않음 ──

test('모르는_공항이면_400', async () => assertInvalid(await search('ICN', 'CJU', VALID_DATE)))
test('출발과_도착이_같으면_400', async () => assertInvalid(await search('GMP', 'GMP', VALID_DATE)))
test('지난_날짜면_400', async () => assertInvalid(await search('GMP', 'CJU', PAST_DATE)))
test('일년_넘게_먼_날짜면_400', async () => assertInvalid(await search('GMP', 'CJU', day(365 * 2 + 1))))
test('연도가_다섯_자리여도_400', async () => assertInvalid(await search('GMP', 'CJU', '+12345-01-01')))
test('날짜_모양이_틀리면_400', async () => assertInvalid(await search('GMP', 'CJU', '2026.11.13')))
test('칸이_빠지면_400', async () => assertInvalid(await get('/api/flights?from=GMP&to=CJU')))

// ── 정상 → 200, 화면 모양으로 바꿔서 출발 시각 순으로 ──

test('국토부_응답을_화면_모양으로_바꿔_출발_시각_순으로_돌려준다', async () => {
  fake.molitBody = molitJson(`[
    {"airlineNm":"진에어","arrAirportNm":"제주","arrPlandTime":${D}1545,"depAirportNm":"서울/김포","depPlandTime":${D}1435,"economyCharge":100000,"prestigeCharge":0,"vihicleId":"LJ569"},
    {"airlineNm":"제주 항공","arrAirportNm":"제주","arrPlandTime":${D}1520,"depAirportNm":"서울/김포","depPlandTime":${D}1410,"economyCharge":0,"prestigeCharge":0,"vihicleId":"7C115"}
  ]`)

  const result = await search('GMP', 'CJU', VALID_DATE)

  assert.equal(result.status, 200)
  const { flights } = await json(result)
  assert.equal(flights.length, 2)
  assert.equal(flights[0].flightNumber, '7C115')
  assert.equal(flights[0].airline, '제주항공') // 국토부의 "제주 항공" 띄어쓰기를 지운다
  assert.equal(flights[0].departureTime, '14:10')
  assert.equal(flights[0].arrivalTime, '15:20')
  assert.equal(flights[0].duration, '1시간 10분')
  // 이 테스트의 가짜 공항공사는 기록이 없다 — 상황 ④ "기종 모름"
  assert.equal(flights[0].aircraft, '')
  assert.equal(flights[0].aircraftCode, '')
  assert.equal(flights[0].seatMapReady, false)
  assert.equal(flights[1].flightNumber, 'LJ569')
})

test('국토부에는_우리_공항_코드를_국토부_이름으로_바꿔_인증키와_함께_묻는다', async () => {
  await search('GMP', 'CJU', VALID_DATE)

  assert.equal(fake.molitCalls, 1)
  for (const part of ['depAirportId=NAARKSS', 'arrAirportId=NAARKPC', 'depPlandTime=' + VALID_DATE_MOLIT, 'serviceKey=test-key%2B%2F%3D', '_type=json'])
    assert.ok(fake.molitLastQuery.includes(part), part)
})

test('부산은_NAARKPK', async () => {
  await search('PUS', 'CJU', VALID_DATE)

  assert.ok(fake.molitLastQuery.includes('depAirportId=NAARKPK'))
})

test('인증키는_화면으로_나가지_않는다', async () => {
  const result = await search('GMP', 'CJU', VALID_DATE)
  assert.equal(result.status, 200)
  assert.ok(!(await result.text()).includes('test-key'))
})

// ── 상황 ① 항공편 0개 → 200 빈 목록 (국토부는 이때 items를 빈 글자 ""로 준다) ──

test('항공편이_없으면_빈_목록', async () => {
  const result = await search('GMP', 'CJU', VALID_DATE)
  assert.equal(result.status, 200)
  assert.deepEqual((await json(result)).flights, [])
})

test('항공편이_하나면_국토부는_목록_대신_항목_하나를_주는데_그래도_된다', async () => {
  fake.molitBody = molitOne('제주항공', '7C115')

  const result = await search('GMP', 'CJU', VALID_DATE)
  assert.equal(result.status, 200)
  assert.equal((await json(result)).flights[0].flightNumber, '7C115')
})

// ── 상황 ② 국토부가 답이 없거나 오류 → 502 ──

test('국토부가_제한_시간_안에_답하지_않으면_502', async () => {
  fake.molitDelayMs = 1500

  await assertUpstream(await search('GMP', 'CJU', VALID_DATE))
})

test('국토부가_인증키_오류를_돌려주면_502', async () => {
  fake.molitStatus = 403
  fake.molitBody = '{"OpenAPI_ServiceResponse":{"cmmMsgHeader":{"errMsg":"SERVICE_KEY_IS_NOT_REGISTERED_ERROR","returnAuthMsg":"등록되지 않은 서비스키","returnReasonCode":"30"}}}'

  await assertUpstream(await search('GMP', 'CJU', VALID_DATE))
})

test('국토부가_JSON이_아닌_것을_돌려주면_502', async () => {
  fake.molitBody = '<html>점검 중</html>'

  await assertUpstream(await search('GMP', 'CJU', VALID_DATE))
})

// ── 편명 합치기 ──

test('배치도가_있는_기종은_화면_이름을_붙이고_추천_가능으로_표시한다', async () => {
  twoMolitFlights()
  fake.kacPages = [kacPage(1, kacItem('7C115', '1410', 'O', 'GMP', 'CJU', 'B738'))]

  const { flights } = await json(await search('GMP', 'CJU', VALID_DATE))

  assert.equal(flights[0].aircraft, 'B737-800')
  assert.equal(flights[0].aircraftCode, 'B738')
  assert.equal(flights[0].seatMapReady, true)
  assert.deepEqual([...flights[0].seatMaps].sort(), ['7C-B738-174', '7C-B738-189'])
  assert.equal(flights[0].seatMapConfirmed, false)
  assert.equal(Object.keys(flights[0]).length, 10)
})

test('배치도가_없는_기종은_코드를_이름으로_쓰고_준비_중으로_표시한다', async () => {
  twoMolitFlights()
  fake.kacPages = [kacPage(1, kacItem('7C115', '1410', 'O', 'GMP', 'CJU', 'A321'))]

  const { flights } = await json(await search('GMP', 'CJU', VALID_DATE))

  assert.equal(flights[0].aircraft, 'A321')
  assert.equal(flights[0].aircraftCode, 'A321')
  assert.equal(flights[0].seatMapReady, false)
  assert.deepEqual(flights[0].seatMaps, [])
  assert.equal(flights[0].seatMapConfirmed, false)
})

test('짝이_없는_편명은_기종만_비우고_목록에_남는다', async () => {
  twoMolitFlights()
  fake.kacPages = [kacPage(1, kacItem('7C115', '1410', 'O', 'GMP', 'CJU', 'B738'))]

  const { flights } = await json(await search('GMP', 'CJU', VALID_DATE))

  assert.equal(flights[1].flightNumber, 'LJ569')
  assert.equal(flights[1].aircraft, '')
  assert.equal(flights[1].aircraftCode, '')
  assert.equal(flights[1].seatMapReady, false)
  assert.deepEqual(flights[1].seatMaps, [])
  assert.equal(flights[1].seatMapConfirmed, false)
})

test('같은_기종이어도_배치도가_없는_항공사는_준비_중이다', async () => {
  fake.molitBody = molitOne('없는항공', 'XX101')
  fake.kacPages = [kacPage(1, kacItem('XX101', '1410', 'O', 'GMP', 'CJU', 'B738'))]
  const { flights } = await json(await search('GMP', 'CJU', VALID_DATE))
  assert.equal(flights[0].aircraft, 'B737-800')
  assert.equal(flights[0].seatMapReady, false)
  assert.deepEqual(flights[0].seatMaps, [])
})
test('편명이_이상하거나_모르는_기종이어도_오류_없이_배치도_없음', async () => {
  fake.molitBody = molitJson(`[
    {"airlineNm":"제주항공","arrPlandTime":${D}1520,"depPlandTime":${D}1410,"vihicleId":"7"},
    {"airlineNm":"제주항공","arrPlandTime":${D}1545,"depPlandTime":${D}1435,"vihicleId":"7C117"}
  ]`)
  fake.kacPages = [kacPage(2,
    kacItem('7', '1410', 'O', 'GMP', 'CJU', 'B738'), kacItem('7C117', '1435', 'O', 'GMP', 'CJU', 'B789'))]
  const result = await search('GMP', 'CJU', VALID_DATE)
  assert.equal(result.status, 200)
  const { flights } = await json(result)
  assert.deepEqual(flights[0].seatMaps, [])
  assert.equal(flights[1].aircraft, 'B789') // 표에 없으면 코드 그대로
  assert.equal(flights[1].seatMapReady, false)
})
test('배치가_여럿인_기종은_후보를_전부_주고_확정하지_않는다', async () => {
  fake.molitBody = molitOne('대한항공', 'KE1203')
  fake.kacPages = [kacPage(1, kacItem('KE1203', '1410', 'O', 'GMP', 'CJU', 'A333'))]
  const { flights } = await json(await search('GMP', 'CJU', VALID_DATE))
  assert.deepEqual(flights[0].seatMaps, ['KE-A333-272', 'KE-A333-284', 'KE-A333-276', 'KE-A333-298', 'KE-A333-290'])
  assert.equal(flights[0].seatMapConfirmed, false)
  assert.equal(flights[0].aircraft, 'A330-300')
})
test('당일_편의_등록번호가_배치에_있으면_하나로_확정한다', async () => {
  fake.molitBody = molitOne('에어부산', 'BX8111')
  fake.kacPages = [kacPage(1, kacItem('BX8111', '1410', 'O', 'GMP', 'CJU', 'A321', 'HL8099'))]
  const { flights } = await json(await search('GMP', 'CJU', VALID_DATE))
  assert.deepEqual(flights[0].seatMaps, ['BX-A321-HL8099'])
  assert.equal(flights[0].seatMapConfirmed, true)

  fake.kacPages = [kacPage(1, kacItem('BX8111', '1410', 'O', 'GMP', 'CJU', 'A321'))] // 모르는 번호 HL0000
  const unknown = (await json(await search('GMP', 'CJU', VALID_DATE))).flights
  assert.ok(unknown[0].seatMaps.length > 1)
  assert.equal(unknown[0].seatMapConfirmed, false)
})
test('배치가_하나뿐인_기종은_확정이다', async () => {
  fake.molitBody = molitOne('티웨이항공', 'TW701')
  fake.kacPages = [kacPage(1, kacItem('TW701', '1410', 'O', 'GMP', 'CJU', 'B738'))]
  const { flights } = await json(await search('GMP', 'CJU', VALID_DATE))
  assert.deepEqual(flights[0].seatMaps, ['TW-B738-189'])
  assert.equal(flights[0].seatMapConfirmed, true)
})
test('빠진_배치가_있는_조합은_후보가_하나여도_확정하지_않는다', async () => {
  fake.molitBody = molitOne('파라타항공', 'WE501')
  fake.kacPages = [kacPage(1, kacItem('WE501', '1410', 'O', 'GMP', 'CJU', 'A320'))]
  const { flights } = await json(await search('GMP', 'CJU', VALID_DATE))
  assert.deepEqual(flights[0].seatMaps, ['WE-A320-174'])
  assert.equal(flights[0].seatMapConfirmed, false)
})
test('가장_가까운_기록의_등록번호도_함께_넘긴다', () => {
  const record = (std: string, aplRegNo: string): KacItem =>
    ({ airFln: 'BX8111', std, io: 'O', airport: 'GMP', city: 'CJU', icaoApmCd: 'A321', aplRegNo })
  const morning = record('202611100745', 'HL8099')
  const evening = record('202611101830', 'HL7729')
  assert.equal(nearestRecord([evening, morning], '08:00')?.aplRegNo, 'HL8099')
  assert.equal(nearestRecord(undefined, '08:00'), null)
})

test('편명이_같아도_다른_노선이나_도착_기록의_기종은_쓰지_않는다', async () => {
  twoMolitFlights()
  fake.kacPages = [kacPage(2,
    kacItem('7C115', '1410', 'I', 'GMP', 'CJU', 'B738'), // 김포 도착 기록
    kacItem('LJ569', '1435', 'O', 'GMP', 'PUS', 'B738'))] // 김포→부산

  const { flights } = await json(await search('GMP', 'CJU', VALID_DATE))

  assert.equal(flights[0].aircraftCode, '')
  assert.equal(flights[1].aircraftCode, '')
})

test('공항공사_시각이_국토부와_달라도_같은_편명이면_합친다', async () => {
  twoMolitFlights()
  fake.kacPages = [kacPage(1, kacItem('7C115', '1345', 'O', 'GMP', 'CJU', 'B738'))]

  assert.equal((await json(await search('GMP', 'CJU', VALID_DATE))).flights[0].aircraftCode, 'B738')
})

test('같은_편명이_하루_두_번이면_출발_시각이_가장_가까운_기록의_기종을_쓴다', async () => {
  fake.molitBody = molitJson(`[
    {"airlineNm":"대한항공","arrPlandTime":${D}0910,"depPlandTime":${D}0800,"vihicleId":"KE1505"},
    {"airlineNm":"대한항공","arrPlandTime":${D}2010,"depPlandTime":${D}1900,"vihicleId":"KE1505"}
  ]`)
  fake.kacPages = [kacPage(2,
    kacItem('KE1505', '1830', 'O', 'GMP', 'CJU', 'A321'), // 저녁 편 (30분 차이)
    kacItem('KE1505', '0745', 'O', 'GMP', 'CJU', 'B738'))] // 아침 편 (15분 차이)

  const { flights } = await json(await search('GMP', 'CJU', VALID_DATE))

  assert.equal(flights[0].aircraftCode, 'B738')
  assert.equal(flights[1].aircraftCode, 'A321')
})

test('공항공사_기록이_여러_쪽이면_끝까지_읽고_더_묻지_않는다', async () => {
  twoMolitFlights()
  fake.kacPages = [
    kacPage(101, kacItem('7C115', '1410', 'O', 'GMP', 'CJU', 'B738')),
    kacPage(101, kacItem('LJ569', '1435', 'O', 'GMP', 'CJU', 'A321'))]

  const { flights } = await json(await search('GMP', 'CJU', VALID_DATE))

  assert.equal(flights[0].aircraftCode, 'B738')
  assert.equal(flights[1].aircraftCode, 'A321')
  assert.equal(fake.kacCalls, 2)
})

test('공항공사에는_출발_공항과_그날_하루를_묻는다', async () => {
  twoMolitFlights()

  await search('GMP', 'CJU', VALID_DATE)

  for (const part of ['schAirCode=GMP', `schStTime=${VALID_DATE_MOLIT}0000`, `schEdTime=${VALID_DATE_MOLIT}2359`,
    'numOfRows=100']) // 공항공사는 100을 넘으면 오류를 돌려준다
    assert.ok(fake.kacLastQuery.includes(part), part)
})

test('항공편이_없으면_공항공사에_묻지_않는다', async () => {
  await search('GMP', 'CJU', VALID_DATE)

  assert.equal(fake.kacCalls, 0)
})

// ── 공항공사만 답이 없어도 오류로 끝내지 않는다 ──

test('공항공사가_오류를_돌려주면_시각은_보여주고_기종만_비운다', async () => {
  twoMolitFlights()
  fake.kacPages = [kacPage(1, kacItem('7C115', '1410', 'O', 'GMP', 'CJU', 'B738'))]
  fake.kacFailFromPage = 1

  const result = await search('GMP', 'CJU', VALID_DATE)

  assert.equal(result.status, 200)
  const { flights } = await json(result)
  assert.equal(flights.length, 2)
  assert.equal(flights[0].aircraftCode, '')
})

test('공항공사가_제한_시간_안에_답하지_않으면_시각은_보여주고_기종만_비운다', async () => {
  twoMolitFlights()
  fake.kacPages = [kacPage(1, kacItem('7C115', '1410', 'O', 'GMP', 'CJU', 'B738'))]
  fake.kacDelayMs = 1500

  const result = await search('GMP', 'CJU', VALID_DATE)

  assert.equal(result.status, 200)
  const { flights } = await json(result)
  assert.equal(flights[0].flightNumber, '7C115')
  assert.equal(flights[0].aircraftCode, '')
  assert.equal(fake.kacCalls, 1) // 한 번 시간을 넘기면 다음 쪽을 더 기다리지 않는다
})

test('중간_쪽에서_실패해도_앞서_받은_기종은_쓴다', async () => {
  twoMolitFlights()
  fake.kacPages = [
    kacPage(101, kacItem('7C115', '1410', 'O', 'GMP', 'CJU', 'B738')),
    kacPage(101, kacItem('LJ569', '1435', 'O', 'GMP', 'CJU', 'A321'))]
  fake.kacFailFromPage = 2

  const result = await search('GMP', 'CJU', VALID_DATE)

  assert.equal(result.status, 200)
  const { flights } = await json(result)
  assert.equal(flights[0].aircraftCode, 'B738')
  assert.equal(flights[1].aircraftCode, '')
})

test('나머지_쪽은_동시에_받아서_중간_쪽이_실패해도_뒤_쪽_기종은_쓴다', async () => {
  twoMolitFlights()
  fake.kacPages = [
    kacPage(201, kacItem('7C115', '1410', 'O', 'GMP', 'CJU', 'B738')),
    'JSON이 아닌 답', // 2쪽만 깨진다
    kacPage(201, kacItem('LJ569', '1435', 'O', 'GMP', 'CJU', 'A321'))]

  const { flights } = await json(await search('GMP', 'CJU', VALID_DATE))

  assert.equal(flights[0].aircraftCode, 'B738')
  assert.equal(flights[1].aircraftCode, 'A321')
  assert.equal(fake.kacCalls, 3)
})

test('전체_개수가_터무니없이_커도_10쪽까지만_묻는다', async () => {
  twoMolitFlights()
  fake.kacPages = [kacPage(1_000_000, kacItem('7C115', '1410', 'O', 'GMP', 'CJU', 'B738'))]

  const { flights } = await json(await search('GMP', 'CJU', VALID_DATE))

  assert.equal(flights[0].aircraftCode, 'B738')
  assert.equal(fake.kacCalls, 10)
})

test('공항공사가_실패해도_인증키는_응답과_기록_어디에도_나가지_않는다', async () => {
  twoMolitFlights()
  fake.kacFailFromPage = 1

  const result = await search('GMP', 'CJU', VALID_DATE)
  assert.equal(result.status, 200)
  assert.ok(!(await result.text()).includes('kac-test-key'))
  assert.ok(logs.length > 0 && !logs.includes('kac-test-key'), logs)
})

test('공항공사가_HTTP_200으로_오류를_주면_기록에_오류_이름을_남긴다', async () => {
  twoMolitFlights()
  fake.kacPages = ['{"OpenAPI_ServiceResponse":{"cmmMsgHeader":{"errMsg":"LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR","returnReasonCode":"22"}}}']

  const result = await search('GMP', 'CJU', VALID_DATE)

  assert.equal(result.status, 200)
  const { flights } = await json(result)
  assert.equal(flights.length, 2)
  assert.equal(flights[0].aircraftCode, '')
  assert.ok(logs.includes('LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR') && !logs.includes('kac-test-key'), logs)
})

// ── 오늘 검색이면 이미 떠난 편은 뺀다 ──

const TODAY_2PM = fromKst('2026-11-09', '14:00')
const flight = (airline: string, flightNumber: string, departureTime: string, arrivalTime: string): Flight =>
  ({ airline, flightNumber, departureTime, arrivalTime, duration: '1시간 10분', aircraft: '', aircraftCode: '', seatMapReady: false, seatMaps: [], seatMapConfirmed: false })
const ONE_PM_AND_THREE_PM = [flight('제주항공', '7C101', '13:00', '14:10'), flight('진에어', 'LJ303', '15:00', '16:10')]

test('오늘_14시면_13시_편은_빠지고_15시_편은_남는다', () => {
  assert.deepEqual(notDeparted(ONE_PM_AND_THREE_PM, '2026-11-09', TODAY_2PM).map(f => f.flightNumber), ['LJ303'])
})

test('내일_날짜면_아무것도_빼지_않는다', () => {
  assert.equal(notDeparted(ONE_PM_AND_THREE_PM, '2026-11-10', TODAY_2PM).length, 2)
})

test('오늘_편이_전부_떠났으면_빈_목록', () => {
  assert.deepEqual(notDeparted(ONE_PM_AND_THREE_PM, '2026-11-09', fromKst('2026-11-09', '23:00')), [])
})

// ── JavaScript로 옮기면서 새로 생기는 문제 ──

// 공항 표를 일반 객체로 찾으면 constructor · __proto__ 같은 이름이 "있는 공항"으로 나온다
test('객체_기본_속성_이름은_공항이_아니다 (JS)', async () => {
  for (const q of ['from=constructor&to=CJU', 'from=GMP&to=__proto__', 'from=toString&to=valueOf'])
    assert.equal((await get(`/api/flights?${q}&date=${VALID_DATE}`)).status, 400, q)
  assert.equal(fake.molitCalls, 0)
})

// Java 서버(Spring)는 같은 이름이 두 번 오면 "GMP,CJU"로 읽어 400이었다
test('같은_칸이_두_번_오면_400 (JS)', async () => {
  await assertInvalid(await get(`/api/flights?from=GMP&from=PUS&to=CJU&date=${VALID_DATE}`))
})

// Worker의 시계는 UTC다. 한국 00:00~08:59에는 UTC 날짜가 어제다
test('한국_자정_직후에도_오늘은_한국_날짜다 (JS)', () => {
  const now = Date.UTC(2026, 10, 14, 15, 30) // 한국 11-15 00:30
  assert.equal(validDay('GMP', 'CJU', '2026-11-15', now), '2026-11-15')
  assert.equal(validDay('GMP', 'CJU', '2026-11-14', now), null)
  assert.equal(validDay('GMP', 'CJU', '2027-11-15', now), '2027-11-15') // 딱 1년 뒤까지
  assert.equal(validDay('GMP', 'CJU', '2027-11-16', now), null)
  const two = [flight('제주항공', '7C101', '00:20', '01:30'), flight('진에어', 'LJ303', '00:40', '01:50')]
  assert.deepEqual(notDeparted(two, '2026-11-15', now).map(f => f.departureTime), ['00:40'])
  assert.deepEqual(notDeparted(two, '2026-11-15', fromKst('2026-11-15', '00:40')).map(f => f.departureTime), []) // 지금 떠나는 편도 뺀다
})

// 공공데이터는 글자 자리에 숫자를 보내기도 한다 (Java는 알아서 글자로 바꿨다)
test('숫자로_온_칸도_읽는다 (JS)', async () => {
  twoMolitFlights() // 국토부 depPlandTime · arrPlandTime은 원래 숫자로 온다
  fake.kacPages = [kacPage(1, kacItem('7C115', '1410', 'O', 'GMP', 'CJU', 'B738').replace(`"std":"${D}1410"`, `"std":${D}1410`))]

  const { flights } = await json(await search('GMP', 'CJU', VALID_DATE))

  assert.equal(flights[0].departureTime, '14:10')
  assert.equal(flights[0].aircraftCode, 'B738')
})

test('연결이_안_될_때도_로그에_인증키가_없다 (JS)', async () => {
  const fakeUrls = { molitBaseUrl: config.molitBaseUrl, kacBaseUrl: config.kacBaseUrl }
  try {
    twoMolitFlights()
    config.kacBaseUrl = 'http://127.0.0.1:1/kac' // 닫힌 포트
    const result = await search('GMP', 'CJU', VALID_DATE)
    assert.equal(result.status, 200)
    assert.equal((await json(result)).flights[0].aircraftCode, '')

    config.molitBaseUrl = 'http://127.0.0.1:1'
    await assertUpstream(await search('GMP', 'CJU', VALID_DATE))

    assert.ok(logs.includes('공항공사') && logs.includes('국토부'), logs)
    for (const secret of ['test-key', 'kac-test-key', 'serviceKey']) assert.ok(!logs.includes(secret), logs)
  } finally {
    Object.assign(config, fakeUrls)
  }
})

// 공공데이터가 오류 답에 요청 주소(인증키 포함)를 되돌려 보내는 경우. 로그에 앞 200자만 남기는데, 자른 뒤에 가리면 잘린 키 조각이 남는다
test('공공데이터가_요청_주소를_되돌려_보내도_로그에_인증키_조각이_없다 (JS)', async () => {
  fake.molitStatus = 403
  fake.molitBody = 'x'.repeat(185) + 'serviceKey=test-key%2B%2F%3D&depAirportId=NAARKSS' // 키가 200번째 글자에 걸친다
  await assertUpstream(await search('GMP', 'CJU', VALID_DATE))
  fake.molitStatus = 200 // 200인데 JSON이 아닌 답
  await assertUpstream(await search('GMP', 'CJU', VALID_DATE))
  assert.ok(logs.includes('국토부 HTTP 403') && logs.includes('읽을 수 없어요'), logs)
  assert.ok(!logs.includes('serviceKey=t'), logs)

  // JSON이 아닌 답을 읽다 난 오류 문구에는 답의 앞머리가 들어 있다 (키에서 한 글자 빠진 조각은 가릴 수 없다)
  twoMolitFlights()
  fake.kacPages = ['ac-test-key&type=json&numOfRows=100']
  logs = ''
  assert.equal((await search('GMP', 'CJU', VALID_DATE)).status, 200)
  assert.ok(logs.includes('공공데이터' ) || logs.includes('공항공사'), logs)
  assert.ok(!logs.includes('ac-test'), logs)
})

// Java 서버는 totalCount가 없으면 0으로 읽어 첫 쪽에서 멈췄다. 계속 물으면 공항공사 호출 한도를 쓴다
test('공항공사_답에_전체_개수가_없으면_첫_쪽만_받는다 (JS)', async () => {
  twoMolitFlights()
  fake.kacPages = [kacPage(1, kacItem('7C115', '1410', 'O', 'GMP', 'CJU', 'B738')).replace('"totalCount":1,', '')]

  const { flights } = await json(await search('GMP', 'CJU', VALID_DATE))

  assert.equal(flights[0].aircraftCode, 'B738')
  assert.equal(fake.kacCalls, 1)
})
