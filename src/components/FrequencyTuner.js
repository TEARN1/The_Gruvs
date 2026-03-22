import React, { useContext } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Slider } from '@miblanchard/react-native-slider';
import { VibeContext } from '../state/VibeContext';
import { ACCENT, THEME } from '../theme';

export default function FrequencyTuner() {
  const { frequency } = useContext(VibeContext);

  if (!frequency) return null; // Safety check

  return (
    <View style={styles.tunerBox}>
      <Text style={styles.text}>Find Your Frequency</Text>
      <Slider
        value={frequency.value}
        onValueChange={(val) => { 
          // Slider returns an array of values if it supports multiple thumbs, but here it's single
          const numericVal = Array.isArray(val) ? val[0] : val;
          frequency.value = numericVal; 
        }}
        minimumValue={0}
        maximumValue={1}
        step={0.01}
        thumbTintColor={ACCENT}
        minimumTrackTintColor={ACCENT}
        maximumTrackTintColor={THEME.sub}
      />
      <Text style={styles.subText}>Slide to discover new crews and drops</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tunerBox: {
    padding: 20,
    backgroundColor: THEME.card,
    borderRadius: 20,
    marginVertical: 15,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
  },
  text: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 5,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  subText: {
    color: THEME.sub,
    fontSize: 12,
    marginTop: 5,
    textAlign: 'center'
  }
});
