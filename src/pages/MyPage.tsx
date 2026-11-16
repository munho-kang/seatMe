import { useRef } from 'react'
import { Link, useNavigate } from 'react-router'
import Button from '../components/Button'
import TabBar from '../components/TabBar'
import { flushSearchHistory, forgetAccountHistory } from '../searchHistory'
import { accountNickname, forgetAccountProfile, getSeatProfile, isLoggedIn, SEAT_POSITION_SHORT } from '../mocks/seatProfile'
import './MyPage.css'

// 인증 API 전까지 쓰는 Figma(2014:1626) mock 메뉴 값
const SERVICE_MENUS = [
  { label: '공지사항', value: '>' },
  { label: '문의하기', value: '>' },
  { label: '약관 및 개인정보', value: '>' },
  { label: '앱 버전', value: 'v1.0.0' },
]

function MyPage() {
  const navigate = useNavigate()
  const logoutDialogRef = useRef<HTMLDialogElement>(null)
  const profile = getSeatProfile()
  const loggedIn = isLoggedIn()
  const nickname = accountNickname()

  async function handleLogout() {
    await flushSearchHistory() // 마지막 변경이 계정에 닿은 뒤에 로그아웃한다
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // 서버에 닿지 않아도 화면에서는 로그아웃한다
    }
    forgetAccountProfile()
    forgetAccountHistory()
    navigate('/')
  }

  return (
    <main className="screen screen--tab-bar">
      <header>
        <p className="logo">SeatME</p>
        <h1 className="screen-title screen-title--section">마이</h1>
      </header>

      <section className="account-header">
        {/* 이름은 네이버에서 받지 않는다 (이용자 식별자만). 닉네임이 있으면 이메일 계정이다. 문구는 임시다 (디자인 확인) */}
        <div>
          <p className="account-name">{!loggedIn ? '로그인 안 함' : nickname ?? '네이버 회원'}</p>
          <p className="account-provider">
            {!loggedIn ? 'Seat Profile이 이 기기에만 저장돼요' : nickname !== null ? '이메일 계정으로 로그인됨' : '네이버 계정으로 로그인됨'}
          </p>
        </div>
        {loggedIn ? (
          <button type="button" className="text-link account-manage">
            계정 관리
          </button>
        ) : (
          <Link to="/" className="text-link account-manage">
            로그인
          </Link>
        )}
      </section>

      <h2 className="menu-section-label">개인화</h2>
      <div className="menu-list">
        <Link to="/my/profile" className="menu-row">
          <span className="menu-row-label">Seat Profile 관리</span>
          <span className="menu-row-value">
            {SEAT_POSITION_SHORT[profile.seatPosition]} · 햇빛 {profile.sunlight} &gt;
          </span>
        </Link>
        <div className="menu-row">
          <span className="menu-row-label">최근 검색 기록</span>
          <span className="menu-row-value">3개</span>
        </div>
        <div className="menu-row">
          <span className="menu-row-label">알림 설정</span>
          <span className="menu-row-value">ON</span>
        </div>
      </div>

      <h2 className="menu-section-label menu-section-label--service">서비스</h2>
      <div className="menu-list menu-list--service">
        {SERVICE_MENUS.map((menu) => (
          <div key={menu.label} className="menu-row">
            <span className="menu-row-label">{menu.label}</span>
            <span className="menu-row-value">{menu.value}</span>
          </div>
        ))}
        {loggedIn && (
          <button type="button" className="menu-row menu-row--danger" onClick={() => logoutDialogRef.current?.showModal()}>
            <span className="menu-row-label">로그아웃</span>
            <span className="menu-row-value">&gt;</span>
          </button>
        )}
      </div>

      <dialog ref={logoutDialogRef} className="logout-modal" aria-labelledby="logout-modal-title">
        <h2 id="logout-modal-title" className="logout-modal-title">
          로그아웃할까요?
        </h2>
        <p className="logout-modal-desc">
          로그아웃해도 저장된 Seat Profile은 계정에 유지돼요.
          <br />
          다시 로그인하면 그대로 불러올 수 있어요.
        </p>
        <div className="logout-modal-actions">
          <Button variant="danger" className="logout-modal-button" onClick={handleLogout}>
            로그아웃
          </Button>
          <Button
            variant="outline"
            className="logout-modal-button logout-modal-cancel"
            onClick={() => logoutDialogRef.current?.close()}
          >
            취소
          </Button>
        </div>
      </dialog>

      <TabBar />
    </main>
  )
}

export default MyPage
