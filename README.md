# AgroGestor Rural

Este projeto é um MVP de plataforma rural voltada para marketplace de gado, gestão simples e comunicação com produtores.

## Como subir

1. Instale o Docker e o Docker Compose.
2. Na raiz do projeto, execute:

```bash
docker compose up --build
```

3. Acesse:
   - Frontend: http://localhost:3000
   - Health check: http://localhost:3000/api/health

## Estrutura

- backend: API em Node.js + Express + PostgreSQL
- frontend: interface web simples servida pela API

## Próximos passos

- autenticação de usuários
- upload de fotos
- chat integrado
- painel de cotações regionais
