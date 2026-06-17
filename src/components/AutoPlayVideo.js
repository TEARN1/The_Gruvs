/**
 * AutoPlayVideo — High-performance video player with viewport awareness.
 * Automatically plays when visible, mutes by default, and handles preloading.
 */
import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Video, ResizeMode, Audio } from 'expo-av';
import { Feather } from '@expo/vector-icons';
import { audioState } from '../utils/audioState';

export const AutoPlayVideo = ({
  source,
  isVisible = false,
  style,
  resizeMode = ResizeMode.COVER,
  shouldLoop = true
}) => {
  const videoRef = useRef(null);
  const [status, setStatus] = useState({});
  const [isMuted, setIsMuted] = useState(audioState.isMuted());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set audio mode for shared playback
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      staysActiveInBackground: false,
      playThroughEarpieceAndroid: false,
    });
  }, []);

  useEffect(() => {
    const unsub = audioState.subscribe(setIsMuted);
    return unsub;
  }, []);

  useEffect(() => {
    if (!videoRef.current) return;

    if (isVisible) {
      videoRef.current.playAsync();
    } else {
      videoRef.current.pauseAsync();
    }
  }, [isVisible]);

  const toggleMute = (e) => {
    e.stopPropagation();
    audioState.setMuted(!isMuted);
  };

  return (
    <View style={[s.container, style]}>
      <Video
        ref={videoRef}
        source={{ uri: source }}
        style={StyleSheet.absoluteFill}
        resizeMode={resizeMode}
        isLooping={shouldLoop}
        isMuted={isMuted}
        onPlaybackStatusUpdate={setStatus}
        onLoadStart={() => setLoading(true)}
        onLoad={() => setLoading(false)}
        onError={() => {}}
      />

      {loading && (
        <View style={s.loader}>
          <ActivityIndicator color="#00f2ff" />
        </View>
      )}

      <TouchableOpacity style={s.muteBtn} onPress={toggleMute}>
        <Feather
          name={isMuted ? "volume-x" : "volume-2"}
          size={16}
          color="#fff"
        />
      </TouchableOpacity>
    </View>
  );
};

const s = StyleSheet.create({
  container: { backgroundColor: '#000', overflow: 'hidden' },
  loader: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.2)' },
  muteBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  }
});
