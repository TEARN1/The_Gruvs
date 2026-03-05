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
    if (req.method === 'GET') {
      const { q = '', category = 'All', lat, lng, radius = 50000, sortBy = 'created_at', offset = 0, limit = 12 } = req.query;
      let query = supabase.from('events').select('*');

      if (q) query = query.or(`content->>title.ilike.%${q}%,content->>text.ilike.%${q}%`);
      if (category && category !== 'All') query = query.eq('content->>category', category);

      // GEOSPATIAL ENGINE: This is a placeholder for a PostGIS RPC call
      // if (lat && lng) { query = query.rpc('events_in_radius', { lat, lng, radius }) }

      // VIRAL FLYWHEEL
      if (sortBy === 'trending') {
        query = query.order('engagement_metrics->>heat_index', { ascending: false });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      query = query.range(Number(offset), Number(offset) + Number(limit) - 1);
      const { data, error } = await query;
      if (error) throw error;
      return res.status(200).json(data || []);
    }

    if (req.method === 'POST') {
      const { title, text, author, author_id, gender, location, dateTime, tags, coords } = req.body;
      if (!title) return res.status(400).json({ error: 'Title is required' });

      const insertData = {
        owner_id: author_id || null,
        tags: tags || [],
        coords: (coords?.lat && coords?.lng) ? `POINT(${coords.lng} ${coords.lat})` : null,
        content: { title, text, author_name: author, gender, location, dateTime },
        engagement_metrics: { liked_by: [], comments: [], rsvps: {}, views: 0, heat_index: 0, rsvpEnabled: true }
      };

      const { data, error } = await supabase.from('events').insert([insertData]).select();
      if (error) throw error;
      return res.status(201).json(data[0]);
    }

    if (req.method === 'PATCH') {
      const { id, userId, action, comment, author_name, parentId, rsvpStatus } = req.body;
      const { data: post, error: fetchErr } = await supabase.from('events').select('engagement_metrics').eq('id', id).single();
      if (fetchErr) return res.status(404).json({ error: 'Event not found' });

      let metrics = { liked_by: [], comments: [], rsvps: {}, views: 0, heat_index: 0, ...post.engagement_metrics };

      if (action === 'like') metrics.liked_by = (metrics.liked_by.includes(userId)) ? metrics.liked_by.filter(u => u !== userId) : [...metrics.liked_by, userId];
      else if (action === 'rsvp') metrics.rsvps[userId] = rsvpStatus;
      else if (action === 'view') metrics.views++;
      else if (action === 'comment') metrics.comments.push({ id: Date.now().toString(), parentId, author: author_name, text: comment, created_at: new Date() });

      // HEAT SCORE ALGORITHM (Viral Flywheel)
      metrics.heat_index = (metrics.liked_by.length * 2) + (Object.keys(metrics.rsvps).length * 5) + (metrics.comments.length * 3) + metrics.views;

      const { data, error } = await supabase.from('events').update({ engagement_metrics: metrics }).eq('id', id).select();
      if (error) throw error;
      return res.status(200).json(data[0]);
    }

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
