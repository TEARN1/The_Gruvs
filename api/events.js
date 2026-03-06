import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Device-Fingerprint');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const isUuid = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  try {
    // ─── GET: Discovery Engine (Trillion-Scale Keyset) ──────────────────────
    if (req.method === 'GET') {
      const { q = '', category = 'All', sortBy = 'created_at', limit = 12, cursor, lat, lng, radius = 50000 } = req.query;
      let query = supabase.from('events').select('*');

      if (q) query = query.or(`content->>title.ilike.%${q}%,content->>text.ilike.%${q}%,content->>slug.ilike.%${q}%`);
      if (category && category !== 'All') query = query.eq('content->>category', category);

      // Keyset Pagination for Trillion Rows
      if (cursor) query = query.lt('created_at', cursor);

      // PostGIS Radar
      if (lat && lng) query = query.filter('coords', 'st_dwithin', `POINT(${lng} ${lat}),${radius}`);

      if (sortBy === 'trending') query = query.order('engagement_metrics->>heat_index', { ascending: false });
      else query = query.order('created_at', { ascending: false });

      query = query.limit(Number(limit));
      const { data, error } = await query;
      if (error) throw error;
      return res.status(200).json(data || []);
    }

    // ─── POST: AI-Ready Creation (Events, Comments, DMs, Telemetry) ──────────
    if (req.method === 'POST') {
      const { route = 'event' } = req.query; // Modular routing for 100 features

      if (route === 'event') {
        const { title, text, author, author_id, gender, location, dateTime, coords, tags } = req.body;
        const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString().slice(-4)}`;
        const { data, error } = await supabase.from('events').insert([{
          owner_id: isUuid(author_id) ? author_id : null,
          coords: (coords?.lat && coords?.lng) ? `POINT(${coords.lng} ${coords.lat})` : null,
          tags: tags || [],
          content: { title, text, slug, author_name: author, gender, location, dateTime, status: 'active' },
          engagement_metrics: { heat_index: 0, views: 0 }
        }]).select();
        if (error) throw error;
        return res.status(201).json(data[0]);
      }

      if (route === 'comment') {
        const { event_id, user_id, parent_id, text, media_url, media_type, media_duration } = req.body;
        const { data, error } = await supabase.from('comments').insert([{
          event_id, user_id, parent_id, text, media_url, media_type, media_duration
        }]).select();
        if (error) throw error;
        return res.status(201).json(data[0]);
      }

      if (route === 'telemetry') {
        const { event_id, user_id, coords, velocity, metadata } = req.body;
        const { data, error } = await supabase.from('race_telemetry').insert([{
          event_id, user_id, velocity, metadata,
          coords: `POINT(${coords.lng} ${coords.lat})`
        }]).select();
        if (error) throw error;
        return res.status(201).json(data[0]);
      }
    }

    // ─── PATCH: Atomic Engagement (Heat Index Calculation) ──────────────────
    if (req.method === 'PATCH') {
      const { id, userId, action, rsvpStatus } = req.body;
      const { data: post } = await supabase.from('events').select('engagement_metrics, created_at').eq('id', id).single();
      let m = { liked_by: [], rsvps: {}, views: 0, ...post.engagement_metrics };

      if (action === 'like') {
        m.liked_by = m.liked_by.includes(userId) ? m.liked_by.filter(u => u !== userId) : [...m.liked_by, userId];
      } else if (action === 'rsvp') {
        m.rsvps[userId] = rsvpStatus;
      } else if (action === 'view') {
        m.views++;
      }

      // Heat Decay Gravity Formula
      const rawHeat = (Object.keys(m.rsvps || {}).length * 10) + (m.liked_by.length * 2) + m.views;
      const hours = (Date.now() - new Date(post.created_at)) / (1000 * 60 * 60);
      m.heat_index = rawHeat / Math.pow(hours + 2, 1.5);

      const { data, error } = await supabase.from('events').update({ engagement_metrics: m }).eq('id', id).select();
      if (error) throw error;
      return res.status(200).json(data[0]);
    }

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
