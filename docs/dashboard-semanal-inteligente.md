# HoraCerta — Dashboard Semanal Inteligente
## Arquitetura, Contratos de API e Guia de Funcionamento (ETAPAS 12.2, 12.2.1 e 12.2.2)

Este documento descreve a concepção, os contratos de API, os algoritmos de cálculo, a componentização visual e os mecanismos de sincronização do **Dashboard Semanal Inteligente** do **HoraCerta**.

---

## 1. Visão Geral e Princípios Fundamentais

O Dashboard Semanal Inteligente complementa a visão diária em tempo real do HoraCerta, oferecendo ao colaborador uma perspectiva consolidada do progresso da sua semana de trabalho (de **segunda-feira a domingo**).

### Pilares de Negócio:
1. **Semana Canônica (Segunda a Domingo)**: Toda semana é indexada rigidamente a partir da segunda-feira (`mondayStr`), garantindo previsibilidade e consistência visual independente do dia em que o usuário acesse o painel.
2. **Proteção Contra Falso Débito em Dias Futuros**: Dias futuros com expediente planejado **NUNCA** são computados como débito negativo no saldo da semana. O saldo semanal reflete exclusivamente dias decorridos e o dia atual com expediente iniciado.
3. **Dados 100% Reais e Reutilização de Regras Oficiais**: A resolução do estado de cada dia reutiliza a função canônica `resolveWorkDayState`, honrando feriados cadastrados, ausências justificadas (`CalendarOccurrence`), dispensas e jornadas configuradas.
4. **Atualização Dinâmica e Reativa**: A seção semanal se atualiza automaticamente sempre que o usuário registra entrada, intervalo, retorno ou encerramento no painel diário principal.
5. **Acessibilidade e Responsividade Total**: Totalmente integrado aos tokens CSS `--hc-*`, temas Claro/Escuro (Light/Dark) e RGB, adaptando-se suavemente entre telas ultra-wide, desktops (7 colunas), tablets e smartphones (cards empilhados com barras de progresso).

---

## 2. Contrato de API (Backend)

### Endpoint:
`GET /api/work-days/weekly-summary?startDate=YYYY-MM-DD`

- **Autenticação**: Requer token JWT ativo via cabeçalho `Authorization: Bearer <token>`.
- **Validação de Entrada (`getWeeklyWorkDaysSchema`)**:
  - `startDate`: String no formato `YYYY-MM-DD` (qualquer data pertencente à semana desejada ou a própria segunda-feira).

### Resposta Real Implementada (`200 OK`):
> **Nota**: O array `days` abaixo exibe 1 dia de forma ilustrativa/compacta para documentação; o endpoint real sempre retorna o conjunto completo dos **7 dias da semana** (de segunda-feira a domingo).

```json
{
  "summary": {
    "startDate": "2026-11-16",
    "endDate": "2026-11-22",
    "totalWorkedMinutes": 1440,
    "nominalExpectedMinutes": 2400,
    "plannedExpectedMinutes": 1920,
    "applicableExpectedMinutes": 1440,
    "weeklyBalanceMinutes": 0,
    "recordedDaysCount": 3,
    "plannedDaysCount": 4,
    "completedDaysCount": 3,
    "inProgressDaysCount": 0,
    "isCurrentWeek": true,
    "isPastWeek": false,
    "isFutureWeek": false
  },
  "days": [
    {
      "date": "2026-11-16",
      "weekday": "MONDAY",
      "weekdayShort": "Seg",
      "weekdayLong": "Segunda-feira",
      "status": "RECORDED",
      "statusLabel": "Jornada encerrada",
      "expectedMinutes": 480,
      "workedMinutes": 480,
      "currentSessionMinutes": 0,
      "totalWorkedMinutes": 480,
      "balanceMinutes": 0,
      "isOpen": false,
      "hasEntries": true,
      "entriesCount": 2,
      "holidayName": null,
      "occurrenceType": null,
      "occurrenceDescription": null
    }
  ],
  "contextualInsight": "Você já registrou 24h 00min nesta semana (3 de 4 dias planejados com registros)."
}
```

---

## 3. Regras de Cálculo e Algoritmos de Consolidação

### A. Resolução dos 7 Dias da Semana
O utilitário `getWeekDateRange(dateStr)` normaliza a data recebida para a segunda-feira correspondente (`startDate`) e calcula o domingo (`endDate`). O backend realiza busca em lote (`findMany`) para os 7 dias, combinando com os registros de feriados e ausências do período.

### B. Carga Nominal vs Carga Efetiva Planejada
- **Carga Nominal (`nominalExpectedMinutes`)**: Somatório da carga horária padrão cadastrada no perfil de horários do usuário para os dias da semana (`defaultExpected`), sem considerar feriados ou ocorrências.
- **Carga Efetiva Planejada (`plannedExpectedMinutes`)**: Somatório das horas efetivamente esperadas (`state.expectedMinutes`), deduzindo feriados e ausências abonadas.

### C. Cálculo de Saldo Semanal sem Penalização Futura
Para cada dia dos 7 dias da semana:
- `totalWorkedMinutes` += `state.totalWorkedMinutes`
- `plannedExpectedMinutes` += `state.expectedMinutes`
- `nominalExpectedMinutes` += `defaultExpected`
- **Carga Aplicável para Saldo (`applicableExpectedMinutes`)**:
  - Se o dia for passado (`dStr < todayStr`): `applicableExpectedMinutes += state.expectedMinutes`.
  - Se o dia for hoje (`dStr === todayStr`): contabiliza `state.expectedMinutes` apenas se houver registros ou jornada aberta.
  - Se o dia for futuro (`dStr > todayStr`): não gera débito; apenas soma se houver registros efetivos.
- **Saldo Semanal (`weeklyBalanceMinutes`)**: `totalWorkedMinutes - applicableExpectedMinutes`.

### D. Geração de Insights Contextuais Inteligentes
O backend analisa a temporalidade da semana e o progresso em tempo real, gerando mensagens contextuais factuais e sem predições artificiais:
- **Semana futura com planejamento**: *"Semana futura: carga horária planejada de Xh Ymin distribuída em N dias."*
- **Semana futura sem planejamento**: *"Semana futura sem dias de expediente planejados."*
- **Semana passada com registros**: *"Semana encerrada com Xh Ymin trabalhadas em N dias com registros (saldo apurado: +Xh Ymin / -Xh Ymin)."*
- **Semana passada sem registros**: *"Nenhum registro de ponto cadastrado nesta semana anterior."*
- **Semana atual com expediente aberto hoje**: *"Sua jornada de hoje ainda está em andamento. Você já registrou Xh Ymin nesta semana."*
- **Semana atual com meta cumprida**: *"Meta semanal concluída! Você registrou Xh Ymin de Zh Wmin planejadas."*
- **Semana atual em andamento**: *"Você já registrou Xh Ymin nesta semana (N de M dias planejados com registros)."*
- **Semana atual antes do primeiro registro**: *"Esta semana possui N dias planejados (Xh Ymin no total). Registre seu ponto ao iniciar o expediente."*
- **Semana sem expediente cadastrado**: *"Semana sem jornada de trabalho configurada no perfil."*

---

## 4. Componentes Frontend e Experiência do Usuário

A interface foi estruturada na pasta `frontend/src/components/dashboard/weekly/`:

| Componente | Responsabilidade |
| :--- | :--- |
| `WeeklySummarySection.tsx` | Contêiner mestre com cabeçalho de navegação (Semana Anterior, Semana Atual, Próxima Semana), exibição imediata do período selecionado, tratamento de loading skeleton e mensagens de erro com retry sem bloqueio indevido de botões. |
| `WeeklyMetricCards.tsx` | Grid de 4 cartões de indicadores: **Trabalhado na semana**, **Carga planejada** (com diferenciação entre nominal e efetiva), **Saldo da semana** (com legendas semânticas distintas para semana futura, atual ou encerrada) e **Dias com registros**. |
| `WeeklyInsightCard.tsx` | Banner contextual inteligente com ícone de lâmpada e mensagem analítica gerada pelo backend. |
| `WeeklyChart.tsx` | Gráfico comparativo e cartões dos 7 dias: exibe nome do dia, badge de status (`Encerrada`, `Em andamento`, `Folga planejada`, `Feriado`, `Ausência`, `Trabalho em folga`, `Dia futuro`), barra de progresso trabalhado vs previsto (sem progresso artificial de 100% em folga) e pílula de saldo diário. |

### Responsividade:
- **Desktop (>= 1024px)**: Grid horizontal completo de 7 colunas alinhadas, com barras de progresso verticais/horizontais compactas.
- **Tablet (640px - 1023px)**: Grid adaptável em 2 a 3 colunas por linha com destaque visual para o dia atual.
- **Mobile (< 640px)**: Lista empilhada de cartões verticais contendo todos os detalhes com toque confortável e leitura nítida.

---

## 5. Resiliência de Rede e Multi-usuário (`useWeeklySummary`)

O hook customizado `useWeeklySummary` implementa proteções avançadas contra condições de corrida:
1. **Identificador de Requisição (`requestIdRef`)**: Em navegações rápidas entre semanas, apenas a resposta correspondente à última requisição despachada atualiza o estado, descartando respostas lentas obsoletas.
2. **Isolamento de Contas e Período**: O retorno valida se a resposta pertence ao usuário e à semana atualmente selecionada antes de aplicar os dados no estado React.
3. **Prevenção de Requisições Duplicadas na Montagem**: Efeito de mutação monitora `prevRefreshTriggerRef` e não duplica a busca inicial da montagem.

---

## 6. Cobertura de Testes Automatizados

O sistema foi homologado com cobertura rigorosa:
- **Backend (`work-day.service.test.ts`)**: Validação de cálculo semanal de 7 dias, geração correta de limites segunda a domingo, identificação do dia atual e não penalização de dias futuros.
- **Frontend (`weekly-dashboard.test.ts` e `weekly-dashboard-real.test.tsx`)**: Cenários de testes unitários e testes reais de integração com React e `happy-dom`.

---

## 7. Limitações Técnicas e Escopo

- **Banco de Horas Geral**: O saldo apresentado no Dashboard Semanal reflete exclusivamente o período da semana selecionada (segunda a domingo). O saldo acumulado histórico de múltiplos meses e compensações retroativas permanece sob a responsabilidade do módulo de Banco de Horas (`/banco-horas`).
- **Marcação Manual**: O Dashboard Semanal é estritamente analítico e visual. Ajustes manuais de registros retroativos continuam sendo realizados através da tela de Relatórios (`/relatorios`) ou Espelho de Ponto.
