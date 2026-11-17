import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import Button from '../components/Button'
import TabBar from '../components/TabBar'
import { flushSearchHistory, forgetAccountHistory } from '../searchHistory'
import { accountNickname, forgetAccountProfile, getSeatProfile, isLoggedIn, SEAT_POSITION_SHORT } from '../seatProfile'
import './MyPage.css'
import './auth.css'

// Figma(2014:1626)의 예시 메뉴 값. 눌러도 동작이 없다
const SERVICE_MENUS = [
  { label: '공지사항', value: '>' },
  { label: '문의하기', value: '>' },
  { label: '앱 버전', value: 'v1.0.0' },
]

function MyPage() {
  const navigate = useNavigate()
  const logoutDialogRef = useRef<HTMLDialogElement>(null)
  const withdrawDialogRef = useRef<HTMLDialogElement>(null)
  const [withdrawError, setWithdrawError] = useState('')
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

  // 계정의 취향 · 기록 · 이메일 계정을 서버에서 지운다. 이 기기에 남은 것(로그인 전 취향 등)은 그대로 둔다
  async function handleWithdraw() {
    setWithdrawError('')
    try {
      const response = await fetch('/api/auth/withdraw', { method: 'POST' })
      if (!response.ok) throw new Error(String(response.status))
    } catch {
      return setWithdrawError('지금은 탈퇴할 수 없어요. 잠시 뒤에 다시 해 주세요.') // 문구는 임시다 (디자인 확인)
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
        <Link to="/privacy" className="menu-row">
          <span className="menu-row-label">개인정보 처리방침</span>
          <span className="menu-row-value">&gt;</span>
        </Link>
        {loggedIn && (
          <button type="button" className="menu-row menu-row--danger" onClick={() => logoutDialogRef.current?.showModal()}>
            <span className="menu-row-label">로그아웃</span>
            <span className="menu-row-value">&gt;</span>
          </button>
        )}
        {loggedIn && (
          <button type="button" className="menu-row menu-row--danger" onClick={() => withdrawDialogRef.current?.showModal()}>
            <span className="menu-row-label">회원 탈퇴</span>
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

      {/* 로그아웃 창과 같은 모양. 문구는 임시다 (디자인 확인) */}
      <dialog ref={withdrawDialogRef} className="logout-modal" aria-labelledby="withdraw-modal-title">
        <h2 id="withdraw-modal-title" className="logout-modal-title">
          탈퇴할까요?
        </h2>
        <p className="logout-modal-desc">
          계정에 저장한 Seat Profile과 검색 · 여행 기록이 바로 지워지고
          <br />
          되돌릴 수 없어요.
        </p>
        {withdrawError && <p className="auth-error" role="alert">{withdrawError}</p>}
        <div className="logout-modal-actions">
          <Button variant="danger" className="logout-modal-button" onClick={handleWithdraw}>
            탈퇴하기
          </Button>
          <Button
            variant="outline"
            className="logout-modal-button logout-modal-cancel"
            onClick={() => withdrawDialogRef.current?.close()}
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
