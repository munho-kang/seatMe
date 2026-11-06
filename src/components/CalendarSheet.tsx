import { useState } from 'react'
import Button from './Button'
import Sheet from './Sheet'
import './CalendarSheet.css'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const MONTH_COUNT = 3

function toDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function formatSummaryDate(dateKey?: string) {
  if (!dateKey) return '선택'
  const [year, month, day] = dateKey.split('-').map(Number)
  return `${month}월 ${day}일 (${WEEKDAYS[new Date(year, month - 1, day).getDay()]})`
}

type CalendarSheetProps = {
  isRoundTrip: boolean
  startDate?: string
  endDate?: string
  onApply: (startDate: string, endDate?: string) => void
  onClose: () => void
}

function CalendarSheet({ isRoundTrip, startDate, endDate, onApply, onClose }: CalendarSheetProps) {
  const [start, setStart] = useState(startDate)
  const [end, setEnd] = useState(endDate)
  const [now] = useState(() => new Date())
  const today = toDateKey(now.getFullYear(), now.getMonth(), now.getDate())
  const canApply = isRoundTrip ? Boolean(start && end) : Boolean(start)

  function handleDayClick(dateKey: string) {
    if (isRoundTrip && start && !end && dateKey >= start) {
      setEnd(dateKey)
      return
    }
    setStart(dateKey)
    setEnd(undefined)
  }

  function handleClear() {
    setStart(undefined)
    setEnd(undefined)
  }

  function handleApply() {
    if (start) onApply(start, end)
  }

  function getDayClassName(dateKey: string, weekday: number) {
    const classes = ['calendar-day']
    if (weekday === 0) classes.push('calendar-day--sunday')
    if (weekday === 6) classes.push('calendar-day--saturday')
    if (dateKey === today) classes.push('calendar-day--today')
    if (dateKey < today) classes.push('calendar-day--past')
    if (dateKey === start || dateKey === end) classes.push('calendar-day--selected')
    if (start && end && start !== end) {
      if (dateKey === start) classes.push('calendar-day--range-start')
      if (dateKey === end) classes.push('calendar-day--range-end')
      if (dateKey > start && dateKey < end) classes.push('calendar-day--in-range')
    }
    return classes.join(' ')
  }

  return (
    <Sheet title={isRoundTrip ? '일정 선택' : '가는 날 선택'} onClose={onClose}>
      {isRoundTrip && (
        <div className="trip-summary">
          <p className={`trip-summary-item${start ? ' trip-summary-item--filled' : ''}`}>
            <span>가는 날</span>
            <strong>{formatSummaryDate(start)}</strong>
          </p>
          <p className={`trip-summary-item${end ? ' trip-summary-item--filled' : ''}`}>
            <span>오는 날</span>
            <strong>{formatSummaryDate(end)}</strong>
          </p>
        </div>
      )}

      <div className="calendar-weekdays">
        {WEEKDAYS.map((weekday) => (
          <span key={weekday}>{weekday}</span>
        ))}
      </div>

      <div className="calendar-months">
        {Array.from({ length: MONTH_COUNT }, (_, offset) => {
          const firstDay = new Date(now.getFullYear(), now.getMonth() + offset, 1)
          const year = firstDay.getFullYear()
          const month = firstDay.getMonth()
          const dayCount = new Date(year, month + 1, 0).getDate()
          return (
            <section key={`${year}-${month}`}>
              <h3 className="calendar-month-title">
                {year}.{month + 1}.
              </h3>
              <div className="calendar-grid">
                {Array.from({ length: firstDay.getDay() }, (_, index) => (
                  <span key={index} />
                ))}
                {Array.from({ length: dayCount }, (_, index) => {
                  const day = index + 1
                  const dateKey = toDateKey(year, month, day)
                  return (
                    <button
                      key={dateKey}
                      type="button"
                      className={getDayClassName(dateKey, (firstDay.getDay() + index) % 7)}
                      disabled={dateKey < today}
                      onClick={() => handleDayClick(dateKey)}
                    >
                      <span className="calendar-day-band">
                        <span className="calendar-day-circle">{day}</span>
                      </span>
                      {dateKey === today && <span className="calendar-day-label">오늘</span>}
                    </button>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>

      <footer className="sheet-footer">
        <Button size="pill" variant="outline" onClick={handleClear}>
          선택 해제
        </Button>
        <Button size="pill" disabled={!canApply} onClick={handleApply}>
          적용
        </Button>
      </footer>
    </Sheet>
  )
}

export default CalendarSheet
