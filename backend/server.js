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
client.connect()
  .then(() => initDB())
  .catch(err => console.error('DB Connection error', err.stack));

async function initDB() {
  try {
    const checkTable = await client.query("SELECT to_regclass('public.users');");
    if (checkTable.rows[0].to_regclass === null) {
      console.log('Tabelas não existem. Criando banco e populando seeds...');
      const fs = await import('fs');
      const path = await import('path');
      const sqlPath = path.join(__dirname, 'init.sql');
      const sql = fs.readFileSync(sqlPath, 'utf8');
      await client.query(sql);
      console.log('Banco inicializado com sucesso!');
    }
    
    // Migration: add password_hash se não existir
    const checkCol = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='users' AND column_name='password_hash';
    `);
    if (checkCol.rows.length === 0) {
      console.log('Aplicando migração: adicionando password_hash...');
      await client.query("ALTER TABLE users ADD COLUMN password_hash VARCHAR(255);");
      await client.query("UPDATE users SET password_hash = '123456';"); // Senha padrão para os seeds
    }
  } catch (err) {
    console.error('Erro ao inicializar o banco:', err);
  }
}

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

// Auth Routes
app.post('/api/users/register', async (req, res) => {
  try {
    const { name, email, password, type, whatsapp } = req.body;
    const query = `
      INSERT INTO users (name, email, password_hash, type, whatsapp, reputation)
      VALUES ($1, $2, $3, $4, $5, 5.0)
      RETURNING id, name, email, type, whatsapp, reputation
    `;
    const result = await client.query(query, [name, email, password, type, whatsapp]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/users/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const query = `SELECT id, name, email, type, whatsapp, reputation FROM users WHERE email = $1 AND password_hash = $2`;
    const result = await client.query(query, [email, password]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Email ou senha inválidos' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete Listing
app.delete('/api/listings/:id', async (req, res) => {
  try {
    const id = req.params.id;
    await client.query('DELETE FROM listings WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.use(express.static(path.join(__dirname, 'public')));
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
