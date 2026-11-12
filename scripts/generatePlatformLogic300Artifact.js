import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PLATFORM_LOGIC_300, LOGIC_DOMAINS } from '../src/services/platformLogic300.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targetArtifactPath = 'C:\\Users\\ACER\\.gemini\\antigravity\\brain\\16cfe07f-63ac-441d-9bd8-e54e184c6d89\\platform_300_logics.md';

const domainNames = Object.values(LOGIC_DOMAINS);

// Map domains to their characteristic enforcing layer examples for context
const DOMAIN_ENFORCERS = {
  [LOGIC_DOMAINS.LIFECYCLE]: 'FeedManager, PostEventModal, EventChecker',
  [LOGIC_DOMAINS.TRUTH_PROTOCOL]: 'CheckInManager, SecurityService, ThreatPrevention',
  [LOGIC_DOMAINS.FEED_DISCOVERY]: 'ScoreEngine, FeedRanker, SearchRelevance',
  [LOGIC_DOMAINS.SOCIAL_RESONANCE]: 'VibeManager, EventReactions, ClubEngine',
  [LOGIC_DOMAINS.HUSTLER_MARKETPLACE]: 'HustlerService, EscrowManager, StripePayouts',
  [LOGIC_DOMAINS.TICKETING_SCARCITY]: 'TicketEngine, AntiScalping, WalletPass',
  [LOGIC_DOMAINS.SAFETY_EMERGENCY]: 'SafetyWatch, EmergencySOS, GeoBroadcast',
  [LOGIC_DOMAINS.VIBE_ECONOMY]: 'TokenLedger, SovereignGovernor, RoyalStatus',
  [LOGIC_DOMAINS.VIRAL_RETENTION]: 'NotificationService, PushGate, ViralLoop',
  [LOGIC_DOMAINS.INFRASTRUCTURE]: 'NativeCache, CDNEdge, DatabaseConnectionPool',
  [LOGIC_DOMAINS.AUDIO_ENGINEERING]: 'AudioDspEngine, LiveSoundboard, DecibelMonitor',
  [LOGIC_DOMAINS.RESIDENT_ACCOMMODATION]: 'ResidentStayManager, EscrowDeposit, KeylessPass',
  [LOGIC_DOMAINS.SPORTS_FAIR_PLAY]: 'TournamentBracketEngine, ScoreAudit, RefereeGate',
  [LOGIC_DOMAINS.KASI_FOOD_STREET]: 'KotaKitchenService, VendorHygiene, OrderQueue',
  [LOGIC_DOMAINS.CAR_SOUND_OFF]: 'SoundOffJudgeEngine, SPLSensor, StanceAudit',
  [LOGIC_DOMAINS.GAMIFICATION_STREAKS]: 'StreakRewardEngine, SceneLevelUp, BadgeLedger',
  [LOGIC_DOMAINS.IDENTITY_CLOAK]: 'CloakPrivacyFilter, GeoJitterEngine, ZeroKnowledgePass',
  [LOGIC_DOMAINS.CREATOR_STUDIO]: 'PosterAnalyticsEngine, FlyerOcrService, SplitSheetContract',
  [LOGIC_DOMAINS.CLUB_GOVERNANCE]: 'ClubCollectiveDao, QuorumAuditor, VotingLedger',
  [LOGIC_DOMAINS.ECOSYSTEM_SSO]: 'TriPillarSsoBridge, WebTelemetryBoundary, WebSocketHeartbeat',
};

let md = `# The Gruvs — 300 Master Platform Logics & Invariants\n\n`;
md += `This master catalog codifies the **300 production business rules, algorithmic formulas, and architectural state invariants** powering The Gruvs, The Resident Crew, and Excellency Academy unified ecosystem. These logics are programmatically enforced via \`src/services/platformLogic300.js\` and verified by \`__tests__/platformLogic300.test.js\`.\n\n`;
md += `### Architectural Overview & Domain Breakdown\n\n`;
md += `The 300 logics are partitioned across 20 specialized architectural domains, ensuring comprehensive coverage across live events, venue truth, high-performance edge infrastructure, community safety, audio engineering, and creator economics:\n\n`;
md += `| # | Architectural Domain | Range | Focus Area |\n`;
md += `| :--- | :--- | :--- | :--- |\n`;

domainNames.forEach((d, idx) => {
  const start = idx < 10 ? idx * 10 + 1 : 100 + (idx - 10) * 20 + 1;
  const end = idx < 10 ? (idx + 1) * 10 : 100 + (idx - 10 + 1) * 20;
  const enforcer = DOMAIN_ENFORCERS[d] || 'PlatformEngine';
  md += `| **${idx + 1}** | **${d}** | \`LOGIC_${String(start).padStart(3, '0')}\` – \`LOGIC_${String(end).padStart(3, '0')}\` | ${enforcer} |\n`;
});

md += `\n---\n\n`;

domainNames.forEach((domain, idx) => {
  const logics = PLATFORM_LOGIC_300.filter(l => l.domain === domain);
  const startNum = logics[0]?.id.replace('LOGIC_', '');
  const endNum = logics[logics.length - 1]?.id.replace('LOGIC_', '');
  const enforcer = DOMAIN_ENFORCERS[domain] || 'PlatformEngine';

  md += `## Domain ${idx + 1}: ${domain} (Logics ${startNum}–${endNum})\n\n`;
  md += `| ID | Title | Invariant & Rule | Enforcing Layer |\n`;
  md += `| :--- | :--- | :--- | :--- |\n`;

  logics.forEach(logic => {
    const num = logic.id.replace('LOGIC_', '');
    md += `| **${num}** | **${logic.title}** | \`${logic.invariant}\`. ${logic.rule} | \`${enforcer}\` |\n`;
  });

  md += `\n---\n\n`;
});

fs.writeFileSync(targetArtifactPath, md, 'utf8');
console.log(`Successfully generated 300 logics artifact at ${targetArtifactPath} (${PLATFORM_LOGIC_300.length} logics written)`);
