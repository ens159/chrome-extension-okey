(() => {
const COLS = 16;                                                          // ıstaka: 2 satır × 16 hücre
const FLY = [[-40, 120], [0, 150], [210, 0], [0, -150]];                  // atılan taşın geldiği yön (animasyon)
const BOTS = [null, ['🦊', 'Tilki'], ['🦉', 'Baykuş'], ['🐻', 'Ayı']];           // sağ, üst, sol
let S = null, cur = null, timer = null, anim = null, drag = null, sel = null;   // cur: açık kayıt {id, name, created}; sel: tıklanarak seçilen taş
const $ = id => document.getElementById(id);
const prev = p => (p + 3) % 4, last = a => a[a.length - 1];

// ---- ıstaka hücreleri: her insan taşı bir hücre numarasına (t.s, 0..31) sahip ----
function freeSlot() { const u = new Set(S.hands[0].map(t => t.s)); for (let i = 0; i < COLS * 2; i++) if (!u.has(i)) return i; }
function slotFor(at) { return at != null && !S.hands[0].some(t => t.s === at) ? at : freeSlot(); }
function layout() { S.hands[0].forEach((t, i) => t.s = (i % 2) * COLS + (i >> 1)); }

async function newGame() {
  clearTimeout(timer); cur = null; sel = null;                            // eski oyunun bekleyen bot hamlesi/kaydı araya girmesin
  const deck = Okey.newDeck();
  const ind = deck.splice(deck.findIndex(t => !t.fake), 1)[0];            // gösterge sahte okey olamaz
  const okey = { c: ind.c, n: ind.n % 13 + 1 };
  const starter = Math.floor(Math.random() * 4);
  const hands = [0, 1, 2, 3].map(p => deck.splice(0, p === starter ? 15 : 14));
  const taken = (await Store.list()).map(sv => sv.name);
  S = { deck, hands, discards: [[], [], [], []], ind, okey, turn: starter, phase: 'discard', over: false, winner: null };
  cur = { id: Store.newId(), name: Store.randomName(taken), created: Date.now() };
  Store.setCurrent(cur.id); showTitle(); layout(); next();
}
function openSave(sv) {
  clearTimeout(timer); anim = null; sel = null;
  S = sv.state; cur = { id: sv.id, name: sv.name, created: sv.created };
  if (S.hands[0].some(t => t.s == null)) layout();
  Store.setCurrent(cur.id); showTitle(); next();
}
function save() { if (cur) Store.put({ ...cur, updated: Date.now(), state: S }); }
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
  return `<div class="t ${Okey.isOk(t, S.okey) ? 'ok' : ''} ${t.fake ? 'fake' : ''} ${cls}" ${k ? `draggable="true" data-k="${k}" data-id="${t.id}"` : ''} style="color:var(--c${f.c});${sty}">${t.fake ? '★' : t.n}<i></i></div>`;
}
function render() {
  const me = S.hands[0], mine = S.turn === 0 && !S.over;
  const canDraw = mine && S.phase === 'draw', canDisc = mine && S.phase === 'discard';
  const w = canDisc ? Okey.findWin(me, S.okey) : -1, wid = w >= 0 ? me[w].id : -1;
  for (const [id, p] of [['right', 1], ['top', 2], ['left', 3]]) {
    const thinking = S.turn === p && !S.over;
    $(id).innerHTML = `<div class="avatar">${BOTS[p][0]}</div><div class="plate"><b>${BOTS[p][1]}</b><small>${thinking ? 'düşünüyor…' : S.hands[p].length + ' taş'}</small></div>`;
    $(id).classList.toggle('turn', S.turn === p && !S.over);
  }
  const okeyTile = { id: -1, c: S.okey.c, n: S.okey.n, fake: false };
  $('center').innerHTML =
    `<div class="pile"><div class="stack">${S.deck.length ? `${S.deck.length > 2 ? '<div class="t back"></div><div class="t back"></div>' : ''}<div class="t back${canDraw ? ' glow' : ''}" id="deck"${canDraw ? ' draggable="true" data-k="deck" data-id="0"' : ''}></div><span class="count">${S.deck.length}</span>` : '<div class="dz"></div>'}</div><span class="label">Deste</span></div>` +
    `<div class="pile">${tileHTML(S.ind)}<span class="label">Gösterge</span></div>` +
    `<div class="okey-info">${tileHTML(okeyTile)}<span class="label" style="margin:0">Okey</span></div>`;
  for (let p = 0; p < 4; p++) {
    const d = last(S.discards[p]), can = canDraw && p === 3;
    $('d' + p).innerHTML = d ? tileHTML(d, can ? 'disc' : '', (can ? 'glow ' : '') + (anim === p ? 'fly' : ''), `--fx:${FLY[p][0]}px;--fy:${FLY[p][1]}px`) : '';
  }
  $('d0').classList.toggle('on', canDisc);
  let r = '';
  for (let row = 0; row < 2; row++) {
    r += '<div class="rr">';
    for (let c = 0; c < COLS; c++) { const s = row * COLS + c, t = me.find(x => x.s === s); r += `<div class="cell" data-s="${s}">${t ? tileHTML(t, 'rack', (t.id === wid ? 'win ' : '') + (t.id === sel ? 'sel' : '')) : ''}</div>`; }
    r += '</div>';
  }
  $('rack').innerHTML = r;
  const hint = S.over ? '' : canDraw ? 'Sıra sende: desteye ya da soldaki taşa tıkla' : canDisc ? (w >= 0 ? 'Parlayan taşı atarsan eli bitiriyorsun!' : 'Bir taş seç, sonra “At” alanına tıkla (ya da sürükle)')
    : `${BOTS[S.turn][1]} oynuyor…`;
  $('hint').innerHTML = hint ? `<span class="${mine ? 'go' : ''}">${hint}</span>` : '';
  $('result').hidden = !S.over;
  if (S.over) {
    $('res-title').textContent = S.winner === 0 ? '🎉 Kazandın!' : S.winner > 0 ? `${BOTS[S.winner][0]} ${BOTS[S.winner][1]} kazandı` : 'Berabere';
    $('res-sub').textContent = S.winner === -1 ? 'Deste bitti.' : S.winner === 0 ? 'Eli bitirdin.' : 'Bir dahaki sefere!';
  }
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
    if (discard(0, me.findIndex(x => x.id === id))) { sel = null; next(); }   // taşı kendi atma alanına bırak
  }
});
document.addEventListener('click', e => {
  if (!S || S.over) return;
  const tile = e.target.closest('#rack .t');
  if (tile) { sel = sel === +tile.dataset.id ? null : +tile.dataset.id; render(); return; }   // tek tık: taşı seç / bırak
  if (S.turn !== 0) return;
  if (S.phase === 'draw') {                                               // tek tık: çekme kısayolu
    if (e.target.closest('#deck')) { drawDeck(0); next(); }
    else if (e.target.closest('#d3 .t')) { takeDiscard(0); next(); }
  } else if (sel != null && e.target.closest('#d0')) {                    // seçili taşı at
    if (discard(0, S.hands[0].findIndex(t => t.id === sel))) { sel = null; next(); }
  }
});
document.addEventListener('dblclick', e => {                              // çift tık: taşı at
  const el = e.target.closest('#rack .t');
  if (el && S && !S.over && S.turn === 0 && S.phase === 'discard') { if (discard(0, S.hands[0].findIndex(t => t.id === +el.dataset.id))) { sel = null; next(); } }
});
// ---- oyun adı: tıklayınca düzenlenir ----
function showTitle() { $('title').textContent = cur.name; $('title').hidden = false; $('title-input').hidden = true; }
$('title').onclick = () => {
  const inp = $('title-input'); inp.value = cur.name;
  $('title').hidden = true; inp.hidden = false; inp.focus(); inp.select();
};
$('title-input').onkeydown = e => { if (e.key === 'Enter') e.target.blur(); else if (e.key === 'Escape') { e.target.value = cur.name; e.target.blur(); } };
$('title-input').onblur = e => { const v = e.target.value.trim(); if (v && v !== cur.name) { cur.name = v; save(); } showTitle(); };

$('again').onclick = newGame;
window.Game = { newGame, openSave, current: () => cur };                 // ayarlar paneli (settings.js) için
(async () => {                                                            // açılışta son oyuna kaldığı yerden devam
  await Store.migrate(Okey.validState);
  const id = await Store.currentId(), sv = id && await Store.load(id);
  if (sv && Okey.validState(sv.state)) openSave(sv); else newGame();
})();
})();
