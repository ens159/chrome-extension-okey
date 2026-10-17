(() => {
const COL = ['#c89400', '#1e6fd9', '#111', '#d32f2f'], COLS = 16;       // ıstaka: 2 satır × 16 hücre
const FLY = [[-30, 90], [0, 130], [170, 0], [0, -130]];                   // atılan taşın geldiği yön (animasyon)
let S = null, timer = null, anim = null, drag = null;
const $ = id => document.getElementById(id);
const prev = p => (p + 3) % 4, last = a => a[a.length - 1];

// ---- ıstaka hücreleri: her insan taşı bir hücre numarasına (t.s, 0..31) sahip ----
function freeSlot() { const u = new Set(S.hands[0].map(t => t.s)); for (let i = 0; i < COLS * 2; i++) if (!u.has(i)) return i; }
function slotFor(at) { return at != null && !S.hands[0].some(t => t.s === at) ? at : freeSlot(); }
function layout() { S.hands[0].forEach((t, i) => t.s = (i % 2) * COLS + (i >> 1)); }

function newGame() {
  const deck = Okey.newDeck();
  const ind = deck.splice(deck.findIndex(t => !t.fake), 1)[0];            // gösterge sahte okey olamaz
  const okey = { c: ind.c, n: ind.n % 13 + 1 };
  const starter = Math.floor(Math.random() * 4);
  const hands = [0, 1, 2, 3].map(p => deck.splice(0, p === starter ? 15 : 14));
  S = { deck, hands, discards: [[], [], [], []], ind, okey, turn: starter, phase: 'discard', over: false, winner: null };
  layout(); next();
}
function save() { if (S.over) chrome.storage.local.remove('okey'); else chrome.storage.local.set({ okey: S }); }
function next() {
  clearTimeout(timer); render(); anim = null; save();
  if (!S.over && S.turn !== 0) timer = setTimeout(botPlay, 1000);
}
function refresh() { render(); save(); }                                  // bot zamanlayıcısına dokunmadan çiz + kaydet
function drawDeck(p, at) { const t = S.deck.pop(); if (p === 0) t.s = slotFor(at); S.hands[p].push(t); S.phase = 'discard'; }
function takeDiscard(p, at) { const t = S.discards[prev(p)].pop(); if (p === 0) t.s = slotFor(at); S.hands[p].push(t); S.phase = 'discard'; }
function discard(p, i) {
  if (i < 0 || i >= S.hands[p].length) return false;                     // splice(-1) son taşı atardı
  const t = S.hands[p].splice(i, 1)[0];
  S.discards[p].push(t); anim = p;
  if (Okey.canWin(S.hands[p], S.okey)) { S.over = true; S.winner = p; return true; }
  S.turn = (p + 1) % 4; S.phase = 'draw';
  // Deste bittiyse sıradaki oyuncu son atılan taşı yalnızca onunla bitirebiliyorsa alabilir; yoksa el berabere.
  if (!S.deck.length && Okey.findWin(S.hands[S.turn].concat(t), S.okey) < 0) { S.over = true; S.winner = -1; }
  return true;
}
function botPlay() {
  const p = S.turn, h = S.hands[p];
  if (S.phase === 'draw') {
    const d = last(S.discards[prev(p)]);
    if (d && (Okey.findWin(h.concat(d), S.okey) >= 0 || Okey.score(d, h, S.okey) >= 5)) takeDiscard(p); else drawDeck(p);
  }
  let i = Okey.findWin(h, S.okey);
  if (i < 0) { let best = 1e9; h.forEach((t, k) => { const s = Okey.score(t, h, S.okey); if (s < best) { best = s; i = k; } }); }
  discard(p, i); next();
}

// ---- çizim ----
function tileHTML(t, k, cls = '', sty = '') {
  const f = Okey.face(t, S.okey);
  return `<div class="t ${Okey.isOk(t, S.okey) ? 'ok' : ''} ${cls}" ${k ? `draggable="true" data-k="${k}" data-id="${t.id}"` : ''} style="color:${COL[f.c]};${sty}">${t.fake ? '★' : t.n}</div>`;
}
function render() {
  const me = S.hands[0], mine = S.turn === 0 && !S.over;
  const canDraw = mine && S.phase === 'draw', canDisc = mine && S.phase === 'discard';
  const w = canDisc ? Okey.findWin(me, S.okey) : -1, wid = w >= 0 ? me[w].id : -1;
  for (const [id, p] of [['right', 1], ['top', 2], ['left', 3]]) {
    $(id).innerHTML = '<div class="b"></div>'.repeat(S.hands[p].length);
    $(id).classList.toggle('turn', S.turn === p && !S.over);
  }
  $('center').innerHTML = tileHTML(S.ind) + (S.deck.length ? `<div class="t back${canDraw ? ' glow' : ''}" id="deck"${canDraw ? ' draggable="true" data-k="deck" data-id="0"' : ''}></div>` : '');
  for (let p = 0; p < 4; p++) {
    const d = last(S.discards[p]), can = canDraw && p === 3;
    $('d' + p).innerHTML = d ? tileHTML(d, can ? 'disc' : '', (can ? 'glow ' : '') + (anim === p ? 'fly' : ''), `--fx:${FLY[p][0]}px;--fy:${FLY[p][1]}px`) : '';
  }
  $('d0').classList.toggle('on', canDisc);
  let r = '';
  for (let row = 0; row < 2; row++) {
    r += '<div class="rr">';
    for (let c = 0; c < COLS; c++) { const s = row * COLS + c, t = me.find(x => x.s === s); r += `<div class="cell" data-s="${s}">${t ? tileHTML(t, 'rack', t.id === wid ? 'win' : '') : ''}</div>`; }
    r += '</div>';
  }
  $('rack').innerHTML = r;
  $('status').textContent = S.over ? (S.winner === 0 ? '🎉 Kazandın!' : S.winner > 0 ? 'Bot kazandı' : 'Berabere') : '';
}

// ---- sürükle-bırak ----
document.addEventListener('dragstart', e => {
  const el = e.target.closest('[data-k]'); if (!el) return;
  drag = { k: el.dataset.k, id: +el.dataset.id }; e.dataTransfer.setData('text/plain', 'x');
});
document.addEventListener('dragend', () => { drag = null; });            // ıstaka dışına bırakılırsa eski sürükleme kalmasın
document.addEventListener('dragover', e => { if (e.target.closest('.cell, #d0')) e.preventDefault(); });
document.addEventListener('drop', e => {
  if (!drag || !S || S.over) return;
  const { k, id } = drag; drag = null;
  const cell = e.target.closest('.cell'), me = S.hands[0], mine = S.turn === 0;
  if (cell) {
    const at = +cell.dataset.s;
    if (k === 'rack') {                                                   // ıstakada taş taşı / yer değiştir
      const t = me.find(x => x.id === id); if (!t) return;
      const o = me.find(x => x.s === at && x !== t);
      if (o) o.s = t.s; t.s = at; refresh();
    } else if (mine && S.phase === 'draw' && k === 'deck') { drawDeck(0, at); next(); }
    else if (mine && S.phase === 'draw' && k === 'disc') { takeDiscard(0, at); next(); }
  } else if (e.target.closest('#d0') && k === 'rack' && mine && S.phase === 'discard') {
    if (discard(0, me.findIndex(x => x.id === id))) next();               // taşı kendi atma alanına bırak
  }
});
document.addEventListener('click', e => {                                 // tek tık: çekme kısayolu
  if (!S || S.over || S.turn !== 0 || S.phase !== 'draw') return;
  if (e.target.closest('#deck')) { drawDeck(0); next(); }
  else if (e.target.closest('#d3 .t')) { takeDiscard(0); next(); }
});
document.addEventListener('dblclick', e => {                              // çift tık: taşı at
  const el = e.target.closest('#rack .t');
  if (el && S && !S.over && S.turn === 0 && S.phase === 'discard') { if (discard(0, S.hands[0].findIndex(t => t.id === +el.dataset.id))) next(); }
});
$('nw').onclick = newGame;
chrome.storage.local.get('okey', r => {
  if (r.okey && !r.okey.over && Okey.validState(r.okey)) { S = r.okey; if (S.hands[0].some(t => t.s == null)) layout(); next(); } else newGame();
});
})();
