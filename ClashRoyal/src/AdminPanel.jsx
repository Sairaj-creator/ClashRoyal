import { useState, useMemo } from 'react';
import './AdminPanel.css';

const ADMIN_PASSWORD = "admin123";
const PLAYER_STORAGE_KEY = "clash_player_data";

export default function AdminPanel({ data, onBack, onDataChange }) {
  // ── Auth ──────────────────────────────────────────────────────
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [pwError, setPwError] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setAuthenticated(true);
      setPwError('');
    } else {
      setPwError('Incorrect password. Try again.');
    }
  };

  // ── Player Data ───────────────────────────────────────────────
  const [players, setPlayers] = useState(() => [...data]);
  const [searchTerm, setSearchTerm] = useState('');

  // ── Add Form ──────────────────────────────────────────────────
  const [newName, setNewName] = useState('');
  const [newId, setNewId] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // ── Inline Edit ───────────────────────────────────────────────
  const [editIdx, setEditIdx] = useState(-1);
  const [editName, setEditName] = useState('');
  const [editId, setEditId] = useState('');

  // ── Derived ───────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return players.map((p, i) => ({ ...p, _idx: i }));
    const q = searchTerm.toLowerCase();
    return players
      .map((p, i) => ({ ...p, _idx: i }))
      .filter(p =>
        p["Member Name"].toLowerCase().includes(q) ||
        p["Aakriti ID"].toLowerCase().includes(q)
      );
  }, [players, searchTerm]);

  // ── Persist helper ────────────────────────────────────────────
  const persist = (updated) => {
    setPlayers(updated);
    try {
      localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn("Failed to save player data:", e);
    }
    onDataChange(updated);
  };

  // ── CRUD ──────────────────────────────────────────────────────
  const handleAdd = (e) => {
    e.preventDefault();
    const trimName = newName.trim();
    const trimId = newId.trim().toUpperCase();
    if (!trimName || !trimId) return;

    // Check for duplicate ID
    if (players.some(p => p["Aakriti ID"].toUpperCase() === trimId)) {
      alert(`A player with ID "${trimId}" already exists.`);
      return;
    }

    const updated = [...players, { "Member Name": trimName + " (Leader)", "Aakriti ID": trimId }];
    persist(updated);
    setNewName('');
    setNewId('');
    setShowAddForm(false);
  };

  const startEdit = (idx) => {
    const p = players[idx];
    setEditIdx(idx);
    setEditName(p["Member Name"]);
    setEditId(p["Aakriti ID"]);
  };

  const saveEdit = () => {
    if (editIdx < 0) return;
    const trimName = editName.trim();
    const trimId = editId.trim().toUpperCase();
    if (!trimName || !trimId) return;

    // Check for duplicate ID (exclude current)
    if (players.some((p, i) => i !== editIdx && p["Aakriti ID"].toUpperCase() === trimId)) {
      alert(`A player with ID "${trimId}" already exists.`);
      return;
    }

    const updated = players.map((p, i) =>
      i !== editIdx ? p : { "Member Name": trimName, "Aakriti ID": trimId }
    );
    persist(updated);
    setEditIdx(-1);
  };

  const cancelEdit = () => setEditIdx(-1);

  const handleDelete = (idx) => {
    const p = players[idx];
    if (!window.confirm(`Delete "${p["Member Name"]}" (${p["Aakriti ID"]})?`)) return;
    const updated = players.filter((_, i) => i !== idx);
    persist(updated);
    if (editIdx === idx) setEditIdx(-1);
  };

  // ── Export JSON ───────────────────────────────────────────────
  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(players, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "players-data.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Reset to original data.json ───────────────────────────────
  const resetToOriginal = () => {
    if (!window.confirm("Reset all player data to the original list? This will undo all admin changes.")) return;
    try { localStorage.removeItem(PLAYER_STORAGE_KEY); } catch (e) {}
    // We need to reload from the original import. Pass null to signal reset.
    onDataChange(null);
    onBack();
  };

  // ═══════════════════════════════════════════════════════════════
  //  RENDER — Login Gate
  // ═══════════════════════════════════════════════════════════════
  if (!authenticated) {
    return (
      <div className="admin-panel">
        <div className="admin-header">
          <div className="admin-header-left">
            <button className="btn btn-ghost btn-sm" onClick={onBack}>← Back</button>
          </div>
        </div>
        <div className="admin-login-wrap">
          <form className="admin-login-card" onSubmit={handleLogin}>
            <span className="lock-icon">🔒</span>
            <h2>Admin Access</h2>
            <p>Enter the admin password to manage players.</p>
            <input
              type="password"
              className="admin-pw-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setPwError(''); }}
              autoFocus
            />
            <div className="admin-pw-error">{pwError}</div>
            <button type="submit" className="btn btn-gold" style={{ width: '100%' }}>
              Unlock
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  //  RENDER — Admin Dashboard
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="admin-panel">
      {/* Header */}
      <div className="admin-header">
        <div className="admin-header-left">
          <button className="btn btn-ghost btn-sm" onClick={onBack}>← Back</button>
          <div>
            <div className="admin-title">⚙️ Admin Panel</div>
            <div className="admin-subtitle">Manage tournament player data</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn-export" onClick={exportJSON}>⬇ Export JSON</button>
          <button className="btn btn-red btn-sm" onClick={resetToOriginal}>🔄 Reset to Original</button>
        </div>
      </div>

      {/* Stats */}
      <div className="admin-stats">
        <div className="admin-stat">
          <div className="admin-stat-val">{players.length}</div>
          <div className="admin-stat-label">Total Players</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat-val">{filtered.length}</div>
          <div className="admin-stat-label">Showing</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="admin-toolbar">
        <input
          type="text"
          className="admin-search"
          placeholder="🔍 Search by name or ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <button
          className="btn btn-gold btn-sm"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? '✕ Cancel' : '+ Add Member'}
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <form className="admin-add-form" onSubmit={handleAdd}>
          <div className="form-group">
            <label>Member Name</label>
            <input
              type="text"
              placeholder="e.g. JOHN DOE"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Aakriti ID</label>
            <input
              type="text"
              placeholder="e.g. AK1234"
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-green btn-sm" disabled={!newName.trim() || !newId.trim()}>
            ✓ Add
          </button>
        </form>
      )}

      {/* Table */}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th>Member Name</th>
              <th>Aakriti ID</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="admin-empty">
                  {searchTerm ? 'No players match your search.' : 'No players yet. Add one above!'}
                </td>
              </tr>
            )}
            {filtered.map((p, displayIdx) => {
              const realIdx = p._idx;
              const isEditing = editIdx === realIdx;

              return (
                <tr key={realIdx}>
                  <td className="row-num">{displayIdx + 1}</td>
                  <td>
                    {isEditing ? (
                      <input
                        className="admin-inline-input"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                      />
                    ) : (
                      p["Member Name"]
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        className="admin-inline-input"
                        value={editId}
                        onChange={(e) => setEditId(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                      />
                    ) : (
                      <span style={{ color: 'var(--gold)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '1px' }}>
                        {p["Aakriti ID"]}
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="actions-cell">
                      {isEditing ? (
                        <>
                          <button className="btn-icon-sm save" onClick={saveEdit} title="Save">✓</button>
                          <button className="btn-icon-sm cancel" onClick={cancelEdit} title="Cancel">✕</button>
                        </>
                      ) : (
                        <>
                          <button className="btn-icon-sm edit" onClick={() => startEdit(realIdx)} title="Edit">✏️</button>
                          <button className="btn-icon-sm delete" onClick={() => handleDelete(realIdx)} title="Delete">🗑️</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
