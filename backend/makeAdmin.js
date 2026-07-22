import { Client } from 'pg';

const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/agrogestor'
});

async function run() {
  await client.connect();
  await client.query("UPDATE users SET type='admin'");
  console.log('Todos os usuários foram atualizados para ADMIN para testes!');
  process.exit(0);
}

run();
