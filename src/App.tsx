import { HashRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home.tsx";
import MatchDetails from "./pages/MatchDetails.tsx";
import PlayerStats from "./pages/PlayerStats.tsx";
import GlobalStats from "./pages/GlobalStats.tsx";
import Calendar from "./pages/Calendar.tsx";
import Trends from "./pages/Trends.tsx";
import PlayerAttributes from "./pages/PlayerAttributes.tsx";
import PlayerStatisticsByDatePage from "./pages/PlayerStatisticsByDatePage.tsx";
import SinglePlayerStatisticsByDatePage from "./pages/SinglePlayerStatisticsByDatePage.tsx";
import MatchGoalAnalysis from "./pages/MatchGoalAnalysis.tsx";
import GoalAnalytics from "./pages/GoalAnalytics.tsx";
import Records from "./pages/Records.tsx";
import PlayerProfile from "./pages/PlayerProfile.tsx";
import Opponents from "./pages/Opponents.tsx";
import Navbar from "./components/Navbar.tsx";
import { ClubProvider } from "./hooks/useClub.tsx";

export default function App() {
    return (
        <Router>
            <ClubProvider>
                <div className="min-h-screen bg-gray-100">
                    <Navbar />
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/match/:matchId" element={<MatchDetails />} />
                        <Route path="/match/:matchId/goals" element={<MatchGoalAnalysis />} />
                        <Route path="/goal-analytics" element={<GoalAnalytics />} />
                        <Route path="/statistics/player/:matchId/:playerId" element={<PlayerStats />} />
                        <Route path="/stats" element={<GlobalStats />} />
                        <Route path="/calendar" element={<Calendar />} />
                        <Route path="/trends" element={<Trends />} />
                        <Route path="/attributes" element={<PlayerAttributes />} />
                        <Route path="/statisticsbydate" element={<PlayerStatisticsByDatePage />} />
                        <Route path="/singlestatisticsbydate" element={<SinglePlayerStatisticsByDatePage />} />
                        <Route path="/records" element={<Records />} />
                        <Route path="/player/:playerEntityId" element={<PlayerProfile />} />
                        <Route path="/opponents" element={<Opponents />} />
                    </Routes>
                </div>
            </ClubProvider>
        </Router>
    );
}
