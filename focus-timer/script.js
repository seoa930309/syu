(() => {
  const NS = "http://www.w3.org/2000/svg";
  const C = 200;                       // 중심
  const MAX_TRACK = 12 * 3600 * 1000;  // 12시간
  const $ = id => document.getElementById(id);
  const pad = n => String(n).padStart(2, "0");
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };

  // ---------- 상태 ----------
  const saved = store.get("pomoSettings", {});
  const S = {
    mode: "pomo",
    sound: store.get("sound", true),
    pomo: {
      target: saved.target ? clamp(saved.target, 1, 99) : null,   // null = 목표 없이 카운트만
      focusSec: clamp(saved.focusSec || (saved.focusMin || 25) * 60, 1, 3600),   // 집중 시간(초)
      breakSec: clamp(saved.breakSec || (saved.breakMin || 5) * 60, 1, 3600),   // 휴식 시간(초)
      done: 0,
      phase: "focus",      // focus | break
      remaining: 0,        // 현재 단계 남은 ms
      running: false,
      endAt: 0,
      finished: false
    },
    track: {
      total: clamp(store.get("trackTotal", 0), 0, MAX_TRACK),
      running: false,
      startedAt: 0,
      goalMin: store.get("trackGoal", null),   // 목표(분), null = 목표 없음
      goalHit: false
    }
  };
  S.pomo.remaining = S.pomo.focusSec * 1000;

  // ---------- 다이얼 그리기 ----------
  const polar = (r, deg) => {
    const a = (deg - 90) * Math.PI / 180;
    return [C + r * Math.cos(a), C + r * Math.sin(a)];
  };

  const dial = $("dial");
  for (let m = 0; m < 60; m += 5) {
    const deg = m * 6;
    const [tx, ty] = polar(172, deg);
    const t = document.createElementNS(NS, "text");
    t.setAttribute("x", tx); t.setAttribute("y", ty + 7);
    t.setAttribute("text-anchor", "middle");
    t.setAttribute("class", "dial-num");
    t.textContent = m;
    dial.appendChild(t);
    const [dx, dy] = polar(154, deg);
    const d = document.createElementNS(NS, "circle");
    d.setAttribute("cx", dx); d.setAttribute("cy", dy); d.setAttribute("r", 1.8);
    d.setAttribute("class", "dial-dot");
    dial.appendChild(d);
  }

  // 60개 분할 세그먼트
  const R_IN = 116, R_OUT = 142;
  const arc = $("arc");
  const segs = [];
  for (let i = 0; i < 60; i++) {
    const a0 = i * 6 + 0.7, a1 = (i + 1) * 6 - 0.7;
    const [x0, y0] = polar(R_OUT, a0), [x1, y1] = polar(R_OUT, a1);
    const [x2, y2] = polar(R_IN, a1),  [x3, y3] = polar(R_IN, a0);
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", `M${x0} ${y0}A${R_OUT} ${R_OUT} 0 0 1 ${x1} ${y1}L${x2} ${y2}A${R_IN} ${R_IN} 0 0 0 ${x3} ${y3}Z`);
    p.setAttribute("fill", "var(--arc-off)");
    arc.appendChild(p);
    segs.push(p);
  }
  let lastArc = "";
  function drawArc(count, color) {
    const key = count + color;
    if (key === lastArc) return;
    lastArc = key;
    segs.forEach((p, i) => p.setAttribute("fill", i < count ? color : "var(--arc-off)"));
  }

  // ---------- 소리 ----------
  const SND = store.get("soundPrefs", {});
  S.soundType = SND.type || "beep";
  S.volume = SND.volume ?? 70;
  let actx;
  function audio() {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === "suspended") actx.resume();
    return actx;
  }
  // 한 음: 시작 시각, 주파수, 파형, 길이, 세기, 어택
  function tone(out, t, freq, type, dur, peak, attack = 0.01) {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t); o.stop(t + dur + 0.05);
  }
  // 알림음 종류별 한 묶음의 소리와 간격(초)
  const SOUNDS = {
    beep:    { gap: 0.35, play: (o, t) => tone(o, t, 880, "sine", 0.25, 0.6) },
    digital: { gap: 0.6,  play: (o, t) => { for (let i = 0; i < 4; i++) tone(o, t + i * 0.08, 2000, "square", 0.05, 0.12, 0.003); } },
    chime:   { gap: 0.7,  play: (o, t) => { tone(o, t, 659, "sine", 0.9, 0.5); tone(o, t + 0.18, 988, "sine", 1.0, 0.45); } },
    bell:    { gap: 1.1,  play: (o, t) => { tone(o, t, 523, "sine", 1.6, 0.55, 0.005); tone(o, t, 1318, "sine", 0.9, 0.2, 0.005); tone(o, t, 2093, "sine", 0.4, 0.08, 0.005); } },
    soft:    { gap: 0.8,  play: (o, t) => tone(o, t, 440, "triangle", 0.7, 0.55, 0.12) }
  };
  const ALARM_REPEAT = 3;   // 알람은 3번 울리고 자동으로 꺼짐
  function beep(times = ALARM_REPEAT, force = false) {
    if ((!S.sound && !force) || S.volume <= 0) return;
    try {
      audio();
      const master = actx.createGain();
      master.gain.value = (S.volume / 100) ** 2;   // 귀로 듣기에 자연스러운 볼륨 곡선
      master.connect(actx.destination);
      const snd = SOUNDS[S.soundType] || SOUNDS.beep;
      for (let i = 0; i < times; i++) snd.play(master, actx.currentTime + 0.02 + i * snd.gap);
    } catch {}
  }
  function renderSound() {
    $("soundWave").classList.toggle("hidden", !S.sound);
    $("soundMute").classList.toggle("hidden", S.sound);
  }
  $("soundBtn").addEventListener("click", () => {
    S.sound = !S.sound; store.set("sound", S.sound); renderSound();
    if (S.sound) beep(1);
  });

  const saveSound = () => store.set("soundPrefs", { type: S.soundType, volume: S.volume });
  $("soundType").value = S.soundType;
  $("volume").value = S.volume;
  $("volumeOut").textContent = S.volume + "%";
  $("soundType").addEventListener("change", e => { S.soundType = e.target.value; saveSound(); beep(1, true); });
  $("volume").addEventListener("input", e => { S.volume = +e.target.value; $("volumeOut").textContent = S.volume + "%"; saveSound(); });
  $("volume").addEventListener("change", () => beep(1, true));
  $("soundTest").addEventListener("click", () => beep(ALARM_REPEAT, true));

  // ---------- 테두리 색 ----------
  // 흑백 톤 + 컬러, 그리고 직접 고르기(색상표 / 색 코드)
  const PALETTE = [
    "#f5f5f5", "#d4d4d4", "#b0b0b0", "#8c8c8c", "#4a4a4a",
    "#ff5a5a", "#ff9f43", "#ffd43b", "#51cf66", "#20c997", "#4dabf7", "#5c7cfa", "#9775fa", "#f06595"
  ];
  const COLORS = store.get("ringColorsBW", {});
  const HEX = /^#[0-9a-f]{6}$/i;
  document.querySelectorAll(".swatches").forEach(box => {
    const cssVar = box.dataset.var, key = box.dataset.key;
    const row = box.closest(".row"), hex = row.querySelector(".hex"), preview = row.querySelector(".preview");
    const def = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
    const chips = PALETTE.map(c => {
      const b = document.createElement("button");
      b.className = "swatch"; b.style.background = c; b.title = c; b.dataset.c = c;
      b.addEventListener("click", () => apply(c));
      box.appendChild(b);
      return b;
    });
    const custom = document.createElement("label");
    custom.className = "custom"; custom.title = "직접 고르기";
    const picker = document.createElement("input");
    picker.type = "color";
    custom.appendChild(picker);
    box.appendChild(custom);
    picker.addEventListener("input", () => apply(picker.value));
    hex.addEventListener("input", () => {
      let v = hex.value.trim();
      if (v && v[0] !== "#") v = "#" + v;
      const ok = HEX.test(v);
      hex.classList.toggle("bad", !ok && v.length >= 7);
      if (ok) apply(v, true);
    });
    hex.addEventListener("blur", () => { hex.value = current.toUpperCase(); hex.classList.remove("bad"); });
    hex.addEventListener("keydown", e => { if (e.key === "Enter") hex.blur(); });

    let current = def;
    function show(c) {
      current = c.toLowerCase();
      document.documentElement.style.setProperty(cssVar, current);
      const inPalette = PALETTE.includes(current);
      chips.forEach(b => b.classList.toggle("on", b.dataset.c === current));
      custom.classList.toggle("on", !inPalette);
      picker.value = current;
      preview.style.background = current;
      if (document.activeElement !== hex) hex.value = current.toUpperCase();
    }
    function apply(c, fromHex) {
      show(c);
      if (!fromHex) hex.value = current.toUpperCase();
      COLORS[key] = current; store.set("ringColorsBW", COLORS);
      lastArc = "";   // 원호 다시 칠하기
      render();
    }
    show(COLORS[key] || def);
  });

  // 접기/펼치기 상태 기억
  [["soundSection", "soundOpen"], ["colorSection", "colorOpen"]].forEach(([id, key]) => {
    const el = $(id);
    el.open = store.get(key, false);
    el.addEventListener("toggle", () => store.set(key, el.open));
  });

  // ---------- 뽀모도로 ----------
  const P = S.pomo;
  const fmtMS = ms => {
    const s = Math.ceil(ms / 1000);
    return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
  };

  function pomoStep(now) {
    if (!P.running) return;
    P.remaining = P.endAt - now;
    while (P.running && P.remaining <= 0) {
      const over = -P.remaining;
      if (P.phase === "focus") {
        P.done = Math.min(99, P.done + 1);
        if (P.target && P.done >= P.target) {       // 목표 달성
          P.running = false;
          P.finished = true;
          P.phase = "focus";
          P.remaining = 0;               // 다 끝나면 00:00으로
          beep(ALARM_REPEAT);
          break;
        }
        P.phase = "break";
        P.remaining = P.breakSec * 1000 - over;
      } else {
        P.phase = "focus";
        P.remaining = P.focusSec * 1000 - over;
      }
      P.endAt = now + P.remaining;
      beep(ALARM_REPEAT);
    }
  }

  function renderPomo() {
    // 끝난 단계는 00:00으로 표시
    const focusMs = P.phase === "focus" ? P.remaining : 0;
    const breakMs = P.finished ? 0 : P.phase === "break" ? P.remaining : P.breakSec * 1000;
    $("doneText").textContent = pad(P.done);
    $("targetText").textContent = P.target ? pad(P.target) : "--";
    $("focusText").textContent = fmtMS(focusMs);
    $("breakText").textContent = fmtMS(breakMs);

    const paused = !P.running && !P.finished && (P.phase === "break" || P.remaining !== P.focusSec * 1000);
    const phase = P.phase === "focus" ? "집중" : "휴식";
    $("phaseText").textContent = P.finished ? "완료!" : P.running ? phase : paused ? phase + " · 일시정지" : "대기";

    // 진행 중인 단계만 밝게
    $("focusText").style.opacity = P.phase === "focus" && !P.finished ? 1 : 0.45;
    $("breakText").style.opacity = P.phase === "break" ? 1 : 0.55;
    $("breakText").setAttribute("font-size", P.phase === "break" ? 44 : 40);
    $(P.phase === "focus" ? "focusText" : "breakText").classList.toggle("blink", paused);
    $(P.phase === "focus" ? "breakText" : "focusText").classList.remove("blink");

    const mins = Math.ceil(Math.max(0, P.remaining) / 60000);
    drawArc(mins, P.phase === "focus" ? "var(--arc-on)" : "var(--arc-break)");
  }

  // ---------- 타임트래킹 ----------
  const T = S.track;
  const trackElapsed = now => Math.min(MAX_TRACK, T.total + (T.running ? now - T.startedAt : 0));

  function trackStep(now) {
    if (T.running && T.goalMin && !T.goalHit && trackElapsed(now) >= T.goalMin * 60000) {
      T.goalHit = true;
      beep(ALARM_REPEAT);
    }
    if (T.running && trackElapsed(now) >= MAX_TRACK) {
      T.total = MAX_TRACK; T.running = false;
      store.set("trackTotal", T.total);
      beep(ALARM_REPEAT);
    }
  }
  function renderTrack(now) {
    const ms = trackElapsed(now);
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600), m = Math.floor(totalSec / 60) % 60;
    $("trackText").textContent = `${pad(h)}:${pad(m)}`;
    $("trackSec").textContent = `${pad(totalSec % 60)}s`;
    const hit = T.goalMin && ms >= T.goalMin * 60000;
    $("trackState").textContent = ms >= MAX_TRACK ? "최대 12시간 도달"
      : (hit ? "목표 달성! · " : "") + (T.running ? "집중 중" : ms > 0 ? "휴식 중 (기록 제외)" : "대기");
    $("goalText").textContent = "목표 " + (T.goalMin ? `${pad(Math.floor(T.goalMin / 60))}:${pad(T.goalMin % 60)}` : "--:--");
    $("goalText").style.fill = hit ? "var(--arc-track)" : "";
    $("trackText").classList.toggle("blink", !T.running && ms > 0 && ms < MAX_TRACK);
    // 목표가 있으면 진행률, 없으면 현재 시간 안의 분
    const segs = T.goalMin ? Math.min(60, Math.floor(ms / (T.goalMin * 60000) * 60)) : (ms >= MAX_TRACK ? 60 : m);
    drawArc(segs, "var(--arc-track)");
  }

  // ---------- 공통 렌더 ----------
  function render() {
    const now = Date.now();
    const pomo = S.mode === "pomo";
    $("pomoView").classList.toggle("hidden", !pomo);
    $("trackView").classList.toggle("hidden", pomo);
    $("settingsPanel").classList.toggle("track", !pomo);
    $("modePomo").classList.toggle("active", pomo);
    $("modeTrack").classList.toggle("active", !pomo);
    $("modeCap").textContent = pomo ? "Pomodoro" : "Time Tracking";

    const running = pomo ? P.running : T.running;
    $("startBtn").textContent = running ? (pomo ? "일시정지" : "휴식 (일시정지)") : "시작";
    if (pomo) renderPomo(); else renderTrack(now);
  }

  function loop() {
    const now = Date.now();
    pomoStep(now);
    trackStep(now);
    render();
  }
  setInterval(loop, 200);
  document.addEventListener("visibilitychange", loop);

  // ---------- 버튼 ----------
  function toggleStart() {
    const now = Date.now();
    if (S.mode === "pomo") {
      if (P.running) {
        pomoStep(now);
        P.running = false;
      } else {
        if (P.finished || (P.target && P.done >= P.target)) {
          P.finished = false; P.done = 0; P.phase = "focus"; P.remaining = P.focusSec * 1000;
        }
        P.running = true;
        P.endAt = now + P.remaining;
      }
    } else {
      if (T.running) {
        T.total = trackElapsed(now); T.running = false;
        store.set("trackTotal", T.total);
      } else if (T.total < MAX_TRACK) {
        T.running = true; T.startedAt = now;
      }
    }
    // 오디오 컨텍스트는 사용자 동작으로 열어둠
    try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume(); } catch {}
    render();
  }
  function reset() {
    if (S.mode === "pomo") {
      Object.assign(P, { running: false, finished: false, done: 0, phase: "focus", remaining: P.focusSec * 1000 });
    } else {
      if (T.total > 0 || T.running) {
        if (!confirm("누적된 집중 시간을 초기화할까요?")) return;
      }
      Object.assign(T, { running: false, total: 0, goalHit: false });
      store.set("trackTotal", 0);
    }
    render();
  }
  $("startBtn").addEventListener("click", toggleStart);
  $("resetBtn").addEventListener("click", reset);
  $("modePomo").addEventListener("click", () => { closeEdit(false); S.mode = "pomo"; render(); });
  $("modeTrack").addEventListener("click", () => { closeEdit(false); S.mode = "track"; render(); });
  document.addEventListener("keydown", e => {
    if (e.code === "Space" && e.target.tagName !== "INPUT" && e.target.tagName !== "BUTTON") {
      e.preventDefault(); toggleStart();
    }
  });
  window.addEventListener("beforeunload", () => {
    if (T.running) { T.total = trackElapsed(Date.now()); store.set("trackTotal", T.total); }
  });

  // ---------- 설정 ----------
  const LIMITS = { target: [1, 99], focusSec: [1, 3600], breakSec: [1, 3600] };
  function setSetting(key, val) {
    if (key === "target") {
      P.target = val ? clamp(Math.round(val), ...LIMITS.target) : null;
      P.finished = false;
    } else {
      if (P.running) return;
      P[key] = clamp(Math.round(val), ...LIMITS[key]);
      if (key === "focusSec") {
        P.finished = false;
        if (P.phase === "focus") P.remaining = P[key] * 1000;
      }
      if (key === "breakSec" && P.phase === "break") P.remaining = P[key] * 1000;
    }
    store.set("pomoSettings", { target: P.target, focusSec: P.focusSec, breakSec: P.breakSec });
    render();
  }
  function setGoal(min) {
    const ms = trackElapsed(Date.now());
    T.goalMin = min ? clamp(Math.round(min), 1, 720) : null;
    T.goalHit = !!T.goalMin && ms >= T.goalMin * 60000;   // 이미 넘긴 목표는 다시 울리지 않음
    store.set("trackGoal", T.goalMin);
    render();
  }

  // 화면 숫자를 눌러 직접 입력 (휴식 시간, 반복 횟수)
  const screen = $("screen"), editInput = $("editInput");
  let editKey = null;
  function openEdit(key, anchorEl, fontPx) {
    if ((key === "trackGoal") !== (S.mode === "track")) return;
    if ((key === "breakSec" || key === "focusSec") && P.running) return;
    const sr = screen.getBoundingClientRect(), ar = anchorEl.getBoundingClientRect();
    const k = sr.width / 400;
    editKey = key;
    editInput.style.left = (ar.left + ar.width / 2 - sr.left) + "px";
    editInput.style.top = (ar.top + ar.height / 2 - sr.top) + "px";
    editInput.style.fontSize = fontPx * k + "px";
    editInput.style.width = fontPx * k * (key === "target" ? 2.2 : key === "trackGoal" ? 4 : 3.2) + "px";
    editInput.style.height = fontPx * k * 1.35 + "px";
    editInput.style.setProperty("--edit-accent", key === "trackGoal" ? "var(--arc-track)" : "var(--arc-on)");
    editInput.placeholder = key === "target" ? "--" : key === "trackGoal" ? "시:분" : "분:초";
    editInput.maxLength = key === "target" ? 2 : 5;
    editInput.value = key === "target" ? (P.target || "")
      : key === "trackGoal" ? (T.goalMin ? fmtSec(T.goalMin) : "")
      : fmtSec(P[key]);
    editInput.classList.remove("hidden");
    editInput.focus();
    editInput.select();
  }
  function closeEdit(commit) {
    if (!editKey) return;
    const key = editKey, raw = editInput.value.trim();
    editKey = null;
    editInput.classList.add("hidden");
    if (!commit) return;
    if (key === "target") {
      const n = parseInt(raw, 10);
      setSetting("target", n > 0 ? n : null);   // 비우면 목표 해제
    } else if (key === "trackGoal") {
      setGoal(parseMS(raw));   // 시:분 → 분, 비우면 목표 해제
    } else {
      const sec = parseMS(raw);
      if (sec > 0) setSetting(key, sec);
    }
  }
  const fmtSec = sec => `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`;
  // "4:30" / "430" / "0430" → 270초, "5" → 5분
  function parseMS(raw) {
    if (!raw) return 0;
    let m, sec;
    if (raw.includes(":")) {
      const [a, b] = raw.split(":");
      m = parseInt(a || "0", 10); sec = parseInt(b || "0", 10);
    } else if (raw.length >= 3) {
      m = parseInt(raw.slice(0, -2), 10); sec = parseInt(raw.slice(-2), 10);
    } else {
      m = parseInt(raw, 10); sec = 0;
    }
    if (isNaN(m)) m = 0;
    if (isNaN(sec)) sec = 0;
    return m * 60 + Math.min(sec, 59);
  }
  editInput.addEventListener("input", () => {
    const re = editKey === "target" ? /\D/g : /[^\d:]/g;
    editInput.value = editInput.value.replace(re, "");
  });
  editInput.addEventListener("keydown", e => {
    if (editKey && editKey !== "target" && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      const dir = e.key === "ArrowUp" ? 1 : -1;
      const cur = parseMS(editInput.value.trim());
      let next;
      if (editKey === "trackGoal") next = clamp((cur || T.goalMin || 0) + dir, 1, 720);   // 1분씩
      else next = clamp((cur || P[editKey]) + dir, 1, 3600);                                // 1초씩
      editInput.value = fmtSec(next);
      editInput.select();
    }
    else if (e.key === "Enter") { e.preventDefault(); closeEdit(true); }
    else if (e.key === "Escape") { e.preventDefault(); closeEdit(false); }
  });
  editInput.addEventListener("blur", () => closeEdit(true));
  $("cycleText").addEventListener("click", () => openEdit("target", $("targetText"), 22));
  $("breakText").addEventListener("click", () => openEdit("breakSec", $("breakText"), 40));
  $("focusText").addEventListener("click", () => openEdit("focusSec", $("focusText"), 68));
  $("goalText").addEventListener("click", () => openEdit("trackGoal", $("goalText"), 22));

  // 다이얼 드래그 → 집중 시간 설정 (물리 타이머처럼)
  const svg = $("svg");
  let dragging = false;
  function dialMinutes(e) {
    const r = svg.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * 400 - C;
    const y = (e.clientY - r.top) / r.height * 400 - C;
    const dist = Math.hypot(x, y);
    let deg = Math.atan2(y, x) * 180 / Math.PI + 90;
    if (deg < 0) deg += 360;
    return { dist, min: Math.round(deg / 6) || 60 };
  }
  svg.addEventListener("pointerdown", e => {
    if (S.mode === "pomo" && (P.running || P.phase !== "focus")) return;
    const { dist, min } = dialMinutes(e);
    if (dist < R_IN - 8 || dist > 190) return;
    closeEdit(true);
    dragging = true;
    lastDial = null;
    screen.classList.add("dragging");
    svg.setPointerCapture(e.pointerId);
    applyDial(min);
  });
  svg.addEventListener("pointermove", e => {
    if (dragging) applyDial(dialMinutes(e).min);
  });
  let lastDial = null;
  // 뽀모도로: 눈금 = 분 / 트래킹: 5칸 = 1시간 (0 = 12시간)
  function applyDial(min) {
    // 0 근처에서 60 ↔ 1로 튀지 않도록 보정
    if (lastDial !== null && lastDial >= 50 && min <= 10) min = 60;
    else if (lastDial !== null && lastDial <= 10 && min >= 50) min = 1;
    lastDial = min;
    if (S.mode === "pomo") setSetting("focusSec", min * 60);
    else setGoal(Math.max(1, Math.round(min / 5)) * 60);
  }
  const endDrag = () => { dragging = false; screen.classList.remove("dragging"); };
  svg.addEventListener("pointerup", endDrag);
  svg.addEventListener("pointercancel", endDrag);

  renderSound();
  render();
})();
