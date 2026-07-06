import express from 'express';
import cors from 'cors';
import { Client } from 'pg';

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

app.get('/', (_req, res) => {
  res.send(`<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>AgroGestor Rural</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 2rem; color: #1f2937; }
        .card { padding: 1.5rem; border: 1px solid #d1d5db; border-radius: 12px; max-width: 720px; }
        code { background: #f3f4f6; padding: 0.2rem 0.4rem; border-radius: 4px; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>AgroGestor Rural</h1>
        <p>Seu MVP de marketplace rural e gestão simples para produtores.</p>
        <p>Use <code>/api/health</code> para verificar o backend e <code>/api/marketplace/animals</code> para ver o catálogo inicial.</p>
      </div>
    </body>
  </html>`);
});

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
