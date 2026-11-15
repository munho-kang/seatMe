// 검색 · 여행 기록 보관 확인. `npm test`로 돌린다. node에는 localStorage · 로그인이 없으므로 기록은 메모리에서만 돈다
import { getSearchHistory, kstToday, parseHistory, addSearch, addTrip, rateTrip, removeSearch, removeTrip } from './searchHistory.ts'
import { frequentTrip, frequentTripUrl, recentRoutes, searchPrefill, splitTrips, timeBand, tripParams } from './searchHistory.ts'
import type { Airport, FlightPick, History, SearchRecord, TripRecord } from '../server/history/rules.ts'
import { getBookingLink } from './booking.ts'

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

// --- 카드에 보일 값 계산 (순수 함수, 오늘은 2026-11-15 일요일로 고정) ---
const TODAY = '2026-11-15'
const one = { adult: 1, child: 0, infant: 0 }
const two = { adult: 2, child: 0, infant: 0 }
const s = (from: Airport, to: Airport, date: string, p = one): SearchRecord => ({ from, to, date, passengers: p, at: 1 })
const pick = (from: Airport, to: Airport, dep: string): FlightPick => ({ from, to, dep })
const hist = (searches: SearchRecord[], picks: FlightPick[] = [], trips: TripRecord[] = []): History => ({ searches, picks, trips })

check([timeBand('11:59'), timeBand('12:00'), timeBand('17:59'), timeBand('18:00')], ['morning', 'afternoon', 'afternoon', 'evening'])

check(frequentTrip(hist([s('GMP', 'CJU', '2026-11-20')]), TODAY), null)
check(frequentTrip(hist([]), TODAY), null)
check(frequentTrip(hist([s('GMP', 'CJU', '2026-11-20'), s('PUS', 'CJU', '2026-11-20'), s('GMP', 'CJU', '2026-11-27')]), TODAY),
  { from: 'GMP', to: 'CJU', date: '2026-11-20', passengers: one })
// 같은 수면 더 앞(최근)에 있는 노선
check(frequentTrip(hist([s('PUS', 'CJU', '2026-11-20'), s('GMP', 'CJU', '2026-11-20'), s('GMP', 'CJU', '2026-11-20'), s('PUS', 'CJU', '2026-11-20')]), TODAY)?.from, 'PUS')
// 그 요일이 오늘이면 다음 주 그날
check(frequentTrip(hist([s('GMP', 'CJU', '2026-11-08'), s('GMP', 'CJU', '2026-11-01')]), TODAY)?.date, '2026-11-22')
// 인원은 그 노선 가장 최근 검색 것, 요일 동점이면 가장 최근 검색의 요일 (11/21 토)
check(frequentTrip(hist([s('GMP', 'CJU', '2026-11-21', two), s('GMP', 'CJU', '2026-11-20')]), TODAY),
  { from: 'GMP', to: 'CJU', date: '2026-11-21', passengers: two })
// 시간대: pick 없으면 time 없음, 있으면 가장 많은 것
const two2 = hist([s('GMP', 'CJU', '2026-11-20'), s('GMP', 'CJU', '2026-11-20')])
const noPick = frequentTrip(two2, TODAY)!
check('time' in noPick, false)
check(frequentTripUrl(noPick), '/flight/results?from=GMP&to=CJU&date=2026-11-20&passengers=%EC%84%B1%EC%9D%B8+1%EB%AA%85')
const withPick = frequentTrip({ ...two2, picks: [pick('GMP', 'CJU', '14:10'), pick('GMP', 'CJU', '15:00'), pick('GMP', 'CJU', '08:00'), pick('PUS', 'CJU', '08:00')] }, TODAY)!
check(withPick.time, 'afternoon')
check(frequentTripUrl(withPick).endsWith('&time=afternoon'), true)
// 시간대 동점이면 가장 최근 pick
check(frequentTrip({ ...two2, picks: [pick('GMP', 'CJU', '19:00'), pick('GMP', 'CJU', '08:00')] }, TODAY)?.time, 'evening')
// 어느 요일을 검색했든 date는 today < date <= today + 7일
for (let i = 0; i < 7; i++) {
  const d = new Date(Date.parse('2026-11-16T00:00:00Z') + i * 86400_000).toISOString().slice(0, 10)
  const got = frequentTrip(hist([s('GMP', 'CJU', d), s('GMP', 'CJU', d)]), TODAY)!.date
  if (!(TODAY < got && got <= '2026-11-22')) throw new Error(`날짜 범위 밖 ${got}`)
  check(new Date(got + 'T00:00:00Z').getUTCDay(), new Date(d + 'T00:00:00Z').getUTCDay())
}

const t = (date: string, dep: string, flight = '7C115'): TripRecord => ({ ...s('GMP', 'CJU', date), airline: '제주항공', flight, dep, seat: '12A', score: 90 })
const yesterday = t('2026-11-14', '10:00'), today = t(TODAY, '10:00'), tomorrow = t('2026-11-16', '10:00')
const split = splitTrips([yesterday, tomorrow, today], TODAY)
check([split.upcoming, split.past], [[today, tomorrow], [yesterday]])
const late = t('2026-11-20', '14:10'), early = t('2026-11-20', '08:00', '7C111')
check(splitTrips([late, early], TODAY).upcoming, [early, late])
const oldA = t('2026-11-01', '10:00'), oldB = t('2026-11-08', '10:00')
check(splitTrips([oldA, oldB], TODAY).past, [oldB, oldA])

const q = (text: string) => searchPrefill(new URLSearchParams(text), TODAY)
check(q('from=GMP&to=CJU&date=2026-11-14&returnDate=2026-11-20&passengers=성인 2명'), { from: 'GMP', to: 'CJU', passengers: two })
check(q('from=GMP&to=CJU&date=2026-11-20&returnDate=2026-11-18'), { from: 'GMP', to: 'CJU', date: '2026-11-20' })
check(q('from=GMP&to=CJU&date=2026-11-20&returnDate=2026-11-22').returnDate, '2026-11-22')
check(q('from=ICN&to=CJU').from, undefined)
check(q('from=GMP&to=GMP'), {})
check(q('passengers=성인 12명').passengers, undefined)
check(q(''), {})

check(recentRoutes(hist([s('GMP', 'CJU', 'x'), s('GMP', 'CJU', 'x'), s('GMP', 'CJU', 'x'), s('PUS', 'CJU', 'x'), s('CJU', 'PUS', 'x')])),
  [['GMP', 'CJU'], ['PUS', 'CJU'], ['CJU', 'PUS']])
check(recentRoutes(hist([])), [])

// 예매 링크가 읽는 칸을 모두 채운다
const params = tripParams({ ...t('2026-11-20', '14:10'), passengers: two })
check([params.get('flight'), params.get('dep'), params.get('passengers'), params.get('date')], ['7C115', '14:10', '성인 2명', '2026-11-20'])
check(getBookingLink(params)?.prefilled, true)

console.log('searchHistory 확인 통과')
