const pool = require('../config/database');

class TramitacaoController {
  // Listar tramitações
  async index(req, res) {
    try {
      const { unidadeSelecionada } = req.session;
      
      // Tramitações recebidas (pendentes)
      const recebidas = await pool.query(`
        SELECT 
          t.*,
          p.numero_protocolo,
          p.assunto,
          p.tipo_documento,
          p.prioridade,
          uo.nome as origem_nome,
          uso.nome as usuario_origem_nome
        FROM tramitacoes t
        INNER JOIN protocolos p ON t.protocolo_id = p.id
        LEFT JOIN unidades uo ON t.unidade_origem_id = uo.id
        LEFT JOIN usuarios uso ON t.usuario_origem_id = uso.id
        WHERE t.unidade_destino_id = $1 AND t.status = 'pendente'
        ORDER BY t.data_envio DESC
      `, [unidadeSelecionada]);

      // Tramitações enviadas
      const enviadas = await pool.query(`
        SELECT 
          t.*,
          p.numero_protocolo,
          p.assunto,
          p.tipo_documento,
          ud.nome as destino_nome,
          usd.nome as usuario_destino_nome
        FROM tramitacoes t
        INNER JOIN protocolos p ON t.protocolo_id = p.id
        LEFT JOIN unidades ud ON t.unidade_destino_id = ud.id
        LEFT JOIN usuarios usd ON t.usuario_destino_id = usd.id
        WHERE t.unidade_origem_id = $1
        ORDER BY t.data_envio DESC
        LIMIT 50
      `, [unidadeSelecionada]);

      res.render('tramitacao/index', {
        title: 'Tramitação de Documentos - E-DOC',
        recebidas: recebidas.rows,
        enviadas: enviadas.rows,
        user: req.user,
        unidades: req.unidades,
        unidadeSelecionada
      });
    } catch (error) {
      console.error('Erro ao listar tramitações:', error);
      res.status(500).send('Erro ao carregar tramitações');
    }
  }

  // Formulário de tramitação
  async novoForm(req, res) {
    try {
      const { protocolo_id } = req.params;
      const { unidadeSelecionada } = req.session;

      // Buscar protocolo
      const protocolo = await pool.query(`
        SELECT p.*, u.nome as unidade_nome
        FROM protocolos p
        LEFT JOIN unidades u ON p.unidade_id = u.id
        WHERE p.id = $1
      `, [protocolo_id]);

      if (protocolo.rows.length === 0) {
        return res.status(404).send('Protocolo não encontrado');
      }

      // Buscar unidades disponíveis (exceto a atual)
      const unidadesDisponiveis = await pool.query(`
        SELECT id, nome, sigla
        FROM unidades
        WHERE ativo = true AND id != $1
        ORDER BY nome ASC
      `, [unidadeSelecionada]);

      res.render('tramitacao/form', {
        title: 'Nova Tramitação - E-DOC',
        protocolo: protocolo.rows[0],
        unidadesDisponiveis: unidadesDisponiveis.rows,
        user: req.user,
        unidades: req.unidades,
        unidadeSelecionada
      });
    } catch (error) {
      console.error('Erro ao carregar formulário:', error);
      res.status(500).send('Erro ao carregar formulário');
    }
  }

  // Criar tramitação
  async criar(req, res) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const { unidadeSelecionada } = req.session;
      const { protocolo_id } = req.params;
      const {
        unidade_destino_id,
        tipo_tramitacao,
        despacho,
        prazo_resposta
      } = req.body;

      // Criar tramitação
      const result = await client.query(`
        INSERT INTO tramitacoes (
          protocolo_id, unidade_origem_id, unidade_destino_id,
          usuario_origem_id, tipo_tramitacao, despacho, prazo_resposta, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pendente')
        RETURNING *
      `, [
        protocolo_id, unidadeSelecionada, unidade_destino_id,
        req.user.id, tipo_tramitacao, despacho, prazo_resposta || null
      ]);

      // Atualizar status do protocolo
      await client.query(`
        UPDATE protocolos
        SET status = 'em_tramite', atualizado_em = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [protocolo_id]);

      // Registrar no histórico
      await client.query(`
        INSERT INTO historico_acoes (
          protocolo_id, usuario_id, acao, descricao, ip_usuario
        ) VALUES ($1, $2, 'tramitacao', $3, $4)
      `, [
        protocolo_id, req.user.id,
        `Documento tramitado para outra unidade - Tipo: ${tipo_tramitacao}`,
        req.ip
      ]);

      await client.query('COMMIT');

      res.redirect(`/protocolo/${protocolo_id}`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Erro ao criar tramitação:', error);
      res.status(500).send('Erro ao criar tramitação');
    } finally {
      client.release();
    }
  }

  // Receber tramitação
  async receber(req, res) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const { id } = req.params;

      // Atualizar tramitação
      await client.query(`
        UPDATE tramitacoes
        SET status = 'recebido', 
            data_recebimento = CURRENT_TIMESTAMP,
            usuario_destino_id = $1
        WHERE id = $2
      `, [req.user.id, id]);

      // Buscar protocolo_id
      const tramitacao = await client.query(`
        SELECT protocolo_id FROM tramitacoes WHERE id = $1
      `, [id]);

      const protocolo_id = tramitacao.rows[0].protocolo_id;

      // Registrar no histórico
      await client.query(`
        INSERT INTO historico_acoes (
          protocolo_id, usuario_id, acao, descricao, ip_usuario
        ) VALUES ($1, $2, 'recebimento', 'Tramitação recebida', $3)
      `, [protocolo_id, req.user.id, req.ip]);

      await client.query('COMMIT');

      res.redirect('/tramitacao');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Erro ao receber tramitação:', error);
      res.status(500).send('Erro ao receber tramitação');
    } finally {
      client.release();
    }
  }
}

module.exports = new TramitacaoController();
