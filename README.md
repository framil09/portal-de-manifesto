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
- Painel de 30 municípios com status: pendente, enviado e assinado.
- Links únicos com janela de ativação escalonada.
- Simulação de assinatura com data/hora, geolocalização e hash.
- Prévia completa do documento com timbrado institucional.
- Registro consolidado das assinaturas recebidas.
- Abertura direta do documento assinado por município na aba de prévia.
- Aba dedicada para contratos assinados com visualização e exportação individual.
- Filtro por município e data na aba de contratos, com miniatura de pré-visualização.
- Exportação de todos os documentos assinados em um único PDF.

## Configuração da IA (opcional)

Para ativar o assistente de redação com IA, crie o arquivo `.env` na raiz com:

```env
REACT_APP_ANTHROPIC_API_KEY=sua_chave_aqui
```

Sem essa variável, o restante da aplicação continua funcionando normalmente.

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

Para ambiente real, recomenda-se backend para:

1. Persistir dados de envio e assinatura.
2. Disparar e-mails transacionais.
3. Proteger chave de IA via proxy de API.

## Licença

Uso interno.
