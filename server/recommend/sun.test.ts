/**
 * 햇빛 계산 확인. 기대값은 NOAA 태양 위치 공식으로 미리 계산해 그날 일출 · 일몰 시각으로 검산한 고정값이다
 * (https://gml.noaa.gov/grad/solcalc/ 과 대조).
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fromKst } from '../kst.ts'
import { bearing, position, type Sun, sunOf } from './sun.ts'

const DAY = '2026-11-13'
const kstSeconds = (hhmm: string) => fromKst(DAY, hhmm) / 1000
const close = (actual: number, expected: number, within: number) =>
  assert.ok(Math.abs(actual - expected) <= within, `${actual}이(가) ${expected} ± ${within} 밖이다`)

function assertSun(sun: Sun, left: number, right: number) {
  close(sun.left, left, 0.05)
  close(sun.right, right, 0.05)
}

test('태양_위치는_NOAA_값과_1도_안에서_같다', () => {
  const noon = position(kstSeconds('12:17'), 37.558, 126.791) // 김포
  close(noon[0], 34.5, 1.0) // 고도
  close(noon[1], 180.0, 1.0) // 방위
  const afternoon = position(kstSeconds('14:25'), 37.558, 126.791)
  close(afternoon[0], 26.8, 1.0)
  close(afternoon[1], 214.4, 1.0)
})

test('비행_방위각은_출발에서_도착을_보는_방향이다', () => {
  close(bearing(37.558, 126.791, 33.511, 126.493), 183.5, 0.5) // 김포→제주
  close(bearing(33.511, 126.493, 37.558, 126.791), 3.3, 0.5) // 제주→김포
})

test('오후에_남쪽으로_가면_해는_오른쪽이고_북쪽으로_가면_왼쪽이다', () => {
  assertSun(sunOf('GMP', 'CJU', DAY, '14:10', '15:20'), 0, 0.55)
  assertSun(sunOf('CJU', 'GMP', DAY, '14:10', '15:20'), 0.55, 0)
})

test('오전에_남쪽으로_가면_해는_왼쪽이다', () => {
  assertSun(sunOf('GMP', 'CJU', DAY, '09:00', '10:10'), 0.63, 0)
})

test('해_질_무렵에는_낮인_지점만_센다', () => {
  assertSun(sunOf('GMP', 'CJU', DAY, '17:00', '18:10'), 0, 0.30) // 첫 지점만 낮
})

test('밤에는_양쪽_다_0이다', () => {
  assertSun(sunOf('GMP', 'CJU', DAY, '20:00', '21:10'), 0, 0)
})

test('자정을_넘겨_도착해도_밤이다', () => {
  assertSun(sunOf('GMP', 'CJU', DAY, '23:30', '00:40'), 0, 0)
})
