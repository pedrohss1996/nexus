const { gerarPDF, extrairVariaveis } = require('../utils/pdfGenerator');
const path = require('path');

async function testarGeracao() {
  console.log('🧪 Testando geração de PDF...\n');
  
  // Template de teste
  const templateHTML = `
    <h1 style="text-align: center;">TESTE DE DOCUMENTO</h1>
    
    <p style="margin-top: 30px;">
      Este é um teste de geração de PDF com variáveis.
    </p>
    
    <p style="margin-top: 20px;">
      <strong>Nome:</strong> {{nome}}<br>
      <strong>CPF:</strong> {{cpf}}<br>
      <strong>Data:</strong> {{data}}
    </p>
    
    <p style="margin-top: 40px; text-align: center;">
      _______________________________________<br>
      Assinatura
    </p>
  `;
  
  // Extrair variáveis
  console.log('📝 Variáveis detectadas:');
  const variaveis = extrairVariaveis(templateHTML);
  console.log(variaveis);
  console.log('');
  
  // Dados para preencher
  const dados = {
    nome: 'João da Silva',
    cpf: '123.456.789-00',
    data: '29/01/2026'
  };
  
  // Caminho de saída
  const outputPath = path.join(__dirname, '..', 'uploads', 'documentos-gerados', 'teste.pdf');
  
  console.log('🚀 Gerando PDF...');
  
  try {
    const resultado = await gerarPDF({
      templateHTML: templateHTML,
      variaveis: dados,
      outputPath: outputPath,
      configuracoes: {
        tamanho_pagina: 'A4',
        orientacao: 'portrait',
        margens: {
          top: 50,
          right: 50,
          bottom: 50,
          left: 50
        }
      }
    });
    
    console.log('✅ PDF gerado com sucesso!');
    console.log('📄 Arquivo:', resultado.caminho);
    console.log('📊 Tamanho:', (resultado.tamanho / 1024).toFixed(2), 'KB');
    console.log('\n✨ Teste concluído com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao gerar PDF:', error);
  }
}

testarGeracao();
