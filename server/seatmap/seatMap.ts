import { aircraftName } from '../aircraft/names.ts'

/** 좌석을 가리키는 표기. 숫자만 있으면 그 열 전체("14"), 아니면 좌석 하나("11A"). 파일에는 숫자(14)로 적힌 것도 있다. */
type Ref = string | number

/** seats는 빈칸이 통로("ABC DEF"), missing은 없는 좌석(생략하면 없음). */
export type Cabin = { class: string; fromRow: number; toRow: number; seats: string; missing?: Ref[] | null }
export type RowRange = { fromRow: number; toRow: number }
export type Facility = { type: string; afterRow: number; side: string }

/**
 * 배치도 파일(server/seatmaps/*.json) 한 개의 모양. 짧은 설명이며, expand가 좌석 목록으로 펼친다.
 * 칸 16개는 전부 적는다. 좌석을 가리키는 표기(missing · extraLegroom · noWindow · noRecline · exitRows)는
 * 숫자만 있으면 그 열 전체("14"), 아니면 좌석 하나("11A")다.
 * officialSeats · overWing · noWindow · noRecline · extraLegroom은 null이 "모름"(항공사가 그 배치에서 공개 안 함),
 * 빈 목록 []은 "공개했고 해당 좌석 없음"이다.
 */
export type SeatMapFile = {
  id: string // 파일 이름과 같다
  airline: string // 편명 앞 두 글자
  aircraftCodes: string[] // 공항공사 기종 코드. 첫 번째가 화면 이름이 된다
  name: string // 공식 페이지의 기종 이름 + 구분
  order: number // 항공사 페이지에 나오는 순서. 같은 항공사 + 기종 안에서 겹치지 않고, 가장 작은 것이 대표
  officialSeats: number[] | null // 공식 좌석 수 목록. null이면 모름
  registrations: string[] | null // 이 배치로 확인된 등록번호. HL + 숫자 4개, 없으면 []
  source: string // 공식 페이지 주소
  checkedOn: string // 본 날짜 YYYY-MM-DD
  cabins: Cabin[] // 객실 순서대로. 열 번호가 건너뛰거나 글자 배열이 바뀌면 나눈다
  exitRows: Ref[] | null // 항공사가 비상구 좌석으로 표시한 열("43" 그 열 전체) 또는 좌석 하나("49D")
  // 목록이면 목록에 있는 좌석만 다리 공간이 넓다 (비상구 좌석도 항공사가 넓다고 한 것만 적는다).
  // null이면 그 배치에 다리 공간 표시가 없다는 뜻이고, 그때만 비상구 좌석을 넓다고 본다. 표시가 없는 배치에 []를 쓰면 안 된다.
  extraLegroom: Ref[] | null
  overWing: RowRange | null // 날개 위 열 범위. null이면 모름
  noWindow: Ref[] | null // 창문 없는 창가 좌석. 열 전체("29")는 그 열의 창가 좌석, 좌석 하나는 창가 좌석이어야 한다
  noRecline: Ref[] | null // 등받이가 고정된 좌석
  // afterRow는 "이 열 바로 뒤"이고 0은 맨 앞. lavatory · galley가 하나도 없으면 nearLavatory는 모름(null)이다.
  facilities: Facility[] | null
}

/** null은 "항공사가 알려 주지 않아 모름"이다. */
export type Seat = {
  seat: string
  row: number
  column: string
  cabin: string
  side: string
  position: string
  hasWindow: boolean | null
  overWing: boolean | null
  exitRow: boolean
  zone: string
  nearLavatory: boolean | null
  noRecline: boolean | null
  extraLegroom: boolean
}

/** 화면으로 나가는 배치도: 파일의 짧은 설명을 좌석 하나하나로 펼친 것. */
export type SeatMap = {
  id: string
  airline: string
  aircraft: string
  name: string
  seatCount: number
  source: string
  checkedOn: string
  cabins: { class: string; fromRow: number; toRow: number; seats: string }[]
  seats: Seat[]
  facilities: Facility[]
}

const CLASSES = new Set(['first', 'business', 'premium', 'economy'])
const FACILITY_TYPES = new Set(['lavatory', 'galley', 'exit'])
const SIDES = new Set(['left', 'right', 'center', 'both'])
const SEATS = /^[A-Z]+( [A-Z]+)*$/
const REF = /^(\d+)([A-Z]?)$/

/** 열 하나: 열 번호, 어느 객실인지, 선언된 글자 묶음, 그 열에서 빠진 좌석 번호. */
type Row = { number: number; cabin: Cabin; letters: string[]; missing: Set<string> }

/** 틀린 파일이면 "<id>: …" 메시지의 Error로 멈춘다. */
export function expand(f: SeatMapFile): SeatMap {
  const id = f.id
  if (!f.aircraftCodes?.length) throw bad(id, 'aircraftCodes가 비어 있다')
  if (!f.cabins?.length) throw bad(id, 'cabins가 비어 있다')

  const rows = rowsOf(f)
  const rowCount = rows.length
  const rowNumbers = new Set(rows.map(r => r.number))

  // 좌석 만들기 (위치와 구역까지). 특징은 뒤에서 채운다.
  const ids = new Set<string>()
  const seats: Seat[] = []
  const near: boolean[] = new Array(rowCount).fill(false) // 열 위치별 화장실 근처 여부
  let lavatoryKnown = false // 화장실이나 갤리가 하나라도 파일에 있는가
  for (const fac of f.facilities ?? []) {
    if (!FACILITY_TYPES.has(fac.type)) throw bad(id, '정해지지 않은 시설 type: ' + fac.type)
    if (!SIDES.has(fac.side)) throw bad(id, '정해지지 않은 시설 side: ' + fac.side)
    if (fac.afterRow !== 0 && !rowNumbers.has(fac.afterRow)) throw bad(id, 'afterRow가 없는 열이다: ' + fac.afterRow)
    if (fac.type === 'exit') continue
    lavatoryKnown = true
    const p = rows.filter(r => r.number <= fac.afterRow).length // 시설 앞에 있는 열의 수
    for (let i = Math.max(0, p - 2); i <= Math.min(rowCount - 1, p + 1); i++) near[i] = true
  }
  for (let i = 0; i < rowCount; i++) {
    const r = rows[i]
    const zone = ['front', 'middle', 'rear'][Math.floor((i * 3) / rowCount)]
    const groups = r.letters
    for (let g = 0; g < groups.length; g++) {
      const group = groups[g]
      const side = g === 0 ? 'left' : g === groups.length - 1 ? 'right' : 'center'
      for (let c = 0; c < group.length; c++) {
        const window = (g === 0 && c === 0) || (g === groups.length - 1 && c === group.length - 1)
        const position = window ? 'window' : c === 0 || c === group.length - 1 ? 'aisle' : 'middle'
        const seatId = r.number + group[c]
        if (r.missing.has(seatId)) continue
        if (ids.has(seatId)) throw bad(id, '좌석 번호가 겹친다: ' + seatId)
        ids.add(seatId)
        seats.push({
          seat: seatId, row: r.number, column: group[c], cabin: r.cabin.class, side, position,
          hasWindow: null, overWing: null, exitRow: false, zone,
          nearLavatory: lavatoryKnown ? near[i] : null, noRecline: null, extraLegroom: false,
        })
      }
    }
  }

  // 특징 목록이 가리키는 좌석
  const noWindow = f.noWindow == null ? null : windowless(id, f.noWindow, seats)
  const noRecline = f.noRecline == null ? null : refs(id, 'noRecline', f.noRecline, seats)
  const exits = refs(id, 'exitRows', f.exitRows ?? [], seats)
  // 다리 공간 표시가 없으면(null) 비상구 좌석을 넓다고 본다. 목록이 있으면 목록에 있는 좌석만 넓다.
  const legroom = f.extraLegroom == null ? exits : refs(id, 'extraLegroom', f.extraLegroom, seats)
  const wing = f.overWing ?? null
  if (wing !== null && !rows.some(r => r.number >= wing.fromRow && r.number <= wing.toRow))
    throw bad(id, 'overWing 범위에 열이 하나도 없다')

  const out: Seat[] = seats.map(s => ({
    ...s,
    hasWindow: s.position !== 'window' ? false : noWindow === null ? null : !noWindow.has(s.seat),
    overWing: wing === null ? null : s.row >= wing.fromRow && s.row <= wing.toRow,
    exitRow: exits.has(s.seat),
    noRecline: noRecline === null ? null : noRecline.has(s.seat),
    extraLegroom: legroom.has(s.seat),
  }))

  return {
    id, airline: f.airline, aircraft: aircraftName(f.aircraftCodes[0]), name: f.name, seatCount: out.length,
    source: f.source, checkedOn: f.checkedOn,
    cabins: f.cabins.map(c => ({ class: c.class, fromRow: c.fromRow, toRow: c.toRow, seats: c.seats })),
    seats: out,
    facilities: (f.facilities ?? []).map(fac => ({ type: fac.type, afterRow: fac.afterRow, side: fac.side })),
  }
}

/** 객실 순서대로 열 목록을 만든다 (통째로 없는 열은 뺀다). 객실 칸 검사도 여기서 한다. */
function rowsOf(f: SeatMapFile): Row[] {
  const id = f.id
  const rows: Row[] = []
  for (const c of f.cabins) {
    if (!CLASSES.has(c.class)) throw bad(id, '정해지지 않은 class: ' + c.class)
    if (c.fromRow > c.toRow) throw bad(id, `fromRow가 toRow보다 크다: ${c.fromRow}>${c.toRow}`)
    if (c.seats == null || !SEATS.test(c.seats))
      throw bad(id, 'seats 표기가 틀렸다 (대문자 글자와 빈칸뿐이어야 한다): ' + c.seats)
    const groups = c.seats.split(' ')
    const letters = new Set<string>()
    for (const group of groups)
      for (const ch of group) {
        if (letters.has(ch)) throw bad(id, 'seats에 같은 글자가 두 번 나온다: ' + ch)
        letters.add(ch)
      }
    const missingRows = new Set<number>()
    const missingSeats = new Set<string>()
    for (const raw of c.missing ?? []) {
      const m = String(raw)
      const mt = REF.exec(m)
      if (!mt) throw bad(id, 'missing 표기가 틀렸다: ' + m)
      const row = Number.parseInt(mt[1], 10)
      if (row < c.fromRow || row > c.toRow) throw bad(id, 'missing이 객실 범위 밖이다: ' + m)
      if (mt[2] === '') missingRows.add(row)
      else if (!letters.has(mt[2])) throw bad(id, 'missing의 좌석이 없다: ' + m)
      else missingSeats.add(m)
    }
    for (let n = c.fromRow; n <= c.toRow; n++) {
      if (missingRows.has(n)) continue
      rows.push({ number: n, cabin: c, letters: groups, missing: missingSeats })
    }
  }
  return rows
}

/** 좌석 목록 표기("14" 열 전체, "11A" 좌석 하나)를 좌석 번호 집합으로 푼다. 가리키는 곳이 없으면 멈춘다. */
function refs(id: string, what: string, list: Ref[], seats: Seat[]): Set<string> {
  return new Set(list.flatMap(ref => resolve(id, what, String(ref), seats)))
}

function resolve(id: string, what: string, ref: string, seats: Seat[]): string[] {
  const m = REF.exec(ref)
  if (!m) throw bad(id, what + ' 표기가 틀렸다: ' + ref)
  const hit = seats
    .filter(s => (m[2] === '' ? s.row === Number.parseInt(m[1], 10) : s.seat === ref))
    .map(s => s.seat)
  if (hit.length === 0) throw bad(id, what + '이(가) 가리키는 좌석이나 열이 없다: ' + ref)
  return hit
}

/** noWindow: 열 전체("29")는 그 열의 창가 좌석, 좌석 하나는 창가여야 한다. */
function windowless(id: string, list: Ref[], seats: Seat[]): Set<string> {
  const out = new Set<string>()
  for (const raw of list) {
    const ref = String(raw)
    const wholeRow = !/\p{L}$/u.test(ref)
    for (const seatId of resolve(id, 'noWindow', ref, seats)) {
      const window = seats.some(s => s.seat === seatId && s.position === 'window')
      if (window) out.add(seatId)
      else if (!wholeRow) throw bad(id, 'noWindow가 창가가 아닌 좌석을 가리킨다: ' + ref)
    }
  }
  return out
}

function bad(id: string, why: string): Error {
  return new Error(id + ': ' + why)
}
