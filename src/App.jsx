import { useState, useRef, useEffect, useCallback } from "react";
import { jsPDF } from "jspdf";
import * as XLSX from "xlsx";
import QRCode from "qrcode";

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
  const normalized = String(nome || "municipio")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  // Prefixo curto ("ms:") para que a parte única do nome apareça nos primeiros 20 chars
  const base = btoa(`ms:${normalized}`)
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
  return (base || "MUNICIPIO").slice(0, 20);
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

function buildManifestacaoTemplate(consorcioNome = "CIMAG") {
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

function buildLicitacaoTemplate(consorcioNome = "CIMAG") {
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

const LICITACAO_STORAGE_KEY  = "manifestacao.licitacaoForm.v1";
const MUNICIPIOS_STORAGE_KEY = "manifestacao.municipios.v1";
const AUDITORIA_STORAGE_KEY  = "manifestacao.auditoria.v1";
const CONSORCIO_STORAGE_KEY  = "manifestacao.consorcio.v1";
const DOC_STORAGE_KEY        = "manifestacao.docHtml.v1";
const SESSION_TOKEN_KEY      = "manifestacao.apiToken";
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:4000";

const maskCnpj = (v) => {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
};

const AUDIT_LABELS = {
  "fluxo.etapa":                  "Etapa do fluxo alterada",
  "municipio.excluido":           "Município excluído",
  "municipio.adicionado":         "Município adicionado",
  "municipio.editado":            "Município editado",
  "municipio.status.massa":       "Status alterado em massa",
  "municipio.assinado":           "Município assinou",
  "municipio.enviado":            "Link de assinatura enviado",
  "municipio.enviados.todos":     "Links enviados para todos",
  "municipio.enviados.selecionados": "Links enviados (selecionados)",
  "municipio.importado":          "Importação de lista",
  "api.municipios.sincronizado":  "Sincronizado com API",
};

function buildAssinaturaLink(token) {
  const origin = window.location.origin;
  const basePath = window.location.pathname.endsWith("/")
    ? window.location.pathname.slice(0, -1)
    : window.location.pathname;
  return `${origin}${basePath || ""}/#/assinar/${encodeURIComponent(token)}`;
}

function getAssinaturaTokenFromUrl() {
  const hash = window.location.hash || "";
  const hashMatch = hash.match(/^#\/assinar\/([^/?#]+)/i);
  if (hashMatch?.[1]) return decodeURIComponent(hashMatch[1]);

  const pathMatch = window.location.pathname.match(/\/assinar\/([^/?#]+)/i);
  if (pathMatch?.[1]) return decodeURIComponent(pathMatch[1]);

  const queryToken = new URLSearchParams(window.location.search).get("token");
  return queryToken ? decodeURIComponent(queryToken) : "";
}

const EMAIL_INSTITUCIONAL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const DOMINIOS_PESSOAIS_BLOQUEADOS = [
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "yahoo.com",
  "yahoo.com.br",
  "icloud.com",
  "uol.com.br",
  "bol.com.br",
  "live.com",
];

const ETAPAS_FLUXO = [
  { id: "rascunho", label: "Rascunho" },
  { id: "revisao", label: "Revisão jurídica" },
  { id: "envio", label: "Envio" },
  { id: "assinaturas", label: "Assinaturas" },
  { id: "concluido", label: "Concluído" },
];

const PROCESSO_STATUS_OPTIONS = [
  { id: "rascunho", label: "Rascunho" },
  { id: "revisao", label: "Revisão jurídica" },
  { id: "envio", label: "Envio" },
  { id: "assinaturas", label: "Assinaturas" },
  { id: "concluido", label: "Concluído" },
];

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

function normalizeMunicipioNome(value) {
  return (value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function isInstitutionalEmail(email) {
  const normalized = (email || "").toLowerCase().trim();
  if (!EMAIL_INSTITUCIONAL_RE.test(normalized)) return false;
  const domain = normalized.split("@")[1] || "";
  if (DOMINIOS_PESSOAIS_BLOQUEADOS.includes(domain)) return false;
  return true;
}

function validateMunicipioData({ nome, email, municipios, editingId = null }) {
  const errors = { nome: "", email: "" };
  const normalizedNome = normalizeMunicipioNome(nome);
  const normalizedEmail = (email || "").trim().toLowerCase();
  const currentRow = editingId === null ? null : municipios.find((m) => m.id === editingId);
  const keepingLegacyEmail = currentRow && currentRow.email.toLowerCase() === normalizedEmail;

  if (!normalizedNome) {
    errors.nome = "Informe o nome do município";
  } else if (!/^[A-Za-zÀ-ÖØ-öø-ÿ' -]+$/.test(normalizedNome)) {
    errors.nome = "Use apenas letras, espaços, apóstrofo e hífen";
  }

  if (!normalizedEmail) {
    errors.email = "Informe o e-mail institucional";
  } else if (!isInstitutionalEmail(normalizedEmail) && !keepingLegacyEmail) {
    errors.email = "Use um e-mail institucional válido (evite provedores pessoais)";
  }

  const nomeDuplicado = municipios.some(
    (m) => m.id !== editingId && m.nome.toLowerCase() === normalizedNome.toLowerCase()
  );
  if (!errors.nome && nomeDuplicado) {
    errors.nome = "Esse município já está cadastrado";
  }

  const emailDuplicado = municipios.some(
    (m) => m.id !== editingId && m.email.toLowerCase() === normalizedEmail
  );
  if (!errors.email && emailDuplicado) {
    errors.email = "Esse e-mail já está cadastrado";
  }

  return {
    errors,
    normalizedNome,
    normalizedEmail,
    ok: !errors.nome && !errors.email,
  };
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

function formatIpDisplay(ipValue) {
  const raw = String(ipValue || "").trim();
  if (!raw) return "Não disponível";

  let ip = raw.includes(",") ? raw.split(",")[0].trim() : raw;
  if (ip.toLowerCase().startsWith("::ffff:")) ip = ip.slice(7);
  if (ip === "::1" || ip === "0:0:0:0:0:0:0:1") return "127.0.0.1";
  return ip;
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
  ip: null,
  device: null,
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
    overflowX: "auto", flex: 1,
    scrollbarWidth: "none", msOverflowStyle: "none",
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
      pendente: { bg: "var(--color-background-secondary)", c: "var(--color-text-tertiary)" },
      enviado:  { bg: "var(--color-background-info)",      c: "var(--color-text-info)" },
      assinado: { bg: "var(--color-background-success)",   c: "var(--color-text-success)" },
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
  const [wordCount, setWordCount] = useState(0);

  useEffect(() => {
    if (!ref.current) return;
    const nextValue = value || "";
    if (ref.current.innerHTML !== nextValue) {
      ref.current.innerHTML = nextValue;
    }
  }, [value]);

  const handleInput = () => {
    if (onChange) onChange(ref.current.innerHTML);
    const text = ref.current.innerText || "";
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    setWordCount(words);
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
        {/* Texto */}
        <TBtn cmd="bold"               label="N"        title="Negrito (Ctrl+B)" />
        <TBtn cmd="italic"             label="I"        title="Itálico (Ctrl+I)" />
        <TBtn cmd="underline"          label="S"        title="Sublinhado (Ctrl+U)" />
        <span style={{ width: 1, background: "var(--color-border-tertiary)", alignSelf: "stretch", margin: "0 2px" }} />
        {/* Alinhamento */}
        <TBtn cmd="justifyLeft"        label="⟵"       title="Alinhar à esquerda" />
        <TBtn cmd="justifyCenter"      label="↔"        title="Centralizar" />
        <TBtn cmd="justifyRight"       label="⟶"       title="Alinhar à direita" />
        <TBtn cmd="justifyFull"        label="≡"        title="Justificar" />
        <span style={{ width: 1, background: "var(--color-border-tertiary)", alignSelf: "stretch", margin: "0 2px" }} />
        {/* Listas */}
        <TBtn cmd="insertUnorderedList" label="• Lista" title="Lista com marcadores" />
        <TBtn cmd="insertOrderedList"  label="1. Lista" title="Lista numerada" />
        <span style={{ width: 1, background: "var(--color-border-tertiary)", alignSelf: "stretch", margin: "0 2px" }} />
        {/* Estilo de parágrafo */}
        <TBtn cmd="formatBlock" val="h2" label="Título" title="Título" />
        <TBtn cmd="formatBlock" val="h3" label="Subtítulo" title="Subtítulo" />
        <TBtn cmd="formatBlock" val="p"  label="¶ Normal" title="Parágrafo normal" />
        <span style={{ width: 1, background: "var(--color-border-tertiary)", alignSelf: "stretch", margin: "0 2px" }} />
        {/* Inserir */}
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
      <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", textAlign: "right", padding: "4px 8px", borderTop: "0.5px solid var(--color-border-tertiary)" }}>
        {wordCount} {wordCount === 1 ? "palavra" : "palavras"}
      </div>
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
            CPF: {signData.cpf || "Não informado"}<br />
            Assinado em: {new Date(signData.at).toLocaleString("pt-BR")}<br />
            TSA: {signData.tsaUtc ? `${new Date(signData.tsaUtc).toLocaleString("pt-BR")} (${signData.tsaSource || "fonte externa"})` : "não disponível"}<br />
            Geolocalização: {signData.lat?.toFixed(6)}, {signData.lon?.toFixed(6)}<br />
            IP: {formatIpDisplay(signData.ip)}<br />
            Aparelho: {signData.device || "Não disponível"}<br />
            <span style={{ fontFamily: "monospace", fontSize: 10 }}>Hash: {signData.hash}</span>
          </div>
          {signData.assinaturaDataUrl && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 10, color: "#666", marginBottom: 4 }}>Assinatura desenhada:</div>
              <img
                src={signData.assinaturaDataUrl}
                alt="Assinatura do signatário"
                style={{ maxWidth: 300, width: "100%", border: "1px solid #d4d4d4", borderRadius: 4, background: "#fff" }}
              />
            </div>
          )}
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

  const obterAparelho = () => {
    const platform = navigator.userAgentData?.platform || navigator.platform || "Plataforma desconhecida";
    const userAgent = navigator.userAgent || "User-Agent indisponível";
    return `${platform} | ${userAgent}`;
  };

  const obterIp = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/client-info`);
      const payload = await res.json();
      if (!res.ok) return "Não disponível";
      return typeof payload.ip === "string" && payload.ip.trim() ? payload.ip.trim() : "Não disponível";
    } catch {
      return "Não disponível";
    }
  };

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

  const finalizar = async (lat, lon) => {
    const [ip, device] = await Promise.all([obterIp(), Promise.resolve(obterAparelho())]);
    const sig = {
      nome: "Representante Municipal",
      cargo: "Prefeito(a) Municipal",
      at: new Date().toISOString(),
      lat,
      lon,
      ip,
      device,
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
              <div>🌐 IP {data.ip}</div>
              <div style={{ wordBreak: "break-all" }}>💻 {data.device}</div>
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
          Ao clicar, você concorda com a captura de data, hora, geolocalização, IP e aparelho
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

// ─── APP PRINCIPAL ────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("editor");
  const [municipios, setMunicipios] = useState(initialMunicipios);
  const [search, setSearch] = useState("");
  const [muniPage, setMuniPage] = useState(0);
  const [docHtml, setDocHtml] = useState("");
  const [docSavedAt, setDocSavedAt] = useState(null);
  const [consorcio, setConsorcio] = useState({
    nome: "Consórcio Intermunicipal Multifinalitário da Microrregião do Circuito das Águas",
    sigla: "CIMAG",
    cnpj: "21.406.451/0001-01",
    endereco: "Av. Camilo Soares, 100 - Caxambu/MG - CEP: 37440-000",
    site: "www.cimag.org.br",
    email: "secretaria@cimag.org.br",
    logo: "",
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
  const [novoMunicipioErrors, setNovoMunicipioErrors] = useState({ nome: "", email: "" });
  const [edicaoMunicipioErrors, setEdicaoMunicipioErrors] = useState({ nome: "", email: "" });
  const [selecionados, setSelecionados] = useState([]);
  const [editorVinculosSelecionados, setEditorVinculosSelecionados] = useState([]);
  const [editorVinculosBusca, setEditorVinculosBusca] = useState("");
  const [statusEmMassa, setStatusEmMassa] = useState("enviado");
  const [importRows, setImportRows] = useState([]);
  const [importSummary, setImportSummary] = useState(null);
  const [importFileName, setImportFileName] = useState("");
  const [etapaFluxo, setEtapaFluxo] = useState("rascunho");
  const [auditoria, setAuditoria] = useState([]);
  const [apiStatus, setApiStatus] = useState("checking");
  const [apiToken, setApiToken] = useState(() => sessionStorage.getItem(SESSION_TOKEN_KEY) || "");
  const [apiUser, setApiUser] = useState(null);
  const [apiAuth, setApiAuth] = useState({ email: "admin@consorcio.mg.gov.br", password: "" });
  const [apiDashboard, setApiDashboard] = useState(null);
  const [apiDashboardFilters, setApiDashboardFilters] = useState({ from: "", to: "", secretaria: "" });
  const [apiMunicipiosLoaded, setApiMunicipiosLoaded] = useState(false);
  const [apiSyncing, setApiSyncing] = useState(false);
  const [apiProcessos, setApiProcessos] = useState([]);
  const [apiProcessosLoading, setApiProcessosLoading] = useState(false);
  const [apiProcessosFilters, setApiProcessosFilters] = useState({ search: "", secretaria: "", status: "" });
  const [apiNovoProcesso, setApiNovoProcesso] = useState({
    numero: "",
    secretaria: "",
    titulo: "",
    status: "rascunho",
  });
  const [apiProcessoSaving, setApiProcessoSaving] = useState(false);
  const [apiProcessoSelecionadoId, setApiProcessoSelecionadoId] = useState("");
  const [apiDocumentos, setApiDocumentos] = useState([]);
  const [apiDocumentoNotes, setApiDocumentoNotes] = useState("");
  const [apiDocumentoArquivo, setApiDocumentoArquivo] = useState(null);
  const [apiDocUploading, setApiDocUploading] = useState(false);
  const [apiSlaLoading, setApiSlaLoading] = useState(false);
  const [apiSlaFilters, setApiSlaFilters] = useState({ days: "7", secretaria: "" });
  const [apiSlaData, setApiSlaData] = useState({ total: 0, items: [] });
  const [apiNotifySending, setApiNotifySending] = useState(false);
  const [apiNotify, setApiNotify] = useState({
    to: "",
    subject: "Alerta de SLA - Processos com atraso",
    html: "",
  });
  const apiDocFileInputRef = useRef(null);
  const assinaturaTokenUrl = getAssinaturaTokenFromUrl();
  const assinaturaPublicaAtiva = Boolean(assinaturaTokenUrl);
  const [assinaturaPublicaProcessando, setAssinaturaPublicaProcessando] = useState(false);
  const [assinaturaPublicaDocHtml, setAssinaturaPublicaDocHtml] = useState("");
  const [assinaturaPublicaMeta, setAssinaturaPublicaMeta] = useState(null);
  const [assinaturaPublicaCpf, setAssinaturaPublicaCpf] = useState("");
  const [assinaturaPublicaNome, setAssinaturaPublicaNome] = useState("");
  const [assinaturaPublicaAceite, setAssinaturaPublicaAceite] = useState(false);
  const [assinaturaPublicaErro, setAssinaturaPublicaErro] = useState("");
  const [assinaturaPublicaAssinaturaDataUrl, setAssinaturaPublicaAssinaturaDataUrl] = useState("");
  const [assinaturaPublicaOtpCode, setAssinaturaPublicaOtpCode] = useState("");
  const [assinaturaPublicaOtpVerifiedAt, setAssinaturaPublicaOtpVerifiedAt] = useState("");
  const [assinaturaPublicaOtpSending, setAssinaturaPublicaOtpSending] = useState(false);
  const [assinaturaPublicaOtpValidating, setAssinaturaPublicaOtpValidating] = useState(false);
  const assinaturaCanvasRef = useRef(null);
  const assinaturaCanvasDrawingRef = useRef(false);
  const tabBarRef = useRef(null);

  // ── Persistência do token de API na sessão ───────────────────────────────
  useEffect(() => {
    if (apiToken) sessionStorage.setItem(SESSION_TOKEN_KEY, apiToken);
    else sessionStorage.removeItem(SESSION_TOKEN_KEY);
  }, [apiToken]);

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
            ip: typeof item.ip === "string" ? item.ip : null,
            device: typeof item.device === "string" ? item.device : null,
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
    if (!assinaturaTokenUrl) {
      setAssinaturaPublicaDocHtml("");
      setAssinaturaPublicaMeta(null);
      setAssinaturaPublicaOtpCode("");
      setAssinaturaPublicaOtpVerifiedAt("");
      return;
    }

    const carregarDocumentoPublico = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/assinaturas/publico/${encodeURIComponent(assinaturaTokenUrl)}`);
        const raw = await res.text();
        const data = raw ? JSON.parse(raw) : {};
        if (!res.ok || !data.item) return;

        setAssinaturaPublicaMeta(data.item);
        setAssinaturaPublicaDocHtml(String(data.item.documento_html || ""));
        setAssinaturaPublicaOtpVerifiedAt(String(data.item.otp_verified_at || ""));
      } catch {
        // Mantém fallback local quando API pública não responder.
      }
    };

    carregarDocumentoPublico();
  }, [assinaturaTokenUrl]);

  const normalizeCpf = useCallback((value) => String(value || "").replace(/\D/g, "").slice(0, 11), []);

  const formatCpf = useCallback((value) => {
    const digits = normalizeCpf(value);
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }, [normalizeCpf]);

  const isValidCpf = useCallback((value) => {
    const cpf = normalizeCpf(value);
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

    const calcDigit = (slice, factor) => {
      let total = 0;
      for (const digit of slice) {
        total += Number(digit) * factor;
        factor -= 1;
      }
      const rest = (total * 10) % 11;
      return rest === 10 ? 0 : rest;
    };

    const d1 = calcDigit(cpf.slice(0, 9), 10);
    const d2 = calcDigit(cpf.slice(0, 10), 11);
    return d1 === Number(cpf[9]) && d2 === Number(cpf[10]);
  }, [normalizeCpf]);

  const setupSignatureCanvas = useCallback(() => {
    const canvas = assinaturaCanvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(320, Math.floor(canvas.clientWidth || 720));
    const height = 180;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = "#0f172a";
    setAssinaturaPublicaAssinaturaDataUrl("");
  }, []);

  useEffect(() => {
    if (!assinaturaPublicaAtiva) return;
    const tid = setTimeout(() => setupSignatureCanvas(), 0);
    return () => clearTimeout(tid);
  }, [assinaturaPublicaAtiva, setupSignatureCanvas]);

  const clearSignatureCanvas = useCallback(() => {
    setupSignatureCanvas();
    assinaturaCanvasDrawingRef.current = false;
  }, [setupSignatureCanvas]);

  const startCanvasStroke = useCallback((event) => {
    const canvas = assinaturaCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
    assinaturaCanvasDrawingRef.current = true;
  }, []);

  const moveCanvasStroke = useCallback((event) => {
    const canvas = assinaturaCanvasRef.current;
    if (!canvas || !assinaturaCanvasDrawingRef.current) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
  }, []);

  const endCanvasStroke = useCallback(() => {
    const canvas = assinaturaCanvasRef.current;
    if (!canvas) return;
    assinaturaCanvasDrawingRef.current = false;
    setAssinaturaPublicaAssinaturaDataUrl(canvas.toDataURL("image/png"));
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
      const raw = window.localStorage.getItem(AUDITORIA_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      setAuditoria(parsed.slice(0, 300));
    } catch {
      // Ignora erro de leitura da trilha de auditoria.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(AUDITORIA_STORAGE_KEY, JSON.stringify(auditoria));
    } catch {
      // Ignora erro de persistência da trilha de auditoria.
    }
  }, [auditoria]);

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

  // ── Persistência do consórcio ────────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CONSORCIO_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        setConsorcio((prev) => ({ ...prev, ...parsed }));
      }
    } catch { /* ignora */ }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(CONSORCIO_STORAGE_KEY, JSON.stringify(consorcio));
    } catch { /* ignora */ }
  }, [consorcio]);

  // ── Persistência do documento ────────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DOC_STORAGE_KEY);
      if (raw) setDocHtml(raw);
    } catch { /* ignora */ }
  }, []);

  useEffect(() => {
    if (!docHtml) return;
    const timer = setTimeout(() => {
      try {
        window.localStorage.setItem(DOC_STORAGE_KEY, docHtml);
        setDocSavedAt(new Date());
      } catch { /* ignora */ }
    }, 800);
    return () => clearTimeout(timer);
  }, [docHtml]);

  const showToast = useCallback((msg, dur = 2800) => {
    setToast(msg);
    setTimeout(() => setToast(null), dur);
  }, []);

  const registrarAuditoria = useCallback((acao, detalhes) => {
    const entry = {
      id: Date.now() + Math.random(),
      at: new Date().toISOString(),
      acao,
      detalhes,
    };
    setAuditoria((prev) => [entry, ...prev].slice(0, 300));
  }, []);

  const toApiMunicipio = useCallback((item) => ({
    id: Number(item.id),
    nome: item.nome,
    email: item.email,
    token: item.token,
    activateAt:
      item.activateAt instanceof Date
        ? item.activateAt.toISOString()
        : new Date(item.activateAt || Date.now()).toISOString(),
    status: item.status,
    signedAt: item.signedAt || null,
    geo: item.geo && typeof item.geo === "object"
      ? { lat: Number(item.geo.lat), lon: Number(item.geo.lon) }
      : null,
    ip: item.ip || null,
    device: item.device || null,
    signerCpf: item.signerCpf || null,
    signerNome: item.signerNome || null,
    signatureDataUrl: item.signatureDataUrl || null,
    documentoHtml: item.documentoHtml || null,
    hash: item.hash || null,
  }), []);

  const fromApiMunicipio = useCallback((item, index) => ({
    id: typeof item.id === "number" ? item.id : index,
    nome: item.nome || `Município ${index + 1}`,
    email: item.email || "",
    token: item.token || gerarToken(item.nome || `municipio-${index}`),
    activateAt: item.activate_at ? new Date(item.activate_at) : gerarHorario(index),
    status: item.status === "assinado" || item.status === "enviado" ? item.status : "pendente",
    signedAt: item.signed_at || null,
    geo:
      typeof item.geo_lat === "number" && typeof item.geo_lon === "number"
        ? { lat: item.geo_lat, lon: item.geo_lon }
        : null,
    ip: item.signer_ip || null,
    device: item.device_info || null,
    signerCpf: item.signer_cpf || null,
    signerNome: item.signer_nome || null,
    signatureDataUrl: item.signature_data_url || null,
    documentoHtml: item.documento_html || null,
    hash: item.hash || null,
  }), []);

  const carregarMunicipiosApi = useCallback(
    async (tokenOverride) => {
      const token = tokenOverride || apiToken;
      if (!token) return;
      const res = await fetch(`${API_BASE_URL}/api/municipios`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao carregar municípios da API");
      const items = Array.isArray(data.items) ? data.items : [];
      const mapped = items.map((item, idx) => fromApiMunicipio(item, idx));
      if (mapped.length > 0) {
        setMunicipios(mapped);
        setSelectedMuni((prev) => mapped.find((m) => m.id === prev?.id) || mapped[0]);
      }
      setApiMunicipiosLoaded(true);
    },
    [apiToken, fromApiMunicipio]
  );

  const carregarAuditoriaApi = useCallback(
    async (tokenOverride) => {
      const token = tokenOverride || apiToken;
      if (!token) return;
      const res = await fetch(`${API_BASE_URL}/api/auditoria`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao carregar auditoria da API");
      const rows = (data.items || []).map((row) => ({
        id: row.id,
        at: row.ts,
        acao: row.action,
        detalhes: `${row.resource_type}${row.signature_valid === false ? " (assinatura inválida)" : ""}`,
      }));
      setAuditoria(rows.slice(0, 300));
    },
    [apiToken]
  );

  const carregarProcessosApi = useCallback(
    async (tokenOverride) => {
      const token = tokenOverride || apiToken;
      if (!token) return;

      const qs = new URLSearchParams({ page: "1", pageSize: "50" });
      if (apiProcessosFilters.search.trim()) qs.set("search", apiProcessosFilters.search.trim());
      if (apiProcessosFilters.secretaria.trim()) qs.set("secretaria", apiProcessosFilters.secretaria.trim());
      if (apiProcessosFilters.status) qs.set("status", apiProcessosFilters.status);

      setApiProcessosLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/processos?${qs.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Falha ao carregar processos da API");
        }

        const items = Array.isArray(data.items) ? data.items : [];
        setApiProcessos(items);

        setApiProcessoSelecionadoId((prev) => {
          if (!prev) return prev;
          return items.some((item) => item.id === prev) ? prev : "";
        });
      } catch (err) {
        showToast(`❌ ${String(err.message || err)}`);
      } finally {
        setApiProcessosLoading(false);
      }
    },
    [apiProcessosFilters.search, apiProcessosFilters.secretaria, apiProcessosFilters.status, apiToken, showToast]
  );

  const carregarDocumentosProcessoApi = useCallback(
    async (processoId, tokenOverride) => {
      const token = tokenOverride || apiToken;
      if (!token || !processoId) return;
      try {
        const res = await fetch(`${API_BASE_URL}/api/processos/${processoId}/documentos`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Falha ao carregar documentos do processo");
        }
        setApiDocumentos(Array.isArray(data.items) ? data.items : []);
      } catch (err) {
        showToast(`❌ ${String(err.message || err)}`);
      }
    },
    [apiToken, showToast]
  );

  useEffect(() => {
    const checkApi = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/health`);
        setApiStatus(res.ok ? "online" : "offline");
      } catch {
        setApiStatus("offline");
      }
    };

    checkApi();
  }, []);

  useEffect(() => {
    if (!apiToken) {
      setApiMunicipiosLoaded(false);
      return;
    }

    const loadContext = async () => {
      try {
        const meRes = await fetch(`${API_BASE_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${apiToken}` },
          credentials: "include",
        });
        const meData = await meRes.json();
        if (!meRes.ok) {
          throw new Error(meData.error || "Sessão inválida");
        }
        setApiUser(meData.user);

        await carregarMunicipiosApi(apiToken);
        await carregarAuditoriaApi(apiToken);
        await carregarProcessosApi(apiToken);
      } catch (err) {
        setApiToken("");
        setApiUser(null);
        setApiMunicipiosLoaded(false);
        showToast(`❌ Sessão API encerrada: ${String(err.message || err)}`);
      }
    };

    loadContext();
  }, [apiToken, carregarAuditoriaApi, carregarMunicipiosApi, carregarProcessosApi, showToast]);

  useEffect(() => {
    if (!apiToken || !apiProcessoSelecionadoId) {
      setApiDocumentos([]);
      return;
    }
    carregarDocumentosProcessoApi(apiProcessoSelecionadoId);
  }, [apiToken, apiProcessoSelecionadoId, carregarDocumentosProcessoApi]);

  useEffect(() => {
    if (!apiToken || !apiMunicipiosLoaded) return;

    const timeoutId = setTimeout(async () => {
      try {
        setApiSyncing(true);
        await fetch(`${API_BASE_URL}/api/municipios/snapshot`, {
          method: "PUT",
          headers: {
            "content-type": "application/json",
            Authorization: `Bearer ${apiToken}`,
          },
          body: JSON.stringify({ items: municipios.map(toApiMunicipio) }),
        });
      } catch {
        // Mantém fluxo local caso API esteja indisponível momentaneamente.
      } finally {
        setApiSyncing(false);
      }
    }, 450);

    return () => clearTimeout(timeoutId);
  }, [apiMunicipiosLoaded, apiToken, municipios, toApiMunicipio]);

  const logoutBackend = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiToken}` },
        credentials: "include",
      });
    } catch {
      // Ignorar erro se logout falhar
    } finally {
      setApiToken("");
      setApiUser(null);
      setApiMunicipiosLoaded(false);
      showToast("🔒 Sessão API desconectada");
    }
  };

  const loginBackend = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/csrf-token`, {
        method: "GET",
      });
      const csrfData = await res.json();

      const res2 = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfData.token,
        },
        credentials: "include",
        body: JSON.stringify(apiAuth),
      });
      const data = await res2.json();
      if (!res2.ok) {
        showToast(`❌ Login API falhou: ${data.error || "erro"}`);
        return;
      }
      setApiToken(data.token);
      setApiUser(data.user);
      await carregarMunicipiosApi(data.token);
      await carregarAuditoriaApi(data.token);
      await carregarProcessosApi(data.token);
      showToast(`✅ API conectada como ${data.user?.nome || data.user?.email}`);
    } catch {
      showToast("❌ Não foi possível conectar na API");
    }
  };

  const criarProcessoApi = async () => {
    if (!apiToken) {
      showToast("⚠️ Faça login na API para criar processos");
      return;
    }

    const numero = apiNovoProcesso.numero.trim();
    const secretaria = apiNovoProcesso.secretaria.trim();
    const titulo = apiNovoProcesso.titulo.trim();

    if (!numero || !secretaria || !titulo) {
      showToast("⚠️ Preencha número, secretaria e título");
      return;
    }

    setApiProcessoSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/processos`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${apiToken}`,
        },
        body: JSON.stringify({
          numero,
          secretaria,
          titulo,
          status: apiNovoProcesso.status,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(`❌ Falha ao criar processo: ${data.error || "erro"}`);
        return;
      }

      setApiNovoProcesso({ numero: "", secretaria: "", titulo: "", status: apiNovoProcesso.status });
      setApiProcessoSelecionadoId(data.id || "");
      await carregarProcessosApi();
      await carregarDashboardApi();
      showToast("✅ Processo criado na API");
    } catch {
      showToast("❌ Erro ao criar processo na API");
    } finally {
      setApiProcessoSaving(false);
    }
  };

  const atualizarStatusProcessoApi = async (processoId, status) => {
    if (!apiToken || !processoId || !status) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/processos/${processoId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${apiToken}`,
        },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(`❌ Falha ao atualizar status: ${data.error || "erro"}`);
        return;
      }

      setApiProcessos((prev) => prev.map((item) => (item.id === processoId ? { ...item, status } : item)));
      setEtapaFluxo(status);
      await carregarDashboardApi();
      showToast("✅ Status do processo atualizado");
    } catch {
      showToast("❌ Erro ao atualizar status do processo");
    }
  };

  const sincronizarEtapaFluxoNoProcessoApi = async () => {
    if (!apiToken) {
      showToast("⚠️ Faça login na API para sincronizar workflow");
      return;
    }
    if (!apiProcessoSelecionadoId) {
      showToast("⚠️ Selecione um processo da API");
      return;
    }
    await atualizarStatusProcessoApi(apiProcessoSelecionadoId, etapaFluxo);
  };

  const enviarDocumentoProcessoApi = async () => {
    if (!apiToken) {
      showToast("⚠️ Faça login na API para enviar documentos");
      return;
    }
    if (!apiProcessoSelecionadoId) {
      showToast("⚠️ Selecione um processo antes do upload");
      return;
    }
    if (!apiDocumentoArquivo) {
      showToast("⚠️ Selecione um arquivo para upload");
      return;
    }

    const form = new FormData();
    form.append("arquivo", apiDocumentoArquivo);
    if (apiDocumentoNotes.trim()) {
      form.append("notes", apiDocumentoNotes.trim());
    }

    setApiDocUploading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/processos/${apiProcessoSelecionadoId}/documentos`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiToken}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(`❌ Falha no upload: ${data.error || "erro"}`);
        return;
      }

      setApiDocumentoArquivo(null);
      setApiDocumentoNotes("");
      if (apiDocFileInputRef.current) {
        apiDocFileInputRef.current.value = "";
      }
      await carregarDocumentosProcessoApi(apiProcessoSelecionadoId);
      await carregarProcessosApi();
      await carregarDashboardApi();
      showToast("✅ Documento enviado com nova versão");
    } catch {
      showToast("❌ Erro ao enviar documento");
    } finally {
      setApiDocUploading(false);
    }
  };

  const baixarDocumentoProcessoApi = async (documentoId, fallbackName, openInNewTab = false) => {
    if (!apiToken) {
      showToast("⚠️ Faça login na API para baixar documentos");
      return;
    }
    if (!documentoId) {
      showToast("⚠️ Documento inválido para download");
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/documentos/${documentoId}/download`, {
        headers: { Authorization: `Bearer ${apiToken}` },
      });

      if (!res.ok) {
        const text = await res.text();
        let errorMsg = "Erro ao baixar documento";
        try {
          const json = JSON.parse(text);
          errorMsg = json.error || errorMsg;
        } catch {
          // Mantém mensagem padrão caso retorno não seja JSON.
        }
        showToast(`❌ ${errorMsg}`);
        return;
      }

      const blob = await res.blob();
      const headerName = res.headers.get("content-disposition") || "";
      const match = headerName.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
      const extracted = decodeURIComponent(match?.[1] || match?.[2] || "");
      const fileName = extracted || fallbackName || `documento-${documentoId}.bin`;

      const url = URL.createObjectURL(blob);

      if (openInNewTab) {
        const newTab = window.open(url, "_blank", "noopener,noreferrer");
        if (newTab) {
          showToast(`👁️ Visualização aberta: ${fileName}`);
          return;
        }
      }

      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      showToast(`📥 Download concluído: ${fileName}`);
    } catch {
      showToast("❌ Falha de rede ao baixar documento");
    }
  };

  const copiarComandoDownloadDocumentoApi = async (documentoId, fallbackName) => {
    if (!apiToken) {
      showToast("⚠️ Faça login na API para copiar comando autenticado");
      return;
    }
    if (!documentoId) {
      showToast("⚠️ Documento inválido para copiar comando");
      return;
    }

    const safeName = (fallbackName || `documento-${documentoId}.bin`).replace(/"/g, "");
    const cmd = `TOKEN="seu_token_aqui" && curl -L -H "Authorization: Bearer $TOKEN" "${API_BASE_URL}/api/documentos/${documentoId}/download" -o "${safeName}"`;

    try {
      await navigator.clipboard.writeText(cmd);
      showToast("📋 Comando cURL copiado");
    } catch {
      showToast("❌ Não foi possível copiar para a área de transferência");
    }
  };

  const copiarLinkDocumentoApi = async (documentoId) => {
    if (!documentoId) {
      showToast("⚠️ Documento inválido para copiar link");
      return;
    }

    const endpoint = `${API_BASE_URL}/api/documentos/${documentoId}/download`;
    try {
      await navigator.clipboard.writeText(endpoint);
      showToast("🔗 Link da API copiado (sem token)");
    } catch {
      showToast("❌ Não foi possível copiar o link da API");
    }
  };

  const carregarAlertasSlaApi = async () => {
    if (!apiToken) {
      showToast("⚠️ Faça login na API para consultar alertas SLA");
      return;
    }

    const days = Math.max(1, Number(apiSlaFilters.days) || 7);
    const qs = new URLSearchParams({ days: String(days) });
    if (apiSlaFilters.secretaria.trim()) {
      qs.set("secretaria", apiSlaFilters.secretaria.trim());
    }

    setApiSlaLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/alerts/sla?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${apiToken}` },
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(`❌ Falha ao carregar SLA: ${data.error || "erro"}`);
        return;
      }

      const items = Array.isArray(data.items) ? data.items : [];
      setApiSlaData({ total: data.total || items.length, items });

      const htmlResumo = items.length
        ? `<p>Foram identificados <strong>${items.length}</strong> processo(s) em atraso de SLA (>${days} dia(s)).</p><ul>${items
            .slice(0, 20)
            .map((item) => `<li>${item.numero} - ${item.secretaria} - ${item.titulo}</li>`)
            .join("")}</ul>`
        : `<p>Sem processos em atraso de SLA para o filtro atual (>${days} dia(s)).</p>`;

      setApiNotify((prev) => ({
        ...prev,
        html: htmlResumo,
      }));

      showToast(`📌 SLA carregado: ${items.length} item(ns)`);
    } catch {
      showToast("❌ Erro ao consultar alertas SLA");
    } finally {
      setApiSlaLoading(false);
    }
  };

  const enviarNotificacaoSlaApi = async () => {
    if (!apiToken) {
      showToast("⚠️ Faça login na API para enviar notificações");
      return;
    }

    const to = apiNotify.to.trim().toLowerCase();
    const subject = apiNotify.subject.trim();
    const html = apiNotify.html.trim();

    if (!to || !EMAIL_INSTITUCIONAL_RE.test(to)) {
      showToast("⚠️ Informe um e-mail válido para envio");
      return;
    }
    if (!subject || subject.length < 5) {
      showToast("⚠️ Informe um assunto com ao menos 5 caracteres");
      return;
    }
    if (!html || html.length < 5) {
      showToast("⚠️ Informe o conteúdo HTML da notificação");
      return;
    }

    setApiNotifySending(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/alerts/notify`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${apiToken}`,
        },
        body: JSON.stringify({ to, subject, html }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(`❌ Falha ao enviar notificação: ${data.error || "erro"}`);
        return;
      }

      if (data.sent) {
        showToast("✅ Notificação enviada com sucesso");
      } else {
        showToast(`ℹ️ Notificação registrada sem envio SMTP (${data.reason || "smtp não configurado"})`);
      }

      await carregarAuditoriaApi();
    } catch {
      showToast("❌ Erro ao enviar notificação");
    } finally {
      setApiNotifySending(false);
    }
  };

  const carregarDashboardApi = async () => {
    if (!apiToken) {
      showToast("⚠️ Faça login na API para carregar o dashboard avançado");
      return;
    }

    const qs = new URLSearchParams();
    if (apiDashboardFilters.from) qs.set("from", apiDashboardFilters.from);
    if (apiDashboardFilters.to) qs.set("to", apiDashboardFilters.to);
    if (apiDashboardFilters.secretaria) qs.set("secretaria", apiDashboardFilters.secretaria);

    try {
      const res = await fetch(`${API_BASE_URL}/api/dashboard?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${apiToken}` },
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(`❌ Falha no dashboard da API: ${data.error || "erro"}`);
        return;
      }
      setApiDashboard(data);
      showToast("📊 Dashboard da API atualizado");
    } catch {
      showToast("❌ Erro ao consultar dashboard da API");
    }
  };

  const stats = {
    enviados: municipios.filter((m) => m.status !== "pendente").length,
    assinados: municipios.filter((m) => m.status === "assinado").length,
    pendentes: municipios.filter((m) => m.status === "pendente").length,
  };

  const totalMunicipios = municipios.length;
  const pct = totalMunicipios === 0 ? 0 : Math.round((stats.assinados / totalMunicipios) * 100);
  const idxEtapaFluxo = ETAPAS_FLUXO.findIndex((etapa) => etapa.id === etapaFluxo);
  const podeEnviarLinks = ["envio", "assinaturas", "concluido"].includes(etapaFluxo);

  useEffect(() => {
    if (totalMunicipios > 0 && stats.assinados === totalMunicipios && etapaFluxo !== "concluido") {
      setEtapaFluxo("concluido");
    }
  }, [stats.assinados, totalMunicipios, etapaFluxo]);

  const cadastrarMunicipio = () => {
    const validation = validateMunicipioData({
      nome: novoMunicipioNome,
      email: novoMunicipioEmail,
      municipios,
    });
    setNovoMunicipioErrors(validation.errors);
    if (!validation.ok) {
      showToast("⚠️ Corrija os campos destacados");
      return;
    }

    const novoId = municipios.length ? Math.max(...municipios.map((m) => m.id)) + 1 : 0;
    const novo = {
      id: novoId,
      nome: validation.normalizedNome,
      email: validation.normalizedEmail,
      token: gerarToken(validation.normalizedNome),
      activateAt: gerarHorario(municipios.length),
      status: "pendente",
      signedAt: null,
      geo: null,
      ip: null,
      device: null,
      hash: null,
    };

    setMunicipios((prev) => [...prev, novo]);
    setNovoMunicipioNome("");
    setNovoMunicipioEmail("");
    setNovoMunicipioErrors({ nome: "", email: "" });
    registrarAuditoria("municipio.cadastrado", `${validation.normalizedNome} <${validation.normalizedEmail}>`);
    showToast(`✅ Município cadastrado: ${validation.normalizedNome}`);
  };

  const iniciarEdicaoMunicipio = (muni) => {
    setEditandoMunicipioId(muni.id);
    setEdicaoMunicipioNome(muni.nome);
    setEdicaoMunicipioEmail(muni.email);
    setEdicaoMunicipioErrors({ nome: "", email: "" });
  };

  const cancelarEdicaoMunicipio = () => {
    setEditandoMunicipioId(null);
    setEdicaoMunicipioNome("");
    setEdicaoMunicipioEmail("");
    setEdicaoMunicipioErrors({ nome: "", email: "" });
  };

  const salvarEdicaoMunicipio = () => {
    if (editandoMunicipioId === null) return;

    const validation = validateMunicipioData({
      nome: edicaoMunicipioNome,
      email: edicaoMunicipioEmail,
      municipios,
      editingId: editandoMunicipioId,
    });
    setEdicaoMunicipioErrors(validation.errors);
    if (!validation.ok) {
      showToast("⚠️ Corrija os campos destacados");
      return;
    }

    setMunicipios((prev) =>
      prev.map((m) => (m.id === editandoMunicipioId ? { ...m, nome: validation.normalizedNome, email: validation.normalizedEmail } : m))
    );

    if (selectedMuni?.id === editandoMunicipioId) {
      setSelectedMuni((prev) => (prev ? { ...prev, nome: validation.normalizedNome, email: validation.normalizedEmail } : prev));
    }
    if (contratoSelecionado?.id === editandoMunicipioId) {
      setContratoSelecionado((prev) => (prev ? { ...prev, nome: validation.normalizedNome, email: validation.normalizedEmail } : prev));
    }

    registrarAuditoria("municipio.editado", `${validation.normalizedNome} <${validation.normalizedEmail}>`);
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

    registrarAuditoria("municipio.excluido", muni.nome);
    showToast(`🗑️ Município removido: ${muni.nome}`);
  };

  const filtered = municipios.filter((m) =>
    m.nome.toLowerCase().includes(search.toLowerCase())
  );
  const MUNI_PAGE_SIZE = 10;
  const muniTotalPages = Math.ceil(filtered.length / MUNI_PAGE_SIZE);
  const filteredPage = filtered.slice(muniPage * MUNI_PAGE_SIZE, (muniPage + 1) * MUNI_PAGE_SIZE);
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((m) => selecionados.includes(m.id));

  useEffect(() => {
    setSelecionados((prev) => prev.filter((id) => municipios.some((m) => m.id === id)));
  }, [municipios]);

  const toggleSelecionado = (id) => {
    setSelecionados((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelecionarTodosFiltrados = () => {
    const idsFiltrados = filtered.map((m) => m.id);
    const todosSelecionados = idsFiltrados.length > 0 && idsFiltrados.every((id) => selecionados.includes(id));
    if (todosSelecionados) {
      setSelecionados((prev) => prev.filter((id) => !idsFiltrados.includes(id)));
    } else {
      setSelecionados((prev) => [...new Set([...prev, ...idsFiltrados])]);
    }
  };

  const limparSelecao = () => setSelecionados([]);

  const aplicarStatusEmMassa = () => {
    if (selecionados.length === 0) {
      showToast("⚠️ Selecione ao menos um município");
      return;
    }
    setMunicipios((prev) =>
      prev.map((m) => {
        if (!selecionados.includes(m.id)) return m;
        if (statusEmMassa === "assinado" && !m.hash) return m;
        return { ...m, status: statusEmMassa };
      })
    );
    registrarAuditoria("municipio.status.massa", `${selecionados.length} município(s) -> ${statusEmMassa}`);
    showToast(`✅ Status aplicado em ${selecionados.length} município(s)`);
  };

  const excluirSelecionados = () => {
    if (selecionados.length === 0) {
      showToast("⚠️ Selecione ao menos um município");
      return;
    }
    if (selecionados.length >= municipios.length) {
      showToast("⚠️ Mantenha ao menos 1 município na base");
      return;
    }
    const confirmed = window.confirm(`Excluir ${selecionados.length} município(s) selecionado(s)?`);
    if (!confirmed) return;

    const removidos = municipios.filter((m) => selecionados.includes(m.id));
    const restantes = municipios.filter((m) => !selecionados.includes(m.id));
    setMunicipios(restantes);
    setSigns((prev) => {
      const next = { ...prev };
      removidos.forEach((m) => delete next[m.id]);
      return next;
    });
    if (selectedMuni && selecionados.includes(selectedMuni.id)) {
      setSelectedMuni(restantes[0] || null);
    }
    if (contratoSelecionado && selecionados.includes(contratoSelecionado.id)) {
      setContratoSelecionado(null);
    }
    setSelecionados([]);
    registrarAuditoria("municipio.exclusao.massa", `${removidos.length} município(s)`);
    showToast(`🗑️ ${removidos.length} município(s) removido(s)`);
  };

  const enviarSelecionados = async () => {
    // Auto-advance to "envio" stage if not already there
    if (!podeEnviarLinks) {
      setEtapaFluxo("envio");
      registrarAuditoria("fluxo.auto_advance", "Mudança automática para 'Envio' ao iniciar envio selecionado");
    }
    
    if (selecionados.length === 0) {
      showToast("⚠️ Selecione ao menos um município");
      return;
    }

    const selecionadosSet = new Set(selecionados);
    const alvo = municipios.filter((m) => selecionadosSet.has(m.id));
    const { enviados, falhas } = await enviarLoteAssinatura(alvo);

    if (enviados.length > 0) {
      const sentSet = new Set(enviados);
      setMunicipios((prev) =>
        prev.map((m) => (sentSet.has(m.id) ? { ...m, status: "enviado" } : m))
      );
    }

    registrarAuditoria("envio.massa", `${enviados.length}/${alvo.length} município(s)`);
    if (falhas.length > 0) {
      const firstReason = falhas[0]?.reason ? ` (${falhas[0].reason})` : "";
      showToast(`⚠️ Disparo parcial: ${enviados.length}/${alvo.length} enviado(s). Falhas: ${falhas.length}${firstReason}`);
    } else {
      showToast(`✅ Disparo concluído: ${enviados.length}/${alvo.length} e-mail(s) enviados`);
    }
  };

  const abrirModalVincularPrefeituras = () => {
    if (!docHtml?.trim()) {
      showToast("⚠️ Crie o corpo do documento antes de disparar para assinatura");
      return;
    }

    const idsComEmail = municipios
      .filter((m) => m.email && EMAIL_INSTITUCIONAL_RE.test(String(m.email).trim().toLowerCase()))
      .map((m) => m.id);

    setEditorVinculosSelecionados(idsComEmail);
    setEditorVinculosBusca("");
    setModal("vincular-prefeituras");
  };

  const alternarVinculoPrefeitura = (id) => {
    setEditorVinculosSelecionados((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const dispararAssinaturaPeloEditor = async () => {
    // Auto-advance to "envio" stage if not already there
    if (!podeEnviarLinks) {
      setEtapaFluxo("envio");
      registrarAuditoria("fluxo.auto_advance", "Mudança automática para 'Envio' ao disparar pelo editor");
    }

    const selecionadosSet = new Set(editorVinculosSelecionados);
    const alvo = municipios.filter((m) => selecionadosSet.has(m.id));

    if (alvo.length === 0) {
      showToast("⚠️ Selecione ao menos uma prefeitura");
      return;
    }

    const { enviados, falhas } = await enviarLoteAssinatura(alvo);

    if (enviados.length > 0) {
      const sentSet = new Set(enviados);
      setMunicipios((prev) =>
        prev.map((m) => (sentSet.has(m.id) ? { ...m, status: "enviado" } : m))
      );
    }

    registrarAuditoria("envio.editor.vinculo", `${enviados.length}/${alvo.length} prefeitura(s)`);
    setModal(null);

    if (falhas.length > 0) {
      const firstReason = falhas[0]?.reason ? ` (${falhas[0].reason})` : "";
      showToast(`⚠️ Disparo parcial: ${enviados.length}/${alvo.length} enviado(s). Falhas: ${falhas.length}${firstReason}`);
    } else {
      showToast(`✅ Disparo concluído: ${enviados.length}/${alvo.length} e-mail(s) enviados`);
    }
  };

  const processarArquivoImportacao = async (evt) => {
    const file = evt.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });

      if (!rows.length) {
        setImportRows([]);
        setImportSummary(null);
        showToast("⚠️ O arquivo está vazio");
        return;
      }

      const firstRow = (rows[0] || []).map((cell) => String(cell).toLowerCase().trim());
      const hasHeader = firstRow.some((c) => c.includes("nome") || c.includes("email") || c.includes("e-mail"));
      const dataRows = hasHeader ? rows.slice(1) : rows;

      const nomeSet = new Set(municipios.map((m) => m.nome.toLowerCase()));
      const emailSet = new Set(municipios.map((m) => m.email.toLowerCase()));
      const inBatchNomeSet = new Set();
      const inBatchEmailSet = new Set();

      const parsed = dataRows
        .map((row, idx) => {
          const rawNome = String(row[0] || "");
          const rawEmail = String(row[1] || "");
          if (!rawNome.trim() && !rawEmail.trim()) return null;

          const validation = validateMunicipioData({
            nome: rawNome,
            email: rawEmail,
            municipios,
          });
          const issues = [];
          if (validation.errors.nome) issues.push(validation.errors.nome);
          if (validation.errors.email) issues.push(validation.errors.email);

          const lowerNome = validation.normalizedNome.toLowerCase();
          const lowerEmail = validation.normalizedEmail;
          if (!issues.length && (nomeSet.has(lowerNome) || inBatchNomeSet.has(lowerNome))) {
            issues.push("Município duplicado no sistema/arquivo");
          }
          if (!issues.length && (emailSet.has(lowerEmail) || inBatchEmailSet.has(lowerEmail))) {
            issues.push("E-mail duplicado no sistema/arquivo");
          }

          if (!issues.length) {
            inBatchNomeSet.add(lowerNome);
            inBatchEmailSet.add(lowerEmail);
          }

          return {
            rowIndex: idx + (hasHeader ? 2 : 1),
            nome: validation.normalizedNome,
            email: validation.normalizedEmail,
            issues,
            valid: issues.length === 0,
          };
        })
        .filter(Boolean);

      const validCount = parsed.filter((r) => r.valid).length;
      const invalidCount = parsed.length - validCount;
      setImportRows(parsed);
      setImportSummary({ total: parsed.length, valid: validCount, invalid: invalidCount });
      showToast(`📥 Arquivo lido: ${validCount} válido(s), ${invalidCount} inválido(s)`);
    } catch (err) {
      setImportRows([]);
      setImportSummary(null);
      showToast("❌ Falha ao processar arquivo de importação");
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      evt.target.value = "";
    }
  };

  const confirmarImportacao = () => {
    const validRows = importRows.filter((r) => r.valid);
    if (validRows.length === 0) {
      showToast("⚠️ Nenhum registro válido para importar");
      return;
    }

    const maxId = municipios.length ? Math.max(...municipios.map((m) => m.id)) : -1;
    const novos = validRows.map((r, idx) => ({
      id: maxId + idx + 1,
      nome: r.nome,
      email: r.email,
      token: gerarToken(r.nome),
      activateAt: gerarHorario(municipios.length + idx),
      status: "pendente",
      signedAt: null,
      geo: null,
      ip: null,
      device: null,
      hash: null,
    }));

    setMunicipios((prev) => [...prev, ...novos]);
    setImportRows([]);
    setImportSummary(null);
    setImportFileName("");
    registrarAuditoria("municipio.importacao", `${novos.length} município(s) via arquivo`);
    showToast(`✅ ${novos.length} município(s) importado(s)`);
  };

  const mudarEtapaFluxo = (nextId) => {
    const etapa = ETAPAS_FLUXO.find((item) => item.id === nextId);
    if (!etapa) return;
    setEtapaFluxo(nextId);
    registrarAuditoria("fluxo.etapa", etapa.label);
    showToast(`📌 Etapa atual: ${etapa.label}`);
  };

  const exportarRelatorioCsv = () => {
    const header = ["Municipio", "Email", "Status", "AssinadoEm", "IP", "Aparelho", "Hash"];
    const lines = municipios.map((m) => [
      m.nome,
      m.email,
      m.status,
      m.signedAt ? new Date(m.signedAt).toLocaleString("pt-BR") : "",
      m.ip || "",
      m.device || "",
      m.hash || "",
    ]);
    const csv = [header, ...lines]
      .map((row) => row.map((col) => `"${String(col || "").replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-municipios-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    registrarAuditoria("relatorio.exportado", "CSV de municípios");
  };

  const getDocumentoParaEnvioEmail = useCallback(() => {
    const atual = (docHtml || "").trim();
    if (atual) return atual.slice(0, 20000);
    const template = buildManifestacaoTemplate(consorcio.nome || "CONSÓRCIO INTERMUNICIPAL");
    return String(template || "").trim().slice(0, 20000);
  }, [docHtml, consorcio.nome]);

  const buildEmailHtmlTimbrado = useCallback((muni, linkAssinatura, corpoDocumento) => {
    const headerSrc = `cid:timbrado-header`;
    const footerSrc = `cid:timbrado-footer`;

    const linkBlock = linkAssinatura
      ? `
      <div style="margin:20px 0;padding:14px 16px;background:#f2f6fb;border:1px solid #d8e3ef;border-radius:8px;">
        <p style="margin:0 0 10px;font-size:13px;color:#1f2937;"><strong>Ação necessária:</strong> clique no botão abaixo para assinar eletronicamente.</p>
        <p style="margin:0;"><a href="${linkAssinatura}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 28px;border-radius:6px;background:#0f4c81;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;">✍️ Acessar e Assinar o Documento</a></p>
      </div>
      <p style="margin:4px 0 0;font-size:11px;color:#888;">Link direto: <a href="${linkAssinatura}" style="color:#0f4c81;">${linkAssinatura}</a><br>Este link é exclusivo para ${muni.nome}. Não compartilhe com terceiros.</p>
    `
      : "";

    return `
    <div style="font-family:Segoe UI, Arial, sans-serif;background:#eef3f9;padding:20px;color:#1f2937;">
      <div style="max-width:860px;margin:0 auto;background:#ffffff;border:1px solid #d8e3ef;border-radius:10px;overflow:hidden;">

        <!-- Timbrado CIMAG (logo) -->
        <div style="padding:0;background:#ffffff;border-bottom:1px solid #e5edf5;">
          <img src="${headerSrc}" alt="CIMAG – Consórcio Intermunicipal Multifinalitário da Microrregião do Circuito das Águas" style="display:block;width:100%;max-height:130px;object-fit:cover;"/>
        </div>

        <div style="padding:24px 28px 20px;line-height:1.65;">
          <h2 style="margin:0 0 4px;font-size:19px;color:#0f4c81;">Manifestação de Interesse — CIMAG</h2>
          <p style="margin:0 0 16px;font-size:12px;color:#6b7280;">Consórcio Intermunicipal Multifinalitário da Microrregião do Circuito das Águas · CNPJ 21.406.451/0001-01</p>

          <p style="margin:0 0 8px;">Prezado(a) Representante de <strong>${muni.nome}</strong>,</p>
          <p style="margin:0 0 14px;">O <strong>CIMAG</strong> encaminha o documento de <strong>Manifestação de Interesse</strong> para análise e assinatura eletrônica.</p>

          <table style="border-collapse:collapse;background:#f8fafc;border:1px solid #d8e3ef;border-radius:6px;width:100%;margin-bottom:4px;">
            <tr><td style="padding:8px 14px;font-size:13px;border-bottom:1px solid #e5edf5;"><strong>Município:</strong></td><td style="padding:8px 14px;font-size:13px;border-bottom:1px solid #e5edf5;">${muni.nome}</td></tr>
            <tr><td style="padding:8px 14px;font-size:13px;border-bottom:1px solid #e5edf5;"><strong>Emissão:</strong></td><td style="padding:8px 14px;font-size:13px;border-bottom:1px solid #e5edf5;">${new Date().toLocaleString("pt-BR")}</td></tr>
            <tr><td style="padding:8px 14px;font-size:13px;"><strong>Contato:</strong></td><td style="padding:8px 14px;font-size:13px;"><a href="mailto:secretaria@cimag.org.br" style="color:#0f4c81;">secretaria@cimag.org.br</a> · <a href="https://www.cimag.org.br" style="color:#0f4c81;">www.cimag.org.br</a></td></tr>
          </table>

          ${linkBlock}
        </div>

        <!-- Rodapé CIMAG -->
        <div style="padding:0;border-top:1px solid #e5edf5;background:#ffffff;">
          <img src="${footerSrc}" alt="Rodapé CIMAG" style="display:block;width:100%;max-height:95px;object-fit:cover;"/>
        </div>
      </div>
    </div>
  `;
  }, []);

  const enviarEmailAssinaturaApi = useCallback(
    async (muni, linkAssinatura) => {
      const subject = `Manifestação de Interesse - Assinatura (${muni.nome})`;
      const corpoDocumento = getDocumentoParaEnvioEmail();
      const html = buildEmailHtmlTimbrado(muni, linkAssinatura, corpoDocumento);

      try {
        const res = await fetch(`${API_BASE_URL}/api/assinaturas/disparar`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            to: muni.email,
            subject,
            html,
            municipio: muni.nome,
            token: muni.token,
            documentoHtml: corpoDocumento,
          }),
        });

        const raw = await res.text();
        const data = raw ? JSON.parse(raw) : {};

        if (!res.ok) {
          return { ok: false, reason: data.error || `falha no envio (${res.status})` };
        }

        if (data.sent) {
          return { ok: true, delivery: "smtp" };
        }

        return { ok: false, reason: data.reason || "SMTP não configurado" };
      } catch (err) {
        return { ok: false, reason: `erro de rede/API: ${String(err.message || err)}` };
      }
    },
    [buildEmailHtmlTimbrado, getDocumentoParaEnvioEmail]
  );

  const enviarLoteAssinatura = useCallback(
    async (listaMunicipios) => {
      const idsPorEmail = new Map();
      const municipiosValidos = [];
      const itens = [];
      const falhas = [];

      for (const muni of listaMunicipios) {
        const email = String(muni.email || "").trim().toLowerCase();
        if (!email || !EMAIL_INSTITUCIONAL_RE.test(email)) {
          falhas.push({ nome: muni.nome, reason: "e-mail inválido" });
          continue;
        }

        const linkAssinatura = buildAssinaturaLink(muni.token);
        itens.push({
          to: email,
          municipio: muni.nome,
          linkAssinatura,
        });
        idsPorEmail.set(email, muni.id);
        municipiosValidos.push(muni);
      }

      if (itens.length === 0) {
        return { enviados: [], falhas };
      }

      try {
        const res = await fetch(`${API_BASE_URL}/api/assinaturas/disparar-lote`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            documentoHtml: getDocumentoParaEnvioEmail(),
            itens,
          }),
        });

        const raw = await res.text();
        const data = raw ? JSON.parse(raw) : {};

        if (!res.ok) {
          return {
            enviados: [],
            falhas: [...falhas, { nome: "lote", reason: data.error || `falha no disparo (${res.status})` }],
          };
        }

        const enviados = (data.enviados || [])
          .map((entry) => idsPorEmail.get(String(entry.to || "").trim().toLowerCase()))
          .filter((id) => Number.isFinite(id));

        const falhasApi = (data.falhas || []).map((entry) => ({
          nome: entry.municipio || entry.to || "município",
          reason: entry.reason || "falha",
        }));

        return { enviados, falhas: [...falhas, ...falhasApi] };
      } catch (err) {
        const enviadosFallback = [];
        const falhasFallback = [...falhas];

        for (const muni of municipiosValidos) {
          const linkAssinatura = buildAssinaturaLink(muni.token);
          const result = await enviarEmailAssinaturaApi(muni, linkAssinatura);
          if (result.ok) {
            enviadosFallback.push(muni.id);
          } else {
            falhasFallback.push({ nome: muni.nome, reason: result.reason || "falha" });
          }
        }

        if (enviadosFallback.length > 0) {
          return { enviados: enviadosFallback, falhas: falhasFallback };
        }

        return {
          enviados: [],
          falhas: [
            ...falhasFallback,
            { nome: "lote", reason: `erro de rede/API: ${String(err.message || err)}` },
          ],
        };
      }
    },
    [getDocumentoParaEnvioEmail, enviarEmailAssinaturaApi]
  );

  const enviarUm = async (id) => {
    // Auto-advance to "envio" stage if not already there
    if (!podeEnviarLinks) {
      setEtapaFluxo("envio");
      registrarAuditoria("fluxo.auto_advance", "Mudança automática para 'Envio' ao iniciar envio");
    }

    const muni = municipios.find((m) => m.id === id);
    if (!muni) {
      showToast("⚠️ Município não encontrado");
      return;
    }

    const linkAssinatura = buildAssinaturaLink(muni.token);
    const result = await enviarEmailAssinaturaApi(muni, linkAssinatura);

    if (!result.ok) {
      showToast(`❌ Falha ao enviar e-mail para ${muni.nome}: ${result.reason || "falha"}`);
      registrarAuditoria("envio.individual.falha", `${muni.nome} (${result.reason || "falha"})`);
      return;
    }

    setMunicipios((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: "enviado" } : m))
    );
    registrarAuditoria("envio.individual", muni.nome || `ID ${id}`);
    showToast(`📨 Link de assinatura preparado para ${muni.nome}`);
  };

  const enviarTodos = async () => {
    // Auto-advance to "envio" stage if not already there
    if (!podeEnviarLinks) {
      setEtapaFluxo("envio");
      registrarAuditoria("fluxo.auto_advance", "Mudança automática para 'Envio' ao iniciar envio em massa");
    }

    setModal(null);

    const { enviados, falhas } = await enviarLoteAssinatura(municipios);
    if (enviados.length > 0) {
      const sentSet = new Set(enviados);
      setMunicipios((prev) =>
        prev.map((m) => (sentSet.has(m.id) ? { ...m, status: "enviado" } : m))
      );
    }

    registrarAuditoria("envio.total", `${enviados.length}/${municipios.length} município(s)`);
    if (falhas.length > 0) {
      const firstReason = falhas[0]?.reason ? ` (${falhas[0].reason})` : "";
      showToast(`⚠️ Disparo parcial: ${enviados.length}/${municipios.length} enviado(s). Falhas: ${falhas.length}${firstReason}`);
    } else {
      showToast(`✅ Disparo concluído: ${enviados.length}/${municipios.length} e-mail(s) enviados`);
    }
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
              ip: sigData.ip || null,
              device: sigData.device || null,
              hash: sigData.hash,
            }
          : m
      )
    );
    if (["rascunho", "revisao", "envio"].includes(etapaFluxo)) {
      setEtapaFluxo("assinaturas");
    }
    setSigns((prev) => ({ ...prev, [muniId]: sigData }));
    const nome = municipios.find((m) => m.id === muniId)?.nome;
    registrarAuditoria("assinatura.realizada", nome || `ID ${muniId}`);
    showToast(`✅ ${nome} assinou!`);
  };

  const copyLink = (muni) => {
    const url = buildAssinaturaLink(muni.token);
    navigator.clipboard?.writeText(url);
    registrarAuditoria("link.copiado", muni.nome);
    showToast(`🔗 Link copiado: ${muni.nome}`);
  };

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
      const summaryEntries = [];

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

      addTimbrado();
      let coverY = headerH + 68;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(20);
      pdf.text("Relatório de Assinaturas Municipais", marginX, coverY);
      coverY += 28;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(12);
      pdf.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, marginX, coverY);
      coverY += 18;
      pdf.text(`Total de municípios assinados: ${assinados.length}`, marginX, coverY);
      coverY += 28;
      pdf.setFont("times", "normal");
      pdf.setFontSize(11);
      const coverIntro = pdf.splitTextToSize(
        "Este relatório consolida as assinaturas eletrônicas recebidas, incluindo evidências de data/hora, geolocalização, IP, aparelho, hash de validação e QR Code para conferência.",
        pageW - marginX * 2
      );
      coverIntro.forEach((line) => {
        pdf.text(line, marginX, coverY);
        coverY += 15;
      });

      for (const m of assinados) {
        pdf.addPage();
        addTimbrado();
        summaryEntries.push({ municipio: m.nome, page: pdf.getNumberOfPages() });

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
        pdf.text(`IP: ${formatIpDisplay(m.ip)}`, marginX, y);
        y += 15;
        const aparelhoLines = pdf.splitTextToSize(`Aparelho: ${m.device || "Não disponível"}`, pageW - marginX * 2);
        aparelhoLines.forEach((line) => {
          if (y > pageH - footerH - 44) {
            pdf.addPage();
            addTimbrado();
            y = headerH + 56;
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(11);
          }
          pdf.text(line, marginX, y);
          y += 14;
        });
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
        pdf.text("Registro com data, hora, geolocalização, IP, aparelho e hash de validação.", marginX + 10, y + 39);

        const qrText = `https://manifestacao.seudominio.com.br/validar?hash=${encodeURIComponent(m.hash || "")}`;
        const qrDataUrl = await QRCode.toDataURL(qrText, { margin: 1, width: 96 });
        pdf.addImage(qrDataUrl, "PNG", pageW - marginX - 90, y + 7, 64, 64);
        pdf.setFontSize(8);
        pdf.text("QR validação", pageW - marginX - 84, y + 76);
      }

      pdf.addPage();
      addTimbrado();
      let sumY = headerH + 54;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.text("Sumário de Assinaturas", marginX, sumY);
      sumY += 24;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);
      summaryEntries.forEach((entry, idx) => {
        if (sumY > pageH - footerH - 36) {
          pdf.addPage();
          addTimbrado();
          sumY = headerH + 56;
        }
        pdf.text(`${idx + 1}. ${entry.municipio} — página ${entry.page}`, marginX, sumY);
        sumY += 15;
      });

      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(120, 120, 120);
        pdf.text(`Página ${i} de ${totalPages}`, pageW - marginX - 60, pageH - footerH - 26);
      }

      const dateStamp = new Date().toISOString().slice(0, 10);
      pdf.save(`assinaturas-municipios-${dateStamp}.pdf`);
      registrarAuditoria("pdf.lote.gerado", `${assinados.length} assinatura(s)`);
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
      pdf.text(`IP: ${formatIpDisplay(muni.ip)}`, marginX, y);
      y += 15;
      const aparelhoLines = pdf.splitTextToSize(`Aparelho: ${muni.device || "Não disponível"}`, pageW - marginX * 2);
      aparelhoLines.forEach((line) => {
        if (y > pageH - footerH - 44) {
          pdf.addPage();
          pdf.addImage(headerDataUrl, "PNG", marginX, 18, headerW, headerH);
          pdf.addImage(footerDataUrl, "PNG", marginX, pageH - footerH - 18, footerW, footerH);
          y = headerH + 56;
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(11);
        }
        pdf.text(line, marginX, y);
        y += 14;
      });
      pdf.text(`Hash: ${muni.hash || "-"}`, marginX, y);
      y += 22;

      pdf.setFont("helvetica", "bold");
      pdf.text("Conteúdo do documento:", marginX, y);
      y += 16;

      const qrText = `https://manifestacao.seudominio.com.br/validar?hash=${encodeURIComponent(muni.hash || "")}`;
      const qrDataUrl = await QRCode.toDataURL(qrText, { margin: 1, width: 88 });
      pdf.addImage(qrDataUrl, "PNG", pageW - marginX - 84, headerH + 42, 58, 58);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.text("QR validação", pageW - marginX - 78, headerH + 108);

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

      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(120, 120, 120);
        pdf.text(`Página ${i} de ${totalPages}`, pageW - marginX - 60, pageH - footerH - 26);
      }

      const stamp = new Date().toISOString().slice(0, 10);
      pdf.save(`contrato-assinado-${muni.nome.toLowerCase().replace(/\s+/g, "-")}-${stamp}.pdf`);
      registrarAuditoria("pdf.individual.gerado", muni.nome);
      showToast(`✅ PDF do contrato gerado: ${muni.nome}`);
    } catch (err) {
      showToast("❌ Falha ao exportar contrato");
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setExportandoPdf(false);
    }
  };

  const assinarDocumentoPublico = async (municipioPublico) => {
    if (!municipioPublico) return;

    const cpfNormalizado = normalizeCpf(assinaturaPublicaCpf);
    if (!isValidCpf(cpfNormalizado)) {
      setAssinaturaPublicaErro("Informe um CPF válido para assinar.");
      return;
    }
    if (!assinaturaPublicaAssinaturaDataUrl) {
      setAssinaturaPublicaErro("Desenhe a assinatura no campo indicado antes de continuar.");
      return;
    }
    if (!assinaturaPublicaAceite) {
      setAssinaturaPublicaErro("Confirme o aceite dos termos para concluir a assinatura.");
      return;
    }
    if (!assinaturaPublicaOtpVerifiedAt) {
      setAssinaturaPublicaErro("Valide o código OTP de 6 dígitos antes de assinar.");
      return;
    }
    if (!municipioPublico.documentHash) {
      setAssinaturaPublicaErro("Hash do documento indisponível. Reabra o link enviado por e-mail.");
      return;
    }

    setAssinaturaPublicaErro("");
    setAssinaturaPublicaProcessando(true);

    const fallbackLat = -21.79 + (Math.random() - 0.5) * 0.3;
    const fallbackLon = -46.56 + (Math.random() - 0.5) * 0.3;
    const geo = await new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ lat: fallbackLat, lon: fallbackLon });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => resolve({ lat: fallbackLat, lon: fallbackLon }),
        { timeout: 6000 }
      );
    });

    const platform = navigator.userAgentData?.platform || navigator.platform || "Plataforma desconhecida";
    const userAgent = navigator.userAgent || "User-Agent indisponível";
    const device = `${platform} | ${userAgent}`;

    try {
      const res = await fetch(`${API_BASE_URL}/api/assinaturas/registrar`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token: municipioPublico.token,
          otpCode: assinaturaPublicaOtpCode,
          documentHash: municipioPublico.documentHash,
          cpf: cpfNormalizado,
          signerNome: assinaturaPublicaNome.trim() || "Representante Municipal",
          assinaturaDataUrl: assinaturaPublicaAssinaturaDataUrl,
          lat: geo.lat,
          lon: geo.lon,
          device,
        }),
      });

      const raw = await res.text();
      const data = raw ? JSON.parse(raw) : {};
      if (!res.ok || !data.item) {
        throw new Error(data.error || `falha ao registrar assinatura (${res.status})`);
      }

      const item = data.item;
      const signedMunicipio = {
        id: item.id,
        nome: item.nome,
        email: item.email,
        token: item.token,
        activateAt: item.activate_at ? new Date(item.activate_at) : municipioPublico.activateAt,
        status: item.status,
        signedAt: item.signed_at,
        geo: typeof item.geo_lat === "number" && typeof item.geo_lon === "number"
          ? { lat: item.geo_lat, lon: item.geo_lon }
          : { lat: geo.lat, lon: geo.lon },
        ip: item.signer_ip || "Não disponível",
        device: item.device_info || device,
        signerCpf: item.signer_cpf || cpfNormalizado,
        signerNome: item.signer_nome || assinaturaPublicaNome.trim() || "Representante Municipal",
        signatureDataUrl: item.signature_data_url || assinaturaPublicaAssinaturaDataUrl,
        documentHash: item.document_hash || municipioPublico.documentHash,
        otpVerifiedAt: item.otp_verified_at || assinaturaPublicaOtpVerifiedAt,
        tsaUtc: item.tsa_utc || null,
        tsaSource: item.tsa_source || null,
        tsaToken: item.tsa_token || null,
        hash: item.hash || "",
      };

      setMunicipios((prev) =>
        prev.map((m) =>
          m.token === municipioPublico.token
            ? {
                ...m,
                status: "assinado",
                signedAt: signedMunicipio.signedAt,
                geo: signedMunicipio.geo,
                ip: signedMunicipio.ip,
                device: signedMunicipio.device,
                signerCpf: signedMunicipio.signerCpf,
                signerNome: signedMunicipio.signerNome,
                signatureDataUrl: signedMunicipio.signatureDataUrl,
                documentHash: signedMunicipio.documentHash,
                otpVerifiedAt: signedMunicipio.otpVerifiedAt,
                tsaUtc: signedMunicipio.tsaUtc,
                tsaSource: signedMunicipio.tsaSource,
                tsaToken: signedMunicipio.tsaToken,
                hash: signedMunicipio.hash,
              }
            : m
        )
      );

      setSigns((prev) => ({
        ...prev,
        [signedMunicipio.id]: {
          nome: signedMunicipio.signerNome,
          cargo: "Representante Municipal",
          cpf: formatCpf(signedMunicipio.signerCpf),
          assinaturaDataUrl: signedMunicipio.signatureDataUrl,
          tsaUtc: signedMunicipio.tsaUtc,
          tsaSource: signedMunicipio.tsaSource,
          tsaToken: signedMunicipio.tsaToken,
          at: signedMunicipio.signedAt,
          lat: signedMunicipio.geo?.lat,
          lon: signedMunicipio.geo?.lon,
          ip: signedMunicipio.ip,
          device: signedMunicipio.device,
          hash: signedMunicipio.hash,
        },
      }));

      setSelectedMuni(signedMunicipio);
      setContratoSelecionado(signedMunicipio);
      setAssinaturaPublicaMeta((prev) => ({ ...(prev || {}), ...item }));

      const auditEntry = {
        id: Date.now() + Math.random(),
        at: new Date().toISOString(),
        acao: "assinatura.link",
        detalhes: `${signedMunicipio.nome} assinou via link público`,
      };
      setAuditoria((prev) => [auditEntry, ...prev].slice(0, 300));

      setToast(`✅ Assinatura registrada para ${signedMunicipio.nome}.`);
      setTimeout(() => setToast(null), 3200);
    } catch (err) {
      setAssinaturaPublicaErro(String(err.message || err));
    } finally {
      setAssinaturaPublicaProcessando(false);
    }
  };

  const enviarOtpPublico = async (municipioPublico) => {
    if (!municipioPublico) return;
    setAssinaturaPublicaErro("");
    setAssinaturaPublicaOtpSending(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/assinaturas/otp/enviar`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: municipioPublico.token }),
      });
      const raw = await res.text();
      const data = raw ? JSON.parse(raw) : {};
      if (!res.ok) throw new Error(data.error || `falha ao enviar OTP (${res.status})`);
      setAssinaturaPublicaOtpCode("");
      setAssinaturaPublicaOtpVerifiedAt("");
      setToast("📩 Código OTP enviado para o e-mail do município.");
      setTimeout(() => setToast(null), 2800);
    } catch (err) {
      setAssinaturaPublicaErro(String(err.message || err));
    } finally {
      setAssinaturaPublicaOtpSending(false);
    }
  };

  const validarOtpPublico = async (municipioPublico) => {
    if (!municipioPublico) return;
    if (!/^\d{6}$/.test(assinaturaPublicaOtpCode)) {
      setAssinaturaPublicaErro("Informe o código OTP com 6 dígitos.");
      return;
    }
    setAssinaturaPublicaErro("");
    setAssinaturaPublicaOtpValidating(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/assinaturas/otp/validar`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: municipioPublico.token, codigo: assinaturaPublicaOtpCode }),
      });
      const raw = await res.text();
      const data = raw ? JSON.parse(raw) : {};
      if (!res.ok) throw new Error(data.error || `falha ao validar OTP (${res.status})`);
      setAssinaturaPublicaOtpVerifiedAt(String(data.verifiedAt || new Date().toISOString()));
      setAssinaturaPublicaMeta((prev) => ({ ...(prev || {}), otp_verified_at: data.verifiedAt || new Date().toISOString() }));
      setToast("✅ OTP validado com sucesso.");
      setTimeout(() => setToast(null), 2400);
    } catch (err) {
      setAssinaturaPublicaErro(String(err.message || err));
    } finally {
      setAssinaturaPublicaOtpValidating(false);
    }
  };

  const now = new Date();
  const atrasados = municipios.filter(
    (m) => m.status === "pendente" && m.activateAt instanceof Date && m.activateAt < now
  ).length;
  const taxaAssinatura = totalMunicipios === 0 ? 0 : Math.round((stats.assinados / totalMunicipios) * 100);
  const assinaturasPorDia = municipios
    .filter((m) => m.signedAt)
    .reduce((acc, m) => {
      const key = new Date(m.signedAt).toLocaleDateString("pt-BR");
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  const serieAssinaturas = Object.entries(assinaturasPorDia)
    .sort((a, b) => new Date(a[0].split("/").reverse().join("-")).getTime() - new Date(b[0].split("/").reverse().join("-")).getTime())
    .slice(-7);

  const TABS = [
    { id: "painel",     label: "📊 Painel" },
    { id: "editor",     label: "✏️ Editor de Documento" },
    { id: "municipios", label: "🏛 Municípios" },
    { id: "assinatura", label: "✍ Assinatura" },
    { id: "preview",    label: "📄 Prévia do Documento" },
    { id: "contratos",   label: "📑 Contratos Assinados" },
    { id: "registro",   label: "📋 Registro" },
  ];

  if (assinaturaPublicaAtiva) {
    const municipioPublicoLocal = municipios.find((m) => m.token === assinaturaTokenUrl) || null;
    const municipioPublico = municipioPublicoLocal || (assinaturaPublicaMeta
      ? {
          id: assinaturaPublicaMeta.id,
          nome: assinaturaPublicaMeta.nome,
          email: assinaturaPublicaMeta.email,
          token: assinaturaPublicaMeta.token,
          activateAt: assinaturaPublicaMeta.activate_at ? new Date(assinaturaPublicaMeta.activate_at) : new Date(),
          status: assinaturaPublicaMeta.status,
          signedAt: assinaturaPublicaMeta.signed_at || null,
          geo:
            typeof assinaturaPublicaMeta.geo_lat === "number" && typeof assinaturaPublicaMeta.geo_lon === "number"
              ? { lat: assinaturaPublicaMeta.geo_lat, lon: assinaturaPublicaMeta.geo_lon }
              : null,
          ip: assinaturaPublicaMeta.signer_ip || null,
          device: assinaturaPublicaMeta.device_info || null,
          signerCpf: assinaturaPublicaMeta.signer_cpf || null,
          signerNome: assinaturaPublicaMeta.signer_nome || null,
          signatureDataUrl: assinaturaPublicaMeta.signature_data_url || null,
          documentHash: assinaturaPublicaMeta.document_hash || null,
          otpVerifiedAt: assinaturaPublicaMeta.otp_verified_at || null,
          tsaUtc: assinaturaPublicaMeta.tsa_utc || null,
          tsaSource: assinaturaPublicaMeta.tsa_source || null,
          tsaToken: assinaturaPublicaMeta.tsa_token || null,
          hash: assinaturaPublicaMeta.hash || null,
        }
      : null);
    const documentoPublicoHtml = assinaturaPublicaDocHtml.trim() || (docHtml || "").trim() || buildManifestacaoTemplate(consorcio.nome || "CIMAG");
    const signDataPublico = municipioPublico
      ? signs[municipioPublico.id] || (municipioPublico.status === "assinado"
        ? {
            nome: "Representante Municipal",
            cargo: "Prefeito(a) Municipal",
            cpf: municipioPublico.signerCpf ? formatCpf(municipioPublico.signerCpf) : null,
            assinaturaDataUrl: municipioPublico.signatureDataUrl || null,
            tsaUtc: municipioPublico.tsaUtc || null,
            tsaSource: municipioPublico.tsaSource || null,
            tsaToken: municipioPublico.tsaToken || null,
            at: municipioPublico.signedAt,
            lat: municipioPublico.geo?.lat,
            lon: municipioPublico.geo?.lon,
            ip: municipioPublico.ip,
            device: municipioPublico.device,
            hash: municipioPublico.hash,
          }
        : null)
      : null;

    return (
      <div style={{ ...S.app, maxWidth: 820 }}>
        <div style={S.header}>
          <div style={S.logo}>✍</div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 500 }}>Assinatura de Manifestação Municipal</div>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
              Ambiente público de assinatura
            </div>
          </div>
        </div>

        <div style={S.card}>
          {!municipioPublico && (
            <div style={{ fontSize: 13, color: "var(--color-text-danger)" }}>
              ❌ Link de assinatura inválido ou expirado.
            </div>
          )}

          {municipioPublico && assinaturaPublicaProcessando && (
            <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
              ⏳ Processando assinatura eletrônica para {municipioPublico.nome}...
            </div>
          )}

          {municipioPublico && !assinaturaPublicaProcessando && municipioPublico.status === "assinado" && signDataPublico && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-success)", marginBottom: 8 }}>
                ✅ Documento assinado com sucesso
              </div>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.8, marginBottom: 12 }}>
                Município: <strong style={{ color: "var(--color-text-primary)" }}>{municipioPublico.nome}</strong><br />
                Assinado em: {new Date(signDataPublico.at).toLocaleString("pt-BR")}<br />
                CPF: {signDataPublico.cpf || "Não informado"}<br />
                IP do aparelho: {formatIpDisplay(signDataPublico.ip)}<br />
                TSA: {signDataPublico.tsaUtc ? `${new Date(signDataPublico.tsaUtc).toLocaleString("pt-BR")} (${signDataPublico.tsaSource || "fonte externa"})` : "não disponível"}<br />
                Hash: <span style={{ fontFamily: "monospace" }}>{signDataPublico.hash}</span>
              </div>
              <button
                style={S.btnPrimary}
                onClick={() => exportarContratoIndividualPdf(municipioPublico)}
                disabled={exportandoPdf}
              >
                {exportandoPdf ? "⏳ Gerando PDF..." : "📥 Baixar contrato assinado (PDF)"}
              </button>
            </div>
          )}

          {municipioPublico && !assinaturaPublicaProcessando && municipioPublico.status !== "assinado" && (
            <div style={{ border: "1px solid var(--color-border-info)", borderRadius: 8, padding: 14, background: "var(--color-background-info)" }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>✍ Assinar documento</div>
              <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.6, background: "#fff", border: "1px solid var(--color-border-tertiary)", borderRadius: 6, padding: "10px 12px" }}>
                  <strong>Hash SHA-256 do documento congelado:</strong><br />
                  <span style={{ fontFamily: "monospace", fontSize: 11, wordBreak: "break-all" }}>
                    {municipioPublico.documentHash || "indisponível"}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8 }}>
                  <input
                    style={S.input}
                    placeholder="Código OTP de 6 dígitos"
                    value={assinaturaPublicaOtpCode}
                    onChange={(e) => setAssinaturaPublicaOtpCode(String(e.target.value || "").replace(/\D/g, "").slice(0, 6))}
                  />
                  <button style={S.btn} onClick={() => enviarOtpPublico(municipioPublico)} disabled={assinaturaPublicaOtpSending}>
                    {assinaturaPublicaOtpSending ? "⏳ Enviando OTP..." : "📩 Enviar OTP"}
                  </button>
                  <button style={S.btn} onClick={() => validarOtpPublico(municipioPublico)} disabled={assinaturaPublicaOtpValidating}>
                    {assinaturaPublicaOtpValidating ? "⏳ Validando..." : "✅ Validar OTP"}
                  </button>
                </div>
                {assinaturaPublicaOtpVerifiedAt && (
                  <div style={{ fontSize: 12, color: "var(--color-text-success)" }}>
                    OTP validado em {new Date(assinaturaPublicaOtpVerifiedAt).toLocaleString("pt-BR")}
                  </div>
                )}
                <input
                  style={S.input}
                  placeholder="Nome do signatário"
                  value={assinaturaPublicaNome}
                  onChange={(e) => setAssinaturaPublicaNome(e.target.value)}
                />
                <input
                  style={S.input}
                  placeholder="CPF (somente números)"
                  value={formatCpf(assinaturaPublicaCpf)}
                  onChange={(e) => setAssinaturaPublicaCpf(normalizeCpf(e.target.value))}
                />
                <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                  Desenhe sua assinatura no campo abaixo:
                </div>
                <canvas
                  ref={assinaturaCanvasRef}
                  onPointerDown={startCanvasStroke}
                  onPointerMove={moveCanvasStroke}
                  onPointerUp={endCanvasStroke}
                  onPointerLeave={endCanvasStroke}
                  style={{ width: "100%", border: "1px dashed var(--color-border-tertiary)", borderRadius: 6, background: "#fff", touchAction: "none" }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={S.btn} onClick={clearSignatureCanvas}>🧹 Limpar assinatura</button>
                </div>
                <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: "var(--color-text-secondary)" }}>
                  <input
                    type="checkbox"
                    checked={assinaturaPublicaAceite}
                    onChange={(e) => setAssinaturaPublicaAceite(e.target.checked)}
                  />
                  Declaro que li o documento acima e confirmo minha assinatura eletrônica neste ato.
                </label>
                {assinaturaPublicaErro && (
                  <div style={{ fontSize: 12, color: "var(--color-text-danger)" }}>
                    ❌ {assinaturaPublicaErro}
                  </div>
                )}
                <button
                  style={S.btnPrimary}
                  onClick={() => assinarDocumentoPublico(municipioPublico)}
                  disabled={assinaturaPublicaProcessando || !assinaturaPublicaOtpVerifiedAt || !municipioPublico.documentHash}
                >
                  ✅ Confirmar assinatura
                </button>
              </div>
            </div>
          )}
        </div>

        {municipioPublico && (
          <DocPreview
            municipio={municipioPublico.nome}
            docHtml={documentoPublicoHtml}
            signData={signDataPublico || null}
          />
        )}

        {toast && <div style={S.toast}>{toast}</div>}
      </div>
    );
  }

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
          title="Disparar links de assinatura para todos os municípios"
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
      <div style={{ marginBottom: "1.25rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
            {stats.assinados} de {totalMunicipios} municípios assinaram
          </span>
          <span style={{ fontSize: 11, fontWeight: 500, color: pct > 0 ? "var(--color-text-success)" : "var(--color-text-tertiary)" }}>
            {pct}%
          </span>
        </div>
        <div style={S.progress}>
          <div style={S.progressFill(pct)} />
        </div>
      </div>

      {/* Abas */}
      <div style={{ position: "relative", display: "flex", alignItems: "stretch", marginBottom: "1.5rem", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
        <button
          aria-label="Rolar abas para esquerda"
          onClick={() => tabBarRef.current?.scrollBy({ left: -160, behavior: "smooth" })}
          style={{ flexShrink: 0, border: "none", background: "var(--color-background-primary)", color: "var(--color-text-secondary)", cursor: "pointer", padding: "0 6px", fontSize: 14 }}
        >‹</button>
        <div ref={tabBarRef} style={S.tabBar}>
          {TABS.map((t) => (
            <button key={t.id} style={S.tab(tab === t.id)} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <button
          aria-label="Rolar abas para direita"
          onClick={() => tabBarRef.current?.scrollBy({ left: 160, behavior: "smooth" })}
          style={{ flexShrink: 0, border: "none", background: "var(--color-background-primary)", color: "var(--color-text-secondary)", cursor: "pointer", padding: "0 6px", fontSize: 14 }}
        >›</button>
      </div>

      {/* ── ABA: PAINEL ── */}
      {tab === "painel" && (
        <div>
          <div style={S.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={S.sectionTitle}>Integração com Backend</div>
              <div style={{ fontSize: 11, color: apiStatus === "online" ? "var(--color-text-success)" : "var(--color-text-danger)" }}>
                API: {apiStatus === "online" ? "Online" : apiStatus === "offline" ? "Offline" : "Verificando..."}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, marginBottom: 8 }}>
              <input
                style={S.input}
                placeholder="email"
                value={apiAuth.email}
                onChange={(e) => setApiAuth((prev) => ({ ...prev, email: e.target.value }))}
              />
              <input
                style={S.input}
                type="password"
                placeholder="senha"
                value={apiAuth.password}
                onChange={(e) => setApiAuth((prev) => ({ ...prev, password: e.target.value }))}
              />
              <button style={S.btnPrimary} onClick={loginBackend}>🔐 Login API</button>
            </div>

            {apiUser && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8 }}>
                <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                  Conectado como {apiUser.nome} ({apiUser.role}) {apiSyncing ? "• sincronizando..." : "• sincronizado"}
                </div>
                <button
                  style={S.btnSm}
                  onClick={logoutBackend}
                >
                  Sair da API
                </button>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, alignItems: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <label style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>De:</label>
                <input
                  style={S.input}
                  type="date"
                  value={apiDashboardFilters.from}
                  onChange={(e) => setApiDashboardFilters((prev) => ({ ...prev, from: e.target.value }))}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <label style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Até:</label>
                <input
                  style={S.input}
                  type="date"
                  value={apiDashboardFilters.to}
                  onChange={(e) => setApiDashboardFilters((prev) => ({ ...prev, to: e.target.value }))}
                />
              </div>
              <input
                style={S.input}
                placeholder="Secretaria"
                value={apiDashboardFilters.secretaria}
                onChange={(e) => setApiDashboardFilters((prev) => ({ ...prev, secretaria: e.target.value }))}
              />
              <button style={S.btn} onClick={carregarDashboardApi}>Atualizar</button>
            </div>

            {apiDashboard?.kpi && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginTop: 10 }}>
                <div style={S.statCard}><div style={S.statNum}>{apiDashboard.kpi.total_processos}</div><div style={S.statLabel}>Processos</div></div>
                <div style={S.statCard}><div style={S.statNum}>{apiDashboard.kpi.total_documentos}</div><div style={S.statLabel}>Documentos</div></div>
                <div style={S.statCard}><div style={S.statNum}>{apiDashboard.kpi.media_versoes_por_processo}</div><div style={S.statLabel}>Média versões</div></div>
                <div style={S.statCard}><div style={{ ...S.statNum, color: "var(--color-text-warning)" }}>{apiDashboard.kpi.processos_atrasados}</div><div style={S.statLabel}>Atrasados</div></div>
              </div>
            )}
          </div>

          <div style={S.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8 }}>
              <div style={S.sectionTitle}>Processos e documentos (API)</div>
              <button
                style={S.btn}
                onClick={() => carregarProcessosApi()}
                disabled={!apiToken || apiProcessosLoading}
              >
                {apiProcessosLoading ? "⏳ Atualizando..." : "↻ Atualizar lista"}
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 160px auto", gap: 8, marginBottom: 8 }}>
              <input
                style={S.input}
                placeholder="Buscar por número ou título"
                value={apiProcessosFilters.search}
                onChange={(e) => setApiProcessosFilters((prev) => ({ ...prev, search: e.target.value }))}
              />
              <input
                style={S.input}
                placeholder="Filtrar por secretaria"
                value={apiProcessosFilters.secretaria}
                onChange={(e) => setApiProcessosFilters((prev) => ({ ...prev, secretaria: e.target.value }))}
              />
              <select
                style={S.input}
                value={apiProcessosFilters.status}
                onChange={(e) => setApiProcessosFilters((prev) => ({ ...prev, status: e.target.value }))}
              >
                <option value="">Todos os status</option>
                {PROCESSO_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
              <button
                style={S.btn}
                onClick={() => carregarProcessosApi()}
                disabled={!apiToken || apiProcessosLoading}
              >
                Filtrar
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 1.4fr 170px auto", gap: 8, marginBottom: 12 }}>
              <input
                style={S.input}
                placeholder="Nº processo"
                value={apiNovoProcesso.numero}
                onChange={(e) => setApiNovoProcesso((prev) => ({ ...prev, numero: e.target.value }))}
              />
              <input
                style={S.input}
                placeholder="Secretaria"
                value={apiNovoProcesso.secretaria}
                onChange={(e) => setApiNovoProcesso((prev) => ({ ...prev, secretaria: e.target.value }))}
              />
              <input
                style={S.input}
                placeholder="Título"
                value={apiNovoProcesso.titulo}
                onChange={(e) => setApiNovoProcesso((prev) => ({ ...prev, titulo: e.target.value }))}
              />
              <select
                style={S.input}
                value={apiNovoProcesso.status}
                onChange={(e) => setApiNovoProcesso((prev) => ({ ...prev, status: e.target.value }))}
              >
                {PROCESSO_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
              <button
                style={S.btnPrimary}
                onClick={criarProcessoApi}
                disabled={!apiToken || apiProcessoSaving}
              >
                {apiProcessoSaving ? "⏳" : "➕"} Criar
              </button>
            </div>

            {apiProcessos.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 12 }}>
                Nenhum processo retornado com os filtros atuais.
              </div>
            ) : (
              <div style={{ maxHeight: 220, overflowY: "auto", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 8, marginBottom: 12 }}>
                {apiProcessos.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.1fr 1fr 1.4fr 170px auto",
                      gap: 8,
                      alignItems: "center",
                      padding: "8px 10px",
                      borderBottom: "0.5px solid var(--color-border-tertiary)",
                      background: item.id === apiProcessoSelecionadoId ? "var(--color-background-info)" : "var(--color-background-primary)",
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 600 }}>{item.numero}</div>
                    <div style={{ fontSize: 11 }}>{item.secretaria}</div>
                    <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{item.titulo}</div>
                    <select
                      style={{ ...S.input, height: 30, padding: "2px 8px" }}
                      value={item.status}
                      onChange={(e) => atualizarStatusProcessoApi(item.id, e.target.value)}
                    >
                      {PROCESSO_STATUS_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                      ))}
                    </select>
                    <button
                      style={S.btnSm}
                      onClick={() => {
                        setApiProcessoSelecionadoId(item.id);
                        setEtapaFluxo(item.status);
                      }}
                    >
                      {item.id === apiProcessoSelecionadoId ? "Selecionado" : "Selecionar"}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {apiProcessoSelecionadoId && (
              <div style={{ borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8 }}>
                  Upload de documento para o processo selecionado
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, marginBottom: 8 }}>
                  <input
                    ref={apiDocFileInputRef}
                    type="file"
                    style={S.input}
                    onChange={(e) => setApiDocumentoArquivo(e.target.files?.[0] || null)}
                  />
                  <input
                    style={S.input}
                    placeholder="Observações da versão (opcional)"
                    value={apiDocumentoNotes}
                    onChange={(e) => setApiDocumentoNotes(e.target.value)}
                  />
                  <button
                    style={S.btnPrimary}
                    onClick={enviarDocumentoProcessoApi}
                    disabled={!apiToken || apiDocUploading}
                  >
                    {apiDocUploading ? "⏳" : "📤"} Enviar
                  </button>
                </div>

                {apiDocumentos.length === 0 ? (
                  <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                    Nenhuma versão enviada para este processo.
                  </div>
                ) : (
                  <div style={{ maxHeight: 150, overflowY: "auto", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 8 }}>
                    {apiDocumentos.map((doc) => (
                      <div
                        key={doc.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "70px 1fr 110px 150px auto",
                          gap: 8,
                          fontSize: 11,
                          padding: "7px 8px",
                          borderBottom: "0.5px solid var(--color-border-tertiary)",
                          alignItems: "center",
                        }}
                      >
                        <div>v{doc.version}</div>
                        <div style={{ color: "var(--color-text-secondary)" }}>{doc.file_name}</div>
                        <div>{Math.round((doc.size_bytes || 0) / 1024)} KB</div>
                        <div style={{ color: "var(--color-text-tertiary)" }}>
                          {doc.created_at ? new Date(doc.created_at).toLocaleString("pt-BR") : "-"}
                        </div>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                          <button
                            style={S.btnSm}
                            onClick={() => baixarDocumentoProcessoApi(doc.id, doc.file_name, true)}
                            title="Abrir em nova aba (com fallback para download)"
                          >
                            👁️ Abrir
                          </button>
                          <button
                            style={S.btnSm}
                            onClick={() => baixarDocumentoProcessoApi(doc.id, doc.file_name)}
                            title="Baixar esta versão"
                          >
                            📥 Baixar
                          </button>
                          <button
                            style={S.btnSm}
                            onClick={() => copiarLinkDocumentoApi(doc.id)}
                            title="Copiar endpoint da API sem token"
                          >
                            🔗 Link
                          </button>
                          <button
                            style={S.btnSm}
                            onClick={() => copiarComandoDownloadDocumentoApi(doc.id, doc.file_name)}
                            title="Copiar comando autenticado"
                          >
                            📋 cURL
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={S.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8 }}>
              <div style={S.sectionTitle}>Alertas SLA e notificações (API)</div>
              <button
                style={S.btn}
                onClick={carregarAlertasSlaApi}
                disabled={!apiToken || apiSlaLoading}
              >
                {apiSlaLoading ? "⏳ Consultando..." : "🔎 Consultar SLA"}
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "170px 1fr auto", gap: 8, marginBottom: 10 }}>
              <input
                style={S.input}
                type="number"
                min="1"
                value={apiSlaFilters.days}
                onChange={(e) => setApiSlaFilters((prev) => ({ ...prev, days: e.target.value }))}
                placeholder="Dias em atraso"
              />
              <input
                style={S.input}
                value={apiSlaFilters.secretaria}
                onChange={(e) => setApiSlaFilters((prev) => ({ ...prev, secretaria: e.target.value }))}
                placeholder="Filtrar por secretaria (opcional)"
              />
              <button
                style={S.btn}
                onClick={carregarAlertasSlaApi}
                disabled={!apiToken || apiSlaLoading}
              >
                Atualizar
              </button>
            </div>

            <div style={{ marginBottom: 10, fontSize: 12, color: "var(--color-text-secondary)" }}>
              Processos atrasados no SLA: <strong>{apiSlaData.total || 0}</strong>
            </div>

            {apiSlaData.items.length > 0 && (
              <div style={{ maxHeight: 150, overflowY: "auto", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 8, marginBottom: 12 }}>
                {apiSlaData.items.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "130px 1fr 1.5fr 160px",
                      gap: 8,
                      padding: "7px 8px",
                      borderBottom: "0.5px solid var(--color-border-tertiary)",
                      fontSize: 11,
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{item.numero}</div>
                    <div>{item.secretaria}</div>
                    <div style={{ color: "var(--color-text-secondary)" }}>{item.titulo}</div>
                    <div style={{ color: "var(--color-text-tertiary)" }}>
                      {item.updated_at ? new Date(item.updated_at).toLocaleString("pt-BR") : "-"}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8 }}>Enviar notificação de SLA</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                <input
                  style={S.input}
                  value={apiNotify.to}
                  onChange={(e) => setApiNotify((prev) => ({ ...prev, to: e.target.value }))}
                  placeholder="destino@orgao.mg.gov.br"
                />
                <input
                  style={S.input}
                  value={apiNotify.subject}
                  onChange={(e) => setApiNotify((prev) => ({ ...prev, subject: e.target.value }))}
                  placeholder="Assunto"
                />
              </div>
              <textarea
                style={{ ...S.input, minHeight: 110, resize: "vertical" }}
                value={apiNotify.html}
                onChange={(e) => setApiNotify((prev) => ({ ...prev, html: e.target.value }))}
                placeholder="Conteúdo HTML da notificação"
              />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                <button
                  style={S.btnPrimary}
                  onClick={enviarNotificacaoSlaApi}
                  disabled={!apiToken || apiNotifySending}
                >
                  {apiNotifySending ? "⏳ Enviando..." : "📨 Enviar notificação"}
                </button>
              </div>
            </div>
          </div>

          <div style={S.statsGrid}>
            <div style={S.statCard}>
              <div style={S.statNum}>{taxaAssinatura}%</div>
              <div style={S.statLabel}>Taxa de assinatura</div>
            </div>
            <div style={S.statCard}>
              <div style={{ ...S.statNum, color: "var(--color-text-warning)" }}>{atrasados}</div>
              <div style={S.statLabel}>Municípios em atraso</div>
            </div>
            <div style={S.statCard}>
              <div style={{ ...S.statNum, color: "var(--color-text-info)" }}>{stats.enviados}</div>
              <div style={S.statLabel}>Com envio iniciado</div>
            </div>
            <div style={S.statCard}>
              <div style={{ ...S.statNum, color: "var(--color-text-success)" }}>{stats.assinados}</div>
              <div style={S.statLabel}>Contratos assinados</div>
            </div>
          </div>

          <div style={S.card}>
            <div style={S.sectionTitle}>Assinaturas por período (últimos 7 registros)</div>
            {serieAssinaturas.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                Ainda não há assinaturas para montar o gráfico.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {serieAssinaturas.map(([dia, qtd]) => {
                  const max = Math.max(...serieAssinaturas.map(([, value]) => value), 1);
                  const width = Math.max(8, Math.round((qtd / max) * 100));
                  return (
                    <div key={dia} style={{ display: "grid", gridTemplateColumns: "110px 1fr 40px", gap: 10, alignItems: "center" }}>
                      <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{dia}</div>
                      <div style={{ background: "var(--color-background-secondary)", height: 10, borderRadius: 999 }}>
                        <div style={{ width: `${width}%`, height: 10, borderRadius: 999, background: "var(--color-text-info)" }} />
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 500 }}>{qtd}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ABA: EDITOR ── */}
      {tab === "editor" && (
        <div>
          <div style={S.card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ ...S.sectionTitle, marginBottom: 0 }}>Dados do consórcio (timbrado do documento)</div>
              {consorcio.nome && (
                <span style={{ fontSize: 11, color: "var(--color-text-success)", display: "flex", alignItems: "center", gap: 4 }}>
                  ✓ Dados salvos
                </span>
              )}
            </div>
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
                  onChange={(e) => {
                    const raw = e.target.value;
                    const val = k === "cnpj" ? maskCnpj(raw) : raw;
                    setConsorcio((p) => ({ ...p, [k]: val }));
                  }}
                />
              ))}
            </div>
          </div>

          <div style={S.card}>
            <div style={{
              display: "flex", alignItems: "center",
              justifyContent: "space-between", marginBottom: 10,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ ...S.sectionTitle, marginBottom: 0 }}>Corpo do documento</div>
                {docSavedAt && (
                  <span style={{ fontSize: 10, color: "var(--color-text-success)" }}>
                    ✓ Salvo às {docSavedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  style={S.btn}
                  onClick={() => {
                    const template = buildManifestacaoTemplate(consorcio.nome || "CIMAG");
                    setDocHtml(template);
                    showToast("🧾 Modelo oficial aplicado");
                  }}
                >
                  🧾 Inserir modelo oficial
                </button>
                <button
                  style={S.btn}
                  onClick={() => {
                    const template = buildLicitacaoTemplate(consorcio.nome || "CIMAG");
                    setDocHtml(template);
                    showToast("🏛 Modelo de licitação aplicado");
                  }}
                >
                  🏛 Inserir modelo licitação
                </button>
                <button style={S.btn} onClick={abrirModalCamposLicitacao}>
                  🧩 Preencher campos automáticos
                </button>
                <button style={S.btnPrimary} onClick={abrirModalVincularPrefeituras}>
                  🏛 Vincular prefeituras e disparar assinatura
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
                  <button
                    style={{ ...S.btn, color: "var(--color-text-danger)", borderColor: "var(--color-border-danger)" }}
                    onClick={() => {
                      if (window.confirm("Limpar o documento? Esta ação não pode ser desfeita.")) {
                        setDocHtml("");
                        showToast("🗑️ Documento limpo");
                      }
                    }}
                  >
                    🗑️ Limpar
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
        </div>
      )}

      {/* ── ABA: MUNICÍPIOS ── */}
      {tab === "municipios" && (
        <div>
          <div style={{ ...S.card, marginBottom: 12 }}>
            <div style={S.sectionTitle}>Cadastrar município</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8 }}>
              <input
                style={{ ...S.input, borderColor: novoMunicipioErrors.nome ? "var(--color-border-danger)" : "var(--color-border-secondary)" }}
                placeholder="Nome do município"
                value={novoMunicipioNome}
                onChange={(e) => setNovoMunicipioNome(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && cadastrarMunicipio()}
              />
              <input
                style={{ ...S.input, borderColor: novoMunicipioErrors.email ? "var(--color-border-danger)" : "var(--color-border-secondary)" }}
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
            {(novoMunicipioErrors.nome || novoMunicipioErrors.email) && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, marginTop: 6 }}>
                <div style={{ fontSize: 11, color: "var(--color-text-danger)" }}>{novoMunicipioErrors.nome}</div>
                <div style={{ fontSize: 11, color: "var(--color-text-danger)" }}>{novoMunicipioErrors.email}</div>
                <div />
              </div>
            )}

            <div style={{ marginTop: 12, borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: 10 }}>
              <div style={{ ...S.sectionTitle, fontSize: 13, marginBottom: 8 }}>Importação em lote (CSV/Excel)</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input
                  type="file"
                  accept=".csv,.xls,.xlsx"
                  onChange={processarArquivoImportacao}
                  style={{ fontSize: 12 }}
                />
                {importFileName && (
                  <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Arquivo: {importFileName}</div>
                )}
                {importSummary && (
                  <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                    Total: {importSummary.total} | Válidos: {importSummary.valid} | Inválidos: {importSummary.invalid}
                  </div>
                )}
                {importRows.length > 0 && (
                  <button style={S.btnPrimary} onClick={confirmarImportacao}>✅ Confirmar importação</button>
                )}
              </div>
              {importRows.length > 0 && (
                <div style={{ marginTop: 10, maxHeight: 160, overflowY: "auto", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 8 }}>
                  {importRows.map((row) => (
                    <div
                      key={`${row.rowIndex}-${row.nome}-${row.email}`}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "58px 1fr 1fr 1.4fr",
                        gap: 8,
                        padding: "6px 8px",
                        borderBottom: "0.5px solid var(--color-border-tertiary)",
                        fontSize: 11,
                      }}
                    >
                      <div>L{row.rowIndex}</div>
                      <div>{row.nome || "-"}</div>
                      <div>{row.email || "-"}</div>
                      <div style={{ color: row.valid ? "var(--color-text-success)" : "var(--color-text-danger)" }}>
                        {row.valid ? "Válido" : row.issues.join("; ")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {editandoMunicipioId !== null && (
              <div style={{ marginTop: 10, borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: 10 }}>
                <div style={{ ...S.sectionTitle, fontSize: 13, marginBottom: 8 }}>Editar município</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto auto", gap: 8 }}>
                  <input
                    style={{ ...S.input, borderColor: edicaoMunicipioErrors.nome ? "var(--color-border-danger)" : "var(--color-border-secondary)" }}
                    placeholder="Nome do município"
                    value={edicaoMunicipioNome}
                    onChange={(e) => setEdicaoMunicipioNome(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && salvarEdicaoMunicipio()}
                  />
                  <input
                    style={{ ...S.input, borderColor: edicaoMunicipioErrors.email ? "var(--color-border-danger)" : "var(--color-border-secondary)" }}
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
                {(edicaoMunicipioErrors.nome || edicaoMunicipioErrors.email) && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto auto", gap: 8, marginTop: 6 }}>
                    <div style={{ fontSize: 11, color: "var(--color-text-danger)" }}>{edicaoMunicipioErrors.nome}</div>
                    <div style={{ fontSize: 11, color: "var(--color-text-danger)" }}>{edicaoMunicipioErrors.email}</div>
                    <div />
                    <div />
                  </div>
                )}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
            <input
              style={{ ...S.input, maxWidth: 300 }}
              placeholder="Buscar município..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setMuniPage(0); }}
            />
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginLeft: "auto" }}>
              Horários de ativação escalonados automaticamente
            </div>
          </div>

          <div style={{ ...S.card, marginBottom: 12 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                {selecionados.length} selecionado(s)
              </div>
              <button style={S.btnSm} onClick={enviarSelecionados}>📨 Enviar selecionados</button>
              <select
                style={{ ...S.input, maxWidth: 170, height: 28, padding: "2px 8px", fontSize: 12 }}
                value={statusEmMassa}
                onChange={(e) => setStatusEmMassa(e.target.value)}
              >
                <option value="pendente">Pendente</option>
                <option value="enviado">Enviado</option>
                <option value="assinado">Assinado</option>
              </select>
              <button style={S.btnSm} onClick={aplicarStatusEmMassa}>🧩 Aplicar status</button>
              <button style={{ ...S.btnSm, color: "var(--color-text-danger)" }} onClick={excluirSelecionados}>🗑️ Excluir selecionados</button>
              <button style={S.btnSm} onClick={limparSelecao}>Limpar seleção</button>
            </div>
          </div>

          <div style={S.card}>
            <div>
              <div style={{
                display: "grid",
                gridTemplateColumns: "28px 1fr 140px 90px 180px",
                gap: 8, padding: "6px 0",
                fontSize: 11, color: "var(--color-text-tertiary)",
                borderBottom: "0.5px solid var(--color-border-tertiary)",
                marginBottom: 4,
              }}>
                <span style={{ textAlign: "center" }}>
                  <input type="checkbox" checked={allFilteredSelected} onChange={toggleSelecionarTodosFiltrados} />
                </span>
                <span>Município</span>
                <span style={{ textAlign: "center" }}>Ativação do link</span>
                <span style={{ textAlign: "center" }}>Status</span>
                <span style={{ textAlign: "center" }}>Ações</span>
              </div>
              {filteredPage.map((m) => (
                <div
                  key={m.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "28px 1fr 140px 90px 180px",
                    alignItems: "center", gap: 8,
                    padding: "9px 0",
                    borderBottom: "0.5px solid var(--color-border-tertiary)",
                  }}
                >
                  <div style={{ textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={selecionados.includes(m.id)}
                      onChange={() => toggleSelecionado(m.id)}
                    />
                  </div>
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
                  <div style={{ display: "flex", gap: 3, justifyContent: "center" }}>
                    <button
                      style={S.btnSm}
                      onClick={() => copyLink(m)}
                      aria-label="Copiar link de assinatura"
                      title="Copiar link"
                    >
                      🔗 Link
                    </button>
                    <button
                      style={S.btnSm}
                      onClick={() => { setSelectedMuni(m); setTab("assinatura"); }}
                      aria-label="Simular assinatura"
                      title="Simular assinatura"
                    >
                      ✍ Ass.
                    </button>
                    <button
                      style={S.btnSm}
                      onClick={() => iniciarEdicaoMunicipio(m)}
                      aria-label="Editar município"
                      title="Editar município"
                    >
                      ✏️ Edit.
                    </button>
                    <button
                      style={{ ...S.btnSm, color: "var(--color-text-danger)" }}
                      onClick={() => excluirMunicipio(m)}
                      aria-label="Excluir município"
                      title="Excluir município"
                    >
                      🗑️
                    </button>
                    {m.status === "pendente" && (
                      <button
                        style={{ ...S.btnSm, color: "var(--color-text-info)" }}
                        onClick={() => enviarUm(m.id)}
                        aria-label="Enviar link de assinatura"
                        title="Enviar link"
                      >
                        📨 Env.
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {/* Paginação */}
            {muniTotalPages > 1 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 12, paddingTop: 10, borderTop: "0.5px solid var(--color-border-tertiary)" }}>
                <button
                  style={{ ...S.btnSm, opacity: muniPage === 0 ? 0.4 : 1 }}
                  disabled={muniPage === 0}
                  onClick={() => setMuniPage((p) => p - 1)}
                >
                  ‹ Anterior
                </button>
                <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                  Página {muniPage + 1} de {muniTotalPages} ({filtered.length} municípios)
                </span>
                <button
                  style={{ ...S.btnSm, opacity: muniPage >= muniTotalPages - 1 ? 0.4 : 1 }}
                  disabled={muniPage >= muniTotalPages - 1}
                  onClick={() => setMuniPage((p) => p + 1)}
                >
                  Próxima ›
                </button>
              </div>
            )}
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
            <div style={S.sectionTitle}>Trilha de auditoria</div>
            {auditoria.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                Nenhum evento registrado ainda.
              </div>
            ) : (
              <div style={{ maxHeight: 180, overflowY: "auto", display: "grid", gap: 6 }}>
                {auditoria.slice(0, 25).map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "160px 220px 1fr",
                      gap: 8,
                      fontSize: 11,
                      borderBottom: "0.5px solid var(--color-border-tertiary)",
                      paddingBottom: 6,
                    }}
                  >
                    <div style={{ color: "var(--color-text-secondary)" }}>{new Date(item.at).toLocaleString("pt-BR")}</div>
                    <div style={{ fontWeight: 500 }}>{AUDIT_LABELS[item.acao] || item.acao}</div>
                    <div>{item.detalhes}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

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
                        <span>🌐 {m.ip || "Não disponível"}</span>
                        <span style={{ fontFamily: "monospace" }}>🔐 {m.hash}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 4, wordBreak: "break-all" }}>
                        💻 {m.device || "Aparelho não identificado"}
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

      {modal === "vincular-prefeituras" && (
        <div style={S.modalOverlay} onClick={() => setModal(null)}>
          <div
            style={{ ...S.modal, maxWidth: 760, maxHeight: "85vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
              🏛 Vincular prefeituras e e-mails para assinatura
            </div>
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 0 }}>
              Selecione as prefeituras que receberão o link de assinatura deste documento por e-mail.
            </p>

            <input
              style={{ ...S.input, marginBottom: 10 }}
              placeholder="Buscar prefeitura por nome ou e-mail..."
              value={editorVinculosBusca}
              onChange={(e) => setEditorVinculosBusca(e.target.value)}
            />

            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <button
                style={S.btnSm}
                onClick={() => setEditorVinculosSelecionados(municipios.map((m) => m.id))}
              >
                Marcar todas
              </button>
              <button
                style={S.btnSm}
                onClick={() => setEditorVinculosSelecionados([])}
              >
                Limpar seleção
              </button>
              <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--color-text-secondary)" }}>
                {editorVinculosSelecionados.length} selecionada(s)
              </div>
            </div>

            <div style={{ border: "0.5px solid var(--color-border-tertiary)", borderRadius: 8, maxHeight: 300, overflowY: "auto", marginBottom: 12 }}>
              {municipios
                .filter((m) => {
                  const termo = editorVinculosBusca.trim().toLowerCase();
                  if (!termo) return true;
                  return `${m.nome} ${m.email}`.toLowerCase().includes(termo);
                })
                .map((m) => {
                const isSelected = editorVinculosSelecionados.includes(m.id);
                const emailValido = EMAIL_INSTITUCIONAL_RE.test(String(m.email || "").trim().toLowerCase());
                return (
                  <label
                    key={m.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "22px 1fr auto",
                      gap: 8,
                      alignItems: "center",
                      padding: "7px 10px",
                      borderBottom: "0.5px solid var(--color-border-tertiary)",
                      cursor: "pointer",
                      opacity: emailValido ? 1 : 0.65,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => alternarVinculoPrefeitura(m.id)}
                    />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{m.nome}</div>
                      <div style={{ fontSize: 11, color: emailValido ? "var(--color-text-secondary)" : "var(--color-text-danger)" }}>
                        {m.email || "Sem e-mail"}
                      </div>
                    </div>
                    <div style={{ fontSize: 10, color: "var(--color-text-tertiary)" }}>
                      {emailValido ? "email ok" : "email inválido"}
                    </div>
                  </label>
                );
              })}
              {municipios.filter((m) => {
                const termo = editorVinculosBusca.trim().toLowerCase();
                if (!termo) return true;
                return `${m.nome} ${m.email}`.toLowerCase().includes(termo);
              }).length === 0 && (
                <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--color-text-secondary)" }}>
                  Nenhuma prefeitura encontrada para o filtro informado.
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                style={{ ...S.btnPrimary, flex: 1, justifyContent: "center" }}
                onClick={dispararAssinaturaPeloEditor}
              >
                🚀 Disparar e-mails de assinatura
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
