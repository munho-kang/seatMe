// 배치도 파일(짧은 설명)이 좌석 목록으로 펼쳐지는 규칙과, 틀린 파일이 읽을 때 멈추는 것을 확인한다.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { aircraftName } from '../aircraft/names.ts'
import { expand, type Seat, type SeatMap, type SeatMapFile } from './seatMap.ts'

type Json = Record<string, unknown>

function map(file: Json): SeatMap {
  return expand(file as SeatMapFile)
}

function seat(m: SeatMap, id: string): Seat {
  const found = m.seats.find(s => s.seat === id)
  assert.ok(found, `좌석 ${id}가 없다`)
  return found
}

/** base의 맨 위 칸 하나만 바꾼 파일. */
function withKey(base: Json, key: string, rawJson: string): Json {
  return { ...base, [key]: JSON.parse(rawJson) }
}

const BASE: Json = JSON.parse(`
  { "id": "XX-B738-31", "airline": "XX", "aircraftCodes": ["B738"], "name": "시험용", "order": 1,
    "officialSeats": [31], "registrations": [], "source": "https://example.com", "checkedOn": "2026-11-10",
    "cabins": [
      { "class": "business", "fromRow": 1, "toRow": 1, "seats": "AC DF" },
      { "class": "economy", "fromRow": 7, "toRow": 8, "seats": "ABC DEF" },
      { "class": "economy", "fromRow": 28, "toRow": 30, "seats": "ABC DEF", "missing": ["30D", "30E", "30F"] } ],
    "exitRows": [28], "extraLegroom": ["7", "1A"],
    "overWing": { "fromRow": 8, "toRow": 28 },
    "noWindow": ["8A", "29"], "noRecline": ["8", "30A"],
    "facilities": [
      { "type": "lavatory", "afterRow": 0, "side": "left" },
      { "type": "exit", "afterRow": 8, "side": "both" },
      { "type": "galley", "afterRow": 30, "side": "both" } ] }`)
const WIDE: Json = JSON.parse(`
  { "id": "XX-A333-12", "airline": "XX", "aircraftCodes": ["A333"], "name": "시험용 통로 둘", "order": 1,
    "officialSeats": [12], "registrations": [], "source": "https://example.com", "checkedOn": "2026-11-10",
    "cabins": [
      { "class": "business", "fromRow": 1, "toRow": 1, "seats": "A DG K" },
      { "class": "economy", "fromRow": 2, "toRow": 2, "seats": "AB DEFG HJ" } ],
    "exitRows": [], "extraLegroom": [], "overWing": null, "noWindow": null, "noRecline": null, "facilities": [] }`)

const base = (key: string, rawJson: string) => withKey(BASE, key, rawJson)
const columnA = (m: SeatMap) => m.seats.filter(s => s.column === 'A')

test('좌석이_펼쳐진다', () => {
  const m = map(BASE)
  assert.equal(m.seatCount, 31)
  const ids = m.seats.map(s => s.seat)
  assert.deepEqual(ids.slice(0, 5), ['1A', '1C', '1D', '1F', '7A'])
  assert.deepEqual(ids.slice(-3), ['30A', '30B', '30C'])
  for (const no of ['1B', '30D', '9A']) assert.ok(!ids.includes(no), no)
  assert.equal(new Set(ids).size, ids.length)
  assert.equal(m.aircraft, 'B737-800')
  assert.deepEqual(m.cabins.map(c => c.class), ['business', 'economy', 'economy'])
  const s = seat(m, '7A')
  assert.deepEqual([s.row, s.column, s.cabin], [7, 'A', 'economy'])
  assert.equal(seat(m, '1A').cabin, 'business')
})

test('글자_묶음으로_좌우와_창가_통로를_정한다', () => {
  const m = map(BASE)
  assert.deepEqual(
    ['7A', '7B', '7C', '7D', '7E', '7F', '1A', '1C', '1D', '1F'].map(id => seat(m, id).side + '/' + seat(m, id).position),
    ['left/window', 'left/middle', 'left/aisle', 'right/aisle', 'right/middle', 'right/window',
      'left/window', 'left/aisle', 'right/aisle', 'right/window'])
})

test('통로가_둘이면_가운데_묶음은_center', () => {
  const m = map(WIDE)
  assert.deepEqual(
    ['1A', '1D', '1G', '1K', '2A', '2B', '2D', '2E', '2F', '2G', '2H', '2J'].map(id => seat(m, id).side + '/' + seat(m, id).position),
    ['left/window', 'center/aisle', 'center/aisle', 'right/window',
      'left/window', 'left/aisle', 'center/aisle', 'center/middle', 'center/middle', 'center/aisle',
      'right/aisle', 'right/window'])
})

test('열_번호가_건너뛰어도_위치_순서로_구역을_나눈다', () => {
  assert.deepEqual(columnA(map(BASE)).map(s => s.row + s.zone),
    ['1front', '7front', '8middle', '28middle', '29rear', '30rear'])
})

test('화장실과_갤리에서_두_열_이내만_가깝다', () => {
  assert.deepEqual(columnA(map(BASE)).map(s => s.row + ':' + s.nearLavatory),
    ['1:true', '7:true', '8:false', '28:false', '29:true', '30:true'])
  const mid = map(base('facilities', '[{ "type": "lavatory", "afterRow": 8, "side": "left" }]'))
  assert.deepEqual(columnA(mid).map(s => s.row + ':' + s.nearLavatory),
    ['1:false', '7:true', '8:true', '28:true', '29:true', '30:false'])
})

test('화장실과_갤리가_하나도_없는_배치는_화장실_근처가_모름이다', () => {
  assert.ok(map(base('facilities', '[]')).seats.every(s => s.nearLavatory === null))
  assert.ok(map(base('facilities', '[{ "type": "exit", "afterRow": 8, "side": "both" }]')).seats.every(s => s.nearLavatory === null))
  const one = map(base('facilities', '[{ "type": "lavatory", "afterRow": 8, "side": "left" }]'))
  assert.deepEqual(['7A', '30A'].map(id => seat(one, id).nearLavatory), [true, false])
})

test('빠진_좌석이_있어도_옆_좌석의_자리는_그대로다', () => {
  const file = withKey(WIDE, 'cabins',
    '[{ "class": "economy", "fromRow": 7, "toRow": 8, "seats": "ABC DEF", "missing": ["7A", "7C", "7F"] }]')
  const m = map(file)
  assert.deepEqual(
    ['7B', '7D', '7E'].map(id => seat(m, id).side + '/' + seat(m, id).position + '/' + seat(m, id).hasWindow),
    ['left/middle/false', 'right/aisle/false', 'right/middle/false'])
  for (const no of ['7A', '7C', '7F']) assert.ok(!m.seats.some(s => s.seat === no), no)
  assert.throws(() => map(withKey(file, 'noWindow', '["7B"]')), (e: Error) => e.message.includes('XX-'))
})

test('공개한_특징은_참_거짓으로_나간다', () => {
  const m = map(BASE)
  assert.deepEqual(['8A', '8F', '29A', '29F', '7A', '7B'].map(id => seat(m, id).hasWindow), [false, true, false, false, true, false])
  assert.deepEqual(['8A', '28F', '7A', '29A'].map(id => seat(m, id).overWing), [true, true, false, false])
  assert.deepEqual(['8C', '30A', '30B', '7A'].map(id => seat(m, id).noRecline), [true, true, false, false])
  assert.deepEqual(['28A', '8A'].map(id => seat(m, id).exitRow), [true, false])
  assert.deepEqual(['7C', '1A', '1C', '28D', '8A'].map(id => seat(m, id).extraLegroom), [true, true, false, false, false])
})

test('다리_공간_목록이_있으면_비상구열이어도_목록에_없는_좌석은_넓지_않다', () => {
  const m = map(base('extraLegroom', '["28A"]'))
  assert.deepEqual(['28A', '28B', '28D'].map(id => seat(m, id).extraLegroom), [true, false, false])
  assert.deepEqual(['28A', '28B', '28D'].map(id => seat(m, id).exitRow), [true, true, true])
})

test('다리_공간이_모름이면_비상구_좌석을_넓다고_본다', () => {
  const m = map(base('extraLegroom', 'null'))
  assert.deepEqual(['28A', '28F', '7C', '1A'].map(id => seat(m, id).extraLegroom), [true, true, false, false])
})

test('비상구를_좌석_하나로_적으면_그_좌석만_비상구다', () => {
  const one = map(base('exitRows', '["28A"]'))
  assert.deepEqual(['28A', '28B', '28D'].map(id => seat(one, id).exitRow), [true, false, false])
  // JSON 숫자와 문자열이 섞여도 읽힌다 (기존 파일은 숫자로 적혀 있다)
  const mixed = map(base('exitRows', '[28, "8A"]'))
  assert.deepEqual(['28F', '8A', '8B'].map(id => seat(mixed, id).exitRow), [true, true, false])
})

test('공개하지_않은_특징은_모름이다', () => {
  assert.equal(seat(map(base('noWindow', 'null')), '7A').hasWindow, null)
  assert.equal(seat(map(base('noWindow', 'null')), '7B').hasWindow, false) // 창가가 아니면 늘 false
  assert.ok(map(base('overWing', 'null')).seats.every(s => s.overWing === null))
  assert.ok(map(base('noRecline', 'null')).seats.every(s => s.noRecline === null))
})

test('공개했고_해당_좌석이_없으면_거짓이다', () => {
  assert.equal(seat(map(base('noWindow', '[]')), '8A').hasWindow, true)
  assert.equal(seat(map(base('noRecline', '[]')), '8C').noRecline, false)
})

const cabins = (rawJson: string) => withKey(WIDE, 'cabins', rawJson)
const BAD_FILES: Json[] = [
  base('noWindow', '["31A"]'), // 없는 좌석
  base('noWindow', '["7B"]'), // 창가가 아닌 좌석
  base('noRecline', '["99"]'), // 없는 열
  base('extraLegroom', '["1B"]'),
  base('exitRows', '[9]'),
  base('exitRows', '["9A"]'), // 없는 좌석
  base('overWing', '{"fromRow":40,"toRow":45}'),
  base('facilities', '[{"type":"lavatory","afterRow":5,"side":"left"}]'),
  base('facilities', '[{"type":"toilet","afterRow":0,"side":"left"}]'),
  base('facilities', '[{"type":"exit","afterRow":8,"side":"middle"}]'),
  base('aircraftCodes', '[]'),
  // 객실이 틀린 경우는 다른 칸이 비어 있는 WIDE에서 바꾼다 (틀린 이유가 하나뿐이도록)
  cabins('[{"class":"economy","fromRow":7,"toRow":8,"seats":"ABC DEF"},{"class":"economy","fromRow":8,"toRow":9,"seats":"ABC DEF"}]'),
  cabins('[{"class":"economy","fromRow":7,"toRow":8,"seats":"ABC DEF","missing":["9A"]}]'),
  cabins('[{"class":"economy","fromRow":8,"toRow":7,"seats":"ABC DEF"}]'),
  cabins('[{"class":"economy","fromRow":7,"toRow":8,"seats":"ABA DEF"}]'),
  cabins('[{"class":"cheap","fromRow":7,"toRow":8,"seats":"ABC DEF"}]'),
  cabins('[]'),
  cabins('[{"class":"economy","fromRow":7,"toRow":8,"seats":"abc def"}]'), // 소문자
  cabins('[{"class":"economy","fromRow":7,"toRow":8,"seats":""}]'), // 빈 문자열
]
test('틀린_파일은_읽을_때_멈춘다', () => {
  assert.equal(BAD_FILES.length, 19)
  BAD_FILES.forEach((file, i) =>
    assert.throws(() => map(file), (e: Error) => e.message.includes('XX-'), `${i}번째 틀린 파일이 통과했다`))
})

test('기종_코드의_화면_이름', () => {
  assert.deepEqual(
    ['B738', 'B38M', 'B739', 'BCS3', 'A21N', 'A333', 'A321', 'A320', 'B772', 'B789'].map(aircraftName),
    ['B737-800', 'B737-8', 'B737-900', 'A220-300', 'A321neo', 'A330-300', 'A321', 'A320', 'B777-200', 'B789'])
})
