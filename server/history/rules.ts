// import가 없는 순수 파일 — 서버(창구 검사)와 화면(저장 전 거르기)이 같이 쓴다.

export type Airport = 'GMP' | 'CJU' | 'PUS'
export type Passengers = { adult: number; child: number; infant: number }
export type SearchRecord = { from: Airport; to: Airport; date: string; returnDate?: string; passengers: Passengers; at: number }
export type FlightPick = { from: Airport; to: Airport; dep: string }
export type TripRecord = {
  from: Airport; to: Airport; date: string; passengers: Passengers
  airline: string; flight: string; dep: string; seat: string; score: number; rating?: number; at: number
}
/** 모두 최신이 맨 앞. */
export type History = { searches: SearchRecord[]; picks: FlightPick[]; trips: TripRecord[] }

export const MAX_RECORDS = 30

export const emptyHistory = (): History => ({ searches: [], picks: [], trips: [] })

type Obj = Record<string, unknown>
const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x)
const isInt = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x)
const isAirport = (x: unknown): x is Airport => x === 'GMP' || x === 'CJU' || x === 'PUS'

/** 'YYYY-MM-DD' 모양이면서 달력에 실제 있는 날짜인가 (2026-02-30은 아니다). */
function isDate(x: unknown): x is string {
  if (typeof x !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x)) return false
  return new Date(`${x}T00:00:00Z`).toISOString().slice(0, 10) === x
}

// src/booking.ts isBookable과 같은 규칙: 성인 1명 이상, 합 9명 이하, 유아는 성인 수 이하
function validPassengers(x: unknown): Passengers | null {
  if (!isObj(x) || !isInt(x.adult) || !isInt(x.child) || !isInt(x.infant)) return null
  const { adult, child, infant } = x
  if (adult < 1 || child < 0 || infant < 0 || adult + child + infant > 9 || infant > adult) return null
  return { adult, child, infant }
}

/** 공항 두 칸이 맞고 서로 다르면 담아 돌려준다. */
function route(x: Obj): { from: Airport; to: Airport } | null {
  return isAirport(x.from) && isAirport(x.to) && x.from !== x.to ? { from: x.from, to: x.to } : null
}

const isTime = (x: unknown): x is string => typeof x === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(x)
const isAt = (x: unknown): x is number => isInt(x) && x > 0

export function validSearch(x: unknown): SearchRecord | null {
  if (!isObj(x)) return null
  const r = route(x)
  const passengers = validPassengers(x.passengers)
  if (!r || !passengers || !isDate(x.date) || !isAt(x.at)) return null
  const record: SearchRecord = { ...r, date: x.date, passengers, at: x.at }
  if (x.returnDate !== undefined) {
    if (!isDate(x.returnDate) || x.returnDate < x.date) return null
    record.returnDate = x.returnDate
  }
  return record
}

export function validPick(x: unknown): FlightPick | null {
  if (!isObj(x)) return null
  const r = route(x)
  return r && isTime(x.dep) ? { ...r, dep: x.dep } : null
}

export function validTrip(x: unknown): TripRecord | null {
  if (!isObj(x)) return null
  const r = route(x)
  const passengers = validPassengers(x.passengers)
  if (!r || !passengers || !isDate(x.date) || !isTime(x.dep) || !isAt(x.at)) return null
  if (typeof x.airline !== 'string' || !/^\p{L}{1,20}$/u.test(x.airline)) return null
  if (typeof x.flight !== 'string' || !/^[A-Za-z0-9]{2,8}$/.test(x.flight)) return null
  if (typeof x.seat !== 'string' || !/^\d{1,2}[A-Z]$/.test(x.seat)) return null
  if (!isInt(x.score) || x.score < 0 || x.score > 100) return null
  const record: TripRecord = { ...r, date: x.date, passengers, airline: x.airline, flight: x.flight, dep: x.dep, seat: x.seat, score: x.score, at: x.at }
  if (x.rating !== undefined) {
    if (!isInt(x.rating) || x.rating < 1 || x.rating > 5) return null
    record.rating = x.rating
  }
  return record
}

/**
 * 몸통을 읽는다. history에는 맞는 기록만(각 30개까지), 모르는 칸은 버린다.
 * clean은 몸통이 객체이고 세 칸이 모두 배열 · 30개 이하 · 틀린 기록 0개일 때만 true.
 */
export function readHistory(body: unknown): { history: History; clean: boolean } {
  const history = emptyHistory()
  if (!isObj(body)) return { history, clean: false }
  let clean = true
  const take = <T>(list: unknown, valid: (x: unknown) => T | null): T[] => {
    if (!Array.isArray(list) || list.length > MAX_RECORDS) clean = false
    if (!Array.isArray(list)) return []
    const ok = list.slice(0, MAX_RECORDS).map(valid).filter(r => r !== null)
    if (ok.length < Math.min(list.length, MAX_RECORDS)) clean = false
    return ok
  }
  history.searches = take(body.searches, validSearch)
  history.picks = take(body.picks, validPick)
  history.trips = take(body.trips, validTrip)
  return { history, clean }
}
