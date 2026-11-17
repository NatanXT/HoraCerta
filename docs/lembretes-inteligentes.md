# HoraCerta — Lembretes Inteligentes de Jornada
## Guia Operacional e Manual de Arquitetura (ETAPAS 12.1, 12.1.1 e 12.1.2)

Este documento descreve a arquitetura, as diretrizes de funcionamento, as políticas de deduplicação, a estabilização do ciclo de vida React e a sincronização multiabas do sistema de **Lembretes Inteligentes de Jornada** do **HoraCerta**.

---

## 1. Visão Geral e Princípios de Design

O sistema de lembretes foi concebido para auxiliar o colaborador a manter suas marcações de ponto em dia sem gerar ruído desnecessário ou comprometer a integridade dos dados históricos.

### Pilares Fundamentais:
1. **Dados 100% Reais**: Os horários e previsões derivam estritamente da jornada cadastrada no perfil (`WorkSchedule`) e dos registros de ponto reais do dia (`TimeEntry` e `WorkBreak`).
2. **Não Invasivo e Opcional**: Por padrão, os lembretes vêm **desativados**. O usuário tem controle granular sobre quais tipos de aviso deseja receber e qual a antecedência desejada.
3. **Imutabilidade Operacional**: Os lembretes **NUNCA** registram ponto automaticamente, não fecham sessões, não realizam lançamentos no banco de horas e não alteram nenhuma marcação existente.
4. **Respeito ao Design System**: Integração completa com os tokens CSS `--hc-*`, compatibilidade com modo Claro/Escuro (Light/Dark) e temas RGB customizados.
5. **Privacidade e Segurança**: Nenhuma informação confidencial, credencial ou token de autenticação é exposto nas mensagens ou armazenado em locais inseguros.
6. **Ciclo de Vida React Estabilizado**: Efeitos desacoplados por responsabilidade, evitando loops infinitos de renderização ou reconsultas contínuas ao perfil do usuário.
7. **Sincronização Multiabas sem Eco Circular**: Transmissões de alteração de jornada distinguem a origem (`local` vs `remote`), impedindo que abas secundárias retransmitam mensagens recebidas.

---

## 2. Tipos de Lembretes Implementados

| Tipo | Descrição | Configuração Padrão | Regra de Disparo |
| :--- | :--- | :---: | :--- |
| **Entrada (`ENTRY`)** | Aviso prévio ao início planejado da jornada | 10 min antes (opções: 0, 5, 10, 15, 30 min) | Dispara apenas se o dia possuir expediente previsto, não for feriado/ausência e ainda não houver nenhum registro de `CLOCK_IN`. |
| **Retorno do Intervalo (`BREAK_RETURN`)** | Aviso prévio ao término planejado do almoço ou lanche | 5 min antes (opções: 0, 5, 10, 15, 30 min) | Dispara durante uma pausa ativa (`ON_LUNCH_BREAK` ou `ON_SNACK_BREAK`), baseando-se no horário de início real e na duração esperada. Cancelado automaticamente se o usuário retornar antes. |
| **Saída Prevista (`EXIT`)** | Aviso prévio ao término calculado da jornada diária | 10 min antes (opções: 0, 5, 10, 15, 30 min) | Calculado em tempo real com base no tempo total trabalhado e na carga horária esperada do dia. Se a jornada for encerrada, o lembrete é suprimido. |
| **Jornada Prolongada (`OVERTIME`)** | Alerta preventivo caso o expediente permaneça aberto | Tolerância de 60 min (opções: 30, 60, 90 min) | Dispara se a jornada continuar aberta após a tolerância configurada além do horário previsto de saída. Padrão desativado. |

### Distinção entre Horário do Evento e Horário do Aviso
Cada lembrete programado (`ScheduledReminder`) mantém dois campos horários essenciais:
- `targetTimeFormatted`: O horário nominal do evento de trabalho (ex: término da jornada às `17:50`).
- `triggerTimeFormatted`: O horário em que o aviso será disparado na tela considerando a antecedência configurada (ex: disparo às `17:40` com antecedência de 10 min).

O badge na barra superior e nos cartões (`NextReminderBadge`) apresenta ao colaborador ambos os dados para máxima clareza: *"Saída prevista às 17:50 (aviso às 17:40)"*.

---

## 3. Como Ativar e Configurar

1. Acesse o HoraCerta e clique no menu do usuário no canto superior direito.
2. Selecione **Lembretes** (ou acesse a URL [`/perfil?aba=lembretes`](file:///c:/Users/FabSoft07/Documents/GitHub/APP/HoraCerta/frontend/src/pages/ProfilePage.tsx)).
3. Ative o controle principal: **"Ativar lembretes de jornada"**.
4. Ajuste individualmente os tipos de lembrete e suas respectivas antecedências.
5. Se desejar receber alertas enquanto utiliza outros aplicativos ou abas, autorize a notificação no navegador e ative o botão de alternância **"Exibir notificações nativas do navegador"**.
6. Clique em **"Salvar preferências"**.
7. Utilize o botão **"Testar lembrete demonstrativo"** para conferir a apresentação visual em sua tela.

### Teste Demonstrativo vs Notificação Programada Real
- **Botão "Testar lembrete demonstrativo"**:
  - Ação manual para validação visual e verificação da Notifications API.
  - **Local à aba ativa**: É emitido exclusivamente na aba onde o usuário clicou. **NÃO** é retransmitido pelo `BroadcastChannel` para outras abas.
  - **Não modifica o banco de dados**: Não efetua marcações de ponto, não cria pausas e não altera o histórico do colaborador.
- **Notificação Programada Real**:
  - Disparada automaticamente pelo motor de avaliação com base na jornada configurada e no relógio real.
  - Coordenada entre abas abertas e deduplicada via storage local e Web Locks.

---

## 4. Deduplicação, Concorrência e Multiabas (ETAPA 12.1.2)

### Identificador Estável por Evento
Cada lembrete possui uma chave determinística única no formato `${userId}_${dateStr}_${type}_${targetTime}_${leadMinutes}`, permanecendo idêntico em ticks sucessivos do relógio para o mesmo expediente.

### Prevenção de Loop de Eco no `SCHEDULE_UPDATED`
- Ao atualizar a jornada no Perfil, a aba de origem chama `refreshSchedule(newDays, { broadcast: true })` e transmite `SCHEDULE_UPDATED` com `source: 'local'`.
- As abas secundárias recebem a mensagem, marcam `source: 'remote'`, atualizam seus horários e chamam `refreshSchedule(undefined, { broadcast: false })`.
- **Ausência de Reemissão**: Abas que receberam o evento remoto **não retransmitem** a mensagem, eliminando por completo o risco de ciclos infinitos de sincronização.

### Concorrência e Web Locks API
- Em navegadores modernos com suporte à Web Locks API (`navigator.locks.request`), o disparo concorre por uma trava atômica não-bloqueante (`ifAvailable: true`).
- Apenas a primeira aba adquire o lock para exibir o toast e gravar o despacho; as abas concorrentes ignoram o aviso de forma transparente.
- **Tratamento de Exceções**: Se a API Web Locks falhar ou lançar exceção, o código garante que o manipulador de entrega nunca será chamado uma segunda vez em bloco `catch`.
- **Limitação sem Web Locks**: Em navegadores legados sem suporte a Web Locks API, a deduplicação multiabas recorre ao `localStorage` e evento `storage`. Caso duas abas avaliem exatamente no mesmo milissegundo, existe a possibilidade técnica de disparo em ambas as abas antes da propagação do evento de storage.

### Ciclo de Vida da Sessão (`sessionGenerationRef`)
- Ao realizar logout ou trocar de usuário, o contexto incrementa `sessionGenerationRef.current` e reseta os estados de avaliação em andamento (`isEvaluatingRef` e `pendingEvaluationRef`).
- Qualquer promessa assíncrona pendente iniciada sob a sessão anterior detecta a mudança de geração e aborta sua execução, impedindo contaminação de estado entre contas ou bloqueio indevido de novas avaliações.

---

## 5. Notificações Internas vs Notificações Nativas do Navegador

- **Notificações Internas (Toasts)**:
  - Renderizadas diretamente dentro da interface do HoraCerta através de um portal flutuante não-bloqueante (`z-[60]`).
  - Totalmente responsivo para dispositivos móveis (`bottom-4 left-4 right-4 sm:left-auto sm:right-5 sm:bottom-5 sm:max-w-sm`), evitando sobreposição com elementos de navegação móvel.
  - Respeito à preferência de acessibilidade do usuário (`prefers-reduced-motion`), desativando transições bruscas de animação.
  - Funcionam incondicionalmente em qualquer navegador compatível, sem requerer permissões adicionais.
- **Notificações Nativas (Web Notifications API)**:
  - Utilizadas para alertar o usuário quando a aba do HoraCerta estiver minimizada ou em segundo plano.
  - Separação rigorosa entre a permissão concedida pelo navegador (`Notification.permission === 'granted'`) e o desejo explícito do usuário (`browserNotificationsEnabled`). Se o navegador concedeu permissão mas o usuário desativou o toggle, nenhuma notificação nativa é disparada.
  - Autorização solicitada exclusivamente por ação explícita de clique do usuário.
  - Degradação graciosa em ambientes sem suporte ou com permissão negada (`denied`), mantendo 100% da integridade da aplicação através dos toasts internos.

---

## 6. Acessibilidade e Resiliência de Armazenamento

- **Acessibilidade Semântica**:
  - Quando os lembretes estão globalmente desativados, todos os controles aninhados são envolvidos em um elemento semântico `<fieldset disabled={!form.enabled}>`. Isso garante que a navegação por teclado (`Tab`) e leitores de tela compreendam que os campos estão desabilitados, superando limitações visuais de classes de opacidade.
  - Badges de próximo lembrete possuem `role="region"`, `tabIndex={0}` e anel de foco visível (`focus-visible:ring-2`), permitindo que usuários que navegam exclusivamente por teclado inspecionem as previsões de jornada.
- **Resiliência a Quotas e Janelas Privadas**:
  - A persistência em `localStorage` é encapsulada em verificações defensivas (`isLocalStorageAvailable`). Caso o usuário esteja em navegação anônima com restrição severa de quota ou armazenamento desabilitado, um alerta amigável orienta o colaborador sobre a retenção temporária apenas na sessão ativa, sem causar falhas de script.

---

## 7. Limitações Técnicas e Escopo

- **Navegador Fechado**: A execução atual utiliza temporizadores em tempo de execução no cliente Web. Lembretes não são disparados se todas as abas do HoraCerta estiverem encerradas ou a máquina desligada.
- **Persistência Local por Usuário**: As preferências de lembrete residem em armazenamento isolado por ID de usuário no cliente, garantindo que o esquema do banco de dados relacional e backups permaneçam inalterados.
- **Evolução Futura**: O disparo com a aplicação completamente fechada, agendamento em segundo plano por Service Workers e Push Notifications remotas fazem parte do roteiro de etapas posteriores de PWA.

---

## 8. Refinamentos Finais de Estabilidade (ETAPAS 12.2, 12.2.1 e 12.2.2)

Durante as ETAPAS 12.2 e 12.2.1, foram solucionados riscos funcionais residuais identificados na revisão técnica do `RemindersContext`:

### A. Desacoplamento da Permissão do Navegador (`browserPermissionRef`)
- **Problema Anterior**: Mudanças no estado de permissão do navegador (`Notification.permission`) causavam re-execução desnecessária do efeito principal de inicialização de sessão, resetando temporizadores e coordenadores de abas.
- **Solução Implementada**: A permissão do navegador foi desacoplada em `browserPermissionRef.current`, removendo-a das dependências do hook de ciclo de vida (`[user?.id]`). O coordenador de abas e a sessão agora são recriados exclusivamente quando há troca ou logout do usuário autenticado.

### B. Invalidação de Requisições Assíncronas em Voo via Versionamento Único (`settingsVersionRef`)
- **Problema Anterior**: Se o usuário alterasse os minutos de antecedência ou desativasse o controle principal enquanto uma chamada assíncrona a `getToday()` estivesse em trânsito pela rede, a conclusão da chamada poderia sobrescrever o novo estado. Além disso, um `useEffect` secundário incrementava novamente a versão, descartando a própria avaliação recém-iniciada pelo salvamento.
- **Solução Implementada**: Foi consolidado o contador incremental `settingsVersionRef.current`. Sempre que o usuário salva novas preferências em `handleSaveSettings`:
  1. `settingsVersionRef.current` é incrementado uma única vez.
  2. `settingsRef.current` é sincronizado imediatamente.
  3. O estado `nextReminder` é imediatamente limpo caso `enabled === false`.
  4. O `useEffect([settings])` apenas mantém `settingsRef.current` sincronizado, sem incrementar novamente o contador de versão.
  5. Ao resolver a Promise de `getToday()`, o contexto valida se `settingsVersionRef.current === evaluationSettingsVersion && settingsRef.current.enabled`. A avaliação solicitada pelo próprio salvamento é aplicada com sucesso, descartando apenas avaliações de versões anteriores.


