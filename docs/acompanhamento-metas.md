# HoraCerta — Acompanhamento de Metas de Compensação
## Arquitetura, Regras de Evolução, Isolamento e Previsão Desacoplada (ETAPA 12.5.1)

Este documento descreve a arquitetura, as fórmulas de apuração de progresso, a persistência local isolada por usuário, o desacoplamento de previsão dinâmica e os princípios de não destrutividade do módulo de **Acompanhamento de Metas de Compensação** do **HoraCerta**, implementado e homologado na **ETAPA 12.5.1**.

---

## 1. Objetivo Funcional

O módulo de Acompanhamento de Metas evolui o Planejamento de Compensação da etapa 12.4, permitindo que o colaborador transforme um cenário simulado em uma **meta ativa de acompanhamento**.

### Características Principais:
1. **Caráter Estritamente Informativo**: A funcionalidade de metas não realiza escritas no banco de dados principal, não cria registros de ponto fictícios, créditos, débitos ou transações oficiais.
2. **Saldo Oficial como Fonte da Verdade**: A apuração do progresso consome exclusivamente o saldo consolidado oficial emitido pelo backend (`data.summary.liveBalanceMinutes`). O frontend nunca recalcula ou altera os saldos oficiais.
3. **Persistência Local Explícita por Usuário**: A meta é salva no armazenamento local (`localStorage`) apenas após ação explícita do usuário no botão *"Salvar como meta ativa"*.
4. **Isolamento Imediato entre Contas**: O hook `useBankHoursGoal` valida o identificador do usuário (`userId`) de forma síncrona durante a própria fase de renderização. Durante a transição de contas ou no logout, nenhuma meta do usuário anterior é exposta nem avaliada com o saldo do novo usuário.
5. **Previsão Dinâmica Desacoplada do Simulador**: A meta salva possui seu próprio ciclo de busca de calendário e cálculo de projeção diária, vinculado estritamente ao prazo salvo (`goal.targetDateStr`). Alterações temporárias de prazo ou meta no formulário de simulação não afetam a projeção da meta salva.
6. **Acompanhamento Reativo e Dinâmico**: Alterações no saldo oficial decorrentes de novos pontos, recálculos ou sincronizações atualizam a barra de progresso, os minutos restantes e a previsão diária em tempo real sem necessitar de recarregamento.

---

## 2. Modelo de Dados da Meta

A estrutura `SavedBankHoursGoal` registra o ponto de partida e os parâmetros da meta:

```typescript
export interface SavedBankHoursGoal {
  id: string;                    // Identificador único da meta
  userId: string;                // ID da conta autenticada
  title?: string;                // Nome amigável opcional
  targetBalanceMinutes: number;  // Saldo objetivo em minutos inteiros
  targetDateStr: string;         // Data civil limite (YYYY-MM-DD)
  dailyAdditionMinutes?: number; // Minutos diários no Modo B
  mode: SimulationMode;          // 'TARGET_DATE' | 'DAILY_ADDITION'
  baselineBalanceMinutes: number;// Saldo oficial no momento da criação
  createdAtStr: string;          // Data civil de criação (YYYY-MM-DD)
  createdAtTimestamp: number;    // Timestamp numérico de criação
}
```

---

## 3. Fórmulas de Apuração e Regras de Progresso

A apuração do progresso é calculada em minutos inteiros a partir de três referências:
- `B` = `baselineBalanceMinutes` (saldo oficial no momento da criação da meta)
- `T` = `targetBalanceMinutes` (saldo objetivo)
- `C` = `currentBalanceMinutes` (saldo oficial consolidado atual)

### 3.1. Diferença Total e Evolução Líquida

```
totalSpan = targetBalanceMinutes - baselineBalanceMinutes
netEvolution = currentBalanceMinutes - baselineBalanceMinutes
remainingMinutes = Math.max(0, targetBalanceMinutes - currentBalanceMinutes)
```

> **Nota:** A evolução líquida representa estritamente o deslocamento do saldo oficial em direção ao objetivo. Não é denominada "horas trabalhadas", pois ajustes retroativos e movimentações externas podem alterar o saldo consolidado.

### 3.2. Estados da Meta (`GoalStatus`)

| Status | Condição | Progresso (%) | Descrição Visual |
| :--- | :--- | :--- | :--- |
| `COMPLETED` | `C >= T` | `100%` | Meta alcançada com badge verde e mensagem de congratulação. Previsão futura suprimida. |
| `IN_PROGRESS` | `B < C < T` e `today <= deadline` | `Math.round((netEvolution / totalSpan) * 100)` | Em andamento com evolução líquida positiva. |
| `NOT_STARTED` | `C === B` e `today <= deadline` | `0%` | Saldo atual idêntico ao saldo inicial da meta. |
| `REGRESSED` | `C < B` e `today <= deadline` | `0%` | Saldo oficial recuou em relação ao baseline (aumento de déficit). |
| `EXPIRED` | `today > deadline` e `C < T` | `Math.min(99, ...)` | Prazo limite civil encerrou sem atingimento integral. Previsão futura suprimida. |

### 3.3. Prevenção de Divisão por Zero

Se o usuário salvar uma meta onde o saldo inicial já é igual à meta (`totalSpan === 0`):
- Se `currentBalanceMinutes >= targetBalanceMinutes`: classificada como `COMPLETED` com progresso de `100%`.
- Caso contrário: classificada como `REGRESSED` com progresso de `0%`.
- Em nenhum cenário ocorrem divisões por zero ou valores `NaN`.

---

## 4. Previsão Dinâmica Desacoplada e Resiliência de Calendário

### 4.1. Independência do Simulador Temporário

Na concepção anterior, a meta salva reaproveitava o resultado da simulação temporária em tela. Se o colaborador alterasse o formulário de simulação (ex.: data final para `2026-11-30` ou meta de saldo para `+03:00`), a meta salva (com prazo para `2026-12-20`) sofria alteração indevida de previsão.

**Solução Homologada:**
- O hook `useBankHoursGoal` gerencia sua própria busca de calendário (`fetchGoalCalendar`), vinculada exclusivamente à data da meta salva (`activeGoal.targetDateStr`).
- O forecast da meta salva é gerado pela função pura `calculateRemainingGoalForecast`, recalculando os dias elegíveis e o acréscimo diário sugerido para a meta salva sem qualquer dependência do hook `useBankHoursPlanning`.
- Quando o saldo oficial do colaborador muda (ex.: de `-240` para `-180` minutos), a previsão da meta salva recalcula dinamicamente o esforço diário restante para a data da meta.

### 4.2. Tratamento de Falhas e Indisponibilidade de Calendário

Se a consulta de escala de trabalho ou feriados falhar (ex.: instabilidade de rede):
- O **progresso da meta permanece visível** normalmente, pois depende apenas do saldo oficial já consolidado.
- A previsão diária exibe um **aviso discreto** informando que a projeção está temporariamente indisponível.
- **Nenhum dia de trabalho ou minuto fictício é inventado.**
- É fornecido um botão *"Tentar novamente"*, permitindo recarregar o calendário assim que o serviço se restabelecer.

### 4.3. Regras para Metas Concluídas e Expiradas

- **Metas Concluídas (`COMPLETED`):** A busca de calendário futuro é desativada, a mensagem de congratulação é apresentada e qualquer estimativa futura de compensação diária é suprimida.
- **Metas Vencidas (`EXPIRED`):** O aviso de encerramento do prazo é exibido, suprimindo o cálculo de esforço diário futuro (pois a data já expirou).

---

## 5. Isolamento Imediato e Síncrono entre Contas

A alternância entre perfis de colaboradores ou o encerramento de sessão (logout) exige proteção total contra vazamento de informações:

```typescript
// useBankHoursGoal.ts - Sincronização imediata durante a renderização
const [userGoalState, setUserGoalState] = useState<{
  userId: string;
  goal: SavedBankHoursGoal | null;
}>(() => ({
  userId,
  goal: userId ? getActiveGoal(userId) : null,
}));

if (userGoalState.userId !== userId) {
  const immediateGoal = userId ? getActiveGoal(userId) : null;
  setUserGoalState({ userId, goal: immediateGoal });
}

const activeGoal = useMemo(() => {
  if (!userId || !userGoalState.goal) return null;
  if (userGoalState.userId !== userId || userGoalState.goal.userId !== userId) {
    return null;
  }
  return userGoalState.goal;
}, [userId, userGoalState]);
```

Esta abordagem garante:
1. **Sem Flashes Visuais Intermediários:** Mesmo antes da execução de `useEffect`, o estado é corrigido síncronamente durante a renderização.
2. **Sem Vazamento de Saldo Cruzado:** O saldo do Usuário B nunca é processado com a meta do Usuário A.
3. **Logout Seguro:** No momento em que `userId` passa a ser vazio (`""`), `activeGoal`, `progress` e `forecast` retornam imediatamente `null`.

---

## 6. Limitações e Escopo Deliberado

1. **Escopo Local de Dispositivo:** A meta ativa é armazenada localmente no navegador atual do usuário. Não há sincronização entre múltiplos computadores ou dispositivos móveis nesta subetapa (conforme especificação da ETAPA 12.5.1, sem criação de migrations no backend).
2. **Caráter Não Jurídico:** A distribuição do tempo restante não aplica limites celetistas específicos de horas extras (como máximo de 2h/dia).
3. **Não Destrutividade:** A meta não altera o saldo oficial nem o banco de horas real do colaborador.

---

## 7. Homologação e Cobertura de Testes

O módulo de planejamento e metas conta com **55 testes automatizados aprovados**:
- **`goal-calculator.test.ts` (8 testes):**
  - Status `NOT_STARTED` com saldo idêntico ao baseline.
  - Progresso proporcional `IN_PROGRESS` (50%, 80%).
  - Status `COMPLETED` ao atingir ou ultrapassar a meta (100%).
  - Status `REGRESSED` quando o saldo piora.
  - Status `EXPIRED` ao ultrapassar a data limite.
  - Prevenção de divisão por zero com baseline igual à meta.
  - Metas com superávit positivo.
  - Recálculo dinâmico da previsão utilizando o calendário real.
- **`goal-storage.test.ts` (6 testes):**
  - Disponibilidade de armazenamento local.
  - Salvamento e recuperação com fidelidade.
  - Isolamento estrito entre usuários (Usuário B não vê Usuário A).
  - Descarte seguro de JSON corrompido sem exceções.
  - Sanitização de datas inexistentes (`2026-02-30`), floats e modos inválidos.
  - Exclusão voluntária com limpeza de storage.
- **`bank-hours-goal.test.tsx` (7 testes):**
  - **Cenário 1:** Previsão da meta salva desacoplada da simulação temporária (mantém cálculo intacto ao alterar formulário temporário e recalcula dinamicamente quando o saldo oficial muda).
  - **Cenário 2:** Isolamento imediato e síncrono entre usuários (via hook `useBankHoursGoal` e verificação visual no card sem flashes nem vazamentos).
  - **Cenário 3:** Resiliência contra indisponibilidade de calendário com aviso discreto, sem dados fictícios e recuperação via retry.
  - **Cenário 4:** Supressão de compensação futura em metas concluídas (`COMPLETED`) e vencidas (`EXPIRED`).
  - **Cenário 5:** Comprovação estrita com spies no Axios `api` de ZERO chamadas de mutação HTTP (POST, PUT, PATCH, DELETE).
- **Suítes Preexistentes Preservadas:**
  - `compensation-calculator.test.ts` (17 testes aprovados).
  - `bank-hours-planning.test.tsx` (17 testes aprovados).
