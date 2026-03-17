// ENHANCED UI COMPONENTS FOR ADVANCED PLATFORM
// Includes media gallery, threaded comments, engagement metrics, mutual friends

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, FlatList, Image, TextInput, ScrollView, Pressable } from 'react-native';

// ─── MEDIA GALLERY COMPONENT ───────────────────────────────────
export function MediaGallery({ images = [], videos = [], onAddMedia }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showModal, setShowModal] = useState(false);

  const maxImages = Math.min(images.length, 15);
  const maxVideos = Math.min(videos.length, 3);

  return (
    <View style={galleryStyles.container}>
      {(images.length > 0 || videos.length > 0) ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={galleryStyles.scroll}>
          {/* Display Images */}
          {images.slice(0, 15).map((img, idx) => (
            <TouchableOpacity key={`img_${idx}`} onPress={() => { setSelectedIndex(idx); setShowModal(true); }}>
              <Image source={{ uri: img }} style={galleryStyles.thumbnail} />
              {idx === 14 && images.length > 15 && (
                <View style={galleryStyles.moreOverlay}>
                  <Text style={galleryStyles.moreText}>+{images.length - 15}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}

          {/* Display Videos */}
          {videos.slice(0, 3).map((vid, idx) => (
            <TouchableOpacity key={`vid_${idx}`} style={galleryStyles.videoThumbnail}>
              <Image source={{ uri: vid.thumbnail }} style={galleryStyles.thumbnail} />
              <Text style={galleryStyles.playIcon}>▶️</Text>
            </TouchableOpacity>
          ))}

          {/* Add Media Button */}
          <TouchableOpacity style={galleryStyles.addBtn} onPress={onAddMedia}>
            <Text style={galleryStyles.addBtnText}>➕</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <View style={galleryStyles.emptyState}>
          <Text style={galleryStyles.emptyText}>📷 Upload up to 15 images and 3 videos</Text>
          <TouchableOpacity style={galleryStyles.uploadBtn} onPress={onAddMedia}>
            <Text style={galleryStyles.uploadText}>Add Media</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Full Screen Image Modal */}
      <Modal visible={showModal} transparent animationType="fade">
        <View style={galleryStyles.modalOverlay}>
          <TouchableOpacity onPress={() => setShowModal(false)} style={{flex: 1, justifyContent: 'center'}}>
            <Image source={{ uri: images[selectedIndex] }} style={galleryStyles.fullImage} />
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const galleryStyles = StyleSheet.create({
  container: { marginBottom: 15 },
  scroll: { flexDirection: 'row', gap: 8 },
  thumbnail: { width: 100, height: 100, borderRadius: 12, marginRight: 8 },
  videoThumbnail: { position: 'relative', marginRight: 8 },
  playIcon: { position: 'absolute', fontSize: 24, top: '35%', left: '35%' },
  moreOverlay: { position: 'absolute', top: 0, width: 100, height: 100, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
  moreText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  addBtn: { width: 100, height: 100, borderRadius: 12, backgroundColor: 'rgba(255,77,166,0.2)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#ff4da6' },
  addBtnText: { fontSize: 32 },
  emptyState: { padding: 20, backgroundColor: 'rgba(255,77,166,0.1)', borderRadius: 12, alignItems: 'center' },
  emptyText: { color: '#888', marginBottom: 10 },
  uploadBtn: { paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#ff4da6', borderRadius: 12 },
  uploadText: { color: '#fff', fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  fullImage: { width: '100%', height: '80%', resizeMode: 'contain' }
});

// ─── ENGAGEMENT METRICS COMPONENT ───────────────────────────────
export function EngagementMetrics({ likes = 0, comments = 0, saves = 0, reposts = 0, onLike, onRsvp, onSave, onRepost, theme }) {
  return (
    <View style={[engagementStyles.container, { borderTopColor: theme.border }]}>
      <TouchableOpacity style={engagementStyles.metric} onPress={onLike}>
        <Text style={engagementStyles.icon}>❤️</Text>
        <Text style={[engagementStyles.count, {color: theme.text}]}>{likes}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={engagementStyles.metric} onPress={onRsvp}>
        <Text style={engagementStyles.icon}>⭐</Text>
        <Text style={[engagementStyles.count, {color: theme.text}]}>{comments}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={engagementStyles.metric} onPress={onSave}>
        <Text style={engagementStyles.icon}>🔖</Text>
        <Text style={[engagementStyles.count, {color: theme.text}]}>{saves}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={engagementStyles.metric} onPress={onRepost}>
        <Text style={engagementStyles.icon}>🔄</Text>
        <Text style={[engagementStyles.count, {color: theme.text}]}>{reposts}</Text>
      </TouchableOpacity>
    </View>
  );
}

const engagementStyles = StyleSheet.create({
  container: { flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1, paddingVertical: 12, marginBottom: 12 },
  metric: { alignItems: 'center', flex: 1 },
  icon: { fontSize: 18, marginBottom: 4 },
  count: { fontSize: 12, fontWeight: '700' }
});

// ─── THREADED COMMENT COMPONENT ───────────────────────────────────
export function ThreadedComment({ comment, theme, onReply, onLike, depth = 0 }) {
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showMedia, setShowMedia] = useState(false);

  const maxDepth = 3; // Max nesting level
  const canReply = depth < maxDepth;

  return (
    <View style={[commentStyles.container, { marginLeft: depth * 15 }]}>
      {/* Comment Header */}
      <View style={commentStyles.header}>
        <View style={commentStyles.authorInfo}>
          <View style={[commentStyles.avatar, { backgroundColor: theme.acc }]}>
            <Text style={commentStyles.avatarText}>{comment.authorName?.[0]}</Text>
          </View>
          <View>
            <Text style={[commentStyles.author, { color: theme.text }]}>{comment.authorName}</Text>
            <Text style={[commentStyles.time, { color: theme.sub }]}>2h ago</Text>
          </View>
        </View>
      </View>

      {/* Comment Text */}
      <Text style={[commentStyles.text, { color: theme.text }]}>{comment.text}</Text>

      {/* Comment Media */}
      {comment.media && (
        <View style={commentStyles.mediaContainer}>
          {comment.media.type === 'image' && <Image source={{ uri: comment.media.url }} style={commentStyles.media} />}
          {comment.media.type === 'video' && <Text style={commentStyles.media}>🎥 Video</Text>}
          {comment.media.type === 'sticker' && <Text style={commentStyles.media}>🎭 {comment.media.name}</Text>}
          {comment.media.type === 'voice' && <Text style={commentStyles.media}>🎤 Voice Note</Text>}
        </View>
      )}

      {/* Engagement */}
      <View style={commentStyles.engagement}>
        <TouchableOpacity onPress={() => onLike(comment.id)} style={commentStyles.engagementBtn}>
          <Text style={commentStyles.engagementText}>🤍 {comment.likes || 0}</Text>
        </TouchableOpacity>
        {canReply && (
          <TouchableOpacity onPress={() => setShowReplyBox(!showReplyBox)} style={commentStyles.engagementBtn}>
            <Text style={commentStyles.engagementText}>↩️ Reply</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Reply Box */}
      {showReplyBox && canReply && (
        <View style={[commentStyles.replyBox, { backgroundColor: theme.card }]}>
          <TextInput
            style={[commentStyles.replyInput, { color: theme.text, backgroundColor: theme.inp }]}
            placeholder="Write a reply..."
            placeholderTextColor={theme.sub}
            multiline
            value={replyText}
            onChangeText={setReplyText}
          />

          <View style={commentStyles.replyTools}>
            <TouchableOpacity onPress={() => setShowMedia(!showMedia)}>
              <Text style={commentStyles.toolIcon}>📎</Text>
            </TouchableOpacity>
            <TouchableOpacity>
              <Text style={commentStyles.toolIcon}>🎭</Text>
            </TouchableOpacity>
            <TouchableOpacity>
              <Text style={commentStyles.toolIcon}>🎤</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { onReply(comment.id, replyText); setReplyText(''); setShowReplyBox(false); }}>
              <Text style={commentStyles.sendIcon}>✓</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Nested Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <View style={commentStyles.repliesContainer}>
          {comment.replies.map(reply => (
            <ThreadedComment
              key={reply.id}
              comment={reply}
              theme={theme}
              onReply={onReply}
              onLike={onLike}
              depth={depth + 1}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const commentStyles = StyleSheet.create({
  container: { marginBottom: 12, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.1)' },
  header: { flexDirection: 'row', marginBottom: 8 },
  authorInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  author: { fontWeight: '700', fontSize: 13 },
  time: { fontSize: 11 },
  text: { fontSize: 13, lineHeight: 18, marginBottom: 8 },
  mediaContainer: { marginBottom: 8 },
  media: { width: '100%', height: 150, borderRadius: 8, marginBottom: 8, resizeMode: 'cover' },
  engagement: { flexDirection: 'row', gap: 12 },
  engagementBtn: { paddingVertical: 4 },
  engagementText: { fontSize: 11, fontWeight: '600' },
  replyBox: { marginTop: 12, padding: 12, borderRadius: 12 },
  replyInput: { borderRadius: 8, padding: 10, marginBottom: 8, minHeight: 40 },
  replyTools: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toolIcon: { fontSize: 20 },
  sendIcon: { fontSize: 18, color: '#ff4da6', fontWeight: 'bold' },
  repliesContainer: { marginTop: 12 }
});

// ─── MUTUAL FRIENDS INDICATOR ───────────────────────────────────
export function MutualFriendsIndicator({ mutualFriends = [], theme, onViewFriends }) {
  if (mutualFriends.length === 0) return null;

  const displayedFriends = mutualFriends.slice(0, 3);
  const remainingCount = Math.max(0, mutualFriends.length - 3);

  return (
    <TouchableOpacity style={[friendsStyles.container]} onPress={onViewFriends}>
      <View style={friendsStyles.avatarGroup}>
        {displayedFriends.map((friend, idx) => (
          <View
            key={friend.id}
            style={[
              friendsStyles.smallAvatar,
              {
                backgroundColor: theme.acc,
                marginLeft: idx > 0 ? -8 : 0,
                zIndex: displayedFriends.length - idx
              }
            ]}
          >
            <Text style={friendsStyles.smallAvatarText}>{friend.name?.[0]}</Text>
          </View>
        ))}
      </View>
      <Text style={[friendsStyles.text, { color: theme.text }]}>
        {displayedFriends.map(f => f.name).join(', ')}
        {remainingCount > 0 && ` +${remainingCount}`}
        {remainingCount === 0 && displayedFriends.length === 1 && ` liked this`}
      </Text>
    </TouchableOpacity>
  );
}

const friendsStyles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, marginBottom: 12, backgroundColor: 'rgba(255,77,166,0.1)', borderRadius: 12 },
  avatarGroup: { flexDirection: 'row', marginRight: 10 },
  smallAvatar: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  smallAvatarText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  text: { fontSize: 12, fontWeight: '600', flex: 1 }
});

// ─── EVENT LOCATION COMPONENT (MOVED BELOW DESCRIPTION) ───────────────────
export function EventLocation({ location, city, country, theme }) {
  return (
    <View style={locationStyles.container}>
      <Text style={[locationStyles.icon, { fontSize: 16 }]}>📍</Text>
      <View style={locationStyles.content}>
        <Text style={[locationStyles.location, { color: theme.text }]}>{location}</Text>
        {(city || country) && (
          <Text style={[locationStyles.subtext, { color: theme.sub }]}>
            {city} {country ? `, ${country}` : ''}
          </Text>
        )}
      </View>
    </View>
  );
}

const locationStyles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: 'rgba(255,77,166,0.08)', borderRadius: 12 },
  icon: { marginRight: 8, marginTop: 2 },
  content: { flex: 1 },
  location: { fontWeight: '600', marginBottom: 2 },
  subtext: { fontSize: 12 }
});
