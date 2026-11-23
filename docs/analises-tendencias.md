# Análises e Tendências de Jornada — Documentação Técnica da Etapa 12.5.3

## 1. Visão Geral e Objetivo

A funcionalidade de **Análises e Tendências de Jornada** (`/analises`) provê ao usuário do HoraCerta uma visão consolidada, analítica e visual do seu histórico de trabalho e banco de horas ao longo do tempo.

O módulo atende aos seguintes requisitos centrais:
- **Natureza estritamente analítica e de leitura**: Não realiza créditos, débitos, mutações de lançamentos ou cálculos paralelos que divirjam das regras oficiais da aplicação.
- **Integração total ao ecossistema existente**: Reutiliza integralmente as rotas oficiais do backend (`workDayService.getMonthlyWorkDays` e `bankHoursService.getBankHours`).
- **Respeito ao Design System e Acessibilidade**: Interface fluida, responsiva, com suporte ao tema escuro através de variáveis CSS `--hc-*`, contraste auditado e tabelas acessíveis alternativas para tecnologias assistivas.

---

## 2. Rota e Navegação

- **Rota registrada**: `/analises` no React Router (`frontend/src/routes/index.tsx`), protegida por autenticação (`requireAuth`).
- **Entrada na navegação principal**: Item "Análises" posicionado no menu superior do `AppLayout.tsx` (`to="/analises"`), acompanhado pelo ícone representativo `TrendingUp`.
- **Componente de página principal**: `frontend/src/pages/AnalyticsPage.tsx`.
- **Componentes especializados**: Organizados na pasta `frontend/src/features/work-analytics/components/`.

---

## 3. Fontes de Dados Oficiais e Regras de Integridade

A funcionalidade consome exclusivamente endpoints oficiais existentes:

1. **`workDayService.getMonthlyWorkDays(month: string)`**
   - Retorna a lista de dias do mês civil (`MonthlyDaySummary[]`) com `expectedMinutes`, `totalWorkedMinutes`, status do dia e registros.
   - **Regra de Não Duplicação**: O backend já inclui os minutos de sessões abertas/ativas em andamento dentro de `totalWorkedMinutes`. O frontend analítico consome `totalWorkedMinutes` diretamente, nunca somando `currentSessionMinutes` novamente.
   - **Proteção contra Falta Fictícia em Dias Futuros**: Para dias civis posteriores à data corrente (`date > todayStr`), `expectedMinutes` não é somado como déficit de jornada esperada. A jornada esperada computada no painel considera estritamente os dias úteis até a data atual.
   - **Validação Estrita de Calendário Civil**: O cliente valida formato `YYYY-MM-DD`, existência real no calendário civil via `isValidCivilDate` (rejeitando datas como `2026-11-31`), confirma a competência solicitada, descarta entradas inválidas, deduplica registros e verifica a presença de todos os dias civis esperados no mês para sinalizar competências parciais.

2. **`bankHoursService.getBankHours()`**
   - Retorna o status oficial do Banco de Horas (`BankHoursResponse`), incluindo:
     - `configured`: booleano indicando se o banco foi ativado e configurado pelo usuário.
     - `config`: data inicial de vigência (`startDate`) e saldo inicial pactuado (`initialBalanceMinutes`).
     - `monthly`: lista de resumos mensais oficiais com `creditMinutes`, `debitMinutes` e `netMinutes`.
   - **Garantia de Continuidade Cronológica e Lacunas**:
     O backend `BankHoursService` itera dia a dia desde `config.startDate` até a data atual, gerando estatísticas para cada competência. Para assegurar integridade contra respostas truncadas ou paginadas, o cliente exige continuidade cronológica estrita a partir de `startDate`. Havendo qualquer competência ausente (lacuna desconhecida), o saldo acumulado de fechamento das competências posteriores não é presumido (`closingBalanceMinutes: null`), diferenciando expressamente movimento comprovadamente zero de dados indisponíveis.

---

## 4. Indicadores e Fórmulas de Agregação

O motor de cálculo puro (`frontend/src/features/work-analytics/analytics-calculator.ts`) realiza agregações determinísticas sem efeitos colaterais:

### 4.1 Cards Resumidos do Período
1. **Horas Trabalhadas**:
   Soma de `totalWorkedMinutes` de todos os dias filtrados no intervalo selecionado:
   `totalWorkedMinutes = sum(day.totalWorkedMinutes)`
2. **Horas Previstas**:
   Soma de `expectedMinutes` de todos os dias filtrados elegíveis (excluindo dias futuros):
   `totalExpectedMinutes = sum(day.expectedMinutes)` (para `date <= todayStr`)
3. **Diferença Líquida**:
   `netDifferenceMinutes = totalWorkedMinutes - totalExpectedMinutes`
4. **Média por Dia**:
   Média aritmética baseada nos dias com apontamento efetivo:
   `averageWorkedMinutesPerRecordedDay = round(totalWorkedMinutes / recordedDaysCount)`
   (onde `recordedDaysCount` é a quantidade de dias no período em que `totalWorkedMinutes > 0`)
5. **Variação Oficial do Banco de Horas**:
   - Para intervalos que compreendem **meses civis inteiros**: Soma do saldo líquido oficial (`netMinutes`) dos meses contidos no período que possuem vigência configurada, desde que não haja competências omitidas no período.
   - Para intervalos personalizados de **fração de mês** (ex: 10/11 a 15/11): Exibe `—` acompanhado da indicação "Apenas competência integral", pois o Banco de Horas oficial é apurado por competência mensal fechada e o sistema nunca fabrica valores proporcionais nem substitui o extrato por soma de saldos diários.
   - Quando a consulta à API falhar: Exibe "Indisponível (erro na consulta)", sem rotular falsamente como "Não configurado".
   - Quando o banco estiver de fato não configurado (`configured: false`): Exibe "Não configurado".
6. **Sinalização de Cobertura Parcial**:
   Caso qualquer competência do período tenha falhado na consulta, retornado datas incompletas ou dias `DATA_UNAVAILABLE`, os cards identificam visualmente com a tag "Parcial" e indicam a quantidade de dias cobertos versus o total de dias civis do intervalo.

---

## 5. Gráficos Analíticos e Visualizações

### 5.1 Gráfico A — Evolução Histórica do Banco de Horas (`frontend/src/features/work-analytics/components/BankHoursEvolutionChart.tsx`)
- Plota a curva do **saldo acumulado de fechamento** oficial mês a mês:
  `saldoFechamento(m) = initialBalanceMinutes + sum(netMinutes(i))` para todas as competências `i <= m`.
- **Integridade contra Lacunas Desconhecidas**:
  Se uma competência intermediária estiver ausente no extrato, os meses posteriores não recebem fechamento acumulado presumido (`closingBalanceMinutes: null`), e a linha não conecta através da lacuna.
- **Tratamento de Mês em Andamento**:
  A competência do mês corrente é categorizada como `in_progress`, sinalizando expressamente "Em andamento (saldo provisório)", distinguindo-a das competências anteriores com fechamento consolidado.
- **Distinção entre Falha de API e Banco Não Configurado**:
  Se a API do banco falhar, o componente renderiza um card de erro com opção de retry. Se o banco estiver desativado nas preferências do usuário, renderiza as instruções para configuração inicial.
- **Tabela Acessível**: Oferece sumário numérico expandível com competência, status, fechamento acumulado, variação líquida, créditos e débitos para tecnologias assistivas.

### 5.2 Gráfico B — Horas Previstas versus Horas Trabalhadas (`frontend/src/features/work-analytics/components/PlannedVsWorkedChart.tsx`)
- Gráfico de barras agrupadas comparando, para cada mês civil do período:
  - Barra lilás/indigo: **Horas Previstas** (`totalExpectedMinutes`).
  - Barra verde/âmbar: **Horas Trabalhadas** (`totalWorkedMinutes`).
- **Tratamento de Barras com Valor Zero**:
  Valores zerados (00h00) possuem altura visual estritamente 0% (sem altura mínima enganosa), mantendo o texto legível `00h00` no tooltip e `0h` no eixo. Valores positivos muito pequenos mantêm visualização calibrada (mínimo de 4% de altura).
- **Tratamento de Competências Indisponíveis**:
  Meses cuja consulta falhou não são renderizados com barras zeradas de "0h trabalhadas". São exibidos como slots pontilhados com o rótulo "Indisponível", evitando passar ausência de conexão como ausência de trabalho.
- Exibe métrica direta de saldo positivo ou negativo abaixo das barras e tabela acessível detalhada por competência.

### 5.3 Gráfico C — Distribuição dos Saldos Diários (`frontend/src/features/work-analytics/components/DailyBalanceDistributionChart.tsx`)
- Barra de progresso proporcional segmentada e partição matemática exata dos dias civis do intervalo:
  1. **Saldo Positivo**: Dias apurados com horas trabalhadas acima do previsto (`balanceMinutes > 0`).
  2. **Saldo Equilibrado**: Dias com cumprimento exato da jornada (`balanceMinutes === 0`) comprovados por apontamento efetivo (`RECORDED`, `EXCUSED` abonado ou ajuste manual). Dias sem expediente ou folgas nunca são classificados como equilibrados.
  3. **Saldo Negativo**: Dias apurados com horas trabalhadas abaixo do previsto (`balanceMinutes < 0`).
  4. **Sem Apuração / Não Aplicável**: Folgas de fim de semana sem expediente, folgas da escala sem registros (`NO_RECORDS` com jornada 0), dias com saldo nulo, datas futuras e dias com expediente em andamento (`IN_PROGRESS`).
  5. **Dados Indisponíveis**: Datas não fornecidas pelo servidor no intervalo civil ou explicitamente marcadas com `DATA_UNAVAILABLE` (não classificadas como folga ou falta).
- **Invariante de Partição Estrita**:
  `positivos + negativos + equilibrados + semApuração + indisponíveis === totalDiasCivis`
  Onde `totalDiasCivis` é calculado rigorosamente a partir de `range.startDate` e `range.endDate` via `getCivilDaysCount`.
- **Denominadores Estatísticos**:
  Os percentuais de positivo, equilibrado e negativo têm como base exclusivamente os **dias efetivamente apurados** (`totalAccountedDays = positivos + negativos + equilibrados`).

### 5.4 Gráfico D — Comparativo Mensal Consolidado (`frontend/src/features/work-analytics/components/MonthlyComparisonChart.tsx`)
- Cards de resumo individualizados para cada mês do intervalo:
  - Identificação da competência e status ("Em andamento" para o mês corrente, "Concluído" para meses passados, "Indisponível" para falhas).
  - Horas trabalhadas, horas previstas e diferença líquida.
  - Variação do banco de horas no mês: para filtros parciais que cobrem apenas fração da competência, o campo exibe `—` e a orientação "Disponível apenas para competência integral".
  - Alerta sutil quando a competência apresentar dias não fornecidos pelo servidor.

---

## 6. Filtros de Período e Validação de 12 Competências

O componente `AnalyticsPeriodFilter.tsx` oferece navegação rápida e flexível:
1. **Mês atual**: Intervalo do primeiro dia do mês corrente até o último dia do mês corrente.
2. **Últimos 3 meses**: Competência de 2 meses anteriores até o mês corrente.
3. **Últimos 6 meses**: Competência de 5 meses anteriores até o mês corrente.
4. **Personalizado**: Permite ao usuário escolher livremente `data inicial` e `data final`.
   - **Validação de datas civis**: Verifica formato válido `YYYY-MM-DD` e dias reais no mês (incluindo anos bissextos).
   - **Validação de ordem cronológica**: Impede aplicação de intervalos onde a data final é anterior à data inicial.
   - **Limite estrito de 12 competências**: Valida que a quantidade de competências mensais cobertas (`getMonthsBetween`) não ultrapassa 12. O intervalo de 01/01/2026 a 01/01/2027 abrange 13 meses e é expressamente rejeitado, mesmo tendo 365 dias.

---

## 7. Concorrência, Resiliência e Isolamento de Usuários

1. **Controle de Concorrência (`requestIdRef`)**:
   Implementado em `useWorkAnalytics.ts` via contador monotonicamente crescente (`requestIdRef.current`). Respostas defasadas decorrentes de trocas rápidas de filtro são sumariamente descartadas.

2. **Resiliência a Falhas Parciais e Retry com Dados Anteriores**:
   As requisições mensais são disparadas em paralelo via `Promise.allSettled`.
   - Se **todos os meses** falharem em uma carga inicial: A tela renderiza o componente `OfflineError` com botão de recuperação ("Tentar novamente").
   - Se a **atualização (refresh)** de dados já carregados falhar: Os dados anteriores permanecem visíveis na tela, acompanhados de um banner de alerta (`role="alert"`) informando a falha de atualização com botão "Tentar novamente".
   - Se **apenas um mês** falhar ou apresentar dados parciais: A aplicação renderiza normalmente os meses obtidos com sucesso e apresenta um banner informativo não bloqueante com ícone `AlertCircle`.

3. **Isolamento Estrito entre Usuários**:
   O hook sincroniza a identidade ativa via `useAuth()`. Ao trocar de conta ou efetuar logout, o estado analítico anterior é resetado imediatamente de forma síncrona.

4. **Zero Mutações**:
   Todas as operações do módulo realizam estritamente leitura (`GET`). Nenhuma requisição `POST`, `PUT`, `PATCH` ou `DELETE` é disparada pela funcionalidade.

---

## 8. Testes e Garantia de Qualidade

A funcionalidade conta com suíte completa de testes automatizados executada no ambiente Happy DOM (`@vitest-environment happy-dom`):
- **`analytics-calculator.test.ts`**:
  - Validações de limites de datas, anos bissextos e 12 competências.
  - Distinção entre meses ausentes, vazios e parciais.
  - Continuidade do saldo de fechamento do Banco de Horas: meses consecutivos, mês intermediário omitido (gap desconhecido), mês com movimentação comprovadamente zero e período pré-vigência.
  - Banco de horas em intervalos mensais integrais vs. frações de mês no comparativo e no sumário.
  - Invariante de partição estrita dos saldos diários com total civil real e datas ausentes/não fornecidas.
  - Agregação master com valores numéricos reais.
- **`work-analytics.test.tsx`**:
  - Renderização completa de cabeçalho, filtros, cards e os 4 blocos de gráficos.
  - Assertivas numéricas exatas de horas trabalhadas, previstas, diferença e média diária.
  - Ausência de duplicação da sessão atual.
  - Validação de datas inválidas (ex: 2026-11-31), duplicadas e meses parciais.
  - Apresentação de barras zeradas com altura 0% sem barras mínimas enganosas.
  - Curva oficial de fechamento mensal com valores numéricos reais (+3h 00min, +2h 30min, +4h 00min).
  - Distinção de API de banco indisponível vs. banco não configurado.
  - Fluxo de sucesso -> refresh com falha (dados anteriores preservados) -> retry bem-sucedido.
  - Isolamento de usuários e limpeza síncrona no logout.
  - Verificação de zero mutações HTTP (`post`, `put`, `patch`, `delete`).
