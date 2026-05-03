import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, FlatList, Image } from 'react-native';
import { GlassView } from './GlassView';
import { useTheme } from '../context/ThemeContext';
import { Feather } from '@expo/vector-icons';

export const ActivityCenterModal = ({ visible, onClose }) => {
  const { currentTheme } = useTheme();

  const SAMPLE_ACTIVITIES = [
    { id: '1', type: 'vibe', user: 'kayla_vibes', time: '2m ago', content: 'vibed with your event "Summer Splash"' },
    { id: '2', type: 'echo', user: 'thabo_rsa', time: '15m ago', content: 'echoed: "Can\'t wait for this!"' },
    { id: '3', type: 'follow', user: 'nadia_g', time: '1h ago', content: 'is now following your vibe' },
    { id: '4', type: 'royal', user: 'The Gruvs', time: '2h ago', content: 'You reached "Elite Viber" status! 👑' },
  ];

  const getIcon = (type) => {
    switch(type) {
      case 'vibe': return 'zap';
      case 'echo': return 'message-circle';
      case 'follow': return 'users';
      case 'royal': return 'crown';
      default: return 'bell';
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <GlassView style={styles.container}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: currentTheme?.primary || '#00f2ff' }]}>ACTIVITY CENTER</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={SAMPLE_ACTIVITIES}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <View style={[styles.item, { borderBottomColor: 'rgba(255,255,255,0.05)' }]}>
                <View style={[styles.iconWrap, { backgroundColor: currentTheme?.primary + '15' }]}>
                   {item.type === 'royal' ? (
                       <Text style={{fontSize: 14}}>👑</Text>
                   ) : (
                       <Feather name={getIcon(item.type)} size={14} color={currentTheme?.primary || '#00f2ff'} />
                   )}
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.text}>
                    <Text style={{ fontWeight: 'bold' }}>{item.user}</Text> {item.content}
                  </Text>
                  <Text style={styles.time}>{item.time}</Text>
                </View>
              </View>
            )}
            ListEmptyComponent={<Text style={styles.empty}>Your kingdom is quiet...</Text>}
          />
        </GlassView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-start', paddingTop: 60 },
  container: { marginHorizontal: 20, maxHeight: '80%', padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 16, fontWeight: '900', letterSpacing: 1.5 },
  close: { color: 'white', fontSize: 18, padding: 5 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1 },
  iconWrap: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  text: { color: 'white', fontSize: 13, lineHeight: 18 },
  time: { color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 4 },
  empty: { color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 40 },
});
