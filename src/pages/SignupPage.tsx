import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router'
import Button from '../components/Button'
import './auth.css'

function SignupPage() {
  const [form, setForm] = useState({ email: '', password: '', passwordConfirm: '', nickname: '' })
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  // 가입하면 서버가 바로 로그인 쿠키를 준다. 새로 불러와 /login/done이 온보딩(기기 취향이 있으면 계정으로 옮기고 홈)으로 보낸다
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // 문구는 임시다 (디자인 확인)
    if (form.password !== form.passwordConfirm) return setError('비밀번호가 서로 달라요.')
    setSending(true)
    setError('')
    try {
      const { email, password, nickname } = form
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, nickname }),
      })
      if (response.ok) return window.location.assign('/login/done')
      setError(response.status === 409 ? '이미 가입한 이메일이에요. 로그인해 주세요.'
        : response.status === 400 ? '입력한 값을 다시 확인해 주세요.'
        : response.status === 429 ? '시도가 너무 많아요. 1분 뒤에 다시 해 주세요.'
        : '지금은 가입할 수 없어요. 잠시 뒤에 다시 해 주세요.')
    } catch {
      setError('서버에 연결하지 못했어요. 잠시 뒤에 다시 해 주세요.')
    }
    setSending(false)
  }

  return (
    <main className="screen">
      <header className="screen-header">
        <p className="logo">SeatME</p>
        <h1 className="screen-title">회원가입</h1>
      </header>

      <form className="auth-form auth-form--signup" onSubmit={handleSubmit}>
        <input
          className="text-field"
          type="email"
          name="email"
          placeholder="이메일 아이디"
          autoComplete="email"
          required
          value={form.email}
          onChange={handleChange}
        />
        <input
          className="text-field"
          type="password"
          name="password"
          placeholder="비밀번호 (최소 6자리 이상 입력)"
          autoComplete="new-password"
          required
          minLength={6}
          maxLength={128}
          value={form.password}
          onChange={handleChange}
        />
        <input
          className="text-field"
          type="password"
          name="passwordConfirm"
          placeholder="비밀번호 재확인"
          autoComplete="new-password"
          required
          value={form.passwordConfirm}
          onChange={handleChange}
        />
        <input
          className="text-field"
          name="nickname"
          placeholder="닉네임"
          autoComplete="nickname"
          required
          maxLength={20}
          value={form.nickname}
          onChange={handleChange}
        />
        {error && <p className="auth-error" role="alert">{error}</p>}
        <Button type="submit" className="auth-submit" disabled={sending}>
          회원가입
        </Button>
      </form>

      <Link className="text-link signup-browse" to="/home">
        로그인 없이 둘러보기
      </Link>

      <Link className="text-link auth-back" to="/">
        이전
      </Link>
    </main>
  )
}

export default SignupPage
