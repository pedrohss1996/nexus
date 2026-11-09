// Middleware: autorização da decisão sobre um processo
//
// Existe por causa de um conflito entre dois modelos de permissão:
//
//   • Sem fluxo, aprovar/rejeitar é ato de gestão → requireRole(admin, gestor).
//   • Com fluxo, quem decide é o grupo dono da etapa, definido no desenho —
//     e esse grupo costuma ser de usuários com perfil comum.
//
// Aplicar requireRole nas duas situações faria o motor de fluxo nunca ser
// alcançado por quem de fato responde pela etapa: o 403 viria antes, e o
// desenho voltaria a ser decorativo.
//
// Então: processo com fluxo passa direto e a autorização real acontece no
// FluxoEngine (que confere o vínculo com o grupo da etapa atual); processo sem
// fluxo cai na regra de perfil de antes.

const { query } = require('../config/database');
const { requireRole } = require('./authMiddleware');

const exigirGestor = requireRole(['admin', 'gestor']);

const autorizarDecisao = async (req, res, next) => {
  try {
    const r = await query(
      'SELECT fluxo_id, etapa_atual_id FROM processos WHERE id = $1',
      [req.params.id]
    );

    // Processo inexistente: deixa o controller responder 404 com o filtro de
    // unidade aplicado, para não revelar existência entre unidades.
    if (r.rows.length === 0) return next();

    const { fluxo_id, etapa_atual_id } = r.rows[0];

    // Fluxo ativo: o motor decide quem pode agir
    if (fluxo_id && etapa_atual_id) return next();

    // Sem fluxo (ou fluxo já concluído): regra de perfil
    return exigirGestor(req, res, next);
  } catch (error) {
    next(error);
  }
};

module.exports = autorizarDecisao;
