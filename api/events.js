import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return res.status(200).json(data);

    } else if (req.method === 'POST') {
      const { text, author, category } = req.body;
      const { data, error } = await supabase
        .from('events')
        .insert([{
          text,
          author: author || 'Anonymous',
          category: category || 'General',
          going_count: 0
        }])
        .select();

      if (error) throw error;
      return res.status(201).json(data[0]);

    } else if (req.method === 'PATCH') {
      // RSVP Logic: Increment/Decrement going_count
      const { id, increment } = req.body;

      // Get current count
      const { data: eventData } = await supabase
        .from('events')
        .select('going_count')
        .eq('id', id)
        .single();

      const newCount = (eventData?.going_count || 0) + (increment ? 1 : -1);

      const { data, error } = await supabase
        .from('events')
        .update({ going_count: Math.max(0, newCount) })
        .eq('id', id)
        .select();

      if (error) throw error;
      return res.status(200).json(data[0]);

    } else if (req.method === 'DELETE') {
      const { id } = req.query;
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ message: 'Deleted' });

    } else {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }
  } catch (err) {
    console.error('API Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
