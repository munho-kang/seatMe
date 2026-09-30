import { useState } from 'react'
import Button from '../components/Button'
import ScaleSelector from '../components/ScaleSelector'
import './OnboardingPage.css'

type SeatPosition = 'always-aisle' | 'prefer-aisle' | 'any' | 'prefer-window' | 'always-window'
type SensitivityKey = 'sunlight' | 'quietness' | 'turbulence' | 'quickExit' | 'view'

const SEAT_POSITION_OPTIONS: { value: SeatPosition; label: string }[] = [
  { value: 'always-aisle', label: '항상 통로석에 앉아요' },
  { value: 'prefer-aisle', label: '통로석 쪽이 더 좋아요' },
  { value: 'any', label: '상관없어요' },
  { value: 'prefer-window', label: '창가석 쪽이 더 좋아요' },
  { value: 'always-window', label: '항상 창가석에 앉아요' },
]

const SENSITIVITY_ITEMS: { key: SensitivityKey; label: string; priorityLabel: string }[] = [
  { key: 'sunlight', label: '햇빛', priorityLabel: '햇빛' },
  { key: 'quietness', label: '주변 소음·통행', priorityLabel: '조용한 자리' },
  { key: 'turbulence', label: '흔들림·멀미 걱정', priorityLabel: '멀미' },
  { key: 'quickExit', label: '빠른 하차', priorityLabel: '빠른 하차' },
  { key: 'view', label: '전망', priorityLabel: '전망' },
]

const STEP_COUNT = 3

// Figma 가중치 바: 5점은 가득 채우고, 나머지는 1점당 트랙(300px)의 49.6px
function getWeightRatio(value = 0) {
  return value === 5 ? 1 : (value * 49.6) / 300
}

function ProgressStepper({ step }: { step: number }) {
  return (
    <div className="progress-stepper" aria-label={`${STEP_COUNT}단계 중 ${step}단계`}>
      {Array.from({ length: STEP_COUNT }, (_, index) => (
        <span key={index} className={`progress-step${index + 1 === step ? ' progress-step--active' : ''}`} />
      ))}
    </div>
  )
}

function OnboardingPage() {
  const [step, setStep] = useState(0)
  const [seatPosition, setSeatPosition] = useState<SeatPosition>()
  const [sensitivity, setSensitivity] = useState<Partial<Record<SensitivityKey, number>>>({})

  const priorities = SENSITIVITY_ITEMS.toSorted((a, b) => (sensitivity[b.key] ?? 0) - (sensitivity[a.key] ?? 0))

  if (step === 0) {
    return (
      <main className="screen onboarding-intro">
        <header className="screen-header">
          <div className="onboarding-topbar">
            <p>Seat Profile 만들기</p>
            <button type="button" className="text-link onboarding-later">
              나중에
            </button>
          </div>
          <h1 className="screen-title">3분이 아니라 30초면 돼요</h1>
          <p className="screen-desc">몇 가지 선택만 해두면 이후 비행에서는 저장된 취향으로 바로 추천 받을 수 있어요.</p>
        </header>

        <div className="info-card info-card--outline onboarding-steps">
          <p>1  평소 창가 · 통로 취향</p>
          <p>2 햇빛 · 소음 · 흔들림 민감도</p>
          <p>3  하차 · 화장실 · 레그룸 중요도</p>
          <p className="onboarding-steps-note">모든 질문은 5지선다로 빠르게 선택</p>
        </div>

        <footer className="screen-footer">
          <Button onClick={() => setStep(1)}>내 취향 설정 시작</Button>
          <p className="onboarding-caption">설정은 언제든 마이페이지에서 수정할 수 있어요.</p>
        </footer>
      </main>
    )
  }

  if (step === 1) {
    return (
      <main className="screen onboarding-question">
        <header className="screen-header">
          <ProgressStepper step={1} />
          <h1 className="screen-title">평소 비행기에서 어디가 더 편해요?</h1>
          <p className="screen-desc">가장 가까운 걸 하나만 골라주세요.</p>
        </header>

        <div className="option-list" role="radiogroup">
          {SEAT_POSITION_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={seatPosition === option.value}
              className={`option-button${seatPosition === option.value ? ' option-button--selected' : ''}`}
              onClick={() => setSeatPosition(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <footer className="onboarding-nav">
          <button type="button" className="text-link onboarding-prev" onClick={() => setStep(0)}>
            이전
          </button>
          <Button size="md" onClick={() => setStep(2)}>
            다음
          </Button>
        </footer>
      </main>
    )
  }

  if (step === 2) {
    return (
      <main className="screen onboarding-question">
        <header className="screen-header">
          <ProgressStepper step={2} />
          <h1 className="screen-title">이런 불편은 얼마나 신경 써요?</h1>
          <p className="screen-desc">1 전혀 신경 안 씀 - 5 매우 중요</p>
        </header>

        <div className="onboarding-cards onboarding-cards--scale">
          {SENSITIVITY_ITEMS.map((item) => (
            <div key={item.key} className="scale-card">
              <p className="onboarding-card-title">{item.label}</p>
              <ScaleSelector
                label={item.label}
                value={sensitivity[item.key]}
                onChange={(value) => setSensitivity((prev) => ({ ...prev, [item.key]: value }))}
              />
            </div>
          ))}
        </div>

        <footer className="onboarding-nav">
          <button type="button" className="text-link onboarding-prev" onClick={() => setStep(1)}>
            이전
          </button>
          <Button size="md" onClick={() => setStep(3)}>
            다음
          </Button>
        </footer>
      </main>
    )
  }

  return (
    <main className="screen">
      <header className="screen-header">
        <ProgressStepper step={3} />
        <h1 className="screen-title">우선 순위 이대로 갈까요?</h1>
      </header>

      <ol className="onboarding-cards onboarding-cards--priority">
        {priorities.map((item, index) => (
          <li key={item.key} className="priority-card">
            <p className="onboarding-card-title">
              {index + 1}위 - {item.priorityLabel}
            </p>
            <div className="weight-bar">
              <span className="weight-bar-fill" style={{ width: `${getWeightRatio(sensitivity[item.key]) * 100}%` }} />
            </div>
          </li>
        ))}
      </ol>

      <footer className="screen-footer">
        <Button>이 조건으로 추천받기</Button>
        <button type="button" className="text-link onboarding-back" onClick={() => setStep(2)}>
          이전
        </button>
      </footer>
    </main>
  )
}

export default OnboardingPage
