# HoraCerta — Sistema de Backups Automáticos e Proteção dos Dados
## Guia Operacional e Manual de Procedimentos (ETAPA 12.0)

Este documento estabelece as diretrizes, a arquitetura e os procedimentos operacionais para a proteção integral, backup sob demanda, rotinas automatizadas e restauração do banco de dados relacional **PostgreSQL 16** do sistema **HoraCerta**.

---

## 1. Objetivo e Importância

O **HoraCerta** gerencia dados cadastrais e registros de jornada de trabalho reais, incluindo:
- Usuários e perfis de autenticação.
- Marcações de ponto (entrada, saída e pausas) com carimbos de tempo e auditoria.
- Configurações semanais de jornada versionadas.
- Apuração consolidada e histórico do Banco de Horas.
- Registros de ausências, atestados, folgas e férias.
- Feriados nacionais, estaduais e municipais.
- Preferências de aparência e tokens de segurança.

A preservação desses registros é um requisito crítico. O sistema de backups implementado na ETAPA 12.0 foi projetado sob os seguintes pilares:
1. **Resiliência e Integridade**: Backups consistentes, comprimidos e verificáveis através de catálogos nativos do PostgreSQL.
2. **Segurança e Privacidade**: Nenhuma credencial ou dado sensível é impresso em logs, consoles ou manifestos.
3. **Automação Confiável**: Execução diária via Agendador de Tarefas do Windows com proteção contra sobreposição (Mutex).
4. **Proteção Fail-Closed**: Prevenção estrita de poluição do banco pessoal por rotinas de testes automatizados.

---

## 2. Formato Técnico Escolhido (`-Fc` / Custom Format)

Todos os backups são gerados utilizando o utilitário oficial `pg_dump` da distribuição do PostgreSQL 16 com a flag `-Fc` (*Custom Format*).

### Justificativas Técnicas:
- **Catálogo de Objetos Embutido (TOC)**: O formato customizado armazena um índice estruturado de todas as tabelas, índices, sequências, restrições e blocos de dados, viabilizando inspeção e verificação imediata via `pg_restore -l` sem necessidade de restaurar o banco.
- **Compressão Interna Nativa (zlib)**: Reduz drasticamente o consumo de armazenamento em disco preservando o desempenho de I/O.
- **Flexibilidade Total na Restauração**: Permite restauração global, restauração seletiva (tabela por tabela), reorganização da ordem de carga e exclusão de itens específicos via flags do `pg_restore`.
- **Independência de Esquema e Permissões**: Parâmetros `--no-owner --no-acl` garantem que o backup possa ser restaurado em qualquer ambiente ou usuário sem colisões de privilégios.

---

## 3. Diretório Oficial de Armazenamento

Por padrão, os backups e seus artefatos são persistidos fora da pasta do repositório versionado (Git), garantindo isolamento:

```
C:\Users\<USUÁRIO>\AppData\Local\HoraCerta\Backups\
├── horacerta_YYYY-MM-DD_HHmmss.backup        # Arquivo de dump binário comprimido
├── horacerta_YYYY-MM-DD_HHmmss.manifest.json  # Manifesto estruturado com hash e metadados
└── logs\
    └── horacerta_YYYY-MM-DD_HHmmss.log       # Registro detalhado da execução
```

Variável de ambiente de referência: `$env:LOCALAPPDATA\HoraCerta\Backups`.

---

## 4. Nomenclatura e Arquitetura de Arquivos

Cada ciclo de backup gera dois arquivos complementares (*companions*) com o mesmo carimbo de data/hora:
1. `horacerta_YYYY-MM-DD_HHmmss.backup`: Arquivo binário gerado pelo `pg_dump -Fc`.
2. `horacerta_YYYY-MM-DD_HHmmss.manifest.json`: Manifesto de auditoria em formato JSON.

### Escrita Segura com Arquivo Temporário:
Durante a geração, o arquivo é gravado inicialmente com a extensão `.in-progress` (ex: `horacerta_2026-11-09_211734.in-progress`). Apenas após passar com sucesso pela verificação de catálogo (`pg_restore -l`) e cálculo de hash SHA-256 o arquivo é renomeado atomicamente para a extensão definitiva `.backup`.

---

## 5. Metadados e Manifesto de Auditoria (JSON)

Ao término da geração e validação, um manifesto JSON é gerado automaticamente ao lado do arquivo de dump:

```json
{
  "backupId": "horacerta_2026-11-09_211734",
  "createdAt": "2026-11-09T21:17:34.337-03:00",
  "database": "horacerta",
  "host": "localhost",
  "port": 5432,
  "user": "postgres",
  "format": "custom-pg_dump",
  "compression": "zlib-internal",
  "fileName": "horacerta_2026-11-09_211734.backup",
  "fileSizeBytes": 39395,
  "fileSizeFormatted": "38,47 KB",
  "sha256": "bc60d94e41178d421f92a6f84d1e6e40a6944ac954732d21602d1c63d9230f17",
  "pgDumpVersion": "pg_dump (PostgreSQL) 16.10",
  "catalogEntriesCount": 64,
  "status": "SUCCESS"
}
```

> **Aviso de Segurança**: O manifesto **NUNCA** armazena senhas, tokens de autenticação ou conteúdos de variáveis de ambiente sensíveis.

---

## 6. Execução de Backup Manual Sob Demanda

O backup pode ser acionado manualmente a qualquer momento de duas maneiras:

### Opção A — Via Scripts NPM (a partir da pasta `backend/`):
```bash
npm run backup
```

### Opção B — Diretamente via PowerShell:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/backup/backup-database.ps1
```

### Parâmetros Suportados:
- `-BackupDir <caminho>`: Especifica um diretório de destino alternativo.
- `-EnvFile <caminho>`: Especifica o caminho para o arquivo `.env` com a string `DATABASE_URL`.
- `-SkipIntegrityCheck`: Ignora a validação imediata com `pg_restore -l` (não recomendado).

---

## 7. Rotina Diária Automática (Agendador de Tarefas do Windows)

A execução diária automatizada é gerenciada pelo utilitário `scripts/backup/register-scheduled-task.ps1`.

### Características da Tarefa:
- **Nome**: `HoraCerta-Backup-Diario`
- **Horário Padrão**: 20:00 todos os dias.
- **Ação**: Invocação em segundo plano do PowerShell chamando `backup-database.ps1`.
- **Prevenção de Conflitos**: Configurada para ignorar novas instâncias caso uma execução anterior ainda esteja ativa (`IgnoreNew`).

### Comandos de Gestão do Agendamento:

#### 1. Registrar ou Atualizar a Tarefa:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/backup/register-scheduled-task.ps1
```

Para customizar o horário (ex: 22:30):
```powershell
powershell -ExecutionPolicy Bypass -File scripts/backup/register-scheduled-task.ps1 -DailyTime "22:30"
```

#### 2. Consultar o Status da Tarefa:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/backup/register-scheduled-task.ps1 -Status
```

#### 3. Testar a Execução Imediata da Tarefa Agendada:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/backup/register-scheduled-task.ps1 -RunNow
```

#### 4. Remover / Desregistrar a Tarefa:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/backup/register-scheduled-task.ps1 -Unregister
```

---

## 8. Verificação de Integridade Estrutural e Limitações do `pg_restore -l`

O script `scripts/backup/verify-backup.ps1` realiza a inspeção profunda do arquivo de backup sem alterar o banco de dados.

### As 10 Verificações Obrigatórias de Integridade:
1. **Existência Física**: Confirma a presença física do arquivo `.backup` no disco.
2. **Não Vazio**: Confirma que o tamanho do arquivo é maior que zero (> 0 bytes).
3. **Manifesto Companion**: Presença obrigatória do arquivo `.manifest.json`.
4. **Sintaxe JSON**: Validade e integridade do JSON do manifesto.
5. **Campos Obrigatórios**: Presença de `backupId`, `createdAt`, `database`, `fileName`, `fileSizeBytes`, `sha256` e `status`.
6. **Consistência de Nome**: O nome do arquivo gravado no manifesto deve coincidir com o arquivo físico.
7. **Consistência de Tamanho**: O tamanho em bytes deve ser estritamente idêntico ao do manifesto.
8. **Conferência Criptográfica**: O hash SHA-256 recalculado em tempo de execução deve coincidir exatamente com o manifesto.
9. **Catálogo Estrutural**: Execução de `pg_restore -l` lendo e interpretando a TOC (Table of Contents) interna.
10. **Código de Saída Zero**: O processo do `pg_restore` deve finalizar com ExitCode 0 sem erros.

### Limitações Técnicas do `pg_restore -l`:
> [!IMPORTANT]
> **Diferença Crítica**: `INTEGRIDADE ESTRUTURAL VALIDADA` **NÃO** equivale a `RESTAURAÇÃO COMPLETA VALIDADA`.
> O comando `pg_restore -l` valida o cabeçalho do arquivo, o fluxo de descompressão zlib e o índice TOC (Table of Contents), garantindo que o arquivo não está truncado nem corrompido fisicamente.
> No entanto, o `pg_restore -l` **NÃO** insere registros, não valida integridade referencial cruzada (foreign keys), triggers nem restrições de unicidade em nível de linha.
> A homologação de ponta a ponta da recuperação requer um teste de carga em uma **instância Docker isolada** (procedimento documentado na Seção 14).

---

## 9. Política de Retenção e Ciclo de Vida (Modo Seguro Dry-Run)

O script `scripts/backup/manage-retention.ps1` aplica uma política clássica de rotação baseada em três camadas:
- **Diários**: Preserva todos os backups dos últimos **7 dias**.
- **Semanais**: Preserva **1 backup por semana** das últimas **4 semanas** (utilizando cálculo seguro ISO 8601 para viradas de ano).
- **Mensais**: Preserva **1 backup por mês** dos últimos **6 meses**.

### Trava de Segurança Absoluta (Somente Dry-Run):
Na ETAPA 12.0.1, a exclusão física está **permanentemente desabilitada**:
- Mesmo que os parâmetros `-ApplyDelete` ou `-Force` sejam passados, o script emite aviso de segurança e atua estritamente em **modo simulação (somente leitura)**.
- O backup mais recente é protegido de forma incondicional por salvaguarda obrigatória.
- Arquivos sem manifesto ou com manifestos inválidos são preservados preventivamente.

```bash
# Simulação segura da política de retenção
npm run backup:retention
```

---

## 10. Proteção contra Concorrência (Mutex do Windows)

Para impedir condições de corrida ou sobrecarga no banco decorrente de múltiplos backups concorrentes, o script `backup-database.ps1` implementa um mecanismo de trava mútua baseado em **Mutex Nomeado do Windows**:

- **Identificador**: `Global\HoraCerta_Postgres_Backup_Mutex`
- **Comportamento**: Ao iniciar, o script tenta obter o Mutex com timeout zero (`WaitOne(0)`). Se outro processo de backup já estiver executando, a nova chamada é encerrada imediatamente com código de saída `2` e a mensagem:
  ```
  [HoraCerta Backup] Execução concorrente bloqueada: outro processo de backup já está em execução.
  ```
- **Liberação Confiável**: A liberação do Mutex ocorre em um bloco `finally`, garantindo desbloqueio mesmo em situações de exceção ou interrupção.

---

## 11. Proteção de Credenciais

Para preservar a integridade das senhas de banco:
- A senha nunca é passada como argumento de linha de comando (`-W` ou `--password`), evitando visibilidade em gerenciadores de tarefas (`Task Manager`, `Process Hacker`, `Get-Process`).
- A senha é injetada temporariamente na variável de ambiente do processo PowerShell `$env:PGPASSWORD` imediatamente antes de chamar o `pg_dump`.
- Ao término ou falha do processo, a variável `$env:PGPASSWORD` é expurgada do ambiente no bloco `finally`.
- Nenhuma credencial é escrita nos arquivos de log nem nos manifestos JSON.

---

## 12. Recuperação Emergencial de Desastre (Disaster Recovery no Banco Real)

> [!CAUTION]
> **AVISO DE SEGURANÇA CRÍTICO**:
> Este procedimento destina-se **EXCLUSIVAMENTE** a cenários de desastre real com perda ou corrupção comprovada dos dados do banco de produção.
> **NUNCA execute este procedimento como teste de rotina.** Testes de restauração devem ser conduzidos unicamente em containers Docker isolados (Seção 14).
> A recuperação sobre a base real exige **autorização humana expressa**, dupla checagem visual e confirmação expressa do banco de destino.

### Requisitos Prévios Obrigatórios:
1. **Seleção de Backup Válido**: Executar `npm run backup:verify` sobre o arquivo escolhido e comprovar que todas as 10 checagens foram aprovadas com sucesso.
2. **Backup Preventivo (Safety Net)**: Antes de qualquer modificação, gerar um snapshot imediato do banco atual (mesmo em estado de falha):
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts/backup/backup-database.ps1
   ```
3. **Validação do Alvo**: Confirmar explicitamente que a variável de destino aponta para o banco pretendido, evitando aplicação acidental sobre outros bancos.

### Procedimento Passo a Passo (Recuperação Emergencial Autorizada):
1. **Interromper Sessões do Backend e Frontend**: Parar os processos dev (`Ctrl+C`) para evitar novas escritas concorrentes.
2. **Encerrar Conexões Ativas no PostgreSQL**:
   ```sql
   SELECT pg_terminate_backend(pid) 
   FROM pg_stat_activity 
   WHERE datname = 'horacerta' AND pid <> pg_backend_pid();
   ```
3. **Execução Supervisionada do `pg_restore`**:
   O administrador deve conferir visualmente o arquivo de backup e a senha antes de executar:
   ```powershell
   # Exemplo conceitual para recuperação emergencial supervisionada:
   # pg_restore -h <HOST> -p <PORTA> -U <USUARIO> -d <BANCO_DESTINO> --clean --if-exists --no-owner --no-acl <ARQUIVO_VALIDADO.backup>
   ```
4. **Verificação dos Dados**: Conferir contagem de registros (`SELECT count(*) FROM "User"`, `SELECT count(*) FROM "WorkDay"`) e reiniciar a aplicação.

---

## 13. Procedimento de Restauração Seletiva (Tabela Específica)

Em situações emergenciais onde apenas uma tabela foi afetada (por exemplo, exclusão acidental em `WorkDay`):
- O utilitário `pg_restore` permite filtrar a tabela com o parâmetro `-t <NomeTabela>`.
- Recomenda-se extrair os dados da tabela em uma instância temporária separada e aplicar a correção de forma cirúrgica, em vez de aplicar diretamente sobre a base de produção.

---

## 14. Teste de Restauração em Ambiente Isolado (Docker)

> [!NOTE]
> **Status Atual**: **PENDENTE (Ambiente Docker Desktop isolado não iniciado nesta máquina)**.
> Conforme as diretrizes de segurança do projeto, **NÃO criamos nem excluímos bases de dados de teste na mesma instância PostgreSQL que hospeda os dados pessoais do usuário**, garantindo isolamento total do banco `horacerta`.

### Procedimento Recomendado quando Docker Estiver Ativo:
1. Subir um container efêmero e descartável de PostgreSQL 16 em porta isolada (ex: `5439`):
   ```bash
   docker run --name horacerta-restore-sandbox -e POSTGRES_PASSWORD=sandbox_secret -e POSTGRES_DB=restore_sandbox -p 5439:5432 -d postgres:16-alpine
   ```
2. Executar o `pg_restore` direcionado exclusivamente ao container na porta `5439`:
   ```powershell
   $env:PGPASSWORD = "sandbox_secret"
   & "C:\Program Files\PostgreSQL\16\bin\pg_restore.exe" -h localhost -p 5439 -U postgres -d restore_sandbox --no-owner --no-acl "$backupFile"
   Remove-Item env:\PGPASSWORD
   ```
3. Executar queries de integridade referencial e validação de contagens no container.
4. Descartar e destruir o container imediatamente:
   ```bash
   docker rm -f horacerta-restore-sandbox
   ```
Este procedimento oferece garantia 100% livre de riscos para a base pessoal real.

---

## 15. Proteção Fail-Closed para Testes Automatizados

Para garantir que suítes de testes unitários ou de integração jamais conectem ou alterem os dados do banco pessoal `horacerta`, foi implementado o mecanismo **Fail-Closed** no arquivo [`backend/src/lib/prisma.ts`](file:///c:/Users/FabSoft07/Documents/GitHub/APP/HoraCerta/backend/src/lib/prisma.ts):

### Regras de Operação:
1. **Ambiente Normal (`NODE_ENV !== 'test'` e `!VITEST`)**: O cliente Prisma se conecta normalmente ao banco de desenvolvimento/produção configurado na `DATABASE_URL`.
2. **Ambiente de Teste (`NODE_ENV === 'test'` ou `VITEST`)**:
   - Validações rigorosas de protocolo (`postgresql://` ou `postgres://`).
   - Bloqueio de qualquer banco de teste que compartilhe o mesmo host e porta da instância do banco pessoal (ex: `localhost:5432/horacerta_test` é expressamente rejeitado para impedir colisão ou carga concorrente na instância pessoal).
   - Rejeição incondicional de bancos reservados: `horacerta`, `horacerta_prod`, `horacerta_production`, `postgres`, `template0`, `template1`.
   - Exigência do identificador `test` no nome do banco de dados de teste.
   - Normalização de aliases de localhost (`localhost`, `127.0.0.1`, `::1`).
   - Se `TEST_DATABASE_URL` não for fornecida, ou se for inválida, ou se violar qualquer das regras acima:
     - O Prisma **recusa expressamente qualquer conexão**, bloqueando chamadas a todos os models (`$allOperations`), `$transaction`, `$queryRaw`, `$queryRawUnsafe`, `$executeRaw`, `$executeRawUnsafe` e `$connect`:
       ```
       [Prisma Fail-Closed] Conexão/operação '<model>.<operation>' bloqueada em ambiente de testes!
       O acesso ao banco pessoal 'horacerta' é estritamente proibido durante testes automatizados.
       Defina TEST_DATABASE_URL apontando para uma instância de teste isolada ou forneça mocks.
       ```
3. A proteção possui testes automatizados dedicados em `backend/src/lib/prisma-fail-closed.test.ts`.

