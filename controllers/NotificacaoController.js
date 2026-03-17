const { query } = require('../config/database');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// ── Upload de imagens para notificações ───────────────────────────────────────
const uploadDir = path.join(__dirname, '..', 'uploads', 'notificacoes');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `notif_${Date.now()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\//i.test(file.mimetype)) cb(null, true);
    else cb(new Error('Apenas imagens são permitidas'));
  }
});

// ── Helpers internos ─────────────────────────────────────────────────────────

// Resolve lista de usuario_ids a partir de arrays de unidade_ids e grupo_ids
async function resolverDestinatarios(unidadeIds = [], grupoIds = [], usuariosExtra = []) {
  const ids = new Set(usuariosExtra.map(Number).filter(Boolean));

  if (unidadeIds.length > 0) {
    const r = await query(
      `SELECT DISTINCT u.id FROM usuarios u
       JOIN usuarios_grupos ug ON ug.usuario_id = u.id
       JOIN grupos g ON g.id = ug.grupo_id
       WHERE g.unidade_id = ANY($1::int[]) AND u.ativo = true`,
      [unidadeIds.map(Number)]
    );
    // Também pega usuários diretamente vinculados à unidade (se existir coluna)
    const r2 = await query(
      `SELECT id FROM usuarios WHERE unidade_id = ANY($1::int[]) AND ativo = true`,
      [unidadeIds.map(Number)]
    );
    r.rows.forEach(row => ids.add(row.id));
    r2.rows.forEach(row => ids.add(row.id));
  }

  if (grupoIds.length > 0) {
    const r = await query(
      `SELECT DISTINCT usuario_id FROM usuarios_grupos WHERE grupo_id = ANY($1::int[])`,
      [grupoIds.map(Number)]
    );
    r.rows.forEach(row => ids.add(row.usuario_id));
  }

  return [...ids];
}

// Insere destinatários para uma notificação
async function inserirDestinatarios(notifId, userIds) {
  for (const uid of userIds) {
    await query(
      `INSERT INTO notificacoes_destinatarios (notificacao_id, usuario_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [notifId, uid]
    );
  }
}

// ── Controller ────────────────────────────────────────────────────────────────
class NotificacaoController {

  // GET /notificacoes  — lista notificações do usuário logado
  static async listar(req, res) {
    try {
      const result = await query(
        `SELECT n.*, nd.lida, nd.lida_em, u.nome as criador_nome
         FROM notificacoes n
         JOIN notificacoes_destinatarios nd ON nd.notificacao_id = n.id
         LEFT JOIN usuarios u ON u.id = n.criado_por
         WHERE nd.usuario_id = $1 AND n.ativo = true
         ORDER BY n.criado_em DESC
         LIMIT 100`,
        [req.user.id]
      );

      res.render('notificacoes/listar', {
        title: 'Notificações',
        user: req.user,
        notificacoes: result.rows
      });
    } catch (err) {
      res.status(500).render('error', { title: 'Erro', message: err.message, user: req.user });
    }
  }

  // POST /notificacoes/:id/lida  — marcar como lida
  static async marcarLida(req, res) {
    try {
      await query(
        `UPDATE notificacoes_destinatarios
         SET lida = true, lida_em = NOW()
         WHERE notificacao_id = $1 AND usuario_id = $2`,
        [req.params.id, req.user.id]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // POST /notificacoes/todas-lidas  — marcar todas como lidas
  static async marcarTodasLidas(req, res) {
    try {
      await query(
        `UPDATE notificacoes_destinatarios
         SET lida = true, lida_em = NOW()
         WHERE usuario_id = $1 AND lida = false`,
        [req.user.id]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // GET /api/notificacoes/nao-lidas  — contagem para o sininho
  static async contarNaoLidas(req, res) {
    try {
      const r = await query(
        `SELECT COUNT(*) as total
         FROM notificacoes_destinatarios nd
         JOIN notificacoes n ON n.id = nd.notificacao_id
         WHERE nd.usuario_id = $1 AND nd.lida = false AND n.ativo = true`,
        [req.user.id]
      );
      res.json({ total: parseInt(r.rows[0].total, 10) });
    } catch (err) {
      res.json({ total: 0 });
    }
  }

  // GET /notificacoes/admin  — formulário de criação (somente admin)
  static async adminIndex(req, res) {
    try {
      if (req.user.perfil !== 'admin') {
        return res.status(403).render('error', { title: 'Acesso negado', message: 'Apenas administradores.', user: req.user });
      }
      const [unidades, grupos] = await Promise.all([
        query('SELECT id, nome FROM unidades WHERE ativo = true ORDER BY nome'),
        query('SELECT id, nome FROM grupos WHERE ativo = true ORDER BY nome'),
      ]);
      const recentes = await query(
        `SELECT n.*, COUNT(nd.id) as total_dest,
                SUM(CASE WHEN nd.lida THEN 1 ELSE 0 END) as total_lidas,
                u.nome as criador_nome
         FROM notificacoes n
         LEFT JOIN notificacoes_destinatarios nd ON nd.notificacao_id = n.id
         LEFT JOIN usuarios u ON u.id = n.criado_por
         WHERE n.ativo = true
         GROUP BY n.id, u.nome
         ORDER BY n.criado_em DESC
         LIMIT 20`,
        []
      );
      res.render('notificacoes/admin', {
        title: 'Comunicação Interna',
        user: req.user,
        unidades: unidades.rows,
        grupos: grupos.rows,
        recentes: recentes.rows
      });
    } catch (err) {
      res.status(500).render('error', { title: 'Erro', message: err.message, user: req.user });
    }
  }

  // POST /notificacoes/admin  — criar notificação
  static async adminCriar(req, res) {
    try {
      if (req.user.perfil !== 'admin') {
        return res.status(403).json({ success: false, message: 'Apenas administradores.' });
      }

      const { titulo, mensagem, unidades = [], grupos = [], todos } = req.body;
      if (!titulo || !titulo.trim()) {
        return res.status(400).json({ success: false, message: 'Título é obrigatório.' });
      }

      const imagemUrl = req.file ? `/uploads/notificacoes/${req.file.filename}` : (req.body.imagem_url || null);

      const ins = await query(
        `INSERT INTO notificacoes (titulo, mensagem, imagem_url, tipo, criado_por)
         VALUES ($1, $2, $3, 'manual', $4) RETURNING id`,
        [titulo.trim(), mensagem || null, imagemUrl, req.user.id]
      );
      const notifId = ins.rows[0].id;

      let userIds = [];
      if (todos === 'true' || todos === true) {
        const r = await query('SELECT id FROM usuarios WHERE ativo = true');
        userIds = r.rows.map(r => r.id);
      } else {
        const unidadeArr = Array.isArray(unidades) ? unidades : [unidades].filter(Boolean);
        const grupoArr   = Array.isArray(grupos)   ? grupos   : [grupos].filter(Boolean);
        userIds = await resolverDestinatarios(unidadeArr, grupoArr);
      }

      await inserirDestinatarios(notifId, userIds);

      res.json({ success: true, notificacao_id: notifId, total_destinatarios: userIds.length });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // DELETE /notificacoes/admin/:id  — arquivar notificação
  static async adminArquivar(req, res) {
    try {
      if (req.user.perfil !== 'admin') return res.status(403).json({ success: false });
      await query('UPDATE notificacoes SET ativo = false WHERE id = $1', [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // ── Helpers estáticos (chamados por outros controllers) ──────────────────

  // Cria notificação automática de documento pendente de assinatura
  static async criarNotificacaoDocPendente(docTitulo, grupoIds, docToken, baseUrl) {
    try {
      const link = baseUrl ? `${baseUrl}/assinaturas-doc/pendentes` : '/assinaturas-doc/pendentes';
      const ins = await query(
        `INSERT INTO notificacoes (titulo, mensagem, tipo, criado_por)
         VALUES ($1, $2, 'doc_pendente', NULL) RETURNING id`,
        [
          `Assinatura pendente: ${docTitulo}`,
          `O documento "${docTitulo}" requer a sua assinatura eletrônica.\n\nAcesse: ${link}`
        ]
      );
      const notifId = ins.rows[0].id;
      const userIds = await resolverDestinatarios([], grupoIds);
      await inserirDestinatarios(notifId, userIds);
    } catch (_) {}
  }

  // Cria notificação de aniversário para um usuário
  static async criarNotificacaoAniversario(usuario) {
    try {
      const ins = await query(
        `INSERT INTO notificacoes (titulo, mensagem, tipo, criado_por)
         VALUES ($1, $2, 'aniversario', NULL) RETURNING id`,
        [
          `Feliz Aniversário, ${usuario.nome.split(' ')[0]}! 🎂`,
          `Hoje é o seu aniversário! Toda a equipe deseja a você um dia repleto de alegria, saúde e conquistas. Que este novo ano de vida seja cheio de realizações e momentos especiais. Parabéns! 🎉`
        ]
      );
      await inserirDestinatarios(ins.rows[0].id, [usuario.id]);
    } catch (_) {}
  }

  // Verifica aniversariantes do dia e cria notificações (chamado no boot e diariamente)
  static async verificarAniversarios() {
    try {
      const hoje = await query(
        `SELECT id, nome FROM usuarios
         WHERE ativo = true
           AND data_nascimento IS NOT NULL
           AND EXTRACT(MONTH FROM data_nascimento) = EXTRACT(MONTH FROM NOW())
           AND EXTRACT(DAY   FROM data_nascimento) = EXTRACT(DAY   FROM NOW())`
      );
      for (const u of hoje.rows) {
        // Verificar se já foi criada notificação de aniversário hoje para este usuário
        const jaExiste = await query(
          `SELECT 1 FROM notificacoes n
           JOIN notificacoes_destinatarios nd ON nd.notificacao_id = n.id
           WHERE n.tipo = 'aniversario'
             AND nd.usuario_id = $1
             AND DATE(n.criado_em) = CURRENT_DATE`,
          [u.id]
        );
        if (jaExiste.rows.length === 0) {
          await NotificacaoController.criarNotificacaoAniversario(u);
          console.log(`🎂 Notificação de aniversário criada para: ${u.nome}`);
        }
      }
    } catch (err) {
      console.warn('Aviso verificarAniversarios:', err.message);
    }
  }
}

NotificacaoController.upload = upload;
module.exports = NotificacaoController;
