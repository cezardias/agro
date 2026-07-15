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

    // Migration: add produtor features
    const checkAddress = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name='users' AND column_name='cep';
    `);
    if (checkAddress.rows.length === 0) {
      console.log('Aplicando migração: adicionando campos de produtor...');
      await client.query(`
        ALTER TABLE users 
        ADD COLUMN cep VARCHAR(20),
        ADD COLUMN address VARCHAR(255),
        ADD COLUMN state VARCHAR(50),
        ADD COLUMN is_subscriber BOOLEAN DEFAULT FALSE,
        ADD COLUMN certificate_url VARCHAR(255);
      `);
      await client.query("UPDATE users SET is_subscriber = TRUE WHERE type = 'produtor';");
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
    const userResult = await client.query('SELECT id, name, type, whatsapp, reputation, created_at, cep, address, state, is_subscriber, certificate_url FROM users WHERE id = $1', [userId]);
    
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
    const { name, email, password, type, whatsapp, cep, address, state } = req.body;
    const query = `
      INSERT INTO users (name, email, password_hash, type, whatsapp, reputation, cep, address, state)
      VALUES ($1, $2, $3, $4, $5, 5.0, $6, $7, $8)
      RETURNING id, name, email, type, whatsapp, reputation, cep, address, state, is_subscriber
    `;
    const result = await client.query(query, [name, email, password, type, whatsapp, cep, address, state]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/users/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const query = `SELECT id, name, email, type, whatsapp, reputation, cep, address, state, is_subscriber, certificate_url FROM users WHERE email = $1 AND password_hash = $2`;
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

// Cotações (Real-time via scraping Notícias Agrícolas)
app.get('/api/quotations', async (req, res) => {
  try {
    let soja = 125.50, boi = 235.00, suino = 6.80, frango = 5.10, milho = 58.00;
    
    try {
      const response = await fetch('https://www.noticiasagricolas.com.br/cotacoes/', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      if(response.ok) {
        const html = await response.text();
        
        // Função auxiliar para tentar extrair preço baseado numa palavra-chave
        const extractPrice = (keyword) => {
          const regex = new RegExp(keyword + '[\\\\s\\\\S]{0,300}?(?:R\\$\\s*)?([0-9]{2,3},[0-9]{2})', 'i');
          const match = html.match(regex);
          if (match && match[1]) {
            return parseFloat(match[1].replace(',', '.'));
          }
          return null;
        };

        const realSoja = extractPrice('soja');
        const realBoi = extractPrice('boi gordo');
        const realMilho = extractPrice('milho');
        const realSuino = extractPrice('suíno');
        
        if(realSoja) soja = realSoja;
        if(realBoi) boi = realBoi;
        if(realMilho) milho = realMilho;
        if(realSuino) suino = realSuino;
      }
    } catch(err) {
      console.log('Falha ao buscar cotação real, usando valores base:', err.message);
    }

    res.json({
      commodities: [
        { name: 'Soja (Saca 60kg)', price: soja, trend: 'up' },
        { name: 'Boi Gordo (Arroba)', price: boi, trend: 'stable' },
        { name: 'Suíno Vivo (Kg)', price: suino, trend: 'up' },
        { name: 'Frango Vivo (Kg)', price: frango, trend: 'stable' },
        { name: 'Milho (Saca 60kg)', price: milho, trend: 'down' }
      ],
      insumos: [
        { name: 'Adubo NPK 04-14-08 (Ton)', price: 2100.00, region: 'Goiás' },
        { name: 'Ureia Agrícola (Ton)', price: 1850.00, region: 'Goiás' }
      ]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clima (Real-time via Open-Meteo)
app.get('/api/weather', async (req, res) => {
  try {
    const region = req.query.region || 'Goiás';
    
    // 1. Geocoding
    const geoResponse = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(region)}&count=1&language=pt`);
    const geoData = await geoResponse.json();
    
    if (!geoData.results || geoData.results.length === 0) {
      return res.json({
        location: region,
        current: { temp: 28, condition: 'Desconhecido', humidity: 0 },
        forecast: []
      });
    }
    
    const lat = geoData.results[0].latitude;
    const lon = geoData.results[0].longitude;
    const locationName = geoData.results[0].name;

    // 2. Weather Forecast
    const weatherResponse = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=America/Sao_Paulo`);
    const weatherData = await weatherResponse.json();

    const wmoCodes = {
      0: 'Céu Limpo', 1: 'Principalmente Claro', 2: 'Parcialmente Nublado', 3: 'Encoberto',
      45: 'Neblina', 48: 'Nevoeiro Congelante', 51: 'Chuvisco Leve', 53: 'Chuvisco Moderado',
      55: 'Chuvisco Forte', 61: 'Chuva Fraca', 63: 'Chuva Moderada', 65: 'Chuva Forte',
      71: 'Neve Leve', 73: 'Neve Moderada', 75: 'Neve Forte', 95: 'Tempestade'
    };
    
    const currentCondition = wmoCodes[weatherData.current_weather.weathercode] || 'Misto';
    const currentTemp = Math.round(weatherData.current_weather.temperature);
    
    const forecast = weatherData.daily.time.slice(1, 4).map((time, index) => {
      const date = new Date(time + 'T12:00:00');
      const dayName = index === 0 ? 'Amanhã' : date.toLocaleDateString('pt-BR', { weekday: 'short' });
      return {
        day: dayName.charAt(0).toUpperCase() + dayName.slice(1),
        temp: Math.round(weatherData.daily.temperature_2m_max[index + 1]),
        condition: wmoCodes[weatherData.daily.weathercode[index + 1]] || 'Misto'
      };
    });

    res.json({
      location: locationName,
      current: { temp: currentTemp, condition: currentCondition, humidity: 60 },
      forecast: forecast
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Emissão de NF (Simulador)
app.post('/api/nf/emit', (req, res) => {
  setTimeout(() => {
    res.json({ success: true, message: 'Nota Fiscal emitida com sucesso pela SEFAZ.', nf_number: '1000' + Math.floor(Math.random()*999) });
  }, 1500);
});

// Upload Certificado (Simulador)
app.post('/api/upload-certificate', (req, res) => {
  setTimeout(() => {
    res.json({ success: true, url: '/simulated-certificate.pdf' });
  }, 1000);
});

app.use(express.static(path.join(__dirname, 'public')));
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
