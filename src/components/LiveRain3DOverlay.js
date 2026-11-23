/**
 * LiveRain3DOverlay — Live atmospheric 3D rainfall simulation over the Map.
 *
 * Renders 60fps hardware-accelerated volumetric rain streaks, ground impact
 * splash ripples, and ambient storm mist across all basemap styles and themes.
 * Runs with pointerEvents: none so all map pinch/pan/tap gestures remain 100% interactive.
 */
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Platform } from 'react-native';

export function LiveRain3DOverlay() {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId;
    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth || window.innerWidth;
      height = canvas.height = canvas.parentElement.clientHeight || window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Initialize 3D rain streaks with depth perspective
    const DROP_COUNT = 90;
    const drops = Array.from({ length: DROP_COUNT }).map(() => ({
      x: Math.random() * width * 1.3 - width * 0.15,
      y: Math.random() * height,
      z: Math.random() * 0.7 + 0.3, // Depth tier (0.3 background -> 1.0 foreground)
      len: 12 + Math.random() * 18,
      speed: 14 + Math.random() * 12,
      opacity: 0.2 + Math.random() * 0.35,
    }));

    // Splash ripples on ground
    const splashes = [];

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // 1. Ambient Storm Vignette / Atmospheric Fog
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, 'rgba(10, 25, 45, 0.18)');
      grad.addColorStop(0.5, 'rgba(15, 35, 55, 0.08)');
      grad.addColorStop(1, 'rgba(5, 15, 25, 0.25)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // 2. Animated Rain Streaks (slanted by wind: -12deg)
      const windAngle = -0.22;
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = 'rgba(175, 215, 255, 0.65)';
      ctx.lineCap = 'round';

      ctx.beginPath();
      for (let i = 0; i < drops.length; i++) {
        const d = drops[i];
        const streakX = Math.sin(windAngle) * (d.len * d.z);
        const streakY = Math.cos(windAngle) * (d.len * d.z);

        ctx.strokeStyle = `rgba(180, 225, 255, ${d.opacity * d.z})`;
        ctx.lineWidth = 1.0 * d.z;
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + streakX, d.y + streakY);

        d.x += Math.sin(windAngle) * d.speed * d.z;
        d.y += Math.cos(windAngle) * d.speed * d.z;

        // Ground collision & recycle
        if (d.y > height - 10) {
          if (Math.random() > 0.4 && splashes.length < 35) {
            splashes.push({
              x: d.x,
              y: d.y,
              radius: 1,
              maxRadius: 6 + Math.random() * 8,
              opacity: 0.5 * d.z,
            });
          }
          d.y = -20 - Math.random() * 30;
          d.x = Math.random() * width * 1.3 - width * 0.15;
        }
      }
      ctx.stroke();

      // 3. Ground Impact Splash Ripples
      for (let i = splashes.length - 1; i >= 0; i--) {
        const s = splashes[i];
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, s.radius * 1.6, s.radius * 0.7, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(180, 230, 255, ${s.opacity})`;
        ctx.lineWidth = 0.9;
        ctx.stroke();

        s.radius += 0.45;
        s.opacity *= 0.88;

        if (s.opacity <= 0.05 || s.radius >= s.maxRadius) {
          splashes.splice(i, 1);
        }
      }

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  if (Platform.OS !== 'web') return null;

  return (
    <View pointerEvents="none" style={styles.overlay}>
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 25,
    pointerEvents: 'none',
  },
});
