// Item 83: Ambient radial gradient aura for web, null on native and reduced-motion
import { Platform, View } from 'react-native';

const reducedMotion = () =>
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export const AuraEffect = ({ color = '#00f2ff', intensity = 0.18 }) => {
  if (Platform.OS !== 'web' || reducedMotion()) return null;

  const alpha = Math.min(intensity, 0.35);
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 0,
        overflow: 'hidden',
      }}
    >
      {/* Top-left blob */}
      <View style={{
        position: 'absolute',
        top: '-20%', left: '-20%',
        width: '70%', height: '70%',
        borderRadius: 9999,
        background: `radial-gradient(circle, ${color}${Math.round(alpha * 255).toString(16).padStart(2,'0')} 0%, transparent 70%)`,
      }} />
      {/* Bottom-right blob */}
      <View style={{
        position: 'absolute',
        bottom: '-20%', right: '-20%',
        width: '60%', height: '60%',
        borderRadius: 9999,
        background: `radial-gradient(circle, ${color}${Math.round(alpha * 0.6 * 255).toString(16).padStart(2,'0')} 0%, transparent 70%)`,
      }} />
    </View>
  );
};
