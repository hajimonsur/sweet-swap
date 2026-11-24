document.addEventListener("DOMContentLoaded", () => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const N = 8,
    COLORS = ["red", "blue", "green", "yellow", "purple", "orange"];
  const PALETTE = [
    "#ff174b",
    "#009bff",
    "#26e52b",
    "#ffe000",
    "#c32aff",
    "#ff8300",
  ];
  const board = $("game-board"),
    effects = $("effects");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let grid = [],
    cells = [],
    score = 0,
    best = 0,
    startingBest = 0;
  let time = 180000,
    deadline = 0,
    timer,
    state = "ready",
    busy = false,
    version = 0;
  let selected = -1,
    pointer = null,
    moves = 0,
    cleared = 0,
    combo = 1,
    bestCombo = 0;
  let level = 1,
    energy = 0,
    rushUntil = 0,
    shuffles = 3,
    sound = true,
    audio;
  let hintTimer,
    messageTimer,
    idleTimer,
    achievements = new Set();
  const MODES = {
    timed: {
      label: "⏱ TIME LEFT",
      description: "3 minutes. Match fast and earn extra time!",
      key: "highScore",
    },
    moves: {
      label: "🎯 MOVES LEFT",
      description: "Complete progressive candy missions. No countdown!",
      key: "sweetSwapChallengeBest",
    },
    endless: {
      label: "♾ MODE",
      description: "No timer or move limit. Relax and chase your best score!",
      key: "sweetSwapEndlessBest",
    },
  };
  let mode = "timed",
    rushMoves = 0,
    rushGeneration = 0,
    helpPaused = false;
  let stage = 1,
    unlocked = 1,
    collected = 0,
    activated = 0;
  try {
    unlocked = Math.max(
      1,
      Math.min(
        100000,
        Math.floor(Number(localStorage.getItem("sweetSwapStage")) || 1),
      ),
    );
  } catch (_) {}
  const storeKey = "sweetSwap6";
  let runRewards = {}, undoFinance = null, undoAfter = null;
  let runSpecials = 0;
  const rewardTotal = () => Object.values(runRewards).reduce((a,b) => a+b,0);
  function creditCoins(amount, reason, track = true) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    profile.coins += amount;
    if (track) runRewards[reason] = (runRewards[reason] || 0) + amount;
    updateCoins();
    if (track && effects && cells.length) {
      const existing = effects.querySelector('.coin-float');
      const combined = amount + Number(existing?.dataset.amount || 0);
      existing?.remove();
      const el = document.createElement('div');
      el.dataset.amount = combined; el.className = 'coin-float'; el.textContent = `+${combined} COINS`;
      effects.append(el); setTimeout(() => el.remove(), 1400);
    }
  }
  function updateCoins() { $('coin-count').textContent = Math.floor(profile.coins).toLocaleString(); }
  function finance() { return copy({coins:profile.coins, stats:profile.stats, badges:profile.badges, inventory:profile.inventory, rewards:runRewards, best, specials:runSpecials}); }
  function commitBest() { try { localStorage.setItem(MODES[mode].key, String(best)); } catch (_) {} }
  function invalidateUndo() { undo = null; undoFinance = null; undoAfter = null; }
  function canUndo() { return !!undo && !undoUsed && !!undoFinance && undoAfter === JSON.stringify(finance()); }
  function stableCheckpoint() { if (!busy) { commitBest(); saveGame(); } }

  const SURVIVAL_CAP = 30;
  const SURVIVAL_MILESTONES = [[25, 25], [50, 50], [100, 100], [200, 200], [500, 300], [1000, 500]];
  const fresh = () => ({
    coins: 300,
    unlocked: Math.min(100, unlocked),
    stars: {},
    inventory: {
      hammer: 2,
      bomb: 1,
      blast: 1,
      shuffle: 1,
      moves: 1,
      time: 1,
      free: 1,
      rush: 1,
    },
    theme: "classic",
    themes: ["classic"],
    stats: {
      games: 0,
      wins: 0,
      cleared: 0,
      specials: 0,
      rainbows: 0,
      bombs: 0,
      rushes: 0,
      bestCombo: 0,
      survivalBestMoves: 0,
      survivalMilestones: [],
    },
    badges: [],
    daily: "",
    streak: 0,
    reward: "",
    settings: { music: 0.27, sfx: 0.65, voice: true, vibrate: true, track: 0 },
    save: null,
  });
  let profile = fresh();
  try {
    const raw = JSON.parse(localStorage.getItem(storeKey));
    if (raw)
      profile = {
        ...profile,
        ...raw,
        settings: { ...profile.settings, ...raw.settings },
        stats: { ...profile.stats, ...raw.stats },
      };
  } catch (_) {}
  unlocked = profile.unlocked;
  let obstacles = {},
    survivalLeft = 15,
    undo = null,
    booster = null,
    freeSwap = false,
    madeRainbow = 0,
    pendingPause = false,
    dailySeed = null;
  const copy = (x) => JSON.parse(JSON.stringify(x));
  const persist = () => {
    if (busy) return;
    try {
      localStorage.setItem(storeKey, JSON.stringify(profile));
    } catch (_) {}
  };
  const dateKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const yesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  MODES.daily = {
    label: "📅 MOVES LEFT",
    description: "A fresh mission every day!",
    key: "sweetSwapDailyBest",
  };
  MODES.survival = {
    label: "🔥 MOVES LEFT",
    description: "Start with 15 moves. Specials, combos, levels and Sugar Rush earn more!",
    key: "sweetSwapSurvivalBest",
  };
  const missionMode = () => mode === "moves" || mode === "daily";
  function mission() {
    const s =
      mode === "daily"
        ? 1 + (Number((dailySeed || dateKey()).replaceAll("-", "")) % 100)
        : stage;
    const cycle = Math.floor((s - 1) / 10),
      slot = (s - 1) % 10,
      color = COLORS[cycle % 6],
      m = Math.max(22, 32 - cycle);
    return [
      { kind: "score", target: 100 + cycle * 20 },
      { kind: "color", color, target: 15 + cycle },
      { kind: "clear", target: 60 + cycle * 5 },
      { kind: "special", target: 2 + Math.floor(cycle / 3) },
      { kind: "ice", target: 5 + cycle },
      { kind: "jelly", target: 6 + cycle },
      { kind: "lock", target: 4 + cycle },
      { kind: "chocolate", target: 4 + cycle },
      { kind: "combo", target: 2 + Math.floor(cycle / 4) },
      { kind: "rainbow", target: 1 + Math.floor(cycle / 5) },
    ].map((x) => ({ ...x, moves: m }))[slot];
  }
  function missionValue() {
    const m = mission();
    return {
      score,
      color: collected,
      clear: cleared,
      special: activated,
      combo: bestCombo,
      rainbow: madeRainbow,
      ice: m.target - Object.keys(obstacles).length,
      jelly: m.target - Object.keys(obstacles).length,
      lock: m.target - Object.keys(obstacles).length,
      chocolate:
        Object.keys(obstacles).length === 0
          ? m.target
          : Math.max(0, m.target - Object.keys(obstacles).length),
    }[m.kind];
  }
  function missionLabel() {
    const m = mission();
    return {
      score: `${m.target} points`,
      color: `collect ${m.target} ${m.color}`,
      clear: `clear ${m.target} candies`,
      special: `activate ${m.target} specials`,
      combo: `combo ×${m.target}`,
      rainbow: `create ${m.target} rainbows`,
      ice: "break all ice",
      jelly: "clear all jelly",
      lock: "unlock all candies",
      chocolate: "clear all chocolate",
    }[m.kind];
  }
  function missionProgress() {
    const m = mission();
    return `${missionValue()}/${m.target} • ${missionLabel()}`;
  }
  function setupObstacles() {
    obstacles = {};
    if (!missionMode()) return;
    const m = mission();
    if (!["ice", "jelly", "lock", "chocolate"].includes(m.kind)) return;
    while (Object.keys(obstacles).length < m.target) {
      const i = Math.floor(rng() * 64);
      obstacles[i] = m.kind;
    }
  }
  function blocked(i) {
    return obstacles[i] === "lock" || obstacles[i] === "chocolate";
  }
  function snapshot() {
    return copy({
      grid,
      score,
      time,
      moves,
      cleared,
      bestCombo,
      level,
      energy,
      rushUntil,
      rushMoves,
      rushGeneration,
      shuffles,
      stage,
      mode,
      collected,
      activated,
      obstacles,
      survivalLeft,
      madeRainbow,
      dailySeed,
      extraMoves,
      undoUsed,
      randomState,
      freeSwap,
      booster,
      runRewards, runSpecials, startingBest,
    });
  }
  function saveGame() {
    if (["playing", "paused"].includes(state) && !busy) {
      profile.save = snapshot();
      persist();
    }
  }
  function restore(s) {
    ({
      grid,
      score,
      time,
      moves,
      cleared,
      bestCombo,
      level,
      energy,
      rushUntil,
      rushMoves,
      rushGeneration,
      shuffles,
      stage,
      mode,
      collected,
      activated,
      obstacles,
      survivalLeft,
      madeRainbow,
      dailySeed,
      extraMoves = 0,
      undoUsed = false,
      randomState = 0,
      freeSwap = false,
      booster = null,
      runRewards = {}, runSpecials = 0,
    } = copy(s));
    if (mode === "survival") survivalLeft = Math.max(0, Math.min(SURVIVAL_CAP, survivalLeft));
    best = loadBest();
    startingBest = Number.isFinite(s.startingBest) ? s.startingBest : best;
    selected = -1;
    combo = 1;
    render();
    update();
  }
  function announce(text) {
    if (profile.settings.voice && "speechSynthesis" in window) {
      try {
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 1.1;
        u.volume = profile.settings.sfx * 0.7;
        speechSynthesis.cancel();
        speechSynthesis.speak(u);
      } catch (_) {}
    }
  }
  function vibrate(ms) {
    if (profile.settings.vibrate)
      try {
        navigator.vibrate?.(ms);
      } catch (_) {}
  }
  const music = $("background-music");
  let musicEnabled = true;
  try {
    musicEnabled = localStorage.getItem("sweetSwapMusic") !== "off";
  } catch (_) {}
  sound = profile.settings.sound !== false;
  $("sound-btn").innerHTML = sound
    ? "🔊<span>Sound</span>"
    : "🔇<span>Muted</span>";
  music.volume = profile.settings.music;
  music.src = profile.settings.track
    ? "sweet-swap-theme-2.mp3"
    : "sweet-swap-theme.mp3";
  function syncMusic() {
    if (state === "playing" && musicEnabled) {
      music.play().catch(() => {});
    } else music.pause();
  }
  function musicLabel() {
    $("music-btn").textContent = musicEnabled ? "♫ Music" : "♫ Music off";
    $("music-btn").setAttribute("aria-pressed", String(musicEnabled));
  }
  $("music-btn").addEventListener("click", () => {
    musicEnabled = !musicEnabled;
    try {
      localStorage.setItem("sweetSwapMusic", musicEnabled ? "on" : "off");
    } catch (_) {}
    musicLabel();
    syncMusic();
  });
  musicLabel();
  const rushActive = () => (mode === "timed" ? rushUntil > 0 : rushMoves > 0);
  function loadBest() {
    try {
      return Math.max(0, Number(localStorage.getItem(MODES[mode].key)) || 0);
    } catch (_) {
      return 0;
    }
  }
  function chooseMode(value) {
    if (state !== "ready" || !MODES[value]) return;
    mode = value;
    stage = mode === "moves" ? unlocked : 1;
    dailySeed = dateKey();
    best = loadBest();
    startingBest = best;
    document
      .querySelectorAll("[data-mode]")
      .forEach((b) =>
        b.setAttribute("aria-pressed", String(b.dataset.mode === mode)),
      );
    $("overlay-text").textContent = missionMode()
      ? `${mode === "daily" ? "Daily" : "Stage " + stage}: ${missionLabel()} in ${mission().moves} moves.`
      : MODES[mode].description;
    message(defaultMessage(), 0);
    update();
  }
  function defaultMessage() {
    return missionMode()
      ? `${mode === "daily" ? "Daily" : "Stage " + stage}: ${missionLabel()}!`
      : "Match 3 or more candies!";
  }
  try {
    best = Math.max(0, Number(localStorage.getItem("highScore")) || 0);
  } catch (_) {}
  const random = () => ({
    color: COLORS[Math.floor(rng() * COLORS.length)],
    special: null,
  });
  const row = (i) => Math.floor(i / N),
    col = (i) => i % N;
  const adjacent = (a, b) =>
    a >= 0 &&
    b >= 0 &&
    a < N * N &&
    b < N * N &&
    Math.abs(row(a) - row(b)) + Math.abs(col(a) - col(b)) === 1;
  const swap = (g, a, b) => {
    [g[a], g[b]] = [g[b], g[a]];
  };
  const playable = () => state === "playing" && !busy;
  const current = (v) => v === version && state === "playing";
  const wait = (ms) =>
    new Promise((resolve) => setTimeout(resolve, reduced ? 0 : ms));
  const fmt = (ms) => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };
  const colorAt = (g, i) => (g[i]?.special === "rainbow" ? null : g[i]?.color);

  // Detect complete runs rather than overlapping groups of three.
  function runs(g) {
    const result = [];
    for (const axis of ["h", "v"]) {
      for (let line = 0; line < N; line++) {
        for (let p = 0; p < N; ) {
          const index = (k) => (axis === "h" ? line * N + k : k * N + line);
          const color = colorAt(g, index(p));
          let end = p + 1;
          while (end < N && color && colorAt(g, index(end)) === color) end++;
          if (color && end - p >= 3)
            result.push({
              axis,
              ids: Array.from({ length: end - p }, (_, k) => index(p + k)),
            });
          p = end;
        }
      }
    }
    return result;
  }
  function legalMove(g = grid, ignore = false) {
    let bestMove = null,
      bestValue = -1;
    for (let a = 0; a < 64; a++)
      for (const b of [a + 1, a + N]) {
        if (!adjacent(a, b) || (!ignore && (blocked(a) || blocked(b))))
          continue;
        if (
          g[a]?.special === "rainbow" ||
          g[b]?.special === "rainbow" ||
          (g[a]?.special && g[b]?.special)
        )
          return [a, b];
        if (g[a]?.color === g[b]?.color) continue;
        swap(g, a, b);
        const matches = runs(g);
        const ids = new Set(matches.flatMap((r) => r.ids));
        const value =
          ids.size +
          [...ids].filter(
            (i) =>
              obstacles[i] ||
              (missionMode() && g[i]?.color === mission().color),
          ).length *
            3;
        swap(g, a, b);
        if (ids.size && value > bestValue) {
          bestValue = value;
          bestMove = [a, b];
        }
      }
    return bestMove;
  }
  function generate() {
    let g, attempts = 0;
    do {
      g = [];
      for (let i = 0; i < 64; i++) {
        let c;
        do {
          c = random();
        } while (
          (col(i) >= 2 &&
            g[i - 1].color === c.color &&
            g[i - 2].color === c.color) ||
          (row(i) >= 2 &&
            g[i - N].color === c.color &&
            g[i - 2 * N].color === c.color)
        );
        g.push(c);
      }
      if (++attempts >= 100 && !legalMove(g)) {
        const blockedCell = Object.keys(obstacles).find(i => blocked(+i));
        if (blockedCell !== undefined) delete obstacles[blockedCell];
        attempts = 0;
      }
    } while (!legalMove(g));
    return g;
  }
  // Logical grid, hit targets, and persistent animated sprites are independent.
  const tiles = $("board-tiles"), candyLayer = $("board-candies"), obstacleLayer = $("board-obstacles");
  let sprites = [], markers = [], spriteByCandy = new Map();
  function placeSprite(el, i) {
    el.style.gridColumn = `${col(i) + 1} / span 1`;
    el.style.gridRow = `${row(i) + 1} / span 1`;
    el.dataset.index = String(i);
  }
  function createBoard() {
    tiles.replaceChildren(); candyLayer.replaceChildren(); obstacleLayer.replaceChildren();
    cells = []; sprites = []; markers = []; spriteByCandy.clear();
    for (let i = 0; i < 64; i++) {
      const cell = document.createElement("button");
      cell.type = "button"; cell.className = "cell"; cell.dataset.index = i;
      tiles.append(cell); cells.push(cell);
      const marker = document.createElement("div");
      marker.className = "cell obstacle-marker";
      obstacleLayer.append(marker); markers.push(marker);
    }
  }
  function render() {
    const live = new Set(grid.filter(Boolean));
    for (const [c, el] of spriteByCandy) if (!live.has(c)) { el.remove(); spriteByCandy.delete(c); }
    sprites = grid.map((c,i) => {
      if (!c) return null;
      let el = spriteByCandy.get(c);
      if (!el) {
        el = document.createElement("div"); el.className = "candy-sprite";
        const face = document.createElement("span"); face.className = "candy";
        el.append(face); candyLayer.append(el); spriteByCandy.set(c, el);
      }
      placeSprite(el,i);
      const face = el.firstElementChild;
      const appearance = "candy " + c.color + (c.special ? " special-" + c.special : "");
      if (face.className !== appearance) face.className = appearance;
      el.classList.toggle("sprite-selected", i === selected);
      el.classList.remove("sprite-hint");
      return el;
    });
    cells.forEach((cell,i) => {
      const c = grid[i];
      markers[i].dataset.obstacle = obstacles[i] || "";
      cell.classList.toggle("selected",i === selected);
      cell.classList.remove("hint");
      cell.setAttribute("aria-label", `${c?.color || "Empty"} ${c?.special || ""} candy, row ${row(i)+1}, column ${col(i)+1}`);
      cell.setAttribute("aria-pressed",String(i === selected));
    });
  }
  function message(text, ms = 2200) {
    clearTimeout(messageTimer);
    $("game-message").textContent = text;
    if (ms)
      messageTimer = setTimeout(() => {
        if (state === "playing")
          $("game-message").textContent = defaultMessage();
      }, ms);
  }
  function update() {
    updateCoins();
    $('coin-btn').disabled = busy;
    $('restart-btn').disabled = busy;
    $('sound-btn').disabled = busy;
    $('finish-btn').hidden = !['playing','paused'].includes(state);
    $('finish-btn').disabled = busy;
    $("resource-label").textContent = MODES[mode].label;
    $("timer").textContent =
      mode === "timed"
        ? fmt(time)
        : missionMode()
          ? Math.max(0, mission().moves + (extraMoves || 0) - moves)
          : mode === "survival"
            ? survivalLeft
            : "∞";
    $("timer").classList.toggle(
      "danger",
      mode === "timed"
        ? time <= 20000
        : (missionMode() && mission().moves + extraMoves - moves <= 5) ||
            (mode === "survival" && survivalLeft <= 5),
    );
    const lowSurvival = mode === "survival" && survivalLeft <= 5 &&
      ["playing", "paused"].includes(state);
    $("timer").classList.toggle("survival-danger", lowSurvival);
    $("timer").parentElement.classList.toggle("survival-low-card", lowSurvival);
    $("timer-progress").classList.toggle("survival-low-bar", lowSurvival);
    $("timer-progress").style.width =
      (mode === "timed"
        ? Math.min(100, time / 1800)
        : missionMode()
          ? Math.max(
              0,
              ((mission().moves + extraMoves - moves) /
                (mission().moves + extraMoves)) *
                100,
            )
          : mode === "survival"
            ? Math.min(100, (survivalLeft / SURVIVAL_CAP) * 100)
            : 100) + "%";
    $("score").textContent = score;
    $("high-score").textContent = best;
    $("level").textContent = missionMode()
      ? mode === "daily"
        ? "Daily"
        : "Stage " + stage
      : "Level " + level;
    $("level-target").textContent = missionMode()
      ? missionProgress()
      : `Next: ${level * 100} pts`;
    $("level-progress").style.width =
      (missionMode()
        ? Math.max(0, Math.min(100, (missionValue() / mission().target) * 100))
        : score % 100) + "%";
    $("combo").textContent = "Combo ×" + combo;
    $("moves").textContent = moves;
    $("cleared").textContent = cleared;
    $("best-combo").textContent = bestCombo;
    const active = rushActive();
    $("rush-status").textContent = active
      ? "×2 • " + (mode === "timed" ? fmt(rushUntil) : rushMoves + " moves")
      : `${energy} / 40`;
    $("rush-progress").style.width =
      (active
        ? mode === "timed"
          ? rushUntil / 100
          : (rushMoves / 3) * 100
        : (energy / 40) * 100) + "%";
    document
      .querySelector(".board-wrapper")
      .classList.toggle("rush-active", active);
    $("pause-btn").disabled = busy || !["playing", "paused"].includes(state);
    $("pause-btn").innerHTML =
      state === "paused" ? "▶<span>Resume</span>" : "⏸<span>Pause</span>";
    $("help-btn").disabled = busy;
    $("hint-btn").disabled = !playable();
    $("shuffle-btn").disabled = !playable() || !shuffles;
    $("shuffle-btn").innerHTML = `🔀<span>Shuffle (${shuffles})</span>`;
  }
  function unlockAudio() {
    if (!sound) return;
    try {
      const A = window.AudioContext || window.webkitAudioContext;
      if (!A) return;
      audio ||= new A();
      if (audio.state === "suspended") audio.resume().catch(() => {});
    } catch (_) {}
  }
  function tone(type) {
    if (!sound || !audio || audio.state !== "running") return;
    const notes = {
      swap: [420, 540],
      match: [660, 990],
      combo: [800, 1350],
      blast: [190, 80],
      invalid: [220, 120],
      level: [520, 780, 1040],
      rush: [440, 660, 880, 1320],
      end: [660, 440, 330],
    }[type] || [500];
    notes.forEach((f, i) => {
      const t = audio.currentTime + i * 0.075,
        o = audio.createOscillator(),
        g = audio.createGain();
      o.type = type === "blast" ? "triangle" : "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.1 * profile.settings.sfx + 0.001, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      o.connect(g);
      g.connect(audio.destination);
      o.start(t);
      o.stop(t + 0.16);
    });
  }
  function animate(el, frames, duration, essential = false) {
    if ((!essential && reduced) || !el.animate) return Promise.resolve();
    return el
      .animate(frames, { duration, easing: essential ? "cubic-bezier(.2,.65,.35,1)" : "ease-in-out" })
      .finished.catch(() => {});
  }
  function burst(i, color, count = 9) {
    if (reduced) return;
    const a = cells[i].getBoundingClientRect(),
      b = effects.getBoundingClientRect();
    for (let k = 0; k < count; k++) {
      const p = document.createElement("i");
      p.className = "particle";
      p.style.left = a.left - b.left + a.width / 2 + "px";
      p.style.top = a.top - b.top + a.height / 2 + "px";
      p.style.background = p.style.color = color;
      effects.append(p);
      const angle = Math.random() * Math.PI * 2,
        d = 25 + Math.random() * 65;
      animate(
        p,
        [
          { transform: "translate(0,0) scale(1)", opacity: 1 },
          {
            transform: `translate(${Math.cos(angle) * d}px,${Math.sin(angle) * d}px) rotate(180deg) scale(.1)`,
            opacity: 0,
          },
        ],
        420,
      ).then(() => p.remove());
    }
  }
  function floatScore(i, points) {
    if (reduced) return;
    const a = cells[i].getBoundingClientRect(),
      b = effects.getBoundingClientRect(),
      p = document.createElement("div");
    p.className = "floating";
    p.textContent = "+" + points;
    p.style.left = a.left - b.left + a.width / 2 + "px";
    p.style.top = a.top - b.top + "px";
    effects.append(p);
    animate(
      p,
      [
        { transform: "translate(-50%,0) scale(.8)", opacity: 1 },
        { transform: "translate(-50%,-65px) scale(1.2)", opacity: 0 },
      ],
      850,
    ).then(() => p.remove());
  }
  function confetti() {
    if (reduced) return;
    for (let i = 0; i < 64; i += 4) burst(i, PALETTE[i % 6], 5);
  }
  function achievement(key, label) {
    if (achievements.has(key)) return;
    achievements.add(key);
    message("🏅 " + label, 3000);
    tone("level");
  }
  // Survival rewards: only show moves actually credited under the cap.
  function grantSurvivalMoves(amount, reason, at = 27) {
    if (mode !== "survival" || amount <= 0) return 0;
    const credited = Math.min(amount, Math.max(0, SURVIVAL_CAP - survivalLeft));
    survivalLeft += credited;
    if (!credited) return 0;
    const p = document.createElement("div");
    p.className = "survival-move-float";
    p.textContent = `+${credited} ${credited === 1 ? "MOVE" : "MOVES"} • ${reason}`;
    effects.append(p);
    // Center on the board so the notice is never clipped near an edge.
    if (reduced) setTimeout(() => p.remove(), 1100);
    else animate(p, [
      { transform: "translate(-50%, 0) scale(.85)", opacity: 1 },
      { transform: "translate(-50%, -25px) scale(1)", opacity: 1, offset: .25 },
      { transform: "translate(-50%, -55px)", opacity: 0 }
    ], 1250).then(() => p.remove());
    return credited;
  }
  function recordSurvivalMove() {
    if (mode !== "survival") return;
    profile.stats.survivalBestMoves = Math.max(profile.stats.survivalBestMoves || 0, moves);
    const claimed = profile.stats.survivalMilestones ||= [];
    for (const [threshold, coins] of SURVIVAL_MILESTONES) {
      if (moves >= threshold && !claimed.includes(threshold)) {
        claimed.push(threshold);
        creditCoins(coins, "Survival milestone");
        message(`🏆 ${threshold} moves survived! +${coins} coins`, 3500);
        tone("level");
        announce(`${threshold} moves survived!`);
        confetti();
      }
    }
  }
  function award(points, count, at, matchReward = 0) {
    const multiplier = rushActive() ? 2 : 1;
    points *= multiplier;
    const oldScore = score;
    score += points;
    creditCoins((Math.floor(score / 100)-Math.floor(oldScore / 100))*5, "Score milestones");
    if (combo === 5) creditCoins(5, "Combo ×5");
    if (combo === 10) creditCoins(15, "Combo ×10");
    cleared += count;
    profile.stats.cleared += count;
    profile.stats.bestCombo = Math.max(profile.stats.bestCombo, combo);
    if (combo >= 3) {
      announce("Amazing combo!");
      vibrate(35);
    }
    let survivalReward = matchReward + (combo > 1 ? 1 : 0);
    bestCombo = Math.max(bestCombo, combo);
    floatScore(at, points);
    message(
      combo > 1 ? `🔥 Combo ×${combo}! +${points}` : `✨ Sweet! +${points}`,
    );
    if (score > best) {
      best = score;

      if (startingBest > 0 && !achievements.has("record")) {
        achievement("record", "New high score!");
        confetti();
      }
    }
    const next = 1 + Math.floor(score / 100);
    if (!missionMode() && next > level) {
      const bonus = (next - level) * 10;
      survivalReward += (next - level) * 3;
      level = next;
      if (mode === "timed") {
        time += bonus * 1000;
        deadline += bonus * 1000;
      }
      message(
        `🎉 Level ${level}!${mode === "timed" ? " +" + bonus + "s" : ""}`,
        3000,
      );
      tone("level");
      confetti();
    }
    if (!rushActive()) {
      energy += count;
      if (energy >= 40) {
        energy = 0;
        profile.stats.rushes++;
        creditCoins(5, "Sugar Rush");
        survivalReward += 2;
        announce("Sugar Rush!");
        rushGeneration++;
        if (mode === "timed") rushUntil = 10000;
        else rushMoves = 3;
        message("⚡ SUGAR RUSH! DOUBLE POINTS!", 3000);
        tone("rush");
      }
    }
    if (mode === "survival") grantSurvivalMoves(survivalReward, "Bonus", at);
    if (combo >= 5) achievement("combo", "Combo master!");
    if (cleared >= 100) achievement("clear", "100 candies cleared!");
    update();
  }
  // Merge intersecting runs to create one special per connected match.
  function groups(matches) {
    const list = [];
    for (const run of matches) {
      let ids = new Set(run.ids),
        rr = [run];
      for (let i = list.length - 1; i >= 0; i--) {
        if ([...list[i].ids].some((x) => ids.has(x))) {
          list[i].ids.forEach((x) => ids.add(x));
          rr.push(...list[i].runs);
          list.splice(i, 1);
        }
      }
      list.push({ ids, runs: rr });
    }
    return list;
  }
  function plan(matches, preferred = []) {
    const hit = new Set(),
      created = new Map();
    let matchReward = 0;
    for (const group of groups(matches)) {
      group.ids.forEach((i) => hit.add(i));
      const longest = group.runs.reduce((a, b) =>
        a.ids.length >= b.ids.length ? a : b,
      );
      const crossed =
        group.runs.some((r) => r.axis === "h") &&
        group.runs.some((r) => r.axis === "v");
      const special =
        longest.ids.length >= 5
          ? "rainbow"
          : crossed
            ? "bomb"
            : longest.ids.length === 4
              ? longest.axis
              : null;
      if (!special) continue;
      const candidates = [...preferred, ...group.ids].filter(
        (i) => group.ids.has(i) && !grid[i].special,
      );
      const i = candidates[0];
      if (i !== undefined) created.set(i, { color: grid[i].color, special });
      // A natural match earns its strongest reward once, not per overlapping run.
      matchReward += Math.max(longest.ids.length >= 5 ? 2 : longest.ids.length === 4 ? 1 : 0,
        i !== undefined && special === "bomb" ? 2 : 0);
    }
    return { hit, created, matchReward };
  }
  // A special hit by a match or another special triggers recursively.
  function expand(hit, rainbowColors = new Map()) {
    const queue = [...hit],
      seen = new Set();
    for (let k = 0; k < queue.length; k++) {
      const i = queue[k];
      if (seen.has(i)) continue;
      seen.add(i);
      const c = grid[i];
      if (!c?.special) continue;
      let targets = [];
      if (c.special === "h")
        targets = Array.from({ length: N }, (_, j) => row(i) * N + j);
      if (c.special === "v")
        targets = Array.from({ length: N }, (_, j) => j * N + col(i));
      if (c.special === "bomb")
        for (
          let r = Math.max(0, row(i) - 1);
          r <= Math.min(N - 1, row(i) + 1);
          r++
        )
          for (
            let j = Math.max(0, col(i) - 1);
            j <= Math.min(N - 1, col(i) + 1);
            j++
          )
            targets.push(r * N + j);
      if (c.special === "rainbow") {
        const color = rainbowColors.get(i) || c.color;
        targets = grid
          .map((x, j) => (color === "all" || x?.color === color ? j : -1))
          .filter((j) => j >= 0);
      }
      for (const j of targets)
        if (!hit.has(j)) {
          hit.add(j);
          queue.push(j);
        }
    }
    return hit;
  }
  async function drop(v) {
    const falls = new Map();
    for (let c = 0; c < N; c++) {
      let w = N - 1;
      for (let r = N - 1; r >= 0; r--) {
        const i = r * N + c;
        if (!grid[i]) continue;
        const j = w * N + c;
        grid[j] = grid[i];
        if (j !== i) { grid[i] = null; falls.set(j,w-r); }
        w--;
      }
      const missing = w + 1;
      while (w >= 0) { const i = w*N+c; grid[i]=random(); falls.set(i,missing); w--; }
    }
    if (!current(v)) return;
    render(); // Existing sprites stay mounted; only their logical destination changes.
    const step = cells[N].getBoundingClientRect().top-cells[0].getBoundingClientRect().top;
    const items = [...falls].map(([i,d]) => ({el:sprites[i],x:0,y:-d*step}));
    if (items.length) await glide(items, Math.min(580,300+Math.max(...falls.values())*35),v,true);
    if (current(v)) for (const {el} of items) el.style.transform = '';
  }

  async function resolve(v, first = null, preferred = []) {
    let matchPlan = first || plan(runs(grid), preferred);
    combo = 1;
    while (matchPlan.hit.size && current(v)) {
      const { hit, created } = matchPlan;
      expand(hit, matchPlan.rainbowColors);
      const specialHit = [...hit].some((i) => grid[i]?.special);
      if (specialHit) {
        tone("blast");
        animate(
          board,
          [
            { transform: "translateX(0)" },
            { transform: "translateX(-4px)" },
            { transform: "translateX(4px)" },
            { transform: "translateX(0)" },
          ],
          220,
        );
      } else tone(combo > 1 ? "combo" : "match");
      const ids = [...hit],
        removed = ids.filter((i) => !created.has(i));
      const points =
        (ids.length +
          (ids.length >= 5 ? ids.length : ids.length === 4 ? 1 : 0)) *
        combo;
      if (missionMode()) {
        collected += removed.filter(
          (i) =>
            grid[i]?.color === mission().color &&
            grid[i]?.special !== "rainbow",
        ).length;
        activated += ids.filter((i) => grid[i]?.special).length;
      }
      const specials = ids.filter((i) => grid[i]?.special);
      profile.stats.specials += specials.length;
      profile.stats.bombs += specials.filter(
        (i) => grid[i]?.special === "bomb",
      ).length;
      runSpecials += specials.length;
      for (const candy of created.values()) creditCoins(candy.special === 'rainbow' ? 3 : candy.special === 'bomb' ? 2 : 1, 'Special candies');
      const rainbows = [...created.values()].filter(
        (x) => x.special === "rainbow",
      ).length;
      madeRainbow += rainbows;
      profile.stats.rainbows += rainbows;
      for (const i of ids) {
        delete obstacles[i];
        for (const n of [i - 1, i + 1, i - N, i + N])
          if (
            adjacent(i, n) &&
            (obstacles[n] === "chocolate" || obstacles[n] === "lock")
          )
            delete obstacles[n];
      }
      const rainbowReward = specials.filter((i) => grid[i]?.special === "rainbow").length * 2;
      award(points, removed.length, ids[0], (matchPlan.matchReward || 0) + rainbowReward);
      ids.forEach((i) => {
        burst(i, PALETTE[COLORS.indexOf(grid[i]?.color)] || "#fff");
        sprites[i]?.firstElementChild.classList.add("match");
      });
      if (created.size) {
        const s = [...created.values()][0].special;
        message(
          s === "rainbow"
            ? "🌈 Rainbow candy created!"
            : s === "bomb"
              ? "💣 Bomb candy created!"
              : "✨ Striped candy created!",
          2600,
        );
      }
      await new Promise(resolve => setTimeout(resolve, 235));
      if (!current(v)) return;
      ids.forEach((i) => (grid[i] = created.get(i) || null));
      await drop(v);
      if (!current(v)) return;
      matchPlan = plan(runs(grid));
      combo++;
    }
    if (current(v) && !legalMove()) {
      message("🔀 No moves left — refreshing!");
      await wait(300);
      if (current(v)) {
        for (let t = 0; t < 30; t++) {
          grid = generate();
          if (legalMove()) break;
        }
        if (!legalMove()) {
          const k = Object.keys(obstacles).find((i) => blocked(+i));
          if (k !== undefined) delete obstacles[k];
        }
        render();
      }
    }
  }
  // Keep the same visible candy node throughout the entire journey.
  function glide(items, duration, v = version, gravity = false) {
    const started = performance.now();
    for (const {el, x, y} of items) el.style.transform = `translate3d(${x}px,${y}px,0)`;
    return new Promise(resolve => {
      function frame(now) {
        if (v !== version) { resolve(false); return; }
        const t = Math.min(1, (now - started) / duration);
        const eased = gravity ? (t < .84 ? Math.pow(t/.84, 2) : 1 + .025*Math.sin((t-.84)/.16*Math.PI)) : 1 - Math.pow(1 - t, 2);
        for (const {el, x, y, endX = 0, endY = 0} of items) {
          el.style.transform = `translate3d(${x+(endX-x)*eased}px,${y+(endY-y)*eased}px,0)`;
        }
        if (t < 1) requestAnimationFrame(frame);
        else resolve(true);
      }
      requestAnimationFrame(frame);
    });
  }
  async function swapAnimation(a, b, progress = 0) {
    const x = sprites[a], y = sprites[b];
    const ra = cells[a].getBoundingClientRect(), rb = cells[b].getBoundingClientRect();
    const dx = rb.left-ra.left, dy = rb.top-ra.top;
    x.style.zIndex = '4'; y.style.zIndex = '3';
    const done = await glide([
      {el:x,x:dx*progress,y:dy*progress,endX:dx,endY:dy},
      {el:y,x:-dx*progress,y:-dy*progress,endX:-dx,endY:-dy}
    ], Math.max(120, 230*(1-progress)));
    if (done) {
      // Set the destination and clear the relative transform in the same frame.
      placeSprite(x,b); placeSprite(y,a);
      x.style.transform = y.style.transform = '';
    }
    x.style.zIndex = y.style.zIndex = '';
  }
  async function move(a, b, progress = 0) {
    if (!playable() || !adjacent(a, b) || blocked(a) || blocked(b) || booster)
      return;
    cancelSwipe();
    stableCheckpoint();
    const before = snapshot(), financialBefore = finance();
    const hadChocolate = Object.keys(obstacles).length;
    const v = version,
      activeAtStart = rushActive(),
      rushAtStart = rushGeneration;
    busy = true;
    board.classList.add("motion-resolving");
    selected = -1;
    clearHint();
    render();
    update();
    tone("swap");
    try {
      await swapAnimation(a, b, progress);
      if (!current(v)) return;
      swap(grid, a, b);
      render();
      let p;
      const x = grid[a],
        y = grid[b];
      if (x.special === "rainbow" || y.special === "rainbow") {
        const both = x.special === "rainbow" && y.special === "rainbow";
        const rainbow = x.special === "rainbow" ? a : b;
        const other = rainbow === a ? b : a;
        if (!both && grid[other].special) {
          const s = grid[other].special;
          grid.forEach((c, i) => {
            if (i !== rainbow && c.color === grid[other].color) c.special = s;
          });
        }
        p = {
          hit: new Set([a, b]),
          created: new Map(),
          rainbowColors: new Map([[rainbow, both ? "all" : grid[other].color]]),
        };
      } else if (x.special && y.special) {
        const hit = new Set([a, b]);
        const radius = x.special === "bomb" && y.special === "bomb" ? 2 : 1;
        for (let i = 0; i < 64; i++) {
          const dr = Math.abs(row(i) - row(b)),
            dc = Math.abs(col(i) - col(b));
          if (
            x.special === "bomb" && y.special === "bomb"
              ? dr <= radius && dc <= radius
              : x.special === "bomb" || y.special === "bomb"
                ? dr <= 1 || dc <= 1
                : dr === 0 || dc === 0
          )
            hit.add(i);
        }
        p = { hit, created: new Map() };
      } else p = plan(runs(grid), [b, a]);
      if (p.hit.size && freeSwap) freeSwap = false;
      if (!p.hit.size && freeSwap) {
        freeSwap = false;
        undo = before; undoFinance = financialBefore;
        moves++;
        if (mode === "survival") survivalLeft--;
        if (!legalMove()) grid = generate();
        if (mode !== "timed" && activeAtStart && rushAtStart === rushGeneration) rushMoves = Math.max(0,rushMoves-1);
        recordSurvivalMove();
        checkEnd();
        return;
      }
      if (!p.hit.size) {
        await swapAnimation(a, b);
        if (!current(v)) return;
        swap(grid, a, b);
        render();
        tone("invalid");
        message("Try another match!");
      } else {
        undo = before; undoFinance = financialBefore;
        moves++;
        if (mode === "survival") survivalLeft--;
        await resolve(v, p);
        if (current(v)) {
          if (
            mode !== "timed" &&
            activeAtStart &&
            rushAtStart === rushGeneration
          )
            rushMoves = Math.max(0, rushMoves - 1);
          if (
            missionMode() &&
            mission().kind === "chocolate" &&
            Object.keys(obstacles).length === hadChocolate &&
            hadChocolate
          ) {
            const candidates = Object.keys(obstacles).flatMap((k) =>
              [+k - 1, +k + 1, +k - N, +k + N].filter(
                (n) => adjacent(+k, n) && !obstacles[n],
              ),
            );
            if (candidates.length && hadChocolate < 18)
              obstacles[candidates[Math.floor(rng() * candidates.length)]] =
                "chocolate";
          }
          recordSurvivalMove();
          checkEnd();
        }
      }
    } finally {
      board.classList.remove("motion-resolving");
      if (current(v)) {
        busy = false;
        combo = 1;
        render();
        update();
        scheduleHint();
        checkBadges();
        if (undo === before) undoAfter = JSON.stringify(finance());
        stableCheckpoint();
        if (mode === 'timed' && time <= 0) { finish(); return; }
        if (pendingPause) {
          pendingPause = false;
          pause();
        }
      }
    }
  }
  function select(i) {
    if (!playable()) return;
    if (booster) {
      useTarget(i);
      return;
    }
    clearHint();
    if (selected === i) selected = -1;
    else if (adjacent(selected, i)) {
      move(selected, i);
      return;
    } else selected = i;
    render();
    scheduleHint();
  }
  // Direct manipulation: preview the swap while the finger is moving.
  function clearSwipePreview(p) {
    if (!p) return;
    for (const i of [p.i, p.target]) {
      const cell = cells[i];
      if (!cell) continue;
      cell.classList.remove("swipe-source", "swipe-neighbor");
      if (sprites[i]) { sprites[i].style.transform = ""; sprites[i].style.zIndex = ""; }
    }
  }
  function cancelSwipe() {
    const p = pointer;
    pointer = null;
    if (!p) return;
    clearSwipePreview(p);
    if (board.hasPointerCapture(p.id)) board.releasePointerCapture(p.id);
  }
  function previewSwipe(p, e) {
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    const source = cells[p.i];
    if (!source) return;
    const rect = source.getBoundingClientRect();
    const stepX = rect.width + (parseFloat(getComputedStyle(tiles).columnGap) || 0);
    const stepY = rect.height + (parseFloat(getComputedStyle(tiles).rowGap) || 0);
    const clamp = (n, limit) => Math.max(-limit, Math.min(limit, n));
    // Direct manipulation is essential interaction feedback, even with Reduce Motion.
    if ((!p.axis) && Math.max(Math.abs(dx), Math.abs(dy)) >= 3)
      p.axis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
    const distance = p.axis === "x" ? dx : dy;
    const target = p.axis && distance ? p.i + Math.sign(distance) * (p.axis === "x" ? 1 : N) : -1;
    const valid = adjacent(p.i, target) && !blocked(p.i) && !blocked(target);
    if (p.target !== target && cells[p.target]) {
      cells[p.target].classList.remove("swipe-neighbor");
      sprites[p.target].style.transform = ""; sprites[p.target].style.zIndex = "";
    }
    p.target = valid ? target : -1;
    p.progress = 0;
    source.classList.add("swipe-source");
    let x = clamp(dx, stepX), y = clamp(dy, stepY);
    if (valid) {
      const other = cells[target], r = other.getBoundingClientRect();
      const sx = r.left - rect.left, sy = r.top - rect.top;
      const step = Math.hypot(sx, sy);
      if (step) {
        p.progress = Math.min(1, Math.abs(distance) / step);
        other.classList.add("swipe-neighbor");
        sprites[target].style.zIndex = "3";
        sprites[target].style.transform = `translate3d(${-sx * p.progress}px,${-sy * p.progress}px,0)`;
        // Keep the held candy under the finger, with soft resistance past one tile.
        if (p.axis === "x") { x = sx * p.progress + clamp(dx - sx * p.progress, stepX * .18) * .4; y *= .25; }
        else { y = sy * p.progress + clamp(dy - sy * p.progress, stepY * .18) * .4; x *= .25; }
      }
    } else { x *= .28; y *= .28; }
    sprites[p.i].style.zIndex = "4";
    sprites[p.i].style.transform = `translate3d(${x}px,${y}px,0) scale(1.04)`;
  }
  function commitSwipe(p) {
    const target = p.target, progress = p.progress;
    cancelSwipe();
    vibrate(12);
    move(p.i, target, progress);
  }
  board.addEventListener("pointerdown", (e) => {
    if (!playable() || pointer || !e.isPrimary || e.button !== 0) return;
    const c = e.target.closest(".cell");
    if (!c) return;
    unlockAudio();
    pointer = { id: e.pointerId, i: Number(c.dataset.index), x: e.clientX, y: e.clientY, axis: null, target: -1, progress: 0, started: performance.now() };
    e.preventDefault();
    board.setPointerCapture(e.pointerId);
    if (!booster) {
      c.classList.add("swipe-source");
      sprites[pointer.i].style.zIndex = "4";
      sprites[pointer.i].style.transform = "scale(1.04)";
    }
    clearHint();
  });
  board.addEventListener("pointermove", (e) => {
    const p = pointer;
    if (!p || p.id !== e.pointerId || booster) return;
    if (!playable()) { cancelSwipe(); return; }
    if (e.cancelable) e.preventDefault();
    previewSwipe(p, e);
    // One directional flick per contact; commit before the finger lifts.
    const threshold = performance.now() - p.started < 180 ? 0.38 : 0.55;
    if (p.target >= 0 && p.progress >= threshold) commitSwipe(p);
  });
  board.addEventListener("pointerup", (e) => {
    const p = pointer;
    if (!p || p.id !== e.pointerId) return;
    if (!playable()) { cancelSwipe(); return; }
    if (!booster) previewSwipe(p, e);
    if (!booster && p.target >= 0 && p.progress >= (performance.now() - p.started < 220 ? 0.16 : 0.30)) {
      commitSwipe(p);
      return;
    }
    const tap = booster || (!p.axis && Math.hypot(e.clientX-p.x,e.clientY-p.y) < 8);
    const transforms = [p.i,p.target].filter(i=>i>=0).map(i=>[sprites[i],sprites[i].style.transform]);
    cancelSwipe();
    if (tap) select(p.i);
    else {
      for (const [el, transform] of transforms) if (transform) animate(el,[{transform},{transform:"translate(0,0)"}],140,true);
      scheduleHint();
    }
  });
  board.addEventListener("pointercancel", (e) => {
    if (pointer?.id !== e.pointerId) return;
    cancelSwipe();
    scheduleHint();
  });
  board.addEventListener("lostpointercapture", (e) => {
    if (pointer?.id !== e.pointerId) return;
    cancelSwipe();
    scheduleHint();
  });
  board.addEventListener("click", (e) => {
    if (e.detail !== 0) return;
    const c = e.target.closest(".cell");
    if (c) {
      unlockAudio();
      select(Number(c.dataset.index));
    }
  });
  board.addEventListener("keydown", (e) => {
    const d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -N, ArrowDown: N }[
      e.key
    ];
    const c = e.target.closest(".cell");
    if (!d || !c || !playable()) return;
    e.preventDefault();
    const a = Number(c.dataset.index),
      b = a + d;
    if (adjacent(a, b)) {
      if (e.shiftKey) {
        unlockAudio();
        move(a, b);
      } else cells[b].focus();
    }
  });
  function clearHint() {
    clearTimeout(hintTimer);
    clearTimeout(idleTimer);
    cells.forEach((c) => c.classList.remove("hint"));
    sprites.forEach(el => el?.classList.remove("sprite-hint"));
  }
  function hint() {
    if (!playable()) return;
    clearHint();
    const m = legalMove();
    if (!m) return;
    m.forEach((i) => { cells[i].classList.add("hint"); sprites[i]?.classList.add("sprite-hint"); });
    message("💡 Swap the glowing candies!");
    hintTimer = setTimeout(() => {
      cells.forEach((c) => c.classList.remove("hint"));
    sprites.forEach(el => el?.classList.remove("sprite-hint"));
    }, 2500);
  }
  function scheduleHint() {
    clearTimeout(idleTimer);
    if (playable()) idleTimer = setTimeout(hint, 8500);
  }
  function overlay(icon, title, text, button) {
    $("overlay-icon").textContent = icon;
    $("overlay-title").textContent = title;
    $("overlay-text").textContent = text;
    $("overlay-btn").textContent = button;
    $("mode-picker").hidden = state !== "ready";
    $("overlay").hidden = false;
  }
  function tick() {
    if (state !== "playing" || mode !== "timed") return;
    const remaining = Math.max(0, deadline - performance.now());
    const elapsed = Math.max(0, time - remaining);
    time = remaining;
    rushUntil = Math.max(0, rushUntil - elapsed);
    update();
    if (Math.floor(time / 1000) % 5 === 0 && Math.floor(time / 100) % 10 === 0)
      saveGame();
    if (time <= 0 && !busy) finish();
  }
  function startClock() {
    clearInterval(timer);
    if (mode === "timed") {
      deadline = performance.now() + time;
      timer = setInterval(tick, 100);
    }
  }
  function finish(reason = "time") {
    cancelSwipe();
    if (state !== "playing") return;
    state = reason === "won" ? "stagewon" : "over";
    syncMusic();
    version++;
    busy = false;
    pointer = null;
    clearInterval(timer);
    clearHint();
    clearTimeout(messageTimer);
    if (reason === "time") time = 0;
    invalidateUndo();
    commitBest();
    update();
    recordSurvivalMove();
    const won = reason === "won",
      record = score > startingBest;
    profile.save = null;
    profile.stats.games++;
    if (won) {
      profile.stats.wins++;
      const stars =
        moves <= mission().moves * 0.55
          ? 3
          : moves <= mission().moves * 0.8
            ? 2
            : 1;
      if (mode === "moves") {
        const old = profile.stars[stage] || 0;
        profile.stars[stage] = Math.max(old, stars);
        creditCoins(Math.max(0, stars - old) * 30, 'Adventure stars');
        if (!old && stage % 10 === 0) creditCoins(100, 'Adventure milestone');
        profile.unlocked = Math.min(100, Math.max(profile.unlocked, stage + 1));
      } else if (mode === "daily" && dailySeed === dateKey() && profile.daily !== dailySeed) {
        profile.streak = profile.daily === yesterday() ? profile.streak + 1 : 1;
        profile.daily = dailySeed;
        creditCoins(100, 'Daily challenge');
        const claims = profile.streakClaims ||= [];
        for (const [days, amount] of [[7,250],[30,1000]]) {
          if (profile.streak >= days && !claims.includes(days)) { claims.push(days); creditCoins(amount, 'Daily streak'); }
        }
      }
      announce("Victory!");
    } else if (!missionMode()) creditCoins(Math.min(30, Math.floor(score / 30)), 'Game completion');
    if (record && startingBest > 0) creditCoins(25, 'Personal record');
    checkBadges();
    persist();
    if (won && mode === "moves") {
      unlocked = profile.unlocked;
      try {
        localStorage.setItem("sweetSwapStage", String(unlocked));
      } catch (_) {}
    }
    const title = won
      ? mode === "daily"
        ? "Daily challenge complete!"
        : `Stage ${stage} Complete! ${"★".repeat(profile.stars[stage] || 1)}`
      : reason === "quit" ? "Game Complete!" : reason === "moves"
        ? "Out of Moves!"
        : record
          ? "New High Score!"
          : "Time’s Up!";
    message(title, 0);
    tone(won ? "level" : "end");
    overlay(
      won || record ? "🏆" : "🍬",
      title,
      missionMode()
        ? `${missionProgress()} • Score: ${score} • ${won ? (mode === "daily" ? (runRewards["Daily challenge"] ? "Daily reward recorded!" : "Daily mission complete!") : stage === 100 ? "Adventure completed!" : "Next stage unlocked!") : "Try this mission again!"}`
        : `Score: ${score} • Level ${level} • ${cleared} cleared • Best combo ×${bestCombo}${mode === "survival" ? ` • Moves survived: ${moves} • Record: ${profile.stats.survivalBestMoves || 0}` : ""}`,
      won && mode === "moves" && stage < 100
        ? "Next Stage"
        : missionMode() && !won
          ? "Retry Stage"
          : "Play Again",
    );
    $('results').hidden = false;
    $('results').replaceChildren();
    const summary = document.createElement('p');
    summary.textContent = `Moves ${moves} • Cleared ${cleared} • Specials ${runSpecials} • Combo ×${bestCombo}`;
    $('results').append(summary);
    const total = document.createElement('strong'); total.textContent = `🪙 ${rewardTotal()} coins earned this game`;
    $('results').append(total);
    const breakdown = document.createElement('small'); breakdown.textContent = Object.entries(runRewards).map(([k,v]) => `${k}: +${v}`).join(' • ') || 'No coins earned'; $('results').append(breakdown);
    if (won || record) confetti();
    $("overlay-btn").focus();
  }
  function reset(start = false) {
    cancelSwipe();
    invalidateUndo();
    runRewards = {}; runSpecials = 0;
    $('results').hidden = true;
    undoUsed = false;
    extraMoves = 0;
    booster = null;
    freeSwap = false;
    madeRainbow = 0;
    survivalLeft = 15;
    pendingPause = false;
    version++;
    clearInterval(timer);
    clearHint();
    clearTimeout(messageTimer);
    cells.forEach((c) =>
      c.getAnimations?.({ subtree: true }).forEach((a) => a.cancel()),
    );
    candyLayer.getAnimations?.({subtree:true}).forEach(a => a.cancel());
    effects.replaceChildren();
    score = 0;
    collected = activated = 0;
    time = 180000;
    busy = false;
    selected = -1;
    pointer = null;
    moves =
      cleared =
      bestCombo =
      energy =
      rushUntil =
      rushMoves =
      rushGeneration =
        0;
    combo = level = 1;
    shuffles = 3;
    best = loadBest();
    startingBest = best;
    achievements = new Set();
    state = start ? "playing" : "ready";
    if (!start && mode === "moves") stage = unlocked;
    document
      .querySelectorAll("[data-mode]")
      .forEach((b) =>
        b.setAttribute("aria-pressed", String(b.dataset.mode === mode)),
      );
    syncMusic();
    if (mode === "daily") {
      dailySeed = dateKey();
      randomState = Number(dailySeed.replaceAll("-", ""));
    }
    setupObstacles();
    grid = generate();
    createBoard();
    render();
    update();
    message(defaultMessage(), 0);
    if (start) {
      profile.save = null;
      $("overlay").hidden = true;
      startClock();
      scheduleHint();
      saveGame();
    } else
      overlay(
        "🍭",
        "Ready to play?",
        missionMode()
          ? `${mode === "daily" ? "Daily" : "Stage " + stage}: ${missionLabel()} in ${mission().moves} moves.`
          : MODES[mode].description,
        "Start Game",
      );
  }
  function pause() {
    if (!playable()) return;
    cancelSwipe();
    tick();
    if (state !== "playing") return;
    state = "paused";
    syncMusic();
    clearInterval(timer);
    clearHint();
    overlay(
      "⏸",
      "Game Paused",
      "Take a break. Your candies are waiting!",
      "Resume Game",
    );
    message("Game paused", 0);
    update();
    saveGame();
    $("overlay-btn").focus();
  }
  function resume() {
    if (state !== "paused") return;
    state = "playing";
    syncMusic();
    $("overlay").hidden = true;
    startClock();
    update();
    message("Let’s play!");
    scheduleHint();
  }
  $("overlay-btn").addEventListener("click", () => {
    unlockAudio();
    if (state === "paused") resume();
    else {
      if (state === "stagewon" && mode === "moves")
        stage = Math.min(100, stage + 1);
      reset(true);
    }
  });
  $("pause-btn").addEventListener("click", () => {
    unlockAudio();
    if (state === "paused") resume();
    else pause();
  });
  $("hint-btn").addEventListener("click", () => {
    unlockAudio();
    hint();
  });
  $("restart-btn").addEventListener("click", () => {
    if (busy) return;
    if (['playing','paused'].includes(state) && !confirm('Restart and abandon the current game? Coins already earned are retained.')) return;
    profile.save = null; persist();
    unlockAudio();
    reset(false);
  });
  $('finish-btn').onclick = () => {
    if (busy || !['playing','paused'].includes(state)) return;
    if (!confirm('Finish this game and collect your rewards?')) return;
    if (state === 'paused') state = 'playing';
    finish('quit');
  };
  $('coin-btn').onclick = () => openHub('Shop');
  $("shuffle-btn").addEventListener("click", () => {
    if (!playable() || !shuffles) return;
    unlockAudio();
    invalidateUndo();
    shuffles--;
    selected = -1;
    clearHint();
    grid = generate();
    render();
    update();
    tone("swap");
    message("🔀 Fresh candies!");
    scheduleHint();
    stableCheckpoint();
  });
  $("sound-btn").addEventListener("click", () => {
    sound = !sound;
    profile.settings.sound = sound;
    persist();
    $("sound-btn").innerHTML = sound
      ? "🔊<span>Sound</span>"
      : "🔇<span>Muted</span>";
    $("sound-btn").setAttribute("aria-pressed", String(sound));
    if (sound) {
      unlockAudio();
      tone("swap");
    }
  });
  document
    .querySelectorAll("[data-mode]")
    .forEach((b) =>
      b.addEventListener("click", () => chooseMode(b.dataset.mode)),
    );
  const help = $("help-dialog");
  const helpTabs = [...help.querySelectorAll("[data-help-tab]")];
  function selectHelpTab(topic, focus = false) {
    for (const tab of helpTabs) {
      const active = tab.dataset.helpTab === topic;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      $(tab.getAttribute("aria-controls")).hidden = !active;
      if (active && focus) tab.focus();
    }
    help.querySelector(".help-content").scrollTop = 0;
  }
  helpTabs.forEach((tab, index) => {
    tab.addEventListener("click", () => selectHelpTab(tab.dataset.helpTab));
    tab.addEventListener("keydown", (event) => {
      let next;
      if (event.key === "ArrowRight") next = (index + 1) % helpTabs.length;
      else if (event.key === "ArrowLeft") next = (index + helpTabs.length - 1) % helpTabs.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = helpTabs.length - 1;
      else return;
      event.preventDefault();
      selectHelpTab(helpTabs[next].dataset.helpTab, true);
    });
  });
  help.addEventListener("keydown", (event) => {
    if (event.key === "Escape") event.stopPropagation();
  });
  $("help-btn").addEventListener("click", () => {
    if (busy || help.open) return;
    helpPaused = state === "playing";
    if (helpPaused) pause();
    help.showModal();
    selectHelpTab(mode === "survival" ? "survival" : "modes", true);
  });
  $("close-help").addEventListener("click", () => help.close());
  help.addEventListener("close", () => {
    if (helpPaused && state === "paused") resume();
    helpPaused = false;
    $("help-btn").focus();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !help.open && !$('hub').open) {
      if (booster && playable()) { booster = null; saveGame(); message('Booster cancelled'); return; }
      if (state === "paused") resume();
      else pause();
    }
  });
  let extraMoves = 0,
    undoUsed = false,
    randomState = 0;
  function rng() {
    if (mode !== "daily") return Math.random();
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 4294967296;
  }
  function checkEnd() {
    if (
      missionMode() &&
      (missionValue() >= mission().target ||
        moves >= mission().moves + extraMoves)
    )
      finish(missionValue() >= mission().target ? "won" : "moves");
    else if (mode === "survival" && survivalLeft <= 0) finish("moves");
  }
  const items = {
    hammer: ["🔨 Hammer", 100],
    bomb: ["💣 Mega bomb", 200],
    blast: ["🌈 Colour blast", 250],
    shuffle: ["🔀 Super shuffle", 75],
    moves: ["➕ 5 moves", 150],
    time: ["⏱ 30 seconds", 150],
    free: ["👆 Free swap", 120],
    rush: ["⚡ Sugar Rush", 300],
  };
  const themes = {
    classic: "Candy Classic",
    neon: "Neon Arcade",
    ocean: "Ocean Paradise",
    gold: "Golden Royal",
  };
  const badges = [
    ["first", "First crush", () => profile.stats.cleared >= 3],
    ["collector", "Candy collector", () => profile.stats.cleared >= 1000],
    ["combo", "Combo king", () => profile.stats.bestCombo >= 10],
    ["rainbow", "Rainbow master", () => profile.stats.rainbows >= 50],
    ["bomb", "Bomb expert", () => profile.stats.bombs >= 100],
    ["rush", "Sugar rush fan", () => profile.stats.rushes >= 20],
    ["adventure", "Adventurer", () => Object.keys(profile.stars).length >= 50],
    [
      "perfect",
      "Perfectionist",
      () => Object.values(profile.stars).filter((x) => x === 3).length >= 20,
    ],
    ["daily", "Daily champion", () => profile.streak >= 7],
    ["legend", "Sweet legend", () => Object.keys(profile.stars).length >= 100],
  ];
  function checkBadges() {
    for (const [id, label, test] of badges)
      if (test() && !profile.badges.includes(id)) {
        profile.badges.push(id);
        creditCoins(50, "Achievement");
        message("🏅 " + label);
        announce(label);
      }
  }
  const hub = $("hub"),
    content = $("hub-content");
  let hubResume = false;
  function openHub(tab = "Home") {
    if (busy || hub.open) return;
    hubResume = state === "playing";
    if (hubResume) pause();
    hub.showModal();
    showTab(tab);
  }
  function closeHub() {
    hub.close();
  }
  hub.addEventListener("close", () => {
    if (hubResume && state === "paused") resume();
    hubResume = false;
  });
  $("hub-close").onclick = closeHub;
  const tabs = [
    "Home",
    "Levels",
    "Boosters",
    "Shop",
    "Profile",
    "Themes",
    "Settings",
  ];
  $("hub-tabs").innerHTML = tabs
    .map((t) => `<button data-tab="${t}">${t}</button>`)
    .join("");
  $("hub-tabs").onclick = (e) => {
    if (e.target.dataset.tab) showTab(e.target.dataset.tab);
  };
  function showTab(tab) {
    updateCoins();
    $("hub-title").textContent = `${tab} • 🪙 ${profile.coins}`;
    document
      .querySelectorAll("[data-tab]")
      .forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    content.replaceChildren();
    const add = (label, fn, disabled = false) => {
      const b = document.createElement("button");
      b.textContent = label;
      b.disabled = disabled;
      b.onclick = fn;
      content.append(b);
      return b;
    };
    const info = (t) => {
      const p = document.createElement("p");
      p.textContent = t;
      content.append(p);
    };
    if (tab === "Home") {
      for (const [id, m] of Object.entries(MODES))
        add(
          {
            timed: "Timed",
            moves: "Adventure",
            endless: "Endless",
            daily: "Daily",
            survival: "Survival",
          }[id] +
            " — " +
            m.description,
          () => {
            if (['playing','paused'].includes(state) && !confirm('Start a new game? Current game will be replaced.')) return;
            hubResume = false;
            mode = id;
            stage = id === "moves" ? profile.unlocked : 1;
            dailySeed = dateKey();
            best = loadBest();
            closeHub();
            reset(true);
          },
        );
      add(
        "Resume saved game",
        () => {
          const s = profile.save;
          if (!s) return;
          if (["playing","paused"].includes(state)) { closeHub(); return; }
          hubResume = false;
          closeHub();
          reset(false);
          restore(s);
          state = "paused";
          overlay(
            "⏸",
            "Saved game",
            "Continue your previous game.",
            "Resume Game",
          );
          update();
        },
        !profile.save,
      );
      add(
        "Claim daily reward • 50 coins",
        () => {
          invalidateUndo();
          profile.reward = dateKey();
          creditCoins(50, "Daily login", false);
          persist();
          showTab(tab);
        },
        profile.reward === dateKey(),
      );
    }
    if (tab === "Levels") {
      info(
        "100 levels • ★ ratings • " +
          Object.keys(profile.stars).length +
          " completed",
      );
      content.classList.add("level-list");
      for (let i = 1; i <= 100; i++)
        add(
          `${i} ${i > profile.unlocked ? "🔒" : "★".repeat(profile.stars[i] || 0)}`,
          () => {
            if (['playing','paused'].includes(state) && !confirm('Start this level? Current game will be replaced.')) return;
            hubResume = false;
            closeHub();
            mode = "moves";
            stage = i;
            best = loadBest();
            reset(true);
          },
          i > profile.unlocked,
        );
    } else content.classList.remove("level-list");
    if (tab === "Shop")
      for (const [id, [name, cost]] of Object.entries(items))
        add(
          `${name} • ${cost} coins • Owned ${profile.inventory[id] || 0}`,
          () => {
            invalidateUndo();
            profile.coins -= cost;
            profile.inventory[id] = (profile.inventory[id] || 0) + 1;
            persist();
            showTab(tab);
          },
          profile.coins < cost,
        );
    if (tab === "Boosters") {
      info("Select a booster, then tap a candy if required.");
      if (booster) add('Cancel selected booster', () => { booster = null; saveGame(); closeHub(); message('Booster cancelled'); });
      for (const [id, [name]] of Object.entries(items))
        add(
          `${name} (${profile.inventory[id] || 0})`,
          () => {
            closeHub();
            if (state === "paused") resume();
            activateBooster(id);
          },
          !profile.inventory[id] ||
            state !== "paused" ||
            (id === "time" && mode !== "timed") ||
            (id === "moves" && !missionMode() && mode !== "survival") ||
            (id === "moves" && mode === "survival" && survivalLeft >= SURVIVAL_CAP),
        );
      add(
        "Undo last move (once per game)",
        () => {
          closeHub();
          if (state === "paused") resume();
          if (canUndo()) {
            const remaining = time, f = undoFinance, snapshot = undo;
            restore(snapshot);
            profile.coins = f.coins; profile.stats = f.stats; profile.badges = f.badges;
            profile.inventory = f.inventory; runRewards = f.rewards; runSpecials = f.specials; best = f.best;
            commitBest();
            if (mode === "timed") time = Math.min(time, remaining);
            startClock();
            undoUsed = true;
            invalidateUndo();
            update();
            saveGame();
          }
        },
        !canUndo(),
      );
    }
    if (tab === "Profile") {
      info(
        `Games: ${profile.stats.games} • Wins: ${profile.stats.wins} • Candies: ${profile.stats.cleared} • Best combo: ×${profile.stats.bestCombo} • Daily streak: ${profile.streak}`,
      );
      info(`🔥 Survival record: ${profile.stats.survivalBestMoves || 0} moves`);
      info("Survival milestones (one-time coin rewards):");
      for (const [threshold, coins] of SURVIVAL_MILESTONES)
        info(`${(profile.stats.survivalMilestones || []).includes(threshold) ? "🏆" : "🔒"} ${threshold} moves • ${coins} coins`);
      for (const [id, label] of badges)
        info(`${profile.badges.includes(id) ? "🏆" : "🔒"} ${label}`);
    }
    if (tab === "Themes")
      for (const [id, name] of Object.entries(themes))
        add(
          `${name} ${profile.theme === id ? "✓" : profile.themes.includes(id) ? "" : "• 200 coins"}`,
          () => {
            if (!profile.themes.includes(id)) {
              invalidateUndo();
              profile.coins -= 200;
              profile.themes.push(id);
            }
            profile.theme = id;
            document.body.dataset.theme = id;
            persist();
            showTab(tab);
          },
          !profile.themes.includes(id) && profile.coins < 200,
        );
    if (tab === "Settings") {
      for (const [id, label] of [
        ["music", "Music volume"],
        ["sfx", "Sound effects volume"],
      ]) {
        const l = document.createElement("label");
        l.textContent = label;
        const r = document.createElement("input");
        r.type = "range";
        r.min = 0;
        r.max = 1;
        r.step = 0.05;
        r.value = profile.settings[id];
        r.oninput = () => {
          profile.settings[id] = +r.value;
          music.volume = profile.settings.music;
          persist();
        };
        l.append(r);
        content.append(l);
      }
      for (const id of ["voice", "vibrate"])
        add(`${id}: ${profile.settings[id] ? "On" : "Off"}`, () => {
          profile.settings[id] = !profile.settings[id];
          persist();
          showTab(tab);
        });
      add("Switch background track", () => {
        profile.settings.track = 1 - profile.settings.track;
        music.src = profile.settings.track
          ? "sweet-swap-theme-2.mp3"
          : "sweet-swap-theme.mp3";
        persist();
        syncMusic();
      });
      add("Fullscreen", () => {
        if (document.fullscreenElement) document.exitFullscreen?.();
        else document.documentElement.requestFullscreen?.().catch(() => {});
      });
      add("Export progress", () => {
        saveGame();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(
          new Blob([JSON.stringify({...profile, highScores: Object.fromEntries(Object.entries(MODES).map(([id,m])=>[id, Number(localStorage.getItem(m.key)) || 0]))})], { type: "application/json" }),
        );
        a.download = "sweet-swap-save.json";
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      });
      const f = document.createElement("input");
      f.type = "file";
      f.accept = ".json,application/json";
      f.onchange = async () => {
        try {
          const x = JSON.parse(await f.files[0].text());
          if (
            !Number.isFinite(x.coins) ||
            x.coins < 0 ||
            !Number.isInteger(x.unlocked) ||
            x.unlocked < 1 ||
            x.unlocked > 100 ||
            !x.stats ||
            !x.inventory ||
            !Array.isArray(x.badges) ||
            !Array.isArray(x.themes)
          )
            throw Error();
          if (!confirm('Replace your local profile with this file?')) return;
          const defaults = fresh();
          profile = { ...defaults, ...x, stats: {...defaults.stats,...x.stats}, settings:{...defaults.settings,...x.settings}, inventory:{...defaults.inventory,...x.inventory}, save: null };
          if (x.highScores) for (const [id,m] of Object.entries(MODES)) {
            const value = x.highScores[id];
            if (Number.isFinite(value) && value >= 0) localStorage.setItem(m.key, String(Math.floor(value)));
          }
          persist();
          location.reload();
        } catch (_) {
          info("Invalid save file.");
        }
      };
      info("Import progress (replaces local progress; active game excluded)");
      content.append(f);
    }
  }
  function activateBooster(id) {
    if (!playable() || !profile.inventory[id]) return;
    if (id === "moves" && mode === "survival" && survivalLeft >= SURVIVAL_CAP) {
      message("Move balance is already full!");
      return;
    }
    if (booster) booster = null;
    invalidateUndo();
    if (["hammer", "bomb", "blast"].includes(id)) {
      booster = id;
      message("Tap a candy to activate " + items[id][0] + " • Esc to cancel", 0);
      saveGame();
      return;
    }
    profile.inventory[id]--;

    if (id === "shuffle") {
      grid = generate();
      render();
    }
    if (id === "moves") {
      if (mode === "survival") grantSurvivalMoves(5, "Booster");
      else extraMoves += 5;
    }
    if (id === "time") {
      time += 30000;
      deadline += 30000;
    }
    if (id === "free") {
      freeSwap = true;
      message("Your next swap can be free!");
    }
    if (id === "rush") {
      if (!rushActive()) grantSurvivalMoves(2, "Sugar Rush");
      rushGeneration++;
      if (mode === "timed") rushUntil = 10000;
      else rushMoves = 3;
    }
    update();
    saveGame();
  }
  async function useTarget(i) {
    const id = booster;
    if (!id || !profile.inventory[id] || !playable()) return;
    stableCheckpoint();
    invalidateUndo();
    profile.inventory[id]--;
    booster = null;
    busy = true; update();
    const v = version,
      hit = new Set([i]);
    if (id === "blast")
      grid.forEach((c, n) => {
        if (c.color === grid[i].color) hit.add(n);
      });
    if (id === "bomb")
      for (let n = 0; n < 64; n++)
        if (Math.abs(row(n) - row(i)) <= 2 && Math.abs(col(n) - col(i)) <= 2)
          hit.add(n);
    try {
      await resolve(v, { hit, created: new Map() });
      if (current(v)) checkEnd();
    } finally {
      if (current(v)) {
        busy = false;
        render();
        update();
        checkBadges();
        stableCheckpoint();
        if (mode === 'timed' && time <= 0) { finish(); return; }
        if (pendingPause) {
          pendingPause = false;
          pause();
        }
      }
    }
  }
  $("hub-btn").onclick = () => openHub();
  $("boost-btn").onclick = () => openHub("Boosters");
  document.body.dataset.theme = profile.theme;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "playing") {
      if (busy) pendingPause = true;
      else pause();
    }
  });
  window.addEventListener("pagehide", saveGame);
  // Service worker: disabled during local development, enabled on HTTPS hosting.
  const isLocalDevelopment = ["localhost", "127.0.0.1", "[::1]"].includes(
    location.hostname,
  );
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    if (isLocalDevelopment) {
      navigator.serviceWorker
        .getRegistrations()
        .then(async (registrations) => {
          const scope = new URL("./", location.href).href;
          for (const registration of registrations) {
            if (registration.scope === scope) await registration.unregister();
          }
          console.log(
            "Sweet Swap: Service Worker disabled for local development.",
          );
        })
        .catch(console.error);
    } else {
      const registerWorker = async () => {
        try {
          const registration = await navigator.serviceWorker.register(
            "./sw.js",
            {
              updateViaCache: "none",
            },
          );
          let prompt = null, applying = false, dismissedWorker = null;
          let hadController = Boolean(navigator.serviceWorker.controller);
          const waitForIdle = async () => {
            while (busy) await new Promise(resolve => setTimeout(resolve, 100));
            cancelSwipe();
            if (state === "playing") pause();
            saveGame();
          };
          navigator.serviceWorker.addEventListener("controllerchange", async () => {
            if (!hadController && !applying) { hadController = true; return; }
            if (prompt) prompt.querySelector(".update-status").textContent = "Saving and opening the new version…";
            await waitForIdle();
            location.reload();
          });
          const notifyUpdate = () => {
            const worker = registration.waiting;
            if (!worker || !navigator.serviceWorker.controller || worker === dismissedWorker || prompt) return;
            prompt = document.createElement("section");
            prompt.className = "sweet-update";
            prompt.setAttribute("aria-label", "Game update available");
            prompt.innerHTML = `<strong>🍭 Update available!</strong><p class="update-status" role="status">A sweeter version is ready. Update when you are ready.</p><div><button type="button" class="update-now">Update now</button><button type="button" class="update-later">Later</button></div>`;
            document.body.append(prompt);
            const now = prompt.querySelector(".update-now"), later = prompt.querySelector(".update-later"), status = prompt.querySelector(".update-status");
            later.onclick = () => { dismissedWorker = worker; prompt.remove(); prompt = null; };
            now.onclick = async () => {
              if (applying) return;
              applying = true; now.disabled = later.disabled = true;
              status.textContent = "Saving your game…";
              await waitForIdle();
              const waiting = registration.waiting;
              if (!waiting) { location.reload(); return; }
              status.textContent = "Installing update…";
              waiting.postMessage({ type: "SKIP_WAITING" });
              setTimeout(() => {
                if (!applying || !prompt) return;
                applying = false; now.disabled = later.disabled = false;
                status.textContent = "Update has not activated yet. Try again or reopen Sweet Swap.";
              }, 12000);
            };
          };
          registration.addEventListener('updatefound', () => {
            registration.installing?.addEventListener('statechange', notifyUpdate);
          });
          await registration.update();
          notifyUpdate();
        } catch (error) {
          console.error(
            "Sweet Swap: Service Worker registration failed:",
            error,
          );
        }
      };
      if (document.readyState === "complete") registerWorker();
      else window.addEventListener("load", registerWorker, { once: true });
    }
  }
  reset();
});
