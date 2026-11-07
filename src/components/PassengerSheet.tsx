import { useState } from 'react'
import minusIcon from '../assets/icon-minus.svg'
import plusIcon from '../assets/icon-plus.svg'
import { formatPassengers, type Passengers } from '../mocks/flights'
import Button from './Button'
import Sheet from './Sheet'
import './PassengerSheet.css'

const DEFAULT_PASSENGERS: Passengers = { adult: 1, child: 0, infant: 0 }

const PASSENGER_ROWS: { key: keyof Passengers; title: string; sub: string; min: number }[] = [
  { key: 'adult', title: '성인', sub: '만 13세 이상', min: 1 },
  { key: 'child', title: '소아', sub: '만 2세 ~ 12세', min: 0 },
  { key: 'infant', title: '유아', sub: '만 2세 미만', min: 0 },
]

type PassengerSheetProps = {
  value?: Passengers
  onApply: (passengers: Passengers) => void
  onClose: () => void
}

function PassengerSheet({ value = DEFAULT_PASSENGERS, onApply, onClose }: PassengerSheetProps) {
  const [passengers, setPassengers] = useState(value)
  const seatCount = passengers.adult + passengers.child

  function handleChange(key: keyof Passengers, amount: number) {
    setPassengers({ ...passengers, [key]: passengers[key] + amount })
  }

  return (
    <Sheet title="인원 선택" className="passenger-sheet" onClose={onClose}>
      <div className="passenger-content">
        <div>
          {PASSENGER_ROWS.map(({ key, title, sub, min }) => (
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
                  disabled={passengers[key] <= min}
                  onClick={() => handleChange(key, -1)}
                >
                  <img src={minusIcon} alt="" width={20} height={20} />
                </button>
                <span className="passenger-count">{passengers[key]}</span>
                <button
                  type="button"
                  className="passenger-stepper-button"
                  aria-label={`${title} 늘리기`}
                  onClick={() => handleChange(key, 1)}
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
