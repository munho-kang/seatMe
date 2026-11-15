// 실제 배치도 파일(server/seatmaps/*.json)을 읽어 검사한다.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { test } from 'node:test'
import { fromKst, kst } from '../kst.ts'
import { seatMapFiles } from '../seatmaps/index.ts'
import { seatMaps as REPO } from './repository.ts'

const DIR = new URL('../seatmaps/', import.meta.url)
const NAMES = fs.readdirSync(DIR).filter(name => name.endsWith('.json')).sort()
const raw = (name: string) => JSON.parse(fs.readFileSync(new URL(name, DIR), 'utf8'))
const sorted = (keys: string[]) => [...keys].sort()

/** 화면에 뜨는 "항공사 기종 코드" 조합. 항공사를 옮겨 적을 때마다 줄을 더한다. */
const EXPECTED_COMBOS = ['7C B738', '7C B38M', 'LJ B738', 'LJ B38M', 'LJ B739', 'LJ B772', 'LJ A321', 'KE B739', 'KE BCS3', 'KE A21N', 'KE A321', 'KE A333', 'BX A321', 'BX A320', 'BX A21N', 'ZE B738', 'ZE B38M', 'TW B738', 'TW B38M', 'OZ A321', 'OZ A333', 'RS A321', 'WE A320']

test('우리_노선의_조합마다_배치도가_있다', () => {
  for (const combo of EXPECTED_COMBOS)
    assert.ok(REPO.candidatesFor(combo.split(' ')[0], combo.split(' ')[1], null).ids.length > 0, combo)
})
test('좌석_수가_공식_좌석_수와_같다', () => { // officialSeats가 null인 파일은 건너뛴다
  for (const f of REPO.files())
    if (f.officialSeats != null) assert.ok(f.officialSeats.includes(REPO.findById(f.id)!.seatCount), f.id)
})

const KEYS = ['id', 'airline', 'aircraftCodes', 'name', 'order', 'officialSeats', 'registrations',
  'source', 'checkedOn', 'cabins', 'exitRows', 'extraLegroom', 'overWing', 'noWindow', 'noRecline', 'facilities']

test('칸_이름이_정해진_것뿐이고_모름_칸도_꼭_적혀_있다', () => { // 빠져도, 더 있어도 실패
  for (const name of NAMES) {
    const root = raw(name)
    assert.deepEqual(sorted(Object.keys(root)), sorted(KEYS), name)
    for (const cabin of root.cabins) {
      const keys = Object.keys(cabin)
      for (const need of ['class', 'fromRow', 'toRow', 'seats']) assert.ok(keys.includes(need), `${name} cabins.${need}`)
      for (const key of keys) assert.ok(['class', 'fromRow', 'toRow', 'seats', 'missing'].includes(key), `${name} cabins.${key}`)
    }
    for (const facility of root.facilities)
      assert.deepEqual(sorted(Object.keys(facility)), sorted(['type', 'afterRow', 'side']), name)
    if (root.overWing !== null && typeof root.overWing === 'object') // torow 같은 잘못 쓴 칸이 조용히 무시되지 않게
      assert.deepEqual(sorted(Object.keys(root.overWing)), ['fromRow', 'toRow'], name)
  }
})
test('파일마다_id가_항공사와_첫_기종_코드로_시작한다', () => {
  for (const f of REPO.files()) assert.ok(f.id.startsWith(`${f.airline}-${f.aircraftCodes[0]}-`), f.id)
})
test('비상구와_시설_칸은_배열이다', () => { // null이면 조용히 "없음"으로 읽힌다
  for (const name of NAMES) {
    const root = raw(name)
    assert.ok(Array.isArray(root.exitRows), name + ' exitRows')
    assert.ok(Array.isArray(root.facilities), name + ' facilities')
  }
})
test('출처는_https_주소이고_확인_날짜는_날짜다', () => {
  const today = kst(Date.now()).slice(0, 10)
  for (const f of REPO.files()) {
    assert.ok(f.source.startsWith('https://'), f.id)
    assert.ok(!Number.isNaN(fromKst(f.checkedOn, '00:00')) && f.checkedOn <= today, f.id)
  }
})
test('등록번호는_HL과_숫자_네_개다', () => { // 소문자나 공백이 섞이면 조용히 "확정 안 됨"이 된다
  for (const f of REPO.files()) {
    assert.ok(Array.isArray(f.registrations), f.id + ': registrations는 없으면 []로 적는다') // null이면 실패 (Java 테스트와 같다)
    for (const r of f.registrations) assert.match(r, /^HL\d{4}$/, f.id)
  }
})
test('같은_항공사_기종의_후보는_서로_다르다', () => { // 똑같으면 "합치기" 규칙대로 합친다
  for (const a of REPO.files())
    for (const b of REPO.files())
      if (a.id < b.id && a.airline === b.airline && a.aircraftCodes.some(code => b.aircraftCodes.includes(code))) {
        const x = REPO.findById(a.id)!
        const y = REPO.findById(b.id)!
        assert.notDeepEqual([x.cabins, x.seats, x.facilities], [y.cabins, y.seats, y.facilities], `${a.id} = ${b.id}`)
      }
})

// Worker에는 폴더를 읽는 기능이 없어 index.ts에 파일을 한 줄씩 적는다. 파일을 넣고 그 줄을 잊으면 여기서 걸린다
test('목록 파일(index.ts)과 폴더가 같고 파일 이름이 id다 (JS)', () => {
  assert.equal(NAMES.length, 40)
  assert.deepEqual(seatMapFiles.map(f => f.id).sort(), NAMES.map(name => name.slice(0, -5)))
  for (const name of NAMES) assert.equal(raw(name).id + '.json', name)
})
