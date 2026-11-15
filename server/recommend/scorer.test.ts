/**
 * 좌석 점수 규칙 확인. 시험용 비행기 두 대로 본다.
 * PLANE: 비즈니스 1~2열 + 일반석 7~36열(통로 하나). 줄 순서로는 7열이 3번째, 20열(날개 가운데)이 16번째, 36열이 32번째(마지막).
 * UNKNOWN: 항공사가 날개 · 창문 · 화장실 위치를 알려 주지 않은 통로 둘짜리.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { expand, type Seat, type SeatMap } from '../seatmap/seatMap.ts'
import { FEATURE_MIN, type Preferences, rank, type Scored } from './scorer.ts'

const PLANE = `
  { "id": "XX-B738-186", "airline": "XX", "aircraftCodes": ["B738"], "name": "시험용", "order": 1,
    "officialSeats": null, "registrations": [], "source": "https://example.com", "checkedOn": "2026-11-11",
    "cabins": [
      { "class": "business", "fromRow": 1, "toRow": 2, "seats": "AC DF" },
      { "class": "economy", "fromRow": 7, "toRow": 36, "seats": "ABC DEF" } ],
    "exitRows": ["20"], "extraLegroom": null,
    "overWing": { "fromRow": 17, "toRow": 23 },
    "noWindow": ["15A"], "noRecline": null,
    "facilities": [
      { "type": "lavatory", "afterRow": 0, "side": "left" },
      { "type": "lavatory", "afterRow": 36, "side": "both" } ] }`
const UNKNOWN = `
  { "id": "XX-A333-40", "airline": "XX", "aircraftCodes": ["A333"], "name": "시험용 모름", "order": 1,
    "officialSeats": null, "registrations": [], "source": "https://example.com", "checkedOn": "2026-11-11",
    "cabins": [ { "class": "economy", "fromRow": 1, "toRow": 5, "seats": "AB CDEF GH" } ],
    "exitRows": [], "extraLegroom": null, "overWing": null, "noWindow": null, "noRecline": null, "facilities": [] }`

const NO_SUN = { left: 0, right: 0 }
const prefs = (sunlight: number, view: number, quietness: number, turbulence: number, quickExit: number, seatPosition: string): Preferences =>
  ({ sunlight, view, quietness, turbulence, quickExit, seatPosition })
const DONT_CARE = prefs(1, 1, 1, 1, 1, 'any')

const plane = (json: string): SeatMap => expand(JSON.parse(json))
function find(all: Scored[], seat: string): Scored {
  const found = all.find(s => s.seat === seat)
  assert.ok(found, `좌석 ${seat}가 없다`)
  return found
}
const score = (all: Scored[], seat: string, item: string) => find(all, seat).scores[item]
const total = (all: Scored[], seat: string) => find(all, seat).score
function seatOf(map: SeatMap, id: string): Seat {
  const found = map.seats.find(s => s.seat === id)
  assert.ok(found, `좌석 ${id}가 없다`)
  return found
}
const top3 = (map: SeatMap, sun: { left: number; right: number }, p: Preferences) => rank(map, sun, p).slice(0, 3)
const close = (actual: number, expected: number, within: number) =>
  assert.ok(Math.abs(actual - expected) <= within, `${actual}이(가) ${expected} ± ${within} 밖이다`)

test('햇빛이_중요하면_해가_드는_쪽_창가를_피한다', () => {
  const sunlight = prefs(5, 1, 1, 1, 1, 'any')
  const map = plane(PLANE)

  const right = top3(map, { left: 0, right: 0.6 }, sunlight)
  assert.ok(right.every(s => seatOf(map, s.seat).side !== 'right'))

  const left = top3(map, { left: 0.6, right: 0 }, sunlight)
  assert.notEqual(seatOf(map, left[0].seat).side, seatOf(map, right[0].seat).side)
})

test('전부_신경_안_쓰면_모든_좌석이_100점이고_순서는_늘_같다', () => {
  const first = rank(plane(PLANE), { left: 0.3, right: 0 }, DONT_CARE)

  assert.ok(first.every(s => s.score === 100 && s.features.length === 0 && s.tradeoff === null))
  // 동점이면 앞 열 먼저, 같은 열이면 글자 순
  assert.deepEqual(first.slice(0, 3).map(s => s.seat), ['7A', '7B', '7C'])
  assert.deepEqual(first.slice(0, 3).map(s => s.rank), [1, 2, 3])
  assert.deepEqual(rank(plane(PLANE), { left: 0.3, right: 0 }, DONT_CARE), first)
})

test('일반석만_추천한다', () => {
  const map = plane(PLANE)
  const all = rank(map, NO_SUN, prefs(1, 1, 1, 1, 5, 'any'))

  assert.equal(all.length, 180)
  assert.ok(all.every(s => seatOf(map, s.seat).cabin === 'economy'))
})

test('등받이가_고정된_좌석은_추천하지_않는다', () => {
  // 빠른 하차만 보면 맨 앞 7열이 1위인데, 7열 등받이가 고정이면 8열부터 추천한다
  const map = plane(PLANE.replace('"noRecline": null', '"noRecline": ["7"]'))
  const all = rank(map, NO_SUN, prefs(1, 1, 1, 1, 5, 'any'))

  assert.equal(all.length, 174)
  assert.ok(all.every(s => seatOf(map, s.seat).noRecline === false))
  assert.equal(all[0].seat, '8A')
})

test('빠른_하차는_열_번호가_아니라_앞에서_몇_번째_줄인지로_잰다', () => {
  const all = rank(plane(PLANE), NO_SUN, prefs(1, 1, 1, 1, 5, 'any'))

  // 7열은 비즈니스 두 줄 뒤 3번째 줄: 1 − 2/31. 열 번호로 재면 1 − 6/35 = 0.83이 된다
  close(score(all, '7A', 'quickExit'), 0.94, 0.005)
  assert.ok(score(all, '36A', 'quickExit') === 0)
  assert.equal(all[0].score, 94)
})

test('햇빛_점수는_해가_드는_쪽_창가에서_가장_낮다', () => {
  const all = rank(plane(PLANE), { left: 0, right: 0.5 }, DONT_CARE)

  close(score(all, '7F', 'sunlight'), 0.5, 0.005) // 창가 1.0
  close(score(all, '7E', 'sunlight'), 0.7, 0.005) // 가운데 0.6
  close(score(all, '7D', 'sunlight'), 0.85, 0.005) // 통로 0.3
  assert.equal(score(all, '7A', 'sunlight'), 1.0) // 반대쪽
})

test('전망_점수는_창문과_날개를_본다', () => {
  const all = rank(plane(PLANE), NO_SUN, DONT_CARE)

  assert.equal(score(all, '7A', 'view'), 1.0) // 창문 있는 창가, 날개 밖
  assert.equal(score(all, '17A', 'view'), 0.6) // 날개 위
  assert.equal(score(all, '15A', 'view'), 0.2) // 창문 없는 창가
  assert.equal(score(all, '7B', 'view'), 0.2) // 가운데
  assert.ok(score(all, '7C', 'view') === 0) // 통로
})

test('조용함_점수는_구역에서_화장실_근처와_비상구_좌석을_깎는다', () => {
  const all = rank(plane(PLANE), NO_SUN, DONT_CARE)

  assert.equal(score(all, '7A', 'quietness'), 1.0) // 앞 구역
  assert.equal(score(all, '19A', 'quietness'), 0.7) // 가운데 구역
  close(score(all, '20A', 'quietness'), 0.6, 0.005) // 가운데 구역 비상구 좌석
  assert.equal(score(all, '30A', 'quietness'), 0.4) // 뒤 구역
  close(score(all, '36A', 'quietness'), 0.1, 0.005) // 뒤 구역 화장실 근처
})

test('흔들림_점수는_날개_가운데_줄에서_가장_높다', () => {
  const all = rank(plane(PLANE), NO_SUN, DONT_CARE)

  assert.equal(score(all, '20A', 'turbulence'), 1.0) // 날개 17~23열의 가운데
  assert.ok(score(all, '36A', 'turbulence') === 0) // 가장 먼 줄
  close(score(all, '7A', 'turbulence'), 0.19, 0.005) // 13줄 ÷ 16줄 떨어짐
})

test('자리_위치는_원하는_쪽이_1점이고_항상이면_더_무겁다', () => {
  const window = rank(plane(PLANE), NO_SUN, prefs(1, 1, 1, 1, 1, 'always-window'))
  assert.equal(score(window, '7A', 'position'), 1.0)
  assert.equal(score(window, '7B', 'position'), 0.3)
  assert.ok(score(window, '7C', 'position') === 0)
  assert.deepEqual(window.slice(0, 3).map(s => s.seat), ['7A', '7F', '8A'])

  // 빠른 하차 2(가중치 1)와 함께면: 통로 선호(2)보다 항상 통로(4)일 때 가운데 좌석 점수가 더 깎인다
  const prefer = rank(plane(PLANE), NO_SUN, prefs(1, 1, 1, 1, 2, 'prefer-aisle'))
  const always = rank(plane(PLANE), NO_SUN, prefs(1, 1, 1, 1, 2, 'always-aisle'))
  assert.equal(prefer[0].seat, '7C')
  assert.ok(total(always, '7B') < total(prefer, '7B'))
})

test('잘_맞는_항목과_아쉬운_항목을_가중치_순으로_고른다', () => {
  const profile = prefs(5, 3, 4, 4, 2, 'prefer-window')
  const seat = find(rank(plane(PLANE), { left: 0, right: 0.55 }, profile), '7A')

  // 가중치 × 점수: 햇빛 4.0 · 조용함 3.0 · 전망 2.0 · 자리 2.0 · 빠른 하차 0.94 (5번째라 빠짐) · 흔들림은 0.7 미만
  assert.deepEqual(seat.features, ['sunlight', 'quietness', 'view', 'position'])
  assert.equal(seat.tradeoff, 'turbulence')
  assert.equal(seat.score, 83) // (4 + 2 + 3 + 3×0.19 + 0.94 + 2) ÷ 15
})

test('잘_맞는_항목이_동시에_아쉬운_항목이_되지는_않는다', () => {
  const profile = prefs(5, 3, 4, 4, 2, 'prefer-window')
  const all = rank(plane(PLANE), { left: 0, right: 0.55 }, profile)

  // 16A에서 가장 많이 깎인 항목은 조용함(가중치 3 × 0.3)이지만 0.7은 "잘 맞는" 점수다.
  // 그래서 아쉬운 항목은 0.7이 안 되는 것 중에서 고른다 — 빠른 하차 0.65
  const seat = find(all, '16A')
  assert.ok(seat.features.includes('quietness'))
  assert.equal(seat.tradeoff, 'quickExit')
  assert.ok(all.every(s => s.tradeoff === null || s.scores[s.tradeoff] < FEATURE_MIN))
})

test('모르는_정보는_가운데_점수를_주고_날개를_모르면_날개_자리를_어림한다', () => {
  const all = rank(plane(UNKNOWN), NO_SUN, prefs(1, 1, 1, 5, 1, 'any'))

  assert.equal(score(all, '1A', 'view'), 0.5) // 창문도 날개도 모르는 창가
  close(score(all, '1A', 'quietness'), 0.85, 0.005) // 화장실 위치를 몰라 반만 깎음
  // 날개는 어느 비행기나 가운데보다 조금 앞에 있다: 다섯 줄 중 셋째 줄이 가장 덜 흔들린다고 본다
  assert.deepEqual(all.slice(0, 3).map(s => s.seat), ['3A', '3B', '3C'])
  assert.ok(score(all, '3A', 'turbulence') > score(all, '1A', 'turbulence'))
  assert.ok(score(all, '1A', 'turbulence') > score(all, '5A', 'turbulence'))
  // 흔들림만 중요해도 좌석마다 점수가 다르다 (흔들림을 계산에서 빼면 모든 좌석이 100점이 된다)
  assert.ok(total(all, '3A') > total(all, '1A'))
  // 어림한 값이라 "흔들림 적음"이라고 내세우지는 않는다
  assert.ok(all.every(s => s.features.length === 0 && s.tradeoff === null))
})

test('모르는_정보로_매긴_항목은_잘_맞는_점에도_아쉬운_점에도_넣지_않는다', () => {
  // 창문 · 날개를 모르는 창가 1A의 전망 0.5는 "나쁘다"가 아니라 "모른다"이다
  const view = rank(plane(UNKNOWN), NO_SUN, prefs(1, 5, 1, 1, 1, 'always-window'))
  assert.deepEqual(find(view, '1A').features, ['position'])
  assert.equal(find(view, '1A').tradeoff, null)
  assert.equal(find(view, '1D').tradeoff, 'view') // 가운데 좌석에 전망이 없는 것은 아는 사실이다
  // 어느 항목을 모르고 매겼는지 알려 준다 (화면이 "보통" 대신 "정보 없음"으로 보여 줄 수 있게)
  assert.deepEqual(find(view, '1A').unsure, ['view', 'quietness', 'turbulence'])
  assert.deepEqual(find(view, '1D').unsure, ['quietness', 'turbulence'])
  assert.ok(rank(plane(PLANE), NO_SUN, DONT_CARE).every(s => s.unsure.length === 0))

  // 화장실 위치를 모르는 배치의 조용함도 마찬가지
  const quiet = rank(plane(UNKNOWN), NO_SUN, prefs(1, 1, 5, 1, 1, 'any'))
  assert.deepEqual(find(quiet, '1A').features, [])
})

test('총점은_반올림_오차_없이_계산한다', () => {
  // 89.5가 계산 오차로 89.4999…가 되어 89점으로 내려가면 안 된다. 정수로만 다시 계산한 값과 비교한다
  const map = plane(PLANE)
  const levels = [1, 2, 3, 4, 5]
  for (const a of levels) for (const b of levels) for (const c of levels) for (const d of levels) {
    const p = prefs(a, b, c, d, 2, 'prefer-window')
    const weights = [a - 1, b - 1, c - 1, d - 1, 1, 2]
    const weightSum = a + b + c + d - 1
    for (const s of rank(map, { left: 0, right: 0.55 }, p)) {
      let sum = 0
      Object.values(s.scores).forEach((value, i) => { sum += weights[i] * Math.round(value * 100) })
      assert.equal(s.score, Math.floor((2 * sum + weightSum) / (2 * weightSum)), `${s.seat} ${JSON.stringify(p)}`)
    }
  }
})

test('가운데_묶음_좌석은_햇빛이_들지_않는다고_본다', () => {
  const all = rank(plane(UNKNOWN), { left: 0.4, right: 0.4 }, DONT_CARE)

  assert.equal(score(all, '1D', 'sunlight'), 1.0)
  close(score(all, '1A', 'sunlight'), 0.6, 0.005)
})
