import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home.tsx";
import MatchDetails from "./pages/MatchDetails.tsx";
import PlayerStats from "./pages/PlayerStats.tsx";
import GlobalStats from "./pages/GlobalStats.tsx";
import Calendar from "./pages/Calendar.tsx";
import Trends from "./pages/Trends.tsx";
import { useState } from "react";
import { useClub } from "./hooks/useClub.tsx";

function Navbar() {
    const { club, setClub } = useClub();
    const [clubIdInput, setClubIdInput] = useState<string>(club?.clubId?.toString?.() ?? "");

    const applyClub = () => {
        const id = Number(clubIdInput);
        if (!Number.isFinite(id) || id <= 0) {
            alert("Informe um clubId numérico válido");
            return;
        }
        setClub({ clubId: id }); // opcional: adicionar clubName quando você tiver
    };

    const clearClub = () => {
        setClub(null);
        setClubIdInput("");
    };

    return (
        <nav className="bg-blue-600 text-white p-4 flex flex-wrap items-center gap-3">
            <Link className="font-bold" to="/">Partidas</Link>
            <Link className="font-bold" to="/stats">Estatísticas</Link>
            <Link className="font-bold" to="/calendar">Calendário</Link>
            <Link className="font-bold" to="/trends">Trends</Link>

            <div className="ml-auto flex items-center gap-2">
                <input
                    className="px-2 py-1 rounded text-black w-36"
                    placeholder="clubId"
                    value={clubIdInput}
                    onChange={(e) => setClubIdInput(e.target.value)}
                />
                <button onClick={applyClub} className="bg-white text-blue-600 px-2 py-1 rounded">
                    Aplicar clube
                </button>
                <button onClick={clearClub} className="bg-white/20 hover:bg-white/30 px-2 py-1 rounded">
                    Limpar
                </button>
                {club?.clubId && <span className="opacity-90">⚽ {club.clubId}</span>}
            </div>
        </nav>
    );
}

export default function App() {
    return (
        <Router>
            <div className="min-h-screen bg-gray-100">
                <Navbar />
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/match/:matchId" element={<MatchDetails />} />
                    <Route path="/statistics/player/:matchId/:playerId" element={<PlayerStats />} />
                    <Route path="/stats" element={<GlobalStats />} />
                    <Route path="/calendar" element={<Calendar />} />
                    <Route path="/trends" element={<Trends />} />
                </Routes>
            </div>
        </Router>
    );
}
