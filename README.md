# HoraCerta

Sistema pessoal de registro de ponto, acompanhamento de jornada, histórico mensal, banco de horas e gestão de ausências/feriados.

---

## 1. Sobre o Projeto

O **HoraCerta** é um sistema pessoal desenvolvido com o objetivo de oferecer controle total sobre o registro de ponto diário, apuração de banco de horas e planejamento de ausências (feriados, férias, atestados e folgas). O projeto serve tanto para uso pessoal diário quanto como repositório de referência técnica para arquitetura full-stack moderna com TypeScript.

---

## 2. Funcionalidades Principais

- **Registro de Ponto Diário**: Registros de entrada (`CLOCK_IN`) e saída (`CLOCK_OUT`) com suporte dinâmico a múltiplos intervalos no mesmo dia.
- **Dashboard em Tempo Real**: Visualização imediata do status do expediente, relógio digital ao vivo, tempo da sessão atual, jornada total trabalhada e saldo do dia.
- **Histórico Mensal**: Navegação por calendário mensal com indicadores visuais de frequência (`RECORDED`, `IN_PROGRESS`, `INCOMPLETE`, `NO_RECORDS`, `REST_DAY`, `FUTURE`, `EXCUSED`), detalhamento por dia e resumo consolidado.
- **Banco de Horas**: Apuração com saldo inicial configurável, saldo consolidado até ontem, saldo provisório de hoje, saldo ao vivo, créditos, débitos e lista detalhada de pendências.
- **Ajustes Manuais & Auditoria**: Correção atômica de registros de ponto em dias históricos com motivo obrigatório, preservando o histórico anterior via soft delete (`deletedAt`) e registros de auditoria (`WorkDayAdjustment`).
- **Jornada Semanal Versionada**: Configuração de carga horária esperada para os 7 dias da semana com versionamento por data de vigência (`effectiveFrom`), sem reescrever o passado.
- **Ausências, Feriados e Justificativas (ETAPA 09)**: Cadastro de ocorrências de dia inteiro (`HOLIDAY`, `VACATION`, `MEDICAL_LEAVE`, `JUSTIFIED_ABSENCE`, `EXCEPTIONAL_DAY_OFF`) que abonam a jornada esperada (expected = 0) sem destruir os snapshots históricos (`WorkDay.expectedMinutesSnapshot`).
- **Relatórios & Exportação (ETAPA 10)**: Geração de relatórios consolidados por período personalizável (até 366 dias inclusivos), métricas globais e de banco de horas (crédito, débito, saldo apurado e saldo ao vivo provisório), breakdown de ocorrências ativas por interseção civil de dias, detalhamento diário com fonte dos registros (`CLOCK`, `MANUAL`, `MIXED`), exportação CSV com sanitização contra Formula Injection e visualização de impressão/PDF otimizada.

---

## 3. Stack Tecnológica

### Frontend
- **React 18** + **TypeScript**
- **Vite** (Build tool e Dev Server)
- **Tailwind CSS v4** (Estilização responsiva)
- **React Router DOM v7** (Roteamento SPA)
- **Axios** (Cliente HTTP)
- **Lucide React** (Ícones SVG — Zero emojis na interface)

### Backend
- **Node.js** (v18+) + **TypeScript**
- **Express** (Framework Web REST API)
- **Zod** (Validação estrita de schemas)
- **Prisma ORM v6** (Interface com banco de dados)
- **Vitest** (Suíte de testes automatizados unitários e de integração)

### Banco de Dados
- **PostgreSQL 16** (Persistência relacional)

---

## 4. Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────┐
│                      FRONTEND (SPA)                     │
│               React + TypeScript + Vite                 │
└────────────────────────────┬────────────────────────────┘
                             │ HTTP (Axios)
                             ▼
┌─────────────────────────────────────────────────────────┐
│                     BACKEND (API)                       │
│              Express + TypeScript + Zod                 │
│                                                         │
│  [Controllers] ──► [Services] ──► [Repositories]        │
│                         │                               │
│                         ▼                               │
│               [Utils / Resolvers]                       │
└────────────────────────────┬────────────────────────────┘
                             │ Prisma Client
                             ▼
┌─────────────────────────────────────────────────────────┐
│                 BANCO DE DADOS (RDBMS)                  │
│                     PostgreSQL 16                       │
└─────────────────────────────────────────────────────────┘
```

### Responsabilidades por Camada:
- **`controllers/`**: Recebe requisições HTTP, valida entradas com schemas Zod, delega para serviços e retorna respostas JSON padronizadas.
- **`services/`**: Contém todas as regras de negócio do sistema (apuração de banco de horas, transações atômicas, resolução de ocorrências, congelamento de snapshots).
- **`repositories/`**: Abstrai todas as operações de banco de dados via Prisma Client.
- **`schemas/`**: Schemas Zod de validação para rotas e parâmetros.
- **`utils/`**: Funções puras de cálculo de tempo, timezone e resolução de jornadas/ocorrências (`resolveWorkDayState`, `resolveEffectiveExpectedMinutes`).

---

## 5. Estrutura de Pastas

```
HoraCerta/
├── backend/
│   ├── prisma/
│   │   ├── migrations/          # Migrations SQL versionadas
│   │   └── schema.prisma        # Schema do Prisma ORM
│   ├── src/
│   │   ├── config/              # Variáveis de ambiente e timezone
│   │   ├── controllers/         # Express Controllers
│   │   ├── errors/              # Classes de erros HTTP personalizados (AppError)
│   │   ├── lib/                 # Instância do Prisma Client
│   │   ├── middlewares/         # Middlewares Express (ErrorHandler)
│   │   ├── repositories/        # Camada de acesso a dados (Repository pattern)
│   │   ├── routes/              # Definição das rotas REST
│   │   ├── schemas/             # Schemas Zod de validação
│   │   ├── services/            # Serviços com regras de negócio
│   │   ├── types/               # DTOs e tipos TypeScript
│   │   ├── utils/               # Helpers puros de tempo e apuração
│   │   ├── app.ts               # Inicialização do Express
│   │   └── server.ts            # Ponto de entrada do servidor
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/          # Componentes reutilizáveis (Dashboard, History, etc.)
│   │   ├── config/              # Variáveis de ambiente
│   │   ├── hooks/               # Custom Hooks (useCalendarOccurrences, etc.)
│   │   ├── layouts/             # AppLayout e barra de navegação
│   │   ├── pages/               # Páginas da aplicação (Dashboard, Histórico, Ausências, etc.)
│   │   ├── routes/              # Configuração do React Router
│   │   ├── services/            # Serviços de API (Axios)
│   │   ├── types/               # Tipos TypeScript compartilhados
│   │   └── utils/               # Formatação de horas e datas
│   ├── package.json
│   └── vite.config.ts
├── docs/
│   └── ARCHITECTURE.md          # Documentação técnica de arquitetura
├── .gitignore
├── LICENSE
└── README.md
```

---

## 6. Pré-requisitos

- **Node.js**: Versão 18.0.0 ou superior (recomendado Node.js 20/22 LTS).
- **npm**: Versão 9.0.0 ou superior.
- **PostgreSQL**: Versão 14 ou superior (desenvolvido e testado com PostgreSQL 16 no Windows).

---

## 7. Configuração Inicial Passo a Passo

### 1. Clonar o repositório
```bash
git clone https://github.com/NatanXT/HoraCerta.git
cd HoraCerta
```

### 2. Instalar dependências do Backend
```bash
cd backend
npm install
```

### 3. Instalar dependências do Frontend
```bash
cd ../frontend
npm install
```

---

## 8. Variáveis de Ambiente

### Backend (`backend/.env`)
Crie o arquivo `backend/.env` baseado no exemplo abaixo:

```env
PORT=3333
FRONTEND_URL=http://localhost:5173
DATABASE_URL="postgresql://USUARIO:SENHA@localhost:5432/horacerta?schema=public"
APP_TIMEZONE=America/Sao_Paulo
DEFAULT_USER_EMAIL=usuario@horacerta.local
```

### Frontend (`frontend/.env`)
Crie o arquivo `frontend/.env`:

```env
VITE_API_URL=http://localhost:3333
VITE_APP_TIMEZONE=America/Sao_Paulo
```

---

## 9. Primeira Configuração do Banco de Dados

1. **Certifique-se de que o PostgreSQL está rodando** e que o banco de dados `horacerta` foi criado.
2. **Aplicar as migrations**:
   ```bash
   cd backend
   npx prisma migrate deploy
   ```
3. **Gerar o Prisma Client**:
   ```bash
   npx prisma generate
   ```
4. **Executar a Seed Inicial**:
   ```bash
   npm run prisma:seed
   ```
   *A seed é idempotente: cria o usuário padrão e a jornada semanal de 40h (Mon-Fri 8h) caso ainda não existam, sem resetar dados existentes.*

---

## 10. Como iniciar o HoraCerta após ligar/reiniciar o computador

Para executar o sistema no dia a dia, siga a ordem de inicialização abaixo:

### Passo 1: Verificar se o serviço do PostgreSQL está rodando (Windows)
No PowerShell:
```powershell
Get-Service -Name "postgresql-x64-16"
```
Se o status estiver `Stopped`, inicie o serviço (exige PowerShell como Administrador):
```powershell
Start-Service -Name "postgresql-x64-16"
```
*(Caso utilize outra versão do PostgreSQL, consulte o serviço com `Get-Service *postgres*`)*.

### Passo 2: Iniciar o Backend (Terminal 1)
```bash
cd backend
npm run dev
```
- **Saída esperada**: Servidor executando em `http://localhost:3333`.

### Passo 3: Iniciar o Frontend (Terminal 2)
```bash
cd frontend
npm run dev
```
- **Saída esperada**: Aplicação web em `http://localhost:5173`.

---

## 11. Teste Rápido de Conectividade

Antes de navegar no frontend, você pode testar a API no seu navegador ou cURL:
- Accesse: `http://localhost:3333/health`
- **Resposta esperada**:
  ```json
  {
    "status": "ok",
    "timestamp": "2026-09-23T13:00:00.000Z"
  }
  ```

---

## 12. Solução de Problemas Comuns (Troubleshooting)

| Sintoma | Causa Provável | Solução |
| :--- | :--- | :--- |
| **Frontend abre mas não carrega dados** | Backend parado ou porta 3333 inacessível. | Certifique-se de ter rodado `npm run dev` na pasta `backend`. |
| **`ECONNREFUSED 127.0.0.1:5432`** | Serviço do PostgreSQL está parado. | Execute `Start-Service postgresql-x64-16` no PowerShell como Admin. |
| **`ECONNREFUSED 127.0.0.1:3333`** | API Backend parada ou crashou por erro de `.env`. | Verifique se o `backend/.env` possui a `DATABASE_URL` correta e rode `npm run dev` no backend. |
| **`Port 5173 is in use`** | Outro processo está utilizando a porta do Vite. | Encerre o processo anterior ou altere a porta no `vite.config.ts` e no `FRONTEND_URL` do backend. |
| **Erro de módulo Prisma desatualizado** | Alteração no schema sem regeneração de tipos. | Execute `npx prisma generate` na pasta `backend`. |
| **Migration pendente** | Novas alterações de banco não aplicadas. | Execute `npx prisma migrate status` e `npx prisma migrate deploy` no backend. |

---

## 13. Comandos Úteis e Comandos Proibidos

### Comandos Úteis

#### Backend (`/backend`)
```bash
npm run dev               # Inicia servidor de desenvolvimento com TSX watch
npm run build             # Compila o projeto TypeScript para dist/
npm test                  # Executa a suíte de testes Vitest
npm run prisma:seed       # Executa o script de dados iniciais
npx prisma validate       # Valida a integridade do schema.prisma
npx prisma generate       # Gera o cliente TypeScript do Prisma
npx prisma migrate status # Consulta o estado das migrations
npx prisma migrate dev    # Cria e aplica uma nova migration em desenvolvimento
npx prisma studio         # Interface visual para inspecionar o banco de dados
```

#### Frontend (`/frontend`)
```bash
npm run dev               # Inicia o servidor Vite na porta 5173
npm run build             # Valida TypeScript e gera build de produção
```

### ⚠️ Comandos PROIBIDOS no Banco com Dados Reais
> [!CAUTION]
> **NUNCA execute os comandos abaixo em ambiente contendo dados pessoais reais sem backup previo:**
> - `npx prisma migrate reset` (Apaga todo o banco de dados e recria do zero)
> - `npx prisma db push` (Sobrescreve estruturas sem controle de migration versionada)
> - Comandos SQL manuais como `TRUNCATE` ou `deleteMany({})` em tabelas de histórico (`WorkDay`, `TimeEntry`, `CalendarOccurrence`).

---

## 14. Regras de Negócio Fundamentais

1. **Timezone**: O fuso horário padrão oficial do sistema é `America/Sao_Paulo`. O backend é a autoridade máxima de horário em todos os registros dinâmicos de ponto.
2. **Registros de Ponto**: Registros do botão utilizam o horário exato do servidor. O frontend nunca envia o horário do dispositivo no registro de ponto em tempo real.
3. **Múltiplos Intervalos**: O sistema permite número ilimitado de entradas e saídas no mesmo dia (ex: Entrada 08:00, Saída 12:00, Entrada 13:00, Saída 17:00).
4. **Armazenamento em Minutos**: Todos os cálculos de jornada e saldo de banco de horas são manipulados e armazenados estritamente em **minutos inteiros** (ex: 08h30 = 510 minutos).
5. **Jornada Versionada**: Alterar as horas diárias na tela de configurações cria uma nova versão da jornada com vigência (`effectiveFrom`), preservando os cálculos de dias passados.
6. **Snapshot de Jornada**: Ao criar um dia de trabalho (`WorkDay`) via ponto ou ajuste manual, o valor `expectedMinutesSnapshot` congela a jornada daquela data.
7. **Ausências e Feriados**: Ocorrências cadastradas (`CalendarOccurrence`) abonam a jornada esperada do dia (expected efetivo = 0), sem destruir o `expectedMinutesSnapshot` original. Trabalho realizado em dia abonado gera crédito integral (100%).
8. **Dia Excused vs Pending**: Dias sem registro cobertos por ocorrência recebem o status `EXCUSED` e deixam de constar como pendência no Banco de Horas. Dias com ponto incompleto (`CLOCK_IN` sem saída) continuam sendo pendências obrigatórias mesmo em dias de feriado.
9. **Zero Emojis na UI**: A interface utiliza estritamente ícones vetoriais da biblioteca `lucide-react`.

---

## 15. Endpoints REST da API

### Saúde da Aplicação
- `GET /health` — Retorna status da API e timestamp.

### Registros de Ponto
- `POST /api/time-entries/clock-in` — Registra entrada com horário oficial do servidor.
- `POST /api/time-entries/clock-out` — Registra saída com horário oficial do servidor.

### Dias de Trabalho & Histórico
- `GET /api/work-days/today` — Consulta resumo, status, próximo passo e ocorrências do dia atual.
- `GET /api/work-days/monthly?month=YYYY-MM` — Consulta o calendário e resumo do mês.
- `GET /api/work-days/:date` — Consulta o resumo de uma data específica (`YYYY-MM-DD`).
- `PUT /api/work-days/:date/manual-adjustment` — Realiza correção manual atômica dos intervalos com motivo obrigatorio.
- `GET /api/work-days/:date/adjustments` — Consulta histórico de auditoria de alterações manuais.

### Banco de Horas
- `GET /api/bank-hours` — Consulta saldos (consolidado, provisório e ao vivo), métricas e pendências.
- `PUT /api/bank-hours/config` — Define ou atualiza data inicial e saldo inicial do banco de horas.

### Configurações
- `GET /api/settings` — Consulta perfil e jornada semanal vigente.
- `PUT /api/settings/profile` — Atualiza o nome do usuário.
- `PUT /api/settings/work-schedule` — Atualiza a jornada semanal para os 7 dias.

### Ausências e Feriados (ETAPA 09)
- `GET /api/calendar-occurrences?from=YYYY-MM-DD&to=YYYY-MM-DD` — Lista ocorrências no período.
- `POST /api/calendar-occurrences` — Cadastra nova ocorrência (validação de sobreposição 409).
- `PUT /api/calendar-occurrences/:id` — Atualiza ocorrência existente.
- `DELETE /api/calendar-occurrences/:id` — Realiza soft delete (`deletedAt = agora`).

### Relatórios & Exportação (ETAPA 10)
- `GET /api/reports/work-hours?from=YYYY-MM-DD&to=YYYY-MM-DD` — Consulta relatório consolidado completo de horas, banco de horas, pendências e breakdown de ocorrências.
- `GET /api/reports/work-hours.csv?from=YYYY-MM-DD&to=YYYY-MM-DD` — Exporta relatório consolidado em arquivo CSV formatado (UTF-8 BOM, `;` separador e sanitização anti-formula-injection).

---

## 16. Roadmap do Projeto

- [x] **ETAPA 01**: Fundação e estrutura do projeto
- [x] **ETAPA 02**: Persistência com PostgreSQL e Prisma ORM
- [x] **ETAPA 03**: Motor de cálculo de ponto e múltiplos intervalos
- [x] **ETAPA 04**: Dashboard diário em tempo real
- [x] **ETAPA 05**: Histórico mensal navegável com estatísticas
- [x] **ETAPA 06**: Apuração completa de Banco de Horas
- [x] **ETAPA 07**: Ajustes manuais e auditoria de alterações
- [x] **ETAPA 08**: Jornada semanal versionada e configurações
- [x] **ETAPA 09**: Gestão de Ausências, Feriados e Justificativas
- [x] **ETAPA 10**: Relatórios e exportação de dados (CSV e Impressão/PDF)
- [ ] Polimento de UX e refinamentos visuais (Próxima Fase)

