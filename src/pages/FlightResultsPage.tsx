import { useNavigate, useSearchParams } from 'react-router'
import alertIcon from '../assets/icon-alert-large.svg'
import planeIcon from '../assets/icon-plane-large.svg'
import Button from '../components/Button'
import SelectableCard from '../components/SelectableCard'
import StatusMessage from '../components/StatusMessage'
import TabBar from '../components/TabBar'
import { getRouteTitle, type Flight } from '../flights'
import { legLabel, skipReturn, swapLeg } from '../roundTrip'
import { addPick, timeBand } from '../searchHistory'
import { useJson } from '../useJson'
import './FlightResultsPage.css'

const SKELETON_COUNT = 4

// 기종이 빈 이유(서버의 aircraftMissing)별로 카드에 적는 문구. 문구는 임시다 (디자인 확인)
const AIRCRAFT_MISSING = {
  NOT_YET: '기종은 출발 7일 전부터 나와요',
  FAILED: '기종을 불러오지 못했어요',
  NO_RECORD: '공항공사에 기종 정보가 없어요',
}

function formatSummaryDate(dateKey: string) {
  const [, month, day] = dateKey.split('-').map(Number)
  return `${month}월 ${day}일`
}

// 값이 없으면 Figma 기본값(9월 13일 · 성인 1명)을 쓴다. 왕복이면 지금 고르는 편(가는 편 · 오는 편)을 앞에 적는다
function getSearchDetail(searchParams: URLSearchParams) {
  const date = formatSummaryDate(searchParams.get('date') ?? '2026-09-13')
  const leg = legLabel(searchParams)
  return `${leg ? `${leg} · ` : ''}${date} · ${searchParams.get('passengers') ?? '성인 1명'}`
}

function FlightResultsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedFlight = searchParams.get('flight')
  const selectedDeparture = searchParams.get('dep')
  // 카드를 고르면 URL의 flight만 바뀌므로, 검색 조건(from·to·date)이 바뀔 때만 다시 불러온다
  const query = new URLSearchParams({
    from: searchParams.get('from') ?? '',
    to: searchParams.get('to') ?? '',
    date: searchParams.get('date') ?? '',
  }).toString()
  const { data, retry } = useJson<{ flights: Flight[]; aircraftMissing: keyof typeof AIRCRAFT_MISSING }>(`/api/flights?${query}`)
  const isLoading = data === undefined
  const missingText = data ? AIRCRAFT_MISSING[data.aircraftMissing] : ''
  // 왕복: 가는 편을 고르면 이 화면이 오는 편 목록으로 한 번 더 열린다 (src/roundTrip.ts)
  const isReturn = searchParams.get('leg') === 'return'
  const isRoundTrip = legLabel(searchParams) !== null
  // 당일 왕복이면 가는 편이 도착한 뒤에 떠나는 편만 보여 준다
  const outbound = new URLSearchParams(isReturn ? (searchParams.get('other') ?? '') : '')
  const earliest = outbound.get('date') === searchParams.get('date') ? outbound.get('arr') : null
  // 불러오는 중이거나 실패했으면 null
  const time = searchParams.get('time')
  const listed = data?.flights.filter((flight) => !earliest || flight.departureTime > earliest)
  const flights = listed
    ? time === 'morning' || time === 'afternoon' || time === 'evening'
      ? listed.toSorted((a, b) => Number(timeBand(b.departureTime) === time) - Number(timeBand(a.departureTime) === time))
      : listed
    : null

  // 뒤로 돌아왔을 때 선택한 카드가 보이도록 선택값을 목록 URL에 남긴다.
  // 다음 화면들(추천 계산 · 좌석맵)이 서버를 다시 부르지 않도록 그 편의 시각 · 기종 · 좌석 배치도도 함께 싣는다
  function handleSelect(flight: Flight) {
    const params = new URLSearchParams(searchParams)
    const selection = {
      flight: flight.flightNumber,
      airline: flight.airline,
      dep: flight.departureTime,
      arr: flight.arrivalTime,
      aircraft: flight.aircraft,
      aircraftCode: flight.aircraftCode,
      // 지금 볼 배치도(대표 후보)와 바꿔 볼 수 있는 후보 전체. 후보가 없는 편은 칸을 지운다
      seatMap: flight.seatMaps[0] ?? '',
      seatMaps: flight.seatMaps.join(','),
      seatMapConfirmed: String(flight.seatMapConfirmed),
    }
    for (const [key, value] of Object.entries(selection)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    setSearchParams(params, { replace: true })
  }

  // 기종을 못 불러온 편을 골랐을 때: 선택을 지우고 목록을 다시 받는다 (새 목록에서 다시 고른다)
  function handleRetry() {
    const params = new URLSearchParams(searchParams)
    params.delete('flight')
    params.delete('dep')
    setSearchParams(params, { replace: true })
    retry()
  }

  function handleNext() {
    addPick({ from: searchParams.get('from'), to: searchParams.get('to'), dep: selectedDeparture })
    // 왕복의 가는 편이면 오는 편 목록으로, 오는 편이면 가는 편으로 되돌려 여행 설정으로 (좌석은 가는 편부터 고른다)
    if (isRoundTrip && !isReturn) navigate(`/flight/results?${swapLeg(searchParams)}`)
    else navigate(`/flight/trip?${isReturn ? swapLeg(searchParams) : searchParams}`)
  }

  // 오는 편 목록에만 있다. 오는 편은 추천을 못 받는 날이 많다 (기종은 출발 7일 전부터 나온다). 문구는 임시다 (디자인 확인)
  const handleSkip = () => navigate(`/flight/trip?${skipReturn(searchParams)}`)
  const skipButton = isReturn && (
    <Button size="pill" variant="outline" onClick={handleSkip}>
      가는 편만 추천받기
    </Button>
  )

  if (!flights?.length) {
    return (
      <main className="screen screen--status">
        <header className="status-header">
          <p className="logo">SeatME</p>
          <h1 className="status-heading">항공편 검색 결과</h1>
        </header>

        <div className="route-summary">
          <p className="route-summary-route">{getRouteTitle(searchParams)}</p>
          <p className="route-summary-detail">{getSearchDetail(searchParams)}</p>
        </div>

        {isLoading ? (
          <section className="flight-loading" aria-busy="true">
            <h2 className="flight-loading-title">항공편을 불러오고 있어요</h2>
            {Array.from({ length: SKELETON_COUNT }, (_, index) => (
              <div key={index} className="flight-skeleton">
                <span className="flight-skeleton-lines">
                  <span className="flight-skeleton-line" />
                  <span className="flight-skeleton-line flight-skeleton-line--short" />
                </span>
                <span className="flight-skeleton-badge" />
              </div>
            ))}
          </section>
        ) : flights ? (
          <StatusMessage icon={planeIcon} title="이 날은 항공편이 없어요" description="다른 날짜로 다시 검색해 보세요">
            <Button size="pill" onClick={() => navigate('/flight')}>
              날짜 바꾸기
            </Button>
            {skipButton}
          </StatusMessage>
        ) : (
          <StatusMessage
            icon={alertIcon}
            title="항공편을 불러오지 못했어요"
            description="인터넷 연결을 확인한 뒤 다시 시도해 주세요"
          >
            <Button size="pill" onClick={retry}>
              다시 시도
            </Button>
            <Button size="pill" variant="outline" onClick={() => navigate('/flight')}>
              검색 조건 바꾸기
            </Button>
            {skipButton}
          </StatusMessage>
        )}

        <TabBar />
      </main>
    )
  }

  return (
    <main className="screen screen--tab-bar">
      <header className="screen-header screen-header--route">
        <p className="logo">SeatME</p>
        <h1 className="screen-title screen-title--route">{getRouteTitle(searchParams)}</h1>
        {isRoundTrip && <p className="screen-caption">{getSearchDetail(searchParams)}</p>}
      </header>

      {isReturn && (
        <button type="button" className="text-link flight-skip" onClick={handleSkip}>
          오는 편 없이 가는 편만 추천받기
        </button>
      )}

      <div className="flight-list">
        {flights.map((flight) => (
          <SelectableCard
            // 같은 편명이 하루 두 번 운항할 수 있어 출발 시각까지 붙인다 (선택 표시도 편명 + 출발 시각으로 비교한다)
            key={flight.flightNumber + flight.departureTime}
            className="flight-card"
            isSelected={selectedFlight === flight.flightNumber && selectedDeparture === flight.departureTime}
            onSelect={() => handleSelect(flight)}
          >
            <span className="flight-card-badge">{flight.seatMapReady ? 'SeatMe 추천 가능' : '추천 준비 중'}</span>
            <span className="flight-card-airline">
              {flight.airline} {flight.flightNumber}
            </span>
            <span className="flight-card-time">
              {flight.departureTime} → {flight.arrivalTime}
            </span>
            <span className="flight-card-meta">
              {flight.aircraft ? `${flight.aircraft} 예정` : missingText} · {flight.duration}
            </span>
          </SelectableCard>
        ))}
      </div>

      {selectedFlight && selectedDeparture && (
        <footer className="screen-footer flight-list-footer">
          {/* 좌석 배치도가 없는 편("추천 준비 중")은 추천을 계산할 수 없어 넘어가지 못한다. 문구는 임시다 (디자인 확인) */}
          {searchParams.get('seatMap') ? (
            <Button onClick={handleNext}>{isRoundTrip && !isReturn ? '오는 편 고르기' : '다음'}</Button>
          ) : !searchParams.get('aircraft') && data?.aircraftMissing === 'FAILED' ? (
            <Button onClick={handleRetry}>기종 정보 다시 불러오기</Button>
          ) : (
            <Button disabled>이 항공편은 아직 추천을 준비 중이에요</Button>
          )}
        </footer>
      )}

      <TabBar />
    </main>
  )
}

export default FlightResultsPage
