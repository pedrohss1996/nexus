const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { parseDocument } = require('htmlparser2');
const https = require('https');
const http = require('http');

/**
 * Substitui variáveis no formato {{variavel}} por valores reais
 */
function substituirVariaveis(template, variaveis) {
  let resultado = template;
  
  for (const [chave, valor] of Object.entries(variaveis)) {
    const regex = new RegExp(`{{${chave}}}`, 'g');
    resultado = resultado.replace(regex, valor || '');
  }
  
  return resultado;
}

/**
 * Baixa imagem de URL
 */
function baixarImagem(url) {
  return new Promise((resolve, reject) => {
    const protocolo = url.startsWith('https') ? https : http;
    
    protocolo.get(url, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Parser HTML avançado para PDF
 */
class HTMLtoPDFParser {
  constructor(doc, opcoes = {}) {
    this.doc = doc;
    this.opcoes = {
      x: opcoes.x || 50,
      y: opcoes.y || 50,
      width: opcoes.width || 495,
      lineHeight: opcoes.lineHeight || 1.5,
      fontSize: opcoes.fontSize || 12
    };
    
    this.currentY = this.opcoes.y;
    this.currentX = this.opcoes.x;
    this.stack = [];
    this.textBuffer = '';
    this.currentStyles = {
      bold: false,
      italic: false,
      underline: false,
      strike: false,
      fontSize: this.opcoes.fontSize,
      color: '#000000',
      background: null,
      align: 'left'
    };
  }

  aplicarEstilos() {
    const { bold, italic } = this.currentStyles;
    
    let font = 'Helvetica';
    if (bold && italic) font = 'Helvetica-BoldOblique';
    else if (bold) font = 'Helvetica-Bold';
    else if (italic) font = 'Helvetica-Oblique';
    
    this.doc.font(font).fontSize(this.currentStyles.fontSize);
    
    // Cor do texto
    if (this.currentStyles.color) {
      this.doc.fillColor(this.currentStyles.color);
    }
  }

  processarNodo(node) {
    if (node.type === 'text') {
      this.adicionarTexto(node.data);
    } else if (node.type === 'tag') {
      this.processarTag(node);
    }
  }

  processarTag(node) {
    const tagName = node.name;
    const oldStyles = { ...this.currentStyles };

    switch (tagName) {
      case 'h1':
        this.finalizarLinha();
        this.currentY += 10;
        this.currentStyles.fontSize = 20;
        this.currentStyles.bold = true;
        this.processarFilhos(node);
        this.finalizarLinha();
        this.currentY += 10;
        break;

      case 'h2':
        this.finalizarLinha();
        this.currentY += 8;
        this.currentStyles.fontSize = 16;
        this.currentStyles.bold = true;
        this.processarFilhos(node);
        this.finalizarLinha();
        this.currentY += 8;
        break;

      case 'h3':
        this.finalizarLinha();
        this.currentY += 6;
        this.currentStyles.fontSize = 14;
        this.currentStyles.bold = true;
        this.processarFilhos(node);
        this.finalizarLinha();
        this.currentY += 6;
        break;

      case 'p':
        this.finalizarLinha();
        this.currentY += 5;
        
        // Processar atributos de estilo
        if (node.attribs && node.attribs.style) {
          this.aplicarEstilosCSS(node.attribs.style);
        }
        
        this.processarFilhos(node);
        this.finalizarLinha();
        this.currentY += 5;
        break;

      case 'strong':
      case 'b':
        this.currentStyles.bold = true;
        this.processarFilhos(node);
        break;

      case 'em':
      case 'i':
        this.currentStyles.italic = true;
        this.processarFilhos(node);
        break;

      case 'u':
        this.currentStyles.underline = true;
        this.processarFilhos(node);
        break;

      case 's':
      case 'strike':
        this.currentStyles.strike = true;
        this.processarFilhos(node);
        break;

      case 'br':
        this.finalizarLinha();
        this.currentY += 10;
        break;

      case 'ul':
      case 'ol':
        this.finalizarLinha();
        this.currentY += 5;
        this.processarLista(node, tagName === 'ol');
        this.currentY += 5;
        break;

      case 'table':
        this.finalizarLinha();
        this.currentY += 10;
        this.processarTabela(node);
        this.currentY += 10;
        break;

      case 'img':
        this.finalizarLinha();
        this.processarImagem(node);
        break;

      case 'div':
      case 'span':
        if (node.attribs && node.attribs.style) {
          this.aplicarEstilosCSS(node.attribs.style);
        }
        this.processarFilhos(node);
        break;

      default:
        this.processarFilhos(node);
    }

    this.currentStyles = oldStyles;
  }

  aplicarEstilosCSS(styleString) {
    const styles = styleString.split(';').reduce((acc, style) => {
      const [prop, value] = style.split(':').map(s => s.trim());
      if (prop && value) acc[prop] = value;
      return acc;
    }, {});

    if (styles['text-align']) {
      this.currentStyles.align = styles['text-align'];
    }

    if (styles['color']) {
      this.currentStyles.color = styles['color'];
    }

    if (styles['font-size']) {
      const size = parseInt(styles['font-size']);
      if (!isNaN(size)) this.currentStyles.fontSize = size;
    }

    if (styles['margin-top']) {
      const margin = parseInt(styles['margin-top']);
      if (!isNaN(margin)) this.currentY += margin / 2;
    }

    if (styles['margin-bottom']) {
      // Será aplicado após o texto
    }
  }

  processarFilhos(node) {
    if (node.children) {
      node.children.forEach(child => this.processarNodo(child));
    }
  }

  adicionarTexto(texto) {
    this.textBuffer += texto;
  }

  finalizarLinha() {
    if (this.textBuffer.trim()) {
      this.aplicarEstilos();
      
      this.doc.text(this.textBuffer, this.currentX, this.currentY, {
        width: this.opcoes.width,
        align: this.currentStyles.align,
        lineGap: 3
      });
      
      this.currentY = this.doc.y;
      this.textBuffer = '';
    }
  }

  processarLista(node, ordenada = false) {
    const items = node.children.filter(child => child.name === 'li');
    const oldX = this.currentX;
    this.currentX += 20;
    
    items.forEach((item, index) => {
      const marcador = ordenada ? `${index + 1}. ` : '• ';
      this.doc.text(marcador, oldX, this.currentY);
      
      this.processarFilhos(item);
      this.finalizarLinha();
      this.currentY += 5;
    });
    
    this.currentX = oldX;
  }

  processarTabela(node) {
    const tbody = node.children.find(child => child.name === 'tbody') || node;
    const rows = tbody.children.filter(child => child.name === 'tr');
    
    if (rows.length === 0) return;

    // Calcular largura das colunas
    const numCols = rows[0].children.filter(child => child.name === 'td' || child.name === 'th').length;
    const colWidth = this.opcoes.width / numCols;
    
    const startX = this.currentX;
    const startY = this.currentY;

    rows.forEach((row, rowIndex) => {
      const cells = row.children.filter(child => child.name === 'td' || child.name === 'th');
      const isHeader = cells.some(cell => cell.name === 'th');
      
      let maxCellHeight = 0;
      
      cells.forEach((cell, colIndex) => {
        const cellX = startX + (colIndex * colWidth);
        const cellY = this.currentY;
        
        // Desenhar borda da célula
        this.doc.rect(cellX, cellY, colWidth, 30).stroke();
        
        // Texto da célula
        const oldBold = this.currentStyles.bold;
        if (isHeader) this.currentStyles.bold = true;
        
        this.aplicarEstilos();
        const cellText = this.extrairTexto(cell);
        
        this.doc.text(cellText, cellX + 5, cellY + 8, {
          width: colWidth - 10,
          align: 'left'
        });
        
        this.currentStyles.bold = oldBold;
        maxCellHeight = Math.max(maxCellHeight, 30);
      });
      
      this.currentY += maxCellHeight;
    });
  }

  async processarImagem(node) {
    try {
      const src = node.attribs.src;
      if (!src) return;

      let imageBuffer;

      if (src.startsWith('data:image')) {
        // Base64
        const base64Data = src.split(',')[1];
        imageBuffer = Buffer.from(base64Data, 'base64');
      } else if (src.startsWith('http')) {
        // URL
        imageBuffer = await baixarImagem(src);
      } else {
        // Caminho local
        imageBuffer = fs.readFileSync(src);
      }

      const width = parseInt(node.attribs.width) || 200;
      const height = parseInt(node.attribs.height) || null;

      this.doc.image(imageBuffer, this.currentX, this.currentY, {
        width: width,
        height: height
      });

      this.currentY += height || 150;
      this.currentY += 10;

    } catch (error) {
      console.error('Erro ao processar imagem:', error);
      this.doc.text('[Imagem não disponível]', this.currentX, this.currentY);
      this.currentY += 20;
    }
  }

  extrairTexto(node) {
    if (node.type === 'text') return node.data;
    if (node.children) {
      return node.children.map(child => this.extrairTexto(child)).join('');
    }
    return '';
  }

  async parse(html) {
    const dom = parseDocument(html);
    
    for (const node of dom.children) {
      await this.processarNodo(node);
    }
    
    this.finalizarLinha();
    return this.currentY;
  }
}

/**
 * Gera um PDF a partir de HTML rico com variáveis
 */
async function gerarPDF(opcoes) {
  const {
    templateHTML,
    variaveis,
    outputPath,
    configuracoes = {}
  } = opcoes;
  
  return new Promise(async (resolve, reject) => {
    try {
      // Configurações padrão (tratando null/undefined)
      const configPadrao = {
        tamanho_pagina: 'A4',
        orientacao: 'portrait',
        margens: {
          top: 50,
          bottom: 50,
          left: 50,
          right: 50
        }
      };
      
      const configFinal = configuracoes || configPadrao;
      
      const config = {
        size: configFinal.tamanho_pagina || 'A4',
        layout: configFinal.orientacao || 'portrait',
        margins: configFinal.margens || configPadrao.margens
      };
      
      // Criar documento PDF
      const doc = new PDFDocument(config);
      
      // Criar diretório se não existir
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Criar stream de escrita
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);
      
      // Substituir variáveis no template
      const htmlComDados = substituirVariaveis(templateHTML, variaveis);
      
      // Parser HTML para PDF
      const parser = new HTMLtoPDFParser(doc, {
        x: config.margins.left,
        y: config.margins.top,
        width: 595.28 - config.margins.left - config.margins.right
      });
      
      await parser.parse(htmlComDados);
      
      // Adicionar rodapé com data de geração
      const pageHeight = 841.89;
      doc.fontSize(8)
         .fillColor('#666666')
         .text(
           `Documento gerado em ${new Date().toLocaleString('pt-BR')}`,
           config.margins.left,
           pageHeight - config.margins.bottom + 20,
           { width: 495.28, align: 'center' }
         );
      
      // Finalizar documento
      doc.end();
      
      // Aguardar conclusão da escrita
      stream.on('finish', () => {
        const stats = fs.statSync(outputPath);
        resolve({
          sucesso: true,
          caminho: outputPath,
          tamanho: stats.size
        });
      });
      
      stream.on('error', (error) => {
        reject(error);
      });
      
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Extrai variáveis de um template HTML (formato {{variavel}})
 */
function extrairVariaveis(templateHTML) {
  const regex = /{{(\w+)}}/g;
  const variaveis = new Set();
  let match;
  
  while ((match = regex.exec(templateHTML)) !== null) {
    variaveis.add(match[1]);
  }
  
  return Array.from(variaveis);
}

module.exports = {
  gerarPDF,
  substituirVariaveis,
  extrairVariaveis
};
