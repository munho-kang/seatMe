// 검색 · 여행 기록. 네이버로 로그인했으면 계정(서버 /api/history)에, 아니면 이 기기(브라우저 localStorage)에 저장한다.
// seatProfile.ts와 같은 모양이다. 로그인 여부는 화면을 그리기 전에 syncSearchHistory()가 한 번 확인한다 (main.tsx).
import { MAX_RECORDS, emptyHistory, readHistory, validPick, validSearch, validTrip } from '../server/history/rules.ts'
import type { Airport, History, Passengers, SearchRecord, TripRecord } from '../server/history/rules.ts'
import { isBookable, parsePassengers } from './booking.ts'
import { formatPassengers } from './mocks/flights.ts'

const STORAGE_KEY = 'seatme.searchHistory'

// 한국 시각 오늘 'YYYY-MM-DD' (server/kst.ts와 같은 방식: UTC+9 고정)
export function kstToday(now = Date.now()) {
  return new Date(now + 9 * 3600_000).toISOString().slice(0, 10)
}

// 저장해 둔 글자를 기록으로 바꾼다. 비었거나 망가졌으면 빈 기록, 틀린 기록은 버린다
export function parseHistory(text: string | null): History {
  try {
    return readHistory(JSON.parse(text ?? '')).history
  } catch {
    return emptyHistory()
  }
}

// localStorage는 막혀 있을 수 있다 (사생활 보호 모드 등). 그때는 화면 메모리로만 동작한다
function deviceText() {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

let history: History | undefined
// 저장 방식: 계정(서버), 기기(localStorage), 메모리뿐 (동기화가 어긋났을 때)
let mode: 'device' | 'account' | 'memory' = 'device'

export function getSearchHistory() {
  return (history ??= parseHistory(deviceText()))
}

async function putHistory(value: History, keepalive = false) {
  try {
    const response = await fetch('/api/history', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
      keepalive,
      signal: AbortSignal.timeout(3000), // 서버가 멈춰도 로그아웃이 끝없이 기다리지 않게
    })
    return response.ok
  } catch {
    return false
  }
}

// 화면을 그리기 전에 부른다. 로그인했으면 계정 기록을 쓰고, 계정에 아직 없으면 이 기기 기록을 계정으로 옮긴다.
// 서버가 3초 안에 답하지 않으면 로그인 여부를 모르니 메모리에만 둔다 (계정 기록이 기기에 남지 않게)
export async function syncSearchHistory() {
  let answered = false
  try {
    const response = await fetch('/api/history', { signal: AbortSignal.timeout(3000) })
    answered = true
    // 401은 로그인 안 함(기기). 그 밖의 실패는 로그인 여부를 모르니 이번 접속 동안 메모리에만 둔다
    if (response.status === 401) return
    if (!response.ok) {
      mode = 'memory'
      return
    }
    mode = 'account'
    const body = await response.json()
    if (body.history !== null) {
      history = readHistory(body.history).history
      return
    }
    const device = parseHistory(deviceText())
    if (device.searches.length + device.picks.length + device.trips.length > 0 && (await putHistory(device))) {
      history = device
      // 계정으로 옮겼으니 기기에서는 지운다 (로그아웃하면 계정 기록이 화면에서 사라지게)
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // 서버에 닿지 않는다. 응답으로 방식이 정해진 뒤의 실패(기기로 옮기기 등)는 그대로 둔다
    if (!answered) mode = 'memory'
  }
}

// 로그아웃 뒤에는 이 기기 기록(없으면 빈 기록)으로 돌아간다
export function forgetAccountHistory() {
  clearTimeout(timer)
  timer = undefined
  pending = false
  mode = 'device'
  history = undefined
}

let pending = false
let timer: ReturnType<typeof setTimeout> | undefined

function flush(keepalive = false) {
  clearTimeout(timer)
  timer = undefined
  if (!pending || !history) return Promise.resolve()
  pending = false
  return putHistory(history, keepalive === true).then((ok) => {
    if (!ok) console.error('계정에 검색 기록을 저장하지 못했어요')
  })
}

// 로그아웃 직전에 부른다. 기다리던 저장을 바로 보내고 끝날 때까지 기다린다 (실패해도 던지지 않는다)
export const flushSearchHistory = (): Promise<void> => flush()

// 탭을 닫거나 숨기면 기다리던 저장을 바로 보낸다
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush(true))
}

// 메모리 값을 새 객체로 바꾸고 저장한다 (React가 새 참조로 다시 그린다). 저장이 안 돼도 예외는 밖으로 내지 않는다
function save(next: History) {
  history = next
  if (mode === 'account') {
    // 계정 저장소는 같은 열쇠에 1초에 1번만 쓸 수 있어서 1초 뒤 마지막 값만 보낸다
    // ponytail: 계정 저장이 실패하면 이 화면에서만 유지되고 다음 접속 때 계정 값으로 돌아간다
    pending = true
    timer ??= setTimeout(() => flush(), 1000)
  } else if (mode === 'device') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // 저장이 막혀 있으면 새로고침 전까지만 유지된다
    }
  }
  return next
}

const front = <T>(item: T, list: T[]) => [item, ...list].slice(0, MAX_RECORDS)

export function addSearch(record: Record<string, unknown>) {
  const valid = validSearch({ ...record, at: Date.now() })
  if (valid) save({ ...getSearchHistory(), searches: front(valid, getSearchHistory().searches) })
}

export function addPick(pick: Record<string, unknown>) {
  const valid = validPick({ ...pick, at: Date.now() })
  if (valid) save({ ...getSearchHistory(), picks: front(valid, getSearchHistory().picks) })
}

const sameFlight = (a: TripRecord, b: TripRecord) => a.flight === b.flight && a.date === b.date && a.dep === b.dep

// 같은 편이 이미 있으면 지우고 새로 맨 앞에 넣는다 (좌석을 바꿔 다시 누른 경우). 예전 만족도는 옮긴다
export function addTrip(trip: Record<string, unknown>) {
  const valid = validTrip({ ...trip, at: Date.now() })
  if (!valid) return
  const current = getSearchHistory()
  const old = current.trips.find((t) => sameFlight(t, valid))
  if (old?.rating !== undefined) valid.rating = old.rating
  save({ ...current, trips: front(valid, current.trips.filter((t) => !sameFlight(t, valid))) })
}

export function removeSearch(record: SearchRecord) {
  const { from, to, date, returnDate, passengers: p } = record
  const same = (r: SearchRecord) =>
    r.from === from && r.to === to && r.date === date && r.returnDate === returnDate &&
    r.passengers.adult === p.adult && r.passengers.child === p.child && r.passengers.infant === p.infant
  const current = getSearchHistory()
  return save({ ...current, searches: current.searches.filter((r) => !same(r)) })
}

export function removeTrip(trip: TripRecord) {
  const current = getSearchHistory()
  return save({ ...current, trips: current.trips.filter((t) => !sameFlight(t, trip)) })
}

export function rateTrip(trip: TripRecord, rating: number) {
  const current = getSearchHistory()
  return save({ ...current, trips: current.trips.map((t) => (sameFlight(t, trip) ? { ...t, rating } : t)) })
}

// --- 카드에 보일 값 계산 (저장하지 않고 기록에서 그때그때 계산한다) ---

export type TimeBand = 'morning' | 'afternoon' | 'evening'
// 문구는 임시다 (디자인 확인)
export const TIME_BAND_LABEL: Record<TimeBand, string> = { morning: '오전 출발', afternoon: '오후 출발', evening: '저녁 출발' }

// 'HH:MM' 문자열 비교: ~11:59 오전, 12:00~17:59 오후, 18:00~ 저녁
export function timeBand(dep: string): TimeBand {
  return dep < '12:00' ? 'morning' : dep < '18:00' ? 'afternoon' : 'evening'
}

export type FrequentTrip = { from: Airport; to: Airport; date: string; passengers: Passengers; time?: TimeBand }

const DAY = 86400_000
const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10)
const weekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay()

// 값을 세어 가장 많은 것. 같으면 먼저 나온 것 (목록이 최신순이라 더 최근)
function mostCommon<T>(items: T[]): T | undefined {
  const counts = new Map<T, number>()
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1)
  let best: T | undefined
  for (const [item, n] of counts) if (best === undefined || n > counts.get(best)!) best = item
  return best
}

// 자주 가는 여행: 가장 많이 검색한 노선(2번 이상) + 그 노선을 자주 검색한 요일의 내일부터 7일 안 첫 날
export function frequentTrip(history: History, today: string): FrequentTrip | null {
  const key = (r: { from: Airport; to: Airport }) => `${r.from}>${r.to}`
  const routeKey = mostCommon(history.searches.map(key))
  if (routeKey === undefined) return null
  const searches = history.searches.filter((r) => key(r) === routeKey)
  if (searches.length < 2) return null

  const day = mostCommon(searches.map((r) => weekday(r.date)))!
  let date = addDays(today, 1)
  while (weekday(date) !== day) date = addDays(date, 1)

  const { from, to, passengers } = searches[0]
  const band = mostCommon(history.picks.filter((p) => key(p) === routeKey).map((p) => timeBand(p.dep)))
  return { from, to, date, passengers, ...(band && { time: band }) }
}

export function frequentTripUrl(trip: FrequentTrip) {
  const params = new URLSearchParams({ from: trip.from, to: trip.to, date: trip.date, passengers: formatPassengers(trip.passengers) })
  if (trip.time) params.set('time', trip.time)
  return `/flight/results?${params}`
}

// 다가오는 여행(오늘 포함)은 이른 순, 지난 여행은 늦은 순
export function splitTrips(trips: TripRecord[], today: string) {
  const when = (t: TripRecord) => `${t.date} ${t.dep}`
  const sorted = [...trips].sort((a, b) => (when(a) < when(b) ? -1 : when(a) > when(b) ? 1 : 0))
  return { upcoming: sorted.filter((t) => t.date >= today), past: sorted.filter((t) => t.date < today).reverse() }
}

// 겹치지 않는 노선 최근 3개
export function recentRoutes(history: History): [Airport, Airport][] {
  const routes: [Airport, Airport][] = []
  for (const { from, to } of history.searches) {
    if (routes.length < 3 && !routes.some(([f, t]) => f === from && t === to)) routes.push([from, to])
  }
  return routes
}

const AIRPORTS = ['GMP', 'CJU', 'PUS']
const isDateText = (x: string | null): x is string => x !== null && /^\d{4}-\d{2}-\d{2}$/.test(x)

// 주소의 검색 칸을 화면 칸 값으로. 틀린 칸은 빈 칸으로 둔다
export function searchPrefill(params: URLSearchParams, today: string) {
  const from = params.get('from')
  const to = params.get('to')
  const date = params.get('date')
  const returnDate = params.get('returnDate')
  const passengers = params.get('passengers')
  const dateOk = isDateText(date) && date >= today
  const result: { from?: Airport; to?: Airport; date?: string; returnDate?: string; passengers?: Passengers } = {}
  if (from !== to) {
    if (AIRPORTS.includes(from ?? '')) result.from = from as Airport
    if (AIRPORTS.includes(to ?? '')) result.to = to as Airport
  }
  if (dateOk) result.date = date
  if (isDateText(returnDate) && returnDate >= today && (!isDateText(date) || (dateOk && returnDate >= date))) result.returnDate = returnDate
  if (passengers !== null && isBookable(parsePassengers(passengers))) result.passengers = parsePassengers(passengers)
  return result
}

// 예매 링크(getBookingLink)가 읽는 칸
export function tripParams(trip: TripRecord) {
  return new URLSearchParams({
    from: trip.from, to: trip.to, date: trip.date, passengers: formatPassengers(trip.passengers), flight: trip.flight, dep: trip.dep,
  })
}
