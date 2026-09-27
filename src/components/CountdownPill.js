/**
 * CountdownPill — "In 3 days" / "Tonight — in 4h" / "Live now".
 *
 * So nobody has to do date maths in their head. Ticks once a minute (day- and
 * hour-granularity is all that ever changes), and only while the screen is
 * mounted — no timers left running.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text } from 'react-native';
import { countdown } from '../utils/countdown';

export const CountdownPill = ({ event, primary = '#22d3ee', muted = '#94a3b8', compact = false, style }) => {
  const [, tick] = useState(0);

  // Re-render every minute so "In 30 min" stays honest.
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const c = useMemo(() => countdown(event), [event, /* eslint-disable-line */ tick]);
  if (!c.label || c.state === 'unknown') return null;

  const tone =
    c.state === 'live' ? { bg: 'rgba(239,68,68,0.15)', fg: '#ef4444' } :
    c.state === 'past' ? { bg: 'rgba(148,163,184,0.12)', fg: muted } :
    c.state === 'today' || c.state === 'tomorrow' ? { bg: `${primary}22`, fg: primary } :
    { bg: 'rgba(148,163,184,0.12)', fg: muted };

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`Starts ${c.label}`}
      style={[{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: compact ? 7 : 9,
        paddingVertical: compact ? 3 : 4,
        borderRadius: 999,
        backgroundColor: tone.bg,
      }, style]}
    >
      {c.state === 'live' && (
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tone.fg }} />
      )}
      <Text style={{ color: tone.fg, fontSize: compact ? 10.5 : 11.5, fontWeight: '800' }}>
        {c.label}
      </Text>
    </View>
  );
};

export default CountdownPill;
