import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import Button from '../components/Button'
import kakaoIcon from '../assets/social-kakao.png'
import appleIcon from '../assets/social-apple.png'
import naverIcon from '../assets/social-naver.png'
import './auth.css'

function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  // 서버가 로그인 쿠키를 주면 새로 불러와 계정 취향 · 기록을 받는다 (main.tsx). 계정에 취향이 있으면 홈, 없으면 온보딩
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSending(true)
    setError('')
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (response.ok) return window.location.assign('/login/done')
      // 문구는 임시다 (디자인 확인)
      setError(response.status === 401 ? '이메일 또는 비밀번호가 맞지 않아요.'
        : response.status === 429 ? '시도가 너무 많아요. 1분 뒤에 다시 해 주세요.'
        : '지금은 로그인할 수 없어요. 잠시 뒤에 다시 해 주세요.')
    } catch {
      setError('서버에 연결하지 못했어요. 잠시 뒤에 다시 해 주세요.')
    }
    setSending(false)
  }

  return (
    <main className="screen">
      <header className="screen-header">
        <p className="logo">SeatME</p>
        <h1 className="screen-title">로그인</h1>
      </header>

      <form className="auth-form auth-form--login" onSubmit={handleSubmit}>
        <input
          className="text-field"
          type="email"
          placeholder="이메일 아이디"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <input
          className="text-field"
          type="password"
          placeholder="비밀번호"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {error && <p className="auth-error" role="alert">{error}</p>}
        <Button type="submit" className="auth-submit" disabled={sending}>
          로그인
        </Button>
      </form>

      <Link className="text-link login-forgot" to="/password-reset">
        비밀번호를 잊으셨나요?
      </Link>

      <p className="login-divider">또는</p>

      <div className="login-social">
        <button type="button" className="login-social-button" aria-label="카카오로 로그인">
          <img src={kakaoIcon} alt="" width={50} height={50} />
        </button>
        <button type="button" className="login-social-button" aria-label="애플로 로그인">
          <img src={appleIcon} alt="" width={50} height={50} />
        </button>
        <button
          type="button"
          className="login-social-button"
          aria-label="네이버로 로그인"
          onClick={() => window.location.assign('/api/auth/naver')}
        >
          <img src={naverIcon} alt="" width={50} height={50} />
        </button>
      </div>

      <p className="login-signup">
        SeatMe가 처음이신가요?{'  '}
        <Link className="text-link" to="/signup">
          회원가입
        </Link>
      </p>

      <Link className="text-link auth-back" to="/">
        이전
      </Link>
    </main>
  )
}

export default LoginPage
