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
- **PostgreSQL** (para persistência de dados real)

## Configuração do Banco de Dados

1. Copie o arquivo `backend/.env.example` para `backend/.env`:
   ```bash
   cp backend/.env.example backend/.env
   ```
2. Configure a variável `DATABASE_URL` no `backend/.env` com as credenciais do seu PostgreSQL local:
   ```env
   DATABASE_URL="postgresql://usuario:senha@localhost:5432/horacerta?schema=public"
   ```

### Comandos Úteis do Prisma (no diretório `backend`)

- **Executar migrations**:
  ```bash
  npx prisma migrate dev
  ```
- **Executar seed de dados iniciais**:
  ```bash
  npm run prisma:seed
  ```
- **Abrir interface visual do banco**:
  ```bash
  npm run prisma:studio
  ```

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

## Endpoints Principais

- **Health Check**: `GET http://localhost:3333/health`
