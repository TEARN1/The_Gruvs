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
      const { q = '', category = 'All', sortBy = 'created_at', limit = 12, cursor, lat, lng, radius = 50000, userId } = req.query;
      let query = supabase.from('events').select('*');

      if (q) query = query.or(`content->>title.ilike.%${q}%,content->>text.ilike.%${q}%,content->>slug.ilike.%${q}%`);
      if (category && category !== 'All') query = query.eq('content->>category', category);
      if (cursor) query = query.lt('created_at', cursor);
      if (lat && lng) query = query.filter('coords', 'st_dwithin', `POINT(${lng} ${lat}),${radius}`);

      if (sortBy === 'trending') query = query.order('engagement_metrics->>heat_index', { ascending: false });
      else query = query.order('created_at', { ascending: false });

      query = query.limit(Number(limit));
      const { data, error } = await query;
      if (error) throw error;

      // ENRICHMENT: Calculate Live status & User specific states
      const enriched = (data || []).map(event => {
        const m = event.engagement_metrics || {};
        const isLive = new Date(event.content?.dateTime) > new Date(Date.now() - 4 * 3600000);
        return {
          ...event,
          context: {
            is_live: isLive,
            is_saved: userId ? (m.saved_by || []).includes(userId) : false,
            has_liked: userId ? (m.liked_by || []).includes(userId) : false,
          }
        };
      });

      return res.status(200).json(enriched);
    }

    // ─── POST: AI-Ready Creation (Events, Comments, DMs, Telemetry) ──────────
    if (req.method === 'POST') {
      const { route = 'event' } = req.query;

      if (route === 'event') {
        const { title, text, author, author_id, gender, location, dateTime, images = [], vids = [] } = req.body;
        // Billionaire Media Guardrails
        if (images.length > 15 || vids.length > 3) return res.status(400).json({ error: 'Media limit exceeded (15 Img / 3 Vid)' });

        const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString().slice(-4)}`;
        const { data, error } = await supabase.from('events').insert([{
          owner_id: isUuid(author_id) ? author_id : null,
          content: { title, text, slug, author_name: author, gender, location, dateTime, media: { images, vids }, status: 'active' },
          engagement_metrics: { heat_index: 0, views: 0, liked_by: [], saved_by: [], comments: [] }
        }]).select();
        if (error) throw error;
        return res.status(201).json(data[0]);
      }

      if (route === 'comment') {
        const { event_id, user_id, text, media_url, media_type, media_duration } = req.body;
        // Logic: 30sec recording limit check
        if (media_type === 'voice' && media_duration > 30) return res.status(400).json({ error: 'Recording capped at 30s' });

        const { data, error } = await supabase.from('comments').insert([req.body]).select();
        if (error) throw error;
        return res.status(201).json(data[0]);
      }

      if (route === 'message') {
        // DM Logic: Chats, docs, links, and call signaling
        const { data, error } = await supabase.from('messages').insert([req.body]).select();
        if (error) throw error;
        return res.status(201).json(data[0]);
      }
    }

    // ─── PUT: Secure Edit (Ownership Locked) ────────────────────────────────
    if (req.method === 'PUT') {
      const { id, userId, ...updates } = req.body;
      const { data: post } = await supabase.from('events').select('owner_id').eq('id', id).single();
      if (!post || post.owner_id !== userId) return res.status(403).json({ error: 'Unauthorized' });

      const { data, error } = await supabase.from('events').update({ content: updates }).eq('id', id).select();
      if (error) throw error;
      return res.status(200).json(data[0]);
    }

    // ─── PATCH: Atomic Engagement (Heat Index Calculation) ──────────────────
    if (req.method === 'PATCH') {
      const { id, userId, action, rsvpStatus } = req.body;
      const { data: post } = await supabase.from('events').select('engagement_metrics, created_at').eq('id', id).single();
      let m = { liked_by: [], saved_by: [], rsvps: {}, views: 0, ...post.engagement_metrics };

      if (action === 'like') {
        m.liked_by = m.liked_by.includes(userId) ? m.liked_by.filter(u => u !== userId) : [...m.liked_by, userId];
      } else if (action === 'save') {
        m.saved_by = m.saved_by.includes(userId) ? m.saved_by.filter(u => u !== userId) : [...m.saved_by, userId];
      } else if (action === 'rsvp') {
        m.rsvps[userId] = rsvpStatus;
      } else if (action === 'ai_bot') {
        return res.status(200).json({ reply: "I'm analyzing the frequency of this event..." });
      }

      // Heat Index Formula: (RSVP x 10) + (Save x 8) + (Like x 2) + Views
      const rawHeat = (Object.keys(m.rsvps || {}).length * 10) + (m.saved_by.length * 8) + (m.liked_by.length * 2) + (m.views || 0);
      const hours = (Date.now() - new Date(post.created_at)) / 3600000;
      m.heat_index = rawHeat / Math.pow(hours + 2, 1.5);

      const { data, error } = await supabase.from('events').update({ engagement_metrics: m }).eq('id', id).select();
      if (error) throw error;
      return res.status(200).json(data[0]);
    }

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
