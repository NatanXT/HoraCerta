# HoraCerta — Arquitetura Técnica & Decisões de Projeto

Este documento detalha os aspectos técnicos da arquitetura do **HoraCerta**, estabelecendo os padrões de design, fluxo de dados, fórmulas de apuração e invariantes de sistema.

---

## 1. Visão Geral das Camadas

O backend é organizado no padrão em camadas com separação clara de responsabilidades:

```
HttpRequest
     │
     ▼
[Routes] ── (Roteamento Express & Injeção de Middlewares)
     │
     ▼
[Controllers] ── (Parse de Input, Validação Zod, Resposta HTTP)
     │
     ▼
[Services] ── (Regras de Negócio, Transações Prisma, Orquestração)
     │
     ├──────────► [Utils / Resolvers] ── (Cálculos puros em memória)
     │
     ▼
[Repositories] ── (Acesso a dados via Prisma ORM)
     │
     ▼
PostgreSQL Database
```

### Princípios de Camada:
- **Controllers NUNCA contêm chamadas diretas ao Prisma**.
- **Services NUNCA formatam respostas HTTP** (retornam DTOs puros ou lançam `AppError`).
- **Repositories concentram todas as queries do Prisma**, suportando injeção de transações (`Prisma.TransactionClient`).
- **Utils contêm lógica determinística pura**, testável sem dependência de banco de dados.

---

## 2. Fluxo de uma Requisição

1. **Entrada**: O cliente HTTP (Frontend Axios) envia a requisição para uma rota do Express.
2. **Validação**: O controller executa o parse dos parâmetros via Zod schema. Se falhar, lança `AppError(400)`.
3. **Execução**: O controller delega a operação para o serviço correspondente.
4. **Isolamento de Usuário**: O serviço obtém o usuário padrão (`usuario@horacerta.local`) e executa as validações de domínio.
5. **Transação**: Operações de mutação crítica (como criação de ponto, ajuste manual ou ocorrência) utilizam `prisma.$transaction`.
6. **Resposta**: O serviço retorna o DTO formatado. O controller envia HTTP 200/201/204.
7. **Tratamento de Erros**: Erros não capturados são interceptados pelo `errorHandler` middleware, retornando padronizado `{ status: "error", code: "...", message: "..." }`.

---

## 3. Principais Entidades e Relacionamentos

```mermaid
erDiagram
    User ||--o{ WorkSchedule : "possui jornadas versionadas"
    User ||--o{ WorkDay : "registra dias"
    User ||--o| BankHoursConfig : "configura apuracao"
    User ||--o{ CalendarOccurrence : "cadastra ausencias"
    WorkDay ||--o{ TimeEntry : "contem registros"
    WorkDay ||--o{ WorkDayAdjustment : "audita alteracoes"

    User {
        string id PK
        string name
        string email UK
        datetime createdAt
        datetime updatedAt
    }

    WorkSchedule {
        string id PK
        string userId FK
        enum weekday
        int expectedMinutes
        date effectiveFrom
        datetime createdAt
        datetime updatedAt
    }

    WorkDay {
        string id PK
        string userId FK
        date date UK
        string note
        int expectedMinutesSnapshot
        datetime createdAt
        datetime updatedAt
    }

    TimeEntry {
        string id PK
        string workDayId FK
        enum type
        datetime timestamp
        enum source
        datetime deletedAt
        datetime createdAt
        datetime updatedAt
    }

    WorkDayAdjustment {
        string id PK
        string workDayId FK
        string reason
        json beforeEntries
        json afterEntries
        datetime createdAt
    }

    BankHoursConfig {
        string id PK
        string userId FK UK
        date startDate
        int initialBalanceMinutes
        datetime createdAt
        datetime updatedAt
    }

    CalendarOccurrence {
        string id PK
        string userId FK
        enum type
        string title
        date startDate
        date endDate
        string note
        datetime deletedAt
        datetime createdAt
        datetime updatedAt
    }
```

---

## 4. Timezone (`America/Sao_Paulo`)

- Todas as conversões de horários locais utilizam o fuso `America/Sao_Paulo` (UTC-3 / UTC-2 em horário de verão histórico).
- O backend é o único responsável por determinar o timestamp oficial no momento do bate do ponto em tempo real (`new Date()`).
- Parâmetros e respostas contendo datas civis sem horário utilizam a notação estrita `YYYY-MM-DD`.
- Em tabelas Prisma com o atributo `@db.Date` (`WorkDay.date`, `WorkSchedule.effectiveFrom`, `BankHoursConfig.startDate`, `CalendarOccurrence.startDate`, `CalendarOccurrence.endDate`), os objetos `Date` são mantidos e convertidos em **UTC Midnight** (`00:00:00.000Z`) para evitar variações provocadas pelo fuso local do sistema operacional.

---

## 5. Jornada Versionada (`WorkSchedule`)

As jornadas de trabalho esperadas por dia da semana são versionadas por data de vigência (`effectiveFrom`).

- **Regra de Vigência**: Para determinar a jornada esperada em uma data histórica $D$, busca-se a versão do `WorkSchedule` correspondente ao dia da semana cuja `effectiveFrom` seja a mais recente $\le D$.
- **Não Destrutivo**: Alterar o horário de trabalho na tela de configurações cria uma nova versão a partir da data atual sem alterar retroativamente a jornada de dias passados.

---

## 6. Snapshot de Jornada (`expectedMinutesSnapshot`)

Quando um dia de trabalho (`WorkDay`) é instanciado no banco de dados (seja pelo bate do primeiro ponto ou por um ajuste manual histórico):

- O campo `expectedMinutesSnapshot` recebe e congela a jornada esperada vigente naquela data específica obtida do `WorkSchedule`.
- **Invariante**: O `expectedMinutesSnapshot` armazena a jornada base do calendário oficial da empresa. Ele **NUNCA** é gravado ou sobrescrito como `0` por motivo de cadastramento de feriado ou férias (`CalendarOccurrence`).

---

## 7. Fórmulas de Apuração e Prioridade de Jornada Efetiva

A resolução da jornada esperada efetiva para um determinado dia $D$ segue a ordem rigorosa de prioridade centralizada na função `resolveEffectiveExpectedMinutes`:

```
               CalendarOccurrence ativa em D?
                            │
              ┌─────────────┴─────────────┐
             SIM                         NÃO
              │                           │
              ▼                           ▼
        expected = 0         WorkDay.expectedMinutesSnapshot
                                  existe em D?
                                      │
                        ┌─────────────┴─────────────┐
                       SIM                         NÃO
                        │                           │
                        ▼                           ▼
                 snapshot retornado      WorkSchedule vigente em D
                                            retornado (ou 0)
```

### Resolução de Status do Dia (`resolveWorkDayState`):

1. **Se a data for Futura ($D > \text{hoje}$)**:
   - Status: `FUTURE`.
   - Se houver `CalendarOccurrence`, retorna o DTO da ocorrência no payload sem alterar o status para `EXCUSED`.
2. **Se a data NÃO for futura e NÃO houver registros de ponto**:
   - Com `CalendarOccurrence` ativa: Status `EXCUSED`, `expectedMinutes = 0`, `balanceMinutes = 0`, `pending = false`.
   - Com `expectedMinutes === 0` (Folga regular): Status `REST_DAY`, `balanceMinutes = 0`, `pending = false`.
   - Caso contrário: Status `NO_RECORDS`, `balanceMinutes = null`, `pending = true`.
3. **Se a data possuir registros de ponto (`hasEntries = true`)**:
   - `expectedMinutes` efetivo é resolvido por `resolveEffectiveExpectedMinutes`.
   - Se a última entrada for `CLOCK_IN`: Status `IN_PROGRESS` (se $D = \text{hoje}$) ou `INCOMPLETE` (se $D < \text{hoje}$).
   - Se a última entrada for `CLOCK_OUT`: Status `RECORDED`.
   - **Trabalho em Dia Abonado**: Se houver ocorrência e pontos fechados, $status = \text{RECORDED}$, $\text{expected} = 0$, $\text{balanceMinutes} = \text{totalWorkedMinutes} - 0 = +\text{totalWorkedMinutes}$ (geração de crédito integral).

---

## 8. Apuração de Banco de Horas (`BankHoursService`)

- **Carregamento em Lote**: A apuração do período carrega todos os `WorkDay`, `WorkSchedule` e `CalendarOccurrence` em uma única consulta otimizada no banco, resolvendo o período em memória sem padrão N+1.
- **Isolamento de Dias Excused**: Dias com status `EXCUSED` não incrementam o contador de pendências (`pendingDays`) e não geram débitos nem créditos.
- **Manutenção de Pendência Incompleta**: Se um feriado tiver um ponto aberto sem saída (`INCOMPLETE`), o dia continua constando como pendência até que a correção manual seja realizada.

---

## 9. Soft Delete e Integridade Histórica

- Registros de ponto (`TimeEntry`) e ocorrências de calendário (`CalendarOccurrence`) utilizam o padrão **Soft Delete** via campo `deletedAt DateTime?`.
- Consultas normais de apuração sempre filtram `deletedAt: null`.
- Nenhuma operação de edição ou exclusão no sistema realiza exclusão física (`DELETE FROM`) de registros históricos.

---

## 10. Auditoria de Alterações Manuais (`WorkDayAdjustment`)

Ao realizar uma correção manual em um dia histórico (`PUT /api/work-days/:date/manual-adjustment`):
1. Todos os `TimeEntry` ativos anteriores do dia recebem `deletedAt = agora`.
2. Novos registros de ponto são criados com `source = MANUAL`.
3. Uma entrada imutável de auditoria é gravada na tabela `work_day_adjustments` contendo:
   - `reason`: Motivo da correção.
   - `beforeEntries`: Snapshot JSON dos registros anteriores.
   - `afterEntries`: Snapshot JSON dos novos registros aplicados.

---

## 11. Segurança e Escopo Multi-Usuário

- Todas as chamadas em repositories filtram estritamente por `userId`.
- Operações de `PUT` e `DELETE` por ID validam obrigatoriamente a combinação de `id`, `userId` e `deletedAt: null`.
- Criação e edição de ocorrências utilizam `prisma.$transaction` com verificação prévia de sobreposição de datas para impedir race conditions de períodos conflitantes.

---

## 12. Invariantes Críticas do Sistema (NUNCA QUEBRAR)

1. **CalendarOccurrence é uma camada de apuração, NÃO uma alteração destrutiva da jornada base**.
2. **NUNCA alterar nem zerar `WorkDay.expectedMinutesSnapshot` ao cadastrar feriado ou férias**.
3. **NUNCA transformar automaticamente dias sem registro (`NO_RECORDS`) em débito no banco de horas**.
4. **Trabalho realizado em dia abonado gera crédito integral (100%)**.
5. **Pontos incompletos (`INCOMPLETE`) em dias de ocorrência continuam sendo pendências obrigatórias**.
6. **Visual de interface com ZERO emojis — utilizar estritamente ícones Lucide React**.
