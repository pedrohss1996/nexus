const { query } = require('../config/database');

async function up() {
  console.log('📝 Criando tabela de templates de documentos PDF...');
  
  await query(`
    CREATE TABLE IF NOT EXISTS templates_pdf (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(255) NOT NULL,
      descricao TEXT,
      tipo_documento VARCHAR(100) NOT NULL,
      conteudo_html TEXT NOT NULL,
      variaveis JSONB DEFAULT '[]'::jsonb,
      configuracoes JSONB DEFAULT '{
        "tamanho_pagina": "A4",
        "orientacao": "portrait",
        "margens": {
          "top": 50,
          "right": 50,
          "bottom": 50,
          "left": 50
        }
      }'::jsonb,
      ativo BOOLEAN DEFAULT true,
      criado_por INTEGER REFERENCES usuarios(id),
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT tipo_documento_valido CHECK (tipo_documento IN (
        'contrato', 'termo', 'oficio', 'declaracao', 'relatorio', 
        'atestado', 'solicitacao', 'parecer', 'outro'
      ))
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_templates_pdf_tipo ON templates_pdf(tipo_documento);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_templates_pdf_ativo ON templates_pdf(ativo);
  `);

  // Tabela para histórico de documentos gerados
  await query(`
    CREATE TABLE IF NOT EXISTS documentos_gerados (
      id SERIAL PRIMARY KEY,
      template_id INTEGER REFERENCES templates_pdf(id),
      nome_arquivo VARCHAR(255) NOT NULL,
      titulo VARCHAR(255) NOT NULL,
      dados_variaveis JSONB NOT NULL,
      caminho_arquivo TEXT,
      tamanho_bytes INTEGER,
      gerado_por INTEGER REFERENCES usuarios(id),
      gerado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      processo_id INTEGER REFERENCES processos(id),
      unidade_id INTEGER REFERENCES unidades(id)
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_documentos_gerados_template ON documentos_gerados(template_id);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_documentos_gerados_processo ON documentos_gerados(processo_id);
  `);

  // Inserir templates de exemplo
  // Buscar primeiro usuário ativo para associar aos templates
  const usuarioResult = await query('SELECT id FROM usuarios WHERE ativo = true LIMIT 1');
  const usuarioId = usuarioResult.rows.length > 0 ? usuarioResult.rows[0].id : null;
  
  await query(`
    INSERT INTO templates_pdf (nome, descricao, tipo_documento, conteudo_html, variaveis, criado_por)
    VALUES 
    (
      'Termo de Recebimento',
      'Template para termo de recebimento de materiais e equipamentos',
      'termo',
      '<h1 style="text-align: center;">TERMO DE RECEBIMENTO</h1>
<p style="margin-top: 30px;">Eu, <strong>{{nome_responsavel}}</strong>, portador(a) do CPF <strong>{{cpf_responsavel}}</strong>, na função de <strong>{{cargo_responsavel}}</strong>, declaro ter recebido em <strong>{{data_recebimento}}</strong> os seguintes itens:</p>

<p style="margin-top: 20px;"><strong>Descrição dos Itens:</strong></p>
<p>{{descricao_itens}}</p>

<p style="margin-top: 20px;"><strong>Fornecedor:</strong> {{nome_fornecedor}}</p>
<p><strong>Nota Fiscal:</strong> {{numero_nota_fiscal}}</p>
<p><strong>Valor Total:</strong> R$ {{valor_total}}</p>

<p style="margin-top: 40px;"><strong>Unidade:</strong> {{unidade_nome}}</p>

<p style="margin-top: 60px; text-align: center;">_______________________________________</p>
<p style="text-align: center;">{{nome_responsavel}}</p>
<p style="text-align: center;">CPF: {{cpf_responsavel}}</p>
<p style="text-align: center;">Data: {{data_assinatura}}</p>',
      '["nome_responsavel", "cpf_responsavel", "cargo_responsavel", "data_recebimento", "descricao_itens", "nome_fornecedor", "numero_nota_fiscal", "valor_total", "unidade_nome", "data_assinatura"]'::jsonb,
      $1
    ),
    (
      'Ofício',
      'Template para elaboração de ofícios',
      'oficio',
      '<div style="text-align: right; margin-bottom: 30px;">
  <p>{{unidade_nome}}</p>
  <p>{{unidade_endereco}}</p>
  <p>{{cidade}}, {{data_emissao}}</p>
</div>

<p style="margin-top: 30px;"><strong>OFÍCIO Nº {{numero_oficio}}/{{ano}}</strong></p>

<p style="margin-top: 20px;">Ao(À) Sr(a).<br>
<strong>{{destinatario_nome}}</strong><br>
{{destinatario_cargo}}<br>
{{destinatario_instituicao}}</p>

<p style="margin-top: 30px;">Assunto: <strong>{{assunto}}</strong></p>

<p style="margin-top: 30px; text-align: justify;">{{corpo_texto}}</p>

<p style="margin-top: 30px;">Atenciosamente,</p>

<p style="margin-top: 60px;">_______________________________________</p>
<p>{{remetente_nome}}</p>
<p>{{remetente_cargo}}</p>',
      '["unidade_nome", "unidade_endereco", "cidade", "data_emissao", "numero_oficio", "ano", "destinatario_nome", "destinatario_cargo", "destinatario_instituicao", "assunto", "corpo_texto", "remetente_nome", "remetente_cargo"]'::jsonb,
      $1
    ),
    (
      'Declaração Simples',
      'Template para declarações diversas',
      'declaracao',
      '<h1 style="text-align: center;">DECLARAÇÃO</h1>

<p style="margin-top: 40px; text-align: justify;">Eu, <strong>{{nome_declarante}}</strong>, portador(a) do CPF <strong>{{cpf_declarante}}</strong>, residente em <strong>{{endereco_declarante}}</strong>, declaro para os devidos fins que:</p>

<p style="margin-top: 30px; text-align: justify;">{{texto_declaracao}}</p>

<p style="margin-top: 30px;">Por ser verdade, firmo a presente declaração.</p>

<p style="margin-top: 40px; text-align: center;">{{cidade}}, {{data_emissao}}</p>

<p style="margin-top: 60px; text-align: center;">_______________________________________</p>
<p style="text-align: center;"><strong>{{nome_declarante}}</strong></p>
<p style="text-align: center;">CPF: {{cpf_declarante}}</p>',
      '["nome_declarante", "cpf_declarante", "endereco_declarante", "texto_declaracao", "cidade", "data_emissao"]'::jsonb,
      $1
    )
  `, [usuarioId]);

  console.log('✅ Tabelas de templates de documentos PDF criadas com sucesso!');
}

async function down() {
  console.log('🔄 Revertendo migration de templates de documentos PDF...');
  
  await query('DROP TABLE IF EXISTS documentos_gerados CASCADE;');
  await query('DROP TABLE IF EXISTS templates_pdf CASCADE;');
  
  console.log('✅ Migration revertida com sucesso!');
}

module.exports = { up, down };
