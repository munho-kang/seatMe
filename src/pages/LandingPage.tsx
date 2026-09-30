import { Link, useNavigate } from 'react-router'
import Button from '../components/Button'
import './auth.css'

function LandingPage() {
  const navigate = useNavigate()

  return (
    <main className="screen">
      <header className="screen-header">
        <p className="logo">SeatME</p>
        <h1 className="screen-title">내 좌석 취향을 다음 여행에도 그대로</h1>
        <p className="screen-desc">
          로그인하면 Seat Profile, 최근 검색, 내 여행을 저장해서 매번 처음부터 설정하지 않아도 돼요.
        </p>
      </header>

      <div className="landing-cards">
        <ul className="info-card info-card--blue">
          <li>✓ 나의 좌석 취향 저장</li>
          <li>✓ 최근 노선 한 번에 다시 검색</li>
          <li>✓ 이전 추천과 여행 기록 확인</li>
        </ul>
        <div className="info-card info-card--green">
          <p>저장된 Seat Profile 예시</p>
          <p>창가 선호 · 햇빛 5 · 조용함 4 · 흔들림 4</p>
          <p className="info-card-note">다음 여행에서는 이 설정을 자동으로 불러와요.</p>
        </div>
      </div>

      <footer className="screen-footer">
        <Button onClick={() => navigate('/login/naver')}>네이버로 계속하기</Button>
        <Button variant="outline" onClick={() => navigate('/login')}>
          이메일로  로그인
        </Button>
        <p className="landing-links">
          <Link className="text-link" to="/signup">
            처음이라면 회원가입
          </Link>
          {'  ·  '}
          <button type="button" className="text-link">
            로그인 없이 둘러보기
          </button>
        </p>
      </footer>
    </main>
  )
}

export default LandingPage
