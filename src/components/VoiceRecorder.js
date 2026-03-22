import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Audio } from 'expo-av';
import { Feather, Ionicons } from '@expo/vector-icons';
import { ACCENT, THEME } from '../theme';

export default function VoiceRecorder({ onSend, onCancel, targetId }) {
  const [recording, setRecording] = useState(null);
  const [permissionResponse, requestPermission] = Audio.usePermissions();
  const [isRecording, setIsRecording] = useState(false);
  const [recordUri, setRecordUri] = useState(null);
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [status, setStatus] = useState('idle'); // 'idle', 'recording', 'finished', 'playing'

  useEffect(() => {
    return sound ? () => { sound.unloadAsync(); } : undefined;
  }, [sound]);

  async function startRecording() {
    try {
      if (permissionResponse.status !== 'granted') {
        console.log('Requesting permission..');
        await requestPermission();
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      console.log('Starting recording..');
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
      setStatus('recording');
      console.log('Recording started');
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  }

  async function stopRecording() {
    console.log('Stopping recording..');
    setRecording(undefined);
    await recording.stopAndUnloadAsync();
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    const uri = recording.getURI();
    setRecordUri(uri);
    setIsRecording(false);
    setStatus('finished');
    console.log('Recording stopped and stored at', uri);
  }

  async function playSound() {
    console.log('Loading Sound');
    const { sound } = await Audio.Sound.createAsync({ uri: recordUri });
    setSound(sound);
    setIsPlaying(true);
    setStatus('playing');
    await sound.playAsync();
    sound.setOnPlaybackStatusUpdate((stat) => {
      if (stat.didJustFinish) {
        setIsPlaying(false);
        setStatus('finished');
      }
    });
  }

  async function pauseSound() {
    if (sound) {
      await sound.pauseAsync();
      setIsPlaying(false);
      setStatus('finished');
    }
  }

  const handleDelete = () => {
    setRecordUri(null);
    if (sound) sound.unloadAsync();
    setSound(null);
    setStatus('idle');
  };

  const handleSend = () => {
    if (onSend) onSend(recordUri);
    handleDelete();
  };

  return (
    <View style={styles.container}>
      {status === 'idle' && (
        <TouchableOpacity style={styles.recordBtn} onPress={startRecording}>
          <Feather name="mic" size={24} color="#fff" />
          <Text style={styles.btnText}>Hold to Record</Text>
        </TouchableOpacity>
      )}

      {status === 'recording' && (
        <View style={styles.activeRow}>
          <View style={styles.pulseDot} />
          <Text style={styles.recordingText}>Recording...</Text>
          <TouchableOpacity style={styles.stopBtn} onPress={stopRecording}>
            <Feather name="square" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {(status === 'finished' || status === 'playing') && recordUri && (
        <View style={styles.finishedRow}>
          <TouchableOpacity onPress={isPlaying ? pauseSound : playSound} style={styles.playPauseBtn}>
            <Ionicons name={isPlaying ? "pause" : "play"} size={24} color={ACCENT} />
          </TouchableOpacity>
          
          <View style={styles.wavePlaceholder}>
            <View style={[styles.waveBar, { height: 10 }]} />
            <View style={[styles.waveBar, { height: 20 }]} />
            <View style={[styles.waveBar, { height: 15 }]} />
            <View style={[styles.waveBar, { height: 25 }]} />
            <View style={[styles.waveBar, { height: 10 }]} />
          </View>

          <View style={styles.actionIcons}>
            <TouchableOpacity onPress={handleDelete} style={styles.iconBtn}>
              <Feather name="trash-2" size={18} color="#ef4444" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSend} style={styles.sendBtn}>
              <Ionicons name="send" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#16162a',
    borderRadius: 20,
    padding: 12,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#2a2a4a'
  },
  recordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 12
  },
  btnText: { color: '#fff', fontWeight: '700' },
  activeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recordingText: { color: '#fff', fontWeight: '800', flex: 1, marginLeft: 10 },
  pulseDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444' },
  stopBtn: { backgroundColor: '#ef4444', padding: 8, borderRadius: 10 },
  finishedRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  playPauseBtn: { padding: 5 },
  wavePlaceholder: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 3 },
  waveBar: { width: 4, backgroundColor: '#2a2a4a', borderRadius: 2 },
  actionIcons: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  iconBtn: { padding: 5 },
  sendBtn: { backgroundColor: ACCENT, padding: 8, borderRadius: 12 },
});
