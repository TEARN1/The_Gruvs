import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
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
    // ─── GET: Fetch User Status & Privileges ───────────────────────────────
    if (req.method === 'GET') {
      const { userId } = req.query;
      if (!userId) return res.status(400).json({ error: 'User ID required' });

      const { data, error } = await supabase
        .from('user_activity')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "No rows found"
      
      return res.status(200).json(data || { vibe_level: 1, can_voice_comment: false, can_video_comment: false });
    }

    // ─── POST: Activity Heartbeat (Updates last_active and minutes) ─────────
    if (req.method === 'POST') {
      const { userId, minutesActive } = req.body;
      if (!userId) return res.status(400).json({ error: 'User ID required' });

      const { data, error } = await supabase.rpc('track_user_activity', { 
        u_id: userId, 
        m_active: minutesActive || 1 
      });

      if (error) throw error;
      return res.status(200).json({ message: 'Heartbeat received', status: data });
    }

    // ─── PATCH: Update Profile / Privacy Toggle ────────────────────────────
    if (req.method === 'PATCH') {
      const { userId, is_private, bio, interests } = req.body;
      if (!userId) return res.status(400).json({ error: 'User ID required' });

      const updateData = {};
      if (is_private !== undefined) updateData.is_private = is_private;
      
      // Update the user profile (in auth.users metadata or a public profiles table)
      // Note: Updating auth.users metadata requires different privileges, 
      // so we usually use a public 'profiles' table.
      const { data, error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId)
        .select();

      if (error) throw error;
      return res.status(200).json(data[0]);
    }

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
