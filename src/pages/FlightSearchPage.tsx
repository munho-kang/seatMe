import { useState } from 'react'
import { useNavigate } from 'react-router'
import Button from '../components/Button'
import TabBar from '../components/TabBar'
import { AIRPORT_NAMES, type AirportCode } from '../mocks/flights'
import './FlightSearchPage.css'

// 날짜·인원 선택 UI는 Figma에 아직 없어서 디자인 값으로 고정한다
const SEARCH_DATE = '2026-09-13'
const PASSENGER_LABEL = '성인 1명'

const RECENT_ROUTES: [AirportCode, AirportCode][] = [
  ['GMP', 'CJU'],
  ['PUS', 'CJU'],
  ['GMP', 'PUS'],
]

function formatDate(date: string) {
  const [, month, day] = date.split('-').map(Number)
  return `${month}월 ${day}일`
}

function FlightSearchPage() {
  const navigate = useNavigate()
  const [[from, to], setRoute] = useState(RECENT_ROUTES[0])

  function handleSearch() {
    navigate(`/flight/results?${new URLSearchParams({ from, to, date: SEARCH_DATE })}`)
  }

  return (
    <main className="screen screen--tab-bar">
      <header className="screen-header screen-header--compact">
        <p className="logo">SeatME</p>
        <h1 className="screen-title">항공편 찾기</h1>
      </header>

      <div className="search-fields">
        <div className="search-field search-field--wide">
          <p className="search-field-label">출발</p>
          <p className="search-field-value">
            {AIRPORT_NAMES[from]} · {from}
          </p>
        </div>
        <div className="search-field search-field--wide">
          <p className="search-field-label">도착</p>
          <p className="search-field-value">
            {AIRPORT_NAMES[to]} · {to}
          </p>
        </div>
        <div className="search-field">
          <p className="search-field-label">날짜</p>
          <p className="search-field-value">{formatDate(SEARCH_DATE)}</p>
        </div>
        <div className="search-field">
          <p className="search-field-label">인원</p>
          <p className="search-field-value">{PASSENGER_LABEL}</p>
        </div>
      </div>

      <h2 className="recent-routes-title">최근 경로</h2>
      <div className="recent-routes">
        {RECENT_ROUTES.map((route) => (
          <button key={route.join('-')} type="button" className="recent-route" onClick={() => setRoute(route)}>
            {AIRPORT_NAMES[route[0]]}→{AIRPORT_NAMES[route[1]]}
          </button>
        ))}
      </div>

      <section className="summary-card info-card--blue search-profile">
        <h2 className="summary-card-title">내 Seat Profile 자동 적용</h2>
        <p className="summary-card-text">창가 선호 · 햇빛 5 · 조용함 4 · 흔들림 4</p>
        <button type="button" className="text-link summary-card-link">
          이번 여행만 바꾸기
        </button>
      </section>

      <footer className="screen-footer">
        <Button onClick={handleSearch}>항공편 검색</Button>
      </footer>

      <TabBar />
    </main>
  )
}

export default FlightSearchPage
