# HoraCerta — Progressive Web App (PWA) Instalável e Confiável
## Arquitetura, Políticas de Segurança e Guia de Homologação (ETAPAS 12.3, 12.3.1, 12.3.2 e 12.3.3)

Este documento descreve a arquitetura, as diretrizes de segurança, as políticas de cache estático, a experiência de instalação, a gestão de conectividade e o ciclo de vida de atualizações do **Progressive Web App (PWA)** do **HoraCerta**, com fechamento técnico e hotfix final concluídos na **ETAPA 12.3.3**.

---

## 1. Objetivos e Pilares da Implementação

Transformar o frontend SPA do HoraCerta em uma aplicação Web Progressiva (PWA) instalável, segura e perfeitamente integrada ao ecossistema existente de React, TypeScript, Vite e Tailwind CSS v4.

### Pilares Fundamentais:
1. **Instalabilidade Completa com Listener Único Global**:
   - Captura do evento `beforeinstallprompt` em nível global através de singleton desde a carga inicial da aplicação (evitando perda do evento caso ocorra no Login ou Dashboard antes de acessar a tela de Perfil).
   - Eliminação de listeners redundantes no `window`: as instâncias de componentes/hooks inscrevem-se exclusivamente no singleton central.
   - Suporte transparente no Windows (Chrome/Edge), Android e orientações para iOS/iPadOS, permitindo execução em janela standalone sem barras do navegador.
2. **Precache Rigorosamente Estático e Isolamento de Dados**:
   - O Cache Storage do Service Worker é restrito exclusivamente aos ativos estáticos compilados (HTML shell, CSS, JS, ícones e fontes).
   - `runtimeCaching: []` e denylist explícita `/^\/api\//`: nenhuma resposta de API, token JWT, credencial ou dado privado de jornada, ponto, banco de horas ou relatório é armazenado no Service Worker.
3. **Proteção Real de Operações de Ponto e Formulários (`inFlightTracker`)**:
   - Todas as operações de ponto (`workSessionService`, `timeEntryService.clockIn`, `timeEntryService.clockOut`, `useTodayWorkDay`) e ajustes manuais (`manualAdjustmentService`) são envolvidas por `inFlightTracker.track(...)`.
   - Enquanto qualquer mutação estiver ativa, tentativas de atualização de versão pelo Service Worker são sumariamente bloqueadas (`blocked_by_mutation`), impedindo reload durante marcação de ponto inicial ou final.
   - O hook `useDirtyFormTracker` monitora formulários reais (`ProfilePage`, `ManualAdjustmentPanel`, `AbsencesPage`). Em `AbsencesPage`, a detecção utiliza snapshot serializado completo dos campos (`tipo`, `título`, `data inicial`, `data final` e `observações`), garantindo que tanto a abertura para edição quanto o descarte/reversão reflitam com precisão o estado limpo ou sujo. Quando há alterações pendentes, o sistema exige confirmação explícita antes de recarregar a aplicação.
4. **Ciclo de Atualização com Estados Claros e Retomada Segura**:
   - O hook `usePwaUpdate` adota uma máquina de estados explícita (`idle`, `waiting_available`, `updating`, `ready_to_reload`, `blocked_by_mutation`, `error`).
   - Se o novo worker assumir o controle (`controllerchange`) durante uma operação crítica ou enquanto formulários estiverem sujos (`hasDirtyForms()`), a recarga automática é contida e o sistema entra no estado `ready_to_reload`, permitindo que o usuário recarregue sob demanda (`reloadNow()`) após o término do registro ou com confirmação explícita de descarte.
   - Recargas cegas sem worker válido foram completamente eliminadas.
5. **Comportamento Confiável de Conectividade e Saúde**:
   - O hook `useNetworkStatus` consulta a rota canônica do backend `/health`, derivando a URL de forma dinâmica a partir de `api.defaults.baseURL` ou `env.VITE_API_URL`.
   - Estados bem definidos: `serverStatus: 'checking' | 'connected' | 'disconnected'`. Não exibe falso status de conectado nem flashes indevidos de offline durante a sondagem inicial.
   - **Defesa contra Concorrência e Tratamento Estrito de Timeout**: Utilização de número de sequência de probe para ignorar requisições sobrepostas. Distinção explícita entre timeout real da requisição (que transiciona imediatamente para `disconnected` e `isServerReachable: false`) e aborts causados por unmount ou novas sondagens. Em evento `offline`, invalidação imediata do probe ativo com transição imediata para `disconnected`. Rejeição imediata de respostas HTTP 200 com `text/html`.
   - Revalidação automática em eventos de foco na janela, mudança de visibilidade (`visibilitychange`) e intervalo moderado a cada 60 segundos.
6. **Comportamento Honesto sem Conexão**:
   - O aplicativo alerta claramente quando não há conectividade com o servidor. Nenhuma operação de ponto é simulada ou gravada falsamente no cliente.

> **Importante**: O PWA instalável não permite registrar ponto offline nesta etapa. Os registros dependem do backend para garantir a integridade jurídica e a consistência das informações.

---

## 2. Arquitetura Modular PWA

A implementação PWA está contida no módulo `frontend/src/features/pwa/`, reutilizando a arquitetura React existente:

```
frontend/
  vite.config.ts                      # Configuração do VitePWA (manifest, workbox e denylist)
  index.html                          # Meta tags para mobile-web-app e apple-touch-icon
  public/
    icons/
      pwa-192x192.png                 # Ícone padrão 192x192 (PNG com magic bytes válidos)
      pwa-512x512.png                 # Ícone padrão 512x512 (PNG com magic bytes válidos)
      maskable-icon-512x512.png       # Ícone com safe-zone 512x512 para Android
      apple-touch-icon-180x180.png    # Ícone para dispositivos Apple
      favicon-32x32.png               # Favicon auxiliar
  src/
    features/
      pwa/
        types.ts                      # Tipos de instalação, eventos e atualização
        hooks/
          usePwaInstall.ts            # Gerenciamento global de beforeinstallprompt, appinstalled e standalone
          usePwaUpdate.ts             # Detecção de worker em waiting, proteção in-flight e skipWaiting
          useNetworkStatus.ts         # Monitoramento de rede, validação de JSON e probe em /health
          useDirtyFormTracker.ts      # Hook leve para registrar estado dirty de formulários
        utils/
          inFlightTracker.ts          # Rastreador de mutações ativas e proteção de formulários sujos
        components/
          PwaInstallCard.tsx          # Card de instalação integrado na tela de Perfil
          PwaUpdateBanner.tsx         # Notificação discreta de nova versão disponível com estados claros
          PwaOfflineIndicator.tsx     # Alerta superior quando não há conexão real com o backend
        pwa.test.tsx                  # 37 testes de instalação, atualização, conectividade e serviços reais
        pwa-security.test.ts          # 8 testes de conformidade de segurança e testes negativos de build
        index.ts                      # Barrel export
    layouts/
      AppLayout.tsx                   # Inclusão do indicador offline e banner de update
    pages/
      ProfilePage.tsx                 # Aba "Aplicativo" exibindo o PwaInstallCard + useDirtyFormTracker
```

---

## 3. Configuração do Web App Manifest

Gerado automaticamente pelo plugin `vite-plugin-pwa` no caminho `/manifest.webmanifest` no build de produção:

- **name**: `HoraCerta — Controle de Jornada`
- **short_name**: `HoraCerta`
- **description**: `Controle pessoal de jornada, registros de ponto e banco de horas.`
- **lang**: `pt-BR`
- **display**: `standalone`
- **orientation**: `any`
- **start_url**: `/`
- **scope**: `/`
- **id**: `/`
- **background_color**: `#020617` (fundo principal em modo escuro)
- **theme_color**: `#0f172a` (cor da barra superior e janelas)
- **icons**:
  - `192x192` PNG (`/icons/pwa-192x192.png`, `purpose: any`)
  - `512x512` PNG (`/icons/pwa-512x512.png`, `purpose: any`)
  - `512x512` PNG Maskable (`/icons/maskable-icon-512x512.png`, `purpose: maskable`, safe-zone centralizada)

---

## 4. Política de Cache do Service Worker e Segurança

### O que É armazenado no Cache Storage:
- `index.html` (shell estático da SPA).
- Arquivos JavaScript compilados com hash de conteúdo (ex: `assets/index-*.js`).
- Arquivos CSS compilados com hash de conteúdo (ex: `assets/index-*.css`).
- Ícones e imagens públicas da pasta `public/`.
- `manifest.webmanifest`.

### O que NUNCA é armazenado (Regras Absolutas de Segurança):
1. **Rotas de API (`/api/*`)**:
   - `runtimeCaching: []` (estritamente vazio). Nenhuma estratégia de cache é aplicada a requisições de API.
   - `navigateFallbackDenylist: [/^\/api\//]`: O Service Worker nunca intercepta endpoints de API para retornar `index.html`.
2. **Tokens e Credenciais**:
   - Tokens JWT, headers `Authorization` e credenciais residem apenas na memória do cliente e na camada de sessão segura. Nenhuma informação é persistida em caches do SW.
3. **Dados Pessoais e Históricos**:
   - Registros de ponto, jornadas, saldo de banco de horas, ausências e relatórios são consultados diretamente na rede.

---

## 5. Experiência de Instalação e Ciclo de Vida

O hook `usePwaInstall` unifica a detecção de plataforma e estado da aplicação:

### A. Captura Antecipada (Singleton Central)
- O evento `beforeinstallprompt` é capturado imediatamente na janela pelo módulo assim que o script é carregado, antes de qualquer navegação.
- O evento é mantido em memória e fornecido ao hook `usePwaInstall` quando o usuário navega para `/perfil?aba=aplicativo`.
- O hook não registra listeners adicionais no `window`, garantindo fonte única de verdade.
- O prompt só é executado sob clique explícito no botão **"Instalar aplicativo"**.

### B. Confirmação Real de Instalação
- Quando o usuário aceita o diálogo do navegador (`userChoice.outcome === 'accepted'`), o prompt é consumido e o botão é desativado.
- O estado de instalação definitiva `isInstalled: true` é atribuído exclusivamente quando o evento `appinstalled` é emitido pelo sistema operacional ou quando o modo `standalone` é confirmado.

### C. iPhone e iPad (iOS / iPadOS - Safari e Chrome)
- Como o iOS não possui `beforeinstallprompt` programático, o `PwaInstallCard` exibe instruções visuais claras:
  1. Toque no botão de **Compartilhar** (quadrado com seta para cima).
  2. Selecione **"Adicionar à Tela de Início"**.
  3. Confirme tocando em **"Adicionar"**.

---

## 6. Fluxo de Atualização Segura e Proteção In-Flight

1. Ao publicar uma nova versão, o Service Worker baixa o novo precache em segundo plano e permanece no estado `waiting`.
2. O hook `usePwaUpdate` detecta o worker em espera e aciona o componente `PwaUpdateBanner`.
3. Ao clicar em **"Atualizar agora"**:
   - O `inFlightTracker` verifica se há alguma operação de ponto ativa (`workSessionService`, `timeEntryService.clockIn/clockOut`, `useTodayWorkDay`, `manualAdjustmentService`). Se houver, a atualização é impedida (`blocked_by_mutation`) e o usuário é orientado a aguardar o fim da operação.
   - O `inFlightTracker` verifica se há formulários com edições pendentes (`hasDirtyForms()`). Se houver, uma confirmação explícita (`window.confirm`) é solicitada antes de prosseguir; se cancelada, a atualização é abortada.
   - Se aprovado e o worker estiver presente, envia a mensagem `{ type: 'SKIP_WAITING' }`.
   - Quando o novo worker assume o controle (`controllerchange`), o sistema avalia novamente se há mutações em curso ou formulários com edições pendentes (`hasDirtyForms()`). Caso haja qualquer um deles, o reload automático é estritamente evitado e o sistema transiciona para `ready_to_reload`, exibindo o botão **"Recarregar agora"**.
   - Ao acionar **"Recarregar agora"** (`reloadNow()`), o sistema revalida novamente mutações ativas e formulários com edições não salvas, exigindo confirmação explícita do usuário antes de invocar `window.location.reload()`.

---

## 7. Diferenças entre Modo Desenvolvimento e Modo Preview / Produção

| Característica | Modo Dev (`npm run dev`) | Modo Preview / Produção (`npm run preview` / build) |
| :--- | :--- | :--- |
| **Service Worker** | Desativado por padrão para viabilizar Vite HMR (Hot Module Replacement) instantâneo sem interferência de caches. | Ativado e registrado (`sw.js` gerado via Workbox). |
| **Manifest** | Disponível via Vite server. | Gerado fisicamente em `dist/manifest.webmanifest`. |
| **Precache** | Inativo. | Ativo: arquivos estáticos pré-cacheados com hash (`cleanupOutdatedCaches`). |
| **Testes de Conectividade** | Consulta `http://localhost:3333/health` do backend real. | Consulta `http://localhost:3333/health` do backend real. |

---

## 8. Verificação e Homologação Automatizada

Para validar o PWA completo:

1. **Build e Teste de Segurança Integrado**:
   ```bash
   npm --prefix frontend run test:pwa-build
   ```
   Compila a aplicação com `tsc` e `vite build` e executa imediatamente os 8 testes de conformidade física e integridade de artefatos.

2. **Testes Unitários e de Integração**:
   ```bash
   cd backend && npx vitest run --root .. frontend/src/
   ```

3. **Script de Homologação em Servidor de Preview**:
   ```bash
   node scripts/test-pwa-preview.mjs
   ```
   O script verifica:
   - Disponibilidade da porta 4173 e inicialização assíncrona.
   - Validade e headers do `manifest.webmanifest`.
   - Regras do Service Worker `sw.js` (`/^\/api\//` denylist e `cleanupOutdatedCaches`).
   - Assinatura binária (Magic Bytes `89 50 4E 47 0D 0A 1A 0A`) e dimensões exatas de cada ícone PNG (192x192, 512x512, 180x180).
   - Rotas de navegação SPA (`/`, `/login`, `/perfil`).
   - Comprovação da defesa contra falso 200 em rotas não mapeadas.

---

## 9. Requisitos de HTTPS e Limitações Restantes

- **Ambiente de Teste Local**: `localhost` e `127.0.0.1` são considerados contextos seguros (Secure Context) pelos navegadores, permitindo Service Worker e PWA sem certificados SSL.
- **Produção e Dispositivos Móveis na Rede Local**: Para instalar o PWA em celulares (Android/iOS) acessando a máquina de desenvolvimento via IP local (ex: `http://192.168.x.x`), os navegadores exigem HTTPS obrigatoriamente. Em produção, um certificado SSL/TLS (HTTPS) é indispensável para registro do Service Worker e exibição do prompt de instalação.
- **Funcionalidades Deliberadamente Fora de Escopo**:
  - Push Notifications remotas via servidores Web Push quando o navegador está fechado.
  - Sincronização em segundo plano (Background Sync) para registro de ponto offline.
  - Banco de dados offline completo no cliente (IndexedDB espelhando PostgreSQL).
