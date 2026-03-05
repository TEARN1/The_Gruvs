import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {

    // ─── GET: List events with search, category, interests, pagination ───────
    if (req.method === 'GET') {
      const { q = '', category = 'All', interests = '', offset = 0, limit = 12, networkType = '' } = req.query;
      let query = supabase.from('events').select('*').order('created_at', { ascending: false });

      if (q) query = query.or(`content->>title.ilike.%${q}%,content->>text.ilike.%${q}%,content->>location.ilike.%${q}%,content->>tags.ilike.%${q}%`);
      if (category && category !== 'All') query = query.eq('content->>category', category);
      if (networkType && networkType !== 'all') query = query.eq('content->>networkType', networkType);
      if (interests) {
        const interestList = interests.split(',');
        query = query.in('content->>category', interestList);
      }

      query = query.range(Number(offset), Number(offset) + Number(limit) - 1);
      const { data, error } = await query;
      if (error) throw error;
      return res.status(200).json(data || []);
    }

    // ─── POST: Create event ──────────────────────────────────────────────────
    if (req.method === 'POST') {
      const {
        title, text, author, author_id, gender,
        location, dateTime, guests, category,
        eventType, imageUrl, rsvpEnabled, tags, networkType, targetAudience
      } = req.body;

      if (!title || !text) return res.status(400).json({ error: 'Title and description are required' });

      const insertData = {
        owner_id: null,                             // no UUID constraint needed
        content: {
          title: (title || '').trim(),
          text: (text || '').trim(),
          author_name: author || 'Anonymous',
          gender: gender || 'male',
          location: location || 'TBA',
          dateTime: dateTime || 'TBA',
          guests: guests || '',
          category: category || 'Meetup',
          eventType: eventType || 'physical',
          imageUrl: imageUrl || '',
          tags: tags || [],
          networkType: networkType || 'public',
          targetAudience: targetAudience || [],
          authorId: author_id || null,
        },
        engagement_metrics: {
          liked_by: [],
          comments: [],
          reports: [],
          rsvps: {},
          rsvpEnabled: rsvpEnabled !== false,
          views: 0,
        }
      };

      const { data, error } = await supabase.from('events').insert([insertData]).select();
      if (error) throw error;
      return res.status(201).json(data[0]);
    }

    // ─── PUT: Edit event ─────────────────────────────────────────────────────
    if (req.method === 'PUT') {
      const { id, userId, title, text, location, dateTime, guests, category, eventType, imageUrl, rsvpEnabled, tags, networkType, targetAudience } = req.body;
      const { data: post } = await supabase.from('events').select('content, engagement_metrics').eq('id', id).single();
      if (!post) return res.status(404).json({ error: 'Event not found' });

      const updatedContent = {
        ...post.content, title, text, location, dateTime, guests, category,
        eventType, imageUrl, tags, networkType, targetAudience,
      };
      const updatedMetrics = { ...post.engagement_metrics, rsvpEnabled: rsvpEnabled !== false };

      const { data, error } = await supabase.from('events')
        .update({ content: updatedContent, engagement_metrics: updatedMetrics })
        .eq('id', id).select();
      if (error) throw error;
      return res.status(200).json(data[0]);
    }

    // ─── PATCH: Engagement actions ───────────────────────────────────────────
    if (req.method === 'PATCH') {
      const {
        id, userId, action, comment, author_name, parentId, rsvpStatus,
        targetId, reason, commentId, video_url, video_duration, user_created_at, text
      } = req.body;

      const { data: post, error: fetchErr } = await supabase.from('events').select('engagement_metrics').eq('id', id).single();
      if (fetchErr || !post) return res.status(404).json({ error: 'Event not found' });

      let metrics = { liked_by: [], comments: [], reports: [], rsvps: {}, ...post.engagement_metrics };

      if (action === 'like') {
        const lb = metrics.liked_by || [];
        metrics.liked_by = lb.includes(userId) ? lb.filter(u => u !== userId) : [...lb, userId];

      } else if (action === 'rsvp') {
        metrics.rsvps = { ...(metrics.rsvps || {}), [userId]: rsvpStatus };

      } else if (action === 'comment') {
        if (video_url) {
          const ageMonths = (Date.now() - new Date(user_created_at || '2025-01-01')) / (1000 * 60 * 60 * 24 * 30.44);
          let maxDur = ageMonths >= 36 ? 20 : ageMonths >= 30 ? 15 : ageMonths >= 24 ? 10 : ageMonths >= 18 ? 5 : 0;
          if (maxDur === 0) return res.status(403).json({ error: 'Video comments require 18+ month account.' });
          if (video_duration > maxDur) return res.status(400).json({ error: `Video too long. Max: ${maxDur}s` });
        }
        metrics.comments = [...(metrics.comments || []), {
          id: Date.now().toString(), parentId: parentId || null, author: author_name,
          text: comment, video_url: video_url || null, created_at: new Date().toISOString(), likes: 0, edited: false,
        }];

      } else if (action === 'edit_comment') {
        metrics.comments = (metrics.comments || []).map(c =>
          c.id === commentId ? { ...c, text, edited: true } : c
        );

      } else if (action === 'like_comment') {
        metrics.comments = (metrics.comments || []).map(c =>
          c.id === commentId ? { ...c, likes: (c.likes || 0) + 1 } : c
        );

      } else if (action === 'delete_comment') {
        metrics.comments = (metrics.comments || []).filter(c => c.id !== commentId);

      } else if (action === 'report') {
        metrics.reports = [...(metrics.reports || []),
        { targetId, reporterId: userId, reason, created_at: new Date().toISOString(), status: 'pending' }
        ];

      } else if (action === 'view') {
        metrics.views = (metrics.views || 0) + 1;
      }

      const { data, error } = await supabase.from('events').update({ engagement_metrics: metrics }).eq('id', id).select();
      if (error) throw error;
      return res.status(200).json(data[0]);
    }

    // ─── DELETE: Remove event ────────────────────────────────────────────────
    if (req.method === 'DELETE') {
      const { id } = req.query;
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ message: 'Deleted' });
    }

  } catch (err) {
    console.error('API Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
