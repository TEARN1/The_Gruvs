import { View, StyleSheet, Platform } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { DURATION, GLASS } from '../constants/DesignTokens';

const IS_WEB = Platform.OS === 'web';

/**
 * GlassView — frosted "wet glass" surface.
 *
 * Pure-JS, cross-platform: on web it uses a real CSS backdrop-blur + gradient
 * sheen; on native it layers translucent fills + a top highlight to fake the
 * same look (no native blur dependency, so it ships over-the-air).
 *
 * Props:
 *   intensity — 0..1.4 multiplier for fill/sheen strength
 *   glow      — themed outer glow instead of a drop shadow
 *   sheen     — show the top "wet" highlight (default true)
 *   tint      — optional colour to tint the glass (defaults to white frost)
 */
export const GlassView = ({ children, style, intensity = 1, glow = false, sheen = true, tint }) => {
  const { currentTheme } = useTheme();
  if (!currentTheme) return <View style={style}>{children}</View>;

  const primary = currentTheme.primary || "#00f2ff";
  const radius = currentTheme.borderRadius || GLASS.radius;

  const depthStyle = glow
    ? {
        shadowColor: currentTheme.glowColor || primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4 * intensity,
        shadowRadius: 20,
        elevation: 12,
        ...(IS_WEB ? { boxShadow: `0 0 28px ${(currentTheme.glowColor || primary)}55, inset 0 1px 0 ${GLASS.borderBright}` } : {}),
      }
    : {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.4 * intensity,
        shadowRadius: 16,
        elevation: 8,
        ...(IS_WEB ? { boxShadow: `0 10px 34px rgba(0,0,0,0.32), inset 0 1px 0 ${GLASS.borderBright}` } : {}),
      };

  const baseFill = tint
    ? `${tint}14`
    : (intensity >= 1.1 ? GLASS.fillStrong : intensity <= 0.6 ? GLASS.fillFaint : GLASS.fill);

  return (
    <View
      style={[
        styles.glass,
        {
          backgroundColor: baseFill,
          borderColor: GLASS.border,
          borderRadius: radius,
          borderWidth: 1,
          ...depthStyle,
          ...(IS_WEB
            ? {
                backdropFilter: 'blur(18px) saturate(140%)',
                WebkitBackdropFilter: 'blur(18px) saturate(140%)',
                transition: `box-shadow ${DURATION.fast}ms ease, transform ${DURATION.fast}ms ease`,
                willChange: 'transform',
              }
            : {}),
        },
        style,
      ]}
      {...(IS_WEB ? { className: 'glass-view' } : {})}
    >
      {/* Top "wet" sheen highlight */}
      {sheen && (
        <View
          pointerEvents="none"
          style={[
            styles.sheen,
            { borderTopLeftRadius: radius, borderTopRightRadius: radius },
            IS_WEB
              ? { background: GLASS.sheenWeb, height: '55%' }
              : { backgroundColor: GLASS.sheenNative, height: '42%' },
          ]}
        />
      )}
      {/* Bright top hairline — catches the light like a glass edge */}
      <View pointerEvents="none" style={[styles.topEdge, { backgroundColor: GLASS.borderBright }]} />
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  glass: { overflow: 'hidden', position: 'relative' },
  sheen: { position: 'absolute', top: 0, left: 0, right: 0 },
  topEdge: { position: 'absolute', top: 0, left: '8%', right: '8%', height: 1, opacity: 0.5 },
});
