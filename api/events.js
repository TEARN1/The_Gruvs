// File: api/events.js
// This is a Vercel Serverless Function that acts as a simple backend database.
// Note: Since Vercel serverless functions are stateless, this array resets when the server "sleeps".
// In a real, large-scale app, you would replace this with a connection to a real DB like MongoDB or Postgres.
let mockDatabase = [
    { id: '1', text: 'Welcome to The Gruvs Backend!', done: false },
    { id: '2', text: 'This data is served from a Vercel Serverless API.', done: true }
];

export default function handler(req, res) {
    // Add CORS headers so the frontend can communicate with the API without security errors
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        if (req.method === 'GET') {
            // Return all events
            return res.status(200).json(mockDatabase);
        } else if (req.method === 'POST') {
            // Add a new event
            const newItem = req.body;
            if (!newItem || !newItem.text) {
                return res.status(400).json({ error: 'Invalid data' });
            }
            mockDatabase.unshift({ id: newItem.id || Date.now().toString(), text: newItem.text, done: !!newItem.done });
            return res.status(201).json(mockDatabase);
        } else if (req.method === 'DELETE') {
            // Delete an event
            const { id } = req.query;
            mockDatabase = mockDatabase.filter((item) => item.id !== id);
            return res.status(200).json(mockDatabase);
        } else if (req.method === 'PUT') {
            // Update an event (toggle done)
            const { id } = req.body;
            mockDatabase = mockDatabase.map((item) =>
                item.id === id ? { ...item, done: !item.done } : item
            );
            return res.status(200).json(mockDatabase);
        } else {
            res.status(405).json({ error: 'Method Not Allowed' });
        }
    } catch (err) {
        console.error('Backend error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
