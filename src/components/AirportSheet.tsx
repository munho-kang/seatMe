import { useState } from 'react'
import alertIcon from '../assets/icon-alert-small.svg'
import checkIcon from '../assets/icon-check.svg'
import searchIcon from '../assets/icon-search.svg'
import { AIRPORTS, AIRPORT_NAMES, type AirportCode } from '../mocks/flights'
import Sheet from './Sheet'
import './AirportSheet.css'

const RECENT_AIRPORTS: AirportCode[] = ['GMP', 'CJU', 'PUS']

type AirportSheetProps = {
  direction: 'from' | 'to'
  selected?: AirportCode
  opposite?: AirportCode
  onSelect: (code: AirportCode) => void
  onClose: () => void
}

function AirportSheet({ direction, selected, opposite, onSelect, onClose }: AirportSheetProps) {
  const [query, setQuery] = useState('')
  const keyword = query.trim().toLowerCase()
  const airports = AIRPORTS.filter(
    ({ code, name, fullName }) => code.toLowerCase().includes(keyword) || name.includes(keyword) || fullName.includes(keyword),
  )
  const hasNoMatch = airports.length === 0
  const oppositeLabel = direction === 'from' ? '도착 공항으로 선택됨' : '출발 공항으로 선택됨'

  return (
    <Sheet title={direction === 'from' ? '출발 공항 선택' : '도착 공항 선택'} onClose={onClose}>
      <div className="airport-search">
        <label className={`airport-search-field${hasNoMatch ? ' airport-search-field--error' : ''}`}>
          <img src={searchIcon} alt="" width={20} height={20} />
          <input
            type="text"
            placeholder="공항 이름 또는 코드 검색"
            aria-label="공항 이름 또는 코드 검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        {hasNoMatch && (
          <p className="field-error">
            <img src={alertIcon} alt="" width={16} height={16} />
            일치하는 공항이 없어요
          </p>
        )}
      </div>

      <div className="airport-recent">
        <h3 className="airport-section-title">최근 선택</h3>
        <div className="airport-chips">
          {RECENT_AIRPORTS.map((code) => (
            <button
              key={code}
              type="button"
              className={`airport-chip${code === selected ? ' airport-chip--selected' : ''}`}
              disabled={code === opposite}
              onClick={() => onSelect(code)}
            >
              {AIRPORT_NAMES[code]}
            </button>
          ))}
        </div>
      </div>

      <h3 className="airport-section-title airport-list-title">국내 공항</h3>
      <div className="airport-list">
        {airports.map(({ code, name, fullName }) => {
          const isSelected = code === selected
          const isOpposite = code === opposite
          return (
            <button
              key={code}
              type="button"
              className={`airport-row${isSelected ? ' airport-row--selected' : ''}`}
              disabled={isOpposite}
              onClick={() => onSelect(code)}
            >
              <span className="airport-row-text">
                <span className="airport-row-title">
                  {name} · {code}
                </span>
                <span className="airport-row-sub">{isOpposite ? oppositeLabel : fullName}</span>
              </span>
              {isSelected && <img src={checkIcon} alt="선택됨" width={24} height={24} />}
            </button>
          )
        })}
      </div>
    </Sheet>
  )
}

export default AirportSheet
