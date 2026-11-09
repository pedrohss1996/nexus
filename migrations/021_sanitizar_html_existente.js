/**
 * Migration 021: sanitiza o HTML já gravado
 *
 * A partir de agora templates_pdf.conteudo_html e documentos_gerados.conteudo_html
 * são sanitizados na escrita, mas o que já estava no banco entrou cru.
 *
 * Não é só questão de XSS no browser: a geração de PDF roda esse HTML dentro de
 * um Chromium headless (Puppeteer) no servidor. Um <script> armazenado executa
 * com acesso à rede interna da aplicação.
 */

const { sanitizarDocumento } = require('../utils/sanitizarHtml');

const TABELAS = [
  { nome: 'templates_pdf', coluna: 'conteudo_html' },
  { nome: 'documentos_gerados', coluna: 'conteudo_html' }
];

async function up(client) {
  for (const { nome, coluna } of TABELAS) {
    // A tabela pode não existir em bancos antigos
    const existe = await client.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_name = $1 AND column_name = $2`,
      [nome, coluna]
    );
    if (existe.rows.length === 0) {
      console.log(`   ${nome}.${coluna} não existe — pulando`);
      continue;
    }

    const linhas = await client.query(
      `SELECT id, ${coluna} AS html FROM ${nome} WHERE ${coluna} IS NOT NULL AND ${coluna} <> ''`
    );

    let alterados = 0;
    for (const linha of linhas.rows) {
      const limpo = sanitizarDocumento(linha.html);
      if (limpo !== linha.html) {
        await client.query(
          `UPDATE ${nome} SET ${coluna} = $1 WHERE id = $2`,
          [limpo, linha.id]
        );
        alterados++;
      }
    }

    console.log(`   ${nome}: ${linhas.rows.length} registro(s) verificado(s), ${alterados} sanitizado(s)`);
  }
}

// Sem down: a versão original continha justamente o conteúdo que se quer remover
async function down() {
  throw new Error('021 não é reversível — o conteúdo original era o vetor de ataque.');
}

module.exports = { up, down };
