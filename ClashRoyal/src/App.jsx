import { useState, useEffect } from 'react';
import ParticipantManager from './ParticipantManager';
import Tournament from './Tournament';
import AdminPanel from './AdminPanel';
import rawData from '../data.json';
import './ParticipantManager.css';

const APP_STORAGE_KEY = "clash_app_state";
const PLAYER_STORAGE_KEY = "clash_player_data";

export default function App() {
  // ── View state ────────────────────────────────────────────────
  const [view, setView] = useState('manager'); // 'manager' | 'tournament' | 'admin'

  // ── Player data (localStorage > data.json fallback) ───────────
  const [playerData, setPlayerData] = useState(() => {
    try {
      const saved = localStorage.getItem(PLAYER_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return rawData;
  });

  // ── Tournament state ──────────────────────────────────────────
  const [tournamentState, setTournamentState] = useState(() => {
    try {
      const saved = localStorage.getItem(APP_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.active) return parsed;
      }
    } catch (e) {}
    return { active: false, participants: [], mode: null };
  });

  // Restore tournament view if state was persisted
  useEffect(() => {
    if (tournamentState.active) {
      setView('tournament');
    }
  }, []);

  const handleStartTournament = (participants, mode) => {
    if (!participants || participants.length < 2) {
      alert("You need at least 2 participants to start a tournament.");
      return;
    }
    const state = { active: true, participants, mode };
    setTournamentState(state);
    try { localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(state)); } catch(e) {}
    setView('tournament');
  };

  const handleResetTournament = () => {
    const state = { active: false, participants: [], mode: null };
    setTournamentState(state);
    try { localStorage.removeItem(APP_STORAGE_KEY); } catch(e) {}
    setView('manager');
  };

  const handleDataChange = (updated) => {
    if (updated === null) {
      // Reset to original
      setPlayerData(rawData);
      return;
    }
    setPlayerData(updated);
  };

  return (
    <div className="app">
      {view === 'admin' ? (
        <AdminPanel
          data={playerData}
          onBack={() => setView('manager')}
          onDataChange={handleDataChange}
        />
      ) : view === 'tournament' ? (
        <Tournament
          initialParticipants={tournamentState.participants}
          modeType={tournamentState.mode}
          onReset={handleResetTournament}
        />
      ) : (
        <>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setView('admin')}
            style={{
              position: 'fixed',
              top: 14,
              left: 14,
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            ⚙️ Admin
          </button>
          <ParticipantManager
            data={playerData}
            onStartTournament={handleStartTournament}
          />
        </>
      )}
    </div>
  );
}
