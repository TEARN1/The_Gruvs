import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderWeeklyDigestHtml } from './lib/emailTemplate.mjs';
import { renderMerchantDigestHtml } from './lib/merchantEmailTemplate.mjs';
import { renderExcellencyDigestHtml } from './lib/excellencyEmailTemplate.mjs';
import { renderResidentHostDriverDigestHtml } from './lib/residentHostDriverEmailTemplate.mjs';
import { renderResidentDigestHtml } from './lib/residentEmailTemplate.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// Load environment variables if available
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...vals] = trimmed.split('=');
    if (key && vals.length > 0 && !process.env[key.trim()]) {
      process.env[key.trim()] = vals.join('=').trim().replace(/^["']|["']$/g, '');
    }
  }
}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://feevvddvrjmfbhffccbf.supabase.co';
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function fetchRealEvents() {
  try {
    const today = new Date();
    const twoWeeksLater = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
    const todayStr = today.toISOString().split('T')[0];
    const maxStr = twoWeeksLater.toISOString().split('T')[0];

    const queryUrl = `${SUPABASE_URL}/rest/v1/events?select=id,title,venue_name,location,address,city,event_date,event_time,lat,lon,image_url,cover_url,media_urls,category,price,slug&and=(event_date.gte.${todayStr},event_date.lte.${maxStr})&deleted_at=is.null&order=event_date.asc&limit=6`;

    const res = await fetch(queryUrl, {
      headers: {
        apikey: SERVICE_KEY || ANON_KEY,
        Authorization: `Bearer ${SERVICE_KEY || ANON_KEY}`,
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch (err) {
    console.warn('Fallback to standard curated events:', err.message);
  }

  // High quality Gauteng fallback events
  return [
    {
      id: 'event-summer-cup-2026',
      title: 'Betway Summer Cup 2026',
      venue_name: 'Turffontein Racecourse',
      location: 'Turffontein, Johannesburg',
      event_date: '2026-11-28',
      event_time: '11:00:00',
      category: 'nightlife',
      price: 'R100 - R450',
      distance_km: 3.8,
      image_url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7',
    },
    {
      id: 'event-piano-people-2026',
      title: 'Piano People Johannesburg 2026',
      venue_name: 'Old Park Station',
      location: 'Newtown, Johannesburg',
      event_date: '2026-11-28',
      event_time: '14:00:00',
      category: 'music',
      price: 'R250',
      distance_km: 1.3,
      image_url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745',
    },
    {
      id: 'event-parkview-market-2026',
      title: 'Parkview Christmas Market',
      venue_name: 'George Hay Park',
      location: 'Parkview, Johannesburg',
      event_date: '2026-11-29',
      event_time: '09:00:00',
      category: 'food & markets',
      price: 'Free RSVP',
      distance_km: 5.1,
      image_url: 'https://images.unsplash.com/photo-1533105079780-92b9be482077',
    },
  ];
}

async function run() {
  console.log('📦 Generating all 5 ecosystem email samples...');
  const events = await fetchRealEvents();

  const user = {
    display_name: 'Asemahle',
    username: 'asemahle',
    home_area: 'Johannesburg',
    home_base_lat: -26.2041,
    home_base_lon: 28.0473,
  };

  // Sample 1: Monday 09:00 SAST - The Gruvs 14-Day Vibe Radar (Consumer)
  const sample1Html = renderWeeklyDigestHtml({
    user,
    events,
    appUrl: 'https://thegruvs.com',
  });

  // Sample 2: Tuesday 10:00 SAST - The Gruvs Merchant & Vendor Intelligence (Business)
  const sample2Html = renderMerchantDigestHtml({
    user,
    forecastData: {
      totalCrowd: '14,500+ Attendees',
      peakDate: 'Friday 27 – Sunday 29 Nov',
      corridors: [
        { area: 'Turffontein / South JHB', crowd: '8,500+ Attendees', note: 'Betway Summer Cup 2026 (Heavy Kota & Beverage demand)' },
        { area: 'Old Park Station / Newtown', crowd: '3,800+ Attendees', note: 'Piano People Live (Night food stalls & merchandise)' },
        { area: 'Parkview / Rosebank', crowd: '2,200+ Attendees', note: 'Christmas Artisan & Gourmet Street Food Market' },
      ],
      trends: [
        { term: 'Kota & Late Night Grill near Turffontein', change: '+340% search surge' },
        { term: 'VIP Table Packages & Cocktails', change: '+215% search surge' },
        { term: 'Safe Secured Parking Newtown', change: '+190% search surge' },
      ],
    },
  });

  // Sample 3: Wednesday 10:00 SAST - Excellency Academy Master The Craft (Creator)
  const sample3Html = renderExcellencyDigestHtml({
    user,
    courses: [
      {
        badge: 'SOUND ENGINEERING',
        title: 'Amapiano Log-Drum Mastering & FL Studio Architecture',
        instructor: 'Senior Resident Mix Engineer',
        duration: '3 Weeks (Hands-on Studio)',
        discount: 'Redeem 500 Vibe Points for 40% Off',
      },
      {
        badge: 'LIVE PERFORMANCE',
        title: 'Live CDJ Performance, Stems & Dubplate Cueing',
        instructor: 'Johannesburg Nightlife Headliner',
        duration: '2 Weeks (Booth Experience)',
        discount: 'Full Scholarship Available for Top 3 Talent',
      },
      {
        badge: 'STAGE & LIGHTING',
        title: 'Festival Staging Acoustics & DMX Lighting Rigging',
        instructor: 'Certified Tour Director',
        duration: '4 Weeks (Live Concert Staging)',
        discount: 'Guaranteed Dec 2026 Stage Gig Placement',
      },
    ],
  });

  // Sample 4: Thursday 10:00 SAST - The Resident Host & Driver Brief (Business)
  const sample4Html = renderResidentHostDriverDigestHtml({
    user,
    opsData: {
      weekendDates: 'Nov 27 – Nov 29 (Peak Event Weekend)',
      expectedSurge: '94% Occupancy Projected near Turffontein & Newtown',
      corridors: [
        { from: 'Old Park Station (Piano People)', to: 'Soweto (Vilakazi / Diepkloof)', time: '01:30 – 04:30 AM', fare: 'R55–R65 / seat' },
        { from: 'Turffontein Racecourse (Summer Cup)', to: 'Rosebank & Sandton Hub', time: '21:00 – 02:00 AM', fare: 'R45–R60 / seat' },
        { from: 'Braamfontein Perimeter', to: 'Midrand / Centurion Corridor', time: '02:00 – 05:00 AM', fare: 'R70–R85 / seat' },
      ],
    },
  });

  // Sample 5: Thursday 14:00 SAST - The Resident Weekend Lock-In Pass (Consumer)
  const sample5Html = renderResidentDigestHtml({
    user,
    stays: [
      {
        verified_anchor: 'Verified Cottage · Turffontein (800m to Racecourse)',
        title: 'Garden View Guest Suite w/ Inverter & Solar Backup',
        location: 'Turffontein, JHB South',
        power_backup: '100% Solar & Wi-Fi Always On',
        price: '280',
      },
      {
        verified_anchor: 'Urban Crash Pad · Newtown (300m to Old Park Station)',
        title: 'Secure Loft Bed with Gated Security & Secure Parking',
        location: 'Newtown Cultural Precinct',
        power_backup: 'Generator Active',
        price: '190',
      },
      {
        verified_anchor: 'Rosebank Rest Point (Near Gautrain & Metro)',
        title: 'Cosy Studio Space · 24hr Security & Free Morning Coffee',
        location: 'Parkview / Rosebank',
        power_backup: 'Solar + Inverter',
        price: '350',
      },
    ],
  });

  // Output directories
  const distDir = path.join(ROOT, 'dist', 'email-previews');
  fs.mkdirSync(distDir, { recursive: true });

  const files = [
    { filename: 'sample-1-gruvs-vibe-radar.html', html: sample1Html, title: 'Sample 1: The Gruvs · 14-Day Vibe Radar (Consumer)' },
    { filename: 'sample-2-gruvs-merchant-intel.html', html: sample2Html, title: 'Sample 2: The Gruvs · Merchant & Vendor Intel (Business)' },
    { filename: 'sample-3-excellency-craft.html', html: sample3Html, title: 'Sample 3: Excellency Academy · Master The Craft (Creator)' },
    { filename: 'sample-4-resident-host-driver.html', html: sample4Html, title: 'Sample 4: The Resident · Host & Driver Brief (Business)' },
    { filename: 'sample-5-resident-lock-in.html', html: sample5Html, title: 'Sample 5: The Resident · Weekend Lock-In Pass (Consumer)' },
  ];

  for (const item of files) {
    fs.writeFileSync(path.join(distDir, item.filename), item.html, 'utf8');
    console.log(`✔ Written: dist/email-previews/${item.filename}`);
  }

  // Create an all-in-one Interactive Showcase HTML file
  const showcaseHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>The Gruvs Ecosystem · Master Email Showcase</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #090c10;
      color: #e6edf3;
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }
    header {
      background: #161b22;
      border-bottom: 1px solid #30363d;
      padding: 14px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .badge-live {
      background: #FF6B00;
      color: #fff;
      font-size: 11px;
      font-weight: 800;
      padding: 3px 8px;
      border-radius: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .title {
      font-size: 16px;
      font-weight: 800;
      color: #ffffff;
    }
    .device-toggles {
      display: flex;
      background: #21262d;
      border-radius: 8px;
      padding: 3px;
      gap: 4px;
    }
    .btn-toggle {
      background: transparent;
      border: none;
      color: #8b949e;
      padding: 6px 14px;
      font-size: 12px;
      font-weight: 600;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-toggle.active {
      background: #30363d;
      color: #ffffff;
    }
    nav.tabs {
      background: #0d1117;
      border-bottom: 1px solid #21262d;
      padding: 0 20px;
      display: flex;
      gap: 8px;
      overflow-x: auto;
      flex-shrink: 0;
    }
    .tab-btn {
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      color: #8b949e;
      padding: 12px 14px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      white-space: nowrap;
      transition: all 0.15s;
    }
    .tab-btn:hover {
      color: #c9d1d9;
    }
    .tab-btn.active {
      color: #FF6B00;
      border-bottom-color: #FF6B00;
    }
    .tab-btn .pill {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
      background: rgba(255,255,255,0.08);
      font-weight: 700;
    }
    main.content-area {
      flex: 1;
      display: flex;
      background: #010409;
      overflow: hidden;
      justify-content: center;
      align-items: center;
      padding: 16px;
    }
    .preview-frame-wrapper {
      width: 100%;
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    iframe {
      width: 100%;
      height: 100%;
      border: 1px solid #30363d;
      border-radius: 12px;
      background: #090b0e;
      box-shadow: 0 12px 40px rgba(0,0,0,0.6);
      transition: all 0.25s;
    }
    .preview-frame-wrapper.mobile iframe {
      width: 390px;
      height: 844px;
      border-radius: 36px;
      border: 6px solid #30363d;
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <span class="badge-live">Live Ecosystem Preview</span>
      <span class="title">The Gruvs · Weekly Automated Broadcast Samples</span>
    </div>
    <div class="device-toggles">
      <button class="btn-toggle active" id="btn-desktop" onclick="setDevice('desktop')">🖥️ Desktop</button>
      <button class="btn-toggle" id="btn-mobile" onclick="setDevice('mobile')">📱 Mobile</button>
    </div>
  </header>

  <nav class="tabs">
    <button class="tab-btn active" onclick="switchSample(0, this)">
      <span>Mon 09:00</span>
      <span class="pill" style="color: #00f2fe;">The Gruvs</span>
      <strong>14-Day Vibe Radar (Consumer)</strong>
    </button>
    <button class="tab-btn" onclick="switchSample(1, this)">
      <span>Tue 10:00</span>
      <span class="pill" style="color: #FF6B00;">The Gruvs</span>
      <strong>Merchant & Vendor Intel (Business)</strong>
    </button>
    <button class="tab-btn" onclick="switchSample(2, this)">
      <span>Wed 10:00</span>
      <span class="pill" style="color: #60a5fa;">Excellency</span>
      <strong>Master The Craft (Creator)</strong>
    </button>
    <button class="tab-btn" onclick="switchSample(3, this)">
      <span>Thu 10:00</span>
      <span class="pill" style="color: #10b981;">The Resident</span>
      <strong>Host & Driver Brief (Business)</strong>
    </button>
    <button class="tab-btn" onclick="switchSample(4, this)">
      <span>Thu 14:00</span>
      <span class="pill" style="color: #22c55e;">The Resident</span>
      <strong>Weekend Lock-In Pass (Consumer)</strong>
    </button>
  </nav>

  <main class="content-area">
    <div class="preview-frame-wrapper" id="frameWrapper">
      <iframe id="previewIframe" src="sample-1-gruvs-vibe-radar.html" title="Email Preview"></iframe>
    </div>
  </main>

  <script>
    const sampleUrls = [
      'sample-1-gruvs-vibe-radar.html',
      'sample-2-gruvs-merchant-intel.html',
      'sample-3-excellency-craft.html',
      'sample-4-resident-host-driver.html',
      'sample-5-resident-lock-in.html'
    ];

    function switchSample(index, btn) {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('previewIframe').src = sampleUrls[index];
    }

    function setDevice(type) {
      const wrapper = document.getElementById('frameWrapper');
      const btnDesk = document.getElementById('btn-desktop');
      const btnMob = document.getElementById('btn-mobile');
      if (type === 'mobile') {
        wrapper.classList.add('mobile');
        btnMob.classList.add('active');
        btnDesk.classList.remove('active');
      } else {
        wrapper.classList.remove('mobile');
        btnDesk.classList.add('active');
        btnMob.classList.remove('active');
      }
    }
  </script>
</body>
</html>`;

  fs.writeFileSync(path.join(distDir, 'index.html'), showcaseHtml, 'utf8');
  console.log('✔ Written master interactive index: dist/email-previews/index.html');
  console.log('✨ All 5 email samples generated successfully!');
}

run().catch(console.error);
