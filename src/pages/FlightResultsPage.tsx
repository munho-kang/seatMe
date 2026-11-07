import { useNavigate, useSearchParams } from 'react-router'
import alertIcon from '../assets/icon-alert-large.svg'
import Button from '../components/Button'
import SelectableCard from '../components/SelectableCard'
import StatusMessage from '../components/StatusMessage'
import TabBar from '../components/TabBar'
import { FLIGHTS, getRouteTitle } from '../mocks/flights'
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
  // API 연결 전까지 ?status=loading, ?status=error로 상태 화면을 확인한다
  const status = searchParams.get('status')

  function handleRetry() {
    const params = new URLSearchParams(searchParams)
    params.delete('status')
    setSearchParams(params, { replace: true })
  }

  // 뒤로 돌아왔을 때 선택한 카드가 보이도록 선택값을 목록 URL에 남긴다
  function handleSelect(flightNumber: string) {
    const params = new URLSearchParams(searchParams)
    params.set('flight', flightNumber)
    setSearchParams(params, { replace: true })
  }

  if (status === 'loading' || status === 'error') {
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

        {status === 'loading' ? (
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
        ) : (
          <StatusMessage
            icon={alertIcon}
            title="항공편을 불러오지 못했어요"
            description="인터넷 연결을 확인한 뒤 다시 시도해 주세요"
          >
            <Button size="pill" onClick={handleRetry}>
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
        {FLIGHTS.map((flight) => (
          <SelectableCard
            key={flight.flightNumber}
            className="flight-card"
            isSelected={selectedFlight === flight.flightNumber}
            onSelect={() => handleSelect(flight.flightNumber)}
          >
            <span className="flight-card-badge">SeatMe 추천 가능</span>
            <span className="flight-card-airline">
              {flight.airline} {flight.flightNumber}
            </span>
            <span className="flight-card-time">
              {flight.departureTime} → {flight.arrivalTime}
            </span>
            <span className="flight-card-meta">
              {flight.aircraft} 예정 · {flight.duration}
            </span>
          </SelectableCard>
        ))}
      </div>

      {selectedFlight && (
        <footer className="screen-footer flight-list-footer">
          <Button onClick={() => navigate(`/flight/trip?${searchParams}`)}>다음</Button>
        </footer>
      )}

      <TabBar />
    </main>
  )
}

export default FlightResultsPage
