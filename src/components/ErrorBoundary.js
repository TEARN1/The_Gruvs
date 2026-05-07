import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.log('[ErrorBoundary]', error.message, info.componentStack?.slice(0, 200));
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (!this.state.hasError) return this.props.children;

    const primary = this.props.primary || '#00f2ff';
    const label   = this.props.label   || 'This section';

    return (
      <View style={[s.wrap, this.props.style]}>
        <Feather name="alert-triangle" size={28} color={primary} />
        <Text style={[s.title, { color: '#fff' }]}>{label} hit a snag</Text>
        <Text style={[s.sub, { color: 'rgba(255,255,255,0.45)' }]}>
          {this.state.error?.message || 'Something went wrong'}
        </Text>
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
});
