import { useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import Button from '../components/Button'
import './auth.css'

function SignupPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '', passwordConfirm: '', nickname: '' })

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    navigate('/onboarding')
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
          value={form.email}
          onChange={handleChange}
        />
        <input
          className="text-field"
          type="password"
          name="password"
          placeholder="비밀번호 (최소 6자리 이상 입력)"
          value={form.password}
          onChange={handleChange}
        />
        <input
          className="text-field"
          type="password"
          name="passwordConfirm"
          placeholder="비밀번호 재확인"
          value={form.passwordConfirm}
          onChange={handleChange}
        />
        <input
          className="text-field"
          name="nickname"
          placeholder="닉네임"
          value={form.nickname}
          onChange={handleChange}
        />
        <Button type="submit" className="auth-submit">
          회원가입
        </Button>
      </form>

      <button type="button" className="text-link signup-browse">
        로그인 없이 둘러보기
      </button>
    </main>
  )
}

export default SignupPage
