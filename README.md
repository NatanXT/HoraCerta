# HoraCerta

Sistema de controle de ponto, acompanhamento de jornada assistida, histórico mensal, banco de horas, gestão de ausências/feriados e autenticação de usuários.

---

## 1. Sobre o Projeto

O **HoraCerta** é um sistema desenvolvido com o objetivo de oferecer controle total sobre o registro de ponto diário, fluxo assistido de expediente com pausas para lanche e almoço, cadastro de usuário autenticado, perfil personalizável, apuração de banco de horas e planejamento de ausências.

---

## 2. Funcionalidades Principais

- **Autenticação & Sessão Autenticada (ETAPA 11)**: Cadastro de usuário (`/api/auth/register`), login (`/api/auth/login`), logout (`/api/auth/logout`), e verificação de perfil (`/api/auth/me`) via cookies HTTP-only JWT. Estratégia de claim transparente para preservar históricos e IDs legados.
- **Jornada Assistida com Pausas (ETAPA 11)**: State machine assistida de expediente no Dashboard com botões direcionais (`[ Iniciar ]`, `[ Pausa lanche ]`, `[ Pausa almoço ]`, `[ Retomar ]`, `[ Registrar saída ]`) e modelo explícito `WorkBreak` para semanticamente diferenciar lanche (`SNACK`) e almoço (`LUNCH`) sem gerar dupla subtração de tempo.
- **Perfil & Planejamento Semanal (ETAPA 11)**: Rota `/perfil` para personalização de dados pessoais, horário planejado de início/fim (`AppTimePicker`), durações de pausas e cálculo derivado automático de jornada líquida backend-side.
- **Isolamento Multi-Usuário (ETAPA 11)**: Todos os serviços, relatórios, históricos, banco de horas e ausências são isolados estritamente por `userId` autenticado.
- **Registro de Ponto Diário**: Registros de entrada (`CLOCK_IN`) e saída (`CLOCK_OUT`) com suporte a múltiplos intervalos.
- **Histórico Mensal & Detalhamento**: Calendário mensal com indicadores visuais e listagem de pausas reais do dia.
- **Banco de Horas**: Apuração com saldo inicial configurável, saldo consolidado, saldo provisório de hoje e saldo ao vivo.
- **Ajustes Manuais & Auditoria**: Correção atômica preservando o histórico anterior via soft delete (`deletedAt`) e auditoria (`WorkDayAdjustment`).
- **Ausências, Feriados e Justificativas**: Cadastro de ocorrências (`HOLIDAY`, `VACATION`, `MEDICAL_LEAVE`, etc.) que abonam a jornada esperada sem destruir o snapshot original.
- **Relatórios & Exportação**: Relatórios consolidados por período personalizável com exportação CSV e visualização de impressão/PDF.

---

## 3. Stack Tecnológica

### Frontend
- **React 18** + **TypeScript**
- **Vite** (Build tool e Dev Server)
- **Tailwind CSS v4** (Estilização responsiva)
- **React Router DOM v7** (Roteamento SPA)
- **Axios** (`withCredentials: true`)
- **Lucide React** (Ícones SVG — Zero emojis na interface)

### Backend
- **Node.js** (v18+) + **TypeScript**
- **Express** + **Cookie Parser**
- **JSON Web Tokens (JWT)** + **bcryptjs**
- **Zod** (Validação estrita de schemas)
- **Prisma ORM v6** (Interface com banco de dados)
- **Vitest** (Suíte de testes automatizados unitários e de integração)

### Banco de Dados
- **PostgreSQL 16** (Persistência relacional)

---

## 4. Pré-requisitos

- **Node.js**: Versão 18.0.0 ou superior.
- **npm**: Versão 9.0.0 ou superior.
- **PostgreSQL**: Versão 14 ou superior.

---

## 5. Variáveis de Ambiente

### Backend (`backend/.env`)
```env
PORT=3333
FRONTEND_URL=http://localhost:5173
DATABASE_URL="postgresql://USUARIO:SENHA@localhost:5432/horacerta?schema=public"
APP_TIMEZONE=America/Sao_Paulo
DEFAULT_USER_EMAIL=usuario@horacerta.local
AUTH_SECRET=segredo_super_seguro_da_aplicacao_horacerta_jwt
```

### Frontend (`frontend/.env`)
```env
VITE_API_URL=http://localhost:3333
VITE_APP_TIMEZONE=America/Sao_Paulo
```

---

## 6. Como Iniciar o Sistema

### 1. Iniciar o PostgreSQL (Windows)
```powershell
Get-Service -Name "postgresql-x64-16"
```

### 2. Backend (Terminal 1)
```bash
cd backend
npm run dev
```

### 3. Frontend (Terminal 2)
```bash
cd frontend
npm run dev
```

Acesse a aplicação em `http://localhost:5173`.
