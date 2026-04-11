// EVENTS MANAGEMENT SYSTEM
// Event creation, editing, management, analytics

import AsyncStorage from '@react-native-async-storage/async-storage';

export const EventsManager = {
  // CREATE EVENT
  async createEvent(data) {
    try {
      const event = {
        id: `event_${Date.now()}`,
        owner: data.ownerId,
        ownerName: data.ownerName,

        // Event Details
        content: {
          title: data.title,
          description: data.description,
          category: data.category,
          subcategory: data.subcategory || null,
          location: data.location,
          city: data.city || null,
          country: data.country || null,
          latitude: data.latitude || null,
          longitude: data.longitude || null,
          dateTime: data.dateTime,
          endDateTime: data.endDateTime || null,
          timezone: data.timezone || 'UTC',
          duration: data.duration || null,

          // Event Details
          capacity: data.capacity || null,
          currentAttendees: 0,
          ageRestriction: data.ageRestriction || null,
          dressCode: data.dressCode || null,
          price: data.price || 'free',
          currency: data.currency || 'USD',

          // URLs & Links
          website: data.website || null,
          ticketLink: data.ticketLink || null,

          // Event Type
          eventType: data.eventType || 'in-person', // in-person, virtual, hybrid
          isRecurring: data.isRecurring || false,
          recurrencePattern: data.recurrencePattern || null,

          // Media
          images: data.images || [],
          videos: data.videos || [],
          thumbnail: data.thumbnail || null,

          // Status
          status: 'active', // active, cancelled, postponed
          visible: true
        },

        // Engagement
        engagement_metrics: {
          likes: [],
          likeCount: 0,
          rsvps: {},
          rsvpCount: 0,
          comments: [],
          commentCount: 0,
          reactions: {},
          savedBy: [],
          saveCount: 0,
          sharedBy: [],
          shareCount: 0,
          views: 0,
          uniqueViews: [],
          heat: 0,
          trendingScore: 0,
          heatIndex: 0
        },

        // Attendee Management
        attendees: [],
        waitlist: [],
        invitedUsers: [],

        // Moderation
        reported: false,
        reportedCount: 0,
        reportReasons: [],

        // Metadata
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        viewedAt: null
      };

      const key = `event_${event.id}`;
      await AsyncStorage.setItem(key, JSON.stringify(event));

      // Add to owner's events list
      const ownerEventsKey = `user_events_${data.ownerId}`;
      const ownerEventsList = await AsyncStorage.getItem(ownerEventsKey) || '[]';
      const ownerEventsArray = JSON.parse(ownerEventsList);
      ownerEventsArray.push(event.id);
      await AsyncStorage.setItem(ownerEventsKey, JSON.stringify(ownerEventsArray));

      return { success: true, event };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // EDIT EVENT
  async editEvent(eventId, updates) {
    try {
      const key = `event_${eventId}`;
      const event = await AsyncStorage.getItem(key);
      const eventData = JSON.parse(event || '{}');

      eventData.content = { ...eventData.content, ...updates };
      eventData.updatedAt = new Date().toISOString();

      await AsyncStorage.setItem(key, JSON.stringify(eventData));
      return { success: true, event: eventData };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // CANCEL EVENT
  async cancelEvent(eventId) {
    try {
      return this.editEvent(eventId, { status: 'cancelled' });
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // POSTPONE EVENT
  async postponeEvent(eventId, newDateTime) {
    try {
      return this.editEvent(eventId, {
        status: 'postponed',
        dateTime: newDateTime
      });
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // MANAGE ATTENDEES
  async addAttendee(eventId, userId, userName) {
    try {
      const key = `event_${eventId}`;
      const event = await AsyncStorage.getItem(key);
      const eventData = JSON.parse(event || '{}');

      if (!eventData.attendees) eventData.attendees = [];
      if (!eventData.attendees.includes(userId)) {
        eventData.attendees.push(userId);

        // Check capacity
        if (eventData.content.capacity &&
            eventData.attendees.length >= eventData.content.capacity) {
          eventData.content.status = 'full';
        }
      }

      eventData.engagement_metrics.currentAttendees = eventData.attendees.length;
      await AsyncStorage.setItem(key, JSON.stringify(eventData));

      return { success: true, event: eventData };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // REMOVE ATTENDEE
  async removeAttendee(eventId, userId) {
    try {
      const key = `event_${eventId}`;
      const event = await AsyncStorage.getItem(key);
      const eventData = JSON.parse(event || '{}');

      if (eventData.attendees) {
        eventData.attendees = eventData.attendees.filter(id => id !== userId);
      }

      await AsyncStorage.setItem(key, JSON.stringify(eventData));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // GET ATTENDEES
  async getAttendees(eventId) {
    try {
      const key = `event_${eventId}`;
      const event = await AsyncStorage.getItem(key);
      const eventData = JSON.parse(event || '{}');

      return {
        success: true,
        attendees: eventData.attendees || [],
        count: (eventData.attendees || []).length
      };
    } catch (err) {
      return { success: false, attendees: [] };
    }
  },

  // GET USER'S EVENTS
  async getUserEvents(userId, status = null) {
    try {
      const eventsKey = `user_events_${userId}`;
      const eventsList = await AsyncStorage.getItem(eventsKey) || '[]';
      const eventIds = JSON.parse(eventsList);

      const events = [];
      for (const eventId of eventIds) {
        const event = await AsyncStorage.getItem(`event_${eventId}`);
        if (event) {
          const eventData = JSON.parse(event);
          if (!status || eventData.content.status === status) {
            events.push(eventData);
          }
        }
      }

      return { success: true, events };
    } catch (err) {
      return { success: false, events: [] };
    }
  }
};

// ANALYTICS ENGINE
export const AnalyticsEngine = {
  // TRACK VIEW
  async trackEventView(eventId, userId) {
    try {
      const key = `event_${eventId}`;
      const event = await AsyncStorage.getItem(key);
      const eventData = JSON.parse(event || '{}');

      if (!eventData.engagement_metrics) {
        eventData.engagement_metrics = { views: 0, uniqueViews: [] };
      }

      eventData.engagement_metrics.views = (eventData.engagement_metrics.views || 0) + 1;

      if (!eventData.engagement_metrics.uniqueViews) {
        eventData.engagement_metrics.uniqueViews = [];
      }

      if (!eventData.engagement_metrics.uniqueViews.includes(userId)) {
        eventData.engagement_metrics.uniqueViews.push(userId);
      }

      eventData.viewedAt = new Date().toISOString();
      await AsyncStorage.setItem(key, JSON.stringify(eventData));

      return { success: true };
    } catch (err) {
      return { success: false };
    }
  },

  // EVENT ANALYTICS
  async getEventAnalytics(eventId) {
    try {
      const key = `event_${eventId}`;
      const event = await AsyncStorage.getItem(key);
      const eventData = JSON.parse(event || '{}');
      const metrics = eventData.engagement_metrics || {};

      const analytics = {
        eventId,
        views: metrics.views || 0,
        uniqueViews: (metrics.uniqueViews || []).length,
        clicks: metrics.clicks || 0,
        engagementRate: metricscalculateEngagementRate(metrics),

        // Social
        likes: metrics.likeCount || 0,
        rsvps: Object.keys(metrics.rsvps || {}).length,
        attendees: eventData.attendees?.length || 0,
        comments: metrics.commentCount || 0,
        shares: metrics.shareCount || 0,
        saves: metrics.saveCount || 0,

        // Trending
        trendingScore: metrics.trendingScore || 0,
        heatIndex: metrics.heatIndex || 0,

        // Timeline
        createdAt: eventData.createdAt,
        updatedAt: eventData.updatedAt
      };

      return { success: true, analytics };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  calculateEngagementRate(metrics) {
    const totalEngagement = (
      (metrics.likeCount || 0) +
      (metrics.commentCount || 0) * 2 +
      (Object.keys(metrics.rsvps || {}).length) * 3 +
      (metrics.shareCount || 0) * 5
    );

    const views = metrics.views || 1;
    return ((totalEngagement / views) * 100).toFixed(2);
  },

  // USER ANALYTICS
  async getUserAnalytics(userId) {
    try {
      const { events } = await EventsManager.getUserEvents(userId);

      const analytics = {
        eventsCreated: events.length,
        totalViews: events.reduce((sum, e) => sum + (e.engagement_metrics?.views || 0), 0),
        totalEngagements: events.reduce((sum, e) => {
          const m = e.engagement_metrics || {};
          return sum + (m.likeCount || 0) + (m.commentCount || 0) + (m.shareCount || 0);
        }, 0),
        totalAttendees: events.reduce((sum, e) => sum + (e.attendees?.length || 0), 0),
        averageViews: 0,
        topEvent: null
      };

      if (events.length > 0) {
        analytics.averageViews = (analytics.totalViews / events.length).toFixed(0);
        analytics.topEvent = events.reduce((prev, current) =>
          (prev.engagement_metrics?.views || 0) > (current.engagement_metrics?.views || 0) ? prev : current
        );
      }

      return { success: true, analytics };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
