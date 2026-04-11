import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Linking, StyleSheet, Platform, Animated, Modal } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useStore } from '../../core/state/useStore';
import { ACCENT, GOLD, SILVER, PLAT, LIGHT_THEME, DARK_THEME } from '../../core/theme';
import { REACTIONS, rsvpCounts } from '../../core/social';
import RichText from './RichText';
import TicketModal from './TicketModal';
import VoiceRecorder from './VoiceRecorder';

const getCountdown = (dateStr) => {
  if (!dateStr || dateStr === 'Soon' || dateStr === 'TBC') return null;
  const now = new Date();
  
  let target;
  if (/^\d{1,2}:\d{2}$/.test(dateStr)) {
    const [h, m] = dateStr.split(':');
    target = new Date();
    target.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
    if (target < now) target.setHours(target.getHours() + 24);
  } else {
    target = new Date(dateStr);
  }

  if (isNaN(target.getTime())) return null;

  const diff = target - now;
  if (diff < 0) return 'Happening Now';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) {
    const hours = Math.floor(diff / (1000 * 60 * 60));
    return hours === 0 ? 'Starts soon' : `${hours}h left`;
  }
  return `${days}d left`;
};

// Comment tier logic with secure styles
function getCommentTier(comment) {
  const likeScore = (comment.likes || 0) * 3 + (comment.replyCount || 0);
  if (likeScore >= 30) return 'platinum';
  if (likeScore >= 10) return 'gold';
  if (likeScore >= 3) return 'silver';
  return 'none';
}

function tierStyle(tier) {
  if (tier === 'platinum') return { 
    borderLeftColor: PLAT, 
    ...Platform.select({
      web: { boxShadow: `0 8px 16px ${PLAT}33` },
      default: { shadowColor: PLAT, shadowOpacity: 0.5, shadowRadius: 8, elevation: 5 }
    })
  };
  if (tier === 'gold') return { 
    borderLeftColor: GOLD, 
    ...Platform.select({
      web: { boxShadow: `0 6px 12px ${GOLD}33` },
      default: { shadowColor: GOLD, shadowOpacity: 0.5, shadowRadius: 6, elevation: 5 }
    })
  };
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

// Refactor Comment Node into a separate memoized component
const CommentNode = React.memo(({ c, depth, item, user, handleCommentLike, setReplyTo, theme, handleSave }) => {
  const tier = getCommentTier(c);
  const badge = tierLabel(tier);
  const isCommentLiked = c.liked_by?.includes(user?.id || 'anon');

  return (
    <View>
      <View style={[styles.commentNode, tierStyle(tier), { marginLeft: depth * 12, borderLeftWidth: depth > 0 ? 1 : 2, borderLeftColor: theme.cardBorder }]}>
        {badge && (
          <Text style={[styles.tierBadge, { color: badge.color }]}>{badge.label}</Text>
        )}
        {c.replyTo && !c.parentId && <Text style={[styles.replyingTo, { color: theme.textDim }]}>↩ replying to @{c.author}</Text>}
        <Text style={[styles.commentAuthor, { color: theme.text }]}>{c.author}:
          {c.text.startsWith('[Voice Note]') ? null : <Text style={[styles.commentBody, { color: theme.textDim }]}> {c.text}</Text>}
        </Text>
        {c.text.startsWith('[Voice Note]') && (
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.subtle, borderRadius: 12, padding: 6, marginTop: 4, width: 140, gap: 10 }}>
            <Ionicons name="play-circle" size={24} color={ACCENT} />
            <View style={{ flexDirection: 'row', gap: 2, flex: 1, alignItems: 'center' }}>
              {[10, 16, 12, 18, 10, 14, 8].map((h, i) => <View key={i} style={{ width: 3, height: h, backgroundColor: theme.textDim, opacity: 0.3, borderRadius: 2 }} />)}
            </View>
            <TouchableOpacity onPress={() => handleSave(c.id)}>
              <Ionicons name="download-outline" size={18} color={theme.text} />
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.commentActions}>
          <TouchableOpacity style={styles.commentActionBtn} onPress={() => handleCommentLike(item.id, c.id)}>
            <Ionicons name={isCommentLiked ? "heart" : "heart-outline"} size={13} color={isCommentLiked ? ACCENT : theme.textDim} />
            <Text style={[styles.commentActionText, { color: theme.textDim }, isCommentLiked && { color: ACCENT }]}>{c.likes || 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.commentActionBtn} onPress={() => setReplyTo({ id: c.id, author: c.author })}>
            <Ionicons name="return-down-forward-outline" size={13} color={theme.textDim} />
            <Text style={[styles.commentActionText, { color: theme.textDim }]}>Reply</Text>
          </TouchableOpacity>
        </View>
      </View>
      {c.children?.length > 0 && sortComments(c.children).map(child => (
        <CommentNode
          key={child.id}
          c={child}
          depth={depth + 1}
          item={item}
          user={user}
          handleCommentLike={handleCommentLike}
          setReplyTo={setReplyTo}
          theme={theme}
          handleSave={handleSave}
        />
      ))}
    </View>
  );
});

export default function PostCard({ item, navigation }) {
  const { user, handleFollow, followedUsers, userReaction, postReactions, handleReact,
          rsvpState, handleRSVP, regruvePosts, handleRegruve, savedPosts, handleSave, 
          handleCommentLike, handleCommentSubmit, themeMode } = useStore();

  const theme = themeMode === 'dark' ? DARK_THEME : LIGHT_THEME;

  const [isCollapsed, setIsCollapsed] = useState(true);
  const [reactionPickerVisible, setReactionPickerVisible] = useState(false);
  const [ticketModalVisible, setTicketModalVisible] = useState(false);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [hoveredIcon, setHoveredIcon] = useState(null);

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

  const checkAuth = (action) => {
    if (!user || user.isVisitor) {
      navigation?.navigate?.('Auth');
      return false;
    }
    return true;
  };

  const openGoogleMaps = (location) => {
    const query = encodeURIComponent(location || 'Unknown location');
    const url = Platform.OS === 'ios'
      ? `maps://maps.apple.com/?q=${query}`
      : `https://www.google.com/maps/search/?api=1&query=${query}`;
    Linking.openURL(url).catch(() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`));
  };

  const triggerHaptic = (type = 'light') => {
    if (Platform.OS !== 'web') {
      if (type === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      else if (type === 'medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      else if (type === 'heavy') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      else if (type === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleShare = async () => {
    triggerHaptic('light');
    const url = `https://thegruvs.app/event/${item.id}`;
    if (Platform.OS !== 'web' && typeof navigator?.share === 'function') {
      try { await navigator.share({ title: d.title, text: d.text, url }); } catch {}
    } else {
      Linking.openURL(`https://twitter.com/intent/tweet?text=${encodeURIComponent(d.title + ' ' + url)}`);
    }
  };

  const submitComment = () => {
    if (!checkAuth('comment')) return;
    if (!commentText.trim()) return;
    handleCommentSubmit(item.id, commentText.trim(), replyTo?.author, replyTo?.id);
    setCommentText('');
    setReplyTo(null);
  };

  const commentNodes = m.comments || [];
  const idMap = {};
  commentNodes.forEach(c => { idMap[c.id] = { ...c, children: [] }; });
  const rootComments = [];
  commentNodes.forEach(c => {
    if (c.parentId && idMap[c.parentId]) idMap[c.parentId].children.push(idMap[c.id]);
    else rootComments.push(idMap[c.id]);
  });

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const interactionGlow = useRef(new Animated.Value(0)).current;
  const heatAnim = useRef(new Animated.Value((m.liked_by?.length || 0) / 10)).current;

  React.useEffect(() => {
    Animated.spring(heatAnim, {
      toValue: Math.min((m.liked_by?.length || 0) / 10, 1),
      friction: 8,
      tension: 40,
      useNativeDriver: true
    }).start();
  }, [m.liked_by?.length]);

  React.useEffect(() => {
    if (getCountdown(d.dateTime) === 'Happening Now') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0.5, duration: 1500, useNativeDriver: true })
        ])
      ).start();
    }
  }, [d.dateTime]);

  const triggerInteraction = () => {
    interactionGlow.setValue(1);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.25, duration: 80, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 40, useNativeDriver: true })
      ]),
      Animated.timing(interactionGlow, { toValue: 0, duration: 600, useNativeDriver: true })
    ]).start();
  };

  return (
    <View style={[
      styles.postCard, 
      { backgroundColor: theme.card, borderColor: theme.cardBorder },
      item.is_paid && styles.paidCard,
      getCountdown(d.dateTime) === 'Happening Now' && [
        { borderColor: '#ef4444' },
        Platform.select({
          web: { boxShadow: themeMode === 'light' ? '0 0 15px rgba(239, 68, 68, 0.2)' : '0 0 15px rgba(239, 68, 68, 0.4)' },
          default: { shadowColor: '#ef4444', shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 }
        })
      ]
    ]}>
      {getCountdown(d.dateTime) === 'Happening Now' && (
        <Animated.View style={[
          styles.liveGlow, 
          { opacity: glowAnim, transform: [{ scale: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.05] }) }] }
        ]} />
      )}
      {item.is_paid && <Text style={styles.paidBadge}>PRO</Text>}

      <View style={styles.cardHeader}>
        <View style={styles.authorRow}>
          <TouchableOpacity
            onPress={() => navigation?.navigate?.('OtherProfile', { userId: d.author_id || item.id })}
            style={[styles.avatarCircle, { backgroundColor: theme.subtle }]}
            accessibilityLabel={`View ${d.author_name}'s profile`}
            accessibilityRole="button"
          >
            <Text style={[styles.avatarInitial, { color: theme.text }]} aria-hidden="true">{(d.author_name || 'V')[0]}</Text>
          </TouchableOpacity>
          <View>
            <Text style={[styles.authorName, { color: theme.text }]} accessibilityRole="header">
              {d.author_name}
              <Text
                style={[styles.followText, followedUsers.includes(d.author_id || item.id) && { color: theme.textDim }]}
                onPress={() => {
                  if (!checkAuth('follow')) return;
                  triggerHaptic('medium');
                  handleFollow(d.author_id || item.id);
                }}
                accessibilityLabel={followedUsers.includes(d.author_id || item.id) ? `Unfollow ${d.author_name}` : `Follow ${d.author_name}`}
                accessibilityRole="button"
              >
                {followedUsers.includes(d.author_id || item.id) ? '  Following' : '  Follow'}
              </Text>
            </Text>
            <Text style={[styles.postTime, { color: theme.textDim }]}>2h ago</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          {getCountdown(d.dateTime) && (
            <View
              style={[styles.countdownBadge, { backgroundColor: themeMode === 'light' ? 'rgba(255,77,166,0.05)' : 'rgba(255,77,166,0.12)' }]}
              accessibilityLabel={`Event status: ${getCountdown(d.dateTime)}`}
            >
              <MaterialCommunityIcons name="timer-outline" size={12} color={ACCENT} aria-hidden="true" />
              <Text style={styles.countdownText}>{getCountdown(d.dateTime)}</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.menuBtn}
            onPress={() => setActionSheetVisible(true)}
            accessibilityLabel="More post options"
            accessibilityRole="button"
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={theme.textDim} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.postBody}>
        <View style={[styles.categoryBadge, { backgroundColor: theme.subtle }]}><Text style={[styles.categoryText, { color: theme.textDim }]}>{d.category || 'General'}</Text></View>
        <Text style={[styles.eventTitle, { color: theme.text }]}>{d.title}</Text>
        <RichText text={d.text} style={[styles.eventDesc, { color: theme.text }]} />

        {item.is_regruve && (
          <View style={styles.reguveBanner}>
            <Ionicons name="repeat" size={12} color={theme.textDim} />
            <Text style={[styles.reguveBannerText, { color: theme.textDim }]}>{item.regruvedBy} Re-Gruved this</Text>
          </View>
        )}

        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={14} color={theme.textDim} />
          <Text style={[styles.detailText, { color: theme.textDim }]}>{d.dateTime || 'TBC'}</Text>
        </View>
        <TouchableOpacity style={styles.detailRow} onPress={() => openGoogleMaps(d.location)} activeOpacity={0.7}>
          <Ionicons name="navigate" size={14} color={ACCENT} />
          <Text style={[styles.detailText, { color: ACCENT, textDecorationLine: 'underline' }]}>{d.location || 'Unknown'}</Text>
          <Ionicons name="open-outline" size={11} color={ACCENT} style={{ marginLeft: 3 }} />
        </TouchableOpacity>

        {d.image && (
          <View style={[styles.mediaContainer, { backgroundColor: theme.subtle, borderColor: theme.cardBorder }]}>
            <Image 
              source={{ uri: d.image }} 
              style={styles.mediaImage}
              contentFit="cover"
              transition={300}
              cachePolicy="memory-disk"
            />
          </View>
        )}

        {/* NEW: Guest List Preview & Heat Indicator */}
        <View style={styles.communityMetrics}>
          <View style={styles.guestAvatars}>
            {['A','B','C'].map((p, i) => (
              <View key={i} style={[styles.guestAvatarSmall, { backgroundColor: theme.subtle, borderColor: theme.card, marginLeft: i === 0 ? 0 : -10, zIndex: 10 - i }]}>
                <Text style={[styles.guestInitial, { color: theme.text }]}>{p}</Text>
              </View>
            ))}
            <Text style={[styles.guestCountText, { color: theme.textDim }]}>{counts.going > 0 ? `+${counts.going} going` : 'Be the first'}</Text>
          </View>
          <View style={styles.heatWrap}>
            <View style={[styles.heatTrack, { backgroundColor: theme.subtle }]}>
              <Animated.View style={[styles.heatFill, { transform: [{ scaleX: heatAnim }, { translateX: heatAnim.interpolate({ inputRange: [0, 1], outputRange: [-50, 0] }) }] }]} />
            </View>
            <Text style={styles.heatLabel}>VIBE HEAT</Text>
          </View>
        </View>

        <View style={styles.rsvpWrapper}>
          <View style={styles.rsvpRow}>
            {[{ id:'going', icon:'checkmark-circle', label:`Going${counts.going>0?' · '+counts.going:''}`, activeColor:'#10b981' },
              { id:'interested', icon:'star-outline', label:`Interested${counts.interested>0?' · '+counts.interested:''}`, activeColor: GOLD },
              { id:'not_going', icon:'close-circle-outline', label:'Skip', activeColor:'#ef4444' }].map(btn => (
              <Animated.View key={btn.id} style={{ transform: [{ scale: myRSVP === btn.id ? scaleAnim : 1 }] }}>
                {myRSVP === btn.id && (
                  <Animated.View style={[styles.interactionGlowEffect, { backgroundColor: btn.activeColor, opacity: interactionGlow }]} />
                )}
                <TouchableOpacity
                  style={[
                    styles.rsvpBtn,
                    { backgroundColor: theme.bg, borderColor: theme.cardBorder },
                    myRSVP === btn.id && {
                      borderColor: btn.activeColor,
                      backgroundColor: btn.activeColor + '33',
                      borderWidth: 2
                    }
                  ]}
                  onPress={() => {
                    if (!checkAuth('rsvp')) return;
                    triggerHaptic('medium');
                    triggerInteraction();
                    handleRSVP(item.id, btn.id);
                  }}>
                  <Ionicons name={btn.icon} size={14} color={myRSVP === btn.id ? btn.activeColor : theme.textDim} />
                  <Text style={[styles.rsvpLabel, { color: theme.textDim }, myRSVP === btn.id && { color: btn.activeColor, fontWeight: '900' }]}>{btn.label}</Text>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>
        </View>

        <View style={[styles.engagRow, { borderTopColor: theme.cardBorder }]}>
          <View style={{ position:'relative' }}>
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            {myReaction && (
              <Animated.View style={[styles.interactionGlowEffect, { backgroundColor: topReaction?.color || ACCENT, opacity: interactionGlow, borderRadius: 20 }]} />
            )}
            <TouchableOpacity style={styles.engagBtn}
              onPress={() => {
                if (!checkAuth('react')) return;
                triggerHaptic('light');
                triggerInteraction();
                if (myReaction) handleReact(item.id, myReaction);
                else setReactionPickerVisible(!reactionPickerVisible);
              }}
              onLongPress={() => {
                if (!checkAuth('react')) return;
                triggerHaptic('medium');
                triggerInteraction();
                setReactionPickerVisible(true);
              }}
              accessibilityLabel={`${m.liked_by?.length || 0} reactions. ${myReaction ? 'You reacted with ' + myReaction : 'Double tap to react'}`}
              accessibilityRole="button"
              accessibilityHint="Long press to see all reactions"
              {...(Platform.OS === 'web' ? {
                onMouseEnter: () => setHoveredIcon('react'),
                onMouseLeave: () => setHoveredIcon(null)
              } : {})}>
              {topReaction
                ? <Ionicons name={topReaction.icon} size={20} color={topReaction.color} />
                : <Ionicons name="heart-outline" size={20} color={theme.textDim} />}
              <Text style={[styles.engagCount, { color: theme.textDim }, myReaction && { color: ACCENT }]}>{m.liked_by?.length || 0}</Text>
              {hoveredIcon === 'react' && <View style={[styles.tooltip, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}><Text style={[styles.tooltipText, { color: theme.text }]}>React</Text></View>}
            </TouchableOpacity>
          </Animated.View>
            {reactionPickerVisible && (
              <View style={[styles.reactionPicker, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                {REACTIONS.map(r => (
                  <TouchableOpacity key={r.id} style={styles.reactionPickerBtn} onPress={() => { handleReact(item.id, r.id); setReactionPickerVisible(false); }}>
                    <Ionicons name={r.icon} size={22} color={r.color} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <TouchableOpacity
            style={styles.engagBtn}
            onPress={() => setIsCollapsed(!isCollapsed)}
            accessibilityLabel={`${m.comments?.length || 0} comments`}
            accessibilityRole="button"
            accessibilityHint="Toggles the comment section"
            {...(Platform.OS === 'web' ? {
              onMouseEnter: () => setHoveredIcon('comment'),
              onMouseLeave: () => setHoveredIcon(null)
            } : {})}>
            <Ionicons name="chatbubble-outline" size={18} color={theme.textDim} />
            <Text style={[styles.engagCount, { color: theme.textDim }]}>{m.comments?.length || 0}</Text>
            {hoveredIcon === 'comment' && <View style={[styles.tooltip, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}><Text style={[styles.tooltipText, { color: theme.text }]}>Comment</Text></View>}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.engagBtn}
            onPress={() => {
              if (!checkAuth('regruve')) return;
              triggerHaptic('medium');
              handleRegruve(item.id);
            }}
            accessibilityLabel={isReguved ? "Un-Regruve" : "Re-Gruve"}
            accessibilityRole="button"
            {...(Platform.OS === 'web' ? {
              onMouseEnter: () => setHoveredIcon('regruve'),
              onMouseLeave: () => setHoveredIcon(null)
            } : {})}>
            <Ionicons name={isReguved ? "repeat" : "repeat-outline"} size={18} color={isReguved ? '#a855f7' : theme.textDim} />
            {hoveredIcon === 'regruve' && <View style={[styles.tooltip, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}><Text style={[styles.tooltipText, { color: theme.text }]}>Re-Gruve</Text></View>}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.engagBtn}
            onPress={handleShare}
            accessibilityLabel="Share post"
            accessibilityRole="button"
            {...(Platform.OS === 'web' ? {
              onMouseEnter: () => setHoveredIcon('share'),
              onMouseLeave: () => setHoveredIcon(null)
            } : {})}>
            <Feather name="send" size={17} color={theme.textDim} />
            {hoveredIcon === 'share' && <View style={[styles.tooltip, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}><Text style={[styles.tooltipText, { color: theme.text }]}>Share</Text></View>}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.engagBtn, { marginLeft:'auto' }]}
            onPress={() => {
              if (!checkAuth('save')) return;
              triggerHaptic('light');
              handleSave(item.id);
            }}
            accessibilityLabel={isSaved ? "Remove from bookmarks" : "Save to bookmarks"}
            accessibilityRole="button"
            {...(Platform.OS === 'web' ? {
              onMouseEnter: () => setHoveredIcon('save'),
              onMouseLeave: () => setHoveredIcon(null)
            } : {})}>
            <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={18} color={isSaved ? GOLD : theme.textDim} />
            {hoveredIcon === 'save' && <View style={[styles.tooltip, { right: 0, left: 'auto', backgroundColor: theme.card, borderColor: theme.cardBorder }]}><Text style={[styles.tooltipText, { color: theme.text }]}>Save</Text></View>}
          </TouchableOpacity>
        </View>


        {!isCollapsed && (
          <View style={[styles.commentSection, { borderTopColor: theme.cardBorder }]}>
            <View style={styles.commentsHeader}>
              <Text style={[styles.sectionTitle, { color: ACCENT }]}>{m.comments?.length || 0} Comments</Text>
              <TouchableOpacity onPress={() => setIsCollapsed(true)}>
                <Text style={[styles.collapseText, { color: theme.textDim }]}>COLLAPSE ▲</Text>
              </TouchableOpacity>
            </View>

            {sortComments(rootComments).map(c => (
              <CommentNode
                key={c.id}
                c={c}
                depth={0}
                item={item}
                user={user}
                handleCommentLike={handleCommentLike}
                setReplyTo={setReplyTo}
                theme={theme}
                handleSave={handleSave}
              />
            ))}

            {replyTo && (
              <Text style={[styles.replyingTo, { color: theme.textDim }]}>↩ Replying to @{replyTo.author}  <Text onPress={() => setReplyTo(null)} style={{ color: ACCENT }}>✕</Text></Text>
            )}
            <View style={styles.commentInputRow}>
              <TextInput
                style={[styles.commentInput, { backgroundColor: theme.subtle, color: theme.text, borderColor: theme.cardBorder }]}
                placeholder={replyTo ? `Reply to @${replyTo.author}...` : 'Join the chat...'}
                placeholderTextColor={theme.textDim}
                value={commentText}
                onChangeText={setCommentText}
                onSubmitEditing={submitComment}
              />
              <TouchableOpacity style={styles.sendBtn} onPress={() => setShowVoiceRecorder(!showVoiceRecorder)}>
                <Ionicons name="mic" size={16} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.sendBtn} onPress={submitComment}>
                <Ionicons name="send" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      <TicketModal visible={ticketModalVisible} onClose={() => setTicketModalVisible(false)} event={item} />

      {/* Post Actions Sheet */}
      <Modal
        visible={actionSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setActionSheetVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setActionSheetVisible(false)}
        />
        <View style={[styles.actionSheet, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={[styles.sheetHandle, { backgroundColor: theme.subtle }]} />
          <Text style={[styles.sheetTitle, { color: theme.text }]}>Post Actions</Text>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
            {[
              { id: 'copy', label: 'Copy Link', icon: 'link-outline' },
              { id: 'wishlist', label: 'Save to Wishlist', icon: 'heart-outline' },
              { id: 'pin', label: 'Pin Post', icon: 'pin-outline' },
              { id: 'translate', label: 'Translate', icon: 'language-outline' },
              { id: 'dm', label: 'Send via DM', icon: 'paper-plane-outline' },
              { id: 'tag', label: 'Tag a Friend', icon: 'person-add-outline' },
              { id: 'mute', label: 'Mute Notifications', icon: 'notifications-off-outline' },
              { id: 'hide', label: 'Hide Post', icon: 'eye-off-outline' },
              { id: 'remind', label: 'Remind Me', icon: 'alarm-outline' },
              { id: 'feature', label: 'Feature on Profile', icon: 'medal-outline' },
              { id: 'calendar', label: 'Add to Calendar', icon: 'calendar-outline' },
              { id: 'maps', label: 'Open in Maps', icon: 'map-outline' },
              { id: 'story', label: 'Share to Story', icon: 'aperture-outline' },
              { id: 'save_img', label: 'Save Image', icon: 'download-outline' },
              { id: 'analytics', label: 'View Analytics', icon: 'analytics-outline' },
              { id: 'qr', label: 'Show QR Code', icon: 'qr-code-outline' },
              { id: 'report', label: 'Report Content', icon: 'alert-circle-outline', color: '#ef4444' },
            ].map((action) => (
              <TouchableOpacity
                key={action.id}
                style={[styles.actionItem, { borderBottomColor: theme.cardBorder }]}
                onPress={() => {
                  console.log(`Action: ${action.label}`);
                  setActionSheetVisible(false);
                }}
              >
                <Ionicons name={action.icon} size={22} color={action.color || theme.textDim} />
                <Text style={[styles.actionLabel, { color: theme.text }, action.color && { color: action.color }]}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  postCard: { 
    padding: 18,
    marginHorizontal: 16, 
    marginVertical: 8, 
    borderRadius: 24,
    borderWidth: 1, 
    ...Platform.select({
      web: { boxShadow: '0 4px 20px rgba(0,0,0,0.06)' },
      default: { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.05, shadowRadius: 20, elevation: 5 }
    })
  },
  paidCard: { 
    borderWidth: 1.5,
    borderColor: ACCENT,
    ...Platform.select({
      web: { boxShadow: `0 8px 25px ${ACCENT}15` },
      default: { shadowColor: ACCENT, shadowOpacity: 0.1, shadowRadius: 25 }
    })
  },
  paidBadge: { position: 'absolute', top: 12, right: 12, backgroundColor: GOLD, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, overflow: 'hidden', color: '#fff', fontWeight: '900', fontSize: 10, zIndex: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  authorRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  avatarCircle: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 16, fontWeight: '800' },
  authorName: { fontSize: 15, fontWeight: '700' },
  followText: { color: ACCENT, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  postTime: { fontSize: 12, marginTop: 2 },
  menuBtn: { padding: 4 },
  postBody: { paddingLeft: 0 },
  categoryBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginBottom: 10 },
  categoryText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  eventTitle: { fontSize: 20, fontWeight: '800', marginBottom: 6, lineHeight: 28 },
  eventDesc: { opacity: 0.8, fontSize: 15, lineHeight: 24, marginBottom: 14 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  detailText: { fontSize: 14, fontWeight: '500' },
  mediaContainer: { width: '100%', height: 220, borderRadius: 20, overflow: 'hidden', marginVertical: 14, borderWidth: 1 },
  mediaImage: { width: '100%', height: '100%' },
  rsvpWrapper: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 10 },
  rsvpRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', flex: 1 },
  rsvpBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1 },
  rsvpLabel: { fontSize: 11, fontWeight: '700' },
  
  engagRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 12, borderTopWidth: 1 },
  engagBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, position: 'relative' },
  engagCount: { fontSize: 14, fontWeight: '600' },
  
  tooltip: {
    position: 'absolute',
    bottom: '100%',
    left: '50%',
    transform: [{ translateX: -30 }, { translateY: -5 }],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    zIndex: 1000,
    width: 70,
    alignItems: 'center',
    ...Platform.select({
      web: { boxShadow: '0 4px 10px rgba(0,0,0,0.1)' },
      default: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5 }
    })
  },
  tooltipText: { fontSize: 10, fontWeight: '700' },

  reactionPicker: {
    position: 'absolute', 
    bottom: 38, 
    left: 0, 
    flexDirection: 'row', 
    borderRadius: 30,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
    borderWidth: 1, 
    zIndex: 999,
    ...Platform.select({
      web: { boxShadow: '0 10px 25px rgba(0,0,0,0.15)' },
      default: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 15 }
    })
  },
  reactionPickerBtn: { padding: 6 },

  commentSection: { borderTopWidth: 1, paddingTop: 14 },
  commentsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontWeight: '800', fontSize: 14 },
  collapseText: { fontSize: 11, fontWeight: '700' },
  commentNode: { marginBottom: 14, paddingLeft: 12, borderLeftWidth: 2 },
  tierBadge: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginBottom: 3 },
  replyingTo: { fontSize: 11, marginBottom: 4 },
  commentAuthor: { fontWeight: '700', fontSize: 13 },
  commentBody: { fontWeight: '400' },
  commentActions: { flexDirection: 'row', gap: 14, marginTop: 6 },
  commentActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  commentActionText: { fontSize: 12 },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  commentInput: { flex: 1, height: 44, borderRadius: 16, paddingHorizontal: 14, fontSize: 14, borderWidth: 1 },
  sendBtn: { width: 44, height: 44, borderRadius: 16, backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center' },

  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  countdownBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,77,166,0.08)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  countdownText: { color: ACCENT, fontSize: 11, fontWeight: '800' },
  liveGlow: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#ef4444',
    zIndex: -1,
    opacity: 0.3,
  },
  communityMetrics: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginVertical: 12,
    paddingHorizontal: 4
  },
  guestAvatars: { flexDirection: 'row', alignItems: 'center' },
  guestAvatarSmall: { 
    width: 24, 
    height: 24, 
    borderRadius: 12, 
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center' 
  },
  guestInitial: { fontSize: 10, fontWeight: 'bold' },
  guestCountText: { fontSize: 11, fontWeight: '700', marginLeft: 8 },
  heatWrap: { flex: 1, maxWidth: 100, alignItems: 'flex-end' },
  heatTrack: { width: '100%', height: 4, borderRadius: 2, overflow: 'hidden' },
  heatFill: { height: '100%', backgroundColor: ACCENT },
  heatLabel: { color: ACCENT, fontSize: 8, fontWeight: '900', marginTop: 4, letterSpacing: 1 },
  interactionGlowEffect: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 18,
    zIndex: -1,
  },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,5,16,0.6)' },
  actionSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    maxHeight: '80%',
    borderWidth: 1,
    ...Platform.select({
      web: { boxShadow: '0 -10px 40px rgba(0,0,0,0.1)' },
      default: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20 }
    })
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 20,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  actionLabel: {
    opacity: 0.7,
    fontSize: 15,
    fontWeight: '600',
  },
});
