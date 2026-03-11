import { useState, useEffect } from 'react';
import ParticipantManager from './ParticipantManager';
import Tournament from './Tournament';
import rawData from '../data.json';
import './ParticipantManager.css';

export default function App() {
  const [tournamentState, setTournamentState] = useState({
    active: false,
    participants: [],
    mode: null // 'auto' or 'manual'
  });

  const handleStartTournament = (participants, mode) => {
    if (!participants || participants.length < 2) {
      alert("You need at least 2 participants to start a tournament.");
      return;
    }
    setTournamentState({
      active: true,
      participants,
      mode
    });
  };

  const handleResetTournament = () => {
    setTournamentState({
      active: false,
      participants: [],
      mode: null
    });
  };

  return (
    <div className="app">
      {!tournamentState.active ? (
        <ParticipantManager 
          data={rawData} 
          onStartTournament={handleStartTournament} 
        />
      ) : (
        <Tournament 
          initialParticipants={tournamentState.participants} 
          modeType={tournamentState.mode}
          onReset={handleResetTournament}
        />
      )}
    </div>
  );
}
