const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PUBLIC_DIR = path.join(__dirname, '..', 'public', 'images', 'advertising');
const ARTIFACT_DIR = path.join('C:\\Users\\ACER\\.gemini\\antigravity\\brain\\16cfe07f-63ac-441d-9bd8-e54e184c6d89', 'advertising');

if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });
if (!fs.existsSync(ARTIFACT_DIR)) fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

// Load real logo and app screenshots
const logoB64 = `data:image/png;base64,${fs.readFileSync(path.join(__dirname, '..', 'assets', 'icon-512.png')).toString('base64')}`;
const s1B64 = `data:image/png;base64,${fs.readFileSync(path.join(PUBLIC_DIR, '01-the-gruvs-mobile-discover.png')).toString('base64')}`;
const s2B64 = `data:image/png;base64,${fs.readFileSync(path.join(PUBLIC_DIR, '02-the-gruvs-mobile-lineup-events.png')).toString('base64')}`;
const s3B64 = `data:image/png;base64,${fs.readFileSync(path.join(PUBLIC_DIR, '03-the-gruvs-mobile-map-radar.png')).toString('base64')}`;

// ─────────────────────────────────────────────────────────────────────────────
// FLYER 1: "CYBER ROYALE" EDITION (1080 x 1350 px, 4:5 Mobile Feed)
// Palette: Obsidian Black (#06080C), Cyber Cyan (#00F2FF), Royal Gold (#FFB800)
// ─────────────────────────────────────────────────────────────────────────────
const htmlFlyer1CyberRoyale = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1080px;
    height: 1350px;
    background: #06080c;
    color: #ffffff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 50px 60px 45px 60px;
  }
  
  .glow-cyan {
    position: absolute;
    width: 750px;
    height: 750px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(0,242,255,0.22) 0%, rgba(0,0,0,0) 70%);
    top: -160px;
    left: -160px;
    z-index: 1;
  }
  .glow-gold {
    position: absolute;
    width: 650px;
    height: 650px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255,184,0,0.18) 0%, rgba(0,0,0,0) 70%);
    bottom: -100px;
    right: -120px;
    z-index: 1;
  }
  .grid-overlay {
    position: absolute;
    inset: 0;
    background-image: 
      linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
    background-size: 40px 40px;
    z-index: 1;
    mask-image: radial-gradient(circle at 50% 50%, black, transparent 85%);
  }

  /* Header with Official Logo */
  .header {
    position: relative;
    z-index: 10;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  .brand-bar {
    display: flex;
    align-items: center;
    gap: 18px;
    margin-bottom: 18px;
  }
  .logo-box {
    width: 84px;
    height: 84px;
    border-radius: 22px;
    background: #0a0e14;
    border: 2px solid #00f2ff;
    box-shadow: 0 0 30px rgba(0,242,255,0.45), 0 8px 24px rgba(0,0,0,0.8);
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .logo-box img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .brand-text-wrap {
    text-align: left;
  }
  .brand-name {
    font-size: 38px;
    font-weight: 950;
    letter-spacing: 2px;
    text-transform: uppercase;
    background: linear-gradient(135deg, #ffffff 40%, #00f2ff 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    line-height: 1;
  }
  .brand-edition {
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 3px;
    color: #ffb800;
    text-transform: uppercase;
    margin-top: 5px;
  }
  .pill-badge {
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(0,242,255,0.3);
    padding: 8px 22px;
    border-radius: 30px;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 1.5px;
    color: #00f2ff;
    text-transform: uppercase;
    margin-bottom: 12px;
  }
  .headline {
    font-size: 64px;
    font-weight: 950;
    line-height: 1.05;
    letter-spacing: -1.5px;
    text-transform: uppercase;
    margin-bottom: 10px;
  }
  .headline span {
    color: #00f2ff;
    text-shadow: 0 0 35px rgba(0,242,255,0.45);
  }
  .tagline {
    font-size: 20px;
    font-weight: 600;
    color: rgba(255,255,255,0.8);
    max-width: 800px;
    line-height: 1.4;
  }
  .tagline em {
    font-style: normal;
    color: #ffb800;
    font-weight: 800;
  }

  /* Center Visual Showcase */
  .showcase {
    position: relative;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 520px;
    margin: 10px 0;
  }
  .feature-col {
    display: flex;
    flex-direction: column;
    gap: 18px;
    width: 270px;
  }
  .feature-col.left { text-align: right; }
  .feature-col.right { text-align: left; }
  .feature-card {
    background: rgba(14, 18, 27, 0.75);
    backdrop-filter: blur(14px);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 18px;
    padding: 16px 18px;
    box-shadow: 0 12px 30px rgba(0,0,0,0.6);
  }
  .feature-icon {
    font-size: 24px;
    margin-bottom: 4px;
    display: inline-block;
  }
  .feature-title {
    font-size: 16px;
    font-weight: 800;
    color: #fff;
    margin-bottom: 3px;
  }
  .feature-desc {
    font-size: 12px;
    color: rgba(255,255,255,0.65);
    line-height: 1.35;
  }

  /* Center Dual Phone Mockup */
  .phones-wrap {
    position: relative;
    width: 360px;
    height: 510px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .phone-main {
    position: absolute;
    width: 270px;
    height: 500px;
    border-radius: 40px;
    background: #07090d;
    border: 6px solid #283442;
    box-shadow: 0 25px 70px rgba(0,0,0,0.9), 0 0 45px rgba(0,242,255,0.3);
    overflow: hidden;
    z-index: 5;
    transform: translateY(-8px);
  }
  .phone-main img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .phone-back {
    position: absolute;
    width: 250px;
    height: 460px;
    border-radius: 36px;
    background: #07090d;
    border: 5px solid #1c2430;
    box-shadow: 0 15px 40px rgba(0,0,0,0.7);
    overflow: hidden;
    z-index: 3;
    left: -25px;
    top: 40px;
    transform: rotate(-10deg);
    opacity: 0.85;
  }
  .phone-back img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  /* Footer CTA */
  .footer {
    position: relative;
    z-index: 10;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 16px;
  }
  .btn-cta {
    background: linear-gradient(135deg, #00f2ff 0%, #00c4ff 45%, #05ffa1 100%);
    color: #06090e;
    font-size: 26px;
    font-weight: 950;
    padding: 20px 58px;
    border-radius: 20px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    box-shadow: 0 12px 35px rgba(0,242,255,0.45);
    display: inline-block;
  }
  .footer-meta {
    display: flex;
    align-items: center;
    gap: 20px;
    font-size: 15px;
    color: rgba(255,255,255,0.7);
    font-weight: 700;
  }
  .footer-submeta {
    font-size: 13px;
    color: rgba(255,255,255,0.45);
    font-weight: 600;
  }
</style>
</head>
<body>
  <div class="glow-cyan"></div>
  <div class="glow-gold"></div>
  <div class="grid-overlay"></div>

  <div class="header">
    <div class="brand-bar">
      <div class="logo-box">
        <img src="${logoB64}" />
      </div>
      <div class="brand-text-wrap">
        <div class="brand-name">THE GRUVS</div>
        <div class="brand-edition">★ SOUTH AFRICA'S NIGHTLIFE HUB ★</div>
      </div>
    </div>
    <div class="pill-badge">🇿🇦 JOBURG • SOWETO • PRETORIA • DURBAN • CAPE TOWN</div>
    <h1 class="headline">WHERE MZANSI <span>VIBES.</span></h1>
    <p class="tagline">
      Discover <em>500+ Amapiano Festivals</em>, Secret Rooftops, Late-Night Street Food & Real-Time Venue Radars!
    </p>
  </div>

  <div class="showcase">
    <div class="feature-col left">
      <div class="feature-card" style="border-right: 4px solid #00f2ff;">
        <span class="feature-icon">🎪</span>
        <div class="feature-title">Festivals & Gigs</div>
        <div class="feature-desc">Instant passes, DJ lineups & RSVP for the hottest parties.</div>
      </div>
      <div class="feature-card" style="border-right: 4px solid #ffb800;">
        <span class="feature-icon">🗺️</span>
        <div class="feature-title">Live Vibe Radar</div>
        <div class="feature-desc">Real-time crowd heatmaps before you pull up.</div>
      </div>
    </div>

    <div class="phones-wrap">
      <div class="phone-back">
        <img src="${s3B64}" />
      </div>
      <div class="phone-main">
        <img src="${s1B64}" />
      </div>
    </div>

    <div class="feature-col right">
      <div class="feature-card" style="border-left: 4px solid #05ffa1;">
        <span class="feature-icon">🍔</span>
        <div class="feature-title">Kota & Street Food</div>
        <div class="feature-desc">Vetted local kitchens in Ivory Park, Soweto & Tembisa.</div>
      </div>
      <div class="feature-card" style="border-left: 4px solid #ff2a6d;">
        <span class="feature-icon">🛡️</span>
        <div class="feature-title">Resident Safe Stays</div>
        <div class="feature-desc">Emergency patrol relay & anchor matriarch crash pads.</div>
      </div>
    </div>
  </div>

  <div class="footer">
    <div class="btn-cta">EXPLORE NOW ➔ thegruvs.com</div>
    <div class="footer-meta">
      <span>🌐 Instant Web App</span>
      <span>•</span>
      <span>📱 iOS & Android Ready</span>
      <span>•</span>
      <span>⚡ 100% Free To Join</span>
    </div>
    <div class="footer-submeta">
      Official The Gruvs App • Follow @TheGruvsSA on Facebook & Instagram
    </div>
  </div>
</body>
</html>`;

// ─────────────────────────────────────────────────────────────────────────────
// FLYER 2: "SUNSET AMAPIANO GLOW" EDITION (1080 x 1350 px, 4:5 Mobile Feed)
// Palette: Midnight Purple (#0B0716), Sunset Magenta (#FF2A6D), Neon Orange (#FF7A00)
// ─────────────────────────────────────────────────────────────────────────────
const htmlFlyer2SunsetGlow = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1080px;
    height: 1350px;
    background: radial-gradient(circle at 50% 25%, #180d2b 0%, #0b0716 65%, #05030a 100%);
    color: #ffffff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 55px 60px 45px 60px;
  }

  .glow-magenta {
    position: absolute;
    width: 700px;
    height: 700px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255,42,109,0.25) 0%, rgba(0,0,0,0) 70%);
    top: -120px;
    left: -120px;
    z-index: 1;
  }
  .glow-orange {
    position: absolute;
    width: 650px;
    height: 650px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255,122,0,0.22) 0%, rgba(0,0,0,0) 70%);
    bottom: -100px;
    right: -100px;
    z-index: 1;
  }

  /* Header */
  .header {
    position: relative;
    z-index: 10;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .logo-crest-wrap {
    width: 96px;
    height: 96px;
    border-radius: 26px;
    background: #140d24;
    border: 3px solid #ff2a6d;
    box-shadow: 0 0 35px rgba(255,42,109,0.5), 0 10px 30px rgba(0,0,0,0.8);
    overflow: hidden;
    margin-bottom: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .logo-crest-wrap img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .badge-tag {
    background: rgba(255,42,109,0.15);
    border: 1px solid rgba(255,42,109,0.4);
    color: #ff7a00;
    padding: 7px 22px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin-bottom: 12px;
  }
  .title {
    font-size: 66px;
    font-weight: 950;
    line-height: 1.05;
    letter-spacing: -1.5px;
    text-transform: uppercase;
    margin-bottom: 10px;
  }
  .title span {
    background: linear-gradient(135deg, #ff2a6d 0%, #ff7a00 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    text-shadow: 0 0 40px rgba(255,42,109,0.4);
  }
  .subtitle {
    font-size: 21px;
    color: rgba(255,255,255,0.85);
    font-weight: 700;
    max-width: 820px;
    line-height: 1.4;
  }

  /* Center Stage */
  .center-stage {
    position: relative;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 40px;
    height: 530px;
  }
  .ticket-card-side {
    width: 250px;
    background: rgba(26, 17, 44, 0.75);
    backdrop-filter: blur(16px);
    border: 1px solid rgba(255,42,109,0.25);
    border-radius: 22px;
    padding: 22px 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    box-shadow: 0 16px 40px rgba(0,0,0,0.6);
  }
  .stat-block h3 {
    font-size: 28px;
    font-weight: 950;
    color: #ff7a00;
    line-height: 1;
    margin-bottom: 4px;
  }
  .stat-block p {
    font-size: 13px;
    color: rgba(255,255,255,0.7);
    line-height: 1.35;
  }

  .phone-display {
    width: 290px;
    height: 520px;
    border-radius: 42px;
    background: #090611;
    border: 6px solid #362254;
    box-shadow: 0 25px 70px rgba(0,0,0,0.9), 0 0 50px rgba(255,42,109,0.3);
    overflow: hidden;
  }
  .phone-display img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  /* Footer */
  .footer {
    position: relative;
    z-index: 10;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }
  .btn-gradient {
    background: linear-gradient(135deg, #ff2a6d 0%, #ff7a00 100%);
    color: #ffffff;
    font-size: 26px;
    font-weight: 950;
    padding: 20px 60px;
    border-radius: 20px;
    text-transform: uppercase;
    box-shadow: 0 12px 35px rgba(255,42,109,0.45);
    display: inline-block;
  }
  .footer-sub {
    font-size: 15px;
    color: rgba(255,255,255,0.7);
    font-weight: 700;
  }
</style>
</head>
<body>
  <div class="glow-magenta"></div>
  <div class="glow-orange"></div>

  <div class="header">
    <div class="logo-crest-wrap">
      <img src="${logoB64}" />
    </div>
    <div class="badge-tag">🔥 THE OFFICIAL MZANSI PARTY RADAR</div>
    <h1 class="title">UNGASALI NGA LE <span>WEEKEND!</span></h1>
    <p class="subtitle">
      Amapiano Sundowners, Secret Warehouse Raves, VIP Bottle Service & Mzansi Gigs at Your Fingertips.
    </p>
  </div>

  <div class="center-stage">
    <div class="ticket-card-side">
      <div class="stat-block">
        <h3>500+</h3>
        <p>Curated weekend gigs across Gauteng, Durban & Cape Town.</p>
      </div>
      <div class="stat-block">
        <h3>0% FEES</h3>
        <p>Direct door code touch-downs & verified digital tickets.</p>
      </div>
      <div class="stat-block">
        <h3>RADAR</h3>
        <p>Live crowd heatmaps so you pull up where the vibe is real.</p>
      </div>
    </div>

    <div class="phone-display">
      <img src="${s2B64}" />
    </div>

    <div class="ticket-card-side">
      <div class="stat-block">
        <h3>SHUTTLES</h3>
        <p>Verified carpool captains from Ivory Park, Tembisa & Soweto.</p>
      </div>
      <div class="stat-block">
        <h3>CRASH PADS</h3>
        <p>Solar-powered night stays with verified host matriarchs.</p>
      </div>
      <div class="stat-block">
        <h3>KOTAS</h3>
        <p>24/7 street food kitchens open near your afterparty.</p>
      </div>
    </div>
  </div>

  <div class="footer">
    <div class="btn-gradient">FIND YOUR VIBE ➔ thegruvs.com</div>
    <div class="footer-sub">Works Instantly on Any Phone • Free Web App • Follow @TheGruvsSA</div>
  </div>
</body>
</html>`;

// ─────────────────────────────────────────────────────────────────────────────
// FLYER 3: "MZANSI STREET CULTURE & KOTA" (1080 x 1080 px, 1:1 Universal Post)
// Palette: Township Night Black (#070B08), Electric Mint (#00FF88), Kasi Gold (#FFD600)
// ─────────────────────────────────────────────────────────────────────────────
const htmlFlyer3StreetKota = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1080px;
    height: 1080px;
    background: #070b08;
    color: #ffffff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 45px 50px 40px 50px;
  }

  .glow-green {
    position: absolute;
    width: 650px;
    height: 650px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(0,255,136,0.20) 0%, rgba(0,0,0,0) 70%);
    top: -120px;
    left: -120px;
    z-index: 1;
  }
  .glow-gold {
    position: absolute;
    width: 600px;
    height: 600px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255,214,0,0.18) 0%, rgba(0,0,0,0) 70%);
    bottom: -100px;
    right: -100px;
    z-index: 1;
  }

  /* Header */
  .header {
    position: relative;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    padding-bottom: 20px;
  }
  .logo-row {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .logo-box {
    width: 72px;
    height: 72px;
    border-radius: 18px;
    background: #0d140e;
    border: 2px solid #00ff88;
    box-shadow: 0 0 25px rgba(0,255,136,0.35);
    overflow: hidden;
  }
  .logo-box img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .brand-meta h2 {
    font-size: 28px;
    font-weight: 950;
    letter-spacing: 1.5px;
    text-transform: uppercase;
  }
  .brand-meta p {
    font-size: 13px;
    color: #ffd600;
    font-weight: 800;
    letter-spacing: 1px;
  }
  .badge-kasi {
    background: rgba(0,255,136,0.12);
    border: 1px solid rgba(0,255,136,0.35);
    color: #00ff88;
    padding: 8px 18px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 800;
  }

  /* Headline Section */
  .hero-text {
    position: relative;
    z-index: 10;
    text-align: center;
    margin: 10px 0;
  }
  .hero-title {
    font-size: 54px;
    font-weight: 950;
    line-height: 1.05;
    letter-spacing: -1px;
    text-transform: uppercase;
  }
  .hero-title span {
    color: #ffd600;
    text-shadow: 0 0 25px rgba(255,214,0,0.4);
  }
  .hero-sub {
    font-size: 18px;
    color: rgba(255,255,255,0.75);
    margin-top: 6px;
    font-weight: 600;
  }

  /* Content Grid */
  .grid-wrap {
    position: relative;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
  }
  .left-list {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .kasi-card {
    background: rgba(16, 24, 18, 0.75);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255,255,255,0.1);
    border-left: 4px solid #00ff88;
    border-radius: 14px;
    padding: 14px 18px;
  }
  .kasi-card h4 {
    font-size: 16px;
    font-weight: 800;
    color: #fff;
    margin-bottom: 2px;
  }
  .kasi-card p {
    font-size: 12px;
    color: rgba(255,255,255,0.65);
  }

  .phone-wrap {
    width: 280px;
    height: 440px;
    border-radius: 36px;
    background: #080c09;
    border: 5px solid #203324;
    box-shadow: 0 20px 60px rgba(0,0,0,0.85), 0 0 40px rgba(0,255,136,0.25);
    overflow: hidden;
  }
  .phone-wrap img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  /* Footer */
  .footer {
    position: relative;
    z-index: 10;
    text-align: center;
    border-top: 1px solid rgba(255,255,255,0.1);
    padding-top: 18px;
  }
  .btn-kasi {
    background: linear-gradient(135deg, #00ff88 0%, #ffd600 100%);
    color: #070b08;
    font-size: 22px;
    font-weight: 950;
    padding: 16px 48px;
    border-radius: 16px;
    text-transform: uppercase;
    box-shadow: 0 8px 30px rgba(0,255,136,0.35);
    display: inline-block;
    margin-bottom: 10px;
  }
  .footer-sub {
    font-size: 14px;
    color: rgba(255,255,255,0.6);
    font-weight: 700;
  }
</style>
</head>
<body>
  <div class="glow-green"></div>
  <div class="glow-gold"></div>

  <div class="header">
    <div class="logo-row">
      <div class="logo-box">
        <img src="${logoB64}" />
      </div>
      <div class="brand-meta">
        <h2>THE GRUVS</h2>
        <p>KOTA & STREET CULTURE RADAR</p>
      </div>
    </div>
    <div class="badge-kasi">🇿🇦 IVORY PARK • TEMBISA • SOWETO</div>
  </div>

  <div class="hero-text">
    <h1 class="hero-title">HUNGRY AT 02:00 AM? <span>WE GOT YOU.</span></h1>
    <p class="hero-sub">Locate open kota kitchens, shisanyama joints & verified safe night carpools.</p>
  </div>

  <div class="grid-wrap">
    <div class="left-list">
      <div class="kasi-card">
        <h4>🍔 Late-Night Kotas & Quarter Hub</h4>
        <p>Live kitchen menus, prices, and direct WhatsApp notifications.</p>
      </div>
      <div class="kasi-card" style="border-left-color: #ffd600;">
        <h4>🥩 Shisanyama & Chill Spots</h4>
        <p>Find where the meat is sizzling near your weekend groove.</p>
      </div>
      <div class="kasi-card" style="border-left-color: #00f2ff;">
        <h4>🛡️ Resident Safe Shuttles</h4>
        <p>Verified Avanza & Quantum lifts from R25 with vetted drivers.</p>
      </div>
    </div>

    <div class="phone-wrap">
      <img src="${s1B64}" />
    </div>
  </div>

  <div class="footer">
    <div class="btn-kasi">ORDER & EXPLORE ➔ thegruvs.com</div>
    <div class="footer-sub">No Download Needed • Works in Browser • Follow @TheGruvsSA</div>
  </div>
</body>
</html>`;

// ─────────────────────────────────────────────────────────────────────────────
// FLYER 4: "PLATINUM VIP EVENT COVER" (1200 x 630 px Landscape)
// Palette: Carbon Titanium (#0A0D14), Ice Cyan (#38BDF8), Platinum Chrome (#F1F5F9)
// ─────────────────────────────────────────────────────────────────────────────
const htmlFlyer4EventCover = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1200px;
    height: 630px;
    background: #080c12;
    color: #ffffff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    padding: 0 65px;
  }
  .glow-cyan {
    position: absolute;
    width: 600px;
    height: 600px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(56,189,248,0.22) 0%, rgba(0,0,0,0) 70%);
    top: -100px;
    left: -100px;
  }
  .glow-gold {
    position: absolute;
    width: 500px;
    height: 500px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(245,158,11,0.18) 0%, rgba(0,0,0,0) 70%);
    bottom: -150px;
    right: 250px;
  }
  .content {
    flex: 1.25;
    z-index: 10;
  }
  .logo-bar {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 20px;
  }
  .logo-box {
    width: 76px;
    height: 76px;
    border-radius: 20px;
    background: #0e141c;
    border: 2px solid #38bdf8;
    box-shadow: 0 0 25px rgba(56,189,248,0.4);
    overflow: hidden;
  }
  .logo-box img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .brand-title {
    font-size: 30px;
    font-weight: 950;
    letter-spacing: 2px;
    text-transform: uppercase;
  }
  .tagline-sub {
    font-size: 13px;
    color: #f59e0b;
    font-weight: 800;
    letter-spacing: 2px;
  }
  .title {
    font-size: 48px;
    font-weight: 950;
    line-height: 1.1;
    margin-bottom: 14px;
    letter-spacing: -1px;
    text-transform: uppercase;
  }
  .title span {
    color: #38bdf8;
    text-shadow: 0 0 30px rgba(56,189,248,0.45);
  }
  .desc {
    font-size: 17px;
    color: rgba(255,255,255,0.75);
    line-height: 1.5;
    margin-bottom: 26px;
    max-width: 560px;
  }
  .btn-cta {
    background: linear-gradient(135deg, #38bdf8 0%, #05ffa1 100%);
    color: #06090e;
    font-size: 18px;
    font-weight: 950;
    padding: 16px 38px;
    border-radius: 14px;
    display: inline-block;
    text-transform: uppercase;
    box-shadow: 0 8px 30px rgba(56,189,248,0.35);
  }
  .phone-wrap {
    flex: 0.9;
    z-index: 10;
    display: flex;
    justify-content: flex-end;
  }
  .phone {
    width: 270px;
    height: 520px;
    border-radius: 38px;
    background: #0a0e14;
    border: 6px solid #24303f;
    box-shadow: 0 25px 60px rgba(0,0,0,0.85), 0 0 40px rgba(56,189,248,0.25);
    overflow: hidden;
  }
  .phone img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
</style>
</head>
<body>
  <div class="glow-cyan"></div>
  <div class="glow-gold"></div>
  <div class="content">
    <div class="logo-bar">
      <div class="logo-box">
        <img src="${logoB64}" />
      </div>
      <div>
        <div class="brand-title">THE GRUVS</div>
        <div class="tagline-sub">ROYALE EDITION • SOUTH AFRICA</div>
      </div>
    </div>
    <h1 class="title">FIND YOUR <span>WEEKEND GRUV.</span></h1>
    <p class="desc">
      Your digital passport to South Africa's premier Amapiano festivals, live nightlife radar, street food hubs, and verified resident stays.
    </p>
    <div class="btn-cta">EXPLORE NOW ➔ thegruvs.com</div>
  </div>
  <div class="phone-wrap">
    <div class="phone">
      <img src="${s1B64}" />
    </div>
  </div>
</body>
</html>`;

async function renderCreativeFlyers() {
  console.log('🚀 Launching Chromium to render Creative Logo Facebook Flyers...');
  const browser = await chromium.launch({ headless: true });

  const flyers = [
    {
      name: 'facebook-flyer-cyber-royale.png',
      html: htmlFlyer1CyberRoyale,
      width: 1080,
      height: 1350,
      label: 'Cyber Royale Edition (4:5 Portrait)'
    },
    {
      name: 'facebook-flyer-sunset-glow.png',
      html: htmlFlyer2SunsetGlow,
      width: 1080,
      height: 1350,
      label: 'Sunset Amapiano Glow Edition (4:5 Portrait)'
    },
    {
      name: 'facebook-flyer-street-kota.png',
      html: htmlFlyer3StreetKota,
      width: 1080,
      height: 1080,
      label: 'Mzansi Street Culture & Kota Edition (1:1 Square)'
    },
    {
      name: 'facebook-flyer-platinum-cover.png',
      html: htmlFlyer4EventCover,
      width: 1200,
      height: 630,
      label: 'Platinum VIP Event & Header Cover (Landscape)'
    }
  ];

  for (const f of flyers) {
    console.log(`📸 Rendering ${f.label}...`);
    const page = await browser.newPage({
      viewport: { width: f.width, height: f.height },
      deviceScaleFactor: 2
    });
    await page.setContent(f.html, { waitUntil: 'load' });

    const pubPath = path.join(PUBLIC_DIR, f.name);
    await page.screenshot({ path: pubPath, type: 'png' });
    console.log(`  ✅ Saved Public: ${pubPath}`);

    const artPath = path.join(ARTIFACT_DIR, f.name);
    await page.screenshot({ path: artPath, type: 'png' });
    console.log(`  ✅ Saved Artifact: ${artPath}`);

    await page.close();
  }

  await browser.close();
  console.log('🎉 All 4 Creative Logo Facebook Flyers generated successfully!');
}

renderCreativeFlyers().catch(err => {
  console.error('❌ Creative flyer render failed:', err);
  process.exit(1);
});
