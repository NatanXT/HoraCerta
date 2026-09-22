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
2. Configure as variáveis no `backend/.env` com as credenciais do seu PostgreSQL local e timezone:
   ```env
   PORT=3333
   FRONTEND_URL=http://localhost:5173
   DATABASE_URL="postgresql://usuario:senha@localhost:5432/horacerta?schema=public"
   APP_TIMEZONE=America/Sao_Paulo
   DEFAULT_USER_EMAIL=usuario@horacerta.local
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

## Configuração do Frontend

1. Copie o arquivo `frontend/.env.example` para `frontend/.env`:
   ```bash
   cp frontend/.env.example frontend/.env
   ```
2. Configure as variáveis no `frontend/.env`:
   ```env
   VITE_API_URL=http://localhost:3333
   VITE_APP_TIMEZONE=America/Sao_Paulo
   ```

## Rotas do Frontend

- **`/`**: Dashboard diário em tempo real com estatísticas de hoje e botão de registro de ponto.
- **`/historico`**: Visão mensal com calendário navegável, indicadores de frequência, status diários e detalhamento por dia.
- **`/banco-de-horas`**: Painel de banco de horas consolidado com saldo de hoje (provisório), saldo ao vivo, resumo por mês e lista de pendências.

## Endpoints Principais da API

- **`GET /health`**: Retorna a saúde da API backend e timestamp atual.
- **`GET /api/work-days/today`**: Consulta o resumo completo, métricas de tempo, saldo diário e histórico de registros do dia atual.
- **`GET /api/work-days/monthly?month=YYYY-MM`**: Consulta a visão mensal e os estados dos dias (`RECORDED`, `IN_PROGRESS`, `INCOMPLETE`, `NO_RECORDS`, `REST_DAY`, `FUTURE`).
- **`GET /api/work-days/:date`**: Consulta o resumo completo de uma data específica (`YYYY-MM-DD`). Retorna HTTP 400 se a data for inválida ou inexistente no calendário.
- **`POST /api/time-entries/clock-in`**: Registra o ponto de entrada (`CLOCK_IN`) utilizando o horário atual do servidor. Retorna HTTP 409 em caso de entrada duplicada.
- **`POST /api/time-entries/clock-out`**: Registra o ponto de saída (`CLOCK_OUT`) utilizando o horário atual do servidor. Retorna HTTP 409 em caso de saída sem entrada em aberto.
- **`GET /api/bank-hours`**: Consulta o status do banco de horas, saldos (consolidado, provisório e ao vivo), métricas por mês e lista de pendências.
- **`PUT /api/bank-hours/config`**: Define ou atualiza a data inicial e o saldo inicial do banco de horas. O banco de horas utiliza data inicial explícita e não transforma automaticamente dias sem registro em débito.
- **`PUT /api/work-days/:date/manual-adjustment`**: Realiza correção manual atômica dos intervalos de um dia histórico com motivo obrigatório. Os registros anteriores são preservados via soft delete (`deletedAt`) e permanecem disponíveis para auditoria.
- **`GET /api/work-days/:date/adjustments`**: Consulta a lista de histórico de auditoria de alterações manuais realizada em um dia histórico.

*Ajustes manuais substituem os registros efetivos do dia sem excluir fisicamente os registros anteriores, que permanecem disponíveis para auditoria.*
