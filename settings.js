// Ayarlar paneli: tema, grafik kalitesi, yeni oyun, kayıtlı oyunları yükle / sil.
(() => {
const $ = id => document.getElementById(id);
const DEF = { theme: 'classic', gfx: 'good' };
let settings = { ...DEF };
try { Object.assign(settings, JSON.parse(localStorage.getItem('okey.settings'))); } catch (e) {}   // ilk boyamada titreme olmasın
apply();
Store.get('settings').then(r => { if (r.settings) { settings = { ...DEF, ...r.settings }; apply(); } });

function apply() {
  document.documentElement.dataset.theme = settings.theme;
  document.documentElement.dataset.gfx = settings.gfx;
  document.querySelectorAll('.seg button').forEach(b => b.classList.toggle('sel', settings[b.parentElement.dataset.key] === b.dataset.v));
}
function setOpt(key, v) {
  settings[key] = v; apply();
  Store.set({ settings });
  try { localStorage.setItem('okey.settings', JSON.stringify(settings)); } catch (e) {}
}

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const when = ts => new Date(ts).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const level = st => (Game.LEVEL_NAMES[st.level || 'normal'] || '') + ' · ';
const status = st => !st.over ? 'Devam ediyor' : st.winner === 0 ? 'Kazandın' : st.winner > 0 ? `Bot ${st.winner} kazandı` : 'Berabere';

async function renderSaves() {
  const saves = await Store.list(), curId = Game.current() && Game.current().id;
  const active = saves.filter(sv => !(sv.state && sv.state.over));
  const played = saves.filter(sv => sv.state && sv.state.over);
  const savesContainer = $('saves');
if (savesContainer) {
  savesContainer.innerHTML = active.length ? active.map(sv => `
    <li class="save${sv.id === curId ? ' cur' : ''}" data-id="${esc(sv.id)}">
      <div class="info"><b>${esc(sv.name)}</b><small>${sv.id === curId ? '<span class="tag">Açık</span> ' : ''}${level(sv.state)}${status(sv.state)} · ${when(sv.updated)}</small></div>
      <button class="btn small" data-act="load"${sv.id === curId ? ' disabled' : ''}>Yükle</button>
      <button class="btn small danger" data-act="del" title="Kaydı sil">Sil</button>
    </li>`).join('') : '<li class="empty">Kayıtlı oyun yok.</li>';
}
  const playedContainer = $('played');
if (playedContainer) {
  playedContainer.innerHTML = played.length ? played.map(sv => `
    <li class="save" data-id="${esc(sv.id)}">
      <div class="info"><b>${esc(sv.name)}</b><small>${level(sv.state)}${status(sv.state)} · ${when(sv.updated)}</small></div>
    </li>`).join('') : '<li class="empty">Oynanan oyun yok.</li>';
}
}

function open() { renderSaves(); $('settings').hidden = false; requestAnimationFrame(() => $('settings').classList.add('open')); }
function close() { $('settings').classList.remove('open'); setTimeout(() => { if (!$('settings').classList.contains('open')) $('settings').hidden = true; }, 220); }

$('gear').onclick = open;
$('close-settings').onclick = close;
$('settings').addEventListener('click', e => { if (e.target.id === 'settings') close(); });   // panel dışına tıkla
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('settings').hidden) close(); });
document.querySelectorAll('.seg').forEach(seg => seg.addEventListener('click', e => {
  const b = e.target.closest('button'); if (b) setOpt(seg.dataset.key, b.dataset.v);
}));
$('new-game').onclick = async () => { if (await Game.newGame()) close(); };
$('saves').addEventListener('click', async e => {
  const b = e.target.closest('button[data-act]'); if (!b) return;
  const id = b.closest('.save').dataset.id;
  if (b.dataset.act === 'load') {
    const sv = await Store.load(id);
    if (sv && Okey.validState(sv.state)) { Game.openSave(sv); close(); }
    else { b.textContent = 'Bozuk'; b.disabled = true; }
  } else if (b.dataset.act === 'del') {
    if (!b.classList.contains('confirm')) { b.classList.add('confirm'); b.textContent = 'Emin misin?'; return; }   // ikinci tık siler
    const wasOpen = Game.current() && Game.current().id === id;
    if (wasOpen) Game.stop();                                              // bekleyen bot hamlesi silinen kaydı geri yazmasın
    await Store.remove(id);
    if (wasOpen) { close(); await Game.newGame(false); }                   // açık oyun silindiyse yenisini başlat
    renderSaves();
  }
});
})();
