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
- Alertas de SLA para processos atrasados.
- Endpoint de disparo de notificação por e-mail (SMTP configurável).
- Proteções de segurança: rate limit + lock temporário após tentativas de login inválidas.

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

### Operação

- Backup local do banco SQLite:

```bash
npm --prefix backend run backup
```

- CI automatizado em GitHub Actions com:
	- build/test frontend
	- smoke test backend

### Arquitetura do backend

```text
backend/
├── src/
│   ├── server.js      # rotas e middlewares
│   ├── db.js          # schema SQLite + seed
│   ├── auth.js        # JWT + controle de perfis
│   ├── audit.js       # logs imutáveis assinados
│   └── config.js      # configuração via ambiente
├── uploads/           # arquivos versionados por processo
└── data.sqlite        # banco local
```

## Fluxo recomendado de uso

1. Abra a aba Editor de Documento.
2. Preencha os dados do consórcio para o timbrado.
3. Cole o texto do Word no editor.
4. Clique em `✨ Melhorar texto colado` para limpar e padronizar o HTML.
5. Clique em `⚖️ Ajustar linguagem formal` para elevar o tom administrativo.
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

## Licença

Uso interno.
