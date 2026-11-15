// 검색 · 여행 기록. 네이버로 로그인했으면 계정(서버 /api/history)에, 아니면 이 기기(브라우저 localStorage)에 저장한다.
// seatProfile.ts와 같은 모양이다. 로그인 여부는 화면을 그리기 전에 syncSearchHistory()가 한 번 확인한다 (main.tsx).
import { MAX_RECORDS, emptyHistory, readHistory, validPick, validSearch, validTrip } from '../server/history/rules.ts'
import type { History, SearchRecord, TripRecord } from '../server/history/rules.ts'

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
let loggedIn = false

export function getSearchHistory() {
  return (history ??= parseHistory(deviceText()))
}

async function putHistory(value: History) {
  try {
    const response = await fetch('/api/history', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    })
    return response.ok
  } catch {
    return false
  }
}

// 화면을 그리기 전에 부른다. 로그인했으면 계정 기록을 쓰고, 계정에 아직 없으면 이 기기 기록을 계정으로 옮긴다.
// 서버가 답하지 않으면 로그인 안 한 것으로 보고 기기 기록을 쓴다
export async function syncSearchHistory() {
  try {
    const response = await fetch('/api/history', { signal: AbortSignal.timeout(3000) })
    if (!response.ok) return
    loggedIn = true
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
    // 서버에 닿지 않는다
  }
}

// 로그아웃 뒤에는 이 기기 기록(없으면 빈 기록)으로 돌아간다
export function forgetAccountHistory() {
  loggedIn = false
  history = undefined
}

// 메모리 값을 새 객체로 바꾸고 저장한다 (React가 새 참조로 다시 그린다). 저장이 안 돼도 예외는 밖으로 내지 않는다
function save(next: History) {
  history = next
  if (loggedIn) {
    // ponytail: 계정 저장이 실패하면 이 화면에서만 유지되고 다음 접속 때 계정 값으로 돌아간다
    void putHistory(next).then((ok) => ok || console.error('계정에 검색 기록을 저장하지 못했어요'))
  } else {
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
