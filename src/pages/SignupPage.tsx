import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router'
import Button from '../components/Button'
import './auth.css'

// 회원가입(/signup)과 비밀번호 찾기(/password-reset, reset)는 같은 모양이다: 이메일 → 메일로 온 6자리 인증번호 → 비밀번호.
// 인증번호가 있어야 가입 · 비밀번호 바꾸기가 된다 — 남의 이메일로 먼저 가입하지 못하게 (server/auth/email.ts)
// 문구는 모두 임시다 (디자인 확인)
function SignupPage({ reset = false }: { reset?: boolean }) {
  const [form, setForm] = useState({ email: '', code: '', password: '', passwordConfirm: '', nickname: '' })
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [sending, setSending] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSendCode() {
    if (!emailRef.current?.reportValidity()) return
    setSending(true)
    setError('')
    setNote('')
    try {
      const response = await fetch('/api/auth/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, purpose: reset ? 'reset' : 'signup' }),
      })
      if (response.ok) {
        setCodeSent(true)
        setNote(`${form.email.trim()}(으)로 6자리 인증번호를 보냈어요. 10분 안에 넣어 주세요. 메일이 안 보이면 스팸함도 확인해 주세요.`)
      } else {
        setError(response.status === 409 ? '이미 가입한 이메일이에요. 로그인하거나 비밀번호 찾기를 해 주세요.'
          : response.status === 404 ? '가입하지 않은 이메일이에요.'
          : response.status === 400 ? '이메일 주소를 다시 확인해 주세요.'
          : response.status === 429 ? '인증번호는 1분에 한 번 받을 수 있어요. 잠시 뒤에 다시 해 주세요.'
          : '지금은 인증번호를 보낼 수 없어요. 잠시 뒤에 다시 해 주세요.')
      }
    } catch {
      setError('서버에 연결하지 못했어요. 잠시 뒤에 다시 해 주세요.')
    }
    setSending(false)
  }

  // 성공하면 서버가 바로 로그인 쿠키를 준다. 새로 불러와 /login/done이 홈 또는 온보딩으로 보낸다
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!codeSent) return setError('먼저 인증번호를 받아 주세요.')
    if (form.password !== form.passwordConfirm) return setError('비밀번호가 서로 달라요.')
    setSending(true)
    setError('')
    try {
      const { email, code, password, nickname } = form
      const response = await fetch(reset ? '/api/auth/reset' : '/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reset ? { email, code, password } : { email, code, password, nickname }),
      })
      if (response.ok) return window.location.assign('/login/done')
      const { error: reason } = await response.json().catch(() => ({ error: null }))
      setError(reason === 'WRONG_CODE' ? '인증번호가 맞지 않거나 시간이 지났어요. 다시 받아 주세요.'
        : response.status === 409 ? '이미 가입한 이메일이에요. 로그인해 주세요.'
        : response.status === 400 ? '입력한 값을 다시 확인해 주세요.'
        : response.status === 429 ? '시도가 너무 많아요. 1분 뒤에 다시 해 주세요.'
        : '지금은 처리할 수 없어요. 잠시 뒤에 다시 해 주세요.')
    } catch {
      setError('서버에 연결하지 못했어요. 잠시 뒤에 다시 해 주세요.')
    }
    setSending(false)
  }

  return (
    <main className="screen">
      <header className="screen-header">
        <p className="logo">SeatME</p>
        <h1 className="screen-title">{reset ? '비밀번호 찾기' : '회원가입'}</h1>
      </header>

      <form className="auth-form auth-form--signup" onSubmit={handleSubmit}>
        <div className="auth-row">
          <input
            ref={emailRef}
            className="text-field"
            type="email"
            name="email"
            placeholder="이메일 아이디"
            autoComplete="email"
            required
            value={form.email}
            onChange={handleChange}
          />
          <Button variant="tonal" size="md" className="auth-code-button" disabled={sending} onClick={handleSendCode}>
            {codeSent ? '다시 받기' : '인증번호 받기'}
          </Button>
        </div>
        {note && <p className="auth-note" role="status">{note}</p>}
        {codeSent && (
          <input
            className="text-field"
            name="code"
            placeholder="인증번호 6자리"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            pattern="\d{6}"
            maxLength={6}
            value={form.code}
            onChange={handleChange}
          />
        )}
        <input
          className="text-field"
          type="password"
          name="password"
          placeholder={reset ? '새 비밀번호 (최소 6자리 이상 입력)' : '비밀번호 (최소 6자리 이상 입력)'}
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
        {!reset && (
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
        )}
        {error && <p className="auth-error" role="alert">{error}</p>}
        {!reset && (
          <p className="auth-note">
            가입하면 <Link className="text-link auth-note-link" to="/privacy">개인정보 처리방침</Link>에 따라 이메일 · 닉네임을 보관해요.
          </p>
        )}
        <Button type="submit" className="auth-submit" disabled={sending}>
          {reset ? '비밀번호 바꾸기' : '회원가입'}
        </Button>
      </form>

      {!reset && (
        <Link className="text-link signup-browse" to="/home">
          로그인 없이 둘러보기
        </Link>
      )}

      <Link className="text-link auth-back" to={reset ? '/login' : '/'}>
        이전
      </Link>
    </main>
  )
}

export default SignupPage
