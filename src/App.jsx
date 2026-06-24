import { useState, useRef, useEffect, useCallback } from "react";
import { jsPDF } from "jspdf";

// ─── DADOS DOS MUNICÍPIOS ─────────────────────────────────────────────────────
const MUNICIPIOS_MG = [
  { nome: "Aluroca", email: "licitacao@aluroca.mg.gov.br" },
  { nome: "Alagoa", email: "licitacao@alagoa.mg.gov.br" },
  { nome: "Arantina", email: "licitacao@arantina.mg.gov.br" },
  { nome: "Baependi", email: "licitacaos@baependi.mg.gov.br" },
  { nome: "Bocaina de Minas", email: "licitacao@bocainademinas.mg.gov.br" },
  { nome: "Cambuquira", email: "gabinete@cambuquira.mg.gov.br" },
  { nome: "Carmo de Minas", email: "licitacao@carmodeminas.mg.gov.br" },
  { nome: "Caxambu", email: "licitacao@caxambu.mg.gov.br" },
  { nome: "Conceição do Rio Verde", email: "licitacaos@conceicaodoriioverde.mg.gov.br" },
  { nome: "Cruzilha", email: "licitacao@cruzilha.mg.gov.br" },
  { nome: "Cristina", email: "gabinete@cristina.mg.gov.br" },
  { nome: "Dom Viçoso", email: "licitacaodmvicoso@yahoo.com.br" },
  { nome: "Elamonte", email: "licitacao@elamonte.mg.gov.br" },
  { nome: "Itanhandu", email: "licitacao@itanhandu.mg.gov.br" },
  { nome: "Itamari", email: "licitacao@compraslicitacoes@itamari.com.br" },
  { nome: "Lambari ", email: "licitacao@lambari.mg.gov.br" },
  { nome: "Minduri", email: "licitacaominduri@gmail.com" },
  { nome: "Olimpo Noronha", email: "compraslicitacoes@olimpinoronha.mg.gov.br" },
  { nome: "Passa Quatro", email: "licitacao@passaquatro.mg.gov.br" },
  { nome: "Passa Vinte", email: "licitacaopassavinte@gmail.com" },
  { nome: "Pouso Alto", email: "licitacao@pousoalto.mg.gov.br" },
  { nome: "São Lourenço", email: "compras@saolourenco.mg.gov.br" },
  { nome: "São Sebastião do Rio Verde", email: "licitacao@sansebastiaodoriioverde.mg.gov.br" },
  { nome: "São Thomé das Letras", email: "comprassat@yahoo.com.br" },
  { nome: "Seritinga", email: "licitacao@seritinga.mg.gov.br" },
  { nome: "Serranos", email: "licitacao@serranos.mg.gov.br" },
  { nome: "Soledade de Minas", email: "licitacao@soledadedeminas.mg.gov.br" },
  { nome: "Virgínia", email: "licitacao@virginia.mg.gov.br" },
  { nome: "Três Corações", email: "credenciamento.licitacao@trescoraces.mg.gov.br" }
];

// Edite aqui para adicionar ou trocar municípios com seus respectivos emails

function gerarToken(nome) {
  return btoa(nome + Date.now() + Math.random())
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 16);
}

function gerarHorario(index) {
  const base = new Date();
  base.setHours(8, 0, 0, 0);
  // Cada cidade recebe um offset único: entre 12h e 96h após o envio
  const horas = 12 + index * 2.8 + Math.floor(Math.random() * 4);
  return new Date(base.getTime() + horas * 3600000);
}

function sanitizeWordHtml(inputHtml) {
  if (!inputHtml) return "";

  const parser = new DOMParser();
  const parsed = parser.parseFromString(`<div>${inputHtml}</div>`, "text/html");
  const root = parsed.body.firstElementChild || parsed.body;

  const removeNode = (node) => {
    if (node?.parentNode) node.parentNode.removeChild(node);
  };

  const unwrapNode = (node) => {
    if (!node?.parentNode) return;
    while (node.firstChild) {
      node.parentNode.insertBefore(node.firstChild, node);
    }
    node.parentNode.removeChild(node);
  };

  const blockedTags = new Set([
    "SCRIPT",
    "STYLE",
    "META",
    "LINK",
    "OBJECT",
    "EMBED",
    "IFRAME",
    "XML",
  ]);

  const allowedTags = new Set([
    "P",
    "BR",
    "STRONG",
    "B",
    "EM",
    "I",
    "U",
    "UL",
    "OL",
    "LI",
    "H1",
    "H2",
    "H3",
    "H4",
    "BLOCKQUOTE",
    "TABLE",
    "TBODY",
    "TR",
    "TD",
    "TH",
    "THEAD",
    "TFOOT",
    "HR",
    "A",
  ]);

  const allowedAttrsByTag = {
    A: new Set(["href"]),
    TD: new Set(["colspan", "rowspan"]),
    TH: new Set(["colspan", "rowspan"]),
  };

  const walk = (node) => {
    const children = Array.from(node.childNodes);

    for (const child of children) {
      if (child.nodeType === Node.COMMENT_NODE) {
        removeNode(child);
        continue;
      }

      if (child.nodeType !== Node.ELEMENT_NODE) {
        continue;
      }

      const tag = child.tagName;
      const lowerTag = tag.toLowerCase();

      if (blockedTags.has(tag) || lowerTag === "o:p" || lowerTag.includes(":")) {
        removeNode(child);
        continue;
      }

      if (tag === "DIV") {
        const replacement = parsed.createElement("p");
        while (child.firstChild) replacement.appendChild(child.firstChild);
        child.parentNode.replaceChild(replacement, child);
        walk(replacement);
        continue;
      }

      if (tag === "SPAN" || tag === "FONT") {
        unwrapNode(child);
        continue;
      }

      if (!allowedTags.has(tag)) {
        unwrapNode(child);
        continue;
      }

      const allowedAttrs = allowedAttrsByTag[tag] || new Set();
      Array.from(child.attributes).forEach((attr) => {
        const attrName = attr.name.toLowerCase();
        if (!allowedAttrs.has(attrName)) {
          child.removeAttribute(attr.name);
        }
      });

      if (tag === "A") {
        const href = child.getAttribute("href") || "";
        const safeHref = href.trim();
        const isSafe =
          safeHref.startsWith("http://") ||
          safeHref.startsWith("https://") ||
          safeHref.startsWith("mailto:");
        if (!isSafe) child.removeAttribute("href");
      }

      walk(child);
    }
  };

  walk(root);

  root.querySelectorAll("p").forEach((p) => {
    const text = p.textContent?.replace(/\u00a0/g, " ").trim() || "";
    if (!text && p.querySelectorAll("br").length === 0) {
      removeNode(p);
    }
  });

  return root.innerHTML
    .replace(/\u00a0/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizeDocumentHtml(inputHtml) {
  const cleaned = sanitizeWordHtml(inputHtml || "");
  if (!cleaned) return "";

  const parser = new DOMParser();
  const parsed = parser.parseFromString(`<div>${cleaned}</div>`, "text/html");
  const root = parsed.body.firstElementChild || parsed.body;

  root.querySelectorAll("p, li").forEach((el) => {
    el.textContent = (el.textContent || "")
      .replace(/\s+/g, " ")
      .replace(/\s+([,.;:!?])/g, "$1")
      .trim();
  });

  root.querySelectorAll("table").forEach((table) => {
    table.setAttribute("style", "width:100%;border-collapse:collapse;margin:12px 0;");
    table.querySelectorAll("td, th").forEach((cell) => {
      cell.setAttribute("style", "border:1px solid #c9c9c9;padding:6px;");
    });
  });

  return root.innerHTML
    .replace(/<p><\/p>/g, "")
    .replace(/(<br\s*\/?>(\s|&nbsp;)*){3,}/gi, "<br><br>")
    .trim();
}

function buildManifestacaoTemplate(consorcioNome = "CONSÓRCIO INTERMUNICIPAL") {
  return `
<p><strong>Assunto:</strong> Manifestação de interesse para celebração de parceria institucional.</p>
<p>O ${consorcioNome} vem, respeitosamente, por meio deste expediente, manifestar interesse na formalização de parceria com este Município, com vistas ao desenvolvimento de ações conjuntas de interesse público, em conformidade com os princípios da legalidade, impessoalidade, moralidade, publicidade e eficiência.</p>
<h3>1. Objeto da parceria</h3>
<p>A proposta tem por objeto estabelecer cooperação técnica e institucional para planejamento, execução e monitoramento de iniciativas voltadas ao fortalecimento da gestão municipal, à melhoria da prestação de serviços públicos e à otimização de recursos administrativos e operacionais.</p>
<h3>2. Justificativa</h3>
<p>A presente manifestação fundamenta-se na necessidade de ampliar a capacidade de resposta do poder público local, por meio de instrumentos colaborativos que promovam economicidade, integração regional e aumento da efetividade das políticas públicas.</p>
<h3>3. Vigência e cronograma inicial</h3>
<p>Propõe-se vigência inicial de 90 (noventa) dias, contados da assinatura do instrumento correspondente, período no qual serão detalhados plano de trabalho, metas, responsabilidades e indicadores de acompanhamento.</p>
<h3>4. Disposições finais</h3>
<p>Permanecemos à disposição para reunião técnica de alinhamento e para os ajustes necessários à formalização do instrumento, observadas as normas aplicáveis e os procedimentos administrativos competentes.</p>
<p>Sem mais para o momento, renovamos protestos de elevada consideração e apreço.</p>
<p style="margin-top:28px;">[Cidade], [data].</p>
<div style="text-align:center;margin:24px 0;padding:20px 16px;border:1px dashed #aaa;border-radius:6px;color:#666;font-size:12px;line-height:1.7;">
  <strong>ASSINATURA DIGITAL DO REPRESENTANTE MUNICIPAL</strong><br>
  <span style="font-size:11px;color:#999;">Data, hora e geolocalização registradas automaticamente no ato da assinatura</span>
</div>
`;
}

function buildLicitacaoTemplate(consorcioNome = "CONSÓRCIO INTERMUNICIPAL") {
  return `
<p><strong>Assunto:</strong> Manifestação formal de interesse para participação no [MODALIDADE] do processo [NÚMERO DO PROCESSO].</p>
<p>O ${consorcioNome}, por meio de seu representante legal, manifesta formalmente interesse em compor solução administrativa conjunta com este Município, no âmbito do processo [NÚMERO DO PROCESSO], modalidade [MODALIDADE], observadas as disposições da Lei no 14.133/2021, regulamentações locais e demais normas aplicáveis.</p>
<p><strong>Secretaria demandante:</strong> [SECRETARIA DEMANDANTE]<br><strong>Objeto resumido:</strong> [OBJETO RESUMIDO]<br><strong>Valor estimado:</strong> [VALOR ESTIMADO]</p>
<h3>1. Objeto</h3>
<p>Constitui objeto desta manifestação a intenção de estabelecer cooperação institucional para estruturação, apoio técnico e execução de ações relacionadas ao processo de contratação pública, compreendendo planejamento, padronização documental, acompanhamento de metas e suporte operacional conforme demanda da Administração Municipal.</p>
<h3>2. Justificativa e interesse público</h3>
<p>A proposta apresenta aderência ao interesse público por promover economicidade, eficiência administrativa, padronização procedimental e fortalecimento da capacidade técnica municipal, contribuindo para maior segurança jurídica dos atos administrativos e para melhor qualidade dos serviços ofertados à população.</p>
<h3>3. Vigência inicial</h3>
<p>Sugere-se vigência inicial de [PRAZO DE VIGÊNCIA], admitidas prorrogações nos termos legais e mediante justificativa técnica e administrativa, condicionadas à avaliação de desempenho, à manutenção da vantajosidade e à disponibilidade orçamentária.</p>
<h3>4. Obrigações do Município</h3>
<ul>
  <li>Designar equipe técnica responsável pela interlocução com o consórcio.</li>
  <li>Disponibilizar documentos, dados e informações necessárias à instrução processual.</li>
  <li>Observar os prazos pactuados para validações e deliberações administrativas.</li>
  <li>Assegurar conformidade dos atos com a legislação local e normas de controle interno.</li>
</ul>
<h3>5. Obrigações do Consórcio</h3>
<ul>
  <li>Fornecer suporte técnico especializado para etapas de planejamento e execução.</li>
  <li>Apresentar minutas, relatórios e instrumentos de acompanhamento quando aplicável.</li>
  <li>Manter registros técnicos e administrativos das atividades realizadas.</li>
  <li>Atuar em conformidade com os princípios da administração pública e da nova lei de licitações.</li>
</ul>
<h3>6. Fiscalização, transparência e conformidade</h3>
<p>As ações decorrentes deste instrumento estarão sujeitas à fiscalização pelos órgãos competentes, com observância dos deveres de transparência, integridade e prestação de contas, sem prejuízo da atuação dos órgãos de controle externo e interno.</p>
<h3>7. Encerramento</h3>
<p>Colocamo-nos à disposição para reunião de alinhamento técnico-jurídico e para os ajustes necessários à formalização do instrumento contratual correspondente.</p>
<p>Termos em que, manifesta-se o interesse e aguarda-se deliberação desta Municipalidade.</p>
<p style="margin-top:28px;">[MUNICÍPIO], [DATA].</p>
<p><strong>Responsável técnico/jurídico:</strong> [RESPONSÁVEL TÉCNICO]</p>
<div style="text-align:center;margin:24px 0;padding:20px 16px;border:1px dashed #aaa;border-radius:6px;color:#666;font-size:12px;line-height:1.7;">
  <strong>ASSINATURA DIGITAL DO REPRESENTANTE MUNICIPAL</strong><br>
  <span style="font-size:11px;color:#999;">Data, hora, IP e geolocalização registrados automaticamente no ato da assinatura</span>
</div>
`;
}

const LICITACAO_AUTO_FIELDS = [
  {
    key: "numeroProcesso",
    token: "[NÚMERO DO PROCESSO]",
    label: "Número do processo",
    placeholder: "Ex.: 012/2026",
    defaultValue: "000/2026",
  },
  {
    key: "modalidade",
    token: "[MODALIDADE]",
    label: "Modalidade",
    placeholder: "Ex.: Pregão Eletrônico",
    defaultValue: "Pregão Eletrônico",
  },
  {
    key: "secretariaDemandante",
    token: "[SECRETARIA DEMANDANTE]",
    label: "Secretaria demandante",
    placeholder: "Ex.: Secretaria Municipal de Administração",
    defaultValue: "Secretaria Municipal de Administração",
  },
  {
    key: "objetoResumido",
    token: "[OBJETO RESUMIDO]",
    label: "Objeto resumido",
    placeholder: "Ex.: Contratação de solução para apoio técnico-administrativo",
    defaultValue: "Contratação de solução para apoio técnico-administrativo",
  },
  {
    key: "valorEstimado",
    token: "[VALOR ESTIMADO]",
    label: "Valor estimado",
    placeholder: "Ex.: R$ 250.000,00",
    defaultValue: "R$ 0,00",
  },
  {
    key: "prazoVigencia",
    token: "[PRAZO DE VIGÊNCIA]",
    label: "Prazo de vigência",
    placeholder: "Ex.: 12 (doze) meses",
    defaultValue: "12 (doze) meses",
  },
  {
    key: "municipio",
    token: "[MUNICÍPIO]",
    label: "Município",
    placeholder: "Ex.: Poços de Caldas",
    defaultValue: "Nome do Município",
  },
  {
    key: "data",
    token: "[DATA]",
    label: "Data",
    placeholder: "Ex.: 24/06/2026",
    defaultValue: new Date().toLocaleDateString("pt-BR"),
  },
  {
    key: "responsavelTecnico",
    token: "[RESPONSÁVEL TÉCNICO]",
    label: "Responsável técnico/jurídico",
    placeholder: "Ex.: Nome completo",
    defaultValue: "Nome completo",
  },
];

const LICITACAO_STORAGE_KEY = "manifestacao.licitacaoForm.v1";
const MUNICIPIOS_STORAGE_KEY = "manifestacao.municipios.v1";

function getInitialLicitacaoFormValues() {
  return LICITACAO_AUTO_FIELDS.reduce((acc, field) => {
    acc[field.key] = field.defaultValue;
    return acc;
  }, {});
}

function escapeRegExp(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function applyTemplateFieldValues(inputHtml, valuesMap) {
  let output = inputHtml || "";
  Object.entries(valuesMap).forEach(([token, value]) => {
    const regex = new RegExp(escapeRegExp(token), "g");
    output = output.replace(regex, value || "");
  });
  return output;
}

const TIMBRADO_HEADER_SRC = "/timbrado/header.png";
const TIMBRADO_FOOTER_SRC = "/timbrado/footer.png";

function htmlToPlainText(inputHtml) {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(`<div>${inputHtml || ""}</div>`, "text/html");
  const root = parsed.body.firstElementChild || parsed.body;

  root.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
  root.querySelectorAll("p, li, h1, h2, h3, h4, tr").forEach((el) => {
    el.append("\n");
  });

  return (root.textContent || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function imageUrlToDataUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao carregar imagem: ${url}`);
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function refineFormalLanguage(inputHtml) {
  const cleaned = normalizeDocumentHtml(inputHtml || "");
  if (!cleaned) return "";

  const parser = new DOMParser();
  const parsed = parser.parseFromString(`<div>${cleaned}</div>`, "text/html");
  const root = parsed.body.firstElementChild || parsed.body;

  const replacements = [
    [/\bvim\b/gi, "venho"],
    [/\bvimos\b/gi, "viemos"],
    [/\bqueremos\b/gi, "manifestamos interesse em"],
    [/\bpedimos\b/gi, "solicitamos"],
    [/\bagradecemos\b/gi, "registramos agradecimento"],
    [/\bok\b/gi, "de acordo"],
    [/\bcoisa\b/gi, "medida"],
    [/\bvai\b/gi, "será"],
    [/\bfoi feito\b/gi, "foi realizado"],
    [/\bpor causa de\b/gi, "em razão de"],
    [/\bde acordo com a lei\b/gi, "nos termos da legislação aplicável"],
  ];

  const processTextNode = (node) => {
    let txt = node.nodeValue || "";
    replacements.forEach(([regex, replacement]) => {
      txt = txt.replace(regex, replacement);
    });
    txt = txt
      .replace(/\s+/g, " ")
      .replace(/\s+([,.;:!?])/g, "$1")
      .replace(/([.!?])\s*([a-zà-ÿ])/gi, (_, p1, p2) => `${p1} ${p2.toUpperCase()}`)
      .trim();
    node.nodeValue = txt;
  };

  const walk = (node) => {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        processTextNode(child);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        walk(child);
      }
    });
  };

  walk(root);
  return root.innerHTML;
}

const initialMunicipios = MUNICIPIOS_MG.map((m, i) => ({
  id: i,
  nome: m.nome,
  email: m.email,
  token: gerarToken(m.nome),
  activateAt: gerarHorario(i),
  status: "pendente", // pendente | enviado | assinado
  signedAt: null,
  geo: null,
  hash: null,
}));

// ─── ESTILOS ──────────────────────────────────────────────────────────────────
const S = {
  app: {
    fontFamily: "var(--font-sans)",
    maxWidth: 940,
    margin: "0 auto",
    padding: "0 0 4rem",
    color: "var(--color-text-primary)",
    background: "transparent",
  },
  header: {
    padding: "1.5rem 0 1rem",
    borderBottom: "0.5px solid var(--color-border-tertiary)",
    marginBottom: "1.5rem",
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  logo: {
    width: 42, height: 42, borderRadius: "50%",
    background: "var(--color-background-info)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 22, flexShrink: 0,
  },
  tabBar: {
    display: "flex", gap: 2,
    borderBottom: "0.5px solid var(--color-border-tertiary)",
    marginBottom: "1.5rem", overflowX: "auto",
  },
  tab: (active) => ({
    padding: "9px 18px", fontSize: 13, cursor: "pointer",
    border: "none", background: "none",
    color: active ? "var(--color-text-primary)" : "var(--color-text-secondary)",
    borderBottom: active ? "2px solid var(--color-text-primary)" : "2px solid transparent",
    fontWeight: active ? 500 : 400, whiteSpace: "nowrap", marginBottom: -1,
  }),
  card: {
    background: "var(--color-background-primary)",
    border: "0.5px solid var(--color-border-tertiary)",
    borderRadius: 12, padding: "1rem 1.25rem", marginBottom: 12,
  },
  statsGrid: {
    display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: "1.25rem",
  },
  statCard: {
    background: "var(--color-background-secondary)",
    borderRadius: 8, padding: "12px", textAlign: "center",
  },
  statNum: { fontSize: 24, fontWeight: 500 },
  statLabel: { fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2 },
  btn: {
    padding: "7px 16px", fontSize: 13,
    border: "0.5px solid var(--color-border-secondary)",
    borderRadius: 8, background: "var(--color-background-primary)",
    color: "var(--color-text-primary)", cursor: "pointer",
    display: "inline-flex", alignItems: "center", gap: 6,
  },
  btnPrimary: {
    padding: "7px 16px", fontSize: 13, border: "none",
    borderRadius: 8, background: "var(--color-text-primary)",
    color: "var(--color-background-primary)", cursor: "pointer",
    display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 500,
  },
  btnSm: {
    padding: "4px 10px", fontSize: 11,
    border: "0.5px solid var(--color-border-tertiary)",
    borderRadius: 6, background: "var(--color-background-primary)",
    color: "var(--color-text-secondary)", cursor: "pointer",
  },
  input: {
    width: "100%", padding: "7px 10px", fontSize: 13,
    border: "0.5px solid var(--color-border-secondary)",
    borderRadius: 8, background: "var(--color-background-primary)",
    color: "var(--color-text-primary)",
  },
  badge: (status) => {
    const map = {
      pendente: { bg: "var(--color-background-warning)", c: "var(--color-text-warning)" },
      enviado:  { bg: "var(--color-background-info)",    c: "var(--color-text-info)" },
      assinado: { bg: "var(--color-background-success)", c: "var(--color-text-success)" },
    };
    const { bg, c } = map[status] || map.pendente;
    return {
      background: bg, color: c,
      padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 500,
    };
  },
  progress: {
    height: 6, background: "var(--color-background-secondary)",
    borderRadius: 3, overflow: "hidden", marginBottom: "1.25rem",
  },
  progressFill: (pct) => ({
    height: "100%", width: pct + "%",
    background: "var(--color-text-success)", borderRadius: 3, transition: "width .4s",
  }),
  sectionTitle: { fontSize: 14, fontWeight: 500, marginBottom: 12 },
  label: { fontSize: 12, color: "var(--color-text-secondary)", width: 130, flexShrink: 0 },
  editorToolbar: {
    display: "flex", gap: 4, padding: "6px 8px", flexWrap: "wrap",
    background: "var(--color-background-secondary)",
    borderRadius: "8px 8px 0 0",
    border: "0.5px solid var(--color-border-secondary)",
    borderBottom: "0.5px solid var(--color-border-tertiary)",
  },
  editorArea: {
    minHeight: 480, padding: "1.5rem", fontSize: 13, lineHeight: 1.9,
    border: "0.5px solid var(--color-border-secondary)",
    borderTop: "none", borderRadius: "0 0 8px 8px",
    outline: "none",
    background: "var(--color-background-primary)",
    color: "var(--color-text-primary)",
    overflowY: "auto",
  },
  modalOverlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200,
  },
  modal: {
    background: "var(--color-background-primary)",
    border: "0.5px solid var(--color-border-secondary)",
    borderRadius: 14, padding: "1.5rem", width: "90%", maxWidth: 520,
  },
  toast: {
    position: "fixed", bottom: "1.5rem", left: "50%",
    transform: "translateX(-50%)",
    background: "var(--color-text-primary)",
    color: "var(--color-background-primary)",
    padding: "8px 20px", borderRadius: 8, fontSize: 13, zIndex: 999,
    pointerEvents: "none", whiteSpace: "nowrap",
  },
  docPage: {
    background: "#fff", color: "#222",
    minHeight: 800, padding: "60px 72px",
    fontFamily: "Georgia, serif", fontSize: 13, lineHeight: 1.9,
    boxShadow: "0 2px 16px rgba(0,0,0,0.10)", borderRadius: 4,
    position: "relative",
  },
};

// ─── BOTÃO DA BARRA DE FERRAMENTAS ────────────────────────────────────────────
function TBtn({ cmd, val, label, title }) {
  return (
    <button
      title={title || label}
      onMouseDown={(e) => {
        e.preventDefault();
        document.execCommand(cmd, false, val || null);
      }}
      style={{
        padding: "3px 8px", fontSize: 12,
        border: "0.5px solid var(--color-border-tertiary)",
        borderRadius: 5, background: "var(--color-background-primary)",
        color: "var(--color-text-primary)", cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

// ─── EDITOR RICH TEXT ─────────────────────────────────────────────────────────
function RichEditor({ value, onChange, placeholder }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    const nextValue = value || "";
    if (ref.current.innerHTML !== nextValue) {
      ref.current.innerHTML = nextValue;
    }
  }, [value]);

  const handleInput = () => {
    if (onChange) onChange(ref.current.innerHTML);
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const html = e.clipboardData.getData("text/html");
    const text = e.clipboardData.getData("text/plain");

    if (html) {
      // Limpeza robusta do HTML do Word mantendo a estrutura principal.
      const clean = sanitizeWordHtml(html);
      document.execCommand("insertHTML", false, clean);
    } else {
      document.execCommand("insertText", false, text);
    }
    handleInput();
  };

  const insertTable = () => {
    const tbl = `<table style="width:100%;border-collapse:collapse;margin:12px 0;">
      <tr>
        <td style="border:1px solid #ccc;padding:6px;">Coluna 1</td>
        <td style="border:1px solid #ccc;padding:6px;">Coluna 2</td>
        <td style="border:1px solid #ccc;padding:6px;">Coluna 3</td>
      </tr>
      <tr>
        <td style="border:1px solid #ccc;padding:6px;">&nbsp;</td>
        <td style="border:1px solid #ccc;padding:6px;">&nbsp;</td>
        <td style="border:1px solid #ccc;padding:6px;">&nbsp;</td>
      </tr>
    </table>`;
    document.execCommand("insertHTML", false, tbl);
    handleInput();
  };

  const insertLine = () => {
    document.execCommand(
      "insertHTML",
      false,
      "<hr style='border:none;border-top:1px solid #ccc;margin:16px 0;'/>"
    );
    handleInput();
  };

  const insertSigPlaceholder = () => {
    document.execCommand(
      "insertHTML",
      false,
      `<div style="text-align:center;margin:24px 0;padding:20px 16px;border:1px dashed #aaa;border-radius:6px;color:#666;font-size:12px;line-height:1.7;">
        <strong>✍ ASSINATURA DIGITAL DO REPRESENTANTE MUNICIPAL</strong><br>
        <span style="font-size:11px;color:#999;">Data/Hora e Geolocalização capturadas automaticamente ao clicar no link</span>
      </div>`
    );
    handleInput();
  };

  return (
    <div>
      <div style={S.editorToolbar}>
        <TBtn cmd="bold"               label="N"        title="Negrito (Ctrl+B)" />
        <TBtn cmd="italic"             label="I"        title="Itálico (Ctrl+I)" />
        <TBtn cmd="underline"          label="S"        title="Sublinhado (Ctrl+U)" />
        <TBtn cmd="justifyLeft"        label="⟵"       title="Alinhar à esquerda" />
        <TBtn cmd="justifyCenter"      label="↔"        title="Centralizar" />
        <TBtn cmd="justifyRight"       label="⟶"       title="Alinhar à direita" />
        <TBtn cmd="justifyFull"        label="≡"        title="Justificar" />
        <TBtn cmd="insertUnorderedList" label="• Lista" title="Lista com marcadores" />
        <TBtn cmd="insertOrderedList"  label="1. Lista" title="Lista numerada" />
        <TBtn cmd="formatBlock" val="h2" label="Título" title="Título" />
        <TBtn cmd="formatBlock" val="h3" label="Subtítulo" title="Subtítulo" />
        <TBtn cmd="formatBlock" val="p"  label="¶ Normal" title="Parágrafo normal" />
        <button
          onMouseDown={(e) => { e.preventDefault(); insertTable(); }}
          title="Inserir tabela"
          style={{
            padding: "3px 8px", fontSize: 12,
            border: "0.5px solid var(--color-border-tertiary)",
            borderRadius: 5, background: "var(--color-background-primary)",
            color: "var(--color-text-primary)", cursor: "pointer",
          }}
        >
          ⊞ Tabela
        </button>
        <button
          onMouseDown={(e) => { e.preventDefault(); insertLine(); }}
          title="Inserir linha separadora"
          style={{
            padding: "3px 8px", fontSize: 12,
            border: "0.5px solid var(--color-border-tertiary)",
            borderRadius: 5, background: "var(--color-background-primary)",
            color: "var(--color-text-primary)", cursor: "pointer",
          }}
        >
          — Linha
        </button>
        <button
          onMouseDown={(e) => { e.preventDefault(); insertSigPlaceholder(); }}
          title="Inserir campo de assinatura digital"
          style={{
            padding: "3px 10px", fontSize: 12,
            border: "0.5px solid var(--color-border-info)",
            borderRadius: 5, background: "var(--color-background-info)",
            color: "var(--color-text-info)", cursor: "pointer", fontWeight: 500,
          }}
        >
          ✍ Campo de assinatura
        </button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onPaste={handlePaste}
        style={S.editorArea}
        data-placeholder={placeholder}
      />
    </div>
  );
}

// ─── PRÉVIA DO DOCUMENTO COM TIMBRADO ────────────────────────────────────────
function DocPreview({ municipio, docHtml, signData }) {
  return (
    <div style={S.docPage}>
      {/* Timbrado */}
      <div style={{ marginBottom: 20 }}>
        <img
          src={TIMBRADO_HEADER_SRC}
          alt="Timbrado superior"
          style={{ width: "100%", height: "auto", display: "block" }}
        />
      </div>

      {/* Número e data */}
      <div style={{ textAlign: "right", fontSize: 11, color: "#888", marginBottom: 24 }}>
        Ofício nº {String(Math.floor(Math.random() * 900) + 100)}/{new Date().getFullYear()} &nbsp;|&nbsp;{" "}
        {new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
      </div>

      {/* Destinatário */}
      <div style={{ marginBottom: 24, fontSize: 13 }}>
        <strong>À</strong><br />
        Sua Excelência o(a) Senhor(a) Prefeito(a) Municipal<br />
        <strong>Município de {municipio || "[MUNICÍPIO]"}</strong><br />
        Estado de Minas Gerais
      </div>

      {/* Corpo */}
      <div
        style={{ fontSize: 13, lineHeight: 1.9, textAlign: "justify" }}
        dangerouslySetInnerHTML={{
          __html: docHtml || "<p><em>O conteúdo do documento aparecerá aqui. Edite na aba Editor de Documento.</em></p>",
        }}
      />

      {/* Campo de assinatura */}
      {signData ? (
        <div style={{
          border: "1px solid #2d6a2d", borderRadius: 6, padding: "14px 16px",
          textAlign: "center", background: "#f4fbf4", marginTop: 32,
        }}>
          <div style={{ fontFamily: "monospace", fontSize: 11, color: "#2d6a2d", marginBottom: 6, fontWeight: 600 }}>
            ✅ DOCUMENTO ASSINADO ELETRONICAMENTE
          </div>
          <div style={{ fontSize: 12, color: "#333", lineHeight: 1.7 }}>
            <strong>{signData.nome}</strong><br />
            {signData.cargo} — {municipio}<br />
            Assinado em: {new Date(signData.at).toLocaleString("pt-BR")}<br />
            Geolocalização: {signData.lat?.toFixed(6)}, {signData.lon?.toFixed(6)}<br />
            <span style={{ fontFamily: "monospace", fontSize: 10 }}>Hash: {signData.hash}</span>
          </div>
        </div>
      ) : (
        <div style={{
          border: "1px dashed #ccc", borderRadius: 6, padding: "20px",
          textAlign: "center", background: "#fafafa", marginTop: 32,
        }}>
          <div style={{ fontSize: 12, color: "#888" }}>
            ✍ Campo de assinatura digital
          </div>
          <div style={{ fontSize: 10, color: "#aaa", marginTop: 4 }}>
            Preenchido automaticamente quando o representante municipal clicar no link e assinar
          </div>
        </div>
      )}

      {/* Rodapé timbrado */}
      <div style={{ marginTop: 32 }}>
        <img
          src={TIMBRADO_FOOTER_SRC}
          alt="Timbrado inferior"
          style={{ width: "100%", height: "auto", display: "block" }}
        />
      </div>
    </div>
  );
}

// ─── PAINEL DE ASSINATURA (simulação) ────────────────────────────────────────
function PainelAssinatura({ municipio, onSign, totalMunicipios = 0 }) {
  const [step, setStep] = useState("waiting");
  const [data, setData] = useState(null);

  const assinar = () => {
    setStep("geo");
    const capturar = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => finalizar(pos.coords.latitude, pos.coords.longitude),
          () => finalizar(
            -21.79 + (Math.random() - 0.5) * 0.3,
            -46.56 + (Math.random() - 0.5) * 0.3
          )
        );
      } else {
        finalizar(
          -21.79 + (Math.random() - 0.5) * 0.3,
          -46.56 + (Math.random() - 0.5) * 0.3
        );
      }
    };
    setTimeout(capturar, 900);
  };

  const finalizar = (lat, lon) => {
    const sig = {
      nome: "Representante Municipal",
      cargo: "Prefeito(a) Municipal",
      at: new Date().toISOString(),
      lat,
      lon,
      hash: "SIG-" + Math.random().toString(36).slice(2, 12).toUpperCase(),
    };
    setData(sig);
    setStep("done");
    if (onSign) onSign(sig);
  };

  return (
    <div style={S.card}>
      <div style={S.sectionTitle}>
        Simulação — como o prefeito verá ao abrir o link
      </div>
      <div style={{
        background: "var(--color-background-secondary)",
        borderRadius: 10, padding: "1.25rem", marginBottom: 12,
      }}>
        <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 10 }}>
          Município de{" "}
          <strong style={{ color: "var(--color-text-primary)" }}>
            {municipio?.nome || "—"}
          </strong>
        </div>

        {step === "done" && data && (
          <div style={{
            fontSize: 12,
            background: "var(--color-background-success)",
            border: "0.5px solid var(--color-border-success)",
            borderRadius: 8, padding: "10px 14px", marginBottom: 10,
          }}>
            <div style={{ fontWeight: 500, color: "var(--color-text-success)", marginBottom: 4 }}>
              ✅ Documento assinado com sucesso
            </div>
            <div style={{ color: "var(--color-text-secondary)", lineHeight: 1.8 }}>
              <div>📅 {new Date(data.at).toLocaleString("pt-BR")}</div>
              <div>📍 Lat {data.lat.toFixed(6)}, Lon {data.lon.toFixed(6)}</div>
              <div>
                🔐 Hash:{" "}
                <span style={{ fontFamily: "monospace", fontSize: 11 }}>{data.hash}</span>
              </div>
            </div>
          </div>
        )}

        {step === "geo" && (
          <div style={{
            textAlign: "center", padding: "1rem",
            color: "var(--color-text-secondary)", fontSize: 13,
          }}>
            📡 Capturando geolocalização...
          </div>
        )}

        <button
          onClick={assinar}
          disabled={step !== "waiting"}
          style={{
            ...S.btnPrimary,
            width: "100%", justifyContent: "center", padding: "11px",
            opacity: step !== "waiting" ? 0.6 : 1,
            background:
              step === "done"
                ? "var(--color-background-success)"
                : "var(--color-text-primary)",
            color:
              step === "done"
                ? "var(--color-text-success)"
                : "var(--color-background-primary)",
            border: step === "done" ? "0.5px solid var(--color-border-success)" : "none",
          }}
        >
          {step === "done"
            ? "✅ Assinado com sucesso"
            : step === "geo"
            ? "⏳ Processando..."
            : "✍ Clique para assinar este documento"}
        </button>

        <div style={{
          fontSize: 10, color: "var(--color-text-tertiary)",
          textAlign: "center", marginTop: 8,
        }}>
          Ao clicar, você concorda com a captura de data, hora e geolocalização
          para fins de assinatura eletrônica.
        </div>
      </div>

      <div style={S.card}>
        <div style={S.sectionTitle}>Como funciona o escalonamento de horários</div>
        <div style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.8, marginBottom: 12 }}>
          Cada município recebe um link com um{" "}
          <strong style={{ color: "var(--color-text-primary)" }}>
            timestamp de ativação único
          </strong>
          , calculado automaticamente com base na ordem do envio. O link só
          fica disponível para assinatura após esse horário — garantindo que as
          {totalMunicipios} assinaturas ocorram em momentos distintos, o que fortalece a
          credibilidade e a validade jurídica do processo.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {[
            ["Municípios 1–10", "12 a 45h após envio", "info"],
            ["Municípios 11–20", "24 a 65h após envio", "success"],
            [totalMunicipios > 20 ? `Municípios 21–${totalMunicipios}` : "Municípios 21+", "36 a 96h após envio", "warning"],
          ].map(([label, desc, color]) => (
            <div
              key={label}
              style={{
                background: `var(--color-background-${color})`,
                borderRadius: 8, padding: "8px 10px",
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 500, color: `var(--color-text-${color})` }}>
                {label}
              </div>
              <div style={{ fontSize: 11, color: `var(--color-text-${color})`, opacity: 0.85 }}>
                {desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── ASSISTENTE IA ────────────────────────────────────────────────────────────
function AIAssistant({ docContext }) {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, loading]);

  const send = async (texto) => {
    const userMsg = (texto || input).trim();
    if (!userMsg || loading) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      // ─── IMPORTANTE ──────────────────────────────────────────────────────
      // Para rodar localmente, você precisa de uma chave da API Anthropic.
      // Crie um arquivo .env na raiz do projeto com:
      //   REACT_APP_ANTHROPIC_API_KEY=sk-ant-...
      //
      // Atenção: em produção, nunca exponha a chave no frontend.
      // Use um backend (Node.js/Express) como proxy para a API.
      // ─────────────────────────────────────────────────────────────────────
      const apiKey = process.env.REACT_APP_ANTHROPIC_API_KEY || "";

      if (!apiKey) {
        setMsgs((m) => [
          ...m,
          {
            role: "assistant",
            content:
              "⚠️ Chave da API não configurada. Crie um arquivo .env na raiz do projeto com REACT_APP_ANTHROPIC_API_KEY=sua-chave. Veja o README para instruções.",
          },
        ]);
        setLoading(false);
        return;
      }

      const systemPrompt = `Você é um assistente especializado em documentos públicos municipais brasileiros, consórcios intermunicipais e manifestações de interesse. Ajude a redigir, corrigir e melhorar documentos formais com linguagem jurídica e administrativa adequada. Responda sempre em português brasileiro. Conteúdo atual do documento: ${docContext?.slice(0, 800) || "(nenhum conteúdo ainda)"}`;

      const history = msgs.map((m) => ({ role: m.role, content: m.content }));
      history.push({ role: "user", content: userMsg });

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: systemPrompt,
          messages: history,
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const text = data.content?.map((b) => b.text || "").join("") || "Sem resposta.";
      setMsgs((m) => [...m, { role: "assistant", content: text }]);
    } catch (err) {
      setMsgs((m) => [
        ...m,
        { role: "assistant", content: `Erro: ${err.message}` },
      ]);
    }
    setLoading(false);
  };

  const sugestoes = [
    "Redija um parágrafo de abertura formal para manifestação de interesse",
    "Crie uma cláusula de prazo e vigência de 90 dias",
    "Sugira texto para justificativa do interesse do consórcio",
    "Como estruturar o objeto da parceria com o município?",
    "Escreva um parágrafo de encerramento formal com saudações",
    "Crie uma cláusula de confidencialidade",
  ];

  return (
    <div style={S.card}>
      <div style={S.sectionTitle}>🤖 Assistente de redação (IA)</div>
      <div style={{ minHeight: 200, maxHeight: 340, overflowY: "auto", marginBottom: 10 }}>
        {msgs.length === 0 ? (
          <div>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 10 }}>
              Peça ajuda para redigir ou melhorar o documento. Sugestões rápidas:
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {sugestoes.map((s, i) => (
                <button
                  key={i}
                  onClick={() => send(s)}
                  style={{
                    ...S.btn, fontSize: 11, textAlign: "left",
                    padding: "6px 10px", display: "block",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          msgs.map((m, i) => (
            <div
              key={i}
              style={{
                marginBottom: 10,
                display: "flex",
                justifyContent: m.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  maxWidth: "85%", padding: "8px 12px",
                  borderRadius: 10, fontSize: 12, lineHeight: 1.7,
                  whiteSpace: "pre-wrap",
                  background:
                    m.role === "user"
                      ? "var(--color-text-primary)"
                      : "var(--color-background-secondary)",
                  color:
                    m.role === "user"
                      ? "var(--color-background-primary)"
                      : "var(--color-text-primary)",
                }}
              >
                {m.content}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)", padding: "4px 0" }}>
            ✍ Redigindo...
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          style={{ ...S.input, flex: 1 }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Peça ajuda para redigir o documento... (Enter para enviar)"
        />
        <button style={S.btnPrimary} onClick={() => send()} disabled={loading}>
          Enviar
        </button>
      </div>
    </div>
  );
}

// ─── APP PRINCIPAL ────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("editor");
  const [municipios, setMunicipios] = useState(initialMunicipios);
  const [search, setSearch] = useState("");
  const [docHtml, setDocHtml] = useState("");
  const [consorcio, setConsorcio] = useState({
    nome: "", sigla: "", cnpj: "", endereco: "", site: "", email: "", logo: "",
  });
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null);
  const [selectedMuni, setSelectedMuni] = useState(initialMunicipios[0]);
  const [signs, setSigns] = useState({});
  const [licitacaoForm, setLicitacaoForm] = useState(getInitialLicitacaoFormValues);
  const [exportandoPdf, setExportandoPdf] = useState(false);
  const [contratoSelecionado, setContratoSelecionado] = useState(null);
  const [contratosBusca, setContratosBusca] = useState("");
  const [contratosData, setContratosData] = useState("");
  const [novoMunicipioNome, setNovoMunicipioNome] = useState("");
  const [novoMunicipioEmail, setNovoMunicipioEmail] = useState("");
  const [editandoMunicipioId, setEditandoMunicipioId] = useState(null);
  const [edicaoMunicipioNome, setEdicaoMunicipioNome] = useState("");
  const [edicaoMunicipioEmail, setEdicaoMunicipioEmail] = useState("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(MUNICIPIOS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) return;

      const restored = parsed
        .filter((item) => item && typeof item === "object")
        .map((item, index) => {
          const fallback = initialMunicipios[index] || {};
          const nome = typeof item.nome === "string" ? item.nome : fallback.nome;
          const token = typeof item.token === "string" ? item.token : gerarToken(nome || `municipio-${index}`);
          const activateAtDate = new Date(item.activateAt);
          const activateAt = Number.isNaN(activateAtDate.getTime())
            ? fallback.activateAt || gerarHorario(index)
            : activateAtDate;

          return {
            id: typeof item.id === "number" ? item.id : index,
            nome: nome || `Município ${index + 1}`,
            email: typeof item.email === "string" ? item.email : fallback.email || "",
            token,
            activateAt,
            status: item.status === "enviado" || item.status === "assinado" ? item.status : "pendente",
            signedAt: typeof item.signedAt === "string" ? item.signedAt : null,
            geo: item.geo && typeof item.geo === "object" ? item.geo : null,
            hash: typeof item.hash === "string" ? item.hash : null,
          };
        });

      if (restored.length > 0) {
        setMunicipios(restored);
        setSelectedMuni(restored[0]);
      }
    } catch {
      // Ignora erro de leitura da lista de municípios para não interromper o fluxo.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(MUNICIPIOS_STORAGE_KEY, JSON.stringify(municipios));
    } catch {
      // Ignora erro de persistência (ex.: storage indisponível).
    }
  }, [municipios]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LICITACAO_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;

      setLicitacaoForm((prev) => {
        const next = { ...prev };
        LICITACAO_AUTO_FIELDS.forEach((field) => {
          const value = parsed[field.key];
          if (typeof value === "string") next[field.key] = value;
        });
        return next;
      });
    } catch {
      // Ignora erro de leitura de rascunho para não interromper o fluxo.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(LICITACAO_STORAGE_KEY, JSON.stringify(licitacaoForm));
    } catch {
      // Ignora erro de persistência (ex.: storage indisponível).
    }
  }, [licitacaoForm]);

  const showToast = useCallback((msg, dur = 2800) => {
    setToast(msg);
    setTimeout(() => setToast(null), dur);
  }, []);

  const stats = {
    enviados: municipios.filter((m) => m.status !== "pendente").length,
    assinados: municipios.filter((m) => m.status === "assinado").length,
    pendentes: municipios.filter((m) => m.status === "pendente").length,
  };

  const totalMunicipios = municipios.length;
  const pct = totalMunicipios === 0 ? 0 : Math.round((stats.assinados / totalMunicipios) * 100);

  const cadastrarMunicipio = () => {
    const nome = novoMunicipioNome.trim();
    const email = novoMunicipioEmail.trim().toLowerCase();

    if (!nome || !email) {
      showToast("⚠️ Informe nome do município e e-mail");
      return;
    }

    const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailValido) {
      showToast("⚠️ Informe um e-mail válido");
      return;
    }

    const nomeDuplicado = municipios.some((m) => m.nome.toLowerCase() === nome.toLowerCase());
    if (nomeDuplicado) {
      showToast("⚠️ Esse município já está cadastrado");
      return;
    }

    const emailDuplicado = municipios.some((m) => m.email.toLowerCase() === email);
    if (emailDuplicado) {
      showToast("⚠️ Esse e-mail já está cadastrado");
      return;
    }

    const novoId = municipios.length ? Math.max(...municipios.map((m) => m.id)) + 1 : 0;
    const novo = {
      id: novoId,
      nome,
      email,
      token: gerarToken(nome),
      activateAt: gerarHorario(municipios.length),
      status: "pendente",
      signedAt: null,
      geo: null,
      hash: null,
    };

    setMunicipios((prev) => [...prev, novo]);
    setNovoMunicipioNome("");
    setNovoMunicipioEmail("");
    showToast(`✅ Município cadastrado: ${nome}`);
  };

  const iniciarEdicaoMunicipio = (muni) => {
    setEditandoMunicipioId(muni.id);
    setEdicaoMunicipioNome(muni.nome);
    setEdicaoMunicipioEmail(muni.email);
  };

  const cancelarEdicaoMunicipio = () => {
    setEditandoMunicipioId(null);
    setEdicaoMunicipioNome("");
    setEdicaoMunicipioEmail("");
  };

  const salvarEdicaoMunicipio = () => {
    if (editandoMunicipioId === null) return;

    const nome = edicaoMunicipioNome.trim();
    const email = edicaoMunicipioEmail.trim().toLowerCase();

    if (!nome || !email) {
      showToast("⚠️ Informe nome do município e e-mail");
      return;
    }

    const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailValido) {
      showToast("⚠️ Informe um e-mail válido");
      return;
    }

    const nomeDuplicado = municipios.some(
      (m) => m.id !== editandoMunicipioId && m.nome.toLowerCase() === nome.toLowerCase()
    );
    if (nomeDuplicado) {
      showToast("⚠️ Esse município já está cadastrado");
      return;
    }

    const emailDuplicado = municipios.some(
      (m) => m.id !== editandoMunicipioId && m.email.toLowerCase() === email
    );
    if (emailDuplicado) {
      showToast("⚠️ Esse e-mail já está cadastrado");
      return;
    }

    setMunicipios((prev) =>
      prev.map((m) => (m.id === editandoMunicipioId ? { ...m, nome, email } : m))
    );

    if (selectedMuni?.id === editandoMunicipioId) {
      setSelectedMuni((prev) => (prev ? { ...prev, nome, email } : prev));
    }
    if (contratoSelecionado?.id === editandoMunicipioId) {
      setContratoSelecionado((prev) => (prev ? { ...prev, nome, email } : prev));
    }

    cancelarEdicaoMunicipio();
    showToast("✅ Município atualizado");
  };

  const excluirMunicipio = (muni) => {
    if (municipios.length <= 1) {
      showToast("⚠️ Não é possível excluir o último município");
      return;
    }

    const confirmed = window.confirm(`Excluir o município ${muni.nome}?`);
    if (!confirmed) return;

    const restantes = municipios.filter((m) => m.id !== muni.id);
    setMunicipios(restantes);
    setSigns((prev) => {
      const next = { ...prev };
      delete next[muni.id];
      return next;
    });

    if (selectedMuni?.id === muni.id) {
      setSelectedMuni(restantes[0] || null);
    }
    if (contratoSelecionado?.id === muni.id) {
      setContratoSelecionado(null);
    }
    if (editandoMunicipioId === muni.id) {
      cancelarEdicaoMunicipio();
    }

    showToast(`🗑️ Município removido: ${muni.nome}`);
  };

  const enviarUm = (id) => {
    setMunicipios((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: "enviado" } : m))
    );
    showToast(`📨 Enviado para ${municipios.find((m) => m.id === id)?.nome}`);
  };

  const enviarTodos = () => {
    setModal(null);
    let i = 0;
    const interval = setInterval(() => {
      if (i >= municipios.length) {
        clearInterval(interval);
        showToast("✅ Todos os links foram enviados!");
        return;
      }
      setMunicipios((prev) =>
        prev.map((m, idx) => (idx === i ? { ...m, status: "enviado" } : m))
      );
      i++;
    }, 55);
  };

  const handleSign = (muniId, sigData) => {
    setMunicipios((prev) =>
      prev.map((m) =>
        m.id === muniId
          ? {
              ...m,
              status: "assinado",
              signedAt: sigData.at,
              geo: { lat: sigData.lat, lon: sigData.lon },
              hash: sigData.hash,
            }
          : m
      )
    );
    setSigns((prev) => ({ ...prev, [muniId]: sigData }));
    showToast(`✅ ${municipios.find((m) => m.id === muniId)?.nome} assinou!`);
  };

  const copyLink = (muni) => {
    const url = `https://manifestacao.seudominio.com.br/assinar/${muni.token}`;
    navigator.clipboard?.writeText(url);
    showToast(`🔗 Link copiado: ${muni.nome}`);
  };

  const filtered = municipios.filter((m) =>
    m.nome.toLowerCase().includes(search.toLowerCase())
  );

  const abrirModalCamposLicitacao = () => {
    if (!docHtml?.trim()) {
      showToast("⚠️ Insira o modelo de licitação antes de preencher os campos");
      return;
    }

    const baseValues = getInitialLicitacaoFormValues();
    setLicitacaoForm((prev) => ({
      ...baseValues,
      ...prev,
      municipio: selectedMuni?.nome || prev.municipio || baseValues.municipio,
      data: prev.data || new Date().toLocaleDateString("pt-BR"),
    }));
    setModal("campos-licitacao");
  };

  const confirmarCamposLicitacao = () => {
    const hasTokens = LICITACAO_AUTO_FIELDS.some((field) =>
      (docHtml || "").includes(field.token)
    );

    if (!hasTokens) {
      showToast("⚠️ Esse documento não contém marcadores automáticos de licitação");
      return;
    }

    const values = LICITACAO_AUTO_FIELDS.reduce((acc, field) => {
      const rawValue = licitacaoForm[field.key];
      acc[field.token] = (rawValue || field.defaultValue || "").trim();
      return acc;
    }, {});

    setDocHtml((current) => applyTemplateFieldValues(current, values));
    setModal(null);
    showToast("✅ Campos automáticos preenchidos");
  };

  const abrirDocumentoAssinado = (muni) => {
    setSelectedMuni(muni);
    setContratoSelecionado(muni);
    setTab("preview");
    showToast(`📄 Abrindo documento assinado de ${muni.nome}`);
  };

  const abrirContratoAssinado = (muni) => {
    setContratoSelecionado(muni);
    setSelectedMuni(muni);
    setTab("preview");
    showToast(`📄 Contrato assinado aberto: ${muni.nome}`);
  };

  const contratosAssinados = municipios
    .filter((m) => m.status === "assinado")
    .filter((m) => m.nome.toLowerCase().includes(contratosBusca.toLowerCase()))
    .filter((m) => {
      if (!contratosData) return true;
      return new Date(m.signedAt).toLocaleDateString("en-CA") === contratosData;
    })
    .sort((a, b) => new Date(b.signedAt) - new Date(a.signedAt));

  const exportarAssinaturasPdf = async () => {
    const assinados = municipios.filter((m) => m.status === "assinado");
    if (assinados.length === 0) {
      showToast("⚠️ Nenhuma assinatura disponível para exportação");
      return;
    }

    setExportandoPdf(true);
    try {
      const [headerDataUrl, footerDataUrl] = await Promise.all([
        imageUrlToDataUrl(TIMBRADO_HEADER_SRC),
        imageUrlToDataUrl(TIMBRADO_FOOTER_SRC),
      ]);

      const pdf = new jsPDF({ unit: "pt", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const marginX = 44;
      const headerW = pageW - marginX * 2;
      const headerH = (headerW * 309) / 2319;
      const footerW = pageW - marginX * 2;
      const footerH = (footerW * 292) / 2319;

      const addTimbrado = () => {
        pdf.addImage(headerDataUrl, "PNG", marginX, 18, headerW, headerH);
        pdf.addImage(footerDataUrl, "PNG", marginX, pageH - footerH - 18, footerW, footerH);
      };

      const writeWrapped = (text, yStart, fontSize = 11) => {
        pdf.setFont("times", "normal");
        pdf.setFontSize(fontSize);
        const lines = pdf.splitTextToSize(text || "", pageW - marginX * 2);
        let y = yStart;
        lines.forEach((line) => {
          if (y > pageH - footerH - 44) {
            pdf.addPage();
            addTimbrado();
            y = headerH + 56;
            pdf.setFont("times", "normal");
            pdf.setFontSize(fontSize);
          }
          pdf.text(line, marginX, y);
          y += 15;
        });
        return y;
      };

      const documentoTexto = htmlToPlainText(docHtml) || "Documento sem conteúdo no editor.";

      assinados.forEach((m, index) => {
        if (index > 0) pdf.addPage();
        addTimbrado();

        let y = headerH + 54;
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(14);
        pdf.text("Documento Assinado - Manifestação Municipal", marginX, y);
        y += 24;

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(11);
        pdf.text(`Município: ${m.nome}`, marginX, y);
        y += 15;
        pdf.text(`Data da assinatura: ${new Date(m.signedAt).toLocaleString("pt-BR")}`, marginX, y);
        y += 15;
        pdf.text(`Geolocalização: ${m.geo?.lat?.toFixed(6)}, ${m.geo?.lon?.toFixed(6)}`, marginX, y);
        y += 15;
        pdf.text(`Hash: ${m.hash || "-"}`, marginX, y);
        y += 22;

        pdf.setFont("helvetica", "bold");
        pdf.text("Conteúdo do documento:", marginX, y);
        y += 16;

        y = writeWrapped(documentoTexto, y, 11);

        y += 12;
        if (y > pageH - footerH - 44) {
          pdf.addPage();
          addTimbrado();
          y = headerH + 56;
        }

        pdf.setDrawColor(45, 106, 45);
        pdf.setFillColor(244, 251, 244);
        pdf.roundedRect(marginX, y, pageW - marginX * 2, 64, 4, 4, "FD");
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(31, 98, 31);
        pdf.setFontSize(11);
        pdf.text("DOCUMENTO ASSINADO ELETRONICAMENTE", marginX + 10, y + 21);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(40, 40, 40);
        pdf.text("Registro com data, hora, geolocalização e hash de validação.", marginX + 10, y + 39);
      });

      const dateStamp = new Date().toISOString().slice(0, 10);
      pdf.save(`assinaturas-municipios-${dateStamp}.pdf`);
      showToast("✅ PDF gerado com sucesso");
    } catch (err) {
      showToast("❌ Falha ao gerar PDF");
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setExportandoPdf(false);
    }
  };

  const limparRascunhoCamposLicitacao = () => {
    const defaults = getInitialLicitacaoFormValues();
    setLicitacaoForm({
      ...defaults,
      municipio: selectedMuni?.nome || defaults.municipio,
      data: new Date().toLocaleDateString("pt-BR"),
    });
    try {
      window.localStorage.removeItem(LICITACAO_STORAGE_KEY);
    } catch {
      // Ignora erro de limpeza de storage.
    }
    showToast("🧹 Rascunho do formulário limpo");
  };

  const exportarContratoIndividualPdf = async (muni) => {
    if (!muni?.hash || muni.status !== "assinado") {
      showToast("⚠️ Contrato não está assinado");
      return;
    }

    setExportandoPdf(true);
    try {
      const [headerDataUrl, footerDataUrl] = await Promise.all([
        imageUrlToDataUrl(TIMBRADO_HEADER_SRC),
        imageUrlToDataUrl(TIMBRADO_FOOTER_SRC),
      ]);

      const pdf = new jsPDF({ unit: "pt", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const marginX = 44;
      const headerW = pageW - marginX * 2;
      const headerH = (headerW * 309) / 2319;
      const footerW = pageW - marginX * 2;
      const footerH = (footerW * 292) / 2319;

      pdf.addImage(headerDataUrl, "PNG", marginX, 18, headerW, headerH);
      pdf.addImage(footerDataUrl, "PNG", marginX, pageH - footerH - 18, footerW, footerH);

      let y = headerH + 54;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.text("Contrato Assinado", marginX, y);
      y += 24;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);
      pdf.text(`Município: ${muni.nome}`, marginX, y);
      y += 15;
      pdf.text(`Data da assinatura: ${new Date(muni.signedAt).toLocaleString("pt-BR")}`, marginX, y);
      y += 15;
      pdf.text(`Geolocalização: ${muni.geo?.lat?.toFixed(6)}, ${muni.geo?.lon?.toFixed(6)}`, marginX, y);
      y += 15;
      pdf.text(`Hash: ${muni.hash || "-"}`, marginX, y);
      y += 22;

      pdf.setFont("helvetica", "bold");
      pdf.text("Conteúdo do documento:", marginX, y);
      y += 16;

      const documentoTexto = htmlToPlainText(docHtml) || "Documento sem conteúdo no editor.";
      const linhas = pdf.splitTextToSize(documentoTexto, pageW - marginX * 2);
      pdf.setFont("times", "normal");
      pdf.setFontSize(11);
      linhas.forEach((line) => {
        if (y > pageH - footerH - 44) {
          pdf.addPage();
          pdf.addImage(headerDataUrl, "PNG", marginX, 18, headerW, headerH);
          pdf.addImage(footerDataUrl, "PNG", marginX, pageH - footerH - 18, footerW, footerH);
          y = headerH + 56;
        }
        pdf.text(line, marginX, y);
        y += 15;
      });

      const stamp = new Date().toISOString().slice(0, 10);
      pdf.save(`contrato-assinado-${muni.nome.toLowerCase().replace(/\s+/g, "-")}-${stamp}.pdf`);
      showToast(`✅ PDF do contrato gerado: ${muni.nome}`);
    } catch (err) {
      showToast("❌ Falha ao exportar contrato");
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setExportandoPdf(false);
    }
  };

  const TABS = [
    { id: "editor",     label: "✏️ Editor de Documento" },
    { id: "municipios", label: "🏛 Municípios" },
    { id: "assinatura", label: "✍ Assinatura" },
    { id: "preview",    label: "📄 Prévia do Documento" },
    { id: "contratos",   label: "📑 Contratos Assinados" },
    { id: "registro",   label: "📋 Registro" },
  ];

  return (
    <div style={S.app}>
      {/* Cabeçalho */}
      <div style={S.header}>
        <div style={S.logo}>🏛</div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 500 }}>
            Manifestação de Interesse Municipal
          </div>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
            Envio, assinatura digital e registro com geolocalização — {totalMunicipios} municípios
          </div>
        </div>
        <button
          style={{ ...S.btnPrimary, marginLeft: "auto" }}
          onClick={() => setModal("enviar-todos")}
        >
          📨 Enviar para todos
        </button>
      </div>

      {/* Cards de estatísticas */}
      <div style={S.statsGrid}>
        <div style={S.statCard}>
          <div style={S.statNum}>{totalMunicipios}</div>
          <div style={S.statLabel}>Municípios</div>
        </div>
        <div style={S.statCard}>
          <div style={{ ...S.statNum, color: "var(--color-text-info)" }}>
            {stats.enviados}
          </div>
          <div style={S.statLabel}>Enviados</div>
        </div>
        <div style={S.statCard}>
          <div style={{ ...S.statNum, color: "var(--color-text-success)" }}>
            {stats.assinados}
          </div>
          <div style={S.statLabel}>Assinados</div>
        </div>
        <div style={S.statCard}>
          <div style={{ ...S.statNum, color: "var(--color-text-warning)" }}>
            {stats.pendentes}
          </div>
          <div style={S.statLabel}>Pendentes</div>
        </div>
      </div>

      {/* Barra de progresso */}
      <div style={S.progress}>
        <div style={S.progressFill(pct)} />
      </div>

      {/* Abas */}
      <div style={S.tabBar}>
        {TABS.map((t) => (
          <button key={t.id} style={S.tab(tab === t.id)} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── ABA: EDITOR ── */}
      {tab === "editor" && (
        <div>
          <div style={S.card}>
            <div style={S.sectionTitle}>Dados do consórcio (timbrado do documento)</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                ["nome",     "Nome completo do consórcio"],
                ["sigla",    "Sigla / abreviação"],
                ["cnpj",     "CNPJ"],
                ["endereco", "Endereço completo"],
                ["site",     "Site institucional"],
                ["email",    "E-mail institucional"],
              ].map(([k, ph]) => (
                <input
                  key={k}
                  style={S.input}
                  placeholder={ph}
                  value={consorcio[k]}
                  onChange={(e) =>
                    setConsorcio((p) => ({ ...p, [k]: e.target.value }))
                  }
                />
              ))}
            </div>
          </div>

          <div style={S.card}>
            <div style={{
              display: "flex", alignItems: "center",
              justifyContent: "space-between", marginBottom: 10,
            }}>
              <div style={S.sectionTitle}>Corpo do documento</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  style={S.btn}
                  onClick={() => {
                    const template = buildManifestacaoTemplate(consorcio.nome || "CONSÓRCIO INTERMUNICIPAL");
                    setDocHtml(template);
                    showToast("🧾 Modelo oficial aplicado");
                  }}
                >
                  🧾 Inserir modelo oficial
                </button>
                <button
                  style={S.btn}
                  onClick={() => {
                    const template = buildLicitacaoTemplate(consorcio.nome || "CONSÓRCIO INTERMUNICIPAL");
                    setDocHtml(template);
                    showToast("🏛 Modelo de licitação aplicado");
                  }}
                >
                  🏛 Inserir modelo licitação
                </button>
                <button style={S.btn} onClick={abrirModalCamposLicitacao}>
                  🧩 Preencher campos automáticos
                </button>
                  <button
                    style={S.btn}
                    onClick={() => {
                      setDocHtml((current) => {
                        const improved = normalizeDocumentHtml(current);
                        showToast("✨ Documento normalizado para padrão web");
                        return improved;
                      });
                    }}
                  >
                    ✨ Melhorar texto colado
                  </button>
                  <button
                    style={S.btn}
                    onClick={() => {
                      setDocHtml((current) => {
                        const improved = refineFormalLanguage(current);
                        showToast("⚖️ Linguagem ajustada para tom formal");
                        return improved;
                      });
                    }}
                  >
                    ⚖️ Ajustar linguagem formal
                  </button>
                  <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                    📋 Cole direto do Word e clique em Melhorar
                  </div>
              </div>
            </div>
            <RichEditor
              value={docHtml}
              onChange={setDocHtml}
              placeholder="Cole aqui o texto criado no Word, ou redija diretamente. Use a barra de ferramentas acima para formatar. O botão '✍ Campo de assinatura' insere o bloco de assinatura digital no lugar certo do documento."
            />
          </div>

          <AIAssistant docContext={docHtml?.replace(/<[^>]+>/g, "")} />
        </div>
      )}

      {/* ── ABA: MUNICÍPIOS ── */}
      {tab === "municipios" && (
        <div>
          <div style={{ ...S.card, marginBottom: 12 }}>
            <div style={S.sectionTitle}>Cadastrar município</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8 }}>
              <input
                style={S.input}
                placeholder="Nome do município"
                value={novoMunicipioNome}
                onChange={(e) => setNovoMunicipioNome(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && cadastrarMunicipio()}
              />
              <input
                style={S.input}
                placeholder="email@municipio.mg.gov.br"
                value={novoMunicipioEmail}
                onChange={(e) => setNovoMunicipioEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && cadastrarMunicipio()}
              />
              <button
                style={{ ...S.btnPrimary, justifyContent: "center" }}
                onClick={cadastrarMunicipio}
              >
                ➕ Cadastrar
              </button>
            </div>
            {editandoMunicipioId !== null && (
              <div style={{ marginTop: 10, borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: 10 }}>
                <div style={{ ...S.sectionTitle, fontSize: 13, marginBottom: 8 }}>Editar município</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto auto", gap: 8 }}>
                  <input
                    style={S.input}
                    placeholder="Nome do município"
                    value={edicaoMunicipioNome}
                    onChange={(e) => setEdicaoMunicipioNome(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && salvarEdicaoMunicipio()}
                  />
                  <input
                    style={S.input}
                    placeholder="email@municipio.mg.gov.br"
                    value={edicaoMunicipioEmail}
                    onChange={(e) => setEdicaoMunicipioEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && salvarEdicaoMunicipio()}
                  />
                  <button
                    style={{ ...S.btnPrimary, justifyContent: "center" }}
                    onClick={salvarEdicaoMunicipio}
                  >
                    💾 Salvar
                  </button>
                  <button
                    style={{ ...S.btn, justifyContent: "center" }}
                    onClick={cancelarEdicaoMunicipio}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
            <input
              style={{ ...S.input, maxWidth: 300 }}
              placeholder="Buscar município..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginLeft: "auto" }}>
              Horários de ativação escalonados automaticamente
            </div>
          </div>
          <div style={S.card}>
            <div style={{ maxHeight: 520, overflowY: "auto" }}>
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 140px 90px 130px",
                gap: 8, padding: "6px 0",
                fontSize: 11, color: "var(--color-text-tertiary)",
                borderBottom: "0.5px solid var(--color-border-tertiary)",
                marginBottom: 4,
              }}>
                <span>Município</span>
                <span style={{ textAlign: "center" }}>Ativação do link</span>
                <span style={{ textAlign: "center" }}>Status</span>
                <span style={{ textAlign: "center" }}>Ações</span>
              </div>
              {filtered.map((m) => (
                <div
                  key={m.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 140px 90px 130px",
                    alignItems: "center", gap: 8,
                    padding: "9px 0",
                    borderBottom: "0.5px solid var(--color-border-tertiary)",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{m.nome}</div>
                    <div style={{ fontSize: 10, color: "var(--color-text-tertiary)" }}>
                      {m.email}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--color-text-secondary)", textAlign: "center" }}>
                    {m.activateAt.toLocaleString("pt-BR", {
                      day: "2-digit", month: "2-digit",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <span style={S.badge(m.status)}>
                      {m.status === "pendente"
                        ? "Pendente"
                        : m.status === "enviado"
                        ? "Enviado"
                        : "Assinado"}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                    <button
                      style={S.btnSm}
                      onClick={() => copyLink(m)}
                      title="Copiar link"
                    >
                      🔗
                    </button>
                    <button
                      style={S.btnSm}
                      onClick={() => { setSelectedMuni(m); setTab("assinatura"); }}
                      title="Simular assinatura"
                    >
                      ✍
                    </button>
                    <button
                      style={S.btnSm}
                      onClick={() => iniciarEdicaoMunicipio(m)}
                      title="Editar município"
                    >
                      ✏️
                    </button>
                    <button
                      style={{ ...S.btnSm, color: "var(--color-text-danger)" }}
                      onClick={() => excluirMunicipio(m)}
                      title="Excluir município"
                    >
                      🗑️
                    </button>
                    {m.status === "pendente" && (
                      <button
                        style={{ ...S.btnSm, color: "var(--color-text-info)" }}
                        onClick={() => enviarUm(m.id)}
                        title="Enviar link"
                      >
                        📨
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── ABA: ASSINATURA ── */}
      {tab === "assinatura" && (
        <div>
          <div style={{ ...S.card, marginBottom: 12 }}>
            <div style={S.sectionTitle}>Selecionar município para simulação</div>
            <select
              style={{ ...S.input, maxWidth: 320 }}
              value={selectedMuni?.id}
              onChange={(e) =>
                setSelectedMuni(
                  municipios.find((m) => m.id === Number(e.target.value))
                )
              }
            >
              {municipios.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome} {signs[m.id] ? "✅" : ""}
                </option>
              ))}
            </select>
          </div>
          <PainelAssinatura
            municipio={selectedMuni}
            totalMunicipios={totalMunicipios}
            onSign={(sig) => handleSign(selectedMuni.id, sig)}
          />
        </div>
      )}

      {/* ── ABA: PRÉVIA ── */}
      {tab === "preview" && (
        <div>
          <div style={{ ...S.card, marginBottom: 12 }}>
            <div style={S.sectionTitle}>Município para prévia do documento</div>
            <select
              style={{ ...S.input, maxWidth: 320 }}
              value={selectedMuni?.id}
              onChange={(e) =>
                setSelectedMuni(
                  municipios.find((m) => m.id === Number(e.target.value))
                )
              }
            >
              {municipios.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome} {signs[m.id] ? "✅" : ""}
                </option>
              ))}
            </select>
          </div>
          <DocPreview
            municipio={selectedMuni?.nome}
            docHtml={docHtml}
            signData={signs[contratoSelecionado?.id || selectedMuni?.id] || null}
          />
        </div>
      )}

      {/* ── ABA: CONTRATOS ASSINADOS ── */}
      {tab === "contratos" && (
        <div>
          <div style={S.card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
              <div>
                <div style={S.sectionTitle}>Contratos assinados</div>
                <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                  Visualize, filtre e exporte cada contrato individualmente.
                </div>
              </div>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                {contratosAssinados.length} contrato(s) exibido(s)
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: 8, marginBottom: 12 }}>
              <input
                style={S.input}
                placeholder="Buscar contrato por município..."
                value={contratosBusca}
                onChange={(e) => setContratosBusca(e.target.value)}
              />
              <input
                style={S.input}
                type="date"
                value={contratosData}
                onChange={(e) => setContratosData(e.target.value)}
              />
            </div>

            {stats.assinados === 0 ? (
              <div style={{ textAlign: "center", padding: "2.5rem", color: "var(--color-text-tertiary)" }}>
                <div style={{ fontSize: 36 }}>📭</div>
                <div style={{ marginTop: 10, fontSize: 13 }}>Nenhum contrato assinado ainda.</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>Assine um município para liberar a visualização e exportação.</div>
              </div>
            ) : contratosAssinados.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2.5rem", color: "var(--color-text-tertiary)" }}>
                <div style={{ fontSize: 36 }}>🔎</div>
                <div style={{ marginTop: 10, fontSize: 13 }}>Nenhum contrato corresponde ao filtro atual.</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>Tente ajustar a busca ou limpar a data.</div>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {contratosAssinados.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "160px 1fr auto",
                      gap: 12,
                      alignItems: "stretch",
                      padding: 12,
                      border: "0.5px solid var(--color-border-tertiary)",
                      borderRadius: 10,
                      background: "var(--color-background-primary)",
                    }}
                  >
                    <div style={{ border: "0.5px solid var(--color-border-tertiary)", borderRadius: 8, overflow: "hidden", background: "#fff", minHeight: 120 }}>
                      <div style={{ background: "#f7f9fb", borderBottom: "0.5px solid var(--color-border-tertiary)", padding: 8 }}>
                        <img src={TIMBRADO_HEADER_SRC} alt="Prévia do timbrado" style={{ width: "100%", height: 28, objectFit: "cover", display: "block" }} />
                      </div>
                      <div style={{ padding: 10, fontSize: 10, color: "#333", lineHeight: 1.45 }}>
                        <div style={{ fontWeight: 700, marginBottom: 4 }}>Contrato assinado</div>
                        <div>{m.nome}</div>
                        <div>{new Date(m.signedAt).toLocaleDateString("pt-BR")}</div>
                        <div style={{ marginTop: 6, color: "#666" }}>Clique para abrir a versão completa com timbrado oficial.</div>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{m.nome}</div>
                      <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 4 }}>
                        Assinado em {new Date(m.signedAt).toLocaleString("pt-BR")}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2 }}>
                        Hash {m.hash}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <button style={S.btnSm} onClick={() => abrirContratoAssinado(m)}>📄 Visualizar</button>
                      <button style={S.btnSm} onClick={() => exportarContratoIndividualPdf(m)} disabled={exportandoPdf}>
                        {exportandoPdf ? "⏳" : "📤"} Exportar PDF
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {stats.assinados > 0 && (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                style={{ ...S.btn, flex: 1, justifyContent: "center" }}
                onClick={exportarAssinaturasPdf}
                disabled={exportandoPdf}
              >
                {exportandoPdf ? "⏳ Gerando PDF..." : "📤 Exportar todos os contratos em PDF"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── ABA: REGISTRO ── */}
      {tab === "registro" && (
        <div>
          <div style={S.card}>
            <div style={S.sectionTitle}>
              Assinaturas recebidas ({stats.assinados} de {totalMunicipios})
            </div>
            {stats.assinados === 0 ? (
              <div style={{
                textAlign: "center", padding: "2.5rem",
                color: "var(--color-text-tertiary)",
              }}>
                <div style={{ fontSize: 36 }}>📭</div>
                <div style={{ marginTop: 10, fontSize: 13 }}>
                  Nenhuma assinatura recebida ainda.
                </div>
                <div style={{ fontSize: 11, marginTop: 4 }}>
                  Vá à aba Assinatura para simular a assinatura de um município.
                </div>
              </div>
            ) : (
              municipios
                .filter((m) => m.status === "assinado")
                .map((m) => (
                  <div
                    key={m.id}
                    style={{
                      display: "flex", gap: 12, marginBottom: 14, paddingBottom: 14,
                      borderBottom: "0.5px solid var(--color-border-tertiary)",
                    }}
                  >
                    <div style={{
                      width: 10, height: 10, borderRadius: "50%",
                      background: "var(--color-text-success)", marginTop: 4, flexShrink: 0,
                    }} />
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{m.nome}</div>
                      <div style={{
                        fontSize: 11, color: "var(--color-text-secondary)",
                        marginTop: 3, display: "flex", gap: 16, flexWrap: "wrap",
                      }}>
                        <span>📅 {new Date(m.signedAt).toLocaleString("pt-BR")}</span>
                        <span>📍 {m.geo?.lat?.toFixed(5)}, {m.geo?.lon?.toFixed(5)}</span>
                        <span style={{ fontFamily: "monospace" }}>🔐 {m.hash}</span>
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <button
                          style={{ ...S.btnSm, color: "var(--color-text-info)" }}
                          onClick={() => abrirDocumentoAssinado(m)}
                        >
                          📄 Ver contrato assinado
                        </button>
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>
          {stats.assinados > 0 && (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                style={{ ...S.btn, flex: 1, justifyContent: "center" }}
                onClick={exportarAssinaturasPdf}
                disabled={exportandoPdf}
              >
                {exportandoPdf ? "⏳ Gerando PDF..." : "📤 Exportar tudo em PDF"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── MODAL: ENVIAR TODOS ── */}
      {modal === "campos-licitacao" && (
        <div style={S.modalOverlay} onClick={() => setModal(null)}>
          <div
            style={{ ...S.modal, maxWidth: 760, maxHeight: "85vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
              🧩 Preencher campos automáticos da licitação
            </div>
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 0 }}>
              Informe os dados abaixo para substituir os marcadores do modelo de licitação no documento.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {LICITACAO_AUTO_FIELDS.map((field) => (
                <div key={field.key}>
                  <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 5 }}>
                    {field.label}
                  </div>
                  <input
                    style={S.input}
                    placeholder={field.placeholder}
                    value={licitacaoForm[field.key] || ""}
                    onChange={(e) =>
                      setLicitacaoForm((prev) => ({
                        ...prev,
                        [field.key]: e.target.value,
                      }))
                    }
                  />
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button
                style={{ ...S.btnPrimary, flex: 1, justifyContent: "center" }}
                onClick={confirmarCamposLicitacao}
              >
                ✅ Aplicar no documento
              </button>
              <button
                style={{ ...S.btn, flex: 1, justifyContent: "center" }}
                onClick={limparRascunhoCamposLicitacao}
              >
                🧹 Limpar rascunho
              </button>
              <button
                style={{ ...S.btn, flex: 1, justifyContent: "center" }}
                onClick={() => setModal(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: ENVIAR TODOS ── */}
      {modal === "enviar-todos" && (
        <div style={S.modalOverlay} onClick={() => setModal(null)}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: "1rem" }}>
              📨 Enviar para todos os municípios
            </div>
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: "1rem" }}>
              Serão gerados {totalMunicipios} links únicos com horários de ativação escalonados.
              Cada município receberá o link por e-mail.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={S.label}>Remetente</div>
              <input style={S.input} placeholder="nome@consorcio.mg.gov.br" />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={S.label}>Assunto</div>
              <input
                style={S.input}
                defaultValue="Manifestação de Interesse — Parceria com Consórcio"
              />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: "1rem" }}>
              <button
                style={{ ...S.btnPrimary, flex: 1, justifyContent: "center" }}
                onClick={enviarTodos}
              >
                🚀 Confirmar envio
              </button>
              <button
                style={{ ...S.btn, flex: 1, justifyContent: "center" }}
                onClick={() => setModal(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <div style={S.toast}>{toast}</div>}
    </div>
  );
}
