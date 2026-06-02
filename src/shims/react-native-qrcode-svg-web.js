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

// ── QR Canvas Renderer ───────────────────────────────────────────────────────
const QRCanvas = ({ value, size, fgColor, bgColor }) => {
  const canvasRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!canvasRef.current || !value) return;
    let cancelled = false;

    const render = async () => {
      try {
        const QRCode = (await import('qrcode')).default || (await import('qrcode'));
        if (cancelled || !canvasRef.current) return;
        await QRCode.toCanvas(canvasRef.current, value, {
          width: size * 2,      // 2× for retina sharpness
          margin: 1,
          color: {
            dark: fgColor  || '#000000ff',
            light: bgColor || '#ffffffff',
          },
          errorCorrectionLevel: 'M',
        });
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
}) => {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return null;
  if (!value) return null;

  return (
    <View style={[w.card, { width: size + 40 }]}>
      {/* Optional caption */}
      {label ? (
        <Text style={w.label}>{label}</Text>
      ) : null}

      {/* QR code canvas */}
      <View style={[w.qrWrap, { width: size + 12, height: size + 12 }]}>
        <QRCanvas
          value={value}
          size={size}
          fgColor={color}
          bgColor={backgroundColor}
        />
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
        <View style={w.brandDot} />
        <Text style={w.brandText}>GRUV</Text>
        <View style={w.brandDot} />
      </View>
    </View>
  );
};

const w = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    // Rich shadow
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.07)',
  },
  label: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2.5,
    color: '#666',
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
    marginTop: 8,
  },
  brandDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#00d4ff',
  },
  brandText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 3,
    color: '#aaa',
  },
});

export default QRCodeWeb;
