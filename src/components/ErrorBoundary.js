import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SecurityService } from '../services/securityService';
import { logError } from '../utils/logError';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Caught in:', this.props.label || 'unknown');
    console.error(error?.message || error);
    console.error('[ComponentStack]', info?.componentStack);
    this.setState({ componentStack: info?.componentStack });
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

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (!this.state.hasError) return this.props.children;

    const primary  = this.props.primary  || "#00f2ff";
    const label    = this.props.label    || 'This section';
    const inline   = this.props.inline   || false;

    if (inline) {
      return (
        <View style={[s.inlineWrap, this.props.style]}>
          <Feather name="alert-circle" size={13} color="#f59e0b" />
          <View style={{ flex: 1 }}>
            <Text style={s.inlineText}>{label} unavailable</Text>
            {this.state.error?.message ? (
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
        <Feather name="alert-triangle" size={28} color="#f59e0b" />
        <Text style={[s.title, { color: '#fff' }]}>{label} hit a snag</Text>
        <Text style={[s.sub, { color: 'rgba(255,255,255,0.45)' }]}>
          Something went wrong here. The rest of the app is still working.
        </Text>
        <Text style={[s.sub, { color: "#f59e0b" }]} selectable>
          {this.state.error?.message || String(this.state.error || '')}
        </Text>
        {this.state.componentStack ? (
          <Text style={[s.sub, { color: 'rgba(255,255,255,0.3)', fontSize: 10 }]} selectable numberOfLines={8}>
            {this.state.componentStack.trim()}
          </Text>
        ) : null}
        <TouchableOpacity style={[s.btn, { borderColor: primary }]} onPress={this.reset}>
          <Feather name="refresh-cw" size={13} color={primary} />
          <Text style={[s.btnText, { color: primary }]}>Try again</Text>
        </TouchableOpacity>
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
