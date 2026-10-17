// Renkler: 0 sarı, 1 mavi, 2 siyah, 3 kırmızı. Sayılar 1..13. 2 set + 2 sahte okey = 106 taş.
const Okey = (() => {
  function newDeck() {
    const d = []; let id = 0;
    for (let k = 0; k < 2; k++) for (let c = 0; c < 4; c++) for (let n = 1; n <= 13; n++) d.push({ id: id++, c, n, fake: false });
    d.push({ id: id++, c: 0, n: 1, fake: true }, { id: id++, c: 0, n: 1, fake: true });
    for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
    return d;
  }
  const isOk = (t, ok) => !t.fake && t.c === ok.c && t.n === ok.n;           // gerçek okey = joker
  const face = (t, ok) => (t.fake ? { c: ok.c, n: ok.n } : { c: t.c, n: t.n }); // sahte okey = okey'in yerine geçtiği taş

  function solve(cnt, j) {
    let pc = -1, pn = -1;
    outer: for (let c = 0; c < 4; c++) for (let n = 1; n <= 13; n++) if (cnt[c][n] > 0) { pc = c; pn = n; break outer; }
    if (pc < 0) return j === 0;
    cnt[pc][pn]--;
    let ok = false;
    // 1) Per: aynı sayı, farklı renkler (3 veya 4 taş)
    const others = [0, 1, 2, 3].filter(x => x !== pc);
    for (let m = 0; m < 8 && !ok; m++) {
      const sel = others.filter((_, i) => (m >> i) & 1);
      if (sel.length >= 2) ok = setRec(cnt, j, pn, sel, 0);
    }
    // 2) Seri: aynı renk, ardışık, en az 3. 1 taşı 13'ten sonra gelebilir (12-13-1) ama 13-1-2 olmaz.
    if (!ok) ok = runRec(cnt, j, pc, pn + 1, 1, Math.min(14, pn + 12));
    // 3) Pivot 1 ise serinin sonu olabilir: ... 12-13-1
    if (!ok && pn === 1) for (let s = 12; s >= 2 && !ok; s--) ok = endRec(cnt, j, pc, s);
    cnt[pc][pn]++;
    return ok;
  }
  function setRec(cnt, j, n, sel, i) {
    if (i === sel.length) return solve(cnt, j);
    const c = sel[i];
    if (cnt[c][n] > 0) { cnt[c][n]--; const r = setRec(cnt, j, n, sel, i + 1); cnt[c][n]++; if (r) return true; }
    return j > 0 && setRec(cnt, j - 1, n, sel, i + 1);
  }
  function runRec(cnt, j, c, pos, len, maxPos) {
    if (len >= 3 && solve(cnt, j)) return true;
    if (pos > maxPos) return false;
    const n = pos > 13 ? 1 : pos;
    if (cnt[c][n] > 0) { cnt[c][n]--; const r = runRec(cnt, j, c, pos + 1, len + 1, maxPos); cnt[c][n]++; if (r) return true; }
    return j > 0 && runRec(cnt, j - 1, c, pos + 1, len + 1, maxPos);
  }
  function endRec(cnt, j, c, pos) {
    if (pos > 13) return solve(cnt, j);
    if (cnt[c][pos] > 0) { cnt[c][pos]--; const r = endRec(cnt, j, c, pos + 1); cnt[c][pos]++; if (r) return true; }
    return j > 0 && endRec(cnt, j - 1, c, pos + 1);
  }
  // 14 taş bitiyor mu? (seri/per ile ya da 7 çift ile)
  function canWin(tiles, ok) {
    if (tiles.length !== 14) return false;
    const cnt = [0, 1, 2, 3].map(() => Array(15).fill(0)); let j = 0;
    for (const t of tiles) { if (isOk(t, ok)) j++; else { const f = face(t, ok); cnt[f.c][f.n]++; } }
    let s = 0; for (let c = 0; c < 4; c++) for (let n = 1; n <= 13; n++) s += cnt[c][n] % 2;
    if (s <= j && (j - s) % 2 === 0) return true; // çift ile bitme
    return solve(cnt, j);
  }
  // 15 taşlı elde, atınca el biten taşın indeksi (yoksa -1)
  function findWin(hand, ok) {
    for (let i = 0; i < hand.length; i++) if (canWin(hand.filter((_, k) => k !== i), ok)) return i;
    return -1;
  }
  // Bot sezgisi: taşın eldeki diğer taşlarla bağlantı puanı
  function score(t, hand, ok) {
    if (isOk(t, ok)) return 100;
    const f = face(t, ok); let s = 0;
    for (const u of hand) {
      if (u.id === t.id || isOk(u, ok)) continue;
      const g = face(u, ok);
      if (g.c === f.c) { let d = Math.abs(g.n - f.n); if (d === 12) d = 1; s += d === 1 ? 3 : d === 2 ? 2 : d === 0 ? 0.5 : 0; }
      else if (g.n === f.n) s += 2;
    }
    return s;
  }
  // Kayıttan yüklenen oyun durumu tutarlı mı? (106 taş, doğru el boyutları, geçerli sıra/aşama)
  function validState(S) {
    try {
      const arr = Array.isArray;
      if (!S || !arr(S.deck) || !arr(S.hands) || S.hands.length !== 4 || !arr(S.discards) || S.discards.length !== 4) return false;
      if (![0, 1, 2, 3].includes(S.turn) || !['draw', 'discard'].includes(S.phase) || !S.okey || !S.ind) return false;
      if (!S.hands.every(arr) || !S.discards.every(arr)) return false;
      const all = [S.ind, ...S.deck, ...S.hands.flat(), ...S.discards.flat()];
      if (all.length !== 106 || new Set(all.map(t => t && t.id)).size !== 106) return false;
      if (!all.every(t => t.c >= 0 && t.c <= 3 && t.n >= 1 && t.n <= 13)) return false;
      return S.hands.every((h, p) => h.length === (p === S.turn && S.phase === 'discard' && !S.over ? 15 : 14));
    } catch (e) { return false; }
  }
  return { newDeck, isOk, face, canWin, findWin, score, validState };
})();
if (typeof module !== 'undefined') module.exports = Okey;
