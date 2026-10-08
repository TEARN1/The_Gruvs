/**
 * webFx — the app's motion + glass layer for the web build, in plain CSS.
 *
 * Why CSS: react-native-web has no native driver, so every Animated value is
 * stepped in JavaScript and re-renders its component each frame. A handful of
 * those loops once pinned the CPU and made the app feel slow. CSS animations of
 * transform/opacity run on the compositor instead: smooth on mid-range phones
 * and free for the JS thread.
 *
 * Use:
 *   <View {...fx('glass rise', 2)} />   →  data-fx="glass rise" data-fx-i="2"
 *
 * Effects (combine with spaces):
 *   rise     fade + lift in when mounted (staggered by the index)
 *   reveal   same, but plays as the element scrolls into view (feed cards).
 *            Visible by default: FadeInView only hides it after checking it is
 *            below the screen, so a browser quirk can never leave it invisible.
 *   glass    frosted blur + gloss + light-catching rim
 *   rim      just the light-catching rim (cheap: no blur, for long lists)
 *   lift     hover lift on desktop
 *   float    slow idle bob (icons)
 *   sheen    a light sweep across (primary buttons)
 *   aurora   a soft glow drifting behind the content (hero cards)
 *   pulse    a ring breathing out from the element (the + button)
 *   beat     a small dot that throbs (live indicators)
 *
 * Map: .gx-radar (utils/mapMotion.js) — sonar sweep + pings around you.
 *
 * Global, no tagging needed:
 *   - every button/tab springs when pressed (scaled to its size)
 *   - a tab's screen fades/lifts in when you switch to it
 *   - the active nav icon pops
 *   - whatever is behind a pop-up (modal) is frosted
 * Everything that moves is off for people who ask for reduced motion.
 * Native ignores all of this: fx() returns {} there.
 */
import { Platform } from 'react-native';

const IS_WEB = Platform.OS === 'web';

export function fx(names, index) {
  if (!IS_WEB) return {};
  const dataSet = { fx: names };
  if (index != null) dataSet.fxI = String(Math.max(0, Math.min(11, index | 0)));
  return { dataSet };
}

const EASE_OUT = 'cubic-bezier(.2,.8,.2,1)';
const SPRING = 'cubic-bezier(.34,1.56,.64,1)';

const stagger = Array.from({ length: 12 }, (_, i) => `[data-fx-i="${i}"]{--gx-i:${i}}`).join('');

export const FX_CSS = `
@keyframes gx-rise{from{opacity:0;transform:translate3d(0,16px,0) scale(.985)}to{opacity:1;transform:none}}
@keyframes gx-screen{from{opacity:0;transform:translate3d(0,8px,0)}to{opacity:1;transform:none}}
@keyframes gx-pop{0%{transform:scale(1)}35%{transform:scale(1.24)}65%{transform:scale(.94)}100%{transform:scale(1)}}
@keyframes gx-float{from{transform:translate3d(0,0,0)}to{transform:translate3d(0,-4px,0)}}
@keyframes gx-sheen{0%{transform:translate3d(-130%,0,0) skewX(-20deg)}55%,100%{transform:translate3d(330%,0,0) skewX(-20deg)}}
@keyframes gx-ring{0%{transform:scale(1);opacity:.6}80%,100%{transform:scale(1.65);opacity:0}}
@keyframes gx-drift{from{transform:translate3d(-18%,-8%,0) scale(1)}to{transform:translate3d(18%,10%,0) scale(1.15)}}
@keyframes gx-like{0%{transform:scale(1)}20%{transform:scale(.7) rotate(-12deg)}55%{transform:scale(1.5) rotate(8deg)}80%{transform:scale(.92) rotate(-3deg)}100%{transform:scale(1)}}
@keyframes gx-unlike{0%{transform:scale(1)}40%{transform:scale(.72)}100%{transform:scale(1)}}
@keyframes gx-flip{0%{transform:perspective(500px) rotateX(0)}35%{transform:perspective(500px) rotateX(-55deg) scale(1.08)}100%{transform:perspective(500px) rotateX(0)}}
@keyframes gx-orb-in{0%{opacity:0;transform:translate3d(0,10px,0) scale(.3)}65%{opacity:1;transform:translate3d(0,-2px,0) scale(1.12)}100%{opacity:1;transform:none}}
@keyframes gx-spin{to{transform:rotate(360deg)}}
@keyframes gx-sonar{0%{transform:scale(.04);opacity:.85}70%{opacity:.25}100%{transform:scale(1);opacity:0}}
@keyframes gx-beat{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.9);opacity:.15}}
@keyframes gx-tick-up{from{opacity:0;transform:translate3d(0,70%,0)}to{opacity:1;transform:none}}
@keyframes gx-tick-down{from{opacity:0;transform:translate3d(0,-70%,0)}to{opacity:1;transform:none}}
${stagger}

[data-fx~="glass"]{-webkit-backdrop-filter:blur(18px) saturate(170%);backdrop-filter:blur(18px) saturate(170%);background-image:linear-gradient(180deg,rgba(255,255,255,.10),rgba(255,255,255,0) 55%)}
[data-fx~="glass"],[data-fx~="rim"],[data-fx~="aurora"]{isolation:isolate}
[data-fx~="glass"]::before,[data-fx~="rim"]::before{content:"";position:absolute;inset:0;border-radius:inherit;padding:1px;pointer-events:none;
  background:linear-gradient(140deg,rgba(255,255,255,.55),rgba(255,255,255,.08) 30%,rgba(255,255,255,0) 58%,rgba(255,255,255,.2));
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}
[data-fx~="aurora"],[data-fx~="sheen"]{overflow:hidden}
/* maplibre-gl.css isn't loaded (see LiveMap.js), so give DOM markers the one rule they need. */
.maplibregl-marker{position:absolute;top:0;left:0;will-change:transform}
.gx-radar{border-radius:50%;pointer-events:none}
.gx-radar-sweep{position:absolute;inset:0;border-radius:50%;display:none;
  background:conic-gradient(from 0deg,transparent 0deg 285deg,var(--gx-radar-soft) 318deg,var(--gx-radar-strong) 359deg,transparent 360deg)}
.gx-radar-ping{position:absolute;inset:0;border-radius:50%;display:none;border:2px solid var(--gx-radar-line);opacity:0}
.gx-hotspot{pointer-events:none;--gx-hot:rgba(0,242,255,.85)}
.gx-hotspot[data-kind="live"]{--gx-hot:rgba(16,185,129,.95)}
.gx-hotspot[data-kind="hot"]{--gx-hot:rgba(245,158,11,.95)}
.gx-hotspot>i{position:absolute;inset:0;border-radius:50%;border:2px solid var(--gx-hot);opacity:0;display:none}
[aria-modal="true"]{-webkit-backdrop-filter:blur(6px) saturate(140%);backdrop-filter:blur(6px) saturate(140%)}
[data-fx~="aurora"]::after{content:"";position:absolute;left:-25%;top:-60%;width:150%;height:220%;z-index:-1;pointer-events:none;
  background:radial-gradient(closest-side,var(--color-glow,#00f2ff),transparent 70%);opacity:.22}
[data-fx~="sheen"]::after{content:"";position:absolute;top:0;bottom:0;left:0;width:38%;pointer-events:none;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.55),transparent);transform:translate3d(-130%,0,0)}
[data-fx~="pulse"]::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;
  border:2px solid var(--color-primary,#00f2ff);opacity:0}

@media (prefers-reduced-motion:no-preference){
  button,[role="button"],[role="tab"],[tabindex="0"]{transition-property:opacity,background-color,border-color,box-shadow!important;transition-duration:.22s!important;transition-timing-function:ease!important}
  [data-gx-press]{transform:scale(var(--gx-ps,.96))!important;transition:transform 90ms ease-out!important}
  [data-gx-rel]{transition:transform 460ms ${SPRING}!important}
  [data-screen][data-active="true"]{animation:gx-screen .24s ${EASE_OUT} backwards}
  [role="tab"][aria-selected="true"]>div:first-child{animation:gx-pop .5s ${SPRING}}
  [data-fx~="rise"]{animation:gx-rise .45s ${EASE_OUT} backwards;animation-delay:calc(var(--gx-i,0) * 55ms)}
  [data-fx~="reveal"]{transition:opacity .45s ease,transform .55s ${EASE_OUT}}
  [data-gx-wait]{opacity:0;transform:translate3d(0,26px,0) scale(.97)}
  [data-gx-play="pop"]{animation:gx-pop .45s ${SPRING}}
  [data-gx-play="like"]{animation:gx-like .6s ${SPRING}}
  [data-gx-play="unlike"]{animation:gx-unlike .3s ease-out}
  [data-gx-play="flip"]{animation:gx-flip .5s ${SPRING}}
  [data-fx~="orb"]{animation:gx-orb-in .42s ${SPRING} backwards;animation-delay:calc(var(--gx-i,0) * 35ms);transition:transform .3s ${SPRING}}
  [data-fx~="orb"][data-active="true"]{transform:scale(1.18)}
  .gx-radar-sweep{display:block;animation:gx-spin 4.8s linear infinite}
  .gx-radar-ping{display:block;animation:gx-sonar 3.6s cubic-bezier(.2,.6,.3,1) infinite}
  .gx-radar-ping:nth-child(3){animation-delay:1.2s}
  .gx-radar-ping:nth-child(4){animation-delay:2.4s}
  .gx-hotspot>i{display:block;animation:gx-sonar 2.6s cubic-bezier(.2,.6,.3,1) infinite}
  .gx-hotspot>i:nth-child(2){animation-delay:1.3s}
  .gx-hotspot[data-kind="live"]>i{animation-duration:1.7s}
  .gx-hotspot[data-kind="live"]>i:nth-child(2){animation-delay:.85s}
  [data-fx~="beat"]{animation:gx-beat 1.6s ease-in-out infinite}
  [data-fx~="tick-up"]{display:inline-block;animation:gx-tick-up .32s ${EASE_OUT}}
  [data-fx~="tick-down"]{display:inline-block;animation:gx-tick-down .32s ${EASE_OUT}}
  [data-fx~="float"]{animation:gx-float 2.6s ease-in-out infinite alternate;animation-delay:calc(var(--gx-i,0) * -400ms)}
  [data-fx~="sheen"]::after{animation:gx-sheen 4.2s ease-in-out 1.2s infinite}
  [data-fx~="aurora"]::after{animation:gx-drift 9s ease-in-out infinite alternate}
  [data-fx~="pulse"]::after{animation:gx-ring 2.6s ${EASE_OUT} infinite}
  @media (hover:hover){
    [data-fx~="lift"]{transition:transform .25s ${EASE_OUT},box-shadow .25s ${EASE_OUT},opacity .22s,background-color .22s,border-color .22s!important}
    [data-fx~="lift"]:hover{transform:translate3d(0,-3px,0);box-shadow:0 14px 34px rgba(0,0,0,.28)}
  }
}
`;

const PRESSABLE = 'button,a[href],[role="button"],[role="tab"],[role="link"],[role="checkbox"],[role="switch"],[tabindex="0"]';

// Springy press for every tappable thing, by event delegation (no per-button
// code). Scaled to the element's size so a big card dips a little and a small
// icon button squishes more. Skips full-screen layers (modal backdrops) and
// anything already transformed by its own animation.
function installPress() {
  let held = null;
  const timers = new WeakMap();
  const release = () => {
    const el = held;
    if (!el) return;
    held = null;
    el.removeAttribute('data-gx-press');
    el.setAttribute('data-gx-rel', '');
    clearTimeout(timers.get(el));
    timers.set(el, setTimeout(() => el.removeAttribute('data-gx-rel'), 480));
  };
  document.addEventListener('pointerdown', (ev) => {
    if (ev.button > 0) return;
    const el = ev.target instanceof Element ? ev.target.closest(PRESSABLE) : null;
    if (!el || el.getAttribute('aria-disabled') === 'true' || el.style.transform) return;
    const r = el.getBoundingClientRect();
    if (r.width * r.height > window.innerWidth * window.innerHeight * 0.45) return;
    const size = Math.max(r.width, r.height);
    el.style.setProperty('--gx-ps', size < 64 ? '0.88' : size < 180 ? '0.95' : '0.985');
    el.removeAttribute('data-gx-rel');
    el.setAttribute('data-gx-press', '');
    held = el;
  }, { capture: true, passive: true });
  for (const type of ['pointerup', 'pointercancel', 'dragstart']) {
    document.addEventListener(type, release, { capture: true, passive: true });
  }
  window.addEventListener('blur', release);
}

// Restart a one-shot animation (pop, like, flip) on an element. Removing and
// re-adding the attribute with a reflow in between replays it every time.
export function replay(el, name) {
  if (!IS_WEB || !el || typeof el.setAttribute !== 'function') return;
  el.removeAttribute('data-gx-play');
  void el.offsetWidth;
  el.setAttribute('data-gx-play', name);
}

export function installWebFx() {
  if (!IS_WEB || typeof document === 'undefined' || document.getElementById('gruvs-fx')) return;
  const style = document.createElement('style');
  style.id = 'gruvs-fx';
  style.textContent = FX_CSS;
  document.head.appendChild(style);
  installPress();
}
