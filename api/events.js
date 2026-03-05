import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Helper to check for valid UUID format
  const isUuid = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase.from('events').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return res.status(200).json(data);

    } else if (req.method === 'POST') {
      const { title, text, author, author_id, gender, location, dateTime, guests } = req.body;

      const insertData = {
        content: {
          title: title || 'Untitled Event',
          text: text || '',
          author_name: author || 'Anonymous',
          gender: gender || 'male',
          location: location || 'TBA',
          dateTime: dateTime || 'TBA',
          guests: guests || ''
        },
        engagement_metrics: { liked_by: [], comments: [] }
      };

      // Only include owner_id if it's a valid UUID to avoid DB errors
      // If no valid UUID is provided, owner_id will be null (or handled by DB default)
      if (author_id && isUuid(author_id)) {
        insertData.owner_id = author_id;
      }

      const { data, error } = await supabase.from('events').insert([insertData]).select();

      if (error) {
        console.error('Insert Error:', error);
        return res.status(400).json({ error: error.message });
      }
      return res.status(201).json(data[0]);

    } else if (req.method === 'PATCH') {
      const { id, userId, action, comment, author_name } = req.body;
      const { data: post } = await supabase.from('events').select('engagement_metrics').eq('id', id).single();
      let metrics = post.engagement_metrics || { liked_by: [], comments: [] };

      if (action === 'like') {
        const likedBy = metrics.liked_by || [];
        metrics.liked_by = likedBy.includes(userId) ? likedBy.filter(u => u !== userId) : [...likedBy, userId];
      } else if (action === 'comment') {
        metrics.comments = [...(metrics.comments || []), {
          id: Date.now().toString(),
          author: author_name,
          text: comment,
          created_at: new Date().toISOString()
        }];
      }

      const { data, error } = await supabase.from('events').update({ engagement_metrics: metrics }).eq('id', id).select();
      if (error) throw error;
      return res.status(200).json(data[0]);

    } else if (req.method === 'DELETE') {
      const { id, userId } = req.query;

      // Ownership check only if userId is a valid UUID
      let query = supabase.from('events').delete().eq('id', id);
      if (userId && isUuid(userId)) {
        query = query.eq('owner_id', userId);
      }

      const { error } = await query;
      if (error) throw error;
      return res.status(200).json({ message: 'Deleted' });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
