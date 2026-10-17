// Kalıcı depolama: her oyun kaydı ayrı bir anahtarda ("save:<id>") tutulur.
// chrome.storage yoksa (ör. sayfayı doğrudan tarayıcıda açınca) localStorage'a düşer.
const Store = (() => {
  const PFX = 'save:';
  const area = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local ? chrome.storage.local : {
    get(k) {
      const keys = k == null ? Object.keys(localStorage) : [].concat(k), r = {};
      for (const x of keys) { const v = localStorage.getItem(x); if (v != null) r[x] = JSON.parse(v); }
      return Promise.resolve(r);
    },
    set(o) { for (const x in o) localStorage.setItem(x, JSON.stringify(o[x])); return Promise.resolve(); },
    remove(k) { for (const x of [].concat(k)) localStorage.removeItem(x); return Promise.resolve(); },
  };
  const get = async k => (await area.get(k)) || {};

  async function list() {
    const all = await get(null);
    return Object.keys(all).filter(k => k.startsWith(PFX)).map(k => all[k]).sort((a, b) => b.updated - a.updated);
  }
  const load = async id => (await get(PFX + id))[PFX + id] || null;
  const put = sv => area.set({ [PFX + sv.id]: sv });
  const remove = id => area.remove(PFX + id);
  const currentId = async () => (await get('current')).current || null;
  const setCurrent = id => (id ? area.set({ current: id }) : area.remove('current'));
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  const ADJ = ['Mavi', 'Kızıl', 'Sessiz', 'Cesur', 'Altın', 'Gece', 'Şanslı', 'Hızlı', 'Gizemli', 'Neşeli', 'Yıldızlı', 'Rüzgarlı', 'Gümüş', 'Yaban', 'Usta', 'Sakin'];
  const NOUN = ['Kartal', 'Çınar', 'Lale', 'Deniz', 'Kaplan', 'Ay', 'Yıldız', 'Nehir', 'Şimşek', 'Martı', 'Tilki', 'Dağ', 'Pusula', 'Fener', 'Kervan', 'Bulut'];
  function randomName(taken = []) {
    const pick = a => a[Math.floor(Math.random() * a.length)];
    for (let i = 0; i < 20; i++) { const n = `${pick(ADJ)} ${pick(NOUN)}`; if (!taken.includes(n)) return n; }
    let n = `${pick(ADJ)} ${pick(NOUN)}`, k = 2; while (taken.includes(`${n} ${k}`)) k++; return `${n} ${k}`;
  }

  // Eski sürüm tek kaydı "okey" anahtarında tutuyordu; onu yeni kayıt biçimine taşı.
  async function migrate(valid) {
    const { okey } = await get('okey');
    if (!okey) return;
    if (valid(okey)) {
      const id = newId(), now = Date.now();
      await put({ id, name: randomName(), created: now, updated: now, state: okey });
      await setCurrent(id);
    }
    await area.remove('okey');
  }

  return { list, load, put, remove, currentId, setCurrent, newId, randomName, migrate, get, set: o => area.set(o) };
})();
