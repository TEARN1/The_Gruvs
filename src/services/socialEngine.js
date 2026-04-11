// SOCIAL FEATURES ENGINE
// Handles all social interactions: follow, like, share, bookmark, etc.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createNotification } from './models';

export const SocialEngine = {
  // FOLLOW SYSTEM
  async followUser(userId, targetUserId) {
    try {
      const user = await AsyncStorage.getItem(`user_${userId}`);
      const targetUser = await AsyncStorage.getItem(`user_${targetUserId}`);

      if (!user || !targetUser) return { success: false, error: 'User not found' };

      const userData = JSON.parse(user);
      const targetData = JSON.parse(targetUser);

      if (!userData.following) userData.following = [];
      if (userData.following.includes(targetUserId)) {
        return { success: false, error: 'Already following' };
      }

      userData.following.push(targetUserId);
      if (!targetData.followers) targetData.followers = [];
      targetData.followers.push(userId);

      await AsyncStorage.setItem(`user_${userId}`, JSON.stringify(userData));
      await AsyncStorage.setItem(`user_${targetUserId}`, JSON.stringify(targetData));

      // Notification
      const notification = createNotification({
        recipientId: targetUserId,
        senderId: userId,
        type: 'follow',
        title: `${userData.name} followed you`,
        message: `${userData.name} started following you!`,
        icon: '👥',
        actionUrl: `/profile/${userId}`
      });

      return { success: true, notification };
    } catch (err) {
      console.error('Error following user:', err);
      return { success: false, error: err.message };
    }
  },

  async unfollowUser(userId, targetUserId) {
    try {
      const user = await AsyncStorage.getItem(`user_${userId}`);
      const targetUser = await AsyncStorage.getItem(`user_${targetUserId}`);

      const userData = JSON.parse(user);
      const targetData = JSON.parse(targetUser);

      userData.following = userData.following.filter(id => id !== targetUserId);
      targetData.followers = targetData.followers.filter(id => id !== userId);

      await AsyncStorage.setItem(`user_${userId}`, JSON.stringify(userData));
      await AsyncStorage.setItem(`user_${targetUserId}`, JSON.stringify(targetData));

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  async isFollowing(userId, targetUserId) {
    try {
      const user = await AsyncStorage.getItem(`user_${userId}`);
      const userData = JSON.parse(user);
      return userData.following?.includes(targetUserId) || false;
    } catch {
      return false;
    }
  },

  // LIKE SYSTEM (EXPANDED)
  async likeEvent(userId, eventId, userName) {
    try {
      const event = await AsyncStorage.getItem(`event_${eventId}`);
      const eventData = JSON.parse(event || '{}');

      if (!eventData.engagement_metrics) {
        eventData.engagement_metrics = { likes: [], likeCount: 0 };
      }

      if (!eventData.engagement_metrics.likes) {
        eventData.engagement_metrics.likes = [];
      }

      if (eventData.engagement_metrics.likes.includes(userId)) {
        eventData.engagement_metrics.likes = eventData.engagement_metrics.likes.filter(id => id !== userId);
      } else {
        eventData.engagement_metrics.likes.push(userId);
      }

      eventData.engagement_metrics.likeCount = eventData.engagement_metrics.likes.length;
      await AsyncStorage.setItem(`event_${eventId}`, JSON.stringify(eventData));

      return { success: true, liked: eventData.engagement_metrics.likes.includes(userId) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // REACTION SYSTEM (NEW)
  async addReaction(userId, eventId, reactionEmoji) {
    try {
      const event = await AsyncStorage.getItem(`event_${eventId}`);
      const eventData = JSON.parse(event || '{}');

      if (!eventData.engagement_metrics) {
        eventData.engagement_metrics = { reactions: {} };
      }

      if (!eventData.engagement_metrics.reactions) {
        eventData.engagement_metrics.reactions = {};
      }

      if (!eventData.engagement_metrics.reactions[reactionEmoji]) {
        eventData.engagement_metrics.reactions[reactionEmoji] = [];
      }

      if (!eventData.engagement_metrics.reactions[reactionEmoji].includes(userId)) {
        eventData.engagement_metrics.reactions[reactionEmoji].push(userId);
      }

      await AsyncStorage.setItem(`event_${eventId}`, JSON.stringify(eventData));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // SAVE/BOOKMARK SYSTEM
  async saveEvent(userId, eventId) {
    try {
      const user = await AsyncStorage.getItem(`user_${userId}`);
      const userData = JSON.parse(user || '{}');

      if (!userData.eventsSaved) userData.eventsSaved = [];
      if (!userData.eventsSaved.includes(eventId)) {
        userData.eventsSaved.push(eventId);
      }

      await AsyncStorage.setItem(`user_${userId}`, JSON.stringify(userData));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  async unsaveEvent(userId, eventId) {
    try {
      const user = await AsyncStorage.getItem(`user_${userId}`);
      const userData = JSON.parse(user || '{}');

      if (userData.eventsSaved) {
        userData.eventsSaved = userData.eventsSaved.filter(id => id !== eventId);
      }

      await AsyncStorage.setItem(`user_${userId}`, JSON.stringify(userData));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // SHARE SYSTEM
  async shareEvent(userId, eventId, eventTitle, platform = 'generic') {
    try {
      const event = await AsyncStorage.getItem(`event_${eventId}`);
      const eventData = JSON.parse(event || '{}');

      if (!eventData.engagement_metrics.sharedBy) {
        eventData.engagement_metrics.sharedBy = [];
      }

      eventData.engagement_metrics.sharedBy.push({
        userId,
        platform,
        timestamp: new Date().toISOString()
      });

      eventData.engagement_metrics.shareCount = (eventData.engagement_metrics.shareCount || 0) + 1;
      await AsyncStorage.setItem(`event_${eventId}`, JSON.stringify(eventData));

      return {
        success: true,
        shareUrl: `https://thegruvs.app/event/${eventId}?shared_by=${userId}`,
        platforms: {
          facebook: `https://facebook.com/sharer/sharer.php?u=https://thegruvs.app/event/${eventId}`,
          twitter: `https://twitter.com/intent/tweet?text=Check%20out%20${eventTitle}&url=https://thegruvs.app/event/${eventId}`,
          whatsapp: `https://wa.me/?text=Check%20out%20this%20event:%20${eventTitle}%20https://thegruvs.app/event/${eventId}`,
          email: `mailto:?subject=${eventTitle}&body=Check%20out%20this%20event:%20https://thegruvs.app/event/${eventId}`
        }
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // BLOCK SYSTEM
  async blockUser(userId, targetUserId) {
    try {
      const user = await AsyncStorage.getItem(`user_${userId}`);
      const userData = JSON.parse(user || '{}');

      if (!userData.blocked) userData.blocked = [];
      if (!userData.blocked.includes(targetUserId)) {
        userData.blocked.push(targetUserId);
      }

      await AsyncStorage.setItem(`user_${userId}`, JSON.stringify(userData));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // MUTE SYSTEM
  async muteUser(userId, targetUserId) {
    try {
      const user = await AsyncStorage.getItem(`user_${userId}`);
      const userData = JSON.parse(user || '{}');

      if (!userData.mutedUsers) userData.mutedUsers = [];
      if (!userData.mutedUsers.includes(targetUserId)) {
        userData.mutedUsers.push(targetUserId);
      }

      await AsyncStorage.setItem(`user_${userId}`, JSON.stringify(userData));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  async muteCategory(userId, category) {
    try {
      const user = await AsyncStorage.getItem(`user_${userId}`);
      const userData = JSON.parse(user || '{}');

      if (!userData.mutedCategories) userData.mutedCategories = [];
      if (!userData.mutedCategories.includes(category)) {
        userData.mutedCategories.push(category);
      }

      await AsyncStorage.setItem(`user_${userId}`, JSON.stringify(userData));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // TAG SYSTEM
  async addTag(userId, tagName) {
    try {
      const user = await AsyncStorage.getItem(`user_${userId}`);
      const userData = JSON.parse(user || '{}');

      if (!userData.tags) userData.tags = [];
      if (!userData.tags.includes(tagName)) {
        userData.tags.push(tagName);
      }

      await AsyncStorage.setItem(`user_${userId}`, JSON.stringify(userData));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // MENTION SYSTEM
  async extractMentions(text) {
    const mentionRegex = /@(\w+)/g;
    const mentions = [];
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push(match[1]);
    }

    return mentions;
  },

  // HASHTAG SYSTEM
  async extractHashtags(text) {
    const hashtagRegex = /#(\w+)/g;
    const hashtags = [];
    let match;

    while ((match = hashtagRegex.exec(text)) !== null) {
      hashtags.push(match[1]);
    }

    return hashtags;
  },

  async addHashtagTrend(hashtag) {
    try {
      const key = `trend_${hashtag}`;
      const trend = await AsyncStorage.getItem(key) || '{"count": 0, "lastUpdated": ""}';
      const trendData = JSON.parse(trend);

      trendData.count = (trendData.count || 0) + 1;
      trendData.lastUpdated = new Date().toISOString();

      await AsyncStorage.setItem(key, JSON.stringify(trendData));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // STATS CALCULATION
  async getUserStats(userId) {
    try {
      const user = await AsyncStorage.getItem(`user_${userId}`);
      const userData = JSON.parse(user || '{}');

      return {
        followers: userData.followers?.length || 0,
        following: userData.following?.length || 0,
        eventsCreated: userData.eventsCreated || 0,
        eventsAttended: userData.eventsAttended || 0,
        eventsSaved: userData.eventsSaved?.length || 0,
        points: userData.points || 0,
        level: userData.level || 1,
        reputation: userData.reputation || 100
      };
    } catch (err) {
      return {};
    }
  }
};
