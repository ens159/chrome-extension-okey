// Web Audio API - Hafif gerçekçi okey taşı sesleri & modern, dinlendirici lofi / ambient fon müziği
const Sound = (() => {
  let ctx = null;
  let masterGain = null;
  let musicGain = null;
  let isMuted = false;
  let isMusicPlaying = false;
  let musicTimer = null;
  let chordIndex = 0;

  // Modern, dinlendirici ambient piyano / Rhodes akorları (Retro olmayan, sıcak ve akıcı)
  // [Notaların Hz frekansları, Akor süresi saniye]
  const CHORDS = [
    // Dm9: D3, A3, C4, E4, F4
    [[146.83, 220.00, 261.63, 329.63, 349.23], 4.8],
    // Bbmaj7: Bb2, F3, A3, D4
    [[116.54, 174.61, 220.00, 293.66], 4.8],
    // Gm9: G2, D3, F3, A3, Bb3
    [[98.00, 146.83, 174.61, 220.00, 233.08], 4.8],
    // A7sus4 -> A: A2, E3, G3, D4
    [[110.00, 164.81, 196.00, 293.66], 4.8]
  ];

  function getCtx() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      ctx = new AudioCtx();

      masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(isMuted ? 0 : 1, ctx.currentTime);
      masterGain.connect(ctx.destination);

      musicGain = ctx.createGain();
      // Çok hafif, fısıltı seviyesinde arka plan fon sesi (0.024)
      musicGain.gain.setValueAtTime(0.024, ctx.currentTime);
      musicGain.connect(masterGain);
    }
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  // 1. Gerçek Melamin/Kemik Okey Taşı Sesi (Tok değil; çok hafif, ince ve doğal taş teması)
  function playClick() {
    const ac = getCtx();
    if (!ac || isMuted) return;

    const now = ac.currentTime;
    const pitchRnd = 0.96 + Math.random() * 0.08;

    // Yüksek frekanslı ince seramik/kemik çıtırtısı (1600Hz -> 750Hz, 20ms hızlı sönüm)
    const osc1 = ac.createOscillator();
    const gain1 = ac.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1650 * pitchRnd, now);
    osc1.frequency.exponentialRampToValueAtTime(680 * pitchRnd, now + 0.018);

    gain1.gain.setValueAtTime(0.07, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.022);

    // İkinci gövde tıkırtısı (orta frekans, bas thud kesinlikle yok)
    const osc2 = ac.createOscillator();
    const gain2 = ac.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(820 * pitchRnd, now);
    osc2.frequency.exponentialRampToValueAtTime(420 * pitchRnd, now + 0.016);

    gain2.gain.setValueAtTime(0.035, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

    // Boğuk ve tok bas frekansları kesen yüksek geçiren filtre (380Hz altı yok)
    const filter = ac.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(380, now);

    osc1.connect(gain1);
    osc2.connect(gain2);
    gain1.connect(filter);
    gain2.connect(filter);
    filter.connect(masterGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.025);
    osc2.stop(now + 0.025);
  }

  // 2. Taş Bırakma / Masaya Koyma Sesi (Hafif çuha ve taş sürtünme teması)
  function playDiscard() {
    const ac = getCtx();
    if (!ac || isMuted) return;

    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(980, now);
    osc.frequency.exponentialRampToValueAtTime(360, now + 0.025);

    gain.gain.setValueAtTime(0.065, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.028);

    const filter = ac.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(300, now);

    osc.connect(gain);
    gain.connect(filter);
    filter.connect(masterGain);

    osc.start(now);
    osc.stop(now + 0.03);
  }

  // 3. Taş Alma Sesi (Hafif çekme fısıltısı)
  function playDraw() {
    const ac = getCtx();
    if (!ac || isMuted) return;

    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(580, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.035);

    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.045);
  }

  // 4. Modern, Dinlendirici Sakin Ambient Müzik
  // (Sıcak Rhodes/Piyano tarzı harmonik filtreli yumuşak akorlar)
  function playNextAmbientChord() {
    if (!isMusicPlaying || isMuted) {
      isMusicPlaying = false;
      return;
    }
    const ac = getCtx();
    if (!ac) return;

    const [notes, dur] = CHORDS[chordIndex];
    chordIndex = (chordIndex + 1) % CHORDS.length;

    const now = ac.currentTime;

    // Akor içindeki her bir notayı yumuşak bir sıcaklıkla çal
    notes.forEach((freq, i) => {
      const osc = ac.createOscillator();
      const noteGain = ac.createGain();
      const filter = ac.createBiquadFilter();

      // Akustik Rhodes / Elektrik Piyano sıcaklığı (Sinüs + Yumuşak Lowpass)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      // Sıcak analog alçak geçiren filtre (retro 8-bit sesleri tamamen yok eder)
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(550, now);
      filter.Q.setValueAtTime(1.0, now);

      // Çok yumuşak giriş (Attack 0.35s) ve uzun ferah sönüm (Release)
      const noteOffset = now + i * 0.06; // Hafif kırık akor (arpej) hissi
      noteGain.gain.setValueAtTime(0.0001, noteOffset);
      noteGain.gain.linearRampToValueAtTime(0.32, noteOffset + 0.35);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, noteOffset + dur);

      osc.connect(filter);
      filter.connect(noteGain);
      noteGain.connect(musicGain);

      osc.start(noteOffset);
      osc.stop(noteOffset + dur + 0.1);
    });

    if (musicTimer) clearTimeout(musicTimer);
    musicTimer = setTimeout(() => {
      if (isMusicPlaying && !isMuted) {
        playNextAmbientChord();
      } else {
        isMusicPlaying = false;
      }
    }, (dur - 0.4) * 1000);
  }

  function startMusic() {
    if (isMuted) return;
    const ac = getCtx();
    if (!ac) return;
    if (ac.state === 'suspended') {
      ac.resume().catch(() => {});
    }
    stopMusic(); // Varsa önceki zamanlayıcıyı güvenle temizle
    isMusicPlaying = true;
    playNextAmbientChord();
  }

  function stopMusic() {
    isMusicPlaying = false;
    if (musicTimer) {
      clearTimeout(musicTimer);
      musicTimer = null;
    }
  }

  function toggleMute() {
    isMuted = !isMuted;
    try { localStorage.setItem('okey.sound_muted', isMuted ? '1' : '0'); } catch (e) {}
    
    const ac = getCtx();
    if (ac && masterGain) {
      if (ac.state === 'suspended' && !isMuted) {
        ac.resume().catch(() => {});
      }
      masterGain.gain.setValueAtTime(isMuted ? 0 : 1, ac.currentTime);
    }

    if (isMuted) {
      stopMusic();
    } else {
      startMusic();
    }

    return isMuted;
  }

  function init() {
    try {
      isMuted = localStorage.getItem('okey.sound_muted') === '1';
    } catch (e) {}

    const unlock = () => {
      const ac = getCtx();
      if (ac && ac.state === 'suspended') {
        ac.resume().catch(() => {});
      }
      if (!isMuted) {
        startMusic();
      }
      document.removeEventListener('click', unlock);
      document.removeEventListener('keydown', unlock);
    };
    document.addEventListener('click', unlock);
    document.addEventListener('keydown', unlock);
  }

  return {
    init,
    playClick,
    playDiscard,
    playDraw,
    startMusic,
    stopMusic,
    toggleMute,
    isMuted: () => isMuted
  };
})();
