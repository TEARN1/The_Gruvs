import { View, StyleSheet, Platform } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { DURATION } from '../constants/DesignTokens';

export const GlassView = ({ children, style, intensity = 1, glow = false }) => {
  const { currentTheme } = useTheme();
  const isWeb = Platform.OS === 'web';

  if (!currentTheme) return <View style={style}>{children}</View>;

  const glowStyle = glow
    ? {
        shadowColor: currentTheme.glowColor || currentTheme.primary || '#00f2ff',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.35 * intensity,
        shadowRadius: 18,
        elevation: 12,
        ...(isWeb ? { boxShadow: `0 0 25px ${currentTheme.glowColor || currentTheme.primary || '#00f2ff'}60` } : {}),
      }
    : {
        shadowColor: currentTheme.shadowColor || '#000',
        shadowOffset: currentTheme.shadowOffset || { width: 0, height: 8 },
        shadowOpacity: (currentTheme.shadowOpacity || 0.4) * intensity,
        shadowRadius: currentTheme.shadowRadius || 12,
        elevation: 8,
        ...(isWeb ? { boxShadow: '0 8px 32px rgba(0,0,0,0.3)' } : {}),
      };

  return (
    // Items 76-77: will-change + className for GPU promotion and CSS transparency rule
    <View
      style={[
        styles.glass,
        {
          backgroundColor: currentTheme.backgroundColor || 'rgba(255,255,255,0.07)',
          borderColor: currentTheme.borderColor || 'rgba(255,255,255,0.15)',
          borderRadius: currentTheme.borderRadius || 18,
          borderWidth: currentTheme.borderWidth || 1,
          ...glowStyle,
          ...(isWeb ? {
            willChange: 'transform',
            transition: `box-shadow ${DURATION.fast}ms ease`,
          } : {}),
        },
        style,
      ]}
      {...(isWeb ? { className: 'glass-view' } : {})}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  glass: {
    overflow: 'hidden',
  },
});
