import { useState } from 'react'
import { useNavigate } from 'react-router'
import Button from '../components/Button'
import ScaleSelector from '../components/ScaleSelector'
import TabBar from '../components/TabBar'
import { getSeatProfile, saveSeatProfile, type SeatProfile } from '../mocks/seatProfile'
import './SeatProfileEditPage.css'

const SCALE_ITEMS: { key: 'sunlight' | 'quietness' | 'turbulence' | 'quickExit'; label: string }[] = [
  { key: 'sunlight', label: '직사광선·눈부심' },
  { key: 'quietness', label: '주변 소음·통행' },
  { key: 'turbulence', label: '흔들림·멀미 걱정' },
  { key: 'quickExit', label: '빠른 하차' },
]

function SeatProfileEditPage() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<SeatProfile>(getSeatProfile)

  function handleSave() {
    saveSeatProfile(profile)
    navigate('/my')
  }

  return (
    <main className="screen screen--tab-bar">
      <header>
        <div className="profile-edit-topbar">
          <p className="logo">SeatME</p>
          <button type="button" className="text-link profile-edit-reset" onClick={() => setProfile(getSeatProfile())}>
            초기화
          </button>
        </div>
        <h1 className="screen-title screen-title--section">Seat Profile</h1>
        <p className="screen-sub">평소 취향은 기본값으로 저장되고, 여행별로 따로 바꿀 수 있어요.</p>
      </header>

      <div className="profile-edit-side">
        <span>창가/통로</span>
        <span className="profile-edit-side-value">{profile.seatPosition}</span>
      </div>

      <div className="profile-edit-scales">
        {SCALE_ITEMS.map((item) => (
          <section key={item.key} className="profile-edit-scale">
            <h2>{item.label}</h2>
            <ScaleSelector
              label={item.label}
              value={profile[item.key]}
              onChange={(value) => setProfile({ ...profile, [item.key]: value })}
            />
          </section>
        ))}
      </div>

      <button type="button" className="text-link profile-edit-more">
        화장실 접근 · 레그룸 · 충전 등 세부 조건 더보기
      </button>

      <footer className="screen-footer">
        <Button onClick={handleSave}>변경사항 저장</Button>
      </footer>

      <TabBar />
    </main>
  )
}

export default SeatProfileEditPage
