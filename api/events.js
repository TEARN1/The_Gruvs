import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const { category } = req.query;
      let query = supabase.from('events').select('*').order('created_at', { ascending: false });
      if (category && category !== 'General') query = query.eq('category', category);

      const { data, error } = await query;
      if (error) throw error;
      return res.status(200).json(data);

    } else if (req.method === 'POST') {
      const { text, author, author_id, gender, category } = req.body;
      if (!text) return res.status(400).json({ error: 'Missing content' });

      const { data, error } = await supabase
        .from('events')
        .insert([{
          text,
          author,
          author_id, // For ownership check
          gender,    // To persist theme style
          category: category || 'General',
          likes: [],     // Array of user IDs
          comments: []   // Array of { id, author, text, created_at }
        }])
        .select();

      if (error) throw error;
      return res.status(201).json(data[0]);

    } else if (req.method === 'PATCH') {
      const { id, userId, action, comment, author: commentAuthor } = req.body;

      const { data: post, error: fetchErr } = await supabase.from('events').select('*').eq('id', id).single();
      if (fetchErr) throw fetchErr;

      let updates = {};

      if (action === 'like') {
        const likes = post.likes || [];
        updates.likes = likes.includes(userId) ? likes.filter(uid => uid !== userId) : [...likes, userId];
      } else if (action === 'comment') {
        const comments = post.comments || [];
        updates.comments = [...comments, {
          id: Date.now().toString(),
          author: commentAuthor || 'Anonymous',
          text: comment,
          created_at: new Date().toISOString()
        }];
      }

      const { data, error } = await supabase.from('events').update(updates).eq('id', id).select();
      if (error) throw error;
      return res.status(200).json(data[0]);

    } else if (req.method === 'DELETE') {
      const { id, userId } = req.query;

      const { data: post } = await supabase.from('events').select('author_id').eq('id', id).single();
      if (post && post.author_id !== userId) {
        return res.status(403).json({ error: 'Unauthorized: Only the creator can delete this post' });
      }

      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ message: 'Deleted' });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
