import { useState } from 'react'
import { useNavigate } from 'react-router'
import './NaverConsentPage.css'

type Agreement = 'required' | 'optional' | 'gender' | 'birthday'

function CheckCircle({ isChecked }: { isChecked: boolean }) {
  return (
    <span className={`naver-check${isChecked ? ' naver-check--checked' : ''}`} aria-hidden="true">
      <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
        <path d="M1 3l2 2 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

function NaverConsentPage() {
  const navigate = useNavigate()
  const [agreed, setAgreed] = useState<Record<Agreement, boolean>>({
    required: true,
    optional: false,
    gender: false,
    birthday: false,
  })
  const isAllAgreed = Object.values(agreed).every(Boolean)

  function handleToggle(key: Agreement) {
    setAgreed((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function handleToggleAll() {
    setAgreed({ required: !isAllAgreed, optional: !isAllAgreed, gender: !isAllAgreed, birthday: !isAllAgreed })
  }

  return (
    <main className="naver-screen">
      <section className="naver-card">
        <div className="naver-header">
          <p className="naver-brand">
            <span className="naver-brand-mark">N</span>네이버 로그인
          </p>
          <p className="naver-account">
            <span className="naver-avatar" />
            Naver ID ▾
          </p>
        </div>

        <p className="logo naver-service">SeatME</p>

        <button type="button" className="naver-row naver-all" onClick={handleToggleAll}>
          <CheckCircle isChecked={isAllAgreed} />
          <strong>전체 동의하기</strong>
          <span className="naver-sub">선택 동의 포함</span>
        </button>

        <hr className="naver-divider naver-divider--full" />

        <p className="naver-title">네이버 개인정보 처리 동의</p>

        <button type="button" className="naver-row naver-item" onClick={() => handleToggle('required')}>
          <CheckCircle isChecked={agreed.required} />
          [필수] 개인정보 제 3자 제공 동의
          <span className="naver-chevron">›</span>
        </button>
        <p className="naver-item-desc">이용자 식별자, 이름, 이메일 주소</p>

        <button type="button" className="naver-row naver-item naver-item--optional" onClick={() => handleToggle('optional')}>
          <CheckCircle isChecked={agreed.optional} />
          [선택] 개인정보 제 3자 제공 동의
          <span className="naver-chevron">›</span>
        </button>
        <div className="naver-sub-items">
          <button type="button" className="naver-row" onClick={() => handleToggle('gender')}>
            <CheckCircle isChecked={agreed.gender} />
            성별
          </button>
          <button type="button" className="naver-row" onClick={() => handleToggle('birthday')}>
            <CheckCircle isChecked={agreed.birthday} />
            생일
          </button>
        </div>

        <hr className="naver-divider" />

        <p className="naver-notice">
          네이버는 회원가입/로그인 기능 제공자이며, {'{서비스명}'} 서비스 제공자가 아닙니다. {'{서비스명}'} 서비스 및
          이용약관에 대한 의무와 책임은 {'{서비스명}'}에 있습니다. 동의 후에는 {'{서비스명}'}의 이용약관 및
          개인정보처리방침에 따라 정보가 관리됩니다.
        </p>

        <div className="naver-actions">
          <button type="button" className="naver-button" onClick={() => navigate(-1)}>
            취소
          </button>
          <button type="button" className="naver-button naver-button--agree" onClick={() => navigate('/onboarding')}>
            동의하기
          </button>
        </div>
      </section>
    </main>
  )
}

export default NaverConsentPage
