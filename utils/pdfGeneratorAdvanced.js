/**
 * Gerador de PDF fiel ao HTML usando Puppeteer.
 * Renderiza o conteúdo exatamente como o browser vê.
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// ── Substituição de variáveis ──────────────────────────────────────────────
function substituirVariaveis(template, variaveis) {
  let resultado = template;
  for (const [chave, valor] of Object.entries(variaveis)) {
    const regex = new RegExp(`\\{\\{${chave}\\}\\}`, 'g');
    resultado = resultado.replace(regex, valor || '');
  }
  // Manter variáveis ASSINATURA:X intactas (serão processadas separadamente)
  // Remover apenas variáveis comuns não preenchidas
  resultado = resultado.replace(/\{\{(?!ASSINATURA:)\w+\}\}/g, '');
  return resultado;
}

// ── Detecta variáveis de assinatura no template ────────────────────────────
function extrairVariaveisAssinatura(templateHTML) {
  const regex = /\{\{ASSINATURA:(\d+)\}\}/g;
  const grupos = [];
  let match;
  while ((match = regex.exec(templateHTML)) !== null) {
    grupos.push({ placeholder: match[0], grupo_id: parseInt(match[1], 10) });
  }
  return grupos;
}

// ── Montar HTML completo da página A4 ─────────────────────────────────────
function montarHtmlA4(conteudo) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    @page {
      size: A4 portrait;
      margin: 0;
    }

    html {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      width: 210mm;
      min-height: 297mm;
      background: #fff;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #1a1a1a;
      padding: 20mm 25mm 20mm 25mm;
    }

    img { max-width: 100%; height: auto; }

    table { width: 100%; border-collapse: collapse; margin: 8pt 0; }
    th, td { border: 1px solid #999; padding: 5pt 8pt; vertical-align: top; word-break: break-word; }
    th { background: #f0f0f0; font-weight: bold; }

    ul, ol { margin: 6pt 0 6pt 20pt; }
    li { margin-bottom: 3pt; }

    p { margin: 0 0 6pt 0; }
    h1, h2, h3, h4, h5, h6 { page-break-after: avoid; margin-bottom: 6pt; }
    a { color: inherit; text-decoration: none; }
  </style>
</head>
<body>${conteudo}</body>
</html>`;
}

// ── Gerador principal ──────────────────────────────────────────────────────
async function gerarPDF({ templateHTML, variaveis = {}, outputPath, retornarBuffer = false }) {
  const htmlComDados = substituirVariaveis(templateHTML, variaveis);
  const htmlFinal = montarHtmlA4(htmlComDados);

  let browser;

  // Detectar se está no ambiente Railway/Linux (sem display)
  const isProduction = process.env.NODE_ENV === 'production' || process.platform === 'linux';

  const launchArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    '--no-first-run',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-default-apps',
    '--disable-sync',
    '--disable-translate',
    '--hide-scrollbars',
    '--metrics-recording-only',
    '--mute-audio',
    '--no-first-run',
    '--safebrowsing-disable-auto-update',
  ];

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: launchArgs,
      timeout: 30000,
    });

    const page = await browser.newPage();

    // Desabilitar JS desnecessário para melhorar estabilidade
    await page.setJavaScriptEnabled(false);

    // Carregar HTML diretamente (sem rede)
    await page.setContent(htmlFinal, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    // Aguardar renderização de imagens e fontes
    await page.evaluate(() => document.fonts.ready).catch(() => {});

    // Gerar PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
      timeout: 30000,
    });

    await browser.close();
    browser = null;

    if (retornarBuffer) {
      return { sucesso: true, buffer: Buffer.from(pdfBuffer), tamanho: pdfBuffer.length };
    }

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outputPath, pdfBuffer);

    return { sucesso: true, caminho: outputPath, tamanho: pdfBuffer.length };

  } catch (error) {
    throw error;
  } finally {
    if (browser) {
      try { await browser.close(); } catch (_) {}
    }
  }
}

// ── Extrai variáveis {{nome}} do HTML (exceto assinaturas) ─────────────────
function extrairVariaveis(templateHTML) {
  const regex = /\{\{((?!ASSINATURA:)\w+)\}\}/g;
  const variaveis = new Set();
  let match;
  while ((match = regex.exec(templateHTML)) !== null) {
    variaveis.add(match[1]);
  }
  return Array.from(variaveis);
}

module.exports = { gerarPDF, substituirVariaveis, extrairVariaveis, extrairVariaveisAssinatura };
