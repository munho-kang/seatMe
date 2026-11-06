import { Link, useNavigate, useSearchParams } from 'react-router'
import planeIcon from '../assets/icon-plane-large.svg'
import Button from '../components/Button'
import StatusMessage from '../components/StatusMessage'
import TabBar from '../components/TabBar'
import './MyTripsPage.css'

type Trip = {
  title: string
  date: string
  seat: string
  action: string
  actionTo?: string
}

// 여행 기록 API 전까지 쓰는 Figma(2014:1446) mock 데이터
const UPCOMING_TRIP: Trip = {
  title: '김포 → 제주 · 제주항공 7C115',
  date: '9월 25일 14:10',
  seat: '추천 좌석  12A · 적합도 92점',
  action: '항공사에서 좌석 확인하기',
}

const PAST_TRIPS: Trip[] = [
  {
    title: '부산 → 제주 · 진에어 LJ563',
    date: '8월 28일 15:00',
    seat: '추천 좌석  9A · 만족도 4.5/5',
    action: '같은 취향으로 다시 검색',
    actionTo: '/flight',
  },
  {
    title: '제주 → 김포 · 에어부산 BX8012',
    date: '8월 10일 11:30',
    seat: '추천 좌석  7F · 만족도 4.0/5',
    action: '추천 기준 다시 보기',
  },
]

function TripCard({ trip, isUpcoming = false }: { trip: Trip; isUpcoming?: boolean }) {
  return (
    <article className={`trip-card${isUpcoming ? ' trip-card--upcoming' : ''}`}>
      <h3 className="trip-card-title">{trip.title}</h3>
      <p className="trip-card-date">{trip.date}</p>
      <p className="trip-card-seat">{trip.seat}</p>
      {trip.actionTo ? (
        <Link to={trip.actionTo} className="text-link trip-card-action">
          {trip.action}
        </Link>
      ) : (
        <button type="button" className="text-link trip-card-action">
          {trip.action}
        </button>
      )}
    </article>
  )
}

function MyTripsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // 여행 기록 API 연결 전까지 ?status=empty로 빈 화면을 확인한다
  if (searchParams.get('status') === 'empty') {
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

  return (
    <main className="screen screen--tab-bar">
      <header>
        <p className="logo">SeatME</p>
        <h1 className="screen-title screen-title--section">내 여행</h1>
        <p className="screen-sub">추천받았던 좌석과 지난 여행을 다시 확인할 수 있어요.</p>
      </header>

      <section className="trip-section">
        <h2 className="trip-section-label">다가오는 여행</h2>
        <TripCard trip={UPCOMING_TRIP} isUpcoming />
      </section>

      <section className="trip-section trip-section--past">
        <h2 className="trip-section-label">지난 여행</h2>
        {PAST_TRIPS.map((trip) => (
          <TripCard key={trip.title} trip={trip} />
        ))}
      </section>

      <Link to="/flight" className="text-link trip-new-link">
        최근 노선으로 새 여행 만들기  →
      </Link>

      <TabBar />
    </main>
  )
}

export default MyTripsPage
