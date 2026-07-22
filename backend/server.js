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
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100),
        email VARCHAR(100) UNIQUE,
        password VARCHAR(100),
        whatsapp VARCHAR(20),
        type VARCHAR(20),
        cep VARCHAR(20),
        state VARCHAR(5),
        address TEXT,
        is_subscriber BOOLEAN DEFAULT FALSE,
        certificate_url TEXT,
        iagro_login VARCHAR(100),
        iagro_password VARCHAR(100),
        reputation INTEGER DEFAULT 5
      );
    `);

    // Migração: Adicionar colunas se não existirem
    try { await client.query('ALTER TABLE users ADD COLUMN cep VARCHAR(20);'); } catch(e) {}
    try { await client.query('ALTER TABLE users ADD COLUMN state VARCHAR(5);'); } catch(e) {}
    try { await client.query('ALTER TABLE users ADD COLUMN address TEXT;'); } catch(e) {}
    try { await client.query('ALTER TABLE users ADD COLUMN is_subscriber BOOLEAN DEFAULT FALSE;'); } catch(e) {}
    try { await client.query('ALTER TABLE users ADD COLUMN certificate_url TEXT;'); } catch(e) {}
    try { await client.query('ALTER TABLE users ADD COLUMN iagro_login VARCHAR(100);'); } catch(e) {}
    try { await client.query('ALTER TABLE users ADD COLUMN iagro_password VARCHAR(100);'); } catch(e) {}

    // Seed Admin User
    try {
      const checkAdmin = await client.query("SELECT * FROM users WHERE email = 'admin@agrofacil.com'");
      if (checkAdmin.rows.length === 0) {
        await client.query(`
          INSERT INTO users (name, type, email, password_hash, whatsapp, reputation)
          VALUES ('Administrador', 'admin', 'admin@agrofacil.com', '4Gr0facil', '0000000000', 5.0)
        `);
        console.log('Usuário Administrador (admin@agrofacil.com) criado com sucesso!');
      } else {
        // Garantir que a senha esteja atualizada caso tenha sido alterada antes
        await client.query("UPDATE users SET password_hash = '4Gr0facil' WHERE email = 'admin@agrofacil.com'");
      }
    } catch (e) {
      console.log('Erro ao criar usuário Admin:', e);
    }
    
    // Migração: Adicionar tabelas ERP
    try { await client.query(`
      CREATE TABLE IF NOT EXISTS erp_employees (id SERIAL PRIMARY KEY, user_id INTEGER, name VARCHAR(100), role VARCHAR(50), salary NUMERIC, hire_date DATE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS erp_suppliers (id SERIAL PRIMARY KEY, user_id INTEGER, name VARCHAR(100), cnpj VARCHAR(20), phone VARCHAR(20), category VARCHAR(50), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS erp_transactions (id SERIAL PRIMARY KEY, user_id INTEGER, type VARCHAR(20), amount NUMERIC, description TEXT, due_date DATE, status VARCHAR(20), doc_url TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS erp_inventory (id SERIAL PRIMARY KEY, user_id INTEGER, item VARCHAR(100), quantity NUMERIC, unit VARCHAR(20), min_quantity NUMERIC, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS erp_documents (id SERIAL PRIMARY KEY, user_id INTEGER, doc_type VARCHAR(50), file_data TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    `); console.log('Tabelas ERP verificadas/criadas com sucesso.'); } catch(e) { console.log('Erro ao criar tabelas ERP:', e); }

    // Migração: Adicionar tabelas Consultoria/Marketplace Interno
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS system_suppliers (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100),
          item_category VARCHAR(100),
          base_price NUMERIC,
          shipping_rate_per_km NUMERIC,
          delivery_days INTEGER,
          freight_type VARCHAR(50) DEFAULT 'Terceirizado',
          origin_location VARCHAR(100) DEFAULT 'Dourados, MS',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      try { await client.query("ALTER TABLE system_suppliers ADD COLUMN freight_type VARCHAR(50) DEFAULT 'Terceirizado';"); } catch(e){}
      try { await client.query("ALTER TABLE system_suppliers ADD COLUMN origin_location VARCHAR(100) DEFAULT 'Dourados, MS';"); } catch(e){}

      const checkSuppliers = await client.query('SELECT COUNT(*) FROM system_suppliers');
      if (checkSuppliers.rows[0].count === '0') {
        await client.query(`
          INSERT INTO system_suppliers (name, item_category, base_price, shipping_rate_per_km, delivery_days, freight_type, origin_location) VALUES
          ('Yara Fertilizantes', 'Adubo NPK', 1950.00, 3.50, 7, 'Terceirizado', 'Rio Verde, GO'),
          ('Mosaic Fertilizantes', 'Adubo NPK', 1980.00, 3.20, 5, 'Por Conta', 'Uberaba, MG'),
          ('Copasul Cooperativa', 'Semente de Soja', 220.00, 2.00, 3, 'Particular', 'Naviraí, MS'),
          ('Bayer CropScience', 'Defensivos', 850.00, 4.00, 4, 'Terceirizado', 'São Paulo, SP'),
          ('Calcário MS', 'Calcário', 150.00, 5.00, 10, 'Próprio', 'Bodoquena, MS');
        `);
      }
      console.log('Tabela system_suppliers verificada/populada com sucesso.');
    } catch(e) { console.log('Erro ao criar tabelas de Consultoria:', e); }

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

// Subscribe (Mock Payment)
app.post('/api/users/:id/subscribe', async (req, res) => {
  try {
    const userId = req.params.id;
    await client.query('UPDATE users SET is_subscriber = TRUE WHERE id = $1', [userId]);
    res.json({ success: true, message: 'Assinatura PRO ativada com sucesso!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update IAGRO Credentials
app.post('/api/users/:id/iagro', async (req, res) => {
  try {
    const { login, password } = req.body;
    await client.query('UPDATE users SET iagro_login = $1, iagro_password = $2 WHERE id = $3', [login, password, req.params.id]);
    res.json({ success: true, message: 'Credenciais IAGRO salvas com sucesso (Bot configurado)!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Emissão de GTA (Simulador do Bot)
app.post('/api/gta/emit', async (req, res) => {
  try {
    // Na vida real, o gtaService.js usaria Puppeteer/RPA usando iagro_login e password
    res.json({ success: true, message: 'Bot conectou no e-Saniagro! GTA Solicitada com sucesso.', gta_number: 'GTA-MS-' + Math.floor(Math.random()*10000) });
  } catch(e) {
    res.status(500).json({ error: e.message });
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
    const admin1 = geoData.results[0].admin1 ? ', ' + geoData.results[0].admin1 : '';
    const locationName = geoData.results[0].name + admin1;

    // 2. Weather Forecast
    const weatherResponse = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=America/Sao_Paulo`);
    const weatherData = await weatherResponse.json();

    const wmoCodes = {
      0: 'Céu Limpo', 1: 'Principalmente Claro', 2: 'Parcialmente Nublado', 3: 'Encoberto',
      45: 'Neblina', 48: 'Nevoeiro Congelante', 51: 'Chuvisco Leve', 53: 'Chuvisco Moderado',
      55: 'Chuvisco Forte', 61: 'Chuva Fraca', 63: 'Chuva Moderada', 65: 'Chuva Forte',
      71: 'Neve Leve', 73: 'Neve Moderada', 75: 'Neve Forte', 95: 'Tempestade'
    };
    
    const currentCondition = wmoCodes[weatherData.current.weather_code] || 'Misto';
    const currentTemp = Math.round(weatherData.current.temperature_2m);
    const currentHumidity = Math.round(weatherData.current.relative_humidity_2m);
    
    const forecast = weatherData.daily.time.slice(1, 4).map((time, index) => {
      const date = new Date(time + 'T12:00:00');
      const dayName = index === 0 ? 'Amanhã' : date.toLocaleDateString('pt-BR', { weekday: 'short' });
      return {
        day: dayName.charAt(0).toUpperCase() + dayName.slice(1),
        temp: Math.round(weatherData.daily.temperature_2m_max[index + 1]),
        condition: wmoCodes[weatherData.daily.weather_code[index + 1]] || 'Misto'
      };
    });

    res.json({
      location: locationName,
      current: { temp: currentTemp, condition: currentCondition, humidity: currentHumidity },
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

// --- ERP ROUTES ---
const runQuery = async (res, query, values) => {
  try { const result = await client.query(query, values); res.json(result.rows); }
  catch (e) { res.status(500).json({ error: e.message }); }
};

// Employees
app.get('/api/erp/:userId/employees', (req, res) => runQuery(res, 'SELECT * FROM erp_employees WHERE user_id=$1 ORDER BY created_at DESC', [req.params.userId]));
app.post('/api/erp/:userId/employees', (req, res) => {
  const { name, role, salary, hire_date } = req.body;
  runQuery(res, 'INSERT INTO erp_employees (user_id, name, role, salary, hire_date) VALUES ($1, $2, $3, $4, $5) RETURNING *', [req.params.userId, name, role, salary, hire_date]);
});
app.delete('/api/erp/employees/:id', (req, res) => runQuery(res, 'DELETE FROM erp_employees WHERE id=$1 RETURNING id', [req.params.id]));

// Suppliers
app.get('/api/erp/:userId/suppliers', (req, res) => runQuery(res, 'SELECT * FROM erp_suppliers WHERE user_id=$1 ORDER BY created_at DESC', [req.params.userId]));
app.post('/api/erp/:userId/suppliers', (req, res) => {
  const { name, cnpj, phone, category } = req.body;
  runQuery(res, 'INSERT INTO erp_suppliers (user_id, name, cnpj, phone, category) VALUES ($1, $2, $3, $4, $5) RETURNING *', [req.params.userId, name, cnpj, phone, category]);
});
app.delete('/api/erp/suppliers/:id', (req, res) => runQuery(res, 'DELETE FROM erp_suppliers WHERE id=$1 RETURNING id', [req.params.id]));

// Transactions (Fluxo de Caixa)
app.get('/api/erp/:userId/transactions', (req, res) => runQuery(res, 'SELECT * FROM erp_transactions WHERE user_id=$1 ORDER BY due_date ASC', [req.params.userId]));
app.post('/api/erp/:userId/transactions', (req, res) => {
  const { type, amount, description, due_date, status, doc_url } = req.body;
  runQuery(res, 'INSERT INTO erp_transactions (user_id, type, amount, description, due_date, status, doc_url) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *', [req.params.userId, type, amount, description, due_date, status, doc_url]);
});
app.put('/api/erp/transactions/:id/status', (req, res) => {
  runQuery(res, 'UPDATE erp_transactions SET status=$1 WHERE id=$2 RETURNING *', [req.body.status, req.params.id]);
});
app.delete('/api/erp/transactions/:id', (req, res) => runQuery(res, 'DELETE FROM erp_transactions WHERE id=$1 RETURNING id', [req.params.id]));

// Inventory
app.get('/api/erp/:userId/inventory', (req, res) => runQuery(res, 'SELECT * FROM erp_inventory WHERE user_id=$1 ORDER BY item ASC', [req.params.userId]));
app.post('/api/erp/:userId/inventory', (req, res) => {
  const { item, quantity, unit, min_quantity } = req.body;
  runQuery(res, 'INSERT INTO erp_inventory (user_id, item, quantity, unit, min_quantity) VALUES ($1, $2, $3, $4, $5) RETURNING *', [req.params.userId, item, quantity, unit, min_quantity]);
});
app.delete('/api/erp/inventory/:id', (req, res) => runQuery(res, 'DELETE FROM erp_inventory WHERE id=$1 RETURNING id', [req.params.id]));

// Documents (GED Base64)
app.get('/api/erp/:userId/documents', (req, res) => runQuery(res, 'SELECT id, user_id, doc_type, created_at FROM erp_documents WHERE user_id=$1 ORDER BY created_at DESC', [req.params.userId]));
app.get('/api/erp/documents/:id/download', async (req, res) => {
  try {
    const doc = await client.query('SELECT file_data FROM erp_documents WHERE id=$1', [req.params.id]);
    res.json(doc.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/erp/:userId/documents', (req, res) => {
  const { doc_type, file_data } = req.body;
  runQuery(res, 'INSERT INTO erp_documents (user_id, doc_type, file_data) VALUES ($1, $2, $3) RETURNING id, doc_type, created_at', [req.params.userId, doc_type, file_data]);
});
app.delete('/api/erp/documents/:id', (req, res) => runQuery(res, 'DELETE FROM erp_documents WHERE id=$1 RETURNING id', [req.params.id]));

// --- CONSULTORIA DE COMPRAS ---
app.post('/api/consulting/quote', async (req, res) => {
  try {
    const { item, quantity, destination } = req.body;
    
    // 1. Encontrar fornecedores que vendem algo similar ao item
    const suppliersResult = await client.query(`
      SELECT * FROM system_suppliers 
      WHERE item_category ILIKE $1
    `, [`%${item}%`]);

    if (suppliersResult.rows.length === 0) {
      return res.json({ success: false, message: 'Nenhum fornecedor parceiro encontrado para este item no momento.' });
    }

    // 2. Simular cálculo logístico (Distância mockada 300km)
    const distanceKm = 300; 
    let bestOption = null;
    let lowestTotal = Infinity;

    suppliersResult.rows.forEach(sup => {
      const productTotal = parseFloat(sup.base_price) * parseFloat(quantity);
      const freightTotal = parseFloat(sup.shipping_rate_per_km) * distanceKm;
      const totalCost = productTotal + freightTotal;

      if (totalCost < lowestTotal) {
        lowestTotal = totalCost;
        bestOption = {
          supplier: sup.name,
          unit_price: parseFloat(sup.base_price),
          product_total: productTotal,
          freight_total: freightTotal,
          delivery_days: sup.delivery_days,
          total_cost: totalCost,
          origin_location: sup.origin_location,
          freight_type: sup.freight_type
        };
      }
    });

    // 3. Adicionar Dica de Planejamento (Consultoria)
    const planningTip = `Recomendamos travar o preço em contratos futuros (Barter). Ao comprar ${quantity} unidades com a ${bestOption.supplier}, você garante a margem da safra antes das oscilações do dólar. O frete estimado de ${bestOption.origin_location} para a sua região (${destination}) é de R$ ${bestOption.freight_total.toLocaleString('pt-BR', {minimumFractionDigits: 2})} (Tipo de Frete: ${bestOption.freight_type}).`;

    res.json({
      success: true,
      data: bestOption,
      advice: planningTip
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- ADMIN ROUTES ---
app.get('/api/admin/suppliers', async (req, res) => {
  try {
    const result = await client.query('SELECT * FROM system_suppliers ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/admin/suppliers', async (req, res) => {
  try {
    const { name, item_category, base_price, shipping_rate_per_km, delivery_days, freight_type, origin_location } = req.body;
    const result = await client.query(`
      INSERT INTO system_suppliers (name, item_category, base_price, shipping_rate_per_km, delivery_days, freight_type, origin_location)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
    `, [name, item_category, base_price, shipping_rate_per_km, delivery_days, freight_type, origin_location]);
    res.json(result.rows[0]);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/admin/suppliers/:id', async (req, res) => {
  try {
    await client.query('DELETE FROM system_suppliers WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.use(express.static(path.join(__dirname, 'public')));
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
