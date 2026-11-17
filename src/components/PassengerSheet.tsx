import { useState } from 'react'
import minusIcon from '../assets/icon-minus.svg'
import plusIcon from '../assets/icon-plus.svg'
import { isBookable, MAX_PASSENGERS } from '../booking'
import { formatPassengers, type Passengers } from '../flights'
import Button from './Button'
import Sheet from './Sheet'
import './PassengerSheet.css'

const DEFAULT_PASSENGERS: Passengers = { adult: 1, child: 0, infant: 0 }

const PASSENGER_ROWS: { key: keyof Passengers; title: string; sub: string }[] = [
  { key: 'adult', title: '성인', sub: '만 13세 이상' },
  { key: 'child', title: '소아', sub: '만 2세 ~ 12세' },
  { key: 'infant', title: '유아', sub: '만 2세 미만' },
]

type PassengerSheetProps = {
  value?: Passengers
  onApply: (passengers: Passengers) => void
  onClose: () => void
}

function PassengerSheet({ value = DEFAULT_PASSENGERS, onApply, onClose }: PassengerSheetProps) {
  const [passengers, setPassengers] = useState(value)
  const seatCount = passengers.adult + passengers.child

  // 한 명 늘리거나 줄인 결과. 항공사가 받는 범위(booking.ts의 isBookable)를 벗어나면 그 버튼을 잠근다
  function changed(key: keyof Passengers, amount: number) {
    return { ...passengers, [key]: passengers[key] + amount }
  }

  return (
    <Sheet title="인원 선택" className="passenger-sheet" onClose={onClose}>
      <div className="passenger-content">
        <div>
          {PASSENGER_ROWS.map(({ key, title, sub }) => (
            <div key={key} className="passenger-row">
              <p className="passenger-row-text">
                <strong>{title}</strong>
                <span>{sub}</span>
              </p>
              <div className="passenger-stepper">
                <button
                  type="button"
                  className="passenger-stepper-button"
                  aria-label={`${title} 줄이기`}
                  disabled={!isBookable(changed(key, -1))}
                  onClick={() => setPassengers(changed(key, -1))}
                >
                  <img src={minusIcon} alt="" width={20} height={20} />
                </button>
                <span className="passenger-count">{passengers[key]}</span>
                <button
                  type="button"
                  className="passenger-stepper-button"
                  aria-label={`${title} 늘리기`}
                  disabled={!isBookable(changed(key, 1))}
                  onClick={() => setPassengers(changed(key, 1))}
                >
                  <img src={plusIcon} alt="" width={20} height={20} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <p className="passenger-summary">
          {formatPassengers(passengers)} (좌석 {seatCount}석)
        </p>
        {/* 문구는 임시다 (디자인 확인) */}
        <p className="passenger-limit">한 번에 {MAX_PASSENGERS}명까지, 유아는 성인 1명당 1명까지예요</p>
      </div>

      <footer className="sheet-footer">
        <Button size="pill" variant="outline" onClick={() => setPassengers(DEFAULT_PASSENGERS)}>
          초기화
        </Button>
        <Button size="pill" onClick={() => onApply(passengers)}>
          적용
        </Button>
      </footer>
    </Sheet>
  )
}

export default PassengerSheet
