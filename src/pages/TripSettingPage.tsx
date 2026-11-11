import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import Button from '../components/Button'
import SelectableCard from '../components/SelectableCard'
import TabBar from '../components/TabBar'
import { getRouteTitle } from '../mocks/flights'
import { describeSeatProfile } from '../mocks/seatProfile'
import './TripSettingPage.css'

type ProfileMode = 'default' | 'adjust' | 'reset'

// '평소처럼'의 설명은 저장된 취향 요약이라 그릴 때 만든다
const PROFILE_OPTIONS: { value: ProfileMode; title: string; description?: string }[] = [
  { value: 'default', title: '평소처럼 그대로 사용' },
  { value: 'adjust', title: '이번 여행만 조금 바꾸기', description: '예: 이번엔 전망이 더 중요해요' },
  { value: 'reset', title: '처음부터 다시 설정', description: '저장된 프로필은 유지하고 새 설정으로 추천' },
]

function TripSettingPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [profileMode, setProfileMode] = useState<ProfileMode>()

  function handleStart() {
    if (!profileMode) return
    const params = new URLSearchParams(searchParams)
    params.set('profile', profileMode)
    navigate(`/recommend/analyzing?${params}`)
  }

  return (
    <main className="screen screen--tab-bar">
      <header className="screen-header screen-header--route">
        <p className="logo">SeatME</p>
        <h1 className="screen-title screen-title--route">{getRouteTitle(searchParams)}</h1>
      </header>

      <div className="trip-options">
        {PROFILE_OPTIONS.map((option) => (
          <SelectableCard
            key={option.value}
            className="trip-option"
            isSelected={profileMode === option.value}
            onSelect={() => setProfileMode(option.value)}
          >
            <span className="trip-option-title">{option.title}</span>
            <span className="trip-option-desc">{option.description ?? describeSeatProfile()}</span>
          </SelectableCard>
        ))}
      </div>

      {profileMode && (
        <footer className="screen-footer">
          <Button onClick={handleStart}>바로 좌석  추천받기</Button>
        </footer>
      )}

      <TabBar />
    </main>
  )
}

export default TripSettingPage
