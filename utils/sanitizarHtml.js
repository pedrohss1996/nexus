// Utilitário: sanitização de HTML e serialização segura para <script>
//
// O conteúdo dos templates vem de editor WYSIWYG (req.body.conteudo_html) e era
// gravado cru e renderizado com <%- %>. Um <script> salvo num template executava
// para todo usuário que abrisse a listagem — XSS armazenado. O CSP não cobria
// isso porque libera 'unsafe-inline' e 'unsafe-eval'.
//
// A sanitização acontece na ESCRITA (uma vez), não na leitura: o HTML precisa
// continuar renderizável para o PDF e reescrever a cada exibição seria caro.

const sanitizeHtml = require('sanitize-html');

// Documentos gerados são ricos (tabelas, alinhamento, estilos para o PDF), então
// a allowlist é generosa em formatação e fechada em execução: nada de script,
// iframe, object, on* handlers ou javascript: em href/src.
const OPCOES_DOCUMENTO = {
  allowedTags: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'span', 'br', 'hr',
    'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'small', 'mark',
    'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
    'a', 'img', 'figure', 'figcaption'
  ],
  allowedAttributes: {
    '*': ['style', 'class', 'align', 'dir', 'title'],
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height'],
    table: ['border', 'cellpadding', 'cellspacing', 'width'],
    td: ['colspan', 'rowspan', 'width', 'height', 'valign'],
    th: ['colspan', 'rowspan', 'width', 'height', 'valign'],
    col: ['span', 'width']
  },
  // Só esquemas inertes — bloqueia javascript: e data: executável
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https', 'data'] },
  allowedStyles: {
    '*': {
      color: [/^.*$/],
      'background-color': [/^.*$/],
      'text-align': [/^(left|right|center|justify)$/],
      'font-size': [/^\d+(\.\d+)?(px|pt|em|rem|%)$/],
      'font-family': [/^[\w\s,'"-]+$/],
      'font-weight': [/^(normal|bold|bolder|lighter|\d{3})$/],
      'font-style': [/^(normal|italic|oblique)$/],
      'text-decoration': [/^[\w\s-]+$/],
      'line-height': [/^[\d.]+(px|pt|em|rem|%)?$/],
      margin: [/^[\d\s.a-z%-]+$/],
      'margin-top': [/^[\d.]+(px|pt|em|rem|%)$/],
      'margin-bottom': [/^[\d.]+(px|pt|em|rem|%)$/],
      'margin-left': [/^[\d.]+(px|pt|em|rem|%)$/],
      'margin-right': [/^[\d.]+(px|pt|em|rem|%)$/],
      padding: [/^[\d\s.a-z%-]+$/],
      'padding-top': [/^[\d.]+(px|pt|em|rem|%)$/],
      'padding-bottom': [/^[\d.]+(px|pt|em|rem|%)$/],
      'padding-left': [/^[\d.]+(px|pt|em|rem|%)$/],
      'padding-right': [/^[\d.]+(px|pt|em|rem|%)$/],
      border: [/^[\d\s.a-z#(),%-]+$/],
      'border-top': [/^[\d\s.a-z#(),%-]+$/],
      'border-bottom': [/^[\d\s.a-z#(),%-]+$/],
      'border-left': [/^[\d\s.a-z#(),%-]+$/],
      'border-right': [/^[\d\s.a-z#(),%-]+$/],
      'border-collapse': [/^(collapse|separate)$/],
      width: [/^[\d.]+(px|pt|em|rem|%)$/],
      height: [/^[\d.]+(px|pt|em|rem|%)$/],
      'min-height': [/^[\d.]+(px|pt|em|rem|%)$/],
      'page-break-inside': [/^(auto|avoid)$/],
      'page-break-before': [/^(auto|always|avoid)$/],
      'page-break-after': [/^(auto|always|avoid)$/],
      'letter-spacing': [/^[\d.-]+(px|pt|em|rem)$/],
      'text-transform': [/^(none|uppercase|lowercase|capitalize)$/],
      'vertical-align': [/^[\w-]+$/],
      display: [/^(block|inline|inline-block|table|table-cell|none|flex)$/]
    }
  },
  // Mantém o case das tags para não alterar os placeholders {{ASSINATURA:N}}
  parser: { lowerCaseTags: false }
};

function sanitizarDocumento(html) {
  if (!html) return html;
  return sanitizeHtml(String(html), OPCOES_DOCUMENTO);
}

// Caracteres montados por código para não depender de sequências de escape no
// fonte: U+2028/U+2029 são quebra de linha válida em JS e, escritos literalmente
// aqui, truncariam a própria expressão.
const BARRA = String.fromCharCode(92);   // \
const SEP_LINHA = String.fromCharCode(0x2028);
const SEP_PARAGRAFO = String.fromCharCode(0x2029);

// Serialização segura para embutir dados em bloco <script>.
// JSON.stringify NÃO escapa "</script>": uma string vinda do banco contendo essa
// sequência fecha o bloco e o resto é interpretado como HTML.
function jsonParaScript(valor) {
  return JSON.stringify(valor === undefined ? null : valor)
    .split('<').join(BARRA + 'u003c')
    .split('>').join(BARRA + 'u003e')
    .split(SEP_LINHA).join(BARRA + 'u2028')
    .split(SEP_PARAGRAFO).join(BARRA + 'u2029');
}

module.exports = { sanitizarDocumento, jsonParaScript, OPCOES_DOCUMENTO };
