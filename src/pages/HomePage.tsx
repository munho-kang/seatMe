import { useState } from 'react'
import { Link } from 'react-router'
import { getBookingLink } from '../booking'
import { AIRPORT_NAMES, formatPassengers } from '../mocks/flights'
import { frequentTrip, frequentTripUrl, getSearchHistory, kstToday, removeSearch, splitTrips, TIME_BAND_LABEL, tripParams } from '../searchHistory'
import type { SearchRecord } from '../../server/history/rules'
import TabBar from '../components/TabBar'
import { describeSeatProfile } from '../mocks/seatProfile'
import './HomePage.css'

const md = (date: string) => `${+date.slice(5, 7)}/${+date.slice(8)}`
// 요일은 'YYYY-MM-DD' 글자를 UTC로 풀어 구한다 (기기 시간대와 무관)
const mdw = (date: string) => `${md(date)}(${'일월화수목금토'[new Date(date + 'T00:00:00Z').getUTCDay()]})`
const route = ({ from, to }: { from: keyof typeof AIRPORT_NAMES; to: keyof typeof AIRPORT_NAMES }) => `${AIRPORT_NAMES[from]} → ${AIRPORT_NAMES[to]}`

function recentParams({ from, to, date, returnDate, passengers }: SearchRecord) {
  const params = new URLSearchParams({ from, to, date })
  if (returnDate) params.set('returnDate', returnDate)
  params.set('passengers', formatPassengers(passengers))
  return params
}

function HomePage() {
  const [history, setHistory] = useState(getSearchHistory)
  const today = kstToday()
  const recent = history.searches[0]
  const trip = splitTrips(history.trips, today).upcoming[0]
  const bookingUrl = trip && getBookingLink(tripParams(trip))?.url
  const frequent = frequentTrip(history, today)
  return (
    <main className="screen screen--tab-bar">
      <header className="screen-header screen-header--compact">
        <p className="logo">SeatME</p>
        <h1 className="screen-title">안녕하세요, 시트밍님</h1>
      </header>

      <div className="home-cards">
        <section className="home-card home-card--search">
          <h2 className="summary-card-title">어디로 떠나세요?</h2>
          <p className="home-card-desc">출발지 · 도착지 · 날짜만 고르면 저장된 취향으로 바로 추천해요.</p>
          <Link to="/flight" className="text-link home-search-link">
            항공편 찾기 &gt;
          </Link>
        </section>

        <section className="summary-card info-card--green">
          <h2 className="summary-card-title">내 Seat Profile</h2>
          <p className="summary-card-text">{describeSeatProfile()}</p>
          <button type="button" className="text-link summary-card-link">
            프로필 수정
          </button>
        </section>

        {recent && (
          <section className="home-card home-card--recent">
            <h2 className="home-card-label">최근 검색</h2>
            <button type="button" className="home-card-close" aria-label="최근 검색 지우기" onClick={() => setHistory(removeSearch(recent))}>
              ✕
            </button>
            <p className="home-recent-route">
              {route(recent)} · {md(recent.date)}
              {recent.returnDate && ` - ${md(recent.returnDate)}`} · {formatPassengers(recent.passengers)}
            </p>
            <Link to={`/flight?${recentParams(recent)}`} className="text-link summary-card-link">
              같은 취향으로 다시 찾기 &gt;
            </Link>
          </section>
        )}

        {trip && (
          <section className="home-card home-card--upcoming">
            <h2 className="home-card-label home-card-label--dim">다가오는 여행</h2>
            <p className="home-upcoming-trip">
              {mdw(trip.date)} {trip.airline} {trip.flight} {trip.dep}
            </p>
            <p className="home-card-desc">
              추천 좌석 {trip.seat} · {trip.score}점
            </p>
            {bookingUrl && (
              <a href={bookingUrl} target="_blank" rel="noreferrer" className="text-link summary-card-link">
                항공사에서 좌석 확인하기 &gt;
              </a>
            )}
          </section>
        )}

        {frequent && (
          <section className="home-card home-card--frequent">
            {/* 문구는 임시다 (디자인 확인) */}
            <h2 className="home-card-label">자주 가는 여행</h2>
            <p className="home-recent-route">
              {route(frequent)} · {formatPassengers(frequent.passengers)}
              {frequent.time && ` · ${TIME_BAND_LABEL[frequent.time]}`}
            </p>
            <Link to={frequentTripUrl(frequent)} className="text-link summary-card-link">
              {mdw(frequent.date)} 항공편 보기 &gt;
            </Link>
          </section>
        )}
      </div>

      <TabBar />
    </main>
  )
}

export default HomePage
