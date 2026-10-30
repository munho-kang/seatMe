import { BrowserRouter, Route, Routes } from 'react-router'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import NaverConsentPage from './pages/NaverConsentPage'
import SignupPage from './pages/SignupPage'
import OnboardingPage from './pages/OnboardingPage'
import HomePage from './pages/HomePage'
import FlightSearchPage from './pages/FlightSearchPage'
import FlightResultsPage from './pages/FlightResultsPage'
import TripSettingPage from './pages/TripSettingPage'
import RecommendPage from './pages/RecommendPage'
import ComparePage from './pages/ComparePage'
import SeatDetailPage from './pages/SeatDetailPage'
import SeatMapPage from './pages/SeatMapPage'
import BookingCompletePage from './pages/BookingCompletePage'
import MyTripsPage from './pages/MyTripsPage'
import MyPage from './pages/MyPage'
import SeatProfileEditPage from './pages/SeatProfileEditPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/login/naver" element={<NaverConsentPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/flight" element={<FlightSearchPage />} />
        <Route path="/flight/results" element={<FlightResultsPage />} />
        <Route path="/flight/trip" element={<TripSettingPage />} />
        <Route path="/recommend" element={<RecommendPage />} />
        <Route path="/recommend/compare" element={<ComparePage />} />
        <Route path="/recommend/map" element={<SeatMapPage />} />
        <Route path="/recommend/seat" element={<SeatDetailPage />} />
        <Route path="/booking/complete" element={<BookingCompletePage />} />
        <Route path="/trips" element={<MyTripsPage />} />
        <Route path="/my" element={<MyPage />} />
        <Route path="/my/profile" element={<SeatProfileEditPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
