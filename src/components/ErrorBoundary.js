import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SecurityService } from '../services/securityService';
import { logError } from '../utils/logError';

// Show developer detail (raw message + component stack) ONLY in dev. In
// production a user must never see "friendsGoing is not defined" — that reads
// like a broken app. The detail still goes to telemetry + Crashlytics.
const IS_DEV = typeof __DEV__ !== 'undefined' && __DEV__;

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: null, retryCount: 0 };
    this._autoRetryTimer = null;
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentWillUnmount() {
    if (this._autoRetryTimer) clearTimeout(this._autoRetryTimer);
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Caught in:', this.props.label || 'unknown');
    console.error(error?.message || error);
    console.error('[ComponentStack]', info?.componentStack);
    this.setState({ componentStack: info?.componentStack });

    // Self-heal: most section crashes are transient (a render race, a slow chunk).
    // Silently retry ONCE after a beat before ever bothering the user — if it was
    // transient they never see a thing; if it's deterministic it re-catches and we
    // show the calm fallback (no infinite loop — capped at one auto-retry).
    if (this.state.retryCount < 1) {
      this._autoRetryTimer = setTimeout(() => {
        this.setState((st) => ({ hasError: false, error: null, componentStack: null, retryCount: st.retryCount + 1 }));
      }, 900);
    }
    SecurityService.logSecurityEvent(null, 'UI_CRASH', {
      label: this.props.label || 'unknown',
      message: error?.message || String(error)
    });
    // Surface UI crashes to our own telemetry (readable via Supabase MCP).
    logError(`UI:${this.props.label || 'unknown'}`, error);
    // Ship the full stack to Firebase Crashlytics in production builds. Guarded
    // require: if the native module isn't installed (Expo Go / web / dev) this is
    // a silent no-op, so the boundary still works everywhere.
    try {
      const mod = require('@react-native-firebase/crashlytics');
      const crashlytics = mod.default ? mod.default() : mod();
      crashlytics.setAttributes({ boundary: this.props.label || 'unknown' });
      crashlytics.log(`UI crash @ ${this.props.label || 'unknown'}: ${info?.componentStack || ''}`.slice(0, 4000));
      crashlytics.recordError(error instanceof Error ? error : new Error(String(error)));
    } catch { /* crashlytics not available in this environment — already logged above */ }
  }

  reset = () => this.setState({ hasError: false, error: null, componentStack: null, retryCount: 0 });

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
    if (!this.state.hasError) return this.props.children;

    const primary  = this.props.primary  || "#00f2ff";
    const label    = this.props.label    || 'This section';
    const inline   = this.props.inline   || false;

    const onWeb = typeof window !== 'undefined' && !!window.location;

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
          <TouchableOpacity onPress={this.reset} style={s.inlineBtn}>
            <Text style={s.inlineBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={[s.wrap, this.props.style]}>
        <Feather name="refresh-cw" size={26} color={primary} />
        <Text style={[s.title, { color: '#fff' }]}>{label} needs a moment</Text>
        <Text style={[s.sub, { color: 'rgba(255,255,255,0.5)' }]}>
          This bit didn't load right — everything else is working. Give it another go.
        </Text>

        {/* Developer detail — DEV ONLY. In production users see a calm message,
            never a stack trace. The full error still went to our telemetry. */}
        {IS_DEV ? (
          <>
            <Text style={[s.sub, { color: '#f59e0b' }]} selectable>
              {this.state.error?.message || String(this.state.error || '')}
            </Text>
            {this.state.componentStack ? (
              <Text style={[s.sub, { color: 'rgba(255,255,255,0.3)', fontSize: 10 }]} selectable numberOfLines={8}>
                {this.state.componentStack.trim()}
              </Text>
            ) : null}
          </>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
          <TouchableOpacity style={[s.btn, { borderColor: primary }]} onPress={this.reset}>
            <Feather name="rotate-cw" size={13} color={primary} />
            <Text style={[s.btnText, { color: primary }]}>Try again</Text>
          </TouchableOpacity>
          {/* Reload pulls the freshest build — the cure for a stale-bundle crash. */}
          {onWeb ? (
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
