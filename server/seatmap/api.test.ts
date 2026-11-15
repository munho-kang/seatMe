/**
 * 창구 GET /api/seatmaps 확인 (화면이 부르는 좌석 배치도 창구의 규칙은 이 주석이 기준이다).
 * - GET /api/seatmaps/{id}: 200, 배치도 하나를 그대로 돌려준다.
 *   {id, airline, aircraft, name, seatCount, source, checkedOn, cabins[{class, fromRow, toRow, seats}], seats[...], facilities[...]}.
 *   좌석 하나는 {seat, row, column, cabin, side, position, hasWindow, overWing, exitRow, zone, nearLavatory, noRecline, extraLegroom}.
 *   항공사가 공개하지 않은 특징("모름")은 null로 나가고, 칸 이름(키)은 그대로 남는다.
 *   값 범위: hasWindow · overWing · noRecline · nearLavatory는 true / false / null(모름, false처럼 그리면 안 된다).
 *   exitRow · extraLegroom은 좌석 하나 단위의 true / false. side는 left · right · center, position은 window · middle · aisle,
 *   cabin은 first · business · premium · economy, zone은 front · middle · rear.
 *   배치도의 aircraft는 파일의 첫 기종 코드 이름이라, 두 기종 공용 배치(LJ-B738-189, ZE-B738-189)는 항공편의 aircraft를 화면에 쓴다.
 * - 없는 id · 소문자 id · 아주 긴 id → 404 {"error": "SEAT_MAP_NOT_FOUND"} (500이 아니다).
 * - GET /api/seatmaps: 200 {"seatMaps": [{id, airline, aircraft, name, seatCount}]} — 요약만, 항공사 → 순서 → id 차례.
 * - /seatmaps.html: 확인용 미리보기 화면. 위 두 창구로 어떤 배치도든 그려서 항공사 공식 그림과 눈으로 비교한다 (#<id>로 바로 열림).
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { test } from 'node:test'
import { handle } from '../index.ts'
import { seatMapFiles } from '../seatmaps/index.ts'

const get = (path: string) => handle(new Request('http://x' + path), {})
// 응답 몸통. 테스트에서는 모양을 따지지 않고 꺼내 본다
// oxlint-disable-next-line typescript/no-explicit-any
const json = (res: Response): Promise<any> => res.json()
const SEAT_KEYS = ['seat', 'row', 'column', 'cabin', 'side', 'position', 'hasWindow', 'overWing',
  'exitRow', 'zone', 'nearLavatory', 'noRecline', 'extraLegroom']

test('배치도_하나를_돌려준다', async () => {
  const result = await get('/api/seatmaps/7C-B738-189')
  assert.equal(result.status, 200)
  const body = await json(result)
  assert.deepEqual(Object.keys(body), ['id', 'airline', 'aircraft', 'name', 'seatCount', 'source', 'checkedOn', 'cabins', 'seats', 'facilities'])
  assert.equal(body.airline, '7C')
  assert.equal(body.aircraft, 'B737-800')
  assert.equal(body.seatCount, 189)
  assert.equal(body.seats.length, 189)
  assert.deepEqual(Object.keys(body.seats[0]), SEAT_KEYS) // 모름(null)이어도 칸은 나간다
  assert.deepEqual(Object.keys(body.cabins[0]), ['class', 'fromRow', 'toRow', 'seats'])
})

// 미리보기 화면은 서버 코드가 아니라 Cloudflare가 화면 파일(public/ → dist/)로 내보낸다
test('미리보기_화면이_열린다', () => {
  assert.ok(fs.readFileSync(new URL('../../public/seatmaps.html', import.meta.url), 'utf8').includes('/api/seatmaps'))
})

test('없는_id면_404', async () => {
  for (const id of ['NOPE', '7c-b738-189', 'X'.repeat(300)]) {
    const result = await get('/api/seatmaps/' + id)
    assert.equal(result.status, 404, id)
    assert.equal((await json(result)).error, 'SEAT_MAP_NOT_FOUND')
  }
})

test('목록은_요약만_돌려준다', async () => {
  const result = await get('/api/seatmaps')
  assert.equal(result.status, 200)
  const body = await json(result)
  const ids = body.seatMaps.map((m: { id: string }) => m.id)
  assert.ok(ids.includes('7C-B738-189') && ids.includes('7C-B38M-174'))
  assert.deepEqual(Object.keys(body.seatMaps[0]), ['id', 'airline', 'aircraft', 'name', 'seatCount'])
})

// 일반 객체로 찾으면 __proto__ · constructor 같은 이름이 "있는 배치도"로 나온다
test('객체_기본_속성_이름은_없는_배치도다 (JS)', async () => {
  for (const id of ['__proto__', 'constructor', 'toString', 'hasOwnProperty', '%E0%A4%A']) {
    const result = await get('/api/seatmaps/' + id)
    assert.equal(result.status, 404, id)
    assert.deepEqual(await result.json(), { error: 'SEAT_MAP_NOT_FOUND' })
  }
})

// undefined는 JSON에서 칸이 통째로 사라진다. 모름은 null로 나가야 화면이 "모름"을 그린다
test('모름_칸은_null로_나가고_빠지지_않는다 (JS)', async () => {
  for (const { id } of seatMapFiles) {
    const map = await json(await get('/api/seatmaps/' + id))
    for (const seat of map.seats) assert.deepEqual(Object.keys(seat), SEAT_KEYS, `${id} ${seat.seat}`)
  }
})
