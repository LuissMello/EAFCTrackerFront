import React, { Suspense, lazy } from "react";
import { HashRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import Home from "./pages/Home.tsx";
import Navbar from "./components/Navbar.tsx";
import { ClubProvider } from "./hooks/useClub.tsx";
import { AuthProvider } from "./hooks/useAuth.tsx";
import { RefreshProvider } from "./hooks/useRefresh.tsx";
import { LiveModeProvider } from "./hooks/useLiveMode.tsx";
import { GameVersionsProvider } from "./hooks/useGameVersions.tsx";
import { ThemeProvider } from "./hooks/useTheme.tsx";
import { RouteEffects, SkipLink } from "./components/RouteEffects.tsx";

// Code-splitting por rota (Home fica no bundle principal por ser a rota inicial)
const MatchDetails = lazy(() => import("./pages/MatchDetails.tsx"));
const PlayerStats = lazy(() => import("./pages/PlayerStats.tsx"));
const GlobalStats = lazy(() => import("./pages/GlobalStats.tsx"));
const Calendar = lazy(() => import("./pages/Calendar.tsx"));
const Trends = lazy(() => import("./pages/Trends.tsx"));
const PlayerAttributes = lazy(() => import("./pages/PlayerAttributes.tsx"));
const PlayerStatisticsByDatePage = lazy(() => import("./pages/PlayerStatisticsByDatePage.tsx"));
const SinglePlayerStatisticsByDatePage = lazy(() => import("./pages/SinglePlayerStatisticsByDatePage.tsx"));
const MatchGoalAnalysis = lazy(() => import("./pages/MatchGoalAnalysis.tsx"));
const GoalAnalytics = lazy(() => import("./pages/GoalAnalytics.tsx"));
const Records = lazy(() => import("./pages/Records.tsx"));
const PlayerProfile = lazy(() => import("./pages/PlayerProfile.tsx"));
const Opponents = lazy(() => import("./pages/Opponents.tsx"));
const OverallEvolution = lazy(() => import("./pages/OverallEvolution.tsx"));
const Admin = lazy(() => import("./pages/Admin.tsx"));
const RegistrarGols = lazy(() => import("./pages/RegistrarGols.tsx"));
const NoiteDeJogo = lazy(() => import("./pages/NoiteDeJogo.tsx"));
const Laboratorio = lazy(() => import("./pages/Laboratorio.tsx"));
const Retrospectiva = lazy(() => import("./pages/Retrospectiva.tsx"));
const Cartas = lazy(() => import("./pages/Cartas.tsx"));

function PageFallback() {
    return (
        <div role="status" aria-live="polite" className="flex items-center justify-center py-20">
            <svg className="animate-spin w-6 h-6 text-fg-subtle" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span className="sr-only">Carregando…</span>
        </div>
    );
}

/** Captura falhas ao carregar um chunk (ex.: deploy novo, rede) para não deixar a tela em branco. */
class ChunkErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
    state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    render() {
        if (!this.state.failed) return this.props.children;
        return (
            <div role="alert" className="max-w-md mx-auto mt-16 p-4 bg-negative-soft border border-negative/30 rounded-xl text-negative-fg text-sm text-center">
                <p>Não foi possível carregar esta página.</p>
                <button type="button" className="btn btn-secondary mt-3" onClick={() => window.location.reload()}>
                    Recarregar
                </button>
            </div>
        );
    }
}

function AppRoutes() {
    const { pathname } = useLocation();
    return (
        // key: ao navegar para outra rota o boundary é reiniciado
        <ChunkErrorBoundary key={pathname}>
            <Suspense fallback={<PageFallback />}>
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
                    <Route path="/overall-evolution" element={<OverallEvolution />} />
                    <Route path="/registrar-gols" element={<RegistrarGols />} />
                    <Route path="/noite-de-jogo" element={<NoiteDeJogo />} />
                    <Route path="/laboratorio" element={<Laboratorio />} />
                    <Route path="/retrospectiva" element={<Retrospectiva />} />
                    <Route path="/cartas" element={<Cartas />} />
                    <Route path="/admin" element={<Admin />} />
                </Routes>
            </Suspense>
        </ChunkErrorBoundary>
    );
}

export default function App() {
    return (
        <ThemeProvider>
            <Router>
                <AuthProvider>
                    <RefreshProvider>
                        <LiveModeProvider>
                            <GameVersionsProvider>
                                <ClubProvider>
                                    <div className="min-h-screen bg-bg text-fg">
                                        <SkipLink />
                                        <RouteEffects />
                                        <Navbar />
                                        <main id="conteudo" tabIndex={-1} className="outline-none">
                                            <AppRoutes />
                                        </main>
                                    </div>
                                </ClubProvider>
                            </GameVersionsProvider>
                        </LiveModeProvider>
                    </RefreshProvider>
                </AuthProvider>
            </Router>
        </ThemeProvider>
    );
}
