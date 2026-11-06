import { useState } from 'react'
import { useNavigate } from 'react-router'
import alertIcon from '../assets/icon-alert-small.svg'
import AirportSheet from '../components/AirportSheet'
import Button from '../components/Button'
import CalendarSheet from '../components/CalendarSheet'
import PassengerSheet from '../components/PassengerSheet'
import TabBar from '../components/TabBar'
import { AIRPORT_NAMES, formatPassengers, type AirportCode, type Passengers } from '../mocks/flights'
import './FlightSearchPage.css'

type TripType = 'one-way' | 'round-trip'
type SheetName = 'from' | 'to' | 'date' | 'passengers'

const TRIP_TYPES: { value: TripType; label: string }[] = [
  { value: 'one-way', label: '편도' },
  { value: 'round-trip', label: '왕복' },
]

const RECENT_ROUTES: [AirportCode, AirportCode][] = [
  ['GMP', 'CJU'],
  ['PUS', 'CJU'],
  ['GMP', 'PUS'],
]

function formatFieldDate(dateKey: string) {
  const [, month, day] = dateKey.split('-').map(Number)
  return `${month}.${day}`
}

function formatAirport(code?: AirportCode) {
  return code && `${AIRPORT_NAMES[code]} · ${code}`
}

type SearchFieldProps = {
  label: string
  value?: string
  isWide?: boolean
  isActive: boolean
  errorMessage?: string
  onClick: () => void
}

function SearchField({ label, value, isWide = false, isActive, errorMessage, onClick }: SearchFieldProps) {
  const classes = ['search-field']
  if (isActive) classes.push('search-field--active')
  else if (errorMessage) classes.push('search-field--error')

  return (
    <div className={isWide ? 'search-field-cell search-field-cell--wide' : 'search-field-cell'}>
      <button type="button" className={classes.join(' ')} onClick={onClick}>
        <span className="search-field-label">{label}</span>
        <span className="search-field-value">{value ?? '선택'}</span>
      </button>
      {errorMessage && (
        <p className="field-error">
          <img src={alertIcon} alt="" width={16} height={16} />
          {errorMessage}
        </p>
      )}
    </div>
  )
}

function FlightSearchPage() {
  const navigate = useNavigate()
  const [tripType, setTripType] = useState<TripType>()
  const [from, setFrom] = useState<AirportCode>()
  const [to, setTo] = useState<AirportCode>()
  const [startDate, setStartDate] = useState<string>()
  const [endDate, setEndDate] = useState<string>()
  const [passengers, setPassengers] = useState<Passengers>()
  const [openSheet, setOpenSheet] = useState<SheetName>()
  const [isSubmitted, setIsSubmitted] = useState(false)

  const dateLabel =
    startDate && (endDate ? `${formatFieldDate(startDate)} - ${formatFieldDate(endDate)}` : formatFieldDate(startDate))

  function handleTripTypeChange(value: TripType) {
    if (value === tripType) return
    setTripType(value)
    setStartDate(undefined)
    setEndDate(undefined)
  }

  function handleSearch() {
    if (!from || !to || !startDate || !passengers) {
      setIsSubmitted(true)
      return
    }
    const params = new URLSearchParams({ from, to, date: startDate, passengers: formatPassengers(passengers) })
    if (endDate) params.set('returnDate', endDate)
    navigate(`/flight/results?${params}`)
  }

  return (
    <main className="screen screen--tab-bar search-screen">
      <header className="screen-header search-header">
        <p className="logo">SeatME</p>
        <h1 className="screen-title">항공편 찾기</h1>
      </header>

      <div className="trip-types">
        {TRIP_TYPES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className={`trip-type${tripType === value ? ' trip-type--selected' : ''}`}
            aria-pressed={tripType === value}
            onClick={() => handleTripTypeChange(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="search-fields">
        <SearchField
          label="출발"
          value={formatAirport(from)}
          isWide
          isActive={openSheet === 'from'}
          errorMessage={isSubmitted && !from ? '출발 공항을 선택해 주세요' : undefined}
          onClick={() => setOpenSheet('from')}
        />
        <SearchField
          label="도착"
          value={formatAirport(to)}
          isWide
          isActive={openSheet === 'to'}
          errorMessage={isSubmitted && !to ? '도착 공항을 선택해 주세요' : undefined}
          onClick={() => setOpenSheet('to')}
        />
        <SearchField
          label="날짜"
          value={dateLabel}
          isActive={openSheet === 'date'}
          errorMessage={isSubmitted && !startDate ? '날짜를 선택해 주세요' : undefined}
          onClick={() => setOpenSheet('date')}
        />
        <SearchField
          label="인원"
          value={passengers && formatPassengers(passengers)}
          isActive={openSheet === 'passengers'}
          errorMessage={isSubmitted && !passengers ? '인원을 선택해 주세요' : undefined}
          onClick={() => setOpenSheet('passengers')}
        />
      </div>

      <h2 className="recent-routes-title">최근 경로</h2>
      <div className="recent-routes">
        {RECENT_ROUTES.map(([routeFrom, routeTo]) => (
          <button
            key={`${routeFrom}-${routeTo}`}
            type="button"
            className="recent-route"
            onClick={() => {
              setFrom(routeFrom)
              setTo(routeTo)
            }}
          >
            {AIRPORT_NAMES[routeFrom]}→{AIRPORT_NAMES[routeTo]}
          </button>
        ))}
      </div>

      <section className="summary-card info-card--blue search-profile">
        <h2 className="summary-card-title">내 Seat Profile 자동 적용</h2>
        <p className="summary-card-text">창가 선호 · 햇빛 5 · 조용함 4 · 흔들림 4</p>
        <button type="button" className="text-link summary-card-link">
          이번 여행만 바꾸기
        </button>
      </section>

      <footer className="screen-footer search-footer">
        <Button onClick={handleSearch}>항공편 검색</Button>
      </footer>

      <TabBar />

      {(openSheet === 'from' || openSheet === 'to') && (
        <AirportSheet
          key={openSheet}
          direction={openSheet}
          selected={openSheet === 'from' ? from : to}
          opposite={openSheet === 'from' ? to : from}
          onSelect={(code) => {
            if (openSheet === 'from') setFrom(code)
            else setTo(code)
            setOpenSheet(undefined)
          }}
          onClose={() => setOpenSheet(undefined)}
        />
      )}
      {openSheet === 'date' && (
        <CalendarSheet
          isRoundTrip={tripType === 'round-trip'}
          startDate={startDate}
          endDate={endDate}
          onApply={(start, end) => {
            setStartDate(start)
            setEndDate(end)
            setOpenSheet(undefined)
          }}
          onClose={() => setOpenSheet(undefined)}
        />
      )}
      {openSheet === 'passengers' && (
        <PassengerSheet
          value={passengers}
          onApply={(value) => {
            setPassengers(value)
            setOpenSheet(undefined)
          }}
          onClose={() => setOpenSheet(undefined)}
        />
      )}
    </main>
  )
}

export default FlightSearchPage
