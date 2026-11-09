const { pool } = require('../config/database');
const { unidadeDaRequisicao } = require('../utils/unidadeScope');
const { lerPaginacao, montarMeta, limitOffset } = require('../utils/paginacao');

class ProtocoloController {
  // Listar todos os protocolos
  async index(req, res) {
    try {
      const unidadeSelecionada = unidadeDaRequisicao(req);

      const pag = lerPaginacao(req);
      const { sql: limite, valores: valoresLimite } = limitOffset(2, pag);

      const result = await pool.query(`
        SELECT
          p.*,
          u.nome as unidade_nome,
          us.nome as criado_por_nome,
          (SELECT COUNT(*) FROM tramitacoes WHERE protocolo_id = p.id) as total_tramitacoes,
          COUNT(*) OVER() AS _total
        FROM protocolos p
        LEFT JOIN unidades u ON p.unidade_id = u.id
        LEFT JOIN usuarios us ON p.criado_por = us.id
        WHERE p.unidade_id = $1
        ORDER BY p.criado_em DESC` + limite,
        [unidadeSelecionada, ...valoresLimite]
      );

      const { itens, meta } = montarMeta(pag, result.rows, '/protocolo', req.query);

      res.render('protocolo/index', {
        title: 'Protocolo Eletrônico - E-DOC',
        protocolos: itens,
        meta,
        user: req.user,
        unidades: req.unidades,
        unidadeSelecionada
      });
    } catch (error) {
      console.error('Erro ao listar protocolos:', error);
      res.status(500).render('error', { 
        message: 'Erro ao carregar protocolos',
        error: process.env.NODE_ENV === 'development' ? error : {}
      });
    }
  }

  // Formulário de novo protocolo
  async novo(req, res) {
    try {
      const { unidadeSelecionada } = req.session;
      
      // Buscar templates disponíveis
      const templates = await pool.query(`
        SELECT id, nome, tipo_documento, descricao
        FROM templates_pdf
        WHERE ativo = true
        ORDER BY nome ASC
      `);

      res.render('protocolo/form', {
        title: 'Novo Protocolo - E-DOC',
        protocolo: null,
        templates: templates.rows,
        action: '/protocolo',
        user: req.user,
        unidades: req.unidades,
        unidadeSelecionada
      });
    } catch (error) {
      console.error('Erro ao carregar formulário:', error);
      res.status(500).send('Erro ao carregar formulário');
    }
  }

  // Criar novo protocolo
  async criar(req, res) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const { unidadeSelecionada } = req.session;
      const {
        tipo_documento,
        assunto,
        interessado,
        cpf_cnpj,
        origem,
        destino,
        prioridade,
        observacoes
      } = req.body;

      // Gerar número de protocolo
      const numeroResult = await client.query('SELECT gerar_numero_protocolo() as numero');
      const numero_protocolo = numeroResult.rows[0].numero;
      // O ano sai do próprio número (fuso de Brasília, calculado no banco) —
      // new Date() aqui usaria o fuso do servidor e podia divergir na virada.
      const ano = parseInt(numero_protocolo.split('/')[1], 10);

      // Inserir protocolo
      const result = await client.query(`
        INSERT INTO protocolos (
          numero_protocolo, ano, tipo_documento, assunto, interessado,
          cpf_cnpj, origem, destino, prioridade, observacoes,
          unidade_id, criado_por, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'aguardando')
        RETURNING *
      `, [
        numero_protocolo, ano, tipo_documento, assunto, interessado,
        cpf_cnpj, origem, destino, prioridade || 'normal', observacoes,
        unidadeSelecionada, req.user.id
      ]);

      const protocolo = result.rows[0];

      // Registrar no histórico
      await client.query(`
        INSERT INTO historico_acoes (
          protocolo_id, usuario_id, acao, descricao, ip_usuario
        ) VALUES ($1, $2, 'criacao', 'Protocolo criado', $3)
      `, [protocolo.id, req.user.id, req.ip]);

      await client.query('COMMIT');

      res.redirect(`/protocolo/${protocolo.id}`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Erro ao criar protocolo:', error);
      res.status(500).send('Erro ao criar protocolo');
    } finally {
      client.release();
    }
  }

  // Visualizar protocolo
  async visualizar(req, res) {
    try {
      const { id } = req.params;
      const { unidadeSelecionada } = req.session;

      const protocoloResult = await pool.query(`
        SELECT 
          p.*,
          u.nome as unidade_nome,
          us.nome as criado_por_nome
        FROM protocolos p
        LEFT JOIN unidades u ON p.unidade_id = u.id
        LEFT JOIN usuarios us ON p.criado_por = us.id
        WHERE p.id = $1
      `, [id]);

      if (protocoloResult.rows.length === 0) {
        return res.status(404).send('Protocolo não encontrado');
      }

      // Buscar tramitações
      const tramitacoesResult = await pool.query(`
        SELECT 
          t.*,
          uo.nome as origem_nome,
          ud.nome as destino_nome,
          uso.nome as usuario_origem_nome,
          usd.nome as usuario_destino_nome
        FROM tramitacoes t
        LEFT JOIN unidades uo ON t.unidade_origem_id = uo.id
        LEFT JOIN unidades ud ON t.unidade_destino_id = ud.id
        LEFT JOIN usuarios uso ON t.usuario_origem_id = uso.id
        LEFT JOIN usuarios usd ON t.usuario_destino_id = usd.id
        WHERE t.protocolo_id = $1
        ORDER BY t.data_envio DESC
      `, [id]);

      // Buscar histórico
      const historicoResult = await pool.query(`
        SELECT 
          h.*,
          u.nome as usuario_nome
        FROM historico_acoes h
        LEFT JOIN usuarios u ON h.usuario_id = u.id
        WHERE h.protocolo_id = $1
        ORDER BY h.criado_em DESC
      `, [id]);

      res.render('protocolo/visualizar', {
        title: 'Detalhes do Protocolo - E-DOC',
        protocolo: protocoloResult.rows[0],
        tramitacoes: tramitacoesResult.rows,
        historico: historicoResult.rows,
        user: req.user,
        unidades: req.unidades,
        unidadeSelecionada
      });
    } catch (error) {
      console.error('Erro ao visualizar protocolo:', error);
      res.status(500).send('Erro ao carregar protocolo');
    }
  }
}

module.exports = new ProtocoloController();
