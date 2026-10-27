import { Navigate, Route, Routes } from 'react-router';
import Layout from './components/Layout';
import { useData } from './hooks/data';
import Home from './pages/Home';
import Login from './pages/Login';
import NewTournament from './pages/NewTournament';
import PlayerPage from './pages/PlayerPage';
import Players from './pages/Players';
import Rating from './pages/Rating';
import TournamentPage from './pages/TournamentPage';
import type { ReactNode } from 'react';

function AdminOnly({ children }: { children: ReactNode }) {
  const { isAdmin, authReady } = useData();
  if (!authReady) return null;
  return isAdmin ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="t/:id" element={<TournamentPage />} />
        <Route
          path="new"
          element={
            <AdminOnly>
              <NewTournament />
            </AdminOnly>
          }
        />
        <Route path="rating" element={<Rating />} />
        <Route path="players" element={<Players />} />
        <Route path="players/:id" element={<PlayerPage />} />
        <Route path="login" element={<Login />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
