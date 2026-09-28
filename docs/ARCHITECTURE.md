# HoraCerta — Arquitetura Técnica & Decisões de Projeto

Este documento detalha os aspectos técnicos da arquitetura do **HoraCerta**, estabelecendo os padrões de design, fluxo de dados, fórmulas de apuração e invariantes de sistema.

---

## 1. Visão Geral das Camadas

O backend é organizado no padrão em camadas com separação clara de responsabilidades:

```
HttpRequest
     │
     ▼
[Auth Middleware] ── (Validação de Token JWT em Cookie HTTP-only, Injeção de req.auth.userId)
     │
     ▼
[Routes] ── (Roteamento Express & Injeção de Middlewares)
     │
     ▼
[Controllers] ── (Parse de Input, Validação Zod, Resposta HTTP)
     │
     ▼
[Services] ── (Regras de Negócio, Transações Prisma, Orquestração por userId)
     │
     ├──────────► [Utils / Resolvers] ── (Cálculos puros em memória)
     │
     ▼
[Repositories] ── (Acesso a dados por userId via Prisma ORM)
     │
     ▼
PostgreSQL Database
```

### Princípios de Camada:
- **Auth Middleware (`requireAuth`)**: Intercepta rotas privadas, lê o token de cookie HTTP-only, valida assinatura JWT e popula `req.auth = { userId: string }`.
- **Controllers NUNCA contêm chamadas diretas ao Prisma**.
- **Services NUNCA dependem de `DEFAULT_USER_EMAIL`**. Todos os serviços recebem `userId` autenticado.
- **Repositories concentram todas as queries do Prisma**, filtrando obrigatoriamente por `userId`.
- **Utils contêm lógica determinística pura**, testável sem dependência de banco de dados.

---

## 2. Autenticação, Cookies e Claim de Usuário Legado (ETAPA 11)

### Token e Cookies
- **Cookies HTTP-Only**: O token JWT de sessão é transmitido exclusivamente via cookie com flags `httpOnly: true`, `sameSite: "lax"`, `secure: true` (em produção), `path: "/"`.
- **Nenhum token em localStorage / sessionStorage**.
- **`AUTH_SECRET`**: Variável de ambiente obrigatória. Se ausente, o servidor falha na inicialização.
- **CORS Estrito com Cookies**: Origem explícita definida por `FRONTEND_URL` com `credentials: true`. O backend nunca aceita `origin: true` com credenciais ativas.

### Estratégia de Claim de Usuário Legado
Para garantir que dados reais históricos criados na conta legada (`usuario@horacerta.local`) não sejam orfanados no primeiro cadastro real:
1. Ao realizar o primeiro cadastro (`POST /api/auth/register`):
   - Se existir um usuário com `email = DEFAULT_USER_EMAIL`;
   - E `passwordHash == null`;
   - E ainda não existir nenhum outro usuário cadastrado com `passwordHash` no banco;
2. O sistema executa o **CLAIM**:
   - Atualiza o **MESMO** registro `User` (`name`, `email`, `passwordHash`);
   - **PRESERVA o `User.id` exatamente igual**.
3. Todas as tabelas relacionadas (`WorkSchedule`, `WorkDay`, `TimeEntry`, `BankHoursConfig`, `CalendarOccurrence`) continuam vinculadas automaticamente ao novo login.
4. Cadastros posteriores criam novos registros `User` normalmente, com dados isolados.

---

## 3. Fluxo Assistido e Pausas (`WorkSessionService` & `WorkBreak`)

### O Modelo `WorkBreak`
Para evitar inferir almoço ou lanche apenas pelo intervalo entre batidas e manter semântica explícita:
- Modelo Prisma `WorkBreak`:
  - `type`: `SNACK` | `LUNCH`
  - `startedAt`: DateTime
  - `endedAt`: DateTime? (nulo enquanto a pausa estiver ativa)
  - `deletedAt`: DateTime? (soft delete em caso de ajuste manual)
- **TimeEntry**: Mantém a responsabilidade de registrar o tempo efetivamente trabalhado (`CLOCK_IN` / `CLOCK_OUT`).
- **Não Ha Dupla Subtração**: O motor de cálculo de horas apura o tempo trabalhado pelos intervalos `CLOCK_IN -> CLOCK_OUT`. Os `WorkBreaks` identificam semanticamente o período de pausa sem subtrair duplamente do total.

### State Machine Assistida (`WorkSessionService`)
O backend gerencia o estado da sessão do dia através de transações atômicas no banco de dados (`prisma.$transaction`):

| Estado | Condição de Entrada | Ações Permitidas | Transação Atômica ao Executar Ação |
| :--- | :--- | :--- | :--- |
| `NOT_STARTED` | Sem `TimeEntry` ativo no dia | `start` | Cria `CLOCK_IN` no momento atual. Instancia `WorkDay` com snapshot se necessário. |
| `WORKING` | Último `TimeEntry = CLOCK_IN` e sem break ativo | `pauseSnack`, `pauseLunch`, `finish` | **Pausa**: Cria `CLOCK_OUT` + cria `WorkBreak` com `startedAt = now`, `endedAt = null`.<br>**Finish**: Cria `CLOCK_OUT`. |
| `ON_SNACK_BREAK` | Último `TimeEntry = CLOCK_OUT` e `WorkBreak SNACK` ativo (`endedAt = null`) | `resume`, `finish` | **Resume**: Atualiza `WorkBreak.endedAt = now` + cria `CLOCK_IN`.<br>**Finish**: Atualiza `WorkBreak.endedAt = now` sem criar novo clock. |
| `ON_LUNCH_BREAK` | Último `TimeEntry = CLOCK_OUT` e `WorkBreak LUNCH` ativo (`endedAt = null`) | `resume`, `finish` | **Resume**: Atualiza `WorkBreak.endedAt = now` + cria `CLOCK_IN`.<br>**Finish**: Atualiza `WorkBreak.endedAt = now` sem criar novo clock. |
| `ENDED` | Último `TimeEntry = CLOCK_OUT` e sem break ativo | `start` | Inicia novo período no mesmo dia se necessário. |

Transações conflitantes ou ações inválidas retornam HTTP 409 com código de erro específico (`WORK_SESSION_ALREADY_ACTIVE`, `BREAK_ALREADY_ACTIVE`, `NO_ACTIVE_BREAK`, `INVALID_WORK_SESSION_ACTION`).

---

## 4. Perfil e Jornada Semanal Planejada

### Horário Planejado em Minutos
- `plannedStartMinutes`: Minutos a partir das 00:00 (ex: 08:00 -> 480).
- `plannedEndMinutes`: Minutos a partir das 00:00 (ex: 17:15 -> 1035).
- `snackBreakMinutes`: Minutos previstos de pausa para lanche (ex: 15).
- `lunchBreakMinutes`: Minutos previstos de pausa para almoço (ex: 60).

### Cálculo Derivado Backend-Side
Quando a jornada planejada é enviada via `PUT /api/profile/work-schedule`:
$$\text{expectedMinutes} = (\text{plannedEndMinutes} - \text{plannedStartMinutes}) - \text{snackBreakMinutes} - \text{lunchBreakMinutes}$$
O backend valida que:
- $\text{plannedStartMinutes} < \text{plannedEndMinutes}$
- $\text{snackBreakMinutes} + \text{lunchBreakMinutes} < (\text{plannedEndMinutes} - \text{plannedStartMinutes})$
- $\text{expectedMinutes} > 0$ em dias de trabalho.

Em dias de folga: `expectedMinutes = 0`, `plannedStart = null`, `plannedEnd = null`, pausas = 0.

### Versionamento por Vigência
Ao salvar uma nova jornada no perfil:
- Uma nova versão da jornada é criada no `WorkSchedule` com `effectiveFrom = hoje`.
- A jornada de dias anteriores e os snapshots `WorkDay.expectedMinutesSnapshot` existentes continuam 100% preservados.

---

## 5. Invariantes Críticas do Sistema (NUNCA QUEBRAR)

1. **A autenticação deve isolar rigorosamente dados por `userId` em todas as rotas e repositórios**.
2. **O claim do usuário legado deve alterar o mesmo registro `User`, preservando `User.id` e todas as relações existentes**.
3. **Senhas nunca são armazenadas em texto puro; tokens nunca ficam em `localStorage` ou `sessionStorage`**.
4. **CORS com cookies de credenciais NUNCA pode utilizar `origin: true`**.
5. **WorkBreaks não causam dupla subtração de horas calculadas pelos TimeEntries**.
6. **Visual de interface com ZERO emojis — utilizar estritamente ícones Lucide React**.
