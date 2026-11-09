const { query } = require('../config/database');
const PlanoContas = require('../models/PlanoContas');
const Unidade = require('../models/Unidade');
const FluxoEngine = require('../services/FluxoEngine');
const { unidadeDaRequisicao, semUnidade } = require('../utils/unidadeScope');

class DashboardController {
  static async index(req, res) {
    try {
      if (semUnidade(req, res)) return;
      const unidadeId = unidadeDaRequisicao(req);

      let planoTree = [];
      let unidadeOrcamento = null;
      if (unidadeId) {
        try {
          planoTree = await PlanoContas.buildTree(unidadeId);
          unidadeOrcamento = await Unidade.buscarPorId(unidadeId);
        } catch (_) {}
      }

      // Orçamento por centro de custos (apenas da unidade ativa)
      const orcamentoQuery = await query(
        `SELECT
          COALESCE(SUM(valor_utilizado), 0) as utilizado,
          COALESCE(SUM(valor_total), 0) as total
         FROM centros_custo
         WHERE unidade_id = $1`,
        [unidadeId]
      );
      const orcamento = {
        utilizado: parseFloat(orcamentoQuery.rows[0].utilizado || 0),
        total: parseFloat(orcamentoQuery.rows[0].total || 0),
        percentual: orcamentoQuery.rows[0].total > 0
          ? Math.round((parseFloat(orcamentoQuery.rows[0].utilizado || 0) / parseFloat(orcamentoQuery.rows[0].total || 0)) * 100)
          : 0
      };

      // Fila do usuário: etapas de processo esperando por ele (a mesma regra
      // de /processos/tarefas). É a primeira coisa que a tela inicial responde.
      const tarefasLinhas = await FluxoEngine
        .tarefasDoUsuario(req.user, unidadeId, { pagina: 1, porPagina: 6 })
        .catch(() => []);
      const tarefas = {
        itens: tarefasLinhas,
        total: tarefasLinhas.length ? parseInt(tarefasLinhas[0]._total, 10) || 0 : 0,
        atrasadasVisiveis: tarefasLinhas.filter(t => t.atrasada).length
      };

      // Estatísticas reais em paralelo
      const [
        protocolosAtivosRes,
        tramitacoesPendentesRes,
        documentosGeradosMesRes,
        assinaturasPendentesRes,
        protocolosRecentesRes,
        tramitacoesPendentesListRes,
      ] = await Promise.all([
        query(
          `SELECT COUNT(*) AS total FROM protocolos
           WHERE status NOT IN ('arquivado', 'encerrado') AND unidade_id = $1`,
          [unidadeId]
        ).catch(() => ({ rows: [{ total: 0 }] })),
        query(
          `SELECT COUNT(*) AS total FROM tramitacoes t
           JOIN protocolos p ON p.id = t.protocolo_id
           WHERE t.status = 'enviado' AND t.data_recebimento IS NULL
             AND p.unidade_id = $1`,
          [unidadeId]
        ).catch(() => ({ rows: [{ total: 0 }] })),
        query(
          `SELECT COUNT(*) AS total FROM documentos_gerados
           WHERE DATE_TRUNC('month', gerado_em) = DATE_TRUNC('month', NOW())
             AND unidade_id = $1`,
          [unidadeId]
        ).catch(() => ({ rows: [{ total: 0 }] })),
        query(
          `SELECT COUNT(*) AS total FROM assinaturas_digitais a
           JOIN documentos_gerados dg ON dg.id = a.documento_id
           WHERE a.validado = false AND dg.unidade_id = $1`,
          [unidadeId]
        ).catch(() => ({ rows: [{ total: 0 }] })),
        query(`
          SELECT p.id, p.numero_protocolo, p.tipo_documento, p.assunto,
                 p.status, TO_CHAR(p.criado_em, 'DD/MM/YYYY') AS data
          FROM protocolos p
          WHERE p.unidade_id = $1
          ORDER BY p.criado_em DESC
          LIMIT 5
        `, [unidadeId]).catch(() => ({ rows: [] })),
        query(`
          SELECT t.id, t.protocolo_id, p.numero_protocolo, p.tipo_documento,
                 u.nome AS destino_nome,
                 TO_CHAR(t.data_envio, 'DD/MM/YYYY') AS data_envio
          FROM tramitacoes t
          JOIN protocolos p ON p.id = t.protocolo_id
          LEFT JOIN unidades u ON u.id = t.unidade_destino_id
          WHERE t.status = 'enviado' AND t.data_recebimento IS NULL
            AND p.unidade_id = $1
          ORDER BY t.data_envio ASC
          LIMIT 5
        `, [unidadeId]).catch(() => ({ rows: [] })),
      ]);

      const stats = {
        protocolosAtivos: parseInt(protocolosAtivosRes.rows[0].total, 10) || 0,
        tramitacoesPendentes: parseInt(tramitacoesPendentesRes.rows[0].total, 10) || 0,
        documentosGeradosMes: parseInt(documentosGeradosMesRes.rows[0].total, 10) || 0,
        assinaturasPendentes: parseInt(assinaturasPendentesRes.rows[0].total, 10) || 0,
      };

      res.render('dashboard/index', {
        title: 'Início - Nexus',
        user: req.user,
        orcamento,
        stats,
        tarefas,
        protocolosRecentes: protocolosRecentesRes.rows,
        tramitacoesPendentes: tramitacoesPendentesListRes.rows,
        planoTree,
        unidade: unidadeOrcamento,
        showLink: true
      });
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
      res.status(500).render('error', {
        title: 'Erro - DataFlow',
        message: 'Erro ao carregar dashboard'
      });
    }
  }
}

module.exports = DashboardController;
