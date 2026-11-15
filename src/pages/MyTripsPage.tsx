import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { getBookingLink } from '../booking'
import { AIRPORT_NAMES, formatPassengers } from '../mocks/flights'
import { frequentTrip, frequentTripUrl, getSearchHistory, kstToday, rateTrip, removeTrip, splitTrips, tripParams } from '../searchHistory'
import type { TripRecord } from '../../server/history/rules'
import planeIcon from '../assets/icon-plane-large.svg'
import Button from '../components/Button'
import StatusMessage from '../components/StatusMessage'
import TabBar from '../components/TabBar'
import './MyTripsPage.css'

const md = (date: string) => `${+date.slice(5, 7)}월 ${+date.slice(8)}일`
const route = ({ from, to }: TripRecord) => `${AIRPORT_NAMES[from]} → ${AIRPORT_NAMES[to]}`

function TripCard({ trip, isUpcoming, onRemove, onRate }: { trip: TripRecord; isUpcoming: boolean; onRemove: () => void; onRate: (rating: number) => void }) {
  const bookingUrl = isUpcoming ? getBookingLink(tripParams(trip))?.url : undefined
  const searchParams = new URLSearchParams({ from: trip.from, to: trip.to, passengers: formatPassengers(trip.passengers) })
  return (
    <article className={`trip-card${isUpcoming ? ' trip-card--upcoming' : ''}`}>
      <h3 className="trip-card-title">
        {route(trip)} · {trip.airline} {trip.flight}
      </h3>
      <button type="button" className="trip-card-close" aria-label="여행 기록 지우기" onClick={onRemove}>
        ✕
      </button>
      <p className="trip-card-date">
        {md(trip.date)} {trip.dep}
      </p>
      <p className="trip-card-seat">
        추천 좌석  {trip.seat} · 적합도 {trip.score}점
      </p>
      {!isUpcoming && (
        <div className="trip-card-rating">
          <span>만족도</span>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" className="trip-star" aria-label={`만족도 ${n}점`} aria-pressed={n <= (trip.rating ?? 0)} onClick={() => onRate(n)}>
              {n <= (trip.rating ?? 0) ? '★' : '☆'}
            </button>
          ))}
          {/* 문구는 임시다 (디자인 확인) */}
          <span>{trip.rating ? `${trip.rating}/5` : '만족도를 남겨 주세요'}</span>
        </div>
      )}
      {isUpcoming ? (
        bookingUrl && (
          <a href={bookingUrl} target="_blank" rel="noreferrer" className="text-link trip-card-action">
            항공사에서 좌석 확인하기
          </a>
        )
      ) : (
        <Link to={`/flight?${searchParams}`} className="text-link trip-card-action">
          같은 취향으로 다시 검색
        </Link>
      )}
    </article>
  )
}

function MyTripsPage() {
  const navigate = useNavigate()
  const [history, setHistory] = useState(getSearchHistory)
  const today = kstToday()
  const { upcoming, past } = splitTrips(history.trips, today)
  const frequent = frequentTrip(history, today)

  if (!upcoming.length && !past.length) {
    return (
      <main className="screen screen--status">
        <header className="status-header">
          <p className="logo">SeatME</p>
          <h1 className="status-heading">지난 여행</h1>
        </header>

        <StatusMessage
          icon={planeIcon}
          title="아직 지난 여행이 없어요"
          description="항공편을 찾고 좌석을 고르면 여기에 기록돼요"
        >
          <Button size="pill" onClick={() => navigate('/flight')}>
            항공편 찾기
          </Button>
        </StatusMessage>

        <TabBar />
      </main>
    )
  }

  const section = (label: string, trips: TripRecord[], isUpcoming: boolean) =>
    trips.length > 0 && (
      <section className={`trip-section${isUpcoming ? '' : ' trip-section--past'}`}>
        <h2 className="trip-section-label">{label}</h2>
        {trips.map((trip) => (
          <TripCard
            key={`${trip.flight}${trip.date}${trip.dep}`}
            trip={trip}
            isUpcoming={isUpcoming}
            onRemove={() => setHistory(removeTrip(trip))}
            onRate={(rating) => setHistory(rateTrip(trip, rating))}
          />
        ))}
      </section>
    )

  return (
    <main className="screen screen--tab-bar">
      <header>
        <p className="logo">SeatME</p>
        <h1 className="screen-title screen-title--section">내 여행</h1>
        <p className="screen-sub">추천받았던 좌석과 지난 여행을 다시 확인할 수 있어요.</p>
      </header>

      {section('다가오는 여행', upcoming, true)}
      {section('지난 여행', past, false)}

      <Link to={frequent ? frequentTripUrl(frequent) : '/flight'} className="text-link trip-new-link">
        최근 노선으로 새 여행 만들기  →
      </Link>

      <TabBar />
    </main>
  )
}

export default MyTripsPage
