import { useEffect, useState } from 'react'
import checkIcon from '../assets/icon-check.svg'
import Button from './Button'
import './SeatAnalysis.css'

export type SeatAnalysisStatus = 'analyzing' | 'done' | 'failed'

const ROW_COUNT = 5
const ROW_INTERVAL_MS = 500
const ROW_MOVES_PER_STEP = 5
const LEFT_SEATS = [0, 1, 2]
const RIGHT_SEATS = [3, 4, 5]
const STEPS = ['햇빛 방향 확인', '조용한 좌석 확인', '흔들림 적은 좌석 확인']

type SeatAnalysisProps = {
  status: SeatAnalysisStatus
  route: string
  onComplete: () => void
  onCancel: () => void
  onError: () => void
}

function SeatAnalysis({ status, route, onComplete, onCancel, onError }: SeatAnalysisProps) {
  const [rowMoves, setRowMoves] = useState(0)
  const activeRow = rowMoves % ROW_COUNT
  const activeStep = Math.min(Math.floor(rowMoves / ROW_MOVES_PER_STEP), STEPS.length - 1)

  useEffect(() => {
    if (status !== 'analyzing') return
    const timer = setInterval(() => setRowMoves((moves) => moves + 1), ROW_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [status])

  useEffect(() => {
    if (status === 'done') onComplete()
    if (status === 'failed') onError()
  }, [status, onComplete, onError])

  function renderSeat(row: number, seat: number) {
    return <span key={seat} className={`analysis-seat${row === activeRow ? ' analysis-seat--active' : ''}`} />
  }

  return (
    <main className="analysis-screen">
      <p className="logo analysis-logo">SeatME</p>

      <div className="analysis-content">
        <div className="analysis-seats" aria-hidden="true">
          {Array.from({ length: ROW_COUNT }, (_, row) => (
            <div key={row} className="analysis-row">
              {LEFT_SEATS.map((seat) => renderSeat(row, seat))}
              <span className="analysis-aisle" />
              {RIGHT_SEATS.map((seat) => renderSeat(row, seat))}
            </div>
          ))}
        </div>

        <div className="analysis-message">
          <p role="status" className="analysis-title">
            좌석을 분석하고 있어요
          </p>
          <p>{route} · 내 Seat Profile 기준</p>
        </div>

        <ul className="analysis-steps">
          {STEPS.map((step, index) => (
            <li
              key={step}
              className={`analysis-step${index === activeStep ? ' analysis-step--active' : ''}${index > activeStep ? ' analysis-step--pending' : ''}`}
            >
              {step}
              {index < activeStep && <img src={checkIcon} alt="완료" width={20} height={20} />}
              {index === activeStep && <span className="analysis-step-progress">확인 중</span>}
            </li>
          ))}
        </ul>
      </div>

      <Button size="pill" variant="outline" onClick={onCancel}>
        분석 취소
      </Button>
    </main>
  )
}

export default SeatAnalysis
