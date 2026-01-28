const { query } = require('../config/database');
const { 
  mockOrcamento,
  mockSolicitacoesRecentes
} = require('../utils/mockData');

class DashboardController {
  // Dashboard principal
  static async index(req, res) {
    try {
      // Verificar se deve usar dados mockados
      const USE_MOCK_MODE = process.env.USE_MOCK_DATA === 'true' || !process.env.DB_PASSWORD || (req.user && req.user.mock);

      if (USE_MOCK_MODE) {
        console.log('⚠️  MODO MOCK ATIVO - Usando dados mockados no dashboard');
        
        return res.render('dashboard/index', {
          title: 'Dashboard - DataFlow',
          user: req.user,
          orcamento: mockOrcamento,
          solicitacoesRecentes: mockSolicitacoesRecentes
        });
      }

      // Orçamento por centro de custos
      const orcamentoQuery = await query(
        `SELECT 
          COALESCE(SUM(valor_utilizado), 0) as utilizado,
          COALESCE(SUM(valor_total), 0) as total
         FROM centros_custo`
      );
      const orcamento = {
        utilizado: parseFloat(orcamentoQuery.rows[0].utilizado || 0),
        total: parseFloat(orcamentoQuery.rows[0].total || 0),
        percentual: orcamentoQuery.rows[0].total > 0 ? Math.round((parseFloat(orcamentoQuery.rows[0].utilizado || 0) / parseFloat(orcamentoQuery.rows[0].total || 0)) * 100) : 0,
        categorias: [
          { nome: 'Operações', percentual: 74, cor: 'blue' },
          { nome: 'TI', percentual: 81, cor: 'amber' },
          { nome: 'Marketing', percentual: 99, cor: 'red' }
        ]
      };

      // Solicitações recentes
      const solicitacoesRecentesQuery = await query(
        `SELECT p.id, p.titulo as tipoDocumento, u.nome as solicitante, 
                TO_CHAR(p.criado_em, 'DD/MM/YYYY') as data, p.valor, p.status
         FROM processos p
         LEFT JOIN usuarios u ON p.criado_por = u.id
         WHERE p.ativo = true
         ORDER BY p.criado_em DESC
         LIMIT 5`
      );

      res.render('dashboard/index', {
        title: 'Dashboard - DataFlow',
        user: req.user,
        orcamento: orcamento,
        solicitacoesRecentes: solicitacoesRecentesQuery.rows
      });
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
      
      // Se der erro de conexão, usar dados mockados
      if (error.code === 'ECONNREFUSED' || error.message.includes('connect')) {
        console.log('⚠️  Erro de conexão com banco. Usando dados MOCK...');
        
        return res.render('dashboard/index', {
          title: 'Dashboard - DataFlow',
          user: req.user,
          orcamento: mockOrcamento,
          solicitacoesRecentes: mockSolicitacoesRecentes
        });
      }
      
      res.status(500).render('error', {
        title: 'Erro - DataFlow',
        message: 'Erro ao carregar dashboard'
      });
    }
  }
}

module.exports = DashboardController;
