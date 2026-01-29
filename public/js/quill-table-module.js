// Módulo customizado para adicionar tabelas facilmente no Quill

(function() {
  'use strict';

  // Função auxiliar para criar tabela HTML
  window.inserirTabelaQuill = function(quill, linhas = 3, colunas = 3) {
    const range = quill.getSelection(true);
    
    // Criar HTML da tabela
    let tabelaHTML = '<table border="1" style="border-collapse: collapse; width: 100%; margin: 10px 0;">';
    
    // Cabeçalho
    tabelaHTML += '<thead><tr>';
    for (let c = 0; c < colunas; c++) {
      tabelaHTML += '<th style="border: 1px solid #ddd; padding: 8px; background: #f3f4f6;">Coluna ' + (c + 1) + '</th>';
    }
    tabelaHTML += '</tr></thead>';
    
    // Corpo
    tabelaHTML += '<tbody>';
    for (let l = 0; l < linhas; l++) {
      tabelaHTML += '<tr>';
      for (let c = 0; c < colunas; c++) {
        tabelaHTML += '<td style="border: 1px solid #ddd; padding: 8px;">Célula</td>';
      }
      tabelaHTML += '</tr>';
    }
    tabelaHTML += '</tbody></table>';
    
    // Inserir no editor
    quill.clipboard.dangerouslyPasteHTML(range.index, tabelaHTML);
    quill.setSelection(range.index + tabelaHTML.length);
  };

  // Função para inserir linha horizontal
  window.inserirLinhaHorizontalQuill = function(quill) {
    const range = quill.getSelection(true);
    quill.clipboard.dangerouslyPasteHTML(range.index, '<hr style="margin: 20px 0; border: 1px solid #ddd;">');
    quill.setSelection(range.index + 1);
  };

  // Função para inserir cabeçalho com brasão
  window.inserirCabecalhoOficial = function(quill, titulo, subtitulo) {
    const range = quill.getSelection(true);
    
    const cabecalho = `
      <div style="text-align: center; margin-bottom: 30px;">
        <h2 style="margin: 10px 0; font-size: 16px;">${titulo}</h2>
        <h3 style="margin: 5px 0; font-size: 14px; font-weight: normal;">${subtitulo}</h3>
      </div>
      <hr style="margin: 20px 0; border: 1px solid #000;">
    `;
    
    quill.clipboard.dangerouslyPasteHTML(range.index, cabecalho);
    quill.setSelection(range.index + cabecalho.length);
  };

})();
