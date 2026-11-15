import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SeatMapRepository } from './repository.ts'
import type { SeatMapFile } from './seatMap.ts'

/** 1열 "ABC DEF" 객실 하나에 나머지는 빈 목록 · null인 배치도 파일. */
function file(id: string, airline: string, codes: string[], order: number, ...registrations: string[]): SeatMapFile {
  return {
    id, airline, aircraftCodes: codes, name: id, order, officialSeats: null, registrations,
    source: 'https://example.com', checkedOn: '2026-11-10',
    cabins: [{ class: 'economy', fromRow: 1, toRow: 1, seats: 'ABC DEF', missing: null }],
    exitRows: [], extraLegroom: [], overWing: null, noWindow: null, noRecline: null, facilities: [],
  }
}

const REPO = new SeatMapRepository([
  file('KE-A333-276', 'KE', ['A333'], 3),
  file('KE-A333-272', 'KE', ['A333'], 1),
  file('KE-A333-284', 'KE', ['A333'], 2),
  file('TW-B738-189', 'TW', ['B738'], 1),
  file('LJ-B738-189', 'LJ', ['B738', 'B38M'], 1),
  file('BX-A321-HL7729', 'BX', ['A321'], 1, 'HL7729'),
  file('BX-A321-HL8256', 'BX', ['A321'], 2, 'HL8256', 'HL8257'),
])

test('후보는_대표가_맨_앞이고_여럿이면_확정이_아니다', () => {
  assert.deepEqual(REPO.candidatesFor('KE', 'A333', null),
    { ids: ['KE-A333-272', 'KE-A333-284', 'KE-A333-276'], confirmed: false })
})
test('후보가_하나면_확정이다', () => {
  assert.deepEqual(REPO.candidatesFor('TW', 'B738', ''), { ids: ['TW-B738-189'], confirmed: true })
})
test('기종_코드를_여럿_적은_배치는_코드마다_후보다', () => {
  assert.deepEqual(REPO.candidatesFor('LJ', 'B738', null).ids, ['LJ-B738-189'])
  assert.deepEqual(REPO.candidatesFor('LJ', 'B38M', null).ids, ['LJ-B738-189'])
})
test('등록번호가_맞으면_그_배치_하나로_확정한다', () => {
  assert.deepEqual(REPO.candidatesFor('BX', 'A321', 'HL8257'), { ids: ['BX-A321-HL8256'], confirmed: true })
  assert.deepEqual(REPO.candidatesFor('BX', 'A321', ' hl8257 '), { ids: ['BX-A321-HL8256'], confirmed: true })
})
test('등록번호가_빈칸이거나_모르는_번호면_후보_전부', () => {
  for (const reg of [null, '', '  ', 'HL0000'])
    assert.deepEqual(REPO.candidatesFor('BX', 'A321', reg), { ids: ['BX-A321-HL7729', 'BX-A321-HL8256'], confirmed: false })
})
test('다른_항공사의_등록번호로는_확정하지_않는다', () => {
  assert.equal(REPO.candidatesFor('KE', 'A333', 'HL7729').confirmed, false)
})
test('모르면_빈_목록이다', () => {
  const none = { ids: [], confirmed: false }
  assert.deepEqual(REPO.candidatesFor('7C', 'B738', null), none) // 파일 없는 항공사
  assert.deepEqual(REPO.candidatesFor('TW', 'A321', null), none) // 파일 없는 기종
  assert.deepEqual(REPO.candidatesFor('TW', null, null), none)
  assert.deepEqual(REPO.candidatesFor('TW', '', null), none)
  assert.deepEqual(REPO.candidatesFor(null, 'B738', null), none)
  assert.deepEqual(REPO.candidatesFor('  ', 'B738', null), none)
})
test('id로_찾는다', () => {
  assert.equal(REPO.findById('TW-B738-189')?.seatCount, 6)
  assert.equal(REPO.findById('tw-b738-189'), undefined)
  assert.equal(REPO.findById(null), undefined)
  assert.deepEqual(REPO.all().map(m => m.id).slice(0, 3), ['BX-A321-HL7729', 'BX-A321-HL8256', 'KE-A333-272'])
})
test('겹치는_파일이_있으면_멈춘다', () => {
  assert.throws(() => new SeatMapRepository([
    file('TW-B738-189', 'TW', ['B738'], 1), file('TW-B738-189', 'TW', ['B738'], 2)])) // 같은 id
  assert.throws(() => new SeatMapRepository([
    file('KE-A333-272', 'KE', ['A333'], 1), file('KE-A333-284', 'KE', ['A333'], 1)])) // order 겹침
  assert.throws(() => new SeatMapRepository([
    file('BX-A321-HL7729', 'BX', ['A321'], 1, 'HL7729'), file('BX-A321-HL7730', 'BX', ['A321'], 2, 'HL7729')])) // 등록번호 겹침
})
test('기종_코드_하나라도_order가_겹치면_멈춘다', () => {
  assert.throws(() => new SeatMapRepository([
    file('LJ-B738-189', 'LJ', ['B738', 'B38M'], 1), file('LJ-B38M-180', 'LJ', ['B38M'], 1)]))
})
test('펼치기에_실패하면_파일_id를_담아_멈춘다', () => {
  const bad = file('XX-A320-1', 'XX', [], 1) // aircraftCodes가 비어 있다
  assert.throws(() => new SeatMapRepository([bad]),
    (e: Error) => e.message.includes('XX-A320-1') && e.cause instanceof Error)
})
test('파일이_하나도_없어도_시작한다', () => {
  const empty = new SeatMapRepository([]) // 실제 seatmaps 폴더에는 이제 파일이 있다
  assert.deepEqual(empty.all(), [])
  assert.deepEqual(empty.candidatesFor('KE', 'A333', null), { ids: [], confirmed: false })
})
