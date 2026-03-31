import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Image, ScrollView, Linking, StyleSheet, Platform } from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useStore } from '../state/useStore';
import { ACCENT, GOLD, SILVER, PLAT, THEME } from '../theme';
import { REACTIONS, rsvpCounts } from '../social';
import RichText from './RichText';
import TicketModal from './TicketModal';
import VoiceRecorder from './VoiceRecorder';

const getCountdown = (dateStr) => {
  if (!dateStr) return null;
  const now = new Date();
  const target = new Date(dateStr);
  const diff = target - now;
  if (diff < 0) return 'Happening Now';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) {
    const hours = Math.floor(diff / (1000 * 60 * 60));
    return `${hours}h left`;
  }
  return `${days}d left`;
};

// Comment tier logic
function getCommentTier(comment) {
  const likeScore = (comment.likes || 0) * 3 + (comment.replyCount || 0);
  if (likeScore >= 30) return 'platinum';
  if (likeScore >= 10) return 'gold';
  if (likeScore >= 3) return 'silver';
  return 'none';
}
function tierStyle(tier) {
  if (tier === 'platinum') return { borderLeftColor: PLAT, shadowColor: PLAT, shadowOpacity: 0.5, shadowRadius: 8 };
  if (tier === 'gold') return { borderLeftColor: GOLD, shadowColor: GOLD, shadowOpacity: 0.5, shadowRadius: 6 };
  if (tier === 'silver') return { borderLeftColor: SILVER };
  return { borderLeftColor: '#3b82f6' };
}
function tierLabel(tier) {
  if (tier === 'platinum') return { label: '◆ Platinum', color: PLAT };
  if (tier === 'gold') return { label: '◆ Gold', color: GOLD };
  if (tier === 'silver') return { label: '◆ Silver', color: SILVER };
  return null;
}
function sortComments(comments) {
  return [...(comments || [])].sort((a, b) => {
    const scA = (a.likes || 0) * 3 + (a.replyCount || 0);
    const scB = (b.likes || 0) * 3 + (b.replyCount || 0);
    return scB - scA;
  });
}

export default function PostCard({ item, navigation }) {
  const { user, handleFollow, followedUsers, userReaction, postReactions, handleReact,
          rsvpState, handleRSVP, regruvePosts, handleRegruve, savedPosts, handleSave, 
          handleCommentLike, handleCommentSubmit } = useStore();

  const [isCollapsed, setIsCollapsed] = useState(true);
  const [reactionPickerVisible, setReactionPickerVisible] = useState(false);
  const [ticketModalVisible, setTicketModalVisible] = useState(false);
  const [replyTo, setReplyTo] = useState(null); // { id: c.id, author: c.author }
  const [commentText, setCommentText] = useState('');
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [slideLikes, setSlideLikes] = useState({}); // { slideIdx: count }
  const [slideSaved, setSlideSaved] = useState({}); // { slideIdx: bool }

  const d = item.content || item || {};
  const m = item.engagement_metrics || { 
    liked_by: item.liked_by || [], 
    comments: item.comments || [], 
    rsvps: item.rsvps || {} 
  };
  const counts = rsvpCounts(m.rsvps);
  const myRSVP = rsvpState[item.id];
  const myReaction = userReaction[item.id];
  const topReaction = REACTIONS.find(r => r.id === myReaction);
  const isSaved = savedPosts.includes(item.id);
  const isReguved = regruvePosts.includes(item.id);
  const isLiked = m.liked_by?.includes(user?.id || 'anon');

  const openGoogleMaps = (location) => {
    const query = encodeURIComponent(location || 'Unknown location');
    const url = Platform.OS === 'ios'
      ? `maps://maps.apple.com/?q=${query}`
      : `https://www.google.com/maps/search/?api=1&query=${query}`;
    Linking.openURL(url).catch(() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`));
  };

  const handleShare = async () => {
    const url = `https://thegruvs.app/event/${item.id}`;
    if (Platform.OS !== 'web' && typeof navigator?.share === 'function') {
      try { await navigator.share({ title: d.title, text: d.text, url }); } catch {}
    } else {
      Linking.openURL(`https://twitter.com/intent/tweet?text=${encodeURIComponent(d.title + ' ' + url)}`);
    }
  };

  const submitComment = () => {
    if (!commentText.trim()) return;
    handleCommentSubmit(item.id, commentText.trim(), replyTo?.author, replyTo?.id);
    setCommentText('');
    setReplyTo(null);
  };

  // Prepare Tree
  const commentNodes = m.comments || [];
  const idMap = {};
  commentNodes.forEach(c => { idMap[c.id] = { ...c, children: [] }; });
  const rootComments = [];
  commentNodes.forEach(c => {
    if (c.parentId && idMap[c.parentId]) idMap[c.parentId].children.push(idMap[c.id]);
    else rootComments.push(idMap[c.id]);
  });

  const renderTree = (nodes, depth = 0) => {
    return sortComments(nodes).map(c => {
      const tier = getCommentTier(c);
      const badge = tierLabel(tier);
      const isCommentLiked = c.liked_by?.includes(user?.id || 'anon');
      return (
        <View key={c.id}>
          <View style={[styles.commentNode, tierStyle(tier), { marginLeft: depth * 12, borderLeftWidth: depth > 0 ? 1 : 2 }]}>
            {badge && (
              <Text style={[styles.tierBadge, { color: badge.color }]}>{badge.label}</Text>
            )}
            {c.replyTo && !c.parentId && <Text style={styles.replyingTo}>↩ replying to @{c.replyTo}</Text>}
            <Text style={styles.commentAuthor}>{c.author}: 
              {c.text.startsWith('[Voice Note]') ? null : <Text style={styles.commentBody}> {c.text}</Text>}
            </Text>
            {c.text.startsWith('[Voice Note]') && (
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a3e', borderRadius: 12, padding: 6, marginTop: 4, width: 140, gap: 10 }}>
                <Ionicons name="play-circle" size={24} color={ACCENT} />
                <View style={{ flexDirection: 'row', gap: 2, flex: 1, alignItems: 'center' }}>
                  {[10, 16, 12, 18, 10, 14, 8].map((h, i) => <View key={i} style={{ width: 3, height: h, backgroundColor: '#55608a', borderRadius: 2 }} />)}
                </View>
                <TouchableOpacity onPress={() => handleSave(c.id)}>
                  <Ionicons name="download-outline" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.commentActions}>
              <TouchableOpacity style={styles.commentActionBtn} onPress={() => handleCommentLike(item.id, c.id)}>
                <Ionicons name={isCommentLiked ? "heart" : "heart-outline"} size={13} color={isCommentLiked ? ACCENT : THEME.sub} />
                <Text style={[styles.commentActionText, isCommentLiked && { color: ACCENT }]}>{c.likes || 0}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.commentActionBtn} onPress={() => setReplyTo({ id: c.id, author: c.author })}>
                <Ionicons name="return-down-forward-outline" size={13} color={THEME.sub} />
                <Text style={styles.commentActionText}>Reply</Text>
              </TouchableOpacity>
            </View>
          </View>
          {c.children.length > 0 && renderTree(c.children, depth + 1)}
        </View>
      );
    });
  };

  return (
    <View style={[styles.postCard, item.is_paid && styles.paidCard]}>
      {item.is_paid && <Text style={styles.paidBadge}>PRO</Text>}

      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.authorRow}>
          <TouchableOpacity onPress={() => navigation?.navigate?.('OtherProfile', { userId: d.author_id || item.id })} style={styles.avatarCircle}>
            <Text style={styles.avatarInitial}>{(d.author_name || 'V')[0]}</Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.authorName}>{d.author_name}
              <Text style={[styles.followText, followedUsers.includes(d.author_id || item.id) && { color: THEME.sub }]}>
                {followedUsers.includes(d.author_id || item.id) ? '  Following' : '  Follow'}
              </Text>
            </Text>
            <Text style={styles.postTime}>2h ago</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          {getCountdown(d.dateTime) && (
            <View style={styles.countdownBadge}>
              <MaterialCommunityIcons name="timer-outline" size={12} color={ACCENT} />
              <Text style={styles.countdownText}>{getCountdown(d.dateTime)}</Text>
            </View>
          )}
          <TouchableOpacity style={styles.menuBtn}>
            <Ionicons name="ellipsis-horizontal" size={20} color={THEME.sub} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <View style={styles.postBody}>
        <View style={styles.categoryBadge}><Text style={styles.categoryText}>{d.category || 'General'}</Text></View>
        <Text style={styles.eventTitle}>{d.title}</Text>
        <RichText text={d.text} style={styles.eventDesc} />

        {/* Re-Gruve banner */}
        {item.is_regruve && (
          <View style={styles.reguveBanner}>
            <Ionicons name="repeat" size={12} color={THEME.sub} />
            <Text style={styles.reguveBannerText}>{item.regruvedBy} Re-Gruved this</Text>
          </View>
        )}

        {/* Details */}
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={14} color={THEME.sub} />
          <Text style={styles.detailText}>{d.dateTime || 'TBC'}</Text>
        </View>
        <TouchableOpacity style={styles.detailRow} onPress={() => openGoogleMaps(d.location)} activeOpacity={0.7}>
          <Ionicons name="navigate" size={14} color={ACCENT} />
          <Text style={[styles.detailText, { color: ACCENT, textDecorationLine: 'underline' }]}>{d.location || 'Unknown'}</Text>
          <Ionicons name="open-outline" size={11} color={ACCENT} style={{ marginLeft: 3 }} />
        </TouchableOpacity>

        {/* Media */}
        {d.slides && d.slides.length > 0 ? (
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.mediaScroll}>
            {d.slides.map((s, idx) => (
              <View key={idx} style={styles.mediaContainer}>
                {s.type === 'video' ? (
                  <View style={styles.videoPlaceholder}>
                    <Ionicons name="play-circle" size={48} color="#fff" />
                    <TouchableOpacity style={styles.rotateBtn}><Ionicons name="sync" size={20} color="#fff" /></TouchableOpacity>
                  </View>
                ) : (
                  <View style={{ flex: 1 }}>
                    <Image source={{ uri: s.url }} style={styles.mediaImage} />
                    <View style={styles.slideOverlay}>
                      <TouchableOpacity 
                        style={styles.slideAction} 
                        onPress={() => setSlideLikes(prev => ({ ...prev, [idx]: (prev[idx] || 0) + 1 }))}
                      >
                        <Ionicons name="heart" size={16} color="#fff" />
                        <Text style={styles.slideActionText}>{slideLikes[idx] || 0}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.slideAction}
                        onPress={() => setSlideSaved(prev => ({ ...prev, [idx]: !prev[idx] }))}
                      >
                        <Ionicons name={slideSaved[idx] ? "bookmark" : "bookmark-outline"} size={16} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.mediaSlotEmpty}>
            <Ionicons name="images-outline" size={22} color={THEME.sub} />
            <Text style={styles.mediaSlotText}>Media Highlights · Max 15 Img, 3 Vid</Text>
          </View>
        )}

        {/* RSVP & Tickets Panel */}
        <View style={styles.rsvpWrapper}>
          <View style={styles.rsvpRow}>
            {[{ id:'going', icon:'checkmark-circle', label:`Going${counts.going>0?' · '+counts.going:''}`, activeColor:'#10b981' },
              { id:'interested', icon:'star-outline', label:`Interested${counts.interested>0?' · '+counts.interested:''}`, activeColor: GOLD },
              { id:'not_going', icon:'close-circle-outline', label:'Skip', activeColor:'#ef4444' }].map(btn => (
              <TouchableOpacity key={btn.id}
                style={[styles.rsvpBtn, myRSVP === btn.id && { borderColor: btn.activeColor, backgroundColor: btn.activeColor + '22' }]}
                onPress={() => handleRSVP(item.id, btn.id)}>
                <Ionicons name={btn.icon} size={14} color={myRSVP === btn.id ? btn.activeColor : THEME.sub} />
                <Text style={[styles.rsvpLabel, myRSVP === btn.id && { color: btn.activeColor }]}>{btn.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Engagement Bar */}
        <View style={styles.engagRow}>
          {/* Reaction button */}
          <View style={{ position:'relative' }}>
            <TouchableOpacity style={styles.engagBtn}
              onPress={() => {
                if (myReaction) handleReact(item.id, myReaction);
                else setReactionPickerVisible(!reactionPickerVisible);
              }}
              onLongPress={() => setReactionPickerVisible(true)}>
              {topReaction
                ? <Ionicons name={topReaction.icon} size={20} color={topReaction.color} />
                : <Ionicons name="heart-outline" size={20} color={THEME.sub} />}
              <Text style={[styles.engagCount, myReaction && { color: ACCENT }]}>{m.liked_by?.length || 0}</Text>
            </TouchableOpacity>
            {reactionPickerVisible && (
              <View style={styles.reactionPicker}>
                {REACTIONS.map(r => (
                  <TouchableOpacity key={r.id} style={styles.reactionPickerBtn} onPress={() => { handleReact(item.id, r.id); setReactionPickerVisible(false); }}>
                    <Ionicons name={r.icon} size={22} color={r.color} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <TouchableOpacity style={styles.engagBtn} onPress={() => setIsCollapsed(!isCollapsed)}>
            <Ionicons name="chatbubble-outline" size={18} color={THEME.sub} />
            <Text style={styles.engagCount}>{m.comments?.length || 0}</Text>
          </TouchableOpacity>

          {/* Re-Gruve */}
          <TouchableOpacity style={styles.engagBtn} onPress={() => handleRegruve(item.id)}>
            <Ionicons name={isReguved ? "repeat" : "repeat-outline"} size={18} color={isReguved ? '#a855f7' : THEME.sub} />
          </TouchableOpacity>

          {/* Share */}
          <TouchableOpacity style={styles.engagBtn} onPress={handleShare}>
            <Feather name="send" size={17} color={THEME.sub} />
          </TouchableOpacity>

          {/* Save */}
          <TouchableOpacity style={[styles.engagBtn, { marginLeft:'auto' }]} onPress={() => handleSave(item.id)}>
            <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={18} color={isSaved ? GOLD : THEME.sub} />
          </TouchableOpacity>

          {item.scarcity?.is_filling_fast && (
            <View style={styles.scarcityBadge}>
              <MaterialCommunityIcons name="fire" size={12} color="#ff4500" />
              <Text style={styles.scarcityText}>Only {item.scarcity.remaining} left!</Text>
            </View>
          )}
        </View>

        {/* Comment Section */}
        {!isCollapsed && (
          <View style={styles.commentSection}>
            <View style={styles.commentsHeader}>
              <Text style={[styles.sectionTitle, { color: ACCENT }]}>{m.comments?.length || 0} Comments</Text>
              <TouchableOpacity onPress={() => setIsCollapsed(true)}>
                <Text style={styles.collapseText}>COLLAPSE ▲</Text>
              </TouchableOpacity>
            </View>

            {renderTree(rootComments)}

            {replyTo && (
              <Text style={styles.replyingTo}>↩ Replying to @{replyTo.author}  <Text onPress={() => setReplyTo(null)} style={{ color: ACCENT }}>✕</Text></Text>
            )}
            <View style={styles.commentInputRow}>
              <TextInput
                style={styles.commentInput}
                placeholder={replyTo ? `Reply to @${replyTo.author}...` : 'Join the chat...'}
                placeholderTextColor="#55608a"
                value={commentText}
                onChangeText={setCommentText}
                onSubmitEditing={submitComment}
              />
              <TouchableOpacity style={styles.sendBtn} onPress={() => setShowVoiceRecorder(!showVoiceRecorder)}>
                <Ionicons name="mic" size={16} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.sendBtn, { backgroundColor: '#10b981' }]} onPress={() => handleCommentSubmit(item.id, `📍 My Live Location`, replyTo?.author, replyTo?.id)}>
                <Ionicons name="location" size={16} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.sendBtn} onPress={submitComment}>
                <Ionicons name="send" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
            
            {showVoiceRecorder && (
              <VoiceRecorder 
                onSend={(uri) => {
                  handleCommentSubmit(item.id, `[Voice Note]`, replyTo?.author, replyTo?.id);
                  setShowVoiceRecorder(false);
                }}
                onCancel={() => setShowVoiceRecorder(false)}
              />
            )}
          </View>
        )}
      </View>

      {/* Ticket Checkout Modal */}
      <TicketModal visible={ticketModalVisible} onClose={() => setTicketModalVisible(false)} event={item} />
    </View>
  );
}

const styles = StyleSheet.create({
  postCard: { backgroundColor: THEME.card, padding: 18, marginHorizontal: 16, marginVertical: 8, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5, borderWidth: 1, borderColor: THEME.cardBorder },
  paidCard: { borderWidth: 1, borderColor: ACCENT, shadowColor: ACCENT, shadowOpacity: 0.2, shadowRadius: 20 },
  paidBadge: { position: 'absolute', top: 12, right: 12, backgroundColor: GOLD, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, overflow: 'hidden', color: '#000', fontWeight: '900', fontSize: 10, zIndex: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  authorRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  avatarCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#1e1e3f', justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { color: '#fff', fontSize: 16, fontWeight: '800' },
  authorName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  followText: { color: ACCENT, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  postTime: { color: '#55608a', fontSize: 12, marginTop: 2 },
  menuBtn: { padding: 4 },
  postBody: { paddingLeft: 0 },
  categoryBadge: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginBottom: 10 },
  categoryText: { color: '#94a3b8', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  eventTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 6, lineHeight: 28 },
  eventDesc: { color: '#d1d5db', fontSize: 15, lineHeight: 24, marginBottom: 14 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  detailText: { color: '#94a3b8', fontSize: 14, fontWeight: '500' },
  mediaScroll: { marginVertical: 14, borderRadius: 16 },
  mediaContainer: { width: 330, height: 220, marginRight: 10, borderRadius: 16, overflow: 'hidden' },
  mediaImage: { width: '100%', height: '100%' },
  videoPlaceholder: { flex: 1, backgroundColor: '#1a1a3e', justifyContent: 'center', alignItems: 'center' },
  rotateBtn: { position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.5)', padding: 8, borderRadius: 20 },
  mediaSlotEmpty: { height: 70, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderStyle: 'dashed', borderColor: '#2a2a4a', justifyContent: 'center', alignItems: 'center', marginVertical: 14, flexDirection: 'row', gap: 8 },
  mediaSlotText: { color: '#55608a', fontSize: 12, fontWeight: '600' },

  // Socials & Tickets
  rsvpWrapper: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 10 },
  rsvpRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', flex: 1 },
  rsvpBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 14, borderWidth: 1, borderColor: '#1e1e3f' },
  rsvpLabel: { color: THEME.sub, fontSize: 11, fontWeight: '700' },
  ticketBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: GOLD, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, shadowColor: GOLD, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  ticketBtnText: { color: '#000', fontSize: 12, fontWeight: '800' },
  
  reguveBanner: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  reguveBannerText: { color: THEME.sub, fontSize: 12 },

  engagRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  engagBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  engagCount: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
  scarcityBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto', backgroundColor: 'rgba(255,69,0,0.12)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  scarcityText: { color: '#ff4500', fontSize: 11, fontWeight: '700' },

  reactionPicker: { position: 'absolute', bottom: 38, left: 0, flexDirection: 'row', backgroundColor: '#0d0d25', borderRadius: 30, paddingHorizontal: 10, paddingVertical: 8, gap: 4, borderWidth: 1, borderColor: '#2a2a4a', zIndex: 999, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 10 },
  reactionPickerBtn: { padding: 6 },

  // Comments
  commentSection: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 14 },
  commentsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontWeight: '800', fontSize: 14 },
  collapseText: { color: '#55608a', fontSize: 11, fontWeight: '700' },
  commentNode: { marginBottom: 14, paddingLeft: 12, borderLeftWidth: 2 },
  tierBadge: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginBottom: 3 },
  replyingTo: { color: '#55608a', fontSize: 11, marginBottom: 4 },
  commentAuthor: { color: '#fff', fontWeight: '700', fontSize: 13 },
  commentBody: { fontWeight: '400', color: '#94a3b8' },
  commentActions: { flexDirection: 'row', gap: 14, marginTop: 6 },
  commentActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  commentActionText: { color: '#55608a', fontSize: 12 },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  commentInput: { flex: 1, height: 42, borderRadius: 14, paddingHorizontal: 14, backgroundColor: '#0d0d28', color: '#fff', fontSize: 14, borderWidth: 1, borderColor: '#1e1e3f' },
  sendBtn: { width: 42, height: 42, borderRadius: 14, backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center' },

  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  countdownBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,77,166,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  countdownText: { color: ACCENT, fontSize: 11, fontWeight: '800' },

  slideOverlay: { position: 'absolute', bottom: 12, right: 12, flexDirection: 'row', gap: 10, backgroundColor: 'rgba(0,0,0,0.4)', padding: 8, borderRadius: 20 },
  slideAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  slideActionText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
