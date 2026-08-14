/**
 * EmptyState — one consistent, on-brand "nothing here yet" block.
 *
 * Replaces the scattered ad-hoc empty placeholders across screens with a single
 * polished component: a glowing icon medallion, a clear title, a friendly line,
 * and an optional call-to-action. Theme-aware (reads primary/text/muted), so it
 * always matches the user's aura.
 *
 *   <EmptyState icon="calendar" title="No events yet"
 *               subtitle="Be the first to drop a Gruv here."
 *               actionLabel="Post a Gruv" onAction={openCreate} />
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTheme } from '../context/ThemeContext';

export const EmptyState = ({
  icon = 'inbox',
  emoji,
  title,
  subtitle,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  compact = false,
  style,
}) => {
  const { currentTheme } = useTheme();
  const primary = currentTheme?.primary || '#00f2ff';
  const textColor = currentTheme?.text || '#fff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';

  return (
    <View style={[s.wrap, compact && s.wrapCompact, style]}>
      <View style={[s.medallion, compact && s.medallionCompact, { backgroundColor: `${primary}12`, borderColor: `${primary}25` }]}>
        {emoji
          ? <Text style={{ fontSize: compact ? 26 : 34 }}>{emoji}</Text>
          : <Feather name={icon} size={compact ? 24 : 32} color={primary} />}
        <View style={[s.glow, { backgroundColor: primary }]} pointerEvents="none" />
      </View>

      {!!title && <Text style={[s.title, compact && s.titleCompact, { color: textColor }]}>{title}</Text>}
      {!!subtitle && <Text style={[s.subtitle, { color: muted }]}>{subtitle}</Text>}

      {!!actionLabel && !!onAction && (
        <TouchableOpacity onPress={onAction} activeOpacity={0.85} style={[s.btn, { backgroundColor: primary }]}>
          <Text style={[s.btnText, { color: '#000' }]}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
      {!!secondaryLabel && !!onSecondary && (
        <TouchableOpacity onPress={onSecondary} activeOpacity={0.8} style={[s.btnGhost, { borderColor: `${primary}50` }]}>
          <Text style={[s.btnText, { color: primary }]}>{secondaryLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, paddingHorizontal: 36 },
  wrapCompact: { paddingVertical: 28, paddingHorizontal: 28 },
  medallion: { width: 96, height: 96, borderRadius: 48, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginBottom: 20, position: 'relative' },
  medallionCompact: { width: 70, height: 70, borderRadius: 35, marginBottom: 14 },
  glow: { position: 'absolute', width: 64, height: 64, borderRadius: 32, opacity: 0.12, shadowColor: '#fff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 20, elevation: 10 },
  title: { fontSize: 19, fontWeight: '900', marginBottom: 8, textAlign: 'center' },
  titleCompact: { fontSize: 16 },
  subtitle: { fontSize: 13.5, textAlign: 'center', lineHeight: 20, maxWidth: 320 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 26, paddingVertical: 13, borderRadius: 28, marginTop: 22 },
  btnGhost: { paddingHorizontal: 24, paddingVertical: 11, borderRadius: 28, borderWidth: 1.5, marginTop: 12 },
  btnText: { fontWeight: '900', fontSize: 13.5, letterSpacing: 0.4 },
});

export default EmptyState;
