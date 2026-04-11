// SAFETY & MODERATION SYSTEM
// Report content, user management, spam detection

import AsyncStorage from '@react-native-async-storage/async-storage';

export const SafetyManager = {
  // REPORT CONTENT
  async reportContent(reporterId, contentType, contentId, reason, description) {
    try {
      const report = {
        id: `report_${Date.now()}`,
        reporterId,
        contentType, // 'event', 'comment', 'user', 'message'
        contentId,
        reason, // 'spam', 'harassment', 'hate_speech', 'violence', 'explicit', 'misinformation', 'copyrighted', 'other'
        description,
        status: 'pending', // pending, under_review, resolved, dismissed
        createdAt: new Date().toISOString(),
        reviewedAt: null,
        reviewedBy: null
      };

      const key = `report_${report.id}`;
      await AsyncStorage.setItem(key, JSON.stringify(report));

      // Add to reports queue
      const reportsQueueKey = 'moderation_queue';
      const queue = await AsyncStorage.getItem(reportsQueueKey) || '[]';
      const queueArray = JSON.parse(queue);
      queueArray.push(report.id);
      await AsyncStorage.setItem(reportsQueueKey, JSON.stringify(queueArray));

      // Flag content
      if (contentType === 'event') {
        const event = await AsyncStorage.getItem(`event_${contentId}`);
        const eventData = JSON.parse(event || '{}');
        eventData.reported = true;
        eventData.reportedCount = (eventData.reportedCount || 0) + 1;
        if (!eventData.reportReasons) eventData.reportReasons = [];
        eventData.reportReasons.push(reason);
        await AsyncStorage.setItem(`event_${contentId}`, JSON.stringify(eventData));
      }

      return { success: true, report };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // BLOCK USER
  async blockUser(userId, blockedUserId) {
    try {
      const userKey = `user_${userId}`;
      const user = await AsyncStorage.getItem(userKey);
      const userData = JSON.parse(user || '{}');

      if (!userData.blocked) userData.blocked = [];
      if (!userData.blocked.includes(blockedUserId)) {
        userData.blocked.push(blockedUserId);
      }

      await AsyncStorage.setItem(userKey, JSON.stringify(userData));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // UNBLOCK USER
  async unblockUser(userId, blockedUserId) {
    try {
      const userKey = `user_${userId}`;
      const user = await AsyncStorage.getItem(userKey);
      const userData = JSON.parse(user || '{}');

      if (userData.blocked) {
        userData.blocked = userData.blocked.filter(id => id !== blockedUserId);
      }

      await AsyncStorage.setItem(userKey, JSON.stringify(userData));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // CHECK IF BLOCKED
  async isBlocked(userId1, userId2) {
    try {
      const user = await AsyncStorage.getItem(`user_${userId1}`);
      const userData = JSON.parse(user || '{}');
      return (userData.blocked || []).includes(userId2);
    } catch {
      return false;
    }
  },

  // AUTO-MODERATION (Keyword filtering)
  async checkContent(text) {
    const prohibitedWords = [
      'spam', 'hate', 'violence', 'exploit', 'illegal'
      // Add more as needed
    ];

    const lowerText = text.toLowerCase();
    const flagged = prohibitedWords.some(word => lowerText.includes(word));

    return {
      flagged,
      severity: flagged ? 'medium' : 'low',
      recommendation: flagged ? 'review' : 'allow'
    };
  },

  // SPAM DETECTION
  async detectSpam(userId) {
    try {
      // Track user activity
      const activityKey = `user_activity_${userId}`;
      const activity = await AsyncStorage.getItem(activityKey) || '{"actions": [], "lastReset": ""}';
      const activityData = JSON.parse(activity);

      // Reset if n the last hour has passed
      const lastReset = new Date(activityData.lastReset).getTime();
      const now = Date.now();
      if (now - lastReset > 3600000) {
        activityData.actions = [];
        activityData.lastReset = new Date().toISOString();
      }

      // Check action frequency
      const actionCount = activityData.actions.length;
      let isSpam = false;

      if (actionCount > 50) {
        isSpam = true; // More than 50 actions per hour
      }

      activityData.actions.push({ timestamp: now });
      await AsyncStorage.setItem(activityKey, JSON.stringify(activityData));

      return { isSpam, actionCount };
    } catch (err) {
      return { isSpam: false, actionCount: 0 };
    }
  },

  // BAN USER
  async banUser(userId, reason, duration = 'permanent') {
    try {
      const userKey = `user_${userId}`;
      const user = await AsyncStorage.getItem(userKey);
      const userData = JSON.parse(user || '{}');

      userData.accountStatus = 'banned';
      userData.banReason = reason;
      userData.banDuration = duration;
      userData.bannedAt = new Date().toISOString();

      if (duration !== 'permanent') {
        const durationMs = this.parseDuration(duration);
        userData.banExpiresAt = new Date(Date.now() + durationMs).toISOString();
      }

      await AsyncStorage.setItem(userKey, JSON.stringify(userData));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  parseDuration(duration) {
    const units = { '1h': 3600000, '1d': 86400000, '7d': 604800000, '30d': 2592000000 };
    return units[duration] || 0;
  }
};

// GAMIFICATION SYSTEM
export const GamificationEngine = {
  // ACHIEVE SYSTEM
  ACHIEVEMENTS: {
    socialbutterfly: {
      id: 'socialbutterfly',
      name: 'Social Butterfly',
      description: 'Get 50 followers',
      icon: '🦋',
      requirement: 50,
      points: 100,
      rarity: 'uncommon'
    },
    eventmaster: {
      id: 'eventmaster',
      name: 'Event Master',
      description: 'Create 10 events',
      icon: '🎪',
      requirement: 10,
      points: 150,
      rarity: 'rare'
    },
    networker: {
      id: 'networker',
      name: 'Networker',
      description: 'Attend 20 events',
      icon: '🤝',
      requirement: 20,
      points: 100,
      rarity: 'uncommon'
    },
    influencer: {
      id: 'influencer',
      name: 'Influencer',
      description: 'Get 500 engagement on an event',
      icon: '⭐',
      requirement: 500,
      points: 250,
      rarity: 'epic'
    },
    generous: {
      id: 'generous',
      name: 'Generous Soul',
      description: 'Share 50 events',
      icon: '🎁',
      requirement: 50,
      points: 125,
      rarity: 'rare'
    }
  },

  // ADD POINTS
  async addPoints(userId, points, reason) {
    try {
      const userKey = `user_${userId}`;
      const user = await AsyncStorage.getItem(userKey);
      const userData = JSON.parse(user || '{}');

      userData.points = (userData.points || 0) + points;

      // Level up system
      const levelsPerRank = 1000;
      userData.level = Math.floor(userData.points / levelsPerRank) + 1;

      // Track activity
      if (!userData.activityLog) userData.activityLog = [];
      userData.activityLog.push({
        type: 'points_earned',
        amount: points,
        reason,
        timestamp: new Date().toISOString()
      });

      await AsyncStorage.setItem(userKey, JSON.stringify(userData));

      // Check achievements
      await this.checkAchievements(userId, userData);

      return { success: true, points: userData.points, level: userData.level };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // CHECK ACHIEVEMENTS
  async checkAchievements(userId, userData) {
    try {
      const userKey = `user_${userId}`;

      if (!userData.achievements) userData.achievements = [];

      for (const [key, achievement] of Object.entries(this.ACHIEVEMENTS)) {
        if (userData.achievements.includes(key)) continue; // Already unlocked

        let shouldUnlock = false;

        switch (key) {
          case 'socialbutterfly':
            shouldUnlock = (userData.followers?.length || 0) >= 50;
            break;
          case 'eventmaster':
            shouldUnlock = (userData.eventsCreated || 0) >= 10;
            break;
          case 'networker':
            shouldUnlock = (userData.eventsAttended || 0) >= 20;
            break;
          case 'generous':
            shouldUnlock = (userData.eventsShared || 0) >= 50;
            break;
        }

        if (shouldUnlock) {
          userData.achievements.push(key);
          userData.badges = userData.badges || [];
          userData.badges.push({
            id: achievement.id,
            name: achievement.name,
            icon: achievement.icon,
            unlockedAt: new Date().toISOString()
          });

          // Reward points
          userData.points = (userData.points || 0) + achievement.points;
        }
      }

      await AsyncStorage.setItem(userKey, JSON.stringify(userData));
      return { success: true };
    } catch (err) {
      return { success: false };
    }
  },

  // LEADERBOARD
  async getLeaderboard(limit = 100) {
    try {
      // TODO: Aggregate all users and sort by points
      return {
        success: true,
        leaderboard: [
          { rank: 1, name: 'Alice', points: 5000, badges: 3 },
          { rank: 2, name: 'Bob', points: 4500, badges: 2 },
          { rank: 3, name: 'Carol', points: 4000, badges: 2 }
        ]
      };
    } catch (err) {
      return { success: false, leaderboard: [] };
    }
  },

  // STREAK SYSTEM
  async incrementStreak(userId) {
    try {
      const userKey = `user_${userId}`;
      const user = await AsyncStorage.getItem(userKey);
      const userData = JSON.parse(user || '{}');

      const lastActivity = new Date(userData.lastActive).getTime();
      const now = Date.now();
      const daysDiff = (now - lastActivity) / (1000 * 60 * 60 * 24);

      if (daysDiff > 1) {
        userData.streak = 1; // Reset streak
      } else {
        userData.streak = (userData.streak || 0) + 1;
      }

      userData.lastActive = new Date().toISOString();
      await AsyncStorage.setItem(userKey, JSON.stringify(userData));

      return { success: true, streak: userData.streak };
    } catch (err) {
      return { success: false };
    }
  }
};
