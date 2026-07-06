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

app.get('/api/health', async (_req, res) => {
  try {
    await client.connect();
    const result = await client.query('SELECT NOW()');
    await client.end();
    res.json({ ok: true, time: result.rows[0].now });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get('/api/marketplace/animals', (_req, res) => {
  res.json([
    {
      id: 1,
      title: 'Lote de novilhos',
      region: 'Sudoeste Goiano',
      price: 1800,
      category: 'recria',
      description: 'Lote bem formado, manejo simples, vacinação em dia.'
    },
    {
      id: 2,
      title: 'Vaca de descarte',
      region: 'Triângulo Mineiro',
      price: 1600,
      category: 'descarte',
      description: 'Animal em boa condição corporal.'
    }
  ]);
});

app.use(express.static(path.join(__dirname, 'public')));
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
