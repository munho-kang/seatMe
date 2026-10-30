import { useNavigate, useSearchParams } from 'react-router'
import Button from '../components/Button'
import TabBar from '../components/TabBar'
import './SeatMapPage.css'

// Figma(2014:1096) mock 좌석맵. 추천 좌석은 비교표와 같은 12A/11A/14A다 (DESIGN.md §9 #25)
const ROWS = [9, 10, 11, 12, 13, 14, 15]
const LEFT_COLUMNS = ['A', 'B', 'C']
const RIGHT_COLUMNS = ['D', 'E', 'F']
const RECOMMENDED_SEATS = ['12A', '11A', '14A']

function SeatMapPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const seatParam = searchParams.get('seat')
  const selectedSeat = seatParam && RECOMMENDED_SEATS.includes(seatParam) ? seatParam : RECOMMENDED_SEATS[0]

  function handleSelect(seat: string) {
    const params = new URLSearchParams(searchParams)
    params.set('seat', seat)
    setSearchParams(params, { replace: true })
  }

  function handleDetail() {
    const params = new URLSearchParams(searchParams)
    params.set('seat', selectedSeat)
    navigate(`/recommend/seat?${params}`)
  }

  function renderSeat(row: number, column: string) {
    const seat = `${row}${column}`
    if (!RECOMMENDED_SEATS.includes(seat)) {
      return (
        <span key={seat} className="seat">
          {column}
        </span>
      )
    }
    const isSelected = seat === selectedSeat
    return (
      <button
        key={seat}
        type="button"
        className={`seat ${isSelected ? 'seat--selected' : 'seat--recommended'}`}
        aria-label={`추천 좌석 ${seat}`}
        aria-pressed={isSelected}
        onClick={() => handleSelect(seat)}
      >
        {column}
      </button>
    )
  }

  return (
    <main className="screen screen--tab-bar">
      <header className="screen-header seat-map-header">
        <p className="logo">SeatME</p>
        <h1 className="screen-title screen-title--route">B737-8 좌석맵</h1>
      </header>

      <section className="seat-map">
        <p className="seat-map-front">▲ FRONT / 출입문</p>
        <div className="seat-map-rows">
          {ROWS.map((row) => (
            <div key={row} className="seat-row">
              <span className="seat-row-number">{row}</span>
              {LEFT_COLUMNS.map((column) => renderSeat(row, column))}
              <span className="seat-aisle" />
              {RIGHT_COLUMNS.map((column) => renderSeat(row, column))}
            </div>
          ))}
        </div>
        <p className="seat-map-wing">날개 영역  11–14열</p>
      </section>

      <footer className="screen-footer">
        <Button onClick={handleDetail}>{selectedSeat} 자세히 보기</Button>
      </footer>

      <TabBar />
    </main>
  )
}

export default SeatMapPage
