import { useState, useMemo } from 'react';

const DUMMY_DATA = [
  { "Member Name": "M VIGNESH (Leader)", "Aakriti ID": "AK0297" },
  { "Member Name": "SATWIK R NAIK (Leader)", "Aakriti ID": "AK0665" },
];

export default function ParticipantManager({ data = DUMMY_DATA, onStartTournament }) {
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Process and format names (Remove "(Leader)")
  const participants = useMemo(() => {
    return data.map((p) => ({
      name: p["Member Name"].replace(/\s*\(Leader\)\s*/i, ""),
      id: p["Aakriti ID"],
      raw: p["Member Name"]
    }));
  }, [data]);

  // 2. Attendance State (default all present)
  const [presentIds, setPresentIds] = useState(() => new Set());
  // 3. Manual Pool Selection (default all Pool 1)
  const [poolAssignments, setPoolAssignments] = useState(() => {
    const map = new Map();
    participants.forEach(p => map.set(p.id, 1));
    return map;
  });

  const toggleAttendance = (id) => {
    const next = new Set(presentIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPresentIds(next);
  };

  const setPoolChoice = (e, id, poolNumber) => {
    e.stopPropagation(); // prevent triggering the card's onClick (attendance toggle)
    const next = new Map(poolAssignments);
    next.set(id, poolNumber);
    setPoolAssignments(next);
  };

  const markAll = (present) => {
    if (present) setPresentIds(new Set(participants.map(p => p.id)));
    else setPresentIds(new Set());
  };

  // 4. Filter by search
  const filteredParticipants = participants.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const presentCount = presentIds.size;
  const totalCount = participants.length;

  const handleStart = (mode) => {
    // Only pass players who are present
    const activeParticipants = participants.filter(p => presentIds.has(p.id));
    
    // Inject the manual pool choice directly into the participant objects
    const mappedParticipants = activeParticipants.map(p => ({
      ...p,
      manualPool: poolAssignments.get(p.id) || 1
    }));

    onStartTournament(mappedParticipants, mode);
  };

  return (
    <div className="participant-manager">
      <div className="pm-header">
        <div>
          <h1 className="pm-title">Tournament Participants</h1>
          <p className="pm-subtitle">Select participants who are present today before starting.</p>
        </div>
        <div className="pm-actions">
          <button 
            className="btn btn-gold action-btn" 
            onClick={() => handleStart('auto')}
            disabled={presentCount < 2}
          >
            <span className="btn-icon">⚡</span> Auto Split ({presentCount})
          </button>
          <button 
            className="btn btn-purple-outline action-btn"
            onClick={() => handleStart('manual')}
            disabled={presentCount < 2}
          >
            <span className="btn-icon">⚙️</span> Manual ({presentCount})
          </button>
        </div>
      </div>

      <div className="pm-search-container">
        <input
          type="text"
          className="pm-search-bar"
          placeholder="Search players by Name or ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <span className="pm-search-icon">🔍</span>
        
        <div className="pm-attendance-controls">
           <span className="pm-stat-badge">{presentCount} / {totalCount} Present</span>
           <button className="btn-ghost btn-sm" onClick={() => markAll(true)}>Select All</button>
           <button className="btn-ghost btn-sm" onClick={() => markAll(false)}>Clear</button>
        </div>
      </div>

      <div className="pm-grid">
        {filteredParticipants.map((p) => {
          const isPresent = presentIds.has(p.id);
          return (
            <div 
              key={p.id} 
              className={`pm-card ${isPresent ? 'is-present' : 'is-absent'}`}
              onClick={() => toggleAttendance(p.id)}
            >
              <div className="pm-card-top">
                <div className="pm-avatar">
                  <span className="pm-crown">{isPresent ? '👑' : '💤'}</span>
                </div>
                <div className="pm-status-badge">
                  {isPresent ? 'PRESENT' : 'ABSENT'}
                </div>
              </div>
              <div className="pm-card-body">
                <h3 className="pm-name">{p.name}</h3>
                <div className="pm-id-text">{p.id}</div>
              </div>
              
              {/* Pool Selection Controls */}
              {isPresent && (
                <div className="pm-pool-toggles">
                  <button
                    className={`pm-pool-btn ${poolAssignments.get(p.id) === 1 ? 'active p1' : ''}`}
                    onClick={(e) => setPoolChoice(e, p.id, 1)}
                  >
                    Pool 1
                  </button>
                  <button
                    className={`pm-pool-btn ${poolAssignments.get(p.id) === 2 ? 'active p2' : ''}`}
                    onClick={(e) => setPoolChoice(e, p.id, 2)}
                  >
                    Pool 2
                  </button>
                </div>
              )}

              <div className="pm-card-glow"></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
