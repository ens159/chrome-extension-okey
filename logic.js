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
  // En çok taşı geçerli gruplara (seri/per) yerleştiren ayrım. Okey'ler 'J' ile gösterilir.
  // Döner: { cover: gruplardaki taş sayısı, melds: [[{c,n} | 'J', ...], ...] }
  function bestMelds(cnt, j, memo = new Map()) {
    let pc = -1, pn = -1;
    outer: for (let c = 0; c < 4; c++) for (let n = 1; n <= 13; n++) if (cnt[c][n] > 0) { pc = c; pn = n; break outer; }
    if (pc < 0) return { cover: 0, melds: [] };
    const key = cnt.map(r => r.join('')).join('|') + j;
    if (memo.has(key)) return memo.get(key);
    cnt[pc][pn]--;
    let best = bestMelds(cnt, j, memo);                                     // pivot taşı hiçbir gruba girmez
    const take = (meld, jl) => {
      const r = bestMelds(cnt, jl, memo);
      if (r.cover + meld.length > best.cover) best = { cover: r.cover + meld.length, melds: [meld.slice(), ...r.melds] };
    };
    // n. pozisyona gerçek taş ya da okey koyarak gruplar dene; done(meld, jl) her geçerli uzunlukta çağrılır
    const extend = (cells, i, meld, jl, done) => {
      if (i === cells.length) return;
      const [c, n] = cells[i];
      if (cnt[c][n] > 0) { cnt[c][n]--; meld.push({ c, n }); done(meld, jl, i + 1); extend(cells, i + 1, meld, jl, done); meld.pop(); cnt[c][n]++; }
      if (jl > 0) { meld.push('J'); done(meld, jl - 1, i + 1); extend(cells, i + 1, meld, jl - 1, done); meld.pop(); }
    };
    const pivot = { c: pc, n: pn };
    // per: pivot + diğer renklerden 2 ya da 3 taş
    const others = [0, 1, 2, 3].filter(x => x !== pc);
    for (let m = 0; m < 8; m++) {
      const sel = others.filter((_, i) => (m >> i) & 1);
      if (sel.length >= 2) extend(sel.map(c => [c, pn]), 0, [pivot], j, (meld, jl, k) => { if (k === sel.length) take(meld, jl); });
    }
    // seri: pivot'tan yukarı (13'ten sonra 1 gelebilir)
    const up = []; for (let p = pn + 1; p <= Math.min(14, pn + 12); p++) up.push([pc, p > 13 ? 1 : p]);
    extend(up, 0, [pivot], j, (meld, jl) => { if (meld.length >= 3) take(meld, jl); });
    // pivot 1 ise serinin sonu olabilir: s..13-1
    if (pn === 1) for (let st = 12; st >= 2; st--) {
      const cells = []; for (let p = st; p <= 13; p++) cells.push([pc, p]);
      extend(cells, 0, [], j, (meld, jl, k) => { if (k === cells.length) take([...meld, pivot], jl); });
    }
    cnt[pc][pn]++;
    memo.set(key, best);
    return best;
  }
  const counts = (tiles, ok) => {
    const cnt = [0, 1, 2, 3].map(() => Array(15).fill(0)); let j = 0;
    for (const t of tiles) { if (isOk(t, ok)) j++; else { const f = face(t, ok); cnt[f.c][f.n]++; } }
    return { cnt, j };
  };
  const byFace = ok => (a, b) => { const x = face(a, ok), y = face(b, ok); return x.c - y.c || x.n - y.n; };

  // Istakayı diz: 'run' = seri/per grupları, 'pair' = çiftler. Döner: taş grupları (son grup: kalanlar)
  function arrange(hand, ok, mode) {
    const jokers = hand.filter(t => isOk(t, ok)), pool = {};
    for (const t of hand) if (!isOk(t, ok)) { const f = face(t, ok); (pool[f.c + '-' + f.n] = pool[f.c + '-' + f.n] || []).push(t); }
    const groups = [];
    if (mode === 'pair') {
      for (const k of Object.keys(pool)) while (pool[k].length >= 2) groups.push(pool[k].splice(0, 2));
      groups.sort((a, b) => byFace(ok)(a[0], b[0]));
      if (jokers.length) groups.push(jokers.splice(0));
    } else {
      const { cnt, j } = counts(hand, ok);
      for (const m of bestMelds(cnt, j).melds) groups.push(m.map(x => (x === 'J' ? jokers.pop() : pool[x.c + '-' + x.n].pop())));
      groups.sort((a, b) => { const x = a.find(t => !isOk(t, ok)), y = b.find(t => !isOk(t, ok)); return x && y ? byFace(ok)(x, y) : 0; });
    }
    const rest = [...jokers, ...Object.values(pool).flat().sort(byFace(ok))];
    if (rest.length) groups.push(rest);
    return groups;
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
  // ---- bot zekası: 'easy' | 'normal' | 'hard' ----
  const LEVELS = ['easy', 'normal', 'hard'];
  // Zor bot için elin değeri: gruplara oturan taş sayısı (ya da çifte gidiyorsa çiftlerdeki taş sayısı)
  function handValue(tiles, ok) {
    const { cnt, j } = counts(tiles, ok);
    let pairs = 0, singles = 0;
    for (let c = 0; c < 4; c++) for (let n = 1; n <= 13; n++) { pairs += cnt[c][n] >> 1; singles += cnt[c][n] & 1; }
    const pairTiles = pairs >= 4 ? 2 * pairs + 2 * Math.min(j, singles) : 0;
    return Math.max(bestMelds(cnt, j).cover, pairTiles);
  }
  const without = (h, i) => h.filter((_, k) => k !== i);
  // En iyi atılacak taş (zor): eli en değerli bırakan; eşitlikte bağlantısı en zayıf olan
  function bestDiscard(h, ok) {
    let best = -1, bv = -1e9;
    h.forEach((t, i) => {
      if (isOk(t, ok)) return;
      const v = handValue(without(h, i), ok) - score(t, h, ok) * 0.05;
      if (v > bv) { bv = v; best = i; }
    });
    return { i: best < 0 ? 0 : best, v: bv };
  }
  // Çekme aşaması: soldan atılan taşı (d) alsın mı?
  function botTake(h, d, ok, level) {
    if (findWin(h.concat(d), ok) >= 0) return true;                        // bitiriyorsa her seviye alır
    if (level === 'easy') return false;
    if (level === 'hard') return bestDiscard(h.concat(d), ok).v >= handValue(h, ok) + 1;
    return score(d, h, ok) >= 5;
  }
  // Atma aşaması: atılacak taşın indeksi
  function botDiscard(h, ok, level) {
    const w = findWin(h, ok);
    if (w >= 0) return w;
    if (level === 'hard') return bestDiscard(h, ok).i;
    const cand = h.map((t, i) => i).filter(i => !isOk(h[i], ok));
    if (level === 'easy' && Math.random() < 0.5) return cand[Math.floor(Math.random() * cand.length)];
    let i = cand[0], best = 1e9;
    for (const k of cand) { const sc = score(h[k], h, ok); if (sc < best) { best = sc; i = k; } }
    return i;
  }

  // Kayıttan yüklenen oyun durumu tutarlı mı? (106 taş, doğru el boyutları, geçerli sıra/aşama)
  function validState(S) {
    try {
      const arr = Array.isArray;
      if (!S || !arr(S.deck) || !arr(S.hands) || S.hands.length !== 4 || !arr(S.discards) || S.discards.length !== 4) return false;
      if (S.level != null && !LEVELS.includes(S.level)) return false;
      if (![0, 1, 2, 3].includes(S.turn) || !['draw', 'discard'].includes(S.phase) || !S.okey || !S.ind) return false;
      if (!S.hands.every(arr) || !S.discards.every(arr)) return false;
      const all = [S.ind, ...S.deck, ...S.hands.flat(), ...S.discards.flat()];
      if (all.length !== 106 || new Set(all.map(t => t && t.id)).size !== 106) return false;
      if (!all.every(t => t.c >= 0 && t.c <= 3 && t.n >= 1 && t.n <= 13)) return false;
      return S.hands.every((h, p) => h.length === (p === S.turn && S.phase === 'discard' && !S.over ? 15 : 14));
    } catch (e) { return false; }
  }
  return { newDeck, isOk, face, canWin, findWin, score, validState, bestMelds, counts, arrange, LEVELS, botTake, botDiscard };
})();
if (typeof module !== 'undefined') module.exports = Okey;
