const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

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
 * Converte HTML simples para comandos do PDFKit
 * Suporta: h1, p, strong, br, div com estilos básicos
 */
function htmlParaPDF(doc, html, opcoes = {}) {
  const defaultOpcoes = {
    x: 50,
    y: 50,
    width: 500,
    lineHeight: 1.5
  };
  
  const opt = { ...defaultOpcoes, ...opcoes };
  let currentY = opt.y;
  
  // Remove quebras de linha extras e espaços desnecessários
  html = html.replace(/\n\s*/g, ' ').trim();
  
  // Divide o HTML em elementos
  const elementos = html.match(/<[^>]+>.*?<\/[^>]+>|<br\s*\/?>/g) || [];
  
  elementos.forEach(elemento => {
    // Extrair texto e tag
    const tagMatch = elemento.match(/<(\w+)[^>]*>(.*?)<\/\1>|<br\s*\/?>/);
    if (!tagMatch) return;
    
    const tag = tagMatch[1] || 'br';
    let texto = tagMatch[2] || '';
    
    // Remover tags internas como <strong>
    const temStrong = /<strong>(.*?)<\/strong>/.test(texto);
    texto = texto.replace(/<\/?strong>/g, '');
    
    // Extrair estilos
    const styleMatch = elemento.match(/style="([^"]*)"/);
    const styles = {};
    if (styleMatch) {
      styleMatch[1].split(';').forEach(style => {
        const [prop, value] = style.split(':').map(s => s.trim());
        if (prop && value) {
          styles[prop] = value;
        }
      });
    }
    
    // Aplicar formatação baseada na tag e estilos
    let fontSize = 12;
    let align = 'left';
    let marginTop = 0;
    
    if (tag === 'h1') {
      fontSize = 18;
      doc.font('Helvetica-Bold');
    } else if (tag === 'h2') {
      fontSize = 16;
      doc.font('Helvetica-Bold');
    } else if (temStrong) {
      doc.font('Helvetica-Bold');
    } else {
      doc.font('Helvetica');
    }
    
    // Aplicar estilos CSS
    if (styles['text-align']) {
      align = styles['text-align'];
    }
    if (styles['margin-top']) {
      const marginValue = parseInt(styles['margin-top']);
      marginTop = isNaN(marginValue) ? 0 : marginValue / 2; // Reduzir pela metade para PDF
    }
    
    if (tag === 'br') {
      currentY += 10;
      return;
    }
    
    // Adicionar margem superior
    currentY += marginTop;
    
    // Renderizar texto
    if (texto.trim()) {
      doc.fontSize(fontSize);
      doc.text(texto, opt.x, currentY, {
        width: opt.width,
        align: align,
        lineGap: 5
      });
      
      // Atualizar posição Y
      currentY = doc.y + 10;
    }
    
    // Resetar fonte para normal
    doc.font('Helvetica').fontSize(12);
  });
  
  return currentY;
}

/**
 * Gera um PDF a partir de um template HTML com variáveis
 */
async function gerarPDF(opcoes) {
  const {
    templateHTML,
    variaveis,
    outputPath,
    configuracoes = {}
  } = opcoes;
  
  return new Promise((resolve, reject) => {
    try {
      // Configurações padrão
      const config = {
        size: configuracoes.tamanho_pagina || 'A4',
        layout: configuracoes.orientacao || 'portrait',
        margins: configuracoes.margens || {
          top: 50,
          bottom: 50,
          left: 50,
          right: 50
        }
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
      
      // Converter HTML para PDF
      htmlParaPDF(doc, htmlComDados, {
        x: config.margins.left,
        y: config.margins.top,
        width: 595.28 - config.margins.left - config.margins.right // A4 width em pontos
      });
      
      // Adicionar rodapé com data de geração
      const pageHeight = 841.89; // A4 height em pontos
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
  extrairVariaveis,
  htmlParaPDF
};
