import AsyncStorage from '@react-native-async-storage/async-storage';

// User preferences storage
export const StorageKeys = {
  USER_PROFILE: '@gruv_user',
  THEME_PREFERENCE: '@gruv_theme',
  SAVED_EVENTS: '@gruv_saved',
  USER_INTERESTS: '@gruv_interests',
  FOLLOWING: '@gruv_following',
  FOLLOWERS: '@gruv_followers'
};

export const UserStorage = {
  async saveUser(user) {
    try {
      await AsyncStorage.setItem(StorageKeys.USER_PROFILE, JSON.stringify(user));
      return true;
    } catch (err) {
      console.error('Error saving user:', err);
      return false;
    }
  },

  async getUser() {
    try {
      const user = await AsyncStorage.getItem(StorageKeys.USER_PROFILE);
      return user ? JSON.parse(user) : null;
    } catch (err) {
      console.error('Error getting user:', err);
      return null;
    }
  },

  async clearUser() {
    try {
      await AsyncStorage.removeItem(StorageKeys.USER_PROFILE);
      await AsyncStorage.removeItem(StorageKeys.FOLLOWING);
      await AsyncStorage.removeItem(StorageKeys.FOLLOWERS);
      return true;
    } catch (err) {
      console.error('Error clearing user:', err);
      return false;
    }
  }
};

export const SocialStorage = {
  async getFollowing() {
    try {
      const following = await AsyncStorage.getItem(StorageKeys.FOLLOWING);
      return following ? JSON.parse(following) : [];
    } catch (err) {
      console.error('Error getting following:', err);
      return [];
    }
  },

  async getFollowers() {
    try {
      const followers = await AsyncStorage.getItem(StorageKeys.FOLLOWERS);
      return followers ? JSON.parse(followers) : [];
    } catch (err) {
      console.error('Error getting followers:', err);
      return [];
    }
  },

  async followUser(targetUserId) {
    try {
      const following = await this.getFollowing();
      if (!following.includes(targetUserId)) {
        const newFollowing = [...following, targetUserId];
        await AsyncStorage.setItem(StorageKeys.FOLLOWING, JSON.stringify(newFollowing));
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error following user:', err);
      return false;
    }
  },

  async unfollowUser(targetUserId) {
    try {
      const following = await this.getFollowing();
      const newFollowing = following.filter(id => id !== targetUserId);
      await AsyncStorage.setItem(StorageKeys.FOLLOWING, JSON.stringify(newFollowing));
      return true;
    } catch (err) {
      console.error('Error unfollowing user:', err);
      return false;
    }
  }
};

export const ThemeStorage = {
  async saveThemePreference(gender) {
    try {
      await AsyncStorage.setItem(StorageKeys.THEME_PREFERENCE, gender);
      return true;
    } catch (err) {
      console.error('Error saving theme:', err);
      return false;
    }
  },

  async getThemePreference() {
    try {
      return await AsyncStorage.getItem(StorageKeys.THEME_PREFERENCE) || 'male';
    } catch (err) {
      console.error('Error getting theme:', err);
      return 'male';
    }
  }
};

export const EventStorage = {
  async saveEvents(events) {
    try {
      await AsyncStorage.setItem(StorageKeys.SAVED_EVENTS, JSON.stringify(events));
      return true;
    } catch (err) {
      console.error('Error saving events:', err);
      return false;
    }
  },

  async getEvents() {
    try {
      const events = await AsyncStorage.getItem(StorageKeys.SAVED_EVENTS);
      return events ? JSON.parse(events) : [];
    } catch (err) {
      console.error('Error getting events:', err);
      return [];
    }
  }
};

// Geolocation helper
export const LocationHelper = {
  async getDistance(lat1, lon1, lat2, lon2) {
    // Haversine formula for distance calculation
    const R = 6371; // Radius of Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  },

  async getCurrentLocation() {
    try {
      const { Location } = require('expo-location');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;
      const location = await Location.getCurrentPositionAsync({});
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      };
    } catch (err) {
      console.error('Error getting location:', err);
      return null;
    }
  }
};

// Search analytics
export const Analytics = {
  async trackSearch(query, results) {
    // Track search for analytics
    console.log(`Search: "${query}" - Results: ${results}`);
  },

  async trackEventView(eventId, eventTitle) {
    // Track event views
    console.log(`Viewed event: ${eventTitle} (${eventId})`);
  },

  async trackEngagement(eventId, action) {
    // Track likes, RSVPs, comments
    console.log(`Event ${eventId}: ${action}`);
  }
};
