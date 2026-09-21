# HoraCerta

Sistema pessoal de controle de ponto e banco de horas.

## Stack Utilizada

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS
- React Router DOM
- Axios

### Backend
- Node.js
- TypeScript
- Express
- Zod
- dotenv
- CORS

### Banco de Dados & ORM
- PostgreSQL
- Prisma ORM

## Estrutura do Projeto

```
HoraCerta/
├── frontend/     # Aplicação web React + Vite
├── backend/      # API Express + Node.js
├── docs/         # Documentação e recursos do projeto
├── .gitignore
├── LICENSE
└── README.md
```

## Pré-requisitos

- **Node.js** (versão 18 ou superior recomendada)
- **npm** (ou yarn/pnpm)
- **PostgreSQL** (para persistência real de dados em etapas futuras)

## Como Executar Localmente

### Frontend

```bash
cd frontend
npm install
npm run dev
```

O frontend estará acessível em: [http://localhost:5173](http://localhost:5173)

### Backend

```bash
cd backend
npm install
npm run dev
```

A API backend estará acessível em: [http://localhost:3333](http://localhost:3333)

> **Nota de Configuração**: É necessário ter o arquivo `backend/.env` configurado com base em `backend/.env.example` para que a aplicação carregue a porta, URLs de CORS e a string de conexão com o PostgreSQL (`DATABASE_URL`).

## Endpoints Principais

- **Health Check**: `GET http://localhost:3333/health`
