import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home.tsx';
import MatchDetails from './pages/MatchDetails.tsx';
import PlayerStats from './pages/PlayerStats.tsx';
import GlobalStats from './pages/GlobalStats.tsx';
import Calendar from './pages/Calendar.tsx';

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        <nav className="bg-blue-600 text-white p-4 flex space-x-4">
          <Link className="font-bold" to="/">Partidas</Link>
          <Link className="font-bold" to="/stats">Estatísticas</Link>
          <Link className="font-bold" to="/calendar">Calendário</Link>
        </nav>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/match/:matchId" element={<MatchDetails />} />
          <Route path="/statistics/player/:matchId/:playerId" element={<PlayerStats />} />
          <Route path="/stats" element={<GlobalStats />} />
          <Route path="/calendar" element={<Calendar />} />
        </Routes>
      </div>
    </Router>
  );
}
