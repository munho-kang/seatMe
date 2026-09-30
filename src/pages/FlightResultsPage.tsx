import { useNavigate, useSearchParams } from 'react-router'
import SelectableCard from '../components/SelectableCard'
import TabBar from '../components/TabBar'
import { FLIGHTS, getRouteTitle } from '../mocks/flights'
import './FlightResultsPage.css'

function FlightResultsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedFlight = searchParams.get('flight')

  function handleSelect(flightNumber: string) {
    const params = new URLSearchParams(searchParams)
    params.set('flight', flightNumber)
    // 뒤로 돌아왔을 때 선택한 카드가 보이도록 현재 목록 URL에도 선택값을 남긴다
    setSearchParams(params, { replace: true })
    navigate(`/flight/trip?${params}`)
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

      <TabBar />
    </main>
  )
}

export default FlightResultsPage
