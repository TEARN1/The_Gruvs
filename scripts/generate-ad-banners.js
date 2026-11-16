const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const OUT_DIR = path.join(__dirname, '..', 'public', 'images', 'advertising');
const ARTIFACT_DIR = path.join('C:\\Users\\ACER\\.gemini\\antigravity\\brain\\16cfe07f-63ac-441d-9bd8-e54e184c6d89', 'advertising');

// Base64 encode the captured mobile discover screenshot
const s1Path = path.join(OUT_DIR, '01-the-gruvs-mobile-discover.png');
const s2Path = path.join(OUT_DIR, '02-the-gruvs-mobile-lineup-events.png');
const s3Path = path.join(OUT_DIR, '03-the-gruvs-mobile-map-radar.png');

const s1B64 = fs.existsSync(s1Path) ? `data:image/png;base64,${fs.readFileSync(s1Path).toString('base64')}` : '';
const s2B64 = fs.existsSync(s2Path) ? `data:image/png;base64,${fs.readFileSync(s2Path).toString('base64')}` : '';
const s3B64 = fs.existsSync(s3Path) ? `data:image/png;base64,${fs.readFileSync(s3Path).toString('base64')}` : '';

const htmlResidentBanner = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1200px;
    height: 630px;
    background: #080c0d;
    color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    display: flex;
    position: relative;
    overflow: hidden;
  }
  .bg-glow {
    position: absolute;
    width: 600px;
    height: 600px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(0,242,255,0.18) 0%, rgba(0,0,0,0) 70%);
    top: -100px;
    left: -100px;
  }
  .bg-glow-orange {
    position: absolute;
    width: 500px;
    height: 500px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(245,158,11,0.15) 0%, rgba(0,0,0,0) 70%);
    bottom: -150px;
    right: 350px;
  }
  .content {
    flex: 1.2;
    padding: 64px 48px 64px 64px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    z-index: 2;
  }
  .badge-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
  }
  .partner-tag {
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.15);
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.5px;
    color: #f59e0b;
  }
  .eco-link {
    color: rgba(255,255,255,0.4);
    font-weight: 700;
    font-size: 14px;
  }
  .headline {
    font-size: 46px;
    font-weight: 900;
    line-height: 1.12;
    margin-bottom: 18px;
    letter-spacing: -1px;
  }
  .headline span {
    color: #00f2ff;
    text-shadow: 0 0 24px rgba(0,242,255,0.4);
  }
  .subtext {
    font-size: 18px;
    color: rgba(255,255,255,0.7);
    line-height: 1.5;
    margin-bottom: 32px;
    max-width: 540px;
  }
  .cta-row {
    display: flex;
    align-items: center;
    gap: 18px;
  }
  .btn-primary {
    background: #00f2ff;
    color: #000;
    font-size: 16px;
    font-weight: 900;
    padding: 14px 28px;
    border-radius: 14px;
    text-decoration: none;
    box-shadow: 0 8px 24px rgba(0,242,255,0.35);
  }
  .domain-badge {
    color: rgba(255,255,255,0.85);
    font-size: 15px;
    font-weight: 800;
    letter-spacing: 0.5px;
  }
  .phone-mockup-wrap {
    flex: 0.95;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    z-index: 2;
  }
  .phone-frame {
    width: 270px;
    height: 550px;
    border-radius: 40px;
    background: #111618;
    border: 6px solid #232c2f;
    box-shadow: 0 24px 60px rgba(0,0,0,0.85), 0 0 40px rgba(0,242,255,0.25);
    overflow: hidden;
    position: relative;
    transform: rotate(3deg);
  }
  .phone-screen {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .phone-back {
    position: absolute;
    width: 250px;
    height: 510px;
    border-radius: 36px;
    background: #0c1012;
    border: 5px solid #1a2225;
    overflow: hidden;
    left: 20px;
    top: 60px;
    transform: rotate(-6deg);
    opacity: 0.7;
    box-shadow: 0 16px 40px rgba(0,0,0,0.6);
  }
</style>
</head>
<body>
  <div class="bg-glow"></div>
  <div class="bg-glow-orange"></div>
  <div class="content">
    <div class="badge-row">
      <span class="partner-tag">THE RESIDENT CREW × THE GRUVS</span>
      <span class="eco-link">Ecosystem Integration</span>
    </div>
    <h1 class="headline">Book Your Stay.<br>Find Your <span>Weekend Gruv.</span></h1>
    <p class="subtext">
      Heading out this weekend? Explore South Africa's hottest Amapiano festivals, rooftop sundowners, and concerts on The Gruvs — with student lodging and stays next door on The Resident Crew.
    </p>
    <div class="cta-row">
      <div class="btn-primary">Discover Events Now →</div>
      <span class="domain-badge">thegruvs.com</span>
    </div>
  </div>
  <div class="phone-mockup-wrap">
    <div class="phone-back">
      <img src="${s2B64}" class="phone-screen" />
    </div>
    <div class="phone-frame">
      <img src="${s1B64}" class="phone-screen" />
    </div>
  </div>
</body>
</html>`;

const htmlExcellencyBanner = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1200px;
    height: 630px;
    background: #07090b;
    color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    display: flex;
    position: relative;
    overflow: hidden;
  }
  .bg-glow-cyan {
    position: absolute;
    width: 550px;
    height: 550px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(16,185,129,0.18) 0%, rgba(0,0,0,0) 70%);
    top: -80px;
    left: -80px;
  }
  .bg-glow-purple {
    position: absolute;
    width: 600px;
    height: 600px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(139,92,246,0.18) 0%, rgba(0,0,0,0) 70%);
    bottom: -120px;
    right: 280px;
  }
  .content {
    flex: 1.25;
    padding: 64px 48px 64px 64px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    z-index: 2;
  }
  .badge-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
  }
  .partner-tag {
    background: rgba(16,185,129,0.12);
    border: 1px solid rgba(16,185,129,0.3);
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.5px;
    color: #10b981;
  }
  .eco-link {
    color: rgba(255,255,255,0.4);
    font-weight: 700;
    font-size: 14px;
  }
  .headline {
    font-size: 46px;
    font-weight: 900;
    line-height: 1.12;
    margin-bottom: 18px;
    letter-spacing: -1px;
  }
  .headline span {
    color: #00f2ff;
    text-shadow: 0 0 24px rgba(0,242,255,0.4);
  }
  .subtext {
    font-size: 18px;
    color: rgba(255,255,255,0.7);
    line-height: 1.5;
    margin-bottom: 32px;
    max-width: 540px;
  }
  .cta-row {
    display: flex;
    align-items: center;
    gap: 18px;
  }
  .btn-primary {
    background: #00f2ff;
    color: #000;
    font-size: 16px;
    font-weight: 900;
    padding: 14px 28px;
    border-radius: 14px;
    text-decoration: none;
    box-shadow: 0 8px 24px rgba(0,242,255,0.35);
  }
  .domain-badge {
    color: rgba(255,255,255,0.85);
    font-size: 15px;
    font-weight: 800;
    letter-spacing: 0.5px;
  }
  .phone-mockup-wrap {
    flex: 0.95;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    z-index: 2;
  }
  .phone-frame {
    width: 270px;
    height: 550px;
    border-radius: 40px;
    background: #111618;
    border: 6px solid #232c2f;
    box-shadow: 0 24px 60px rgba(0,0,0,0.85), 0 0 40px rgba(16,185,129,0.25);
    overflow: hidden;
    position: relative;
    transform: rotate(-2deg);
  }
  .phone-screen {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .phone-back {
    position: absolute;
    width: 250px;
    height: 510px;
    border-radius: 36px;
    background: #0c1012;
    border: 5px solid #1a2225;
    overflow: hidden;
    right: 20px;
    top: 60px;
    transform: rotate(6deg);
    opacity: 0.7;
    box-shadow: 0 16px 40px rgba(0,0,0,0.6);
  }
</style>
</head>
<body>
  <div class="bg-glow-cyan"></div>
  <div class="bg-glow-purple"></div>
  <div class="content">
    <div class="badge-row">
      <span class="partner-tag">EXCELLENCY ACADEMY × THE GRUVS</span>
      <span class="eco-link">Student Life & Community</span>
    </div>
    <h1 class="headline">Work Hard. <span>Vibe Harder.</span><br>Campus to Concerts.</h1>
    <p class="subtext">
      Excellency Academy empowers the next generation of builders. When the books close, unlock VIP student guestlists, verified local events, and vibe scores across South Africa on The Gruvs.
    </p>
    <div class="cta-row">
      <div class="btn-primary">Unlock Your Vibe Passport →</div>
      <span class="domain-badge">thegruvs.com</span>
    </div>
  </div>
  <div class="phone-mockup-wrap">
    <div class="phone-back">
      <img src="${s3B64 || s1B64}" class="phone-screen" />
    </div>
    <div class="phone-frame">
      <img src="${s1B64}" class="phone-screen" />
    </div>
  </div>
</body>
</html>`;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });

  // Banner 1: The Resident Crew × The Gruvs
  console.log('[BannerGen] Rendering The Resident Crew advertising banner (1200x630)...');
  await page.setContent(htmlResidentBanner);
  await page.waitForTimeout(500);
  const outResident = path.join(OUT_DIR, 'ad-the-resident-x-the-gruvs.png');
  await page.screenshot({ path: outResident });
  if (fs.existsSync(ARTIFACT_DIR)) fs.copyFileSync(outResident, path.join(ARTIFACT_DIR, 'ad-the-resident-x-the-gruvs.png'));

  // Banner 2: Excellency Academy × The Gruvs
  console.log('[BannerGen] Rendering Excellency Academy advertising banner (1200x630)...');
  await page.setContent(htmlExcellencyBanner);
  await page.waitForTimeout(500);
  const outExcellency = path.join(OUT_DIR, 'ad-excellency-academy-x-the-gruvs.png');
  await page.screenshot({ path: outExcellency });
  if (fs.existsSync(ARTIFACT_DIR)) fs.copyFileSync(outExcellency, path.join(ARTIFACT_DIR, 'ad-excellency-academy-x-the-gruvs.png'));

  await browser.close();
  console.log('[BannerGen] Both promotional advertising banners generated successfully!');
})();
