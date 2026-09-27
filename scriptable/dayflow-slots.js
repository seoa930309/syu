// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: orange; icon-glyph: clock;

// dayflow 오전·오후·밤 위젯 (Scriptable) — 아이패드 · 아이폰 홈 화면
// 이 스크립트는 "오전·오후·밤" 전용이에요. 위젯 편집에서 Script만 이 스크립트로 고르면 돼요 (Parameter는 비워 둬요).
//
// 처음 한 번: Scriptable 앱에서 이 스크립트를 실행 → dayflow 앱의 "아이패드 위젯 연결 코드"를 붙여넣기
// 위젯 추가: 홈 화면 길게 누르기 → + → Scriptable → 크기 고르기 → 위젯 길게 눌러 "위젯 편집"
//   Script: 이 스크립트 / When Interacting: Run Script
//   Parameter: today 또는 오늘 · slots 또는 오전오후저녁 · matrix 또는 매트릭스
// 위젯을 누르면 체크 목록이 열리고, 누른 할 일은 바로 기기 연동에 저장돼요.

const SITE = 'https://seoa930309.github.io/syu/';
const FILE = 'dayflow.json';
const KC = 'dayflow.widget.config';
const QUADS = [['do', '일단 이것부터'], ['schedule', '시간 빼두기'], ['delegate', '얼른 처리하기'], ['pass', '패스']];
const SLOTS = [['morning', '오전'], ['afternoon', '오후'], ['night', '밤']];
const SHORT = { do: '이것부터', schedule: '시간 빼기', delegate: '얼른', pass: '패스' };
const QRANK = { do: 0, schedule: 1, delegate: 2, pass: 3 };
const SUBJ_DEF = { '임상신경학': ['#3b57e0', '신경'], '신경물치1': ['#12a594', '물치'], '운동치료학': ['#f76b15', '운치'], '임상운동학': ['#8e4ec6', '운동'], '전기광선': ['#d6409f', '전기'], '전체': ['#9a9aa0', '전체'], '기타과목': ['#9a9aa0', '기타'] };
const TITLES = { today: '오늘 할 일', slots: '오전 · 오후 · 밤', matrix: '매트릭스' };
const APP_VIEW = { today: 'calendar', slots: 'flow', matrix: 'matrix' };
const DOW = '일월화수목금토';
// 나눈 스크립트(할 일 확인 · 오전오후밤 · 매트릭스)는 여기에 종류가 정해져 있어요. null이면 위젯 Parameter로 골라요.
const FORCE = 'slots';

const fm = FileManager.local();
const CACHE = fm.joinPath(fm.documentsDirectory(), 'dayflow-widget-cache.json');

// 라이트 / 다크
const C = {
  bg: Color.dynamic(new Color('#ffffff'), new Color('#1b1c20')),
  fg: Color.dynamic(new Color('#1c1e22'), new Color('#e6e7ea')),
  muted: Color.dynamic(new Color('#7b8089'), new Color('#959aa3')),
  cell: Color.dynamic(new Color('#f3f4f6'), new Color('#24262b')),
  line: Color.dynamic(new Color('#e5e7eb'), new Color('#2c2e33'))
};

/* ---------- 날짜 ---------- */
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => ymd(new Date());
const dayLabel = () => { const d = new Date(); return `${d.getMonth() + 1}/${d.getDate()} (${DOW[d.getDay()]})`; };

/* ---------- 연결 정보 (Keychain) ---------- */
function getCfg() {
  try { return Keychain.contains(KC) ? JSON.parse(Keychain.get(KC)) : null; } catch (e) { return null; }
}
function setCfg(c) { Keychain.set(KC, JSON.stringify(c)); }
function parseCode(s) {
  s = String(s || '').trim();
  if (s.startsWith('dayflow:')) {
    try {
      const j = JSON.parse(Data.fromBase64String(s.slice(8)).toRawString());
      if (j && j.t) return { token: j.t, gist: j.g || '' };
    } catch (e) { return null; }
  }
  if (/^(gh[pousr]_|github_pat_)/.test(s)) return { token: s, gist: '' };
  return null;
}
async function setup() {
  const a = new Alert();
  a.title = 'dayflow 위젯 연결';
  a.message = 'dayflow 앱 → 기기 연동 → "아이패드 위젯 연결 코드 복사"를 누른 뒤 여기에 붙여넣어 주세요.';
  a.addTextField('dayflow:…', Pasteboard.pasteString() || '');
  a.addAction('연결');
  a.addCancelAction('취소');
  if (await a.presentAlert() === -1) return null;
  const c = parseCode(a.textFieldValue(0));
  if (!c) { await say('연결 코드가 아니에요', 'dayflow 앱에서 "아이패드 위젯 연결 코드 복사"를 다시 눌러 주세요.'); return null; }
  setCfg(c);
  try { await loadDoc(c); } catch (e) { await say('연결하지 못했어요', e.message); return null; }
  return c;
}
async function say(title, msg) { const a = new Alert(); a.title = title; a.message = msg || ''; a.addAction('확인'); await a.presentAlert(); }

/* ---------- 기기 연동 데이터 (GitHub Gist) ---------- */
async function gh(method, path, token, body) {
  const r = new Request('https://api.github.com' + path);
  r.method = method;
  r.headers = { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' };
  if (body) { r.body = JSON.stringify(body); r.headers['Content-Type'] = 'application/json'; }
  const j = await r.loadJSON();
  const st = r.response && r.response.statusCode;
  if (st === 401) throw new Error('토큰이 맞지 않아요. 연결 코드를 다시 붙여넣어 주세요.');
  if (st >= 400) throw new Error((j && j.message) || ('GitHub 오류 ' + st));
  return j;
}
async function findGist(c) {
  if (c.gist) return c.gist;
  const list = await gh('GET', '/gists?per_page=100', c.token);
  const g = (list || []).find(x => x.files && x.files[FILE]);
  if (!g) throw new Error('연동 데이터를 찾지 못했어요. dayflow 앱에서 기기 연동을 먼저 켜 주세요.');
  c.gist = g.id; setCfg(c);
  return c.gist;
}
async function loadDoc(c) {
  const id = await findGist(c);
  const g = await gh('GET', '/gists/' + id, c.token);
  const f = g.files && g.files[FILE];
  if (!f) throw new Error('연동 데이터가 비어 있어요.');
  let text = f.content;
  if (f.truncated) text = await new Request(f.raw_url).loadString();
  fm.writeString(CACHE, text);
  return JSON.parse(text);
}
async function getDoc(c) {
  try { return { doc: await loadDoc(c), fresh: true }; }
  catch (e) {
    if (fm.fileExists(CACHE)) return { doc: JSON.parse(fm.readString(CACHE)), fresh: false, err: e.message };
    throw e;
  }
}
/** 할 일 완료 ↔ 안 함: 최신 데이터를 받아 그 할 일만 바꿔서 올려요 (앱이 다음 동기화 때 받아가요) */
async function setDone(c, id, done) {
  const doc = await loadDoc(c);
  const t = (doc.tasks || []).find(x => x.id === id);
  if (!t) throw new Error('이 할 일을 찾지 못했어요 (다른 기기에서 지웠을 수 있어요).');
  t.done = done;
  t.u = Date.now();
  const text = JSON.stringify(doc);
  await gh('PATCH', '/gists/' + c.gist, c.token, { files: { [FILE]: { content: text } } });
  fm.writeString(CACHE, text);
}

/* ---------- 오늘 목록 ---------- */
function subjOf(doc, t) {
  if (!t.subject) return null;
  const s = (doc.settings && doc.settings.subjects && doc.settings.subjects[t.subject]) || null;
  const d = SUBJ_DEF[t.subject];
  return { color: (s && s.color) || (d && d[0]) || '#9a9aa0', ab: (s && s.ab) || (d && d[1]) || t.subject.slice(0, 2) };
}
const flowKey = t => t.forder != null ? t.forder : 1e9 + (t.quad ? QRANK[t.quad] : 4) * 1e6 + (t.order || 0);
function dayData(doc, d) {
  const on = (doc.tasks || []).filter(t => t.date <= d && (t.end || t.date) >= d);
  const ev = on.filter(t => t.kind === 'event').sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  const td = on.filter(t => t.kind !== 'event').sort((a, b) => flowKey(a) - flowKey(b));
  return { ev, td };
}
const openFirst = list => list.filter(t => !t.done).concat(list.filter(t => t.done));
const openCount = list => list.filter(t => !t.done).length;

/* ---------- 위젯 그리기 ---------- */
function textOn(hex) {
  const n = parseInt(hex.slice(1), 16);
  return ((n >> 16) * 299 + (n >> 8 & 255) * 587 + (n & 255) * 114) / 1000 >= 150 ? new Color('#1a1a1a') : new Color('#ffffff');
}
function header(w, title, right) {
  const h = w.addStack();
  h.centerAlignContent();
  const t = h.addText(title);
  t.font = Font.boldSystemFont(13); t.textColor = C.fg; t.lineLimit = 1;
  h.addSpacer();
  const r = h.addText(right);
  r.font = Font.systemFont(11); r.textColor = C.muted; r.lineLimit = 1;
  w.addSpacer(6);
}
function todoLine(parent, doc, t, fg, muted, size) {
  const s = parent.addStack();
  s.centerAlignContent();
  const m = s.addText(t.done ? '✓ ' : '○ ');
  m.font = Font.systemFont(size); m.textColor = muted;
  const sj = subjOf(doc, t);
  if (sj) {
    const a = s.addText(sj.ab + ' ');
    a.font = Font.boldSystemFont(size - 1); a.textColor = t.done ? muted : new Color(sj.color); a.lineLimit = 1;
  }
  const n = s.addText(t.title || '');
  n.font = Font.systemFont(size); n.textColor = t.done ? muted : fg; n.lineLimit = 1;
  if (t.done) n.textOpacity = 0.6;
  s.addSpacer();
}
function note(parent, text, color, size) {
  const x = parent.addText(text);
  x.font = Font.systemFont(size || 11); x.textColor = color || C.muted; x.lineLimit = 1;
}
function addTodos(parent, doc, list, max, fg, muted, size) {
  list = openFirst(list);
  list.slice(0, max).forEach(t => { todoLine(parent, doc, t, fg, muted, size); parent.addSpacer(2); });
  if (list.length > max) note(parent, `+${list.length - max}개 더`, muted, size - 2);
}
function capacity(fam) { return { small: 5, medium: 5, large: 13, extraLarge: 13 }[fam] || 5; }

function drawToday(w, doc, fam) {
  const { ev, td } = dayData(doc, today());
  header(w, TITLES.today, dayLabel() + (td.length ? ` · ${td.length - openCount(td)}/${td.length}` : ''));
  let room = capacity(fam);
  const size = fam === 'small' ? 12 : 13;
  ev.slice(0, fam === 'small' ? 1 : 3).forEach(e => {
    const s = w.addStack();
    const tm = s.addText((e.time || (e.end ? '기간' : '일정')) + '  ');
    tm.font = Font.boldSystemFont(size - 1); tm.textColor = C.fg;
    const n = s.addText(e.title || ''); n.font = Font.systemFont(size - 1); n.textColor = C.muted; n.lineLimit = 1;
    w.addSpacer(2); room--;
  });
  if (!td.length) { note(w, ev.length ? '할 일은 없어요' : '오늘은 일정도 할 일도 없어요'); return; }
  addTodos(w, doc, td, Math.max(2, room), C.fg, C.muted, size);
}

function drawSlots(w, doc, fam) {
  const { td } = dayData(doc, today());
  header(w, TITLES.slots, dayLabel());
  const wide = fam === 'medium' || fam === 'extraLarge';
  const max = { small: 1, medium: 4, large: 3, extraLarge: 9 }[fam] || 3;
  const size = fam === 'small' ? 11 : 12;
  const box = wide ? w.addStack() : w;
  SLOTS.forEach(([k, name], i) => {
    const list = td.filter(t => t.slot === k);
    if (wide && i) box.addSpacer(10);
    const col = wide ? box.addStack() : w.addStack();
    col.layoutVertically();
    note(col, `${name}  ${openCount(list)}`, C.muted, 11);
    col.addSpacer(2);
    if (!list.length) note(col, '—', C.muted, size);
    else addTodos(col, doc, list, max, C.fg, C.muted, size);
    if (!wide) w.addSpacer(5);
  });
  const rest = td.filter(t => !t.slot && !t.done);
  if (rest.length && fam !== 'small') { w.addSpacer(4); note(w, `시간 미정 ${rest.length}개`, C.muted, 11); }
}

function drawMatrix(w, doc, fam) {
  const { td } = dayData(doc, today());
  const wq = (doc.settings && doc.settings.wq) || {};
  header(w, TITLES.matrix, dayLabel());
  const max = { small: 0, medium: 1, large: 4, extraLarge: 5 }[fam];
  const size = 11;
  [[0, 1], [2, 3]].forEach((pair, r) => {
    const row = w.addStack();
    pair.forEach((qi, j) => {
      const [k, name] = QUADS[qi];
      const hex = wq[k];
      const cell = row.addStack();
      cell.layoutVertically();
      cell.backgroundColor = hex ? new Color(hex) : C.cell;
      cell.cornerRadius = 10;
      cell.setPadding(6, 8, 6, 8);
      const fg = hex ? textOn(hex) : C.fg;
      const muted = hex ? new Color(fg.hex, 0.72) : C.muted;
      const list = td.filter(t => t.quad === k);
      const h = cell.addStack();
      const tt = h.addText(fam === 'small' ? SHORT[k] : name); tt.font = Font.boldSystemFont(10); tt.textColor = muted; tt.lineLimit = 1;
      h.addSpacer();
      const cnt = h.addText(String(openCount(list))); cnt.font = Font.boldSystemFont(10); cnt.textColor = fg;
      if (max) { cell.addSpacer(2); if (!list.length) note(cell, '—', muted, size); else addTodos(cell, doc, list, max, fg, muted, size); }
      cell.addSpacer();
      if (!j) row.addSpacer(6);
    });
    if (!r) w.addSpacer(6);
  });
  const inbox = td.filter(t => !t.quad && !t.done).length;
  if (inbox && fam !== 'small') { w.addSpacer(4); note(w, `아직 분류 안 한 할 일 ${inbox}개`, C.muted, 10); }
}

async function buildWidget(kind, fam) {
  const w = new ListWidget();
  w.backgroundColor = C.bg;
  w.setPadding(12, 14, 12, 14);
  w.url = 'scriptable:///run/' + encodeURIComponent(Script.name()) + '?view=' + kind;
  w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
  const c = getCfg();
  if (!c) {
    header(w, 'dayflow', '');
    note(w, 'Scriptable 앱에서 이 스크립트를 한 번 실행해 연결해 주세요', C.muted, 12);
    return w;
  }
  try {
    const { doc, fresh } = await getDoc(c);
    if (kind === 'slots') drawSlots(w, doc, fam);
    else if (kind === 'matrix') drawMatrix(w, doc, fam);
    else drawToday(w, doc, fam);
    if (!fresh) { w.addSpacer(); note(w, '오프라인 · 마지막으로 받은 내용', C.muted, 9); }
  } catch (e) {
    header(w, TITLES[kind] || 'dayflow', dayLabel());
    note(w, e.message, C.muted, 11);
  }
  w.addSpacer();
  return w;
}

/* ---------- 체크 목록 (위젯을 누르면 열려요) ---------- */
async function checklist(c, kind) {
  let { doc } = await getDoc(c);
  const table = new UITable();
  table.showSeparators = true;
  const draw = () => {
    table.removeAllRows();
    const { ev, td } = dayData(doc, today());
    const top = new UITableRow(); top.isHeader = true; top.height = 56;
    const tc = top.addText(`${TITLES[kind] || TITLES.today}  ${dayLabel()}`, `완료 ${td.length - openCount(td)}/${td.length} · 누르면 체크돼요`);
    tc.titleFont = Font.boldSystemFont(18); tc.subtitleColor = Color.gray();
    table.addRow(top);
    ev.forEach(e => {
      const r = new UITableRow(); r.height = 40;
      const x = r.addText(`${e.time || (e.end ? '기간' : '일정')}  ${e.title}`); x.titleFont = Font.systemFont(15); x.titleColor = Color.gray();
      table.addRow(r);
    });
    const groups = kind === 'slots'
      ? SLOTS.map(([k, n]) => [n, td.filter(t => t.slot === k)]).concat([['시간 미정', td.filter(t => !t.slot)]])
      : kind === 'matrix'
        ? QUADS.map(([k, n]) => [n, td.filter(t => t.quad === k)]).concat([['분류 전', td.filter(t => !t.quad)]])
        : [[null, td]];
    groups.forEach(([name, list]) => {
      if (!list.length) return;
      if (name) {
        const h = new UITableRow(); h.height = 32; h.backgroundColor = Color.dynamic(new Color('#f3f4f6'), new Color('#24262b'));
        const ht = h.addText(`${name}  ${openCount(list)}`); ht.titleFont = Font.boldSystemFont(13); ht.titleColor = Color.gray();
        table.addRow(h);
      }
      openFirst(list).forEach(t => {
        const r = new UITableRow(); r.height = 52; r.dismissOnSelect = false;
        const sj = subjOf(doc, t);
        const mark = r.addText(t.done ? '✓' : '○'); mark.widthWeight = 8; mark.titleFont = Font.boldSystemFont(20);
        mark.titleColor = t.done ? Color.gray() : Color.dynamic(new Color('#1c1e22'), new Color('#e6e7ea'));
        const body = r.addText(t.title, sj ? sj.ab : (t.note || ''));
        body.widthWeight = 92; body.titleFont = Font.systemFont(16); body.subtitleFont = Font.systemFont(12);
        if (t.done) body.titleColor = Color.gray();
        if (sj) body.subtitleColor = new Color(sj.color);
        r.onSelect = async () => {
          const want = !t.done;
          t.done = want; draw(); table.reload();
          try { await setDone(c, t.id, want); doc = JSON.parse(fm.readString(CACHE)); }
          catch (e) { t.done = !want; draw(); table.reload(); await say('저장하지 못했어요', e.message); }
        };
        table.addRow(r);
      });
    });
    if (!td.length) { const r = new UITableRow(); r.addText('오늘은 할 일이 없어요').titleColor = Color.gray(); table.addRow(r); }
    const open = new UITableRow(); open.height = 48; open.dismissOnSelect = false;
    const ot = open.addText('dayflow 앱에서 열기 ↗'); ot.titleColor = Color.blue();
    open.onSelect = () => Safari.open(SITE + '?view=' + (APP_VIEW[kind] || 'calendar'));
    table.addRow(open);
  };
  draw();
  await table.present(false);
}

/* ---------- 시작 ---------- */
const PARAM = String(args.widgetParameter || (args.queryParameters && args.queryParameters.view) || 'today').trim().toLowerCase();
// 한글로 적어도 돼요: 매트릭스 · 오전/오후/저녁(밤) · 오늘
const KIND = FORCE ? FORCE : /matrix|매트릭스|사분면|^m$|^3$/.test(PARAM) ? 'matrix'
  : /slot|flow|오전|오후|저녁|밤|시간대|플로우|^s$|^2$/.test(PARAM) ? 'slots'
  : 'today';

if (config.runsInWidget) {
  Script.setWidget(await buildWidget(KIND, config.widgetFamily || 'medium'));
} else {
  let c = getCfg();
  if (!c) c = await setup();
  if (c) {
    if (args.queryParameters && args.queryParameters.view) {
      await checklist(c, KIND);
    } else if (FORCE) {
      const a = new Alert();
      a.title = 'dayflow · ' + TITLES[FORCE];
      a.addAction('체크 목록 열기');
      a.addAction('위젯 미리보기');
      a.addDestructiveAction('연결 다시 하기');
      a.addCancelAction('닫기');
      const i = await a.presentSheet();
      if (i === 0) await checklist(c, FORCE);
      else if (i === 1) { const w = await buildWidget(FORCE, FORCE === 'slots' ? 'medium' : 'large'); await (FORCE === 'slots' ? w.presentMedium() : w.presentLarge()); }
      else if (i === 2) { Keychain.remove(KC); await setup(); }
    } else {
      const a = new Alert();
      a.title = 'dayflow 위젯';
      a.addAction('오늘 할 일 체크');
      a.addAction('위젯 미리보기: 오늘 할 일');
      a.addAction('위젯 미리보기: 오전 · 오후 · 밤');
      a.addAction('위젯 미리보기: 매트릭스');
      a.addDestructiveAction('연결 다시 하기');
      a.addCancelAction('닫기');
      const i = await a.presentSheet();
      if (i === 0) await checklist(c, 'today');
      else if (i === 1) await (await buildWidget('today', 'large')).presentLarge();
      else if (i === 2) await (await buildWidget('slots', 'medium')).presentMedium();
      else if (i === 3) await (await buildWidget('matrix', 'large')).presentLarge();
      else if (i === 4) { Keychain.remove(KC); await setup(); }
    }
  }
}
Script.complete();
