import express from 'express';
import cors from 'cors';
import { Client } from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

// Connect to the database when server starts
client.connect().catch(err => console.error('DB Connection error', err.stack));

app.get('/api/health', async (_req, res) => {
  try {
    const result = await client.query('SELECT NOW()');
    res.json({ ok: true, time: result.rows[0].now });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get('/api/listings', async (req, res) => {
  try {
    const { category, type } = req.query;
    let query = `
      SELECT l.*, u.name as user_name, u.reputation as user_reputation 
      FROM listings l
      JOIN users u ON l.user_id = u.id
      WHERE 1=1
    `;
    const values = [];
    
    if (category && category !== 'todos') {
      values.push(category);
      query += ` AND l.category = $${values.length}`;
    }
    
    if (type) {
      values.push(type);
      query += ` AND l.transaction_type = $${values.length}`;
    }
    
    query += ' ORDER BY l.created_at DESC';
    
    const result = await client.query(query, values);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/listings/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const query = `
      SELECT l.*, u.name as user_name, u.reputation as user_reputation 
      FROM listings l
      JOIN users u ON l.user_id = u.id
      WHERE l.id = $1
    `;
    const result = await client.query(query, [id]);
    if(result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/listings', async (req, res) => {
  try {
    const { user_id, title, transaction_type, category, price, region, description } = req.body;
    const query = `
      INSERT INTO listings (user_id, title, transaction_type, category, price, region, description, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, '{}')
      RETURNING *
    `;
    const values = [user_id, title, transaction_type, category, price, region, description];
    const result = await client.query(query, values);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const userResult = await client.query('SELECT id, name, type, whatsapp, reputation, created_at FROM users WHERE id = $1', [userId]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const listingsResult = await client.query('SELECT * FROM listings WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    
    res.json({
      ...userResult.rows[0],
      listings: listingsResult.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.use(express.static(path.join(__dirname, 'public')));
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
