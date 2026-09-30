import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import Button from '../components/Button'
import kakaoIcon from '../assets/social-kakao.png'
import appleIcon from '../assets/social-apple.png'
import naverIcon from '../assets/social-naver.png'
import './auth.css'

function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    navigate('/onboarding')
  }

  return (
    <main className="screen">
      <header className="screen-header">
        <p className="logo">SeatME</p>
        <h1 className="screen-title">이메일 로그인</h1>
      </header>

      <form className="auth-form auth-form--login" onSubmit={handleSubmit}>
        <input
          className="text-field"
          type="email"
          placeholder="이메일 아이디"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <input
          className="text-field"
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Button type="submit" className="auth-submit">
          로그인
        </Button>
      </form>

      <button type="button" className="text-link login-forgot">
        비밀번호를 잊으셨나요?
      </button>

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
          onClick={() => navigate('/login/naver')}
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
    </main>
  )
}

export default LoginPage
