import { useNavigate, useSearchParams } from 'react-router'
import alertIcon from '../assets/icon-alert-large.svg'
import planeIcon from '../assets/icon-plane-large.svg'
import Button from '../components/Button'
import SelectableCard from '../components/SelectableCard'
import StatusMessage from '../components/StatusMessage'
import TabBar from '../components/TabBar'
import { getRouteTitle, type Flight } from '../mocks/flights'
import { useJson } from '../useJson'
import './FlightResultsPage.css'

const SKELETON_COUNT = 4

function formatSummaryDate(dateKey: string) {
  const [, month, day] = dateKey.split('-').map(Number)
  return `${month}월 ${day}일`
}

// 값이 없으면 Figma 기본값(9월 13일 · 성인 1명)을 쓴다
function getSearchDetail(searchParams: URLSearchParams) {
  const date = formatSummaryDate(searchParams.get('date') ?? '2026-09-13')
  const returnDate = searchParams.get('returnDate')
  const dateLabel = returnDate ? `${date} - ${formatSummaryDate(returnDate)}` : date
  return `${dateLabel} · ${searchParams.get('passengers') ?? '성인 1명'}`
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
  const { data, retry } = useJson<{ flights: Flight[] }>(`/api/flights?${query}`)
  const isLoading = data === undefined
  // 불러오는 중이거나 실패했으면 null
  const flights = data ? data.flights : null

  // 뒤로 돌아왔을 때 선택한 카드가 보이도록 선택값을 목록 URL에 남긴다.
  // 다음 화면들(추천 계산 · 좌석맵)이 서버를 다시 부르지 않도록 그 편의 시각 · 기종 · 좌석 배치도도 함께 싣는다
  function handleSelect(flight: Flight) {
    const params = new URLSearchParams(searchParams)
    const selection = {
      flight: flight.flightNumber,
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
      </header>

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
              {flight.aircraft ? `${flight.aircraft} 예정` : '기종 확인 중'} · {flight.duration}
            </span>
          </SelectableCard>
        ))}
      </div>

      {selectedFlight && selectedDeparture && (
        <footer className="screen-footer flight-list-footer">
          {/* 좌석 배치도가 없는 편("추천 준비 중")은 추천을 계산할 수 없어 넘어가지 못한다. 문구는 임시다 (디자인 확인) */}
          {searchParams.get('seatMap') ? (
            <Button onClick={() => navigate(`/flight/trip?${searchParams}`)}>다음</Button>
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
