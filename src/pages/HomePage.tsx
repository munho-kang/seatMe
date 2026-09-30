import { Link } from 'react-router'
import TabBar from '../components/TabBar'
import './HomePage.css'

function HomePage() {
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
          <p className="summary-card-text">창가 선호 · 햇빛 5 · 조용함 4 · 흔들림 4</p>
          <button type="button" className="text-link summary-card-link">
            프로필 수정
          </button>
        </section>

        <section className="home-card home-card--recent">
          <h2 className="home-card-label">최근 검색</h2>
          <p className="home-recent-route">김포 → 제주 · 오후 출발</p>
          <Link to="/flight" className="text-link summary-card-link">
            같은 취향으로 다시 찾기
          </Link>
        </section>

        <section className="home-card home-card--upcoming">
          <h2 className="home-card-label home-card-label--dim">다가오는 여행</h2>
          <p className="home-upcoming-trip">9/25 제주항공 7C115 · 추천 좌석 12A</p>
        </section>
      </div>

      <TabBar />
    </main>
  )
}

export default HomePage
