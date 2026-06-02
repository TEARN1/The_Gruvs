/**
 * MatchVersus — the "profile" of a competition match: two team crests with a
 * VS in the middle (e.g. Claude FC vs Gemini FC). Works whether or not the
 * teams have uploaded a logo — a missing crest falls back to a coloured initial
 * badge built from the team's name + colour, so a match always has a face.
 *
 * Pass a `match` shaped like { home: {name, logo_url, color}, away: {…} }.
 * Used as the cover on feed cards and as the header on a match's detail page.
 */
import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';

const initial = (name) => (name || '?').trim().charAt(0).toUpperCase() || '?';

const Crest = ({ team, size, isWeb }) => {
  const color = team?.color || team?.color1 || '#00f2ff';
  const logo = team?.logo_url || team?.logo;
  return (
    <View style={{ alignItems: 'center', maxWidth: size * 1.7 }}>
      {logo ? (
        <Image source={{ uri: logo }} style={[vs.crest, { width: size, height: size, borderRadius: size / 2, borderColor: color }]} />
      ) : (
        <View style={[vs.crest, vs.crestFallback, { width: size, height: size, borderRadius: size / 2, borderColor: color, backgroundColor: `${color}22` }]}>
          <Text style={{ color, fontWeight: '900', fontSize: size * 0.42 }}>{initial(team?.name)}</Text>
        </View>
      )}
    </View>
  );
};

export const MatchVersus = ({ match, height = 150, showNames = true, isWeb = false }) => {
  const home = match?.home;
  const away = match?.away;
  if (!home || !away) return null;

  const crestSize = Math.min(Math.round(height * 0.42), 84);
  const homeColor = home.color || home.color1 || '#00f2ff';
  const awayColor = away.color || away.color1 || '#d946ef';

  return (
    <View style={[vs.wrap, { height }]}>
      {/* Split team-colour wash behind each crest */}
      <View style={[StyleSheet.absoluteFillObject, { flexDirection: 'row' }]} pointerEvents="none">
        <View style={[vs.half, isWeb
          ? { backgroundImage: `linear-gradient(135deg, ${homeColor}33, ${homeColor}0a)` }
          : { backgroundColor: `${homeColor}1f` }]} />
        <View style={[vs.half, isWeb
          ? { backgroundImage: `linear-gradient(225deg, ${awayColor}33, ${awayColor}0a)` }
          : { backgroundColor: `${awayColor}1f` }]} />
      </View>

      <View style={vs.row}>
        <View style={vs.side}>
          <Crest team={home} size={crestSize} isWeb={isWeb} />
          {showNames && <Text style={[vs.name, { color: '#fff' }]} numberOfLines={1}>{home.name}</Text>}
        </View>

        <View style={vs.vsBadge}>
          <Text style={vs.vsText}>VS</Text>
        </View>

        <View style={vs.side}>
          <Crest team={away} size={crestSize} isWeb={isWeb} />
          {showNames && <Text style={[vs.name, { color: '#fff' }]} numberOfLines={1}>{away.name}</Text>}
        </View>
      </View>
    </View>
  );
};

const vs = StyleSheet.create({
  wrap: { width: '100%', overflow: 'hidden', backgroundColor: '#0b0e0f', alignItems: 'center', justifyContent: 'center' },
  half: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 16 },
  side: { flex: 1, alignItems: 'center', gap: 8 },
  crest: { borderWidth: 2, resizeMode: 'cover' },
  crestFallback: { alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 13, fontWeight: '900', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 },
  vsBadge: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' },
  vsText: { color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 0.5 },
});

export default MatchVersus;