import { HashRouter as Router, Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home.tsx";
import MatchDetails from "./pages/MatchDetails.tsx";
import PlayerStats from "./pages/PlayerStats.tsx";
import GlobalStats from "./pages/GlobalStats.tsx";
import Calendar from "./pages/Calendar.tsx";
import Trends from "./pages/Trends.tsx";
import PlayerAttributes from "./pages/PlayerAttributes.tsx";
import ClubPicker from "./components/ClubPicker.tsx";
import { ClubProvider } from "./hooks/useClub.tsx";

function Navbar() {
    return (
        <nav className="bg-black text-white p-4 flex flex-wrap items-center gap-3">
            <Link className="font-bold" to="/">Partidas</Link>
            <Link className="font-bold" to="/stats">Estatísticas</Link>
            <Link className="font-bold" to="/calendar">Calendário</Link>
            <Link className="font-bold" to="/trends">Trends</Link>
            <Link className="font-bold" to="/attributes">Atributos</Link>

            <div className="ml-auto flex items-center gap-2">
                <ClubPicker />
            </div>
        </nav>
    );
}

export default function App() {
    return (
        <Router>
            <ClubProvider>
                <div className="min-h-screen bg-gray-100">
                    <Navbar />
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/match/:matchId" element={<MatchDetails />} />
                        <Route path="/statistics/player/:matchId/:playerId" element={<PlayerStats />} />
                        <Route path="/stats" element={<GlobalStats />} />
                        <Route path="/calendar" element={<Calendar />} />
                        <Route path="/trends" element={<Trends />} />
                        <Route path="/attributes" element={<PlayerAttributes />} />
                    </Routes>
                </div>
            </ClubProvider>
        </Router>
    );
}
