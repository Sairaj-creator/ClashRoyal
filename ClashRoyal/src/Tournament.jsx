import { useState, useEffect, useRef, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════════
//  CORE UTILITIES
// ═══════════════════════════════════════════════════════════════════

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const parseNames = (text) =>
  text.split("\n").map((s) => s.trim()).filter(Boolean);

/**
 * DYNAMIC BYE LOGIC — with BYE history to prevent repeats
 * ──────────────────────────────────────────────────────────
 * byeHistory: Set of player names who have already received a BYE.
 *
 * Algorithm:
 *  1. If count is even → no BYE needed, pair normally.
 *  2. If count is odd  → pick BYE recipient:
 *       a. Prefer players NOT yet in byeHistory (fresh shuffle among them).
 *       b. If everyone has had a BYE, pick randomly from all (reset fairness).
 *  3. Remove BYE recipient from the pool, pair the rest.
 *  4. Return matches + the name of the BYE recipient (so caller can record it).
 */
const buildRound = (players, prefix = "r", byeHistory = new Set()) => {
  const ts = Date.now();
  const matches = [];
  let byePlayer = null;

  if (players.length % 2 !== 0) {
    // Candidates who have NOT yet had a BYE
    const fresh = players.filter((p) => !byeHistory.has(p));
    const pool  = fresh.length > 0 ? fresh : [...players]; // fallback: all eligible
    // Pick one at random from eligible candidates
    byePlayer = pool[Math.floor(Math.random() * pool.length)];
  }

  // Remaining players after removing BYE recipient
  const remaining = byePlayer
    ? shuffle(players.filter((p) => p !== byePlayer))
    : shuffle([...players]);

  for (let i = 0; i < remaining.length; i += 2) {
    matches.push({
      id: `${prefix}-${ts}-${i}`,
      p1: remaining[i],
      p2: remaining[i + 1],
      winner: null,
      isBye: false,
    });
  }

  if (byePlayer) {
    matches.push({
      id: `${prefix}-bye-${ts}`,
      p1: byePlayer,
      p2: null,
      winner: byePlayer,
      isBye: true,
      byeRecipient: byePlayer,
    });
  }

  return matches;
};

/**
 * CROSS ROUND BYE LOGIC — with BYE history
 * ──────────────────────────────────────────
 * Pool 1 winners vs Pool 2 winners (zipped).
 * Unequal counts → extras are handled with BYE history awareness.
 */
const buildCrossRound = (w1, w2, byeHistory = new Set()) => {
  const ts = Date.now();
  const matches = [];

  const sh1 = shuffle([...w1]);
  const sh2 = shuffle([...w2]);
  const pairCount = Math.min(sh1.length, sh2.length);

  // Zip the matched pairs
  for (let i = 0; i < pairCount; i++) {
    matches.push({
      id: `cross-${ts}-${i}`,
      p1: sh1[i],
      p2: sh2[i],
      winner: null,
      isBye: false,
    });
  }

  // Handle extra players from the longer pool
  const extras = sh1.length > sh2.length
    ? sh1.slice(pairCount)
    : sh2.slice(pairCount);

  if (extras.length === 1) {
    // Single extra — must get a BYE (no choice)
    matches.push({
      id: `cross-bye-${ts}`,
      p1: extras[0],
      p2: null,
      winner: extras[0],
      isBye: true,
      byeRecipient: extras[0],
    });
  } else if (extras.length > 1) {
    // Multiple extras — pair with BYE history awareness
    const extraMatches = buildRound(extras, `cross-extra-${ts}`, byeHistory);
    matches.push(...extraMatches);
  }

  return matches;
};

const getWinners  = (matches) => matches.map((m) => m.winner).filter(Boolean);
const allDecided  = (matches) => matches.length > 0 && matches.every((m) => m.winner !== null);

/** Auto-name a KO round by how many real (non-BYE) players are competing */
const roundLabel = (matches, roundIndex) => {
  const activePlayers = matches.reduce(
    (acc, m) => acc + (m.isBye ? 1 : 2), 0
  );
  if (activePlayers >= 16) return `Round of ${activePlayers}`;
  if (activePlayers >= 8)  return "⚡ Quarterfinal";
  if (activePlayers >= 4)  return "🔥 Semifinal";
  return `💥 KO Round ${roundIndex + 1}`;
};

// ═══════════════════════════════════════════════════════════════════
//  EXPORT / DOWNLOAD UTILITIES
// ═══════════════════════════════════════════════════════════════════

const triggerDownload = (text, filename) => {
  const blob = new Blob([text], { type: "text/plain" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

const LINE  = "─".repeat(52);
const DBL   = "═".repeat(52);

const fmtMatch = (m, idx) => {
  if (m.isBye)   return `  ${idx + 1}. ${m.p1} vs BYE  →  ${m.p1} advances (BYE)`;
  if (m.winner)  return `  ${idx + 1}. ${m.p1} vs ${m.p2}  →  Winner: ${m.winner}`;
  return           `  ${idx + 1}. ${m.p1} vs ${m.p2}  →  (pending)`;
};

const fmtRound = (title, matches) =>
  [`  [ ${title} ]`, `  ${LINE}`]
    .concat(matches.map((m, i) => fmtMatch(m, i)))
    .join("\n");

const poolsSection = (pool1, pool2) =>
  [
    DBL,
    "  POOLS",
    DBL,
    "",
    "  Pool 1:",
    ...pool1.map((p, i) => `    ${i + 1}. ${p}`),
    "",
    "  Pool 2:",
    ...pool2.map((p, i) => `    ${i + 1}. ${p}`),
  ].join("\n");

const koLabel = (round, ri) => {
  const n = round.reduce((a, m) => a + (m.isBye ? 1 : 2), 0);
  if (n >= 8) return "Quarterfinal";
  if (n >= 4) return "Semifinal";
  return `Knockout Round ${ri + 1}`;
};

// ── 1. Download Pools ─────────────────────────────────────────────
const buildPoolsText = (pool1, pool2) =>
  [
    DBL,
    "  TOURNAMENT POOLS",
    DBL,
    `  Generated: ${new Date().toLocaleString()}`,
    "",
    poolsSection(pool1, pool2),
    "",
    DBL,
  ].join("\n");

// ── 2. Download Current Structure (progressive) ───────────────────
const buildStructureText = (pool1, pool2, p1Rounds, p2Rounds, crossMatches, koRounds, finalMatch) => {
  const parts = [
    DBL,
    "  TOURNAMENT STRUCTURE",
    DBL,
    `  Generated: ${new Date().toLocaleString()}`,
    "",
    poolsSection(pool1, pool2),
  ];

  if (p1Rounds.length || p2Rounds.length) {
    parts.push("", DBL, "  POOL ROUNDS", DBL);
    p1Rounds.forEach((r, i) => parts.push("", fmtRound(`Pool 1 — Round ${i + 1}`, r)));
    p2Rounds.forEach((r, i) => parts.push("", fmtRound(`Pool 2 — Round ${i + 1}`, r)));
  }

  if (crossMatches.length) {
    parts.push("", DBL, "  CROSS ROUND", DBL, "");
    parts.push(fmtRound("Pool 1 Winners vs Pool 2 Winners", crossMatches));
  }

  if (koRounds.length) {
    parts.push("", DBL, "  KNOCKOUT STAGE", DBL);
    koRounds.forEach((r, ri) => parts.push("", fmtRound(koLabel(r, ri), r)));
  }

  if (finalMatch && !finalMatch.isBye) {
    parts.push("", DBL, "  GRAND FINAL", DBL, "");
    parts.push(fmtMatch(finalMatch, 0).replace(/^\s+\d+\.\s+/, "  "));
  }

  parts.push("", DBL);
  return parts.join("\n");
};

// ── 3. Download Full Tournament Summary ───────────────────────────
const buildFullText = (pool1, pool2, p1Rounds, p2Rounds, crossMatches, koRounds, finalMatch, champion, runnerUp, totalPlayers) => {
  const parts = [
    DBL,
    "  TOURNAMENT SUMMARY",
    DBL,
    `  Generated  : ${new Date().toLocaleString()}`,
    `  Players    : ${totalPlayers}`,
    `  Champion   : ${champion}`,
    runnerUp ? `  Runner-up  : ${runnerUp}` : null,
    "",
    poolsSection(pool1, pool2),
    "",
    DBL, "  POOL ROUNDS", DBL,
  ].filter((l) => l !== null);

  p1Rounds.forEach((r, i) => parts.push("", fmtRound(`Pool 1 — Round ${i + 1}`, r)));
  p2Rounds.forEach((r, i) => parts.push("", fmtRound(`Pool 2 — Round ${i + 1}`, r)));

  parts.push("", DBL, "  CROSS ROUND", DBL, "");
  parts.push(fmtRound("Pool 1 Winners vs Pool 2 Winners", crossMatches));

  if (koRounds.length) {
    parts.push("", DBL, "  KNOCKOUT STAGE", DBL);
    koRounds.forEach((r, ri) => parts.push("", fmtRound(koLabel(r, ri), r)));
  }

  if (finalMatch && !finalMatch.isBye) {
    parts.push("", DBL, "  GRAND FINAL", DBL, "");
    parts.push(`  ${finalMatch.p1} vs ${finalMatch.p2}  →  Winner: ${finalMatch.winner}`);
  }

  parts.push(
    "", DBL,
    "  FINAL RESULTS",
    DBL,
    "",
    `  🏆  CHAMPION   : ${champion}`,
    runnerUp ? `  🥈  RUNNER-UP  : ${runnerUp}` : "",
    "",
    DBL,
  );

  return parts.join("\n");
};

// ═══════════════════════════════════════════════════════════════════
//  CONFETTI
// ═══════════════════════════════════════════════════════════════════
function Confetti() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx    = canvas.getContext("2d");
    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    const COLORS = ["#F5C518","#FF6B35","#4FC3F7","#AED581","#F48FB1","#CE93D8","#FFCC02"];
    const pieces = Array.from({ length: 200 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * -window.innerHeight,
      w: Math.random() * 14 + 5,
      h: Math.random() * 7 + 3,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      vy: Math.random() * 3.5 + 1.5,
      vx: Math.random() * 2 - 1,
      ang: Math.random() * 360,
      spin: Math.random() * 6 - 3,
    }));
    let raf;
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach((p) => {
        p.y += p.vy; p.x += p.vx; p.ang += p.spin;
        if (p.y > canvas.height) { p.y = -20; p.x = Math.random() * canvas.width; }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.ang * Math.PI) / 180);
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={ref} style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:9999 }} />;
}


// ═══════════════════════════════════════════════════════════════════
//  MATCH CARD
// ═══════════════════════════════════════════════════════════════════
function MatchCard({ match, onWin, active }) {
  const { p1, p2, winner, isBye } = match;
  const canPick = active && !winner && !isBye;
  return (
    <div className={`match${winner ? " settled" : ""}${isBye ? " is-bye" : ""}`}>
      <button
        className={`mp${winner === p1 ? " won" : winner && winner !== p1 ? " lost" : ""}`}
        onClick={() => canPick && onWin(p1)}
        disabled={!canPick}
      >
        <span className="mp-dot" /><span className="mp-name">{p1}</span>
      </button>
      <div className="match-vs">VS</div>
      <button
        className={`mp${p2 === null ? " bye-slot" : winner === p2 ? " won" : winner && winner !== p2 ? " lost" : ""}`}
        onClick={() => canPick && p2 !== null && onWin(p2)}
        disabled={!canPick || p2 === null}
      >
        <span className="mp-dot" /><span className="mp-name">{p2 === null ? "— BYE —" : p2}</span>
      </button>
      {isBye && <div className="match-bye-bar">🎫 AUTO-ADVANCE</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  ROUND COLUMN
// ═══════════════════════════════════════════════════════════════════
function RoundCol({ title, matches, onWin, active, done, byeHistory = new Set() }) {
  const byeMatches = matches.filter((m) => m.isBye);
  return (
    <div className="round-col">
      <div className={`round-col-title${active ? " active" : done ? " done" : ""}`}>{title}</div>
      {byeMatches.map((m) => {
        const isRepeat = byeHistory.has(m.p1);
        return (
          <div key={m.id + "-note"} className="bye-note" style={isRepeat ? { color:"#FC8181", borderColor:"rgba(229,62,62,.35)", background:"rgba(229,62,62,.08)" } : {}}>
            🎫 <strong>{m.p1}</strong> gets a BYE{isRepeat ? " (2nd BYE — all others already had one)" : " — first time"}
          </div>
        );
      })}
      {matches.map((m, i) => (
        <MatchCard key={m.id} match={m} onWin={(p) => onWin(i, p)} active={active} />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  PHASE CONFIG
// ═══════════════════════════════════════════════════════════════════
const PHASES = [
  { key: "pools",     label: "Pools"     },
  { key: "pool-play", label: "Pool Play" },
  { key: "cross",     label: "Cross"     },
  { key: "knockout",  label: "Knockout"  },
  { key: "done",      label: "Champion"  },
];

// ═══════════════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════════════
export default function Tournament({ initialParticipants, modeType, onReset }) {
  const [phase, setPhase] = useState("pools");
  const [err, setErr] = useState("");

  // Players
  const [pool1, setPool1] = useState([]);
  const [pool2, setPool2] = useState([]);

  // Match state — each stage is its own array / array-of-arrays
  const [p1Rounds,     setP1Rounds]     = useState([]); // Pool 1 rounds
  const [p2Rounds,     setP2Rounds]     = useState([]); // Pool 2 rounds
  const [crossMatches, setCrossMatches] = useState([]); // Cross round
  const [koRounds,     setKoRounds]     = useState([]); // [ round1[], round2[], … ]
  const [finalMatch,   setFinalMatch]   = useState(null);

  // History & undo
  const [history,    setHistory]    = useState([]);
  const [snapshots,  setSnapshots]  = useState([]);
  // Tracks which players have already received a BYE — prevents same player getting BYE twice
  const [byeHistory, setByeHistory] = useState(new Set());

  // Initialization Effect
  useEffect(() => {
    if (!initialParticipants || initialParticipants.length === 0) return;
    
    // Helper to calculate split so Pool 1 is always even
    const getEvenSplitIndex = (total) => {
      let half = Math.ceil(total / 2);
      if (half % 2 !== 0) {
        // If half is odd, we adjust it to be even.
        // We can either go up or down. Usually we give Pool 1 slightly more or equal.
        // E.g., 75 / 2 = 37.5 -> Math.ceil = 38 (Even)
        // E.g., 73 / 2 = 36.5 -> Math.ceil = 37 (Odd) -> Make it 38
        half = half + 1;
        // make sure we don't accidentally take all players
        if (half >= total) half = half - 2; 
      }
      return half;
    };

    // Auto mode just shuffles and enforces the even/odd split
    if (modeType === 'auto') {
      const names = initialParticipants.map(p => p.name);
      const sh = shuffle(names);
      const splitIdx = getEvenSplitIndex(sh.length);
      setPool1(sh.slice(0, splitIdx));
      setPool2(sh.slice(splitIdx));
    } else {
      // Manual mode relies strictly on the `manualPool` assignment passed from the Manager
      const p1Names = initialParticipants.filter(p => p.manualPool === 1).map(p => p.name);
      const p2Names = initialParticipants.filter(p => p.manualPool === 2).map(p => p.name);
      setPool1(p1Names);
      setPool2(p2Names);
    }
  }, [initialParticipants, modeType]);

  // ── Derived ──────────────────────────────────────────────────────
  const phaseIdx     = PHASES.findIndex((p) => p.key === phase);
  const champion     = finalMatch?.winner ?? null;
  const runnerUp     = champion
    ? (finalMatch.p1 === champion ? finalMatch.p2 : finalMatch.p1)
    : null;
  const totalPlayers = pool1.length + pool2.length;
  const totalByes    = [
    ...p1Rounds.flat(), ...p2Rounds.flat(), ...crossMatches,
    ...koRounds.flat(), ...(finalMatch ? [finalMatch] : [])
  ].filter((m) => m.isBye).length;


  // ── Snapshot ──────────────────────────────────────────────────────
  const snap = useCallback(() => {
    setSnapshots((s) => [...s, {
      phase, p1Rounds, p2Rounds, crossMatches, koRounds, finalMatch,
      histLen: history.length, byeHistory: new Set(byeHistory),
    }]);
  }, [phase, p1Rounds, p2Rounds, crossMatches, koRounds, finalMatch, history.length, byeHistory]);

  const undo = () => {
    if (!snapshots.length) return;
    const prev = snapshots[snapshots.length - 1];
    setSnapshots((s) => s.slice(0, -1));
    setPhase(prev.phase);
    setP1Rounds(prev.p1Rounds);
    setP2Rounds(prev.p2Rounds);
    setCrossMatches(prev.crossMatches);
    setKoRounds(prev.koRounds);
    setFinalMatch(prev.finalMatch);
    setHistory((h) => h.slice(0, prev.histLen));
    setByeHistory(prev.byeHistory ?? new Set());
  };

  // ── Generic pick-winner for pool rounds ─────────────────────
  const pickP1 = (ri, mi, player) => {
    if (!player) return;
    snap();
    setP1Rounds((rounds) =>
      rounds.map((r, i) =>
        i !== ri ? r : r.map((m, j) => j !== mi ? m : { ...m, winner: player })
      )
    );
    const m = p1Rounds[ri][mi];
    const loser = m.p1 === player ? m.p2 : m.p1;
    if (loser) setHistory((h) => [...h, { winner: player, loser, tag: `Pool 1 R${ri + 1}` }]);
  };

  const pickP2 = (ri, mi, player) => {
    if (!player) return;
    snap();
    setP2Rounds((rounds) =>
      rounds.map((r, i) =>
        i !== ri ? r : r.map((m, j) => j !== mi ? m : { ...m, winner: player })
      )
    );
    const m = p2Rounds[ri][mi];
    const loser = m.p1 === player ? m.p2 : m.p1;
    if (loser) setHistory((h) => [...h, { winner: player, loser, tag: `Pool 2 R${ri + 1}` }]);
  };

  const pickIn = (list, setList, idx, player, tag) => {
    if (!player) return;
    snap();
    setList(list.map((m, i) => i !== idx ? m : { ...m, winner: player }));
    const loser = list[idx].p1 === player ? list[idx].p2 : list[idx].p1;
    if (loser) setHistory((h) => [...h, { winner: player, loser, tag }]);
  };

  // ── Knockout round pick ───────────────────────────────────────────
  const pickKO = (ri, mi, player) => {
    if (!player) return;
    snap();
    setKoRounds((rounds) =>
      rounds.map((r, i) =>
        i !== ri ? r : r.map((m, j) => j !== mi ? m : { ...m, winner: player })
      )
    );
    const m = koRounds[ri][mi];
    const loser = m.p1 === player ? m.p2 : m.p1;
    if (loser) setHistory((h) => [...h, { winner: player, loser, tag: `KO R${ri + 1}` }]);
  };

  // ── Final pick ────────────────────────────────────────────────────
  const pickFinal = (player) => {
    if (!player || !finalMatch) return;
    snap();
    setFinalMatch((fm) => ({ ...fm, winner: player }));
    const loser = finalMatch.p1 === player ? finalMatch.p2 : finalMatch.p1;
    if (loser) setHistory((h) => [...h, { winner: player, loser, tag: "Final" }]);
    setPhase("done");
  };

  // ═══════════════════════════════════════════════════════════════════
  //  STAGE TRANSITIONS
  // ═══════════════════════════════════════════════════════════════════

  // Pools → pool-play
  const startPoolPlay = () => {
    const m1 = buildRound(pool1, "p1-r0", byeHistory);
    const m2 = buildRound(pool2, "p2-r0", byeHistory);
    // Record any BYE recipients from both pools
    const newByes = new Set(byeHistory);
    [...m1, ...m2].filter((m) => m.isBye).forEach((m) => newByes.add(m.p1));
    setByeHistory(newByes);
    setP1Rounds([m1]);
    setP2Rounds([m2]);
    setPhase("pool-play");
  };

  const advancePools = () => {
    const lastP1 = p1Rounds[p1Rounds.length - 1];
    const lastP2 = p2Rounds[p2Rounds.length - 1];
    
    if (!allDecided(lastP1) || !allDecided(lastP2)) {
      setErr("Decide all pool matches before advancing."); return;
    }
    setErr("");

    const w1 = getWinners(lastP1);
    const w2 = getWinners(lastP2);

    const m1 = buildRound(w1, `p1-r${p1Rounds.length}`, byeHistory);
    const m2 = buildRound(w2, `p2-r${p2Rounds.length}`, byeHistory);
    
    const newByes = new Set(byeHistory);
    [...m1, ...m2].filter((m) => m.isBye).forEach((m) => newByes.add(m.p1));
    setByeHistory(newByes);

    setP1Rounds([...p1Rounds, m1]);
    setP2Rounds([...p2Rounds, m2]);
  };

  // Pool-play → cross
  const startCross = () => {
    const lastP1 = p1Rounds[p1Rounds.length - 1];
    const lastP2 = p2Rounds[p2Rounds.length - 1];

    if (!allDecided(lastP1) || !allDecided(lastP2)) {
      setErr("All pool matches must be decided before crossing over."); return;
    }
    setErr("");
    
    const w1 = getWinners(lastP1);
    const w2 = getWinners(lastP2);
    const cross = buildCrossRound(w1, w2, byeHistory);
    // Record any new BYE recipients
    const newByes = new Set(byeHistory);
    cross.filter((m) => m.isBye).forEach((m) => newByes.add(m.p1));
    setByeHistory(newByes);
    setCrossMatches(cross);
    setKoRounds([]);
    setFinalMatch(null);
    setPhase("cross");
  };

  // Cross / KO → next round — BYE history prevents repeat recipients
  const advanceRound = () => {
    const src = phase === "cross"
      ? crossMatches
      : koRounds[koRounds.length - 1];

    if (!allDecided(src)) { setErr("Decide all matches before advancing."); return; }
    setErr("");

    const ws = getWinners(src);

    if (ws.length === 1) {
      setFinalMatch({ id: "final-solo", p1: ws[0], p2: null, winner: ws[0], isBye: true });
      setPhase("done");
      return;
    }

    if (ws.length === 2) {
      setFinalMatch({ id: "final", p1: ws[0], p2: ws[1], winner: null, isBye: false });
      setPhase("knockout");
      return;
    }

    // Build next KO round — pass byeHistory so repeat BYEs are avoided
    const next = buildRound(ws, `ko${koRounds.length}`, byeHistory);
    // Update byeHistory with any new BYE recipients from this round
    const newByes = new Set(byeHistory);
    next.filter((m) => m.isBye).forEach((m) => newByes.add(m.p1));
    setByeHistory(newByes);
    setKoRounds((r) => [...r, next]);
    setPhase("knockout");
  };

  // Reset
  const reset = () => {
    if (window.confirm("Return to Participant Manager? This will discard the current bracket.")) {
        onReset();
    }
  };

  const downloadHistory = () => {
    const txt = history.map((h) => `[${h.tag}] ${h.winner} defeated ${h.loser}`).join("\n");
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([txt], { type: "text/plain" })),
      download: "match-history.txt",
    });
    a.click();
  };

  // ── Export: Pools ─────────────────────────────────────────────────
  const downloadPools = () =>
    triggerDownload(buildPoolsText(pool1, pool2), "tournament-pools.txt");

  // ── Export: Current Structure ─────────────────────────────────────
  const downloadTournamentStructure = () =>
    triggerDownload(
      buildStructureText(pool1, pool2, p1Rounds, p2Rounds, crossMatches, koRounds, finalMatch),
      "tournament-structure.txt"
    );

  // ── Export: Full Summary ──────────────────────────────────────────
  const downloadFullTournament = () =>
    triggerDownload(
      buildFullText(pool1, pool2, p1Rounds, p2Rounds, crossMatches, koRounds, finalMatch, champion, runnerUp, totalPlayers),
      "tournament-summary.txt"
    );

  // ── Helpers ───────────────────────────────────────────────────────
  const pct = { pools:0, "pool-play":25, cross:50, knockout:75, done:100 }[phase] ?? 0;
  const oddBye   = (n) => n % 2 !== 0;

  // Current KO round
  const curKO          = koRounds[koRounds.length - 1] ?? [];
  const curKODecided   = curKO.filter((m) => m.winner).length;
  const isFinalPending = finalMatch && !finalMatch.winner && !finalMatch.isBye;

  // BYE recipient this round (for the next-bar info)
  const currentByePlayer = (() => {
    if (phase === "pool-play") {
      const b1 = p1Rounds[p1Rounds.length - 1]?.find((m) => m.isBye)?.p1;
      const b2 = p2Rounds[p2Rounds.length - 1]?.find((m) => m.isBye)?.p1;
      return [b1, b2].filter(Boolean).join(" & ") || null;
    }
    if (phase === "cross") return crossMatches.find((m) => m.isBye)?.p1 ?? null;
    if (phase === "knockout" && !finalMatch) return curKO.find((m) => m.isBye)?.p1 ?? null;
    return null;
  })();

  // ═══════════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════════
  return (
    <>
      {phase === "done" && champion && <Confetti />}

      {/* ── Header ── */}
      <div className="hdr">
        <span className="hdr-crown">👑</span>
        <h1 className="hdr-title">Clash Royale<br />Tournament</h1>
        <p className="hdr-sub">Pools · Cross · Knockout · Champion</p>
      </div>

      {/* ── Progress ── */}
      <div className="prog-wrap"><div className="prog-fill" style={{ width: `${pct}%` }} /></div>

      {/* ── Stepper ── */}
      <div className="stepper">
        {PHASES.map((p, i) => (
          <div key={p.key} className="step">
            <div className="step-inner">
              <div className={`step-dot${phaseIdx > i ? " done" : phaseIdx === i ? " active" : ""}`}>
                {phaseIdx > i ? "✓" : i + 1}
              </div>
              <div className={`step-label${phaseIdx === i ? " active" : ""}`}>{p.label}</div>
            </div>
            {i < PHASES.length - 1 && <div className={`step-line${phaseIdx > i ? " done" : ""}`} />}
          </div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div className="toolbar">
        {snapshots.length > 0 && <button className="btn btn-ghost btn-sm" onClick={undo}>↩ Undo</button>}
        {history.length > 0   && <button className="btn btn-ghost btn-sm" onClick={downloadHistory}>⬇ History</button>}
        <button className="btn btn-red btn-sm" style={{ marginLeft:"auto" }} onClick={reset}>← Back to Manager</button>
      </div>

      {/* ── Error ── */}
      {err && <div className="alert">⚠ {err}</div>}

      {/* ── Stats ── */}
      {totalPlayers > 0 && (
        <div className="stats">
          <div className="stat"><div className="stat-v">{totalPlayers}</div><div className="stat-l">Players</div></div>
          <div className="stat"><div className="stat-v">{pool1.length}</div><div className="stat-l">Pool 1</div></div>
          <div className="stat"><div className="stat-v">{pool2.length}</div><div className="stat-l">Pool 2</div></div>
          <div className="stat"><div className="stat-v green">{history.length}</div><div className="stat-l">Played</div></div>
          {totalByes > 0 && <div className="stat"><div className="stat-v bye">{totalByes}</div><div className="stat-l">Total BYEs</div></div>}
        </div>
      )}

      {/* ════════════ POOLS PREVIEW ════════════ */}
      {phase === "pools" && (
        <div>
          <div className="info">
            ℹ️ <span>BYEs are <strong>reassigned every round</strong> based on who advances. If a pool has an odd number of players, a randomly selected player receives a BYE — a different player may receive the BYE in subsequent rounds.</span>
          </div>
          <div className="pool-grid">
            <div className="card card-gold">
              <div className="pool-hdr">
                <span className="pool-tag p1">Pool 1</span>
                <span className="pool-count">{pool1.length} players</span>
                {oddBye(pool1.length) && <span className="badge badge-bye">🎫 odd — 1 BYE/round</span>}
              </div>
              <div className="chips">
                {pool1.map((p, i) => (
                  <span key={i} className="chip"><span className="chip-num g">{i+1}</span>{p}</span>
                ))}
              </div>
            </div>
            <div className="card card-purple">
              <div className="pool-hdr">
                <span className="pool-tag p2">Pool 2</span>
                <span className="pool-count">{pool2.length} players</span>
                {oddBye(pool2.length) && <span className="badge badge-bye">🎫 odd — 1 BYE/round</span>}
              </div>
              <div className="chips">
                {pool2.map((p, i) => (
                  <span key={i} className="chip"><span className="chip-num p">{i+1}</span>{p}</span>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
            <button className="btn btn-gold" onClick={startPoolPlay}>⚔️ Start Pool Matches</button>
            <button className="btn-export" onClick={downloadPools}>⬇ Download Pools</button>
          </div>
        </div>
      )}

      {/* ════════════ POOL-PLAY ════════════ */}
      {phase === "pool-play" && (
        <div>
          <div className="next-bar">
            { (p1Rounds.length > 0 && p2Rounds.length > 0) && (getWinners(p1Rounds[p1Rounds.length - 1]).length > 1 || getWinners(p2Rounds[p2Rounds.length - 1]).length > 1) && (
              <button className="btn btn-blue" onClick={advancePools} style={{ marginRight: 8 }}>Next Pool Round →</button>
            )}
            <button className="btn btn-purple" onClick={startCross}>Cross Round →</button>
            <span className="hint" style={{ marginLeft: 8 }}>
              { p1Rounds.length > 0 && p2Rounds.length > 0 ? (
                <>
                  P1: <strong>{p1Rounds[p1Rounds.length - 1].filter(m=>m.winner).length}/{p1Rounds[p1Rounds.length - 1].length}</strong> ·
                  P2: <strong>{p2Rounds[p2Rounds.length - 1].filter(m=>m.winner).length}/{p2Rounds[p2Rounds.length - 1].length}</strong>
                </>
              ) : null }
            </span>
            {currentByePlayer && (
              <span className="bye-rotation">🎫 BYE this round: <strong>{currentByePlayer}</strong></span>
            )}
          </div>
          {p1Rounds.length > 0 && p2Rounds.length > 0 && allDecided(p1Rounds[p1Rounds.length - 1]) && allDecided(p2Rounds[p2Rounds.length - 1]) && (
            <div className="export-bar">
              <span>📄 Export:</span>
              <button className="btn-export" onClick={downloadTournamentStructure}>⬇ Download Current Structure</button>
            </div>
          )}
          <div className="bracket-scroll">
            <div className="bracket-row">
              {p1Rounds.map((round, ri) => (
                <RoundCol
                  key={`p1-${ri}`}
                  title={`🟡 Pool 1 - R${ri + 1}`}
                  matches={round}
                  onWin={(i, p) => pickP1(ri, i, p)}
                  active={ri === p1Rounds.length - 1}
                  done={ri < p1Rounds.length - 1}
                  byeHistory={byeHistory}
                />
              ))}
              
              <div style={{ width: 2, background: "var(--rim)", opacity: 0.5, margin: "0 16px" }} />

              {p2Rounds.map((round, ri) => (
                <RoundCol
                  key={`p2-${ri}`}
                  title={`🟣 Pool 2 - R${ri + 1}`}
                  matches={round}
                  onWin={(i, p) => pickP2(ri, i, p)}
                  active={ri === p2Rounds.length - 1}
                  done={ri < p2Rounds.length - 1}
                  byeHistory={byeHistory}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ════════════ CROSS ROUND ════════════ */}
      {phase === "cross" && (
        <div>
          <div className="info">
            ℹ️ <span>Pool 1 winners face Pool 2 winners. If pools produced unequal winners, extras are re-paired among themselves — and if still odd, a randomly selected player receives a BYE for this round.</span>
          </div>
          <div className="next-bar">
            <button className="btn btn-blue" onClick={advanceRound}>Knockout Stage →</button>
            <span className="hint">Cross: <strong>{crossMatches.filter(m=>m.winner).length}/{crossMatches.length}</strong> decided</span>
            {currentByePlayer && (
              <span className="bye-rotation">🎫 BYE this round: <strong>{currentByePlayer}</strong></span>
            )}
          </div>
          {allDecided(crossMatches) && (
            <div className="export-bar">
              <span>📄 Export:</span>
              <button className="btn-export" onClick={downloadTournamentStructure}>⬇ Download Current Structure</button>
            </div>
          )}
          <div className="bracket-scroll">
            <div className="bracket-row">
              <RoundCol
                title="⚔️ Cross Round"
                matches={crossMatches}
                onWin={(i, p) => pickIn(crossMatches, setCrossMatches, i, p, "Cross")}
                active={true}
                byeHistory={byeHistory}
              />
            </div>
          </div>
        </div>
      )}

      {/* ════════════ KNOCKOUT ════════════ */}
      {phase === "knockout" && (
        <div>
          {/* Advance button — only when final isn't set yet */}
          {!finalMatch && (
            <div className="next-bar">
              <button className="btn btn-green" onClick={advanceRound}>Next Round →</button>
              <span className="hint">
                {curKO.length > 0 && <>
                  <strong>{curKODecided}/{curKO.length}</strong> decided
                </>}
              </span>
              {currentByePlayer && (
                <span className="bye-rotation">🎫 BYE this round: <strong>{currentByePlayer}</strong></span>
              )}
            </div>
          )}
          {/* Show export after each KO round is fully decided */}
          {!finalMatch && curKO.length > 0 && allDecided(curKO) && (
            <div className="export-bar">
              <span>📄 Export:</span>
              <button className="btn-export" onClick={downloadTournamentStructure}>⬇ Download Current Structure</button>
            </div>
          )}

          {/* Final prompt */}
          {isFinalPending && (
            <div className="next-bar" style={{ justifyContent:"center" }}>
              <span className="hint" style={{ fontSize:"1rem" }}>
                🏆 <strong>Grand Final</strong> — click the winner to crown the champion
              </span>
            </div>
          )}

          <div className="bracket-scroll">
            <div className="bracket-row">
              {/* All KO rounds */}
              {koRounds.map((round, ri) => {
                const isLast = ri === koRounds.length - 1;
                return (
                  <RoundCol
                    key={ri}
                    title={roundLabel(round, ri)}
                    matches={round}
                    onWin={(i, p) => pickKO(ri, i, p)}
                    active={isLast && !finalMatch}
                    done={!isLast}
                    byeHistory={byeHistory}
                  />
                );
              })}

              {/* Grand Final */}
              {finalMatch && !finalMatch.isBye && (
                <RoundCol
                  title="🏆 Grand Final"
                  matches={[finalMatch]}
                  onWin={(_, p) => pickFinal(p)}
                  active={!champion}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════════════ CHAMPION ════════════ */}
      {phase === "done" && champion && (
        <div className="champion-wrap">
          <div className="champion-card">
            <span className="champ-trophy">🏆</span>
            <div className="champ-label">Tournament Champion</div>
            <div className="champ-name">{champion}</div>
            {runnerUp && <div className="champ-runner">🥈 Runner-up: <strong>{runnerUp}</strong></div>}
            <div className="champ-meta" style={{ marginTop:10 }}>
              {totalPlayers} players · {history.length} matches · {totalByes} BYEs across all rounds
            </div>
            <div style={{ display:"flex", gap:10, marginTop:22, flexWrap:"wrap", justifyContent:"center" }}>
              <button className="btn btn-gold" onClick={reset}>🔄 Back to Manager</button>
              <button className="btn-export" style={{ padding:"9px 20px", fontSize:".88rem" }} onClick={downloadFullTournament}>⬇ Download Full Tournament</button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════ HISTORY ════════════ */}
      {history.length > 0 && (
        <div className="hist">
          <div className="hist-hdr">
            <span className="hist-hdr-title">⚔️ Match History ({history.length})</span>
            <button className="btn btn-ghost btn-sm" onClick={downloadHistory}>⬇ Download</button>
          </div>
          <div className="hist-body">
            {[...history].reverse().map((h, i) => (
              <div key={i} className="hist-row">
                <strong>{h.winner}</strong>
                <span style={{ color:"var(--rim)" }}>def.</span>
                <span>{h.loser}</span>
                <span className="phase-tag">{h.tag}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
