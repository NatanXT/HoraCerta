# HoraCerta — Calendário Inteligente de Jornada
## Arquitetura, Indicadores Coexistentes, Detalhamento, Segurança e Concorrência (ETAPA 12.5.2)

Este documento descreve a arquitetura, o modelo de múltiplos indicadores coexistentes, o fluxo de dados em lote, o detalhamento diário, as garantias de acessibilidade e as regras de segurança e concorrência do **Calendário Inteligente de Jornada** do **HoraCerta**, consolidado e congelado tecnicamente na **ETAPA 12.5.2**.

---

## 1. Objetivo Funcional

O Calendário Inteligente de Jornada consolida a área de Histórico (`/history`) em um centro de consulta visual, rápido e contextual, permitindo acompanhar em perspectiva mensal:
- Registros de ponto e sessões de trabalho concluídas ou em andamento.
- Saldos diários oficiais consolidados emitidos pelo backend.
- Feriados nacionais, estaduais e municipais.
- Férias regulamentares e afastamentos cadastrados.
- Folgas de escala / descanso semanal remunerado.
- Detalhamento contextual de batidas, pausas e apontamentos manuais.
- Alternância instantânea entre visão em **Calendário** e visão em **Lista**.

---

## 2. Localização e Navegação

1. **Acesso Principal:** Integrado à rota canônica de histórico (`/history` — menu lateral *Histórico*).
2. **Alternância Calendário / Lista:**
   - O cabeçalho do mês apresenta o seletor de modo (`radio group`), permitindo alternar entre o **Calendário Mensal** e a **Visualização em Lista** sem perda de contexto ou recarregamento de rede.
   - Ambas as visualizações compartilham o mesmo estado de mês, dados carregados e seleção de dia.
3. **Controles de Navegação Mensal:**
   - Botão **Mês anterior** (`<ChevronLeft>`): decrementa o mês civil com transição de ano segura (ex.: Jan/2027 para Dez/2026).
   - Botão **Próximo mês** (`<ChevronRight>`): avança o mês civil (ex.: Dez/2026 para Jan/2027).
   - Botão **Hoje**: salta imediatamente para o mês atual configurado no sistema e seleciona a data civil de hoje.
   - **Semana Iniciando na Segunda-feira:** Convenção padrão do sistema (`Seg, Ter, Qua, Qui, Sex, Sáb, Dom`), com cálculo preciso de *lead-in* e *lead-out slots*.
   - **Tratamento de Anos Bissextos:** Fevereiro com 29 dias em anos bissextos (ex.: 2024, 2028) e 28 dias nos anos regulares.

---

## 3. Fontes de Dados, Desacoplamento de Rede e Zero Mutações

### 3.1. Endpoint Mensal Consolidado (Sem N+1)
O calendário consome exclusivamente `/api/work-days/monthly?month=YYYY-MM`, trazendo em uma **única requisição** todos os dias do mês com horários trabalhados, saldos oficiais, feriados e ausências.

### 3.2. Contrato Real do Backend
O serviço `workDayService.getMonthlySummary` do backend itera rigidamente de `1` até `daysInMonth`, garantindo que todas as datas civis do mês solicitado sejam emitidas no array `days`. O backend calcula e apura oficialmente os saldos (`balanceMinutes`), as jornadas previstas (`expectedMinutes`), as pausas e as ocorrências.

### 3.3. Desacoplamento entre Seleção de Dias e Requisições
- A função de busca mensal `fetchMonthly` no hook `useSmartCalendar` depende exclusivamente do identificador de usuário (`currentUserId`) e da string de data atual (`todayStr`).
- A seleção de dia (`selectedDayDate`) é mantida via referência (`selectedDayDateRef`) e desacoplada do gatilho de busca.
- Selecionar qualquer dia na grade (ex.: dias 5, 10, 20) ou alternar entre visão de Calendário e Lista dispara **ZERO requisições de rede adicionais**.

### 3.4. Auditoria do syncHolidays e Garantia de Zero Mutações
- **Auditoria do Método:** A auditoria técnica do método `holidayService.syncHolidays(year)` comprovou que ele invoca `POST /api/holidays/sync`, executando operações de persistência e *upsert* no banco de dados via Prisma.
- **Decisão e Justificativa de Segurança:** Em conformidade com o princípio de que consultas e navegação de calendário devem ser estritamente *read-only*, qualquer chamada automática a `syncHolidays` foi **completamente removida** do fluxo de navegação do calendário.
- **Reutilização dos Feriados Existentes:** O endpoint `/api/work-days/monthly` já inclui os feriados cadastrados para todos os dias do mês consultado, garantindo exibição completa sem disparar nenhuma mutação (`POST`, `PUT`, `PATCH`, `DELETE`) no banco de dados.

### 3.5. Associação Estrita dos Dados ao Mês Ativo e Usuário
- Para impedir o vazamento de dados de meses anteriores sob cabeçalhos novos durante o carregamento de rede, os dados de estado são encapsulados no formato `{ userId, month, data }`.
- O hook avalia sincronamente a condição:
  ```ts
  const isCurrentDataValid = Boolean(
    dataState &&
    dataState.userId === currentUserId &&
    dataState.month === selectedMonth &&
    dataState.data?.month === selectedMonth
  );
  const data = isCurrentDataValid ? dataState.data : null;
  ```
- Ao trocar de mês (ex.: de novembro para dezembro), `data` passa imediatamente para `null` no primeiro ciclo de renderização, acionando o esqueleto de carregamento (`<LoadingSkeleton />`) sem apresentar flashes dos dias do mês anterior.
- Em caso de falha de conexão inicial, o componente `<OfflineError />` é exibido imediatamente com botão de nova tentativa (`retry`), sem exibir dados do mês antigo. O botão de retry refaz estritamente a consulta para o mês que falhou.
- Respostas da API onde `res.month !== monthToFetch` são rejeitadas como inconsistentes e não poluem a interface.

---

## 4. Resolução da Grade, Integridade de Dias Ausentes e Tooltips

A função pura `buildSmartCalendarGrid` em `smart-calendar-calculator.ts` adota um algoritmo defensivo para garantir a integridade da grade visual e a fidelidade dos dados:

1. **Mapeamento Estrito 1..diasNoMês:** A grade itera de `1` até `daysInMonth` com base no calendário civil. Cada slot corresponde exatamente ao dia civil respectivo.
2. **Prevenção de Efeito Cascata por Omissão:** Se a resposta do backend omitir dias intermediários (resposta parcial), o dia faltante é preservado no slot correto. Dias posteriores jamais são deslocados para a esquerda.
3. **Classificação Fiel de Dias Ausentes (`DATA_UNAVAILABLE`):**
   - Dias omitidos na resposta da API são estritamente classificados como `status: 'DATA_UNAVAILABLE'`.
   - **Nunca** são convertidos falsamente em `NO_RECORDS` (que é reservado para dias legitimamente confirmados sem registros).
   - O indicador `isDataUnavailable: true` é atribuído ao dia.
   - O leitor de tela anuncia `"Dados indisponíveis"`.
   - Célula da grade e linha da lista exibem badge e rótulo `"Dados indisponíveis"` com estilo diferenciado e tracejado.
4. **Fonte Única de Dados para Grade e Detalhamento:**
   - O estado `selectedDay` em `useSmartCalendar` é derivado diretamente de `gridData.days`.
   - Quando o usuário clica em um dia ausente na grade ou na lista, o painel de detalhes recebe o mesmo objeto com status `DATA_UNAVAILABLE`.
   - No detalhamento:
     - As métricas (previsto, trabalhado, saldo diário, pausas) exibem travessão `—` e subtextos informando que os dados não foram fornecidos pelo servidor.
     - Um banner informativo de alerta orienta o usuário sobre a ausência temporária de registros.
     - O botão de ajuste manual permanece **desabilitado**, impedindo apontamentos sem base de escala.
5. **Comportamento do Tooltip em Dias Ausentes (`DayTooltipContent.tsx`):**
   - Para dias com `status: 'DATA_UNAVAILABLE'`, o tooltip renderiza imediatamente a data civil, a badge `"Dados indisponíveis"` e uma orientação concisa: *"Informações não fornecidas pelo servidor para esta data."*.
   - **Não renderiza** `00h00`, jornada prevista, horas trabalhadas ou saldo diário, evitando induzir o usuário a crer que a jornada prevista era zero.
6. **Alerta de Mês com Dados Parciais:**
   - Quando qualquer dia do mês apresentar `DATA_UNAVAILABLE`, o hook `useSmartCalendar` expõe um aviso em `holidayWarning`: *"Atenção: Alguns dias deste mês não foram fornecidos pelo servidor. Os demais dias apresentam os dados oficiais recebidos."*.
   - O aviso é exibido no topo da página de forma não intrusiva, preservando a visualização e os saldos dos dias recebidos normalmente.
7. **Deduplicação de Entradas:** Caso a API retorne acidentalmente múltiplos registros com a mesma data civil, apenas a primeira ocorrência é preservada, evitando duplicação de células.
8. **Descarte de Dias Fora do Mês:** Quaisquer entradas cujo prefixo de data difira de `YYYY-MM` são sumariamente descartadas.
9. **Cálculo de Lead-in e Lead-out:** O alinhamento semanal Segunda-a-Domingo insere slots vazios de preenchimento antes do primeiro dia e após o último dia para completar linhas de 7 colunas.

---

## 5. Coexistência de Múltiplos Indicadores e Classificação de Feriados

O Calendário Inteligente calcula e apresenta **indicadores independentes simultâneos** para cada dia:

| Indicador | Condição Técnica | Representação Visual | Acessibilidade (`aria-label`) |
| :--- | :--- | :--- | :--- |
| **Jornada Concluída** | `status === 'RECORDED'` ou `totalWorkedMinutes > 0 && !isOpen` | Ícone verde `CheckCircle2` + minutos trabalhados | "Jornada concluída: XXhXX trabalhados." |
| **Expediente em Andamento** | `isOpen === true` ou `status === 'IN_PROGRESS'` | Ícone verde pulsante `Clock` + minutos em apuração | "Expediente em andamento (XXhXX trabalhados)." |
| **Folga de Escala** | `status === 'REST_DAY'` ou `expectedMinutes === 0` | Célula atenuada + rótulo "Folga" | "Folga semanal." |
| **Feriado Oficial** | `day.holiday !== null` | Ícone âmbar `CalendarDays` + nome do feriado | "Feriado: [Nome do feriado]." |
| **Férias** | `day.occurrence.type === 'VACATION'` | Ícone azul `Palmtree` + rótulo "Férias" | "Férias cadastradas." |
| **Ausência / Afastamento** | `day.occurrence` com outros tipos | Ícone índigo `CalendarOff` + rótulo | "Ausência/Afastamento: [Título]." |
| **Saldo Positivo** | `balanceMinutes > 0` | Texto/pílula verde com `TrendingUp` e sinal `+` | "Saldo positivo: +XXhXX." |
| **Saldo Negativo** | `balanceMinutes < 0` | Texto/pílula âmbar/rose com `TrendingDown` e sinal `-` | "Saldo negativo: -XXhXX." |
| **Saldo Zerado** | `balanceMinutes === 0` | Texto neutro `00h00` | "Saldo zerado (00h00)." |
| **Ajuste Manual** | `hasManualAdjustments === true` ou entrada `MANUAL` | Ícone ciano `Wrench` | "Contém ajuste manual." |
| **Dia Incompleto** | `status === 'INCOMPLETE'` | Ícone âmbar `TriangleAlert` | "Jornada incompleta/pendente." |
| **Data Futura** | `date > today` ou `status === 'FUTURE'` | Célula atenuada com travessão | "Data futura." |
| **Dados Indisponíveis** | `status === 'DATA_UNAVAILABLE'` | Célula tracejada + `CircleAlert` âmbar | "Dados indisponíveis." |

### 5.1. Classificação Dinâmica de Feriados (Nacional, Estadual, Municipal)
A função `formatHolidayTypeLabel(day.holiday.type)` em `frontend/src/types/holiday.ts` normaliza dinamicamente a tipificação dos feriados para exibição no tooltip (`DayTooltipContent.tsx`) e no painel de detalhes (`SmartCalendarDayDetail.tsx`):
- `national` ou `nacional`: `"Feriado Nacional"`
- `state` ou `estadual`: `"Feriado Estadual"`
- `municipal`: `"Feriado Municipal"`
- Ausente / não informado: `"Feriado Nacional"` (padrão BrasilAPI de sincronização nacional)

---

## 6. Detalhamento Contextual do Dia e Proteção do Painel de Ajustes

Ao selecionar qualquer dia da grade ou da lista, o componente `SmartCalendarDayDetail` renderiza:
1. **Cabeçalho Contextual:** Data civil por extenso em português e conjunto de badges simultâneos.
2. **Quatro Cards de Métricas:**
   - **Jornada Prevista:** Horas pactuadas na escala (ex.: `08h00`) ou `—` se dados indisponíveis.
   - **Tempo Trabalhado:** Horas computadas no dia (ex.: `08h30`) ou `—` se dados indisponíveis.
   - **Saldo Diário Oficial:** Saldo positivo, negativo ou zerado emitido pelo backend, ou `—` se dados indisponíveis.
   - **Pausas Registradas:** Tempo total e quantidade de intervalos registrados, ou `—` se dados indisponíveis.
3. **Linha do Tempo de Pontos:** Marcações de entrada (`CLOCK_IN`) e saída (`CLOCK_OUT`) com carimbo de hora e indicação de origem (relógio ou manual).
4. **Intervalos e Pausas:** Detalhamento de refeição e descanso com horários de início e término.
5. **Feriados e Ocorrências:** Bloco informativo com tipificação oficial contextualizada.
6. **Segurança do Painel de Ajuste Manual:**
   - O acionamento do ajuste vincula o dia explicitamente ao estado `adjustingDay: MonthlyDaySummary | null`.
   - Se o usuário clicar em outra data na grade ao fundo enquanto o modal de ajuste manual estiver aberto, a data do ajuste **permanece travada** no dia original em que foi acionado, impedindo alterações acidentais de registros em datas divergentes.
7. **Proteção de Formulário Sujo no Ajuste Manual (`ManualAdjustmentPanel.tsx`):**
   - Quando o usuário preenche motivos ou altera intervalos (`isAdjustmentDirty === true`), fechar pelo botão Fechar (ícone `X`) ou Cancelar aciona confirmação via `window.confirm` para evitar descarte acidental de dados preenchidos.
   - Além disso, integra-se ao `useDirtyFormTracker` do subsistema PWA.

---

## 7. Acessibilidade da Visão em Lista e Validação de Teclado

No componente `SmartCalendarListView`:
- Cada linha de jornada é encapsulada em um elemento interativo semântico `<button type="button">`.
- Suporte nativo completo a acionamento por teclado via teclas **Enter** e **Espaço** segundo o padrão W3C WAI-ARIA.
- Propriedades de acessibilidade completas: `aria-label={day.ariaLabel}`, `aria-pressed={isSelected}` e indicador visual de foco via anel de destaque (`focus:outline-none focus:ring-2 focus:ring-[var(--hc-accent)]`).
- **Ausência de Elementos Interativos Aninhados:** Todos os elementos filhos internos (badges, resumos de batidas, indicadores de saldo) são elementos estáticos semânticos (`span`, `div`, ícones vetoriais), eliminando aninhamentos inválidos de botões ou links.
- **Diferenciação de Validação entre Happy DOM e Navegador Real:**
  - No ambiente simulado Happy DOM (Vitest), os testes automatizados (`smart-calendar.test.tsx`) validam rigorosamente a semântica de elemento (`tagName === 'BUTTON'`), atributos (`type="button"`), focabilidade (`document.activeElement`) e despacho de eventos sintéticos de teclado (`KeyDown`/`KeyUp` para Enter e Espaço).
  - A seleção por mouse é testada em caso de teste separado (`12a`), garantindo independência de asserções sem uso de hacks ou atalhos artificiais no teste de teclado (`12b`).
  - No navegador real, a especificação HTML ativa o manipulador de clique nativo do `<button>` quando o usuário pressiona as teclas Enter ou Espaço com foco no elemento.

---

## 8. Tratamento de Concorrência, Refresh e Proteção de Navegação

1. **Proteção contra Respostas Defasadas (Race Conditions):** O hook `useSmartCalendar` utiliza um ponteiro de controle `requestIdRef`. Navegações rápidas consecutivas entre meses descartam respostas assíncronas que cheguem fora de ordem.
2. **Rejeição Estrita de Respostas Inconsistentes no Refresh:**
   - O método `refresh()` valida a integridade do payload e a competência mensal recebida.
   - Caso o servidor retorne um payload malformado (ex.: ausência do array `days` ou valor nulo) ou um mês divergente do solicitado (`res.month !== selectedMonth`):
     - **Sem dados prévios válidos na tela:** define o estado de erro recuperável (`setError`), exibindo `<OfflineError />` com a mensagem descritiva e botão de nova tentativa (`retry`).
     - **Com dados prévios válidos na tela:** os dados do mês permanecem intactos na interface (`dataState` preservado) e um aviso é emitido via `holidayWarning` (*"Não foi possível atualizar os dados mais recentes. Exibindo informações salvas da consulta anterior."*), prevenindo flashes ou perda do trabalho do usuário.
3. **Tratamento de Falha no Refresh Durante Consulta Inicial Pendente:**
   - Se uma consulta inicial (`fetchMonthly`) estiver em andamento e for chamada a função `refresh()`, o identificador `requestIdRef` é incrementado, invalidando a requisição anterior.
   - Em caso de falha no refresh subsequente sem dados prévios, o estado de erro recuperável é exibido com botão de retry.
4. **Proteção contra Mudança de Mês com Formulários Sujos:**
   - Ao acionar `changeMonth` (via setas de mês anterior/próximo ou botão Hoje), o hook verifica `inFlightTracker.hasDirtyForms()`.
   - Se houver alterações não salvas em qualquer formulário ativo, o sistema exibe um diálogo de confirmação via `window.confirm`. Se o usuário cancelar, a navegação é abortada e o mês atual é preservado.
5. **Isolamento Imediato de Sessão:** Ao trocar de conta ou ao efetuar logout (`user = null`), os dados do usuário anterior são expurgados síncronamente antes da renderização seguinte, impedindo vazamento de dados entre perfis.
6. **Resiliência a Falhas:** Perdas de conexão apresentam componente de erro com botão de nova tentativa, permitindo recuperar a consulta para o mês corrente sem recarregar a aplicação.

---

## 9. Homologação e Cobertura de Testes Automatizados

A funcionalidade do Calendário Inteligente de Jornada e seus componentes correlatos contam com **45 testes automatizados dedicados**:

- **`smart-calendar-calculator.test.ts` (8 testes unitários puros):**
  1. Anos bissextos e contagem exata de dias em fevereiro (29 em 2024, 28 em 2026).
  2. Cálculo de *lead-in slots* para semana iniciando na segunda-feira.
  3. Conversão de dias da semana em português (curto e longo).
  4. Coexistência de múltiplos indicadores simultâneos e síntese de `aria-label`.
  5. Identificação de jornada em andamento (aberta).
  6. Montagem de grade completa do mês com *lead-in* e *lead-out slots*.
  7. Resposta parcial da API com dias ausentes não desloca os dias subsequentes e classifica estritamente como `DATA_UNAVAILABLE`.
  8. Deduplicação de dias repetidos e descarte de dias fora do mês consultado.

- **`DayTooltipContent.test.tsx` (8 testes de componente):**
  1. Renderização correta em dias com `DATA_UNAVAILABLE`: data civil, badge e aviso textual, sem renderizar métricas ou `00h00`.
  2. Renderização em dias sem registros (`NO_RECORDS`): data civil, badge e orientação de registro.
  3. Renderização em dias com jornada concluída (`RECORDED`): saldo positivo, jornada prevista e realizada.
  4. Renderização em dias com saldo positivo e saldo negativo.
  5. Feriado Nacional: exibe rótulo oficial "Feriado Nacional" e nome do feriado.
  6. Feriado Estadual: exibe rótulo oficial "Feriado Estadual" e nome do feriado.
  7. Feriado Municipal: exibe rótulo oficial "Feriado Municipal" e nome do feriado.
  8. Feriado sem tipo informado: adota fallback oficial "Feriado Nacional".

- **`smart-calendar.test.tsx` (29 testes de integração e isolamento de componentes):**
  1. Renderização do mês atual e navegação entre meses anterior e próximo.
  2. Botão Hoje com retorno imediato ao mês e dia atual.
  3. Manipulação de fevereiro bissexto (29 dias) e não bissexto (28 dias).
  4. Virada de ano correta (Dezembro para Janeiro e retorno).
  5. Seleção de dias (5, 10, 20) NÃO dispara novas requisições a `getMonthlyWorkDays`.
  6. Alternância entre visualização em Calendário e em Lista NÃO dispara nova requisição.
  7. Troca de mês não renderiza dados do mês anterior sob o novo cabeçalho e exibe esqueleto de carregamento sem flashes.
  8. Falha de API no novo mês exibe `OfflineError` sem dados antigos, e retry busca estritamente o mês que falhou.
  9. Resposta inconsistente da API (mês divergente do solicitado) é rejeitada e não é exibida.
  10. Callbacks atrasados de requisições de meses anteriores são descartados mesmo se chegarem após a resolução do mês atual.
  11. Chamada de refresh durante consulta mensal em andamento não deixa `loading` como `true` indefinidamente.
  12. Falha no refresh durante consulta inicial pendente define erro recuperável com opção de retry (8c).
  13. Falha no refresh após dados válidos carregados preserva os dados na tela e sinaliza alerta não intrusivo (8d).
  14. Proteção de formulários sujos ao mudar de mês com `inFlightTracker.hasDirtyForms()` (8e).
  15. Refresh com mês divergente e sem dados prévios rejeita resposta e exibe erro recuperável (8f).
  16. Refresh com mês divergente e dados anteriores válidos rejeita resposta e preserva dados com alerta (8g).
  17. Refresh com payload malformado rejeita resposta e mantém resiliência (8h).
  18. Recuperação após erro de refresh via retry() busca novamente o mês atual com sucesso (8i).
  19. Dia ausente na resposta da API é classificado como `DATA_UNAVAILABLE` e nunca como `NO_RECORDS` falso, com detalhamento seguro e métricas em travessão.
  20. Resposta com dias vazios (`days: []`) é tratada de forma coerente sem crashar a interface.
  21. Exibição de todos os indicadores simultâneos (jornada concluída, aberta, folga, feriado, férias, ausências, ajuste manual, saldo positivo/negativo).
  22. Detalhamento completo de registros, batidas, pausas, feriados e ocorrências no painel lateral.
  23. Painel de ajuste manual permanece travado na data original mesmo se a seleção de fundo for alterada.
  24. Detalhamento do dia renderiza a classificação correta de Feriado (Nacional, Estadual, Municipal) (11b).
  25. Visualização em lista: seleção por clique de mouse, atualização de `aria-pressed` e detalhamento (`12a`).
  26. Acessibilidade na visualização em lista: elemento semântico button, foco e eventos de teclado sem clique forçado (`12b`).
  27. Visão em lista não contém botões ou elementos interativos aninhados de forma inválida.
  28. Comprovação com spies no Axios `api` de **ZERO mutações** (`POST`, `PUT`, `PATCH`, `DELETE`) durante a navegação e consulta.
  29. Isolamento imediato de dados na troca de usuário e no logout.
