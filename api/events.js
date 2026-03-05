import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const isUuid = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  try {
    if (req.method === 'GET') {
      const { q, category } = req.query;
      let query = supabase.from('events').select('*').order('created_at', { ascending: false });

      // Billionaire Logic: Search Engine
      if (q) {
        query = query.or(`content->>title.ilike.%${q}%,content->>text.ilike.%${q}%`);
      }
      if (category && category !== 'All') {
        query = query.eq('content->>category', category);
      }

      const { data, error } = await query;
      if (error) throw error;
      return res.status(200).json(data);

    } else if (req.method === 'POST') {
      const { title, text, author, author_id, gender, location, dateTime, guests, category } = req.body;
      const insertData = {
        owner_id: isUuid(author_id) ? author_id : null,
        content: {
          title: title || 'Untitled Event',
          text: text || '',
          author_name: author || 'Anonymous',
          gender: gender || 'male',
          location: location || 'TBA',
          dateTime: dateTime || 'TBA',
          guests: guests || '',
          category: category || 'Meetup'
        },
        engagement_metrics: { liked_by: [], comments: [], reports: [], rsvps: {} }
      };
      const { data, error } = await supabase.from('events').insert([insertData]).select();
      if (error) throw error;
      return res.status(201).json(data[0]);

    } else if (req.method === 'PUT') {
      // Edit Post Logic
      const { id, userId, title, text, location, dateTime, guests, category } = req.body;
      const { data: post } = await supabase.from('events').select('owner_id, content').eq('id', id).single();
      if (post.owner_id !== userId) return res.status(403).json({ error: 'Unauthorized' });

      const updatedContent = { ...post.content, title, text, location, dateTime, guests, category };
      const { data, error } = await supabase.from('events').update({ content: updatedContent }).eq('id', id).select();
      if (error) throw error;
      return res.status(200).json(data[0]);

    } else if (req.method === 'PATCH') {
      const { id, userId, action, comment, author_name, parentId, rsvpStatus, targetId, reason, commentId, video_url, video_duration, user_created_at } = req.body;
      const { data: post } = await supabase.from('events').select('engagement_metrics').eq('id', id).single();
      let metrics = post.engagement_metrics || { liked_by: [], comments: [], reports: [], rsvps: {} };

      if (action === 'comment') {
        // --- VIDEO VALIDATION ---
        if (video_url) {
          const now = new Date();
          const accountCreated = new Date(user_created_at || '2025-01-01');
          const ageMonths = (now - accountCreated) / (1000 * 60 * 60 * 24 * 30.44);

          let maxDuration = 0;
          if (ageMonths >= 36) maxDuration = 20;
          else if (ageMonths >= 30) maxDuration = 15;
          else if (ageMonths >= 24) maxDuration = 10;
          else if (ageMonths >= 18) maxDuration = 5;

          if (ageMonths < 18) return res.status(403).json({ error: 'Video comments require 18+ month account age.' });
          if (video_duration > maxDuration) return res.status(400).json({ error: `Video too long. Limit: ${maxDuration}s.` });
        }

        const newComment = {
          id: Date.now().toString(),
          parentId: parentId || null,
          author: author_name,
          text: comment,
          video_url: video_url || null,
          video_duration: video_duration || 0,
          created_at: new Date().toISOString(),
          likes: 0
        };
        metrics.comments = [...(metrics.comments || []), newComment];

      } else if (action === 'rsvp') {
        if (!metrics.rsvps) metrics.rsvps = {};
        metrics.rsvps[userId] = rsvpStatus;

      } else if (action === 'like_comment') {
        metrics.comments = (metrics.comments || []).map(c =>
          c.id === commentId ? { ...c, likes: (c.likes || 0) + 1 } : c
        );

      } else if (action === 'edit_comment') {
        const { text } = req.body;
        metrics.comments = (metrics.comments || []).map(c =>
          c.id === commentId ? { ...c, text, edited: true } : c
        );

      } else if (action === 'delete_comment') {
        metrics.comments = (metrics.comments || []).filter(c => c.id !== commentId);

      } else if (action === 'report') {
        metrics.reports = [...(metrics.reports || []), { targetId, reporterId: userId, reason, created_at: new Date(), status: 'pending' }];

      } else if (action === 'like') {
        const likedBy = metrics.liked_by || [];
        metrics.liked_by = likedBy.includes(userId) ? likedBy.filter(u => u !== userId) : [...likedBy, userId];
      }

      const { data, error } = await supabase.from('events').update({ engagement_metrics: metrics }).eq('id', id).select();
      if (error) throw error;
      return res.status(200).json(data[0]);

    } else if (req.method === 'DELETE') {
      const { id, userId } = req.query;
      const { error } = await supabase.from('events').delete().eq('id', id).eq('owner_id', userId);
      if (error) throw error;
      return res.status(200).json({ message: 'Deleted' });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
