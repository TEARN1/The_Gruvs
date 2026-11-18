const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PUBLIC_DIR = path.join(__dirname, '..', 'public', 'images', 'tiktok');
const ARTIFACT_DIR = path.join('C:\\Users\\ACER\\.gemini\\antigravity\\brain\\16cfe07f-63ac-441d-9bd8-e54e184c6d89', 'tiktok');

if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });
if (!fs.existsSync(ARTIFACT_DIR)) fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

// Read logo and screenshots
const logoB64 = `data:image/png;base64,${fs.readFileSync(path.join(__dirname, '..', 'assets', 'icon-512.png')).toString('base64')}`;
const s1B64 = `data:image/png;base64,${fs.readFileSync(path.join(__dirname, '..', 'public', 'images', 'advertising', '01-the-gruvs-mobile-discover.png')).toString('base64')}`;
const s2B64 = `data:image/png;base64,${fs.readFileSync(path.join(__dirname, '..', 'public', 'images', 'advertising', '02-the-gruvs-mobile-lineup-events.png')).toString('base64')}`;
const s3B64 = `data:image/png;base64,${fs.readFileSync(path.join(__dirname, '..', 'public', 'images', 'advertising', '03-the-gruvs-mobile-map-radar.png')).toString('base64')}`;

// Common CSS for ultra-legible TikTok typography
const commonStyle = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1080px;
    height: 1920px;
    background: #06080c;
    color: #ffffff;
    font-family: -apple-system, BlinkMacSystemFont, "Montserrat", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 100px 70px 140px 70px; /* TikTok safe zones */
  }

  /* Safe margins & background glow */
  .bg-glow-1 {
    position: absolute;
    width: 800px;
    height: 800px;
    border-radius: 50%;
    filter: blur(80px);
    z-index: 1;
    pointer-events: none;
  }
  .bg-glow-2 {
    position: absolute;
    width: 700px;
    height: 700px;
    border-radius: 50%;
    filter: blur(80px);
    z-index: 1;
    pointer-events: none;
  }
  .grid-pattern {
    position: absolute;
    inset: 0;
    background-image: 
      linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px);
    background-size: 50px 50px;
    z-index: 1;
  }

  /* Header Branding */
  .header-brand {
    position: relative;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .logo-crest-wrap {
    display: flex;
    align-items: center;
    gap: 20px;
  }
  .logo-crest {
    width: 88px;
    height: 88px;
    border-radius: 24px;
    background: #090e16;
    border: 3px solid #00f2ff;
    box-shadow: 0 0 35px rgba(0,242,255,0.5);
    overflow: hidden;
  }
  .logo-crest img { width: 100%; height: 100%; object-fit: cover; }
  .brand-title {
    font-size: 38px;
    font-weight: 950;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #ffffff;
  }
  .brand-sub {
    font-size: 15px;
    font-weight: 800;
    color: #ffb800;
    letter-spacing: 2px;
  }
  .slide-counter {
    background: rgba(255,255,255,0.12);
    border: 1px solid rgba(255,255,255,0.25);
    color: #fff;
    padding: 10px 22px;
    border-radius: 30px;
    font-size: 18px;
    font-weight: 900;
  }

  /* Ultra-Visible Text Badge Box */
  .hook-badge {
    display: inline-block;
    background: #ff2a6d;
    color: #ffffff;
    padding: 12px 28px;
    border-radius: 14px;
    font-size: 22px;
    font-weight: 950;
    letter-spacing: 2px;
    text-transform: uppercase;
    box-shadow: 0 8px 30px rgba(255,42,109,0.5);
    margin-bottom: 24px;
  }
  .hook-badge.cyan {
    background: #00f2ff;
    color: #06090e;
    box-shadow: 0 8px 30px rgba(0,242,255,0.5);
  }
  .hook-badge.gold {
    background: #ffd600;
    color: #06090e;
    box-shadow: 0 8px 30px rgba(255,214,0,0.5);
  }
  .hook-badge.green {
    background: #00ff88;
    color: #06090e;
    box-shadow: 0 8px 30px rgba(0,255,136,0.5);
  }

  /* Giant Legible Typography */
  .giant-title {
    font-size: 78px;
    font-weight: 950;
    line-height: 1.05;
    letter-spacing: -2px;
    text-transform: uppercase;
    text-shadow: 0 6px 20px rgba(0,0,0,0.9);
    margin-bottom: 20px;
  }
  .giant-title .highlight {
    background: #00f2ff;
    color: #06090e;
    padding: 0 16px;
    border-radius: 10px;
    display: inline-block;
  }
  .giant-title .highlight-pink {
    background: #ff2a6d;
    color: #ffffff;
    padding: 0 16px;
    border-radius: 10px;
    display: inline-block;
  }
  .giant-title .highlight-gold {
    background: #ffd600;
    color: #06090e;
    padding: 0 16px;
    border-radius: 10px;
    display: inline-block;
  }

  .high-contrast-text {
    font-size: 28px;
    font-weight: 800;
    color: rgba(255,255,255,0.95);
    line-height: 1.35;
    text-shadow: 0 4px 15px rgba(0,0,0,0.8);
    max-width: 900px;
  }

  /* Value Prop Highlight Cards */
  .card-stack {
    position: relative;
    z-index: 10;
    display: flex;
    flex-direction: column;
    gap: 20px;
    margin: 30px 0;
  }
  .high-contrast-card {
    background: rgba(14, 20, 30, 0.95);
    border: 3px solid rgba(255,255,255,0.18);
    border-radius: 26px;
    padding: 24px 30px;
    display: flex;
    align-items: center;
    gap: 24px;
    box-shadow: 0 20px 45px rgba(0,0,0,0.7);
  }
  .card-icon {
    font-size: 44px;
    width: 80px;
    height: 80px;
    border-radius: 20px;
    background: rgba(255,255,255,0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .card-content h3 {
    font-size: 30px;
    font-weight: 950;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .card-content p {
    font-size: 20px;
    font-weight: 700;
    color: rgba(255,255,255,0.75);
  }

  /* Center Visual Mockup */
  .center-phone-mockup {
    position: relative;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 20px 0;
  }
  .phone-frame {
    width: 360px;
    height: 650px;
    border-radius: 48px;
    background: #090d14;
    border: 8px solid #293848;
    box-shadow: 0 35px 90px rgba(0,0,0,0.95), 0 0 60px rgba(0,242,255,0.4);
    overflow: hidden;
  }
  .phone-frame img { width: 100%; height: 100%; object-fit: cover; }

  /* Bottom Sticky CTA Banner */
  .footer-cta {
    position: relative;
    z-index: 10;
    background: rgba(14, 20, 30, 0.9);
    backdrop-filter: blur(16px);
    border: 2px solid rgba(255,255,255,0.15);
    border-radius: 28px;
    padding: 26px 36px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    box-shadow: 0 15px 40px rgba(0,0,0,0.8);
  }
  .cta-big-btn {
    background: linear-gradient(135deg, #00f2ff 0%, #00b4ff 50%, #05ffa1 100%);
    color: #05080e;
    font-size: 28px;
    font-weight: 950;
    padding: 20px 42px;
    border-radius: 20px;
    text-transform: uppercase;
    letter-spacing: 1px;
    box-shadow: 0 10px 35px rgba(0,242,255,0.5);
  }
  .cta-meta {
    text-align: right;
  }
  .cta-meta h4 {
    font-size: 26px;
    font-weight: 950;
    color: #ffd600;
  }
  .cta-meta p {
    font-size: 16px;
    color: rgba(255,255,255,0.7);
    font-weight: 700;
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// POST 1: THE VIRAL HOOK (Where's the vibe?)
// ─────────────────────────────────────────────────────────────────────────────
const post1Html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>${commonStyle}
  .bg-glow-1 { background: rgba(255,42,109,0.3); top: -100px; left: -100px; }
  .bg-glow-2 { background: rgba(0,242,255,0.25); bottom: -100px; right: -100px; }
</style></head>
<body>
  <div class="bg-glow-1"></div><div class="bg-glow-2"></div><div class="grid-pattern"></div>

  <div class="header-brand">
    <div class="logo-crest-wrap">
      <div class="logo-crest"><img src="${logoB64}"></div>
      <div>
        <div class="brand-title">THE GRUVS</div>
        <div class="brand-sub">★ MZANSI NIGHTLIFE HUB ★</div>
      </div>
    </div>
    <div class="slide-counter">1 / 5 ➡️ SWIPE</div>
  </div>

  <div>
    <div class="hook-badge">❌ STOP ASKING ON WHATSAPP</div>
    <h1 class="giant-title">
      TIRED OF ASKING<br>
      <span class="highlight-pink">"WHERE'S THE VIBE?"</span>
    </h1>
    <p class="high-contrast-text">
      Every weekend it’s the same struggle. Dead plans. Half-empty venues. Asking in 10 different group chats where people are going.
    </p>
  </div>

  <div class="card-stack">
    <div class="high-contrast-card" style="border-left: 8px solid #00f2ff;">
      <div class="card-icon">🎪</div>
      <div class="card-content">
        <h3 style="color: #00f2ff;">500+ Top Festivals</h3>
        <p>Amapiano, Rooftops & Secret Gigs across SA</p>
      </div>
    </div>
    <div class="high-contrast-card" style="border-left: 8px solid #ffd600;">
      <div class="card-icon">🗺️</div>
      <div class="card-content">
        <h3 style="color: #ffd600;">Live Vibe Radar</h3>
        <p>Real-time crowd heatmaps before you pull up</p>
      </div>
    </div>
    <div class="high-contrast-card" style="border-left: 8px solid #00ff88;">
      <div class="card-icon">🍔</div>
      <div class="card-content">
        <h3 style="color: #00ff88;">02:00 AM Street Food</h3>
        <p>Kotas & Shisanyama near your party</p>
      </div>
    </div>
  </div>

  <div class="footer-cta">
    <div>
      <div style="font-size: 16px; color: #ffb800; font-weight: 800; text-transform: uppercase;">Swipe to see how it works ➡️</div>
      <div style="font-size: 26px; font-weight: 950;">NO DOWNLOAD REQUIRED</div>
    </div>
    <div class="cta-big-btn">thegruvs.com</div>
  </div>
</body>
</html>`;

// ─────────────────────────────────────────────────────────────────────────────
// POST 2: 500+ FESTIVALS & TICKETS (The Discovery Engine)
// ─────────────────────────────────────────────────────────────────────────────
const post2Html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>${commonStyle}
  .bg-glow-1 { background: rgba(0,242,255,0.3); top: -80px; right: -80px; }
  .bg-glow-2 { background: rgba(255,184,0,0.25); bottom: -80px; left: -80px; }
</style></head>
<body>
  <div class="bg-glow-1"></div><div class="bg-glow-2"></div><div class="grid-pattern"></div>

  <div class="header-brand">
    <div class="logo-crest-wrap">
      <div class="logo-crest"><img src="${logoB64}"></div>
      <div>
        <div class="brand-title">THE GRUVS</div>
        <div class="brand-sub">★ FESTIVAL RADAR ★</div>
      </div>
    </div>
    <div class="slide-counter">2 / 5 ➡️ SWIPE</div>
  </div>

  <div>
    <div class="hook-badge cyan">🎪 ALL MZANSI EVENTS IN ONE PLACE</div>
    <h1 class="giant-title">
      500+ FESTIVALS.<br>
      <span class="highlight">ZERO TICKET FEES.</span>
    </h1>
    <p class="high-contrast-text">
      From Ultra and massive Amapiano stadium concerts to private warehouse raves in Joburg, Soweto, Pretoria & Cape Town.
    </p>
  </div>

  <div class="center-phone-mockup">
    <div class="phone-frame">
      <img src="${s1B64}">
    </div>
  </div>

  <div class="footer-cta">
    <div>
      <div style="font-size: 16px; color: #00f2ff; font-weight: 800; text-transform: uppercase;">Instant digital wristbands</div>
      <div style="font-size: 24px; font-weight: 950;">RSVP DIRECTLY IN BROWSER</div>
    </div>
    <div class="cta-big-btn">thegruvs.com</div>
  </div>
</body>
</html>`;

// ─────────────────────────────────────────────────────────────────────────────
// POST 3: LIVE RADAR (No more empty clubs)
// ─────────────────────────────────────────────────────────────────────────────
const post3Html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>${commonStyle}
  .bg-glow-1 { background: rgba(0,255,136,0.3); top: -80px; left: -80px; }
  .bg-glow-2 { background: rgba(0,242,255,0.25); bottom: -80px; right: -80px; }
</style></head>
<body>
  <div class="bg-glow-1"></div><div class="bg-glow-2"></div><div class="grid-pattern"></div>

  <div class="header-brand">
    <div class="logo-crest-wrap">
      <div class="logo-crest"><img src="${logoB64}"></div>
      <div>
        <div class="brand-title">THE GRUVS</div>
        <div class="brand-sub">★ LIVE CROWD RADAR ★</div>
      </div>
    </div>
    <div class="slide-counter">3 / 5 ➡️ SWIPE</div>
  </div>

  <div>
    <div class="hook-badge green">⚡ REAL-TIME VENUE HEATMAPS</div>
    <h1 class="giant-title">
      DON'T PULL UP TO<br>
      <span class="highlight" style="background:#00ff88; color:#06080c;">AN EMPTY CLUB.</span>
    </h1>
    <p class="high-contrast-text">
      The Gruvs Live Radar tracks crowd density and real-time vibe levels so you know where the heat is before spending your petrol!
    </p>
  </div>

  <div class="center-phone-mockup">
    <div class="phone-frame">
      <img src="${s3B64 || s1B64}">
    </div>
  </div>

  <div class="footer-cta">
    <div>
      <div style="font-size: 16px; color: #00ff88; font-weight: 800; text-transform: uppercase;">Live GPS Radar Active</div>
      <div style="font-size: 24px; font-weight: 950;">CHECK CROWD BEFORE YOU GO</div>
    </div>
    <div class="cta-big-btn">thegruvs.com</div>
  </div>
</body>
</html>`;

// ─────────────────────────────────────────────────────────────────────────────
// POST 4: 02:00 AM KOTAS & RESIDENT SAFE SHUTTLES
// ─────────────────────────────────────────────────────────────────────────────
const post4Html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>${commonStyle}
  .bg-glow-1 { background: rgba(255,214,0,0.3); top: -80px; right: -80px; }
  .bg-glow-2 { background: rgba(255,42,109,0.25); bottom: -80px; left: -80px; }
</style></head>
<body>
  <div class="bg-glow-1"></div><div class="bg-glow-2"></div><div class="grid-pattern"></div>

  <div class="header-brand">
    <div class="logo-crest-wrap">
      <div class="logo-crest"><img src="${logoB64}"></div>
      <div>
        <div class="brand-title">THE GRUVS</div>
        <div class="brand-sub">★ KASI CULTURE & SAFETY ★</div>
      </div>
    </div>
    <div class="slide-counter">4 / 5 ➡️ SWIPE</div>
  </div>

  <div>
    <div class="hook-badge gold">🍔 LOCAL STREET FOOD & SAFETY</div>
    <h1 class="giant-title">
      HUNGRY AT 02:00 AM?<br>
      <span class="highlight-gold">WE GOT YOU.</span>
    </h1>
    <p class="high-contrast-text">
      From Ivory Park and Tembisa to Soweto, find sizzling Kotas and open kitchens near your party — plus verified carpools to get home safe.
    </p>
  </div>

  <div class="card-stack">
    <div class="high-contrast-card" style="border-left: 8px solid #ffd600;">
      <div class="card-icon">🥪</div>
      <div class="card-content">
        <h3 style="color: #ffd600;">Late-Night Kota Hub</h3>
        <p>Live prices, menus & WhatsApp kitchen notices</p>
      </div>
    </div>
    <div class="high-contrast-card" style="border-left: 8px solid #00f2ff;">
      <div class="card-icon">🚐</div>
      <div class="card-content">
        <h3 style="color: #00f2ff;">Resident Safe Shuttles</h3>
        <p>Verified carpool captains (Avanza/Quantum from R25)</p>
      </div>
    </div>
    <div class="high-contrast-card" style="border-left: 8px solid #ff2a6d;">
      <div class="card-icon">🛡️</div>
      <div class="card-content">
        <h3 style="color: #ff2a6d;">Crash Pads & Patrol Relay</h3>
        <p>Solar-powered night stays with family matriarchs</p>
      </div>
    </div>
  </div>

  <div class="footer-cta">
    <div>
      <div style="font-size: 16px; color: #ffd600; font-weight: 800; text-transform: uppercase;">Party hard • Get home safe</div>
      <div style="font-size: 24px; font-weight: 950;">THE RESIDENT CREW INTEGRATION</div>
    </div>
    <div class="cta-big-btn">thegruvs.com</div>
  </div>
</body>
</html>`;

// ─────────────────────────────────────────────────────────────────────────────
// POST 5: THE FINAL CTA (Experience It Free)
// ─────────────────────────────────────────────────────────────────────────────
const post5Html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>${commonStyle}
  .bg-glow-1 { background: rgba(0,242,255,0.35); top: -100px; left: -100px; }
  .bg-glow-2 { background: rgba(255,42,109,0.3); bottom: -100px; right: -100px; }
</style></head>
<body>
  <div class="bg-glow-1"></div><div class="bg-glow-2"></div><div class="grid-pattern"></div>

  <div class="header-brand">
    <div class="logo-crest-wrap">
      <div class="logo-crest"><img src="${logoB64}"></div>
      <div>
        <div class="brand-title">THE GRUVS</div>
        <div class="brand-sub">★ OFFICIAL LAUNCH ★</div>
      </div>
    </div>
    <div class="slide-counter">5 / 5 • SAVE THIS</div>
  </div>

  <div style="text-align: center; margin-top: 20px;">
    <div class="hook-badge cyan">🇿🇦 WHERE SOUTH AFRICA VIBES</div>
    <h1 class="giant-title" style="font-size: 72px;">
      YOUR WEEKEND IS<br>
      <span class="highlight">OFFICIALLY SORTED.</span>
    </h1>
    <p class="high-contrast-text" style="margin: 0 auto;">
      Zero app store downloads. Works instantly in your phone browser. 100% Free to join.
    </p>
  </div>

  <div class="card-stack">
    <div class="high-contrast-card" style="border: 3px solid #00f2ff;">
      <div class="card-icon" style="background:#00f2ff; color:#06080c;">🌐</div>
      <div class="card-content">
        <h3 style="color: #00f2ff;">thegruvs.com</h3>
        <p>Type in your browser and explore right now</p>
      </div>
    </div>
    <div class="high-contrast-card" style="border: 3px solid #ffd600;">
      <div class="card-icon" style="background:#ffd600; color:#06080c;">📱</div>
      <div class="card-content">
        <h3 style="color: #ffd600;">Follow @TheGruvsSA</h3>
        <p>Daily gig alerts, DJ lineups & VIP giveaways</p>
      </div>
    </div>
  </div>

  <div style="text-align: center; margin-bottom: 20px;">
    <div style="font-size: 32px; font-weight: 950; text-transform: uppercase; margin-bottom: 12px; color: #fff;">
      👇 TAP LINK IN BIO OR VISIT 👇
    </div>
    <div style="background: linear-gradient(135deg, #00f2ff, #05ffa1); color: #06090e; font-size: 44px; font-weight: 950; padding: 24px 60px; border-radius: 30px; display: inline-block; box-shadow: 0 15px 50px rgba(0,242,255,0.6); letter-spacing: 2px;">
      thegruvs.com
    </div>
  </div>

  <div class="footer-cta" style="justify-content: center; text-align: center;">
    <div style="font-size: 20px; font-weight: 800; color: rgba(255,255,255,0.85);">
      Share this with your crew & plan your next gruv! 🇿🇦✨
    </div>
  </div>
</body>
</html>`;

async function renderTikTokSlides() {
  console.log('🚀 Launching Chromium to render 5 Ultra-Legible TikTok Slides (1080x1920)...');
  const browser = await chromium.launch({ headless: true });

  const posts = [
    { name: 'tiktok-slide-1-hook.png', html: post1Html, title: 'Slide 1: The Viral Hook' },
    { name: 'tiktok-slide-2-festivals.png', html: post2Html, title: 'Slide 2: 500+ Festivals & Zero Fees' },
    { name: 'tiktok-slide-3-radar.png', html: post3Html, title: 'Slide 3: Live Crowd Heatmap Radar' },
    { name: 'tiktok-slide-4-kotas-rides.png', html: post4Html, title: 'Slide 4: 02:00 AM Kotas & Safe Lifts' },
    { name: 'tiktok-slide-5-cta.png', html: post5Html, title: 'Slide 5: The Ultimate Link-in-Bio CTA' }
  ];

  for (const p of posts) {
    console.log(`📸 Rendering ${p.title}...`);
    const page = await browser.newPage({
      viewport: { width: 1080, height: 1920 },
      deviceScaleFactor: 2 // Ultra-sharp 4K Retina quality
    });
    await page.setContent(p.html, { waitUntil: 'load' });

    const pubPath = path.join(PUBLIC_DIR, p.name);
    await page.screenshot({ path: pubPath, type: 'png' });
    console.log(`  ✅ Saved Public: ${pubPath}`);

    const artPath = path.join(ARTIFACT_DIR, p.name);
    await page.screenshot({ path: artPath, type: 'png' });
    console.log(`  ✅ Saved Artifact: ${artPath}`);

    await page.close();
  }

  await browser.close();
  console.log('🎉 All 5 TikTok Slides rendered and exported successfully!');
}

renderTikTokSlides().catch(err => {
  console.error('❌ TikTok slide render failed:', err);
  process.exit(1);
});
