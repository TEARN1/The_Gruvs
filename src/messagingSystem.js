// MESSAGING SYSTEM
// Direct messages, group chats, notifications

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createMessage, createConversation, createNotification } from './models';

export const MessagingSystem = {
  // CREATE CONVERSATION
  async createConversation(participants, name = null) {
    try {
      const conversation = createConversation(participants);
      if (name) conversation.name = name;

      const key = `conversation_${conversation.id}`;
      await AsyncStorage.setItem(key, JSON.stringify(conversation));

      // Add to each participant's conversation list
      for (const userId of participants) {
        const userKey = `user_conversations_${userId}`;
        const convList = await AsyncStorage.getItem(userKey) || '[]';
        const convArray = JSON.parse(convList);
        if (!convArray.includes(conversation.id)) {
          convArray.push(conversation.id);
          await AsyncStorage.setItem(userKey, JSON.stringify(convArray));
        }
      }

      return { success: true, conversation };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // SEND MESSAGE
  async sendMessage(conversationId, senderId, senderName, text, media = null) {
    try {
      const message = createMessage({
        conversationId,
        senderId,
        senderName,
        text,
        media
      });

      // Save message
      const msgKey = `message_${message.id}`;
      await AsyncStorage.setItem(msgKey, JSON.stringify(message));

      // Update conversation
      const convKey = `conversation_${conversationId}`;
      const conv = await AsyncStorage.getItem(convKey);
      const convData = JSON.parse(conv || '{}');

      convData.lastMessage = message;
      convData.lastMessageAt = message.createdAt;
      convData.messageCount = (convData.messageCount || 0) + 1;

      await AsyncStorage.setItem(convKey, JSON.stringify(convData));

      // Send notifications to other participants
      for (const participant of convData.participants || []) {
        if (participant !== senderId) {
          await this.sendNotification(participant, {
            type: 'new_message',
            senderId,
            senderName,
            conversationId,
            messagePreview: text.substring(0, 50)
          });
        }
      }

      return { success: true, message };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // GET MESSAGES
  async getMessages(conversationId, limit = 50, offset = 0) {
    try {
      const convKey = `conversation_${conversationId}`;
      const conv = await AsyncStorage.getItem(convKey);
      const convData = JSON.parse(conv || '{}');

      // TODO: Fetch messages from backend
      // For now, return empty array
      return {
        success: true,
        messages: [],
        total: convData.messageCount || 0
      };
    } catch (err) {
      return { success: false, messages: [], error: err.message };
    }
  },

  // DELETE MESSAGE
  async deleteMessage(messageId) {
    try {
      const msgKey = `message_${messageId}`;
      const msg = await AsyncStorage.getItem(msgKey);
      const msgData = JSON.parse(msg || '{}');

      msgData.deletedAt = new Date().toISOString();
      msgData.text = '[Deleted message]';

      await AsyncStorage.setItem(msgKey, JSON.stringify(msgData));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // EDIT MESSAGE
  async editMessage(messageId, newText) {
    try {
      const msgKey = `message_${messageId}`;
      const msg = await AsyncStorage.getItem(msgKey);
      const msgData = JSON.parse(msg || '{}');

      msgData.text = newText;
      msgData.edited = true;
      msgData.editedAt = new Date().toISOString();

      await AsyncStorage.setItem(msgKey, JSON.stringify(msgData));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // MARK AS READ
  async markAsRead(messageId, userId) {
    try {
      const msgKey = `message_${messageId}`;
      const msg = await AsyncStorage.getItem(msgKey);
      const msgData = JSON.parse(msg || '{}');

      if (!msgData.readBy) msgData.readBy = [];
      if (!msgData.readBy.includes(userId)) {
        msgData.readBy.push(userId);
        msgData.readAt = new Date().toISOString();
      }

      await AsyncStorage.setItem(msgKey, JSON.stringify(msgData));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // GET CONVERSATIONS
  async getConversations(userId, limit = 20, offset = 0) {
    try {
      const convListKey = `user_conversations_${userId}`;
      const convList = await AsyncStorage.getItem(convListKey) || '[]';
      const convIds = JSON.parse(convList);

      const conversations = [];
      for (const convId of convIds.slice(offset, offset + limit)) {
        const conv = await AsyncStorage.getItem(`conversation_${convId}`);
        if (conv) conversations.push(JSON.parse(conv));
      }

      return { success: true, conversations, total: convIds.length };
    } catch (err) {
      return { success: false, conversations: [], error: err.message };
    }
  },

  // MUTE CONVERSATION
  async muteConversation(conversationId, userId) {
    try {
      const convKey = `conversation_${conversationId}`;
      const conv = await AsyncStorage.getItem(convKey);
      const convData = JSON.parse(conv || '{}');

      if (!convData.mutedBy) convData.mutedBy = [];
      if (!convData.mutedBy.includes(userId)) {
        convData.mutedBy.push(userId);
      }

      await AsyncStorage.setItem(convKey, JSON.stringify(convData));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // ARCHIVE CONVERSATION
  async archiveConversation(conversationId) {
    try {
      const convKey = `conversation_${conversationId}`;
      const conv = await AsyncStorage.getItem(convKey);
      const convData = JSON.parse(conv || '{}');

      convData.archived = true;
      await AsyncStorage.setItem(convKey, JSON.stringify(convData));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // SEND NOTIFICATION
  async sendNotification(recipientId, data) {
    try {
      const notification = createNotification({
        recipientId,
        senderId: data.senderId,
        type: data.type,
        title: data.title,
        message: data.message,
        icon: data.icon,
        actionUrl: data.actionUrl
      });

      const notifKey = `notification_${notification.id}`;
      await AsyncStorage.setItem(notifKey, JSON.stringify(notification));

      // Add to user's notification list
      const notifListKey = `user_notifications_${recipientId}`;
      const notifList = await AsyncStorage.getItem(notifListKey) || '[]';
      const notifArray = JSON.parse(notifList);
      notifArray.push(notification.id);
      await AsyncStorage.setItem(notifListKey, JSON.stringify(notifArray));

      return { success: true, notification };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};

// NOTIFICATION SYSTEM
export const NotificationManager = {
  // GET NOTIFICATIONS
  async getNotifications(userId, limit = 20, unreadOnly = false) {
    try {
      const notifListKey = `user_notifications_${userId}`;
      const notifList = await AsyncStorage.getItem(notifListKey) || '[]';
      const notifIds = JSON.parse(notifList);

      const notifications = [];
      for (const notifId of notifIds.slice(-limit).reverse()) {
        const notif = await AsyncStorage.getItem(`notification_${notifId}`);
        if (notif) {
          const notifData = JSON.parse(notif);
          if (!unreadOnly || !notifData.read) {
            notifications.push(notifData);
          }
        }
      }

      return { success: true, notifications };
    } catch (err) {
      return { success: false, notifications: [] };
    }
  },

  // MARK NOTIFICATION AS READ
  async markAsRead(notificationId) {
    try {
      const notifKey = `notification_${notificationId}`;
      const notif = await AsyncStorage.getItem(notifKey);
      const notifData = JSON.parse(notif || '{}');

      notifData.read = true;
      notifData.readAt = new Date().toISOString();

      await AsyncStorage.setItem(notifKey, JSON.stringify(notifData));
      return { success: true };
    } catch (err) {
      return { success: false };
    }
  },

  // MARK ALL AS READ
  async markAllAsRead(userId) {
    try {
      const notifListKey = `user_notifications_${userId}`;
      const notifList = await AsyncStorage.getItem(notifListKey) || '[]';
      const notifIds = JSON.parse(notifList);

      for (const notifId of notifIds) {
        await this.markAsRead(notifId);
      }

      return { success: true };
    } catch (err) {
      return { success: false };
    }
  },

  // DELETE NOTIFICATION
  async deleteNotification(notificationId, userId) {
    try {
      const notifKey = `notification_${notificationId}`;
      await AsyncStorage.removeItem(notifKey);

      const notifListKey = `user_notifications_${userId}`;
      const notifList = await AsyncStorage.getItem(notifListKey) || '[]';
      const notifIds = JSON.parse(notifList);
      const filtered = notifIds.filter(id => id !== notificationId);
      await AsyncStorage.setItem(notifListKey, JSON.stringify(filtered));

      return { success: true };
    } catch (err) {
      return { success: false };
    }
  },

  // GET UNREAD COUNT
  async getUnreadCount(userId) {
    try {
      const { notifications } = await this.getNotifications(userId, 100, true);
      return { success: true, unreadCount: notifications.length };
    } catch (err) {
      return { success: false, unreadCount: 0 };
    }
  },

  // CREATE EVENT REMINDER
  async createEventReminder(userId, eventId, eventTitle, eventDateTime) {
    try {
      const notif = createNotification({
        recipientId: userId,
        senderId: 'system',
        type: 'event_reminder',
        title: 'Event Reminder',
        message: `${eventTitle} is starting soon!`,
        icon: '⏰',
        actionUrl: `/event/${eventId}`
      });

      // Schedule for specific time (15 min before event)
      const reminderTime = new Date(eventDateTime).getTime() - 15 * 60 * 1000;
      notif.scheduledFor = reminderTime;

      await AsyncStorage.setItem(`notification_${notif.id}`, JSON.stringify(notif));
      return { success: true, notification: notif };
    } catch (err) {
      return { success: false };
    }
  },

  // NOTIFICATION PREFERENCES
  async setNotificationPreferences(userId, preferences) {
    try {
      const userKey = `user_${userId}`;
      const user = await AsyncStorage.getItem(userKey);
      const userData = JSON.parse(user || '{}');

      userData.preferences = userData.preferences || {};
      userData.preferences.notifications = preferences;

      await AsyncStorage.setItem(userKey, JSON.stringify(userData));
      return { success: true };
    } catch (err) {
      return { success: false };
    }
  }
};
