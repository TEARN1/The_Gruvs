const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PUBLIC_DIR = path.join(__dirname, '..', 'public', 'images', 'advertising');
const ARTIFACT_DIR = path.join('C:\\Users\\ACER\\.gemini\\antigravity\\brain\\16cfe07f-63ac-441d-9bd8-e54e184c6d89', 'advertising');

if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });
if (!fs.existsSync(ARTIFACT_DIR)) fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

// Load real app screenshots as base64
const s1Path = path.join(PUBLIC_DIR, '01-the-gruvs-mobile-discover.png');
const s2Path = path.join(PUBLIC_DIR, '02-the-gruvs-mobile-lineup-events.png');
const s3Path = path.join(PUBLIC_DIR, '03-the-gruvs-mobile-map-radar.png');

const s1B64 = fs.existsSync(s1Path) ? `data:image/png;base64,${fs.readFileSync(s1Path).toString('base64')}` : '';
const s2B64 = fs.existsSync(s2Path) ? `data:image/png;base64,${fs.readFileSync(s2Path).toString('base64')}` : '';
const s3B64 = fs.existsSync(s3Path) ? `data:image/png;base64,${fs.readFileSync(s3Path).toString('base64')}` : '';

// ─────────────────────────────────────────────────────────────────────────────
// 1. FACEBOOK PORTRAIT FLYER (1080 x 1350 px, 4:5 Aspect Ratio)
// ─────────────────────────────────────────────────────────────────────────────
const htmlPortraitFlyer = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1080px;
    height: 1350px;
    background: #080a0f;
    color: #ffffff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  
  /* Background Ambience & Lighting */
  .glow-cyan {
    position: absolute;
    width: 700px;
    height: 700px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(0,242,255,0.22) 0%, rgba(0,0,0,0) 70%);
    top: -150px;
    left: -150px;
    z-index: 1;
  }
  .glow-magenta {
    position: absolute;
    width: 650px;
    height: 650px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255,42,109,0.20) 0%, rgba(0,0,0,0) 70%);
    top: 350px;
    right: -150px;
    z-index: 1;
  }
  .glow-gold {
    position: absolute;
    width: 600px;
    height: 600px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255,184,0,0.18) 0%, rgba(0,0,0,0) 70%);
    bottom: -100px;
    left: 200px;
    z-index: 1;
  }
  .grid-pattern {
    position: absolute;
    inset: 0;
    background-image: 
      linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
    background-size: 50px 50px;
    z-index: 1;
    mask-image: radial-gradient(circle at 50% 50%, black, transparent 80%);
  }

  /* Top Section */
  .header {
    position: relative;
    z-index: 10;
    padding: 60px 60px 0 60px;
    text-align: center;
  }
  .top-pill {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    background: rgba(255,255,255,0.07);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(0,242,255,0.3);
    padding: 10px 24px;
    border-radius: 30px;
    font-size: 15px;
    font-weight: 800;
    letter-spacing: 2px;
    color: #00f2ff;
    text-transform: uppercase;
    box-shadow: 0 4px 20px rgba(0,242,255,0.15);
    margin-bottom: 22px;
  }
  .top-pill span { color: #ffb800; }
  
  .brand-title {
    font-size: 72px;
    font-weight: 950;
    letter-spacing: -2px;
    line-height: 1.02;
    text-transform: uppercase;
    margin-bottom: 14px;
    background: linear-gradient(135deg, #ffffff 30%, #e2e8f0 70%, #00f2ff 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .brand-title .glow-word {
    background: linear-gradient(135deg, #00f2ff 0%, #05ffa1 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    text-shadow: 0 0 35px rgba(0,242,255,0.4);
  }
  
  .tagline {
    font-size: 24px;
    font-weight: 700;
    color: rgba(255,255,255,0.85);
    letter-spacing: 0.5px;
    line-height: 1.35;
    max-width: 820px;
    margin: 0 auto 28px auto;
  }
  .tagline em {
    font-style: normal;
    color: #ffb800;
    border-bottom: 2px solid #ffb800;
    padding-bottom: 2px;
  }

  /* Center Mockup & Value Props Showcase */
  .showcase {
    position: relative;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 570px;
    margin: 10px 40px;
  }

  /* Left Value Column */
  .feature-col-left {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 20px;
    align-items: flex-end;
    padding-right: 30px;
  }
  /* Right Value Column */
  .feature-col-right {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 20px;
    align-items: flex-start;
    padding-left: 30px;
  }

  .feature-card {
    background: rgba(18, 22, 32, 0.75);
    backdrop-filter: blur(16px);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 20px;
    padding: 18px 22px;
    width: 250px;
    box-shadow: 0 16px 36px rgba(0,0,0,0.5);
    transition: transform 0.2s;
  }
  .feature-card.left { text-align: right; }
  .feature-card.right { text-align: left; }
  .feature-icon {
    font-size: 26px;
    margin-bottom: 6px;
    display: inline-block;
  }
  .feature-title {
    font-size: 17px;
    font-weight: 800;
    color: #ffffff;
    margin-bottom: 4px;
  }
  .feature-desc {
    font-size: 13px;
    color: rgba(255,255,255,0.65);
    line-height: 1.4;
  }

  /* Center Dual Phone Mockup */
  .phones-center {
    position: relative;
    width: 380px;
    height: 550px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .phone-primary {
    position: absolute;
    width: 280px;
    height: 540px;
    border-radius: 42px;
    background: #090c10;
    border: 6px solid #2a3441;
    box-shadow: 0 30px 80px rgba(0,0,0,0.9), 0 0 50px rgba(0,242,255,0.3);
    overflow: hidden;
    z-index: 5;
    transform: translateY(-10px);
  }
  .phone-primary img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .phone-secondary {
    position: absolute;
    width: 260px;
    height: 500px;
    border-radius: 38px;
    background: #090c10;
    border: 5px solid #1e2630;
    box-shadow: 0 20px 50px rgba(0,0,0,0.7);
    overflow: hidden;
    z-index: 3;
    left: -40px;
    top: 40px;
    transform: rotate(-10deg);
    opacity: 0.85;
  }
  .phone-secondary img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  /* Bottom Conversion / CTA Bar */
  .footer {
    position: relative;
    z-index: 10;
    padding: 0 60px 60px 60px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 22px;
  }
  .cta-button {
    background: linear-gradient(135deg, #00f2ff 0%, #00c3ff 50%, #05ffa1 100%);
    color: #06090e;
    font-size: 26px;
    font-weight: 950;
    padding: 22px 64px;
    border-radius: 20px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    box-shadow: 0 12px 40px rgba(0,242,255,0.45);
    display: flex;
    align-items: center;
    gap: 16px;
    text-align: center;
  }
  .cta-sub {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 24px;
    font-size: 16px;
    color: rgba(255,255,255,0.75);
    font-weight: 700;
  }
  .cta-sub .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #00f2ff;
  }
  .badges-row {
    display: flex;
    align-items: center;
    gap: 20px;
    font-size: 14px;
    color: rgba(255,255,255,0.5);
    font-weight: 600;
  }
  .trust-chip {
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.12);
    padding: 8px 18px;
    border-radius: 12px;
    font-size: 14px;
    color: #ffb800;
    font-weight: 800;
  }
</style>
</head>
<body>
  <div class="glow-cyan"></div>
  <div class="glow-magenta"></div>
  <div class="glow-gold"></div>
  <div class="grid-pattern"></div>

  <!-- Header -->
  <div class="header">
    <div class="top-pill">
      🇿🇦 South Africa's #1 Nightlife & Vibe App <span>•</span> Free Web Access
    </div>
    <h1 class="brand-title">THE <span class="glow-word">GRUVS</span></h1>
    <p class="tagline">
      Never miss a beat. Discover <em>500+ Amapiano Festivals</em>, Secret Rooftops, Mzansi Street Food & Live Radar across Joburg, Soweto, Pretoria & Beyond!
    </p>
  </div>

  <!-- Showcase -->
  <div class="showcase">
    <!-- Left Features -->
    <div class="feature-col-left">
      <div class="feature-card left" style="border-left: 4px solid #00f2ff;">
        <span class="feature-icon">🎪</span>
        <div class="feature-title">Top Festivals & Lineups</div>
        <div class="feature-desc">All-access tickets, VIP tables, DJ lineups & RSVP instantly.</div>
      </div>
      <div class="feature-card left" style="border-left: 4px solid #ffb800;">
        <span class="feature-icon">🗺️</span>
        <div class="feature-title">Live Nightlife Radar</div>
        <div class="feature-desc">Real-time crowd heatmaps & trending clubs near you.</div>
      </div>
    </div>

    <!-- Center Phone Mockups -->
    <div class="phones-center">
      <div class="phone-secondary">
        <img src="${s3B64 || s1B64}" />
      </div>
      <div class="phone-primary">
        <img src="${s1B64}" />
      </div>
    </div>

    <!-- Right Features -->
    <div class="feature-col-right">
      <div class="feature-card right" style="border-right: 4px solid #05ffa1;">
        <span class="feature-icon">🍔</span>
        <div class="feature-title">Kota & Street Food</div>
        <div class="feature-desc">Vetted local spots in Ivory Park, Soweto, Tembisa & Mzansi.</div>
      </div>
      <div class="feature-card right" style="border-right: 4px solid #ff2a6d;">
        <span class="feature-icon">🛡️</span>
        <div class="feature-title">Resident Safe Rides</div>
        <div class="feature-desc">Verified carpool shuttles & anchor matriarch crash pads.</div>
      </div>
    </div>
  </div>

  <!-- Bottom CTA -->
  <div class="footer">
    <div class="cta-button">
      EXPLORE NOW ➔ thegruvs.com
    </div>
    <div class="cta-sub">
      <span>🌐 Instant Web App</span>
      <span class="dot"></span>
      <span>📱 Install on iOS & Android</span>
      <span class="dot"></span>
      <span>⚡ Zero Ads, 100% Real Vibes</span>
    </div>
    <div class="badges-row">
      <div class="trust-chip">★ 4.9 RATING • 10,000+ MZANSI PARTYGOERS</div>
      <span>Follow @TheGruvsSA on Facebook & IG</span>
    </div>
  </div>
</body>
</html>`;

// ─────────────────────────────────────────────────────────────────────────────
// 2. FACEBOOK SQUARE FLYER (1080 x 1080 px, 1:1 Universal Post)
// ─────────────────────────────────────────────────────────────────────────────
const htmlSquareFlyer = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1080px;
    height: 1080px;
    background: #080a0f;
    color: #ffffff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 50px 60px;
  }
  
  .glow-cyan {
    position: absolute;
    width: 650px;
    height: 650px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(0,242,255,0.20) 0%, rgba(0,0,0,0) 70%);
    top: -120px;
    left: -120px;
    z-index: 1;
  }
  .glow-magenta {
    position: absolute;
    width: 600px;
    height: 600px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255,42,109,0.18) 0%, rgba(0,0,0,0) 70%);
    bottom: -100px;
    right: -100px;
    z-index: 1;
  }

  .header {
    position: relative;
    z-index: 10;
    text-align: center;
  }
  .tag {
    display: inline-block;
    background: rgba(0,242,255,0.12);
    border: 1px solid rgba(0,242,255,0.4);
    color: #00f2ff;
    padding: 8px 22px;
    border-radius: 20px;
    font-size: 14px;
    font-weight: 800;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin-bottom: 12px;
  }
  .title {
    font-size: 64px;
    font-weight: 950;
    line-height: 1.05;
    letter-spacing: -1.5px;
    text-transform: uppercase;
  }
  .title span {
    color: #00f2ff;
    text-shadow: 0 0 30px rgba(0,242,255,0.4);
  }
  .subtitle {
    font-size: 20px;
    color: rgba(255,255,255,0.8);
    margin-top: 8px;
    font-weight: 600;
  }

  /* Center Area */
  .center-content {
    position: relative;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 480px;
  }
  .left-badges {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-width: 320px;
  }
  .badge-item {
    display: flex;
    align-items: center;
    gap: 14px;
    background: rgba(18, 22, 32, 0.8);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 16px;
    padding: 14px 18px;
  }
  .badge-icon {
    font-size: 24px;
    width: 44px;
    height: 44px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255,255,255,0.06);
  }
  .badge-text h4 {
    font-size: 16px;
    font-weight: 800;
    color: #fff;
    margin-bottom: 2px;
  }
  .badge-text p {
    font-size: 12px;
    color: rgba(255,255,255,0.65);
  }

  .phone-wrap {
    position: relative;
    width: 290px;
    height: 470px;
    border-radius: 40px;
    background: #0a0d12;
    border: 6px solid #283342;
    box-shadow: 0 25px 70px rgba(0,0,0,0.85), 0 0 40px rgba(0,242,255,0.25);
    overflow: hidden;
  }
  .phone-wrap img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .right-badges {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-width: 320px;
    align-items: flex-end;
  }

  /* Footer */
  .footer {
    position: relative;
    z-index: 10;
    text-align: center;
  }
  .btn-cta {
    background: linear-gradient(135deg, #00f2ff 0%, #05ffa1 100%);
    color: #07090e;
    font-size: 24px;
    font-weight: 950;
    padding: 18px 50px;
    border-radius: 18px;
    display: inline-block;
    text-transform: uppercase;
    box-shadow: 0 10px 35px rgba(0,242,255,0.4);
    letter-spacing: 0.5px;
    margin-bottom: 12px;
  }
  .footer-sub {
    font-size: 15px;
    color: rgba(255,255,255,0.65);
    font-weight: 700;
  }
</style>
</head>
<body>
  <div class="glow-cyan"></div>
  <div class="glow-magenta"></div>

  <div class="header">
    <div class="tag">🇿🇦 SOUTH AFRICA'S NIGHTLIFE HUB</div>
    <h1 class="title">FIND YOUR <span>WEEKEND GRUV</span></h1>
    <p class="subtitle">Festivals • Secret Rooftops • Street Food • Safe Rides</p>
  </div>

  <div class="center-content">
    <div class="left-badges">
      <div class="badge-item">
        <div class="badge-icon">🎪</div>
        <div class="badge-text">
          <h4>500+ Top Festivals</h4>
          <p>Instant tickets & VIP passes</p>
        </div>
      </div>
      <div class="badge-item">
        <div class="badge-icon">🗺️</div>
        <div class="badge-text">
          <h4>Live Vibe Radar</h4>
          <p>Real-time crowd heatmaps</p>
        </div>
      </div>
      <div class="badge-item">
        <div class="badge-icon">🍔</div>
        <div class="badge-text">
          <h4>Street Food & Kotas</h4>
          <p>Ivory Park, Soweto & Tembisa</p>
        </div>
      </div>
    </div>

    <div class="phone-wrap">
      <img src="${s1B64}" />
    </div>

    <div class="right-badges">
      <div class="badge-item">
        <div class="badge-icon">🛡️</div>
        <div class="badge-text">
          <h4>Guardian Shield</h4>
          <p>Emergency patrol & safe rides</p>
        </div>
      </div>
      <div class="badge-item">
        <div class="badge-icon">🏠</div>
        <div class="badge-text">
          <h4>Resident Crash Pads</h4>
          <p>Solar-powered night stays</p>
        </div>
      </div>
      <div class="badge-item">
        <div class="badge-icon">🎟️</div>
        <div class="badge-text">
          <h4>Zero Ticket Fees</h4>
          <p>Instant digital wristbands</p>
        </div>
      </div>
    </div>
  </div>

  <div class="footer">
    <div class="btn-cta">TAP TO EXPERIENCE ➔ thegruvs.com</div>
    <div class="footer-sub">No Download Required • Works on Any Phone • Follow @TheGruvsSA</div>
  </div>
</body>
</html>`;

// ─────────────────────────────────────────────────────────────────────────────
// 3. FACEBOOK EVENT COVER / LANDSCAPE BANNER (1200 x 630 px)
// ─────────────────────────────────────────────────────────────────────────────
const htmlEventBanner = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1200px;
    height: 630px;
    background: #080a0f;
    color: #ffffff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    padding: 0 70px;
  }
  .glow-cyan {
    position: absolute;
    width: 600px;
    height: 600px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(0,242,255,0.22) 0%, rgba(0,0,0,0) 70%);
    top: -100px;
    left: -100px;
  }
  .glow-gold {
    position: absolute;
    width: 500px;
    height: 500px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255,184,0,0.18) 0%, rgba(0,0,0,0) 70%);
    bottom: -150px;
    right: 250px;
  }
  .content {
    flex: 1.25;
    z-index: 10;
  }
  .pill {
    display: inline-block;
    background: rgba(0,242,255,0.12);
    border: 1px solid rgba(0,242,255,0.35);
    color: #00f2ff;
    padding: 6px 18px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin-bottom: 16px;
  }
  .title {
    font-size: 52px;
    font-weight: 950;
    line-height: 1.08;
    margin-bottom: 14px;
    letter-spacing: -1px;
    text-transform: uppercase;
  }
  .title span {
    color: #00f2ff;
    text-shadow: 0 0 25px rgba(0,242,255,0.4);
  }
  .desc {
    font-size: 18px;
    color: rgba(255,255,255,0.75);
    line-height: 1.5;
    margin-bottom: 28px;
    max-width: 550px;
  }
  .btn-cta {
    background: linear-gradient(135deg, #00f2ff 0%, #05ffa1 100%);
    color: #06090e;
    font-size: 18px;
    font-weight: 900;
    padding: 16px 36px;
    border-radius: 14px;
    display: inline-block;
    text-transform: uppercase;
    box-shadow: 0 8px 30px rgba(0,242,255,0.35);
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
    background: #0a0d12;
    border: 6px solid #283342;
    box-shadow: 0 25px 60px rgba(0,0,0,0.85), 0 0 40px rgba(0,242,255,0.25);
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
    <div class="pill">🇿🇦 Where South Africa Vibes</div>
    <h1 class="title">THE <span>GRUVS</span></h1>
    <p class="desc">
      Your all-in-one pass to South Africa's top festivals, secret rooftop parties, local street food hubs, and verified night stays.
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

async function renderFlyers() {
  console.log('🚀 Launching Chromium for Facebook Flyer generation...');
  const browser = await chromium.launch({ headless: true });

  const targets = [
    {
      name: 'facebook-flyer-portrait.png',
      html: htmlPortraitFlyer,
      width: 1080,
      height: 1350,
      label: 'Facebook Feed & Instagram Portrait Flyer (1080x1350)'
    },
    {
      name: 'facebook-flyer-square.png',
      html: htmlSquareFlyer,
      width: 1080,
      height: 1080,
      label: 'Facebook Post & Group Square Flyer (1080x1080)'
    },
    {
      name: 'facebook-flyer-event-cover.png',
      html: htmlEventBanner,
      width: 1200,
      height: 630,
      label: 'Facebook Event & Page Cover Banner (1200x630)'
    }
  ];

  for (const t of targets) {
    console.log(`📸 Rendering ${t.label}...`);
    const page = await browser.newPage({
      viewport: { width: t.width, height: t.height },
      deviceScaleFactor: 2
    });
    await page.setContent(t.html, { waitUntil: 'load' });
    
    // Save to public dir
    const pubOut = path.join(PUBLIC_DIR, t.name);
    await page.screenshot({ path: pubOut, type: 'png' });
    console.log(`  ✅ Saved: ${pubOut}`);

    // Save to artifact dir
    const artOut = path.join(ARTIFACT_DIR, t.name);
    await page.screenshot({ path: artOut, type: 'png' });
    console.log(`  ✅ Saved Artifact: ${artOut}`);

    await page.close();
  }

  await browser.close();
  console.log('🎉 All Facebook Flyers successfully rendered and exported!');
}

renderFlyers().catch(err => {
  console.error('❌ Flyer generation failed:', err);
  process.exit(1);
});
