import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { SecurityService } from '../services/securityService';
import { logError } from '../utils/logError';
import { classify, RECOVERY_FOR_KIND, Recovery, FailureKind } from '../utils/failureClassifier';
import { checkForNewVersion } from '../hooks/useWebAppUpdate';
import { recordCriticalCrash } from '../utils/bootGuard';

// Show developer detail (raw message + component stack) ONLY in dev. In
// production a user must never see "friendsGoing is not defined" — that reads
// like a broken app. The detail still goes to telemetry + Crashlytics.
const IS_DEV = typeof __DEV__ !== 'undefined' && __DEV__;

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false, error: null, componentStack: null,
      retryCount: 0, remountKey: 0, kind: null, checkingVersion: false,
    };
    this._autoRetryTimer = null;
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentWillUnmount() {
    if (this._autoRetryTimer) clearTimeout(this._autoRetryTimer);
  }

  componentDidCatch(error, info) {
    // lazyBoundary is set explicitly by call sites that wrap a Suspense/lazy
    // region — the reliable signal for "this is probably a chunk load," not
    // a guessed bundler error string (this project builds web with Metro,
    // not Webpack, so "Loading chunk N failed"-style detection is wrong here).
    const kind = classify(error, { lazyBoundary: !!this.props.lazyBoundary });
    const recovery = RECOVERY_FOR_KIND[kind];

    console.error('[ErrorBoundary] Caught in:', this.props.label || 'unknown', `[${kind}]`);
    console.error(error?.message || error);
    console.error('[ComponentStack]', info?.componentStack);
    this.setState({ componentStack: info?.componentStack, kind });

    if (this.props.critical) {
      // Feeds the boot-time circuit breaker (bootGuard.js) — a shell-level
      // crash is the strongest signal something is systemically wrong, and
      // this is the one write path both the in-session escalation below and
      // the pre-mount boot guard read from.
      recordCriticalCrash();
    }

    // ── Taxonomy-driven recovery — see failureClassifier.js ──────────────────
    if (recovery === Recovery.RELOAD && kind === FailureKind.CHUNK_LOAD) {
      // React.lazy() caches a REJECTED import promise forever — retrying via
      // setState can never re-invoke import(), so auto-retry is not just
      // useless here, it actively wastes 900ms before showing the user
      // anything. Confirm first: if this really is a stale bundle, reload
      // automatically — no reason to make the user tap a button when we
      // already know the fix. If it's NOT a version mismatch (a genuine
      // network blip, an ad-blocker), fall through to the calm fallback UI
      // instead of reloading blind.
      this.setState({ checkingVersion: true });
      checkForNewVersion().then((stale) => {
        if (stale) {
          this.reload();
        } else {
          this.setState({ checkingVersion: false, kind: FailureKind.UNKNOWN });
        }
      });
      return;
    }

    if (recovery === Recovery.REAUTH) {
      // A session-expired error should never look like a broken section —
      // no retry, no remount, just tell the user plainly (render() branches
      // on kind === AUTH_EXPIRED for this instead of the generic copy).
      this._report(error, info, kind);
      return;
    }

    if (recovery === Recovery.ABORT) {
      // Bad input / permission — retrying is pointless and just delays the
      // user seeing the (calm, generic) message.
      this._report(error, info, kind);
      return;
    }

    // RETRY / FALLBACK / UNKNOWN: existing graduated behavior.
    //   1st catch  → silent auto-retry (a render race or a slow chunk often
    //                just needs a beat).
    //   2nd catch  → one more auto-retry, but this time force a full subtree
    //                REMOUNT (bump remountKey) — discards any bad local state
    //                a plain re-render can't clear. A genuinely different
    //                recovery strategy from tier 1, not just a repeat of it.
    //   3rd+ catch → stop retrying automatically, show the manual UI.
    if (this.state.retryCount === 0) {
      this._autoRetryTimer = setTimeout(() => {
        this.setState((st) => ({ hasError: false, error: null, componentStack: null, retryCount: st.retryCount + 1 }));
      }, 900);
    } else if (this.state.retryCount === 1) {
      this._autoRetryTimer = setTimeout(() => {
        this.setState((st) => ({
          hasError: false, error: null, componentStack: null,
          retryCount: st.retryCount + 1, remountKey: st.remountKey + 1,
        }));
      }, 900);
    }
    // retryCount >= 2: no timer — falls through to the manual fallback UI.

    this._report(error, info, kind);
  }

  _report(error, info, kind) {
    SecurityService.logSecurityEvent(null, 'UI_CRASH', {
      label: this.props.label || 'unknown',
      message: error?.message || String(error),
    });
    // Surface UI crashes to our own telemetry (readable via Supabase MCP).
    // `kind` rides along in the label so client_errors is groupable by
    // failure taxonomy (see the Resilience panel in GodViewDashboard).
    logError(`UI:${this.props.label || 'unknown'}:${kind || 'UNKNOWN'}`, error);
    // Ship the full stack to Firebase Crashlytics in production builds. Guarded
    // require: if the native module isn't installed (Expo Go / web / dev) this is
    // a silent no-op, so the boundary still works everywhere.
    try {
      const mod = require('@react-native-firebase/crashlytics');
      const crashlytics = mod.default ? mod.default() : mod();
      crashlytics.setAttributes({ boundary: this.props.label || 'unknown', kind: kind || 'UNKNOWN' });
      crashlytics.log(`UI crash @ ${this.props.label || 'unknown'} [${kind}]: ${info?.componentStack || ''}`.slice(0, 4000));
      crashlytics.recordError(error instanceof Error ? error : new Error(String(error)));
    } catch { /* crashlytics not available in this environment — already logged above */ }
  }

  reset = () => this.setState({ hasError: false, error: null, componentStack: null, retryCount: 0, kind: null, checkingVersion: false });

  // On web, a hard reload pulls the freshest bundle from the server (the service
  // worker is network-first for HTML) — which is exactly what heals a crash
  // caused by a user running a stale build after a deploy.
  reload = () => {
    try {
      if (typeof window !== 'undefined' && window.location) window.location.reload();
      else this.reset();
    } catch { this.reset(); }
  };

  render() {
    if (!this.state.hasError) {
      // Fragment key bump forces a full subtree REMOUNT (fresh instances,
      // fresh hooks) on the second recovery attempt — Fragment adds no
      // DOM/View node, so it can't break flex-layout assumptions upstream.
      return <React.Fragment key={this.state.remountKey}>{this.props.children}</React.Fragment>;
    }

    // Still confirming whether this is a stale bundle — render nothing
    // (this check is typically <300ms; a flash of fallback UI that's about
    // to reload anyway would just be noise).
    if (this.state.checkingVersion) return null;

    const primary  = this.props.primary  || "#00f2ff";
    const label    = this.props.label    || 'This section';
    const inline   = this.props.inline   || false;
    const critical = this.props.critical || false;
    const kind     = this.state.kind;

    const onWeb = typeof window !== 'undefined' && !!window.location;

    if (kind === FailureKind.AUTH_EXPIRED) {
      const authProps = this.props.onAuthRequired ? { onPress: this.props.onAuthRequired } : { onPress: this.reload };
      return (
        <View style={[s.wrap, this.props.style]}>
          <Feather name="lock" size={26} color={primary} />
          <Text style={[s.title, { color: '#fff' }]}>Your session expired</Text>
          <Text style={[s.sub, { color: 'rgba(255,255,255,0.5)' }]}>Sign in again to keep going.</Text>
          <TouchableOpacity style={[s.btn, { borderColor: primary, marginTop: 6 }]} {...authProps}>
            <Feather name="log-in" size={13} color={primary} />
            <Text style={[s.btnText, { color: primary }]}>Sign in</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (inline) {
      return (
        <View style={[s.inlineWrap, this.props.style]}>
          <Feather name="alert-circle" size={13} color="#f59e0b" />
          <View style={{ flex: 1 }}>
            <Text style={s.inlineText}>{label} couldn't load</Text>
            {/* Raw error only in dev — never shown to a real user. */}
            {IS_DEV && this.state.error?.message ? (
              <Text style={[s.inlineText, { fontSize: 10, opacity: 0.6 }]} selectable numberOfLines={2}>
                {this.state.error.message}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity onPress={onWeb ? this.reload : this.reset} style={s.inlineBtn}>
            <Text style={s.inlineBtnText}>{onWeb ? 'Reload' : 'Retry'}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const title = critical ? 'The Gruvs hit a snag starting up' : `${label} needs a moment`;
    const sub = critical
      ? "This usually clears up with a reload. If it keeps happening, we've already been told."
      : "This bit didn't load right — everything else is working. Give it another go.";
    // A shell-level crash is more likely stale-bundle/global-state than a
    // transient render race — Reload is the button actually likely to help,
    // so it leads for `critical` boundaries (and for a chunk-load fallback
    // that fell through here because the version check came back negative).
    const reloadPrimary = critical || kind === FailureKind.CHUNK_LOAD;

    return (
      <View style={[s.wrap, this.props.style]}>
        <Feather name="refresh-cw" size={26} color={primary} />
        <Text style={[s.title, { color: '#fff' }]}>{title}</Text>
        <Text style={[s.sub, { color: 'rgba(255,255,255,0.5)' }]}>{sub}</Text>

        {/* Developer detail — DEV ONLY. In production users see a calm message,
            never a stack trace. The full error still went to our telemetry. */}
        {IS_DEV ? (
          <>
            <Text style={[s.sub, { color: '#f59e0b' }]} selectable>
              [{kind || 'UNKNOWN'}] {this.state.error?.message || String(this.state.error || '')}
            </Text>
            {this.state.componentStack ? (
              <Text style={[s.sub, { color: 'rgba(255,255,255,0.3)', fontSize: 10 }]} selectable numberOfLines={8}>
                {this.state.componentStack.trim()}
              </Text>
            ) : null}
          </>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
          {onWeb && reloadPrimary ? (
            <TouchableOpacity style={[s.btn, { borderColor: primary }]} onPress={this.reload}>
              <Feather name="download-cloud" size={13} color={primary} />
              <Text style={[s.btnText, { color: primary }]}>Reload app</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[s.btn, { borderColor: reloadPrimary ? 'rgba(255,255,255,0.25)' : primary }]}
            onPress={this.reset}
          >
            <Feather name="rotate-cw" size={13} color={reloadPrimary ? 'rgba(255,255,255,0.7)' : primary} />
            <Text style={[s.btnText, { color: reloadPrimary ? 'rgba(255,255,255,0.7)' : primary }]}>Try again</Text>
          </TouchableOpacity>
          {/* Reload pulls the freshest build — the cure for a stale-bundle crash. */}
          {onWeb && !reloadPrimary ? (
            <TouchableOpacity style={[s.btn, { borderColor: 'rgba(255,255,255,0.25)' }]} onPress={this.reload}>
              <Feather name="download-cloud" size={13} color="rgba(255,255,255,0.7)" />
              <Text style={[s.btnText, { color: 'rgba(255,255,255,0.7)' }]}>Reload app</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  }
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', padding: 30, gap: 10 },
  title: { fontSize: 15, fontWeight: '800', textAlign: 'center' },
  sub: { fontSize: 12, textAlign: 'center', lineHeight: 18 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20, borderWidth: 1, marginTop: 6 },
  btnText: { fontSize: 13, fontWeight: '700' },
  inlineWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 10, backgroundColor: 'rgba(245,158,11,0.08)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)', margin: 6 },
  inlineText: { color: 'rgba(255,255,255,0.6)', fontSize: 11, flex: 1 },
  inlineBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: 'rgba(245,158,11,0.2)' },
  inlineBtnText: { color: "#f59e0b", fontSize: 10, fontWeight: '800' },
});
