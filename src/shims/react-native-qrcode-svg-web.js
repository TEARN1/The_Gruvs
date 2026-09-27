/**
 * react-native-qrcode-svg — web shim
 *
 * Renders a real, scannable QR code on web using qrcode (canvas-based, no SVG needed).
 * Wraps the QR in a gorgeous branded card with username, GRUV branding, and subtle design.
 *
 * Props (compatible with react-native-qrcode-svg):
 *   value           {string}  — data to encode (required)
 *   size            {number}  — rendered size in px (default 140)
 *   color           {string}  — foreground (default '#000')
 *   backgroundColor {string}  — background (default '#fff')
 *   username        {string}  — (custom) shown below QR with @ prefix
 *   label           {string}  — (custom) caption above QR
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import QRCode from 'qrcode';

// ── QR Canvas Renderer ───────────────────────────────────────────────────────
const QRCanvas = ({ value, size, fgColor, bgColor, ecl = 'M' }) => {
  const canvasRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!canvasRef.current || !value) return;
    let cancelled = false;

    const render = async () => {
      try {
        if (cancelled || !canvasRef.current) return;
        await QRCode.toCanvas(canvasRef.current, value, {
          width: size * 2,      // 2× for retina sharpness
          margin: 1,
          color: {
            dark: fgColor  || '#000000ff',
            light: bgColor || '#ffffffff',
          },
          errorCorrectionLevel: ecl,
        });
        // QRCode.toCanvas force-sets canvas.style.width/height to the RETINA
        // pixel size (size*2), blowing the canvas out of its container so only
        // the top-left quarter shows. Re-assert the display size after render.
        if (canvasRef.current) {
          canvasRef.current.style.width = `${size}px`;
          canvasRef.current.style.height = `${size}px`;
        }
        if (!cancelled) setReady(true);
      } catch (err) {
        console.warn('[QRCodeWeb] qrcode render failed:', err);
      }
    };

    render();
    return () => { cancelled = true; };
  }, [value, size, fgColor, bgColor]);

  if (typeof document === 'undefined') return null;   // SSR guard

  return (
    <canvas
      ref={canvasRef}
      width={size * 2}
      height={size * 2}
      style={{
        width: size,
        height: size,
        display: 'block',
        borderRadius: 8,
        opacity: ready ? 1 : 0.2,
        transition: 'opacity 0.3s ease',
      }}
    />
  );
};

// ── Main Component ───────────────────────────────────────────────────────────
const QRCodeWeb = ({
  value,
  size     = 140,
  color    = '#000',
  backgroundColor = '#fff',
  username,
  label,
  ecl = 'M',
  centerLabel,
  centerColor = '#00d4ff',
}) => {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return null;
  if (!value) return null;

  return (
    <View style={[w.card, { width: size + 44, borderColor: `${centerColor}55` }]}>
      {/* Accent halo behind the card top */}
      <View style={[w.halo, { backgroundColor: centerColor }]} pointerEvents="none" />

      {/* Caption */}
      <Text style={w.label}>{label || 'SCAN TO VIBE'}</Text>

      {/* QR code canvas */}
      <View style={[w.qrWrap, { width: size + 12, height: size + 12 }]}>
        <QRCanvas
          value={value}
          size={size}
          fgColor={color}
          bgColor={backgroundColor}
          ecl={ecl}
        />
        {/* Centre name plate — "name inside the QR" (ecl='H' keeps it scannable) */}
        {centerLabel ? (
          <View style={w.centerOverlay} pointerEvents="none">
            <View style={[w.centerPlate, { backgroundColor: centerColor }]}>
              <Text style={w.centerText} numberOfLines={1}>{centerLabel}</Text>
            </View>
          </View>
        ) : null}
      </View>

      {/* Username row */}
      {username ? (
        <View style={w.usernameRow}>
          <Text style={w.at}>@</Text>
          <Text style={w.username}>{username}</Text>
        </View>
      ) : null}

      {/* GRUV branding footer */}
      <View style={w.brandRow}>
        <View style={[w.brandLine, { backgroundColor: `${centerColor}66` }]} />
        <View style={[w.brandDot, { backgroundColor: centerColor }]} />
        <Text style={w.brandText}>THE GRUVS</Text>
        <View style={[w.brandDot, { backgroundColor: centerColor }]} />
        <View style={[w.brandLine, { backgroundColor: `${centerColor}66` }]} />
      </View>
    </View>
  );
};

const w = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    overflow: 'hidden',
    // Rich shadow
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 14,
    borderWidth: 1.5,
  },
  // Soft colour glow bleeding in from the top edge
  halo: {
    position: 'absolute',
    top: -70, left: '50%', marginLeft: -90,
    width: 180, height: 110, borderRadius: 90,
    opacity: 0.16,
  },
  label: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 3,
    color: '#555',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  qrWrap: {
    padding: 6,
    backgroundColor: '#fff',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  centerOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  centerPlate: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, borderWidth: 3, borderColor: '#fff', maxWidth: '62%' },
  centerText: { color: '#000', fontSize: 12, fontWeight: '900', letterSpacing: 0.3 },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 1,
  },
  at: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0ea5e9',
  },
  username: {
    fontSize: 14,
    fontWeight: '900',
    color: '#111',
    letterSpacing: 0.3,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 10,
  },
  brandLine: { width: 22, height: 1.5, borderRadius: 1 },
  brandDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  brandText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 3,
    color: '#888',
  },
});

export default QRCodeWeb;
