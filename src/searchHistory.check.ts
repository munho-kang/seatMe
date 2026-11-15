// 검색 · 여행 기록 보관 확인. `npm test`로 돌린다. node에는 localStorage · 로그인이 없으므로 기록은 메모리에서만 돈다
import { getSearchHistory, kstToday, parseHistory, addSearch, addTrip, rateTrip, removeSearch, removeTrip } from './searchHistory.ts'

function check(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`기대한 값 ${JSON.stringify(expected)} / 실제 값 ${JSON.stringify(actual)}`)
  }
}

check(kstToday(Date.parse('2026-11-14T15:30:00Z')), '2026-11-15')
check(kstToday(Date.parse('2026-11-14T14:59:00Z')), '2026-11-14')

const passengers = { adult: 1, child: 0, infant: 0 }
const search = { from: 'GMP', to: 'CJU', date: '2026-11-20', passengers } as const
const empty = { searches: [], picks: [], trips: [] }

for (const text of [null, '', '{', '3']) check(parseHistory(text), empty)
const parsed = parseHistory(JSON.stringify({ ...empty, searches: [{ ...search, at: 1 }, { ...search, from: 'ICN', at: 2 }] }))
check(parsed.searches, [{ ...search, at: 1 }])

// 검색: 같은 조건도 쌓고, 30개까지만 둔다
addSearch(search)
addSearch(search)
check(getSearchHistory().searches.length, 2)
for (let i = 0; i < 29; i++) addSearch(search)
check(getSearchHistory().searches.length, 30)
// 틀린 기록은 조용히 버린다
addSearch({ ...search, from: 'ICN' })
check(getSearchHistory().searches.length, 30)

// 고칠 때마다 새 객체 (React가 다시 그리도록)
const before = getSearchHistory()
addSearch({ ...search, to: 'PUS' })
if (getSearchHistory() === before || getSearchHistory().searches === before.searches) throw new Error('새 객체여야 해요')

// 여행: 틀린 기록은 넣지 않고, 같은 편은 최신 좌석으로 바꾸되 만족도는 이어 간다
const trip = { from: 'GMP', to: 'CJU', date: '2026-11-20', passengers, airline: '제주항공', flight: '7C115', dep: '09:00', seat: '12A', score: 80 } as const
addTrip({ ...trip, airline: '' })
check(getSearchHistory().trips, [])
addTrip(trip)
const rated = rateTrip(getSearchHistory().trips[0], 4)
check(rated, getSearchHistory())
addTrip({ ...trip, seat: '14C' })
const { trips } = getSearchHistory()
check([trips.length, trips[0].seat, trips[0].rating], [1, '14C', 4])

// 삭제: 같은 조건은 모두, 같은 편은 그 편만
addTrip({ ...trip, flight: '7C117' })
check(removeTrip(getSearchHistory().trips.find((t) => t.flight === '7C117')!).trips.map((t) => t.flight), ['7C115'])
const only = removeSearch({ ...search, at: 0 })
check(only.searches.some((r) => r.to === 'CJU'), false)
check(only.searches.length, 1)

console.log('searchHistory 확인 통과')
