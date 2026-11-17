# HoraCerta — Planejamento Inteligente do Banco de Horas
## Arquitetura, Regras de Negócio e Simulação Informativa (ETAPAS 12.4, 12.4.1 e 12.4.2)

Este documento descreve a arquitetura, as fórmulas de cálculo, a integração de calendário e os princípios de não destrutividade do **Planejamento de Compensação do Banco de Horas** do **HoraCerta**, implementado na **ETAPA 12.4**, validado na **ETAPA 12.4.1** e consolidado na **ETAPA 12.4.2**.

---

## 1. Objetivo Funcional

O módulo de Planejamento de Compensação permite ao usuário consultar seu saldo oficial de banco de horas em tempo real, estabelecer metas de saldo desejadas e simular prazos e acréscimos diários de jornada necessários para alcançar tais metas.

### Características Principais:
1. **Caráter Estritamente Informativo**: Trata-se de uma ferramenta de projeção. Ela **nunca** cria registros de ponto, créditos, débitos, ajustes manuais ou transações oficiais no banco de dados.
2. **Separação Visual**: O saldo oficial da apuração é apresentado de forma visualmente destacada e apartada do saldo simulado.
3. **Cálculo Baseado em Calendário Real**: A projeção não assume trabalho cego em fins de semana, feriados ou ausências; ela consome as regras reais do perfil de trabalho do usuário, feriados nacionais/municipais sincronizados e ocorrências aprovadas (como férias e atestados).
4. **Sem Jornada Fictícia**: Caso a configuração de expediente não esteja disponível, o sistema não inventa jornadas (como 8h seg-sex); em vez disso, suspende a projeção e orienta o usuário a configurar seu perfil.
5. **Dois Modos Interativos**:
   - **Modo A ("Meta até uma data")**: O usuário informa a meta desejada e o prazo limite; o sistema calcula o acréscimo diário em minutos por dia útil.
   - **Modo B ("Acréscimo fixo por dia")**: O usuário define quanto tempo adicional pode compensar por dia trabalhado (ex: 30m, 45m, 60m); o sistema calcula o saldo projetado ao fim do período e a data estimada em que a meta poderá ser atingida.

---

## 2. Fonte Canônica do Saldo Oficial

No HoraCerta, a fonte de verdade para o banco de horas é o serviço backend `BankHoursService.getBankHoursStatus(userId)`:
- `config.initialBalanceMinutes`: Saldo inicial definido na data de início da apuração.
- `historicalBalanceSum`: Somatório dos saldos diários (`totalWorkedMinutes - expectedMinutes`) de todos os dias fechados até ontem (`consolidatedBalanceMinutes = initialBalanceMinutes + historicalBalanceSum`).
- `todayBalanceMinutes`: Saldo apurado em tempo real no dia de hoje (caso haja jornada em andamento ou registros hoje).
- `summary.liveBalanceMinutes`: **Saldo oficial consolidado + movimento ao vivo de hoje**.

> **Nota**: O saldo semanal do Dashboard (`weeklySummary`) é restrito aos 7 dias da semana corrente (segunda a domingo) e não inclui o histórico acumulado nem o saldo inicial da apuração. O Planejamento de Compensação consome exclusivamente `data.summary.liveBalanceMinutes` da apuração canônica do banco de horas.

---

## 3. Fórmulas de Simulação e Distribuição

Todos os cálculos internos são executados utilizando **minutos inteiros**, evitando imprecisões de ponto flutuante ou parsing de strings no motor de cálculo.

### 3.1. Diferença Necessária para a Meta

```
deltaMinutos = targetBalanceMinutes - currentBalanceMinutes
```

- Se `deltaMinutos <= 0`:
  - A meta já foi atingida pelo saldo atual (`isTargetAchieved = true`).
  - Minutos a compensar: `0`.
  - Acréscimo diário sugerido: `0 min/dia`.
- Se `deltaMinutos > 0`:
  - Existe necessidade de geração de crédito adicional (para zerar saldo negativo ou atingir superávit).
  - Minutos a compensar: `deltaMinutos`.

### 3.2. Avaliação do Intervalo de Calendário

Para cada dia civil `d` no intervalo de amanhã até a data limite selecionada (`targetDateStr`):
1. **Verificação de Expediente (`WorkSchedule`)**:
   - Se a jornada prevista para o dia da semana for `0`, o dia é classificado como `SCHEDULE_OFF` (folga semanal ou dia sem expediente) e desconsiderado.
2. **Verificação de Feriados (`Holiday`)**:
   - Se a data coincidir com um feriado cadastrado, o dia é classificado como `HOLIDAY` e desconsiderado.
3. **Verificação de Ausências (`CalendarOccurrence`)**:
   - Se a data estiver compreendida em um período de afastamento que desobrigue o trabalho (`VACATION`, `MEDICAL_LEAVE`, `JUSTIFIED_ABSENCE`, `EXCEPTIONAL_DAY_OFF`, `BANK_HOURS_LEAVE`), o dia é classificado como `OCCURRENCE` e desconsiderado.
4. **Dia Elegível**:
   - Caso nenhuma das condições acima ocorra, o dia é classificado como `ELIGIBLE` e adicionado à contagem de dias elegíveis (`eligibleDaysCount`).

### 3.3. Modo A: Cálculo do Acréscimo Diário Sugerido

```
dailyMinutes = Math.ceil(deltaMinutos / eligibleDaysCount)
```

- O arredondamento por teto (`Math.ceil`) assegura que o cumprimento do tempo adicional inteiro por dia garantirá o atingimento integral ou ligeiro superávit da meta.
- Se `eligibleDaysCount = 0`: a divisão por zero é prevenida (`dailyMinutes = 0`) e a interface exibe alerta explicativo.
- **Saldo Projetado**:
```
projectedBalance = currentBalanceMinutes + (dailyMinutes * eligibleDaysCount)
```

### 3.4. Modo B: Projeção com Acréscimo Fixo

- O usuário define `dailyAdditionMinutes >= 1` (com limite superior da interface de 480 min).
- **Crédito Total Gerado**:
```
totalCompensated = dailyAdditionMinutes * eligibleDaysCount
```
- **Saldo Projetado**:
```
projectedBalance = currentBalanceMinutes + totalCompensated
```
- **Data de Alcance da Meta**:
  - O motor percorre a lista cronológica de dias elegíveis acumulando o saldo dia a dia.
  - A primeira data elegível em que `accumulatedBalance >= targetBalanceMinutes` é reportada como a data estimada de conclusão da meta.

---

## 4. Regras do Calendário, Tolerância a Falhas e Isolamento

1. **Dependência Rigorosa de Dados Completos**:
   - Falhas HTTP nas fontes obrigatórias (expediente, feriados ou ausências) **não** são convertidas silenciosamente em listas vazias.
   - O sistema transiciona para o estado de erro (`calendarStatus: 'error'`), oculta projeções fictícias e exibe um botão de ação **"Tentar novamente"** (`retry`).
   - Respostas válidas vazias (ex: mês sem feriados ou sem ausências) são aceitas e processadas normalmente.
2. **Estabilidade e Desacoplamento da Atualização de Saldo Oficial (ETAPA 12.4.2)**:
   - A atualização do saldo oficial do usuário ativo (`currentBalanceMinutes`) é estritamente desacoplada da inicialização de sessão do usuário.
   - Quando o saldo oficial se altera (por sincronização, recálculo ou registro de ponto), as customizações do usuário (meta digitada, prazo limite selecionado, modo ativo e acréscimo diário) são integralmente preservadas.
   - O estado do calendário permanece `ready` sem piscar tela de loading e sem disparar requisições de rede adicionais; a simulação recalcula imediatamente de forma reativa.
3. **Validação Rigorosa do Contrato Canônico de Expediente (7 Dias) (ETAPA 12.4.2)**:
   - O sistema exige que a configuração de jornada de trabalho contenha todos os 7 dias canônicos da semana (`MONDAY` a `SUNDAY`), sem ausência de dias e sem duplicidades.
   - A carga horária prevista (`expectedMinutes`) deve ser um número inteiro finito e não negativo (`>= 0`).
   - Expedientes incompletos (ex: 6 dias) ou malformados suspendem o cálculo com mensagem de erro explícita, impedindo categoricamente que dias faltantes sejam convertidos falsamente em dias de folga.
   - Uma semana com 7 dias de 0 min é contratualmente aceita como válida (todos folga, resultando em 0 dias elegíveis).
4. **Validação de Datas Civis Reais (ETAPA 12.4.2)**:
   - O motor valida a existência real de datas civis no formato `YYYY-MM-DD` através de teste de ida e volta UTC Date (`isValidCivilDate`).
   - Datas inexistentes no calendário (como `2026-02-30`, `2026-11-31` e bissextos inválidos como `2025-02-29`) ou strings corrompidas são rejeitadas com erro de validação específico (`dateRangeError`), sem disparar exceções não tratadas no runtime.
5. **Isolamento de Contas e Concorrência**:
   - Todos os dados consultados são vinculados estritamente ao `userId` e ao prazo selecionado.
   - Na troca de usuário ou logout, todos os dados de calendário e projeções em memória são imediatamente expurgados.
   - Respostas atrasadas de requisições anteriores são descartadas via sequencial de controle (`requestSeqRef`).
   - Demonstrou-se em teste de concorrência que uma resposta lenta de um usuário com 5 dias úteis/semana chegando após a conclusão da consulta de um usuário com 2 dias úteis/semana é sumariamente descartada, preservando a contagem de dias elegíveis da conta ativa.
6. **Validação Estrita de Entradas**:
   - **Meta de Saldo**: Validada em formato `HH:MM`. Valores inválidos bloqueiam a projeção imediatamente e exibem mensagem de alerta, sem usar valores antigos em cache.
   - **Data Limite**: O motor rejeita datas iguais ou anteriores à data atual e prazos superiores a 365 dias.
   - **Acréscimo Diário**: Valores `<= 0`, `NaN` ou `> 480 min` são rejeitados pelo motor.
7. **Linguagem Não Determinística**:
   - As previsões adotam tom condicional e honesto (ex: *"Você poderá atingir a meta em DD/MM/AAAA, considerando o expediente projetado"*), sem promessas fictícias como "saldo garantido".

---

## 5. Arquitetura Modular e Arquivos Envolvidos

```
frontend/src/features/bank-hours-planning/
  types.ts                         # Tipos TypeScript, estados de calendário e erros de validação
  compensation-calculator.ts       # Motor puro, validação civil de datas e validação canônica de 7 dias
  compensation-calculator.test.ts  # 17 testes unitários de regras, limites, datas civis e contratos
  useBankHoursPlanning.ts          # Hook com isolamento de usuário, retry, desacoplamento de saldo e estabilidade
  BankHoursPlanningCard.tsx        # Componente visual com estados de loading, erro e validações
  bank-hours-planning.test.tsx     # 17 testes de integração, concorrência, estabilidade de saldo e zero mutações
  index.ts                         # Barrel export

frontend/src/pages/
  BankHoursPage.tsx                # Integração do card na página oficial de Banco de Horas
  AbsencesPage.test.tsx            # Teste de integração do ciclo dirty com reversão completa de datas
```

---

## 6. Limitações e Escopo Deliberado

1. **Simulação Não Jurídica**: O motor de simulação distribui o tempo adicional linearmente entre os dias elegíveis. Ele não aplica regras específicas de convenção coletiva, como limites máximos de 2 horas extras diárias por CLT, multiplicadores de 50%/100% ou prazos legais de prescrição de banco de horas (por não estarem formalizados no schema da aplicação).
2. **Presunção de Frequência**: A projeção assume que o colaborador trabalhará normalmente nos dias elegíveis calculados. Não há garantia de que faltas ou imprevistos não ocorrerão no futuro.
3. **Horizonte de Projeção**: O prazo máximo de projeção permitido é de 365 dias (1 ano) a partir da data atual, prevenindo iterações infinitas de calendário.

---

## 7. Homologação e Cobertura de Testes

- **Testes Unitários do Motor (`compensation-calculator.test.ts`) — 17 testes**:
  - Saldo negativo com recuperação para meta zero.
  - Saldo positivo com aumento de meta.
  - Meta já atingida.
  - Intervalo sem dias elegíveis (prevenção de divisão por zero).
  - Exclusão de feriados nacionais/locais.
  - Exclusão de férias e ausências cadastradas.
  - Expedientes com trabalho no sábado.
  - Distribuição com teto fracionado (`Math.ceil`).
  - Modo B com identificação da data exata de alcance da meta.
  - Virada de ano e feriado de Confraternização Universal.
  - Bloqueio quando a jornada de trabalho estiver ausente ou incompleta.
  - Rejeição de meta de saldo nula ou NaN.
  - Rejeição de data igual a hoje, no passado ou acima de 365 dias.
  - Modo B com validação de limites de acréscimo diário (0, negativo, NaN, >480m).
  - Validação de datas civis reais e rejeição de datas inexistentes (`2026-02-30`, `2026-11-31`, texto inválido).
  - Validação rigorosa do contrato canônico de expediente semanal (7 dias obrigatórios, detecção de duplicidades, inteiros `>= 0` e suporte a 7 dias off).
- **Testes de Integração da Interface (`bank-hours-planning.test.tsx`) — 17 testes**:
  - Renderização de títulos e saldo oficial.
  - Destaque condicional de débito e crédito.
  - Exibição de estado de loading enquanto o calendário carrega (bloqueia números prévios).
  - Falha de settings, feriados e ausências gerando estado de erro sem projeção falsa.
  - Aceitação de respostas válidas com listas vazias.
  - Ação funcional de retry recuperando a projeção.
  - Bloqueio de projeção com meta inválida e recuperação após correção.
  - Alternância entre Modo A e Modo B com atalhos (+15m, +30m, +45m, +60m).
  - Isolamento entre contas e descarte de resposta atrasada na troca de usuário (Usuário A 5 dias vs Usuário B 2 dias).
  - Limpeza de dados ao deslogar (logout).
  - Comprovação com spies reais no Axios `api` de ZERO chamadas de escrita (POST, PUT, PATCH, DELETE).
  - Atualização de saldo oficial em tempo real preserva meta, prazo e simulação sem piscar loading nem refazer queries.
  - Transição de saldo negativo para positivo preserva customizações e atualiza simulação.
  - Expediente semanal incompleto (ex: 6 dias) exibe erro explicativo e suspende cálculo.
  - Logout durante consulta pendente é tratado com segurança sem exceções.
- **Teste de Integração de Formulários (`AbsencesPage.test.tsx`) — 1 teste completo**:
  - Comprovação do ciclo de vida dirty de ausências: abertura sem alteração (`dirty=false`), alteração de tipo (`dirty=true`), reversão de tipo (`dirty=false`), alteração de data inicial (`dirty=true`), reversão da data inicial (`dirty=false`), alteração de título (`dirty=true`), reversão de título (`dirty=false`), alteração de observações (`dirty=true`), reversão de observações (`dirty=false`), e fechamento do modal (`dirty=false`).
