(() => {
const COLS = 17;                                                          // ıstaka: 2 satır × 17 hücre (bir satır hiç dolmaz: en çok 15 taş)
const FLY = [[-40, 120], [0, 150], [210, 0], [0, -150]];                  // atılan taşın geldiği yön (animasyon)
const FIN = [[0, 200], [200, 0], [0, -170], [-200, 0]];                   // bitiren taşın ortaya geldiği yön (0: sen, 1: sağ, 2: üst, 3: sol)
const LEVEL_NAMES = { easy: 'Kolay', normal: 'Orta', hard: 'Zor' };
const BOTS = [null, 'Kemal', 'Nermin', 'Rıza'];                            // sağ, üst, sol
const WIN = new URLSearchParams(location.search).has('win');              // ayrı pencerede mi açıldık?
let zoom = 1;                                                             // pencere modunda masanın ölçeği
let S = null, cur = null, timer = null, anim = null, drag = null, sel = null, animFin = false, hintHTML = '', hintTmr = null;   // cur: açık kayıt {id, name, created}; sel: tıklanarak seçilen taş
const $ = id => document.getElementById(id);
const prev = p => (p + 3) % 4, last = a => a[a.length - 1];

// ---- ıstaka: sabit yuva yok. Her insan taşının satırı (t.r: 0|1) ve satırdaki yeri (t.x: 0..COLS-1, taş genişliği
// biriminde, kesirli olabilir) var. İki taş üst üste binemez: bırakılan taş komşularını yana iter.
const SNAP = 0.35;                                                        // komşuya bu kadar yakın bırakılırsa bitişik yapış
const rowOf = r => S.hands[0].filter(t => t.r === r);
// t'yi (r, x) noktasına koyunca satırdaki taşların yeni yerleri: Map(taş -> x). Durumu değiştirmez.
function resolveRow(t, r, x) {
  x = Math.max(0, Math.min(COLS - 1, x));
  const others = rowOf(r).filter(o => o !== t);
  const near = (o, side) => side < 0 ? x - o.x - 1 : o.x - x - 1;
  for (const o of others) { if (near(o, -1) > 0 && near(o, -1) < SNAP) x = o.x + 1; else if (near(o, 1) > 0 && near(o, 1) < SNAP) x = o.x - 1; }
  const L = others.filter(o => o.x < x).sort((a, b) => b.x - a.x);
  const R = others.filter(o => o.x >= x).sort((a, b) => a.x - b.x);
  const pos = new Map([[t, x]]);
  let lim = x; for (const o of R) { lim = Math.max(o.x, lim + 1); pos.set(o, lim); }   // sağdakileri it
  lim = x; for (const o of L) { lim = Math.min(o.x, lim - 1); pos.set(o, lim); }       // soldakileri it
  const all = [...pos.keys()].sort((a, b) => pos.get(a) - pos.get(b));
  lim = COLS - 1; for (let i = all.length - 1; i >= 0; i--) { const v = Math.min(pos.get(all[i]), lim); pos.set(all[i], v); lim = v - 1; }   // taşan kenarları geri sıkıştır
  lim = 0; for (const o of all) { const v = Math.max(pos.get(o), lim); pos.set(o, v); lim = v + 1; }
  return pos;
}
function place(t, r, x) { for (const [o, v] of resolveRow(t, r, x)) { o.x = v; o.r = r; } }
// Hedef verilmezse ilk boş yere (önce üst satır) koy
function placeFree(t) {
  for (let r = 0; r < 2; r++) for (let x = 0; x < COLS; x++) if (!rowOf(r).some(o => o !== t && Math.abs(o.x - x) < 1)) return place(t, r, x);
  place(t, 1, COLS - 1);
}
function layout() { S.hands[0].forEach((t, i) => { t.r = i % 2; t.x = i >> 1; }); }
// Seri Diz / Çift Diz: grupları aralarında bir boşlukla soldan sağa yerleştir, sığmayan alt satıra geçer
function arrangeRack(mode) {
  const groups = Okey.arrange(S.hands[0], S.okey, mode), rest = groups.pop();
  const place = []; let row = 0, col = 0;
  for (const g of groups) {
    if (col + g.length > COLS) { row++; col = 0; }
    g.forEach(t => place.push([t, row, col++])); col++;
  }
  if (row === 0 && groups.length && rest && rest.length <= COLS) { row = 1; col = 0; }   // kalanlar alt sıraya
  for (const t of rest || []) { if (col >= COLS) { row++; col = 0; } place.push([t, row, col++]); }
  if (row > 1) return layout();                                           // sığmazsa (pratikte olmaz) düz diz
  for (const [t, r, x] of place) { t.r = r; t.x = x; }
}

// Her yeni oyunda bot zorluğunu sor. cancelable=false: vazgeçilemez (ilk açılış, açık oyun silindi)
function askLevel(cancelable) {
  const pre = (S && S.level) || 'normal';
  document.querySelectorAll('[data-level]').forEach(b => b.classList.toggle('sel', b.dataset.level === pre));
  $('level-cancel').hidden = !cancelable;
  $('level-pick').hidden = false;
  return new Promise(res => {
    const done = v => { $('level-pick').hidden = true; document.removeEventListener('keydown', esc, true); res(v); };
    const esc = e => { if (e.key === 'Escape' && cancelable) { e.stopPropagation(); done(null); } };
    document.addEventListener('keydown', esc, true);
    document.querySelectorAll('[data-level]').forEach(b => b.onclick = () => done(b.dataset.level));
    $('level-cancel').onclick = () => done(null);
  });
}
function stop() { clearTimeout(timer); cur = null; }                      // açık oyunu bırak (silinmeden önce)
async function newGame(cancelable = true) {
  const level = await askLevel(cancelable && !!cur);
  if (!level) return false;
  clearTimeout(timer); cur = null; sel = null;                            // eski oyunun bekleyen bot hamlesi/kaydı araya girmesin
  const deck = Okey.newDeck();
  const ind = deck.splice(deck.findIndex(t => !t.fake), 1)[0];            // gösterge sahte okey olamaz
  const okey = { c: ind.c, n: ind.n % 13 + 1 };
  const starter = Math.floor(Math.random() * 4);
  const hands = [0, 1, 2, 3].map(p => deck.splice(0, p === starter ? 15 : 14));
  const taken = (await Store.list()).map(sv => sv.name);
  S = { deck, hands, discards: [[], [], [], []], ind, okey, turn: starter, phase: 'discard', over: false, winner: null, level };
  cur = { id: Store.newId(), name: Store.randomName(taken), created: Date.now() };
  Store.setCurrent(cur.id); showTitle(); layout(); next();
  return true;
}
function openSave(sv) {
  clearTimeout(timer); anim = null; sel = null;
  S = sv.state; cur = { id: sv.id, name: sv.name, created: sv.created };
  S.level = S.level || 'normal';                                          // zorluk eklenmeden önceki kayıtlar
  if (S.hands[0].some(t => t.x == null)) {                                // eski kayıt: 2×16 sabit hücre (t.s) düzeni
    if (S.hands[0].some(t => t.s == null)) layout();
    else S.hands[0].forEach(t => { t.r = t.s >= 16 ? 1 : 0; t.x = t.s % 16; delete t.s; });
  }
  Store.setCurrent(cur.id); showTitle(); next();
}
function save() { return cur ? Store.put({ ...cur, updated: Date.now(), state: S }) : Promise.resolve(); }
function next() {
  clearTimeout(timer); render(); anim = null; animFin = false; save();
  if (!S.over && S.turn !== 0) timer = setTimeout(botPlay, 1000);
}
function refresh() { render(); save(); }                                  // bot zamanlayıcısına dokunmadan çiz + kaydet
// at: {r, x} ıstakada bırakılan yer (yoksa ilk boş yer)
function toRack(t, at) { S.hands[0].push(t); if (at) place(t, at.r, at.x); else placeFree(t); }
function drawDeck(p, at) { const t = S.deck.pop(); if (p === 0) toRack(t, at); else S.hands[p].push(t); S.phase = 'discard'; }
function takeDiscard(p, at) { const t = S.discards[prev(p)].pop(); if (p === 0) toRack(t, at); else S.hands[p].push(t); S.phase = 'discard'; }
function discard(p, i) {
  if (i < 0 || i >= S.hands[p].length) return false;                     // splice(-1) son taşı atardı
  const t = S.hands[p].splice(i, 1)[0];
  S.discards[p].push(t); anim = p;
  S.turn = (p + 1) % 4; S.phase = 'draw';
  // Deste bittiyse sıradaki oyuncu son atılan taşı yalnızca onunla bitirebiliyorsa alabilir; yoksa el berabere.
  if (!S.deck.length && Okey.findWin(S.hands[S.turn].concat(t), S.okey) < 0) { S.over = true; S.winner = -1; }
  return true;
}
// Eli bitir: kalan son taşı ortaya at. Oyun yalnızca bu hamleyle biter; atma alanına atmak asla bitirmez.
function finish(p, i) {
  if (i < 0 || i >= S.hands[p].length) return false;
  S.center = [S.hands[p].splice(i, 1)[0]]; animFin = true;
  S.over = true; S.winner = p; return true;
}
// Istakadaki taşları gruplara böl: aynı satırda birbirine değen (aralarında taş sığacak boşluk olmayan) taşlar bir grup
function rackGroups(tiles) {
  const g = []; let grp = null, pt = null;
  for (const t of [...tiles].sort((a, b) => a.r - b.r || a.x - b.x)) {
    if (grp && t.r === pt.r && t.x - pt.x < 1.5) grp.push(t); else g.push(grp = [t]);
    pt = t;
  }
  return g;
}
function flash(msg) {
  $('hint').innerHTML = `<span class="go">${msg}</span>`;
  clearTimeout(hintTmr); hintTmr = setTimeout(() => { $('hint').innerHTML = hintHTML; }, 2600);
}
function humanFinish(idx) {
  if (idx < 0 || !S || S.over || S.turn !== 0 || S.phase !== 'discard') return false;
  const t = S.hands[0][idx];
  if (!Okey.rackWins(rackGroups(S.hands[0].filter(x => x !== t)), S.okey)) { flash('Eller per/seri ya da çift olarak dizili değil'); return false; }
  sel = null; finish(0, idx); next();
  if (typeof Sound !== 'undefined') Sound.playDiscard();
  return true;
}
function animateTileIn(drawnId, fromRect) {
  if (!fromRect) return;
  const el = document.querySelector(`#rack .t[data-id="${drawnId}"]`);
  if (!el) return;
  const toRect = el.getBoundingClientRect();
  const dx = (fromRect.left - toRect.left) / zoom, dy = (fromRect.top - toRect.top) / zoom;
  el.style.transform = `translate(${dx}px, ${dy}px) scale(0.92)`;
  el.style.transition = 'none';
  el.style.zIndex = '10';
  requestAnimationFrame(() => {
    el.getBoundingClientRect();
    el.style.transition = 'transform .26s cubic-bezier(.2, .8, .2, 1)';
    el.style.transform = '';
    setTimeout(() => { el.style.transition = ''; el.style.zIndex = ''; }, 280);
  });
}
function humanDrawDeck(at, dropped) {
  const src = $('deck') || $('center');
  const fromRect = src ? src.getBoundingClientRect() : null;
  drawDeck(0, at);
  const drawn = last(S.hands[0]);
  next();
  if (drawn && fromRect && !dropped) animateTileIn(drawn.id, fromRect);
  if (typeof Sound !== 'undefined') Sound.playDraw();
}
function humanTakeDiscard(at, dropped) {
  const src = document.querySelector('#d3 .t') || $('d3');
  const fromRect = src ? src.getBoundingClientRect() : null;
  takeDiscard(0, at);
  const drawn = last(S.hands[0]);
  next();
  if (drawn && fromRect && !dropped) animateTileIn(drawn.id, fromRect);
  if (typeof Sound !== 'undefined') Sound.playDraw();
}
function humanDiscard(idx) {
  if (idx < 0 || !S || S.turn !== 0 || S.phase !== 'discard') return false;
  const tileObj = S.hands[0][idx];
  const tileEl = tileObj ? document.querySelector(`#rack .t[data-id="${tileObj.id}"]`) : null;
  const fromRect = tileEl ? tileEl.getBoundingClientRect() : null;
  sel = null;
  if (!discard(0, idx)) return false;
  next();
  if (fromRect) {
    const toEl = document.querySelector('#d0 .t');
    if (toEl) {
      const toRect = toEl.getBoundingClientRect();
      const dx = (fromRect.left - toRect.left) / zoom, dy = (fromRect.top - toRect.top) / zoom;
      toEl.style.transform = `translate(${dx}px, ${dy}px) scale(0.95)`;
      toEl.style.transition = 'none';
      requestAnimationFrame(() => {
        toEl.getBoundingClientRect();
        toEl.style.transition = 'transform .25s cubic-bezier(.2, .8, .2, 1)';
        toEl.style.transform = '';
        setTimeout(() => { toEl.style.transition = ''; }, 270);
      });
    }
  }
  if (typeof Sound !== 'undefined') Sound.playDiscard();
  return true;
}
function botPlay() {
  const p = S.turn, h = S.hands[p], lv = S.level || 'normal';
  if (S.phase === 'draw') {
    const d = last(S.discards[prev(p)]);
    if (d && (!S.deck.length || Okey.botTake(h, d, S.okey, lv))) takeDiscard(p); else drawDeck(p);
  }
  const i = Okey.botDiscard(h, S.okey, lv);
  if (Okey.canWin(h.filter((_, k) => k !== i), S.okey)) finish(p, i); else discard(p, i);   // bot eli bitirince son taşı ortaya atar
  if (typeof Sound !== 'undefined') Sound.playDiscard();
  next();
}

// ---- çizim ----
function tileHTML(t, k, cls = '', sty = '') {
  const f = Okey.face(t, S.okey);
  return `<div class="t ${Okey.isOk(t, S.okey) ? 'ok' : ''} ${t.fake ? 'fake' : ''} ${cls}" ${k ? `data-k="${k}" data-id="${t.id}"` : ''} style="color:var(--c${f.c});${sty}">${t.fake ? '<span class="fk">★</span>' : t.n}<i></i></div>`;
}
function render() {
  const me = S.hands[0], mine = S.turn === 0 && !S.over;
  const canDraw = mine && S.phase === 'draw', canDisc = mine && S.phase === 'discard';
  const w = canDisc ? Okey.findWin(me, S.okey) : -1, wid = w >= 0 ? me[w].id : -1;
  for (const [id, p] of [['right', 1], ['top', 2], ['left', 3]]) {
    const thinking = S.turn === p && !S.over;
    $(id).innerHTML = `<div class="avatar a${p}">${BOTS[p][0]}</div><div class="plate"><b>${BOTS[p]}</b><small>${thinking ? '<span class="dots">düşünüyor</span>' : S.hands[p].length + ' taş'}</small></div>`;
    $(id).classList.toggle('turn', S.turn === p && !S.over);
  }
  const okeyTile = { id: -1, c: S.okey.c, n: S.okey.n, fake: false };
  const fin = S.center && S.center[0];
  $('center').innerHTML =
    `<div class="pile"><div class="stack">${S.deck.length ? `${S.deck.length > 2 ? '<div class="t back"></div><div class="t back"></div>' : ''}<div class="t back${canDraw ? ' glow' : ''}" id="deck"${canDraw ? ' data-k="deck" data-id="0"' : ''}></div><span class="count">${S.deck.length}</span>` : '<div class="dz"></div>'}</div><span class="label">Deste</span></div>` +
    `<div class="pile">${tileHTML(S.ind)}<span class="label">Gösterge</span></div>` +
    `<div class="okey-info">${tileHTML(okeyTile)}<span class="label" style="margin:0">Okey</span></div>` +
    (fin ? `<div class="pile">${tileHTML(fin, '', animFin ? 'fly' : '', `--fx:${FIN[S.winner][0]}px;--fy:${FIN[S.winner][1]}px`)}<span class="label">Bitiş</span></div>` : '');
  for (let p = 0; p < 4; p++) {
    const d = last(S.discards[p]), can = canDraw && p === 3;
    $('d' + p).innerHTML = d ? tileHTML(d, can ? 'disc' : '', (can ? 'glow ' : '') + (anim === p ? 'fly' : ''), `--fx:${FLY[p][0]}px;--fy:${FLY[p][1]}px`) : '';
  }
  $('d0').classList.toggle('on', canDisc);
  let r = '';
  for (let row = 0; row < 2; row++) {
    r += `<div class="rr" data-r="${row}">`;
    for (const t of me.filter(x => x.r === row)) r += tileHTML(t, 'rack', (t.id === wid ? 'win ' : '') + (t.id === sel ? 'sel' : ''), `left:calc(var(--cw) * ${+t.x.toFixed(3)})`);
    r += '</div>';
  }
  $('rack').innerHTML = r;
  if (drag && drag.live) {                                                // sürüklerken bot oynayıp masa yeniden çizildiyse
    const el = document.querySelector(`[data-k="${drag.k}"][data-id="${drag.id}"]`);
    if (el) { el.classList.add('lifted'); drag.el = el; }
    if (drag.at) preview(drag.k === 'rack' ? me.find(x => x.id === drag.id) : null, drag.at);
  }
  const hint = S.over ? '' : canDraw ? 'Sıra sende: desteden çek ya da soldaki taşı al' : canDisc ? (w >= 0 ? 'Elin bitiyor! Grupları diz, parlayan taşı ortaya sürükle' : 'Taşı sağ alta at; eli bitirmek için son taşı ortaya sürükle')
    : `${BOTS[S.turn]} oynuyor`;
  hintHTML = hint ? `<span class="${mine ? 'go' : ''}">${hint}</span>` : '';
  $('hint').innerHTML = hintHTML;
  $('result').hidden = !S.over;
  if (S.over) {
    $('res-title').textContent = S.winner === 0 ? 'Kazandın!' : S.winner > 0 ? `${BOTS[S.winner]} kazandı` : 'Berabere';
    $('res-sub').textContent = S.winner === -1 ? 'Deste bitti.' : fin && Okey.isOk(fin, S.okey) ? 'Okey atarak bitti!' : S.winner === 0 ? 'Eli bitirdin.' : 'Bir dahaki sefere!';
  }
}

// ---- sürükle-bırak: sol tıkla tutulan taş imleçle birlikte gider, ıstakadaki taşlar canlı olarak yer açar ----
let justDragged = false;
function rackTarget(e, grabX) {                                           // imleç ıstakanın neresinde? {r, x} ya da null
  const rk = $('rack').getBoundingClientRect(), pad = 24;
  if (e.clientX < rk.left - pad || e.clientX > rk.right + pad || e.clientY < rk.top - pad * 2 || e.clientY > rk.bottom + pad) return null;
  const rows = [...document.querySelectorAll('#rack .rr')].map(el => el.getBoundingClientRect());
  const r = Math.abs(e.clientY - (rows[0].top + rows[0].bottom) / 2) <= Math.abs(e.clientY - (rows[1].top + rows[1].bottom) / 2) ? 0 : 1;
  const unit = rows[r].width / COLS;
  return { r, x: Math.round(((e.clientX - grabX - rows[r].left) / unit) * 20) / 20 };
}
const NEW = { id: -1 };                                                   // desteden / yerden gelen, henüz elde olmayan taş
const atX = x => `calc(var(--cw) * ${+x.toFixed(3)})`;
function preview(t, at) {                                                 // bırakılınca olacak düzeni göster (durumu değiştirmeden)
  const pos = at ? resolveRow(t || NEW, at.r, at.x) : new Map();
  for (const o of S.hands[0]) {
    if (o === t) continue;
    const el = document.querySelector(`#rack .t[data-id="${o.id}"]`);
    if (el) el.style.left = atX(pos.has(o) ? pos.get(o) : o.x);
  }
}
document.addEventListener('pointerdown', e => {
  if (e.button !== 0 || !S || S.over) return;
  const el = e.target.closest('[data-k]'); if (!el) return;
  const k = el.dataset.k, id = +el.dataset.id;
  const rect = el.getBoundingClientRect();
  drag = { k, id, el, sx: e.clientX, sy: e.clientY, gx: e.clientX - rect.left, gy: e.clientY - rect.top, w: rect.width, live: false, float: null };
  e.preventDefault();
});
document.addEventListener('pointermove', e => {
  if (!drag) return;
  if (!drag.live) {
    if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 4) return;   // küçük titreme tıklama sayılsın
    drag.live = true;
    const f = drag.el.cloneNode(true);
    f.removeAttribute('id'); f.classList.remove('sel', 'glow'); f.classList.add('floating');
    f.style.setProperty('--tw', '34px'); f.style.setProperty('--th', '47px'); f.style.setProperty('--r', '5px');
    if (drag.k !== 'rack') { const k = 34 * zoom / drag.w; drag.gx *= k; drag.gy *= k; }   // masadaki taş ıstaka boyuna küçülür
    document.body.appendChild(f); drag.float = f;
    drag.el.classList.add('lifted');                                      // asıl taş yerinde görünmesin
    document.documentElement.classList.add('dragging');
  }
  drag.float.style.left = `${e.clientX / zoom - drag.gx / zoom}px`;
  drag.float.style.top = `${e.clientY / zoom - drag.gy / zoom}px`;
  const me = S.hands[0], mine = S.turn === 0;
  const canIn = drag.k === 'rack' || (mine && S.phase === 'draw');
  drag.at = canIn ? rackTarget(e, drag.gx) : null;
  drag.toDisc = drag.k === 'rack' && mine && S.phase === 'discard' && !!document.elementsFromPoint(e.clientX, e.clientY).find(x => x.id === 'd0');
  drag.toFin = drag.k === 'rack' && mine && S.phase === 'discard' && !drag.toDisc && !drag.at && !!document.elementsFromPoint(e.clientX, e.clientY).find(x => x.id === 'center');
  $('d0').classList.toggle('hot', drag.toDisc);
  $('center').classList.toggle('hot', drag.toFin);
  preview(drag.k === 'rack' ? me.find(x => x.id === drag.id) : null, drag.at);
});
function endDrag(e, cancel) {
  const d = drag; drag = null;
  if (!d || !d.live) return;
  justDragged = true; setTimeout(() => { justDragged = false; }, 0);
  document.documentElement.classList.remove('dragging'); $('d0').classList.remove('hot'); $('center').classList.remove('hot');
  const me = S.hands[0], mine = S.turn === 0;
  const valid = !cancel && !S.over && (d.toDisc || d.toFin || (d.at && (d.k === 'rack' || (mine && S.phase === 'draw'))));
  if (!valid) return flyBack(d);
  if (d.toFin) { if (!humanFinish(me.findIndex(x => x.id === d.id))) flyBack(d); else d.float.remove(); return; }   // dizilmemişse taş geri döner
  d.float.remove(); d.el.classList.remove('lifted');
  if (d.toDisc) { humanDiscard(me.findIndex(x => x.id === d.id)); return; }
  if (d.k === 'rack') {
    const t = me.find(x => x.id === d.id); if (!t) return render();
    sel = null; place(t, d.at.r, d.at.x); refresh();
    if (typeof Sound !== 'undefined') Sound.playClick();
  } else if (mine && S.phase === 'draw' && d.k === 'deck') humanDrawDeck(d.at, true);
  else if (mine && S.phase === 'draw' && d.k === 'disc') humanTakeDiscard(d.at, true);
  else render();
}
// Geçersiz yere bırakılan taş yumuşakça eski yerine döner
function flyBack(d) {
  if (S.hands[0].some(x => x.id === d.id)) preview(S.hands[0].find(x => x.id === d.id), null);   // kayan komşular geri gelsin
  const home = d.el.isConnected ? d.el : document.querySelector(`[data-k="${d.k}"][data-id="${d.id}"]`);
  const f = d.float, done = () => { if (!f.isConnected) return; f.remove(); if (home) home.classList.remove('lifted'); };
  if (!home || document.documentElement.dataset.gfx === 'low') return done();
  const r = home.getBoundingClientRect();
  f.style.setProperty('transition', 'left .24s cubic-bezier(.2, .8, .2, 1), top .24s cubic-bezier(.2, .8, .2, 1), transform .24s, width .24s, height .24s', 'important');
  f.style.left = `${r.left / zoom}px`; f.style.top = `${r.top / zoom}px`; f.style.transform = 'none';
  if (d.k !== 'rack') { f.style.width = `${r.width / zoom}px`; f.style.height = `${r.height / zoom}px`; }
  f.addEventListener('transitionend', done, { once: true });
  setTimeout(done, 300);
}
document.addEventListener('pointerup', e => endDrag(e, false));
document.addEventListener('pointercancel', e => endDrag(e, true));
addEventListener('blur', () => endDrag(null, true));
let multiId = null, clickHits = 0, clickTmr = null;
document.addEventListener('click', e => {
  if (!S || S.over || justDragged) return;
  const tile = e.target.closest('#rack .t');
  if (tile) {
    if (typeof Sound !== 'undefined') Sound.playClick();
    const id = +tile.dataset.id;
    if (multiId === id) { clickHits++; } else { multiId = id; clickHits = 1; }
    clearTimeout(clickTmr);
    clickTmr = setTimeout(() => { multiId = null; clickHits = 0; }, 500);

    // 3 ardışık tık: taşı at (çift tıklamada yanlışlıkla atılmayı önler)
    if (clickHits >= 3) {
      clearTimeout(clickTmr);
      multiId = null;
      clickHits = 0;
      if (S.turn === 0 && S.phase === 'discard') {
        const idx = S.hands[0].findIndex(t => t.id === id);
        if (humanDiscard(idx)) return;
      }
    }

    const prevSel = sel;
    if (clickHits === 1) {
      sel = sel === id ? null : id;
    } else {
      sel = id; // ardışık 2. tıkta seçili kalsın
    }
    if (prevSel !== sel) {
      if (prevSel != null) { const el = document.querySelector(`#rack .t[data-id="${prevSel}"]`); if (el) el.classList.remove('sel'); }
      if (sel != null) tile.classList.add('sel');
    }
    return;
  }
  if (S.turn !== 0) return;
  if (S.phase === 'draw') {                                               // tek tık: çekme kısayolu
    if (e.target.closest('#deck')) { humanDrawDeck(); }
    else if (e.target.closest('#d3 .t')) { humanTakeDiscard(); }
  } else if (sel != null && e.target.closest('#d0')) {                    // seçili taşı at
    humanDiscard(S.hands[0].findIndex(t => t.id === sel));
  }
});
// ---- oyun adı: tıklayınca düzenlenir ----
function showTitle() { $('level-chip').textContent = LEVEL_NAMES[S.level] || ''; $('title').textContent = cur.name; $('title').hidden = false; $('title-input').hidden = true; }
$('title').onclick = () => {
  const inp = $('title-input'); inp.value = cur.name;
  $('title').hidden = true; inp.hidden = false; inp.focus(); inp.select();
};
$('title-input').onkeydown = e => { if (e.key === 'Enter') e.target.blur(); else if (e.key === 'Escape') { e.target.value = cur.name; e.target.blur(); } };
$('title-input').onblur = e => { const v = e.target.value.trim(); if (v && v !== cur.name) { cur.name = v; save(); } showTitle(); };

$('again').onclick = () => newGame();
function smoothArrange(mode) {
  if (!S || S.over) return;
  sel = null;
  const first = new Map();
  document.querySelectorAll('#rack .t[data-id]').forEach(el => first.set(+el.dataset.id, el.getBoundingClientRect()));
  arrangeRack(mode);
  render();
  save();
  const moving = [];
  document.querySelectorAll('#rack .t[data-id]').forEach(el => {
    const p = first.get(+el.dataset.id);
    if (!p) return;
    const c = el.getBoundingClientRect(), dx = (p.left - c.left) / zoom, dy = (p.top - c.top) / zoom;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      el.style.transition = 'none';
      el.style.zIndex = '5';
      moving.push(el);
    }
  });
  if (moving.length) {
    requestAnimationFrame(() => {
      moving[0].getBoundingClientRect();
      for (const el of moving) {
        el.style.transition = 'transform .22s cubic-bezier(.2, .8, .2, 1)';
        el.style.transform = '';
        const done = () => { el.style.transition = ''; el.style.transform = ''; el.style.zIndex = ''; };
        el.addEventListener('transitionend', done, { once: true });
        setTimeout(done, 260);
      }
    });
  }
}
document.querySelectorAll('[data-arrange]').forEach(b => b.onclick = () => smoothArrange(b.dataset.arrange));
window.Game = { newGame, openSave, stop, current: () => cur, LEVEL_NAMES };                 // ayarlar paneli (settings.js) için
function updateSoundIcons() {
  if (typeof Sound === 'undefined') return;
  const muted = Sound.isMuted();
  const on = $('snd-on'), off = $('snd-off');
  if (on) {
    on.hidden = muted;
    on.style.display = muted ? 'none' : 'block';
  }
  if (off) {
    off.hidden = !muted;
    off.style.display = muted ? 'block' : 'none';
  }
  if ($('sound-btn')) $('sound-btn').title = muted ? 'Sesi Aç' : 'Sesi Kapat';
}
if ($('sound-btn')) {
  $('sound-btn').onclick = () => {
    if (typeof Sound !== 'undefined') {
      Sound.toggleMute();
      updateSoundIcons();
    }
  };
}
if (typeof Sound !== 'undefined') {
  Sound.init();
  updateSoundIcons();
}
// ---- ayrı pencere: başka işle uğraşırken oyun yanda açık kalabilsin ----
async function gameWindow() {                                             // açık oyun penceresinin id'si (yoksa null)
  if (!chrome.runtime || !chrome.runtime.getContexts) return null;
  const ctx = await chrome.runtime.getContexts({ contextTypes: ['TAB'] });
  const c = ctx.find(x => x.documentUrl && new URL(x.documentUrl).searchParams.has('win'));
  return c ? c.windowId : null;
}
async function popOut() {
  clearTimeout(timer); await save();                                      // pencere kaldığı yerden devam etsin
  const id = await gameWindow();
  if (id != null) await chrome.windows.update(id, { focused: true });
  else await chrome.windows.create({ url: chrome.runtime.getURL('game.html?win=1'), type: 'popup', width: 800, height: 660, focused: true });
  window.close();
}
function fit() {                                                          // masayı pencereye sığdır
  zoom = Math.min(innerWidth / 760, innerHeight / 590);
  document.body.style.zoom = zoom;
}
if (WIN) { document.documentElement.classList.add('win'); fit(); addEventListener('resize', fit); }
if ($('window-btn')) {
  if (WIN || typeof chrome === 'undefined' || !chrome.windows) $('window-btn').hidden = true;
  else $('window-btn').onclick = () => popOut().catch(() => {});
}
(async () => {                                                            // açılışta son oyuna kaldığı yerden devam
  if (!WIN && typeof chrome !== 'undefined' && chrome.windows) {          // oyun zaten pencerede açıksa ona geç
    const id = await gameWindow().catch(() => null);
    if (id != null) { chrome.windows.update(id, { focused: true }); window.close(); return; }
  }
  await Store.migrate(Okey.validState);
  const id = await Store.currentId(), sv = id && await Store.load(id);
  if (sv && Okey.validState(sv.state)) openSave(sv); else newGame(false);
})();
})();
