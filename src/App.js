import CheckInForm from './components/CheckInForm'
import CoachDashboard from './pages/CoachDashboard'

function App() {
  const path = window.location.pathname
  if (path === '/coach') return <CoachDashboard />
  return <CheckInForm />
}

export default App