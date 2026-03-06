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

  const isUuid = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  try {
    // ─── GET: Fetch real events from Supabase ───────────────────────────────
    if (req.method === 'GET') {
      const { q = '', category = 'All', sortBy = 'created_at', offset = 0, limit = 12 } = req.query;
      let query = supabase.from('events').select('*');

      if (q) {
        query = query.or(`content->>title.ilike.%${q}%,content->>text.ilike.%${q}%`);
      }
      if (category && category !== 'All') {
        query = query.eq('content->>category', category);
      }

      if (sortBy === 'trending') query = query.order('engagement_metrics->>heat_index', { ascending: false });
      else query = query.order('created_at', { ascending: false });

      query = query.range(Number(offset), Number(offset) + Number(limit) - 1);
      const { data, error } = await query;
      if (error) throw error;

      return res.status(200).json(data || []);
    }

    // ─── POST: Save new event to the Data Engine ───────────────────────────
    if (req.method === 'POST') {
      const { title, text, author, author_id, gender, location, dateTime, guests, category, tags } = req.body;
      if (!title || !text) return res.status(400).json({ error: 'Title and Description are required' });

      const insertData = {
        owner_id: isUuid(author_id) ? author_id : null, // Ensure DB-compatible UUID
        tags: tags || [],
        content: {
          title: title.trim(),
          text: text.trim(),
          author_name: author || 'Anonymous',
          gender: gender || 'male',
          location: location || 'TBA',
          dateTime: dateTime || 'TBA',
          guests: guests || '',
          category: category || 'Social Milestones' // Capture category from UI
        },
        engagement_metrics: { liked_by: [], comments: [], rsvps: {}, views: 0, heat_index: 0, rsvpEnabled: true }
      };

      const { data, error } = await supabase.from('events').insert([insertData]).select();
      if (error) throw error;
      return res.status(201).json(data[0]);
    }

    // ─── PATCH: Atomic Engagement (Likes/RSVP) ─────────────────────────────
    if (req.method === 'PATCH') {
      const { id, userId, action, comment, author_name, parentId, rsvpStatus } = req.body;
      const { data: post } = await supabase.from('events').select('engagement_metrics').eq('id', id).single();
      if (!post) return res.status(404).json({ error: 'Event not found' });

      let m = { liked_by: [], comments: [], rsvps: {}, views: 0, heat_index: 0, ...post.engagement_metrics };

      if (action === 'like') {
        m.liked_by = m.liked_by.includes(userId) ? m.liked_by.filter(u => u !== userId) : [...m.liked_by, userId];
      } else if (action === 'rsvp') {
        m.rsvps[userId] = rsvpStatus;
      } else if (action === 'comment') {
        m.comments.push({ id: Date.now().toString(), parentId, author: author_name, text: comment, created_at: new Date(), likes: 0 });
      }

      // Update Heat Index for the Viral Trending engine
      m.heat_index = (Object.keys(m.rsvps).length * 5) + (m.comments.length * 3) + (m.liked_by.length * 2);

      const { data, error } = await supabase.from('events').update({ engagement_metrics: m }).eq('id', id).select();
      if (error) throw error;
      return res.status(200).json(data[0]);
    }

  } catch (err) {
    console.error('Storage Engine Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}