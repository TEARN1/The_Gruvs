const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PUBLIC_VIDEOS = path.join(__dirname, '..', 'public', 'videos');
const ARTIFACT_DIR = path.join('C:\\Users\\ACER\\.gemini\\antigravity\\brain\\16cfe07f-63ac-441d-9bd8-e54e184c6d89', 'advertising');
const ART_ROOT = 'C:\\Users\\ACER\\.gemini\\antigravity\\brain\\16cfe07f-63ac-441d-9bd8-e54e184c6d89';

if (!fs.existsSync(PUBLIC_VIDEOS)) fs.mkdirSync(PUBLIC_VIDEOS, { recursive: true });
if (!fs.existsSync(ARTIFACT_DIR)) fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

// Read assets as base64
const logoB64 = `data:image/png;base64,${fs.readFileSync(path.join(__dirname, '..', 'assets', 'icon-512.png')).toString('base64')}`;
const s1B64 = `data:image/png;base64,${fs.readFileSync(path.join(__dirname, '..', 'public', 'images', 'advertising', '01-the-gruvs-mobile-discover.png')).toString('base64')}`;
const s2B64 = `data:image/png;base64,${fs.readFileSync(path.join(__dirname, '..', 'public', 'images', 'advertising', '02-the-gruvs-mobile-lineup-events.png')).toString('base64')}`;
const s3B64 = `data:image/png;base64,${fs.readFileSync(path.join(__dirname, '..', 'public', 'images', 'advertising', '03-the-gruvs-mobile-map-radar.png')).toString('base64')}`;

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>The Gruvs — Official 30s Global Launch Intro</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 720px;
    height: 1280px;
    background: #05070a;
    color: #ffffff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    position: relative;
    overflow: hidden;
    user-select: none;
  }

  /* Canvas Stage */
  #stage {
    width: 720px;
    height: 1280px;
    position: relative;
    overflow: hidden;
    background: radial-gradient(circle at 50% 30%, #0d131f 0%, #05070a 70%);
  }

  /* Background Glow Layers */
  .glow-cyan {
    position: absolute;
    width: 600px;
    height: 600px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(0,242,255,0.25) 0%, rgba(0,0,0,0) 70%);
    top: -150px;
    left: -150px;
    transition: all 1s ease;
  }
  .glow-magenta {
    position: absolute;
    width: 550px;
    height: 550px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255,42,109,0.22) 0%, rgba(0,0,0,0) 70%);
    bottom: -100px;
    right: -100px;
    transition: all 1s ease;
  }
  .glow-gold {
    position: absolute;
    width: 500px;
    height: 500px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255,184,0,0.20) 0%, rgba(0,0,0,0) 70%);
    top: 400px;
    left: 100px;
    transition: all 1s ease;
  }

  /* Grid lines */
  .grid-fx {
    position: absolute;
    inset: 0;
    background-image: 
      linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
    background-size: 40px 40px;
    mask-image: radial-gradient(circle at 50% 50%, black, transparent 80%);
  }

  /* Top Timer Bar */
  .timer-bar-wrap {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 6px;
    background: rgba(255,255,255,0.1);
    z-index: 100;
  }
  #timer-fill {
    width: 0%;
    height: 100%;
    background: linear-gradient(90deg, #00f2ff, #ff2a6d, #ffb800);
    box-shadow: 0 0 12px #00f2ff;
    transition: width 0.1s linear;
  }

  /* Timecode display */
  .timecode {
    position: absolute;
    top: 24px;
    right: 32px;
    font-family: monospace;
    font-size: 15px;
    font-weight: 800;
    color: rgba(255,255,255,0.6);
    background: rgba(0,0,0,0.6);
    padding: 6px 14px;
    border-radius: 20px;
    border: 1px solid rgba(255,255,255,0.1);
    z-index: 100;
  }

  /* Scene Container */
  .scene {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 40px;
    opacity: 0;
    transform: scale(0.95);
    transition: opacity 0.6s ease, transform 0.6s ease;
    pointer-events: none;
    z-index: 10;
  }
  .scene.active {
    opacity: 1;
    transform: scale(1);
    pointer-events: auto;
  }

  /* SCENE 1 STYLES */
  .s1-bubble {
    background: rgba(255,255,255,0.08);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255,255,255,0.15);
    padding: 16px 28px;
    border-radius: 30px;
    font-size: 20px;
    font-weight: 700;
    color: #ff2a6d;
    margin-bottom: 30px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    animation: pulse 1.5s infinite;
  }
  .s1-title {
    font-size: 52px;
    font-weight: 950;
    text-align: center;
    line-height: 1.1;
    text-transform: uppercase;
    letter-spacing: -1px;
    margin-bottom: 24px;
  }
  .s1-title span {
    color: #00f2ff;
    text-shadow: 0 0 30px rgba(0,242,255,0.5);
  }
  .s1-searchbar {
    width: 90%;
    background: rgba(18,24,36,0.85);
    border: 2px solid rgba(0,242,255,0.4);
    border-radius: 20px;
    padding: 20px 24px;
    display: flex;
    align-items: center;
    gap: 16px;
    font-size: 20px;
    color: #fff;
    box-shadow: 0 15px 40px rgba(0,0,0,0.7);
  }

  /* SCENE 2 STYLES */
  .s2-crest {
    width: 140px;
    height: 140px;
    border-radius: 36px;
    background: #090e16;
    border: 3px solid #ffb800;
    box-shadow: 0 0 50px rgba(255,184,0,0.5), 0 15px 40px rgba(0,0,0,0.8);
    overflow: hidden;
    margin-bottom: 26px;
    animation: float 2.5s ease-in-out infinite;
  }
  .s2-crest img { width: 100%; height: 100%; object-fit: cover; }
  .s2-title {
    font-size: 64px;
    font-weight: 950;
    letter-spacing: 2px;
    text-transform: uppercase;
    text-align: center;
    line-height: 1;
    margin-bottom: 12px;
    background: linear-gradient(135deg, #ffffff 30%, #ffb800 70%, #00f2ff 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .s2-sub {
    font-size: 22px;
    font-weight: 800;
    color: #00f2ff;
    letter-spacing: 3px;
    text-transform: uppercase;
    text-align: center;
    margin-bottom: 20px;
    text-shadow: 0 0 20px rgba(0,242,255,0.4);
  }
  .s2-tag {
    font-size: 18px;
    color: rgba(255,255,255,0.85);
    text-align: center;
    max-width: 550px;
    line-height: 1.4;
  }

  /* SCENE 3 STYLES */
  .s3-phone {
    width: 320px;
    height: 560px;
    border-radius: 44px;
    background: #07090e;
    border: 6px solid #253342;
    box-shadow: 0 30px 80px rgba(0,0,0,0.9), 0 0 50px rgba(0,242,255,0.35);
    overflow: hidden;
    margin-bottom: 30px;
    transform: rotate(-3deg);
  }
  .s3-phone img { width: 100%; height: 100%; object-fit: cover; }
  .s3-badges {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 12px;
    max-width: 620px;
  }
  .s3-pill {
    background: rgba(14,20,30,0.8);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(0,242,255,0.3);
    padding: 10px 20px;
    border-radius: 20px;
    font-size: 15px;
    font-weight: 800;
    color: #fff;
  }

  /* SCENE 4 STYLES */
  .s4-phone {
    width: 320px;
    height: 560px;
    border-radius: 44px;
    background: #07090e;
    border: 6px solid #253342;
    box-shadow: 0 30px 80px rgba(0,0,0,0.9), 0 0 50px rgba(0,255,136,0.3);
    overflow: hidden;
    margin-bottom: 30px;
    transform: rotate(3deg);
  }
  .s4-phone img { width: 100%; height: 100%; object-fit: cover; }

  /* SCENE 5 STYLES */
  .s5-logo {
    width: 120px;
    height: 120px;
    border-radius: 32px;
    background: #080c14;
    border: 3px solid #00f2ff;
    box-shadow: 0 0 45px rgba(0,242,255,0.5);
    overflow: hidden;
    margin-bottom: 24px;
  }
  .s5-logo img { width: 100%; height: 100%; object-fit: cover; }
  .s5-cta-btn {
    background: linear-gradient(135deg, #00f2ff 0%, #00b4ff 50%, #05ffa1 100%);
    color: #05080e;
    font-size: 28px;
    font-weight: 950;
    padding: 22px 55px;
    border-radius: 24px;
    text-transform: uppercase;
    box-shadow: 0 15px 45px rgba(0,242,255,0.5);
    margin: 28px 0 18px 0;
    letter-spacing: 1px;
    animation: pulse 1.8s infinite;
  }
  .s5-submeta {
    font-size: 17px;
    color: rgba(255,255,255,0.8);
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 16px;
  }

  @keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.04); }
    100% { transform: scale(1); }
  }
  @keyframes float {
    0% { transform: translateY(0px); }
    50% { transform: translateY(-12px); }
    100% { transform: translateY(0px); }
  }

  /* Bottom Controls (Interactive) */
  #controls {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 60px;
    background: rgba(5,7,10,0.85);
    backdrop-filter: blur(10px);
    border-top: 1px solid rgba(255,255,255,0.1);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24px;
    z-index: 100;
  }
  .ctrl-btn {
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.2);
    color: #fff;
    padding: 8px 18px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 800;
    cursor: pointer;
  }
  .ctrl-btn:hover { background: rgba(0,242,255,0.2); border-color: #00f2ff; }
</style>
</head>
<body>

<div id="stage">
  <div class="glow-cyan" id="bg-cyan"></div>
  <div class="glow-magenta" id="bg-magenta"></div>
  <div class="glow-gold" id="bg-gold"></div>
  <div class="grid-fx"></div>

  <!-- Top Timer -->
  <div class="timer-bar-wrap">
    <div id="timer-fill"></div>
  </div>
  <div class="timecode" id="timecode">00:00 / 00:30</div>

  <!-- SCENE 1: 00:00 - 00:06 (The Hook) -->
  <div class="scene active" id="scene-1">
    <div class="s1-bubble">❌ STOP ASKING ON WHATSAPP</div>
    <h1 class="s1-title">TIRED OF WONDERING<br><span>"WHERE'S THE VIBE?"</span></h1>
    <div class="s1-searchbar">
      <span>🔍</span>
      <span id="typewriter">Amapiano festivals near me tonight...</span>
    </div>
  </div>

  <!-- SCENE 2: 00:06 - 00:12 (The Reveal) -->
  <div class="scene" id="scene-2">
    <div class="s2-crest">
      <img src="${logoB64}" />
    </div>
    <h1 class="s2-title">THE GRUVS</h1>
    <div class="s2-sub">SOUTH AFRICA'S NIGHTLIFE HUB 🇿🇦</div>
    <p class="s2-tag">
      The ultimate digital pass to Mzansi's hottest festivals, secret rooftop parties, street food radars & verified safe night stays.
    </p>
  </div>

  <!-- SCENE 3: 00:12 - 00:18 (Festivals & Radar) -->
  <div class="scene" id="scene-3">
    <div class="s3-phone">
      <img src="${s1B64}" />
    </div>
    <div class="s3-badges">
      <div class="s3-pill" style="border-color: #00f2ff; color: #00f2ff;">🎪 500+ Top Festivals</div>
      <div class="s3-pill" style="border-color: #ffb800; color: #ffb800;">🗺️ Live Crowd Heatmaps</div>
      <div class="s3-pill" style="border-color: #ff2a6d; color: #ff2a6d;">🎟️ 0% Ticket Fees</div>
    </div>
  </div>

  <!-- SCENE 4: 00:18 - 00:24 (Street Food & Safe Stays) -->
  <div class="scene" id="scene-4">
    <div class="s4-phone">
      <img src="${s3B64 || s1B64}" />
    </div>
    <div class="s3-badges">
      <div class="s3-pill" style="border-color: #00ff88; color: #00ff88;">🍔 02:00 AM Kota Hub</div>
      <div class="s3-pill" style="border-color: #38bdf8; color: #38bdf8;">🛡️ Safe Resident Shuttles</div>
      <div class="s3-pill" style="border-color: #ffd600; color: #ffd600;">🏠 Matriarch Crash Pads</div>
    </div>
  </div>

  <!-- SCENE 5: 00:24 - 00:30 (Global Launch CTA) -->
  <div class="scene" id="scene-5">
    <div class="s5-logo">
      <img src="${logoB64}" />
    </div>
    <h1 style="font-size: 46px; font-weight: 950; text-transform: uppercase; text-align: center;">
      WHERE SOUTH AFRICA<br><span style="color: #00f2ff; text-shadow: 0 0 25px rgba(0,242,255,0.5);">VIBES.</span>
    </h1>
    <div class="s5-cta-btn">OPEN APP ➔ thegruvs.com</div>
    <div class="s5-submeta">
      <span>⚡ No Download Required</span>
      <span>•</span>
      <span>📱 Free on iOS & Android</span>
    </div>
  </div>

  <!-- Controls -->
  <div id="controls">
    <button class="ctrl-btn" id="btn-play-pause">▶ Play Video</button>
    <div style="font-size: 13px; color: rgba(255,255,255,0.6);">The Gruvs Global Launch (30s)</div>
    <button class="ctrl-btn" id="btn-restart">↺ Restart</button>
  </div>
</div>

<script>
  let isPlaying = false;
  let startTime = 0;
  let elapsed = 0;
  const DURATION = 30000; // 30 seconds

  const timerFill = document.getElementById('timer-fill');
  const timecode = document.getElementById('timecode');
  const btnPlay = document.getElementById('btn-play-pause');
  const btnRestart = document.getElementById('btn-restart');

  const scenes = [
    { start: 0, end: 6000, el: document.getElementById('scene-1') },
    { start: 6000, end: 12000, el: document.getElementById('scene-2') },
    { start: 12000, end: 18000, el: document.getElementById('scene-3') },
    { start: 18000, end: 24000, el: document.getElementById('scene-4') },
    { start: 24000, end: 30000, el: document.getElementById('scene-5') },
  ];

  // Web Audio Synthesizer for High-Energy Sound Effects
  let audioCtx = null;
  function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  function playTone(freq, type = 'sine', duration = 0.3, gainVal = 0.2) {
    if (!audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {}
  }

  function playAmapianoKick() {
    if (!audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.frequency.setValueAtTime(140, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(45, audioCtx.currentTime + 0.35);
      gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } catch (e) {}
  }

  let lastBeatSec = -1;
  function update(now) {
    if (!isPlaying) return;
    elapsed = now - startTime;
    if (elapsed >= DURATION) {
      elapsed = DURATION;
      isPlaying = false;
      btnPlay.textContent = '↺ Replay';
    }

    const pct = (elapsed / DURATION) * 100;
    timerFill.style.width = pct + '%';
    const s = Math.floor(elapsed / 1000);
    const ms = Math.floor((elapsed % 1000) / 100);
    timecode.textContent = '00:' + (s < 10 ? '0' + s : s) + ' / 00:30';

    // Rhythm sound ticks (Amapiano log drum kick every 2 seconds after s >= 6)
    if (s !== lastBeatSec) {
      lastBeatSec = s;
      if (s === 6) { playAmapianoKick(); playTone(880, 'triangle', 0.6, 0.3); }
      else if (s === 12) { playAmapianoKick(); playTone(659, 'sine', 0.5, 0.25); }
      else if (s === 18) { playAmapianoKick(); playTone(587, 'triangle', 0.5, 0.25); }
      else if (s === 24) { playAmapianoKick(); playTone(1046, 'sine', 0.8, 0.35); }
      else if (s > 6 && s % 2 === 0) { playAmapianoKick(); }
      else if (s < 6) { playTone(300 + s * 40, 'sine', 0.08, 0.08); }
    }

    // Active scene switching
    scenes.forEach(sc => {
      if (elapsed >= sc.start && elapsed < sc.end) {
        if (!sc.el.classList.contains('active')) {
          scenes.forEach(x => x.el.classList.remove('active'));
          sc.el.classList.add('active');
        }
      }
    });

    if (isPlaying) requestAnimationFrame(update);
  }

  function start() {
    initAudio();
    isPlaying = true;
    startTime = performance.now() - elapsed;
    btnPlay.textContent = '⏸ Pause';
    requestAnimationFrame(update);
  }

  function pause() {
    isPlaying = false;
    btnPlay.textContent = '▶ Play';
  }

  function restart() {
    elapsed = 0;
    scenes.forEach(x => x.el.classList.remove('active'));
    scenes[0].el.classList.add('active');
    timerFill.style.width = '0%';
    timecode.textContent = '00:00 / 00:30';
    start();
  }

  btnPlay.addEventListener('click', () => {
    if (isPlaying) pause();
    else {
      if (elapsed >= DURATION) restart();
      else start();
    }
  });
  btnRestart.addEventListener('click', restart);

  // Auto-start on load
  window.addEventListener('load', () => {
    setTimeout(start, 500);
  });
</script>
</body>
</html>`;

// Write HTML file to public/videos/ and artifact directory
const publicHtmlPath = path.join(PUBLIC_VIDEOS, 'the_gruvs_30s_intro.html');
const artHtmlPath = path.join(ART_ROOT, 'the_gruvs_30s_intro.html');
fs.writeFileSync(publicHtmlPath, htmlContent, 'utf8');
fs.writeFileSync(artHtmlPath, htmlContent, 'utf8');
console.log('✅ Generated HTML5 Video Player:', publicHtmlPath);

// Record Video with Playwright Chromium
async function recordVideo() {
  console.log('🎥 Launching Playwright to record 30-second video at 720x1280...');
  const tempDir = path.join(__dirname, '..', 'temp_rec');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    recordVideo: { dir: tempDir, size: { width: 720, height: 1280 } },
    viewport: { width: 720, height: 1280 }
  });

  const page = await context.newPage();
  await page.setContent(htmlContent, { waitUntil: 'load' });

  console.log('⏳ Recording 30-second live motion timeline (waiting 31s)...');
  await page.waitForTimeout(31000);

  await page.close();
  await context.close();
  await browser.close();

  const files = fs.readdirSync(tempDir).filter(f => f.endsWith('.webm'));
  if (files.length > 0) {
    const rawVideo = path.join(tempDir, files[0]);
    const pubVideoOut = path.join(PUBLIC_VIDEOS, 'the_gruvs_30s_intro.webm');
    const artVideoOut = path.join(ARTIFACT_DIR, 'the_gruvs_30s_intro.webm');

    fs.copyFileSync(rawVideo, pubVideoOut);
    fs.copyFileSync(rawVideo, artVideoOut);
    console.log('🎉 30s WebM Video successfully saved to:');
    console.log('   Public:', pubVideoOut);
    console.log('   Artifact:', artVideoOut);
  }

  // Cleanup temp
  fs.rmSync(tempDir, { recursive: true, force: true });
}

recordVideo().catch(err => {
  console.error('❌ Video recording failed:', err);
  process.exit(1);
});
