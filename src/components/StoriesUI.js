import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image } from 'react-native';

export function StoriesUI({ theme }) {
    const stories = [
        { id: '1', user: 'Sarah', image: null },
        { id: '2', user: 'Mike', image: null },
        { id: '3', user: 'Jessica', image: null },
    ];

    return (
        <View style={styles.container}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                <TouchableOpacity style={styles.addStoryCard}>
                    <View style={styles.addStoryHeader}>
                        <Text style={styles.addStoryText}>Add Story</Text>
                    </View>
                    <View style={styles.addBtnCircle}>
                        <Text style={styles.addBtnIcon}>+</Text>
                    </View>
                </TouchableOpacity>

                {stories.map(story => (
                    <TouchableOpacity key={story.id} style={styles.storyCard}>
                        <View style={styles.storyUserBadge}>
                            <View style={styles.storyAvatar} />
                        </View>
                        <Image
                            source={{ uri: 'https://via.placeholder.com/100x160' }}
                            style={styles.storyImage}
                        />
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { marginBottom: 25 },
    scrollContent: { gap: 15 },
    addStoryCard: {
        width: 100,
        height: 160,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 20,
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: 15,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    addStoryHeader: { position: 'absolute', top: 15, width: '100%', alignItems: 'center' },
    addStoryText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
    addBtnCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
    },
    addBtnIcon: { color: '#a855f7', fontSize: 20, fontWeight: 'bold' },
    storyCard: {
        width: 100,
        height: 160,
        borderRadius: 20,
        backgroundColor: '#333',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    storyImage: { width: '100%', height: '100%', opacity: 0.8 },
    storyUserBadge: {
        position: 'absolute',
        top: 10,
        left: 10,
        zIndex: 10,
        backgroundColor: 'rgba(168, 85, 247, 0.5)',
        padding: 3,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: '#a855f7',
    },
    storyAvatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#555' },
});
