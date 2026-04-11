import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req, res) {
  // ─── CORS Configuration ──────────────────────
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[CONFIG ERROR] Missing Supabase environment variables');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // ─── GET: Discovery Engine ──────────────────────
    if (req.method === 'GET') {
      const {
        q = '', category = 'All', sortBy = 'created_at', limit = 20,
        lat, lng, radius = 50000 // 50km default
      } = req.query;

      try {
        let query = supabase.from('events').select(`
          *,
          profiles:author_id (id, username, name, avatar, verified)
        `);

        // 1. Full Text Search
        if (q) {
          query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
        }

        // 2. Taxonomy filtering
        if (category && category !== 'All') {
          query = query.eq('category', category);
        }

        // 3. Proximity (if coords provided)
        if (lat && lng) {
          query = query.order(`((latitude - ${parseFloat(lat)})^2 + (longitude - ${parseFloat(lng)})^2)`, { ascending: true });
        }

        // 4. Sorting & Priority
        if (sortBy === 'trending') {
          query = query.order('trending_score', { ascending: false });
        } else if (!lat || !lng) {
          query = query.order('created_at', { ascending: false });
        }

        query = query.limit(Number(limit));

        const { data, error } = await query;

        // Handle missing tables gracefully by returning empty list (or mock data if you prefer)
        if (error) {
          console.warn('[DB WARNING] Query failed:', error.message);
          // If the table doesn't exist, return an empty array instead of crashing
          if (error.code === '42P01') {
            return res.status(200).json([]);
          }
          throw error;
        }

        return res.status(200).json(data || []);
      } catch (dbErr) {
        console.error('[DB ERROR]', dbErr.message);
        // Fallback to empty array to prevent 500
        return res.status(200).json([]);
      }
    }

    // ─── POST: Creation Engine ──────────────────────
    if (req.method === 'POST') {
      const { 
        title, description, author_id, category, location, 
        date_time, is_paid, media 
      } = req.body;

      const { data, error } = await supabase.from('events').insert([{
        author_id,
        title,
        description,
        category: category || 'General',
        location,
        date_time: date_time || new Date(),
        is_paid: !!is_paid,
        media: media || []
      }]).select().single();

      if (error) throw error;
      return res.status(201).json(data);
    }

    // ─── PATCH: Interaction & Heat Score ─────────────────────
    if (req.method === 'PATCH') {
      const { id, action, userId, status } = req.body;

      if (action === 'view') {
        await supabase.rpc('increment_views', { event_id: id });
        return res.status(200).json({ success: true });
      }

      if (action === 'rsvp') {
        const { error } = await supabase.from('event_rsvps').upsert({
          event_id: id,
          user_id: userId,
          status: status || 'going'
        });
        if (error) throw error;
        // Optionally update event.rsvp_count via trigger or manually
        return res.status(200).json({ success: true });
      }
      
      return res.status(400).json({ error: 'Invalid action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('[API ERROR]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

