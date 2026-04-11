import React from 'react';
import { Text } from 'react-native';
import { parseText } from '../../core/social';

export default function RichText({ text, style }) {
  const tokens = parseText(text);
  return (
    <Text style={style}>
      {tokens.map((t, i) => {
        if (t.type === 'hashtag') return <Text key={i} style={{ color: '#a78bfa', fontWeight: '700' }}>{t.value}</Text>;
        if (t.type === 'mention') return <Text key={i} style={{ color: '#3b82f6', fontWeight: '700' }}>{t.value}</Text>;
        return <Text key={i}>{t.value}</Text>;
      })}
    </Text>
  );
}
