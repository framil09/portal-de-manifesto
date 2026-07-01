# Manifestação de Interesse Municipal

Aplicação React para preparação, envio e acompanhamento de documentos de manifestação de interesse para municípios, com simulação de assinatura eletrônica, registro de data/hora e geolocalização.

## Objetivo

Organizar o fluxo completo de trabalho em um só lugar:

1. Redigir ou colar o documento (inclusive vindo do Word).
2. Padronizar formatação e linguagem jurídica/administrativa.
3. Gerar links individuais por município com ativação escalonada.
4. Simular assinatura eletrônica e registrar evidências.

## Como executar localmente

Pré-requisitos:

- Node.js 18+
- npm

Comandos:

```bash
npm install
npm start
```

Aplicação disponível em http://localhost:3000.

## Backend completo (Node + SQLite)

Foi adicionada uma API backend com autenticação por perfil, auditoria imutável assinada, processos com versionamento de documentos e dashboard com filtros avançados.

### Executar backend

```bash
npm --prefix backend install
npm run start:api
```

API disponível em http://localhost:4000.

Usuário inicial (seed):

- email: admin@consorcio.mg.gov.br
- senha: Admin@123

### Recursos implementados

- Autenticação JWT com perfis: admin, juridico, operador, auditor.
- Matriz RBAC por ação (permissão fina por endpoint).
- API de auditoria imutável com hash encadeado e assinatura HMAC.
- Upload de documentos por processo com versionamento automático.
- Dashboard com filtros por período e secretaria.
### Principais endpoints

- POST /api/auth/login
- GET /api/auth/me
- POST /api/users (admin)
- GET /api/municipios
- PUT /api/municipios/snapshot
- GET /api/processos?secretaria=&status=&from=&to=&search=
- POST /api/processos
- PATCH /api/processos/:id
- GET /api/processos/:id/documentos
- POST /api/processos/:id/documentos (multipart field: arquivo)
- GET /api/documentos/:id/download
- GET /api/auditoria?from=&to=&action=&resourceType=
- GET /api/dashboard?from=&to=&secretaria=
- GET /api/alerts/sla?days=&secretaria=
- POST /api/alerts/notify
- POST /api/assinaturas/teste-envio

### Operação

- Backup local do banco SQLite:

```bash
npm --prefix backend run backup
```

- CI automatizado em GitHub Actions com:
	- build/test frontend
### Arquitetura do backend

```text
backend/
├── src/
6. Se quiser começar do zero, use `🧾 Inserir modelo oficial`.
7. Para contexto de contratação pública, use `🏛 Inserir modelo licitação`.
8. Clique em `🧩 Preencher campos automáticos`, preencha o formulário no modal e aplique no documento.
9. Revise a aba Prévia do Documento.
10. Faça os envios na aba Municípios e acompanhe o Registro.

## Funcionalidades principais

- Editor rich text com limpeza robusta de conteúdo colado do Word.
- Botão de normalização de texto colado e botão de ajuste de linguagem formal.
- Modelo oficial pronto para manifestação de interesse.
- Modelo específico para licitação com objeto, vigência e obrigações das partes.
- Preenchimento guiado em modal com campos automáticos: número do processo, modalidade, secretaria, objeto, valor, vigência, município, data e responsável técnico.
- Rascunho dos campos salvo automaticamente no navegador para reutilização em novos documentos.
- Ação `🧹 Limpar rascunho` no modal para resetar os dados salvos.
- Painel de municípios com status: pendente, enviado e assinado.
- Links únicos com janela de ativação escalonada.
- Simulação de assinatura com data/hora, geolocalização e hash.
- Prévia completa do documento com timbrado institucional.
- Registro consolidado das assinaturas recebidas.
- Abertura direta do documento assinado por município na aba de prévia.
- Aba dedicada para contratos assinados com visualização e exportação individual.
- Filtro por município e data na aba de contratos, com miniatura de pré-visualização.
- Exportação de todos os documentos assinados em um único PDF.

## Configuração da IA (opcional)

O assistente de redação usa **proxy no backend** (a chave não fica no browser).

No arquivo `.env` da raiz, configure:

```env
REACT_APP_API_BASE_URL=http://localhost:4000
ANTHROPIC_API_KEY=sua_chave_aqui
JWT_SECRET=troque-esta-chave-jwt
AUDIT_SECRET=troque-esta-chave-auditoria
SEED_ADMIN_PASSWORD=troque-esta-senha-admin
CORS_ORIGINS=http://localhost:3000
```

Sem `ANTHROPIC_API_KEY`, o sistema principal continua funcionando normalmente, mas a IA fica indisponível.

## Estrutura do projeto

```text
manifestacao-municipios/
├── public/
│   └── index.html
├── src/
│   ├── App.jsx
│   └── index.js
├── package.json
└── README.md
```

## Ajustes rápidos

- Lista de municípios: edite a constante `MUNICIPIOS_MG` em `src/App.jsx`.
- Regras de horário escalonado: ajuste a função `gerarHorario` em `src/App.jsx`.
- Aparência visual: ajuste variáveis CSS em `public/index.html`.
- Timbrado da prévia: troque as imagens em `public/timbrado/header.png` e `public/timbrado/footer.png`.

## Observação para produção

Para ambiente real:

1. Nunca use segredos padrão (`JWT_SECRET`, `AUDIT_SECRET`, `SEED_ADMIN_PASSWORD`).
2. Defina `CORS_ORIGINS` apenas com domínios permitidos.
3. Configure SMTP para envio real de notificações.

## Envio sem provedor externo

Se você não quiser usar Resend, Brevo ou outro serviço de API, o backend pode enviar por `sendmail`/MTA local da máquina.

Isso ainda exige que o servidor tenha um agente de e-mail instalado e configurado, como Postfix, Exim ou um binário `sendmail` disponível.

No arquivo `.env` da raiz:

```env
EMAIL_PROVIDER=sendmail
SENDMAIL_PATH=/usr/sbin/sendmail
SMTP_FROM=nao-responda@seudominio.com
```

Nesse modo, o sistema não depende de `RESEND_API_KEY`, `BREVO_API_KEY` nem de `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS`.

Se preferir, você ainda pode usar provedores externos:

```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=sua_chave_resend
RESEND_FROM=nao-responda@seudominio.com
```

```env
EMAIL_PROVIDER=brevo
BREVO_API_KEY=sua_chave_brevo
BREVO_FROM=seuemail@dominio.com
```

No modo `auto`, o backend tenta nesta ordem: `sendmail` -> `smtp` -> `brevo` -> `resend`.

### SMTP com OAuth2 (Gmail)

Se você preferir usar OAuth2 no SMTP (sem senha de app), configure:

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_AUTH_TYPE=oauth2
SMTP_USER=seu-email@gmail.com
SMTP_OAUTH_CLIENT_ID=seu_google_client_id
SMTP_OAUTH_CLIENT_SECRET=seu_google_client_secret
SMTP_OAUTH_REFRESH_TOKEN=seu_google_refresh_token
SMTP_FROM=seu-email@gmail.com
```

Observação: apenas o `client_id` não é suficiente para envio. Também são necessários `client_secret` e `refresh_token`.

## Assinatura pública com evidências

Quando a pessoa clica no link de assinatura, o backend registra o ato com:

- data e hora
- IP de origem
- geolocalização enviada pelo navegador
- dispositivo / user-agent
- hash de integridade da assinatura

Esses dados ficam gravados na tabela de municípios e na auditoria do sistema.

## Licença

Uso interno.
