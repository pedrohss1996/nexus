const { query } = require('../config/database');
const { auditLog } = require('../utils/logger');
const FluxoEngine = require('../services/FluxoEngine');
const Grupo = require('../models/Grupo');
const Unidade = require('../models/Unidade');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const fluxoEtapasUploadDir = path.join(__dirname, '..', 'uploads', 'fluxo-etapas');
if (!fs.existsSync(fluxoEtapasUploadDir)) fs.mkdirSync(fluxoEtapasUploadDir, { recursive: true });

const uploadAnexoStorage = multer.diskStorage({
  destination: function (_req, _file, cb) { cb(null, fluxoEtapasUploadDir); },
  filename: function (_req, file, cb) {
    const safe = (file.originalname || 'anexo').replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(safe));
  }
});
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
  'application/zip',
]);

const uploadAnexoMulter = multer({
  storage: uploadAnexoStorage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) return cb(null, true);
    cb(new Error(`Tipo de arquivo não permitido: ${file.mimetype}`));
  }
});

function slugify(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function tryParseJSON(str) {
  if (str == null || str === '') return null;
  try {
    return JSON.parse(str);
  } catch (_) {
    return null;
  }
}

async function buildDocumentosVinculados(body) {
  const raw = body.documento_templates;
  const templateIds = Array.isArray(raw) ? raw : (raw != null && raw !== '' ? [].concat(raw) : []);
  if (templateIds.length > 0) {
    const ids = templateIds.map(t => parseInt(t, 10)).filter(n => !isNaN(n) && n > 0);
    if (ids.length === 0) return [];
    const templates = await query('SELECT id, nome FROM templates_pdf WHERE id = ANY($1::int[]) AND ativo = true', [ids]);
    return (templates.rows || []).map(r => ({ template_id: r.id, nome: r.nome }));
  }
  if (typeof body.documentos_vinculados === 'string') {
    const lines = body.documentos_vinculados.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    return lines.map(nome => ({ nome }));
  }
  return [];
}

class FluxoController {
  static async index(req, res) {
    try {
      const result = await query(
        `SELECT f.id, f.nome, f.slug, f.versao, f.criticidade_sla, f.criado_em,
                (SELECT COUNT(*) FROM fluxo_etapas e WHERE e.fluxo_id = f.id) AS total_etapas
         FROM fluxos f
         WHERE f.ativo = true
         ORDER BY f.nome ASC`
      );
      res.render('fluxos/index', {
        title: 'Fluxos - DataFlow',
        user: req.user,
        fluxos: result.rows
      });
    } catch (error) {
      console.error('Erro ao listar fluxos:', error);
      res.status(500).render('error', { title: 'Erro', message: 'Erro ao listar fluxos' });
    }
  }

  static create(req, res) {
    res.render('fluxos/form', {
      title: 'Novo Fluxo - DataFlow',
      user: req.user,
      fluxo: null
    });
  }

  static async store(req, res) {
    try {
      const { nome, descricao, versao, criticidade_sla } = req.body;
      if (!nome || !String(nome).trim()) {
        req.flash('error', 'Nome do fluxo é obrigatório.');
        return res.redirect('/fluxos/novo');
      }
      const slug = slugify(nome);
      const result = await query(
        `INSERT INTO fluxos (nome, slug, descricao, versao, criticidade_sla, criado_por)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          String(nome).trim(),
          slug,
          descricao ? String(descricao).trim() : null,
          versao ? String(versao).trim() : '1.0',
          criticidade_sla ? String(criticidade_sla).trim() : null,
          req.user.id
        ]
      );
      const row = result.rows[0];
      auditLog('FLUXO_CRIADO', req.user.id, { fluxo_id: row.id, nome: row.nome, ip: req.ip });
      req.flash('success', 'Fluxo criado. Agora configure as etapas e transições.');
      res.redirect('/fluxos/' + row.id + '/configurar');
    } catch (error) {
      if (error.code === '23505') {
        req.flash('error', 'Já existe um fluxo com nome semelhante.');
        return res.redirect('/fluxos/novo');
      }
      console.error('Erro ao criar fluxo:', error);
      res.status(500).render('error', { title: 'Erro', message: error.message || 'Erro ao criar fluxo' });
    }
  }

  static async configurar(req, res) {
    try {
      const { id } = req.params;
      const fluxo = await query('SELECT * FROM fluxos WHERE id = $1 AND ativo = true', [id]);
      if (fluxo.rows.length === 0) {
        req.flash('error', 'Fluxo não encontrado.');
        return res.redirect('/fluxos');
      }
      const etapas = await query(
        `SELECT e.*, g.nome AS proprietario_nome
         FROM fluxo_etapas e
         LEFT JOIN grupos g ON e.proprietario_tipo = 'grupo' AND e.proprietario_id = g.id
         WHERE e.fluxo_id = $1
         ORDER BY e.ordem ASC, e.codigo ASC`,
        [id]
      );
      const edges = await query(
        `SELECT e.*, o.codigo AS origem_codigo, o.nome AS origem_nome, d.codigo AS destino_codigo, d.nome AS destino_nome
         FROM fluxo_edges e
         JOIN fluxo_etapas o ON o.id = e.etapa_origem_id
         JOIN fluxo_etapas d ON d.id = e.etapa_destino_id
         WHERE e.fluxo_id = $1
         ORDER BY e.ordem`,
        [id]
      );
      const unidadeId = res.locals.unidadeSelecionada || req.session?.unidadeSelecionada;
      const gruposUnidade = unidadeId ? await Grupo.buscarTodos({ unidade_id: unidadeId }) : [];
      let unidadeNome = '';
      if (res.locals.unidades && unidadeId) {
        const u = res.locals.unidades.find(ux => ux.id === unidadeId);
        if (u) unidadeNome = u.nome;
      }
      if (!unidadeNome && unidadeId) {
        const un = await Unidade.buscarPorId(unidadeId);
        if (un) unidadeNome = un.nome || '';
      }
      let fluxoGruposIds = [];
      try {
        const fluxoGruposResult = await query('SELECT grupo_id FROM fluxo_grupos WHERE fluxo_id = $1', [id]);
        fluxoGruposIds = (fluxoGruposResult.rows || []).map(r => r.grupo_id);
      } catch (_) { /* tabela fluxo_grupos pode não existir ainda */ }

      const templatesPdf = await query('SELECT id, nome, tipo_documento FROM templates_pdf WHERE ativo = true ORDER BY tipo_documento, nome');
      const etapaIds = (etapas.rows || []).map(e => e.id);
      let anexosPorEtapa = {};
      if (etapaIds.length > 0) {
        try {
          const anexos = await query(
            'SELECT a.* FROM fluxo_etapa_anexos a INNER JOIN fluxo_etapas e ON e.id = a.etapa_id WHERE e.fluxo_id = $1 ORDER BY a.criado_em',
            [id]
          );
          (anexos.rows || []).forEach(a => {
            if (!anexosPorEtapa[a.etapa_id]) anexosPorEtapa[a.etapa_id] = [];
            anexosPorEtapa[a.etapa_id].push(a);
          });
        } catch (_) { /* tabela fluxo_etapa_anexos pode não existir */ }
      }

      // Diagnostico do desenho: aponta o que impediria o fluxo de rodar antes
      // que alguem descubra com um processo travado no meio do caminho.
      const diagnostico = await FluxoEngine.validarDesenho(id);

      res.render('fluxos/configurar', {
        title: 'Configurar Fluxo - DataFlow',
        user: req.user,
        diagnostico,
        fluxo: fluxo.rows[0],
        etapas: etapas.rows,
        edges: edges.rows,
        gruposUnidade: gruposUnidade || [],
        fluxoGruposIds: fluxoGruposIds,
        templatesPdf: (templatesPdf.rows || []),
        anexosPorEtapa: anexosPorEtapa,
        unidadeSelecionada: unidadeId,
        unidadeNome: unidadeNome || ''
      });
    } catch (error) {
      console.error('Erro ao carregar fluxo:', error);
      res.status(500).render('error', { title: 'Erro', message: 'Erro ao carregar fluxo' });
    }
  }

  static async edit(req, res) {
    try {
      const { id } = req.params;
      const fluxo = await query('SELECT * FROM fluxos WHERE id = $1 AND ativo = true', [id]);
      if (fluxo.rows.length === 0) {
        req.flash('error', 'Fluxo não encontrado.');
        return res.redirect('/fluxos');
      }
      res.render('fluxos/form', {
        title: 'Editar Fluxo - DataFlow',
        user: req.user,
        fluxo: fluxo.rows[0]
      });
    } catch (error) {
      console.error('Erro ao abrir edição:', error);
      res.status(500).render('error', { title: 'Erro', message: 'Erro ao abrir edição' });
    }
  }

  static async update(req, res) {
    try {
      const { id } = req.params;
      const { nome, descricao, versao, criticidade_sla } = req.body;
      if (!nome || !String(nome).trim()) {
        req.flash('error', 'Nome do fluxo é obrigatório.');
        return res.redirect('/fluxos/' + id + '/editar');
      }
      const slug = slugify(nome);
      await query(
        `UPDATE fluxos SET nome = $1, slug = $2, descricao = $3, versao = $4, criticidade_sla = $5, atualizado_em = NOW()
         WHERE id = $6 AND ativo = true`,
        [
          String(nome).trim(),
          slug,
          descricao ? String(descricao).trim() : null,
          versao ? String(versao).trim() : '1.0',
          criticidade_sla ? String(criticidade_sla).trim() : null,
          id
        ]
      );
      auditLog('FLUXO_ATUALIZADO', req.user.id, { fluxo_id: id, ip: req.ip });
      req.flash('success', 'Fluxo atualizado.');
      res.redirect('/fluxos/' + id + '/configurar');
    } catch (error) {
      if (error.code === '23505') {
        req.flash('error', 'Já existe um fluxo com nome semelhante.');
        return res.redirect('/fluxos/' + req.params.id + '/editar');
      }
      console.error('Erro ao atualizar fluxo:', error);
      res.status(500).render('error', { title: 'Erro', message: error.message || 'Erro ao atualizar fluxo' });
    }
  }

  static async storeEtapa(req, res) {
    try {
      const fluxoId = req.params.id;
      const { nome, codigo, ordem, eh_inicio, eh_fim, proprietario_tipo, proprietario_id, tipo_acao, documentos_vinculados, prazo_em_dias, exige_assinatura } = req.body;
      const fluxo = await query('SELECT id FROM fluxos WHERE id = $1 AND ativo = true', [fluxoId]);
      if (fluxo.rows.length === 0) {
        req.flash('error', 'Fluxo não encontrado.');
        return res.redirect('/fluxos');
      }
      const cod = (codigo && String(codigo).trim()) || slugify(nome || 'etapa');
      const ord = ordem !== '' && ordem !== undefined ? parseInt(ordem, 10) : (await query('SELECT COALESCE(MAX(ordem), 0) + 1 AS next FROM fluxo_etapas WHERE fluxo_id = $1', [fluxoId])).rows[0].next;
      const docs = await buildDocumentosVinculados(req.body);
      const prazo = prazo_em_dias !== '' && prazo_em_dias != null ? parseInt(prazo_em_dias, 10) : null;
      const assinatura = exige_assinatura === 'on' || exige_assinatura === true || exige_assinatura === '1';
      const ei = eh_inicio === 'on' || eh_inicio === true || eh_inicio === '1';
      const ef = eh_fim === 'on' || eh_fim === true || eh_fim === '1';
      let pid = null;
      if (proprietario_id !== undefined && proprietario_id !== null && proprietario_id !== '') {
        const tmp = parseInt(proprietario_id, 10);
        pid = Number.isNaN(tmp) ? null : tmp;
      }
      if (ei) {
        await query('UPDATE fluxo_etapas SET eh_inicio = false WHERE fluxo_id = $1', [fluxoId]);
      }
      const countResult = await query('SELECT COUNT(*) as total FROM fluxo_etapas WHERE fluxo_id = $1', [fluxoId]);
      const totalEtapas = parseInt(countResult.rows[0].total, 10);
      const posX = 50 + (totalEtapas % 5) * 220;
      const posY = 50 + Math.floor(totalEtapas / 5) * 150;
      const result = await query(
        `INSERT INTO fluxo_etapas (fluxo_id, nome, codigo, ordem, eh_inicio, eh_fim, proprietario_tipo, proprietario_id, tipo_acao, documentos_vinculados, prazo_em_dias, exige_assinatura, pos_x, pos_y)
         VALUES ($1, $2, $3, $4, $5, $6, 'grupo', $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [fluxoId, String(nome || 'Nova etapa').trim(), cod, ord, ei, ef, pid, tipo_acao || 'formulario', JSON.stringify(docs), prazo, assinatura, posX, posY]
      );
      const row = result.rows[0];
      auditLog('FLUXO_ETAPA_CRIADA', req.user.id, { fluxo_id: fluxoId, etapa_id: row.id, ip: req.ip });
      if (req.xhr || req.headers.accept?.includes('application/json')) return res.json({ success: true, etapa: row });
      req.flash('success', 'Etapa adicionada.');
      res.redirect('/fluxos/' + fluxoId + '/configurar');
    } catch (error) {
      if (error.code === '23505') {
        if (req.xhr || req.headers.accept?.includes('application/json')) return res.status(400).json({ success: false, message: 'Código da etapa já existe neste fluxo.' });
        req.flash('error', 'Código da etapa já existe neste fluxo.');
        return res.redirect('/fluxos/' + req.params.id + '/configurar');
      }
      console.error('Erro ao criar etapa:', error);
      if (req.xhr || req.headers.accept?.includes('application/json')) return res.status(500).json({ success: false, message: error.message || 'Erro ao criar etapa' });
      req.flash('error', error.message || 'Erro ao criar etapa.');
      res.redirect('/fluxos/' + req.params.id + '/configurar');
    }
  }

  static async reorderEtapas(req, res) {
    try {
      const { id: fluxoId } = req.params;
      const { ordens } = req.body;
      if (!Array.isArray(ordens)) return res.status(400).json({ success: false, message: 'Formato inválido' });
      for (const item of ordens) {
        await query('UPDATE fluxo_etapas SET ordem = $1 WHERE id = $2 AND fluxo_id = $3', [item.ordem, item.id, fluxoId]);
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Erro ao reordenar etapas:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async updateEtapa(req, res) {
    try {
      const { id: fluxoId, etapaId } = req.params;
      const { nome, codigo, ordem, eh_inicio, eh_fim, proprietario_id, tipo_acao, documentos_vinculados, prazo_em_dias, exige_assinatura, campos_requeridos } = req.body;
      const etapa = await query('SELECT id FROM fluxo_etapas WHERE id = $1 AND fluxo_id = $2', [etapaId, fluxoId]);
      if (etapa.rows.length === 0) {
        if (req.xhr || req.headers.accept?.includes('application/json')) return res.status(404).json({ success: false, message: 'Etapa não encontrada.' });
        req.flash('error', 'Etapa não encontrada.');
        return res.redirect('/fluxos/' + fluxoId + '/configurar');
      }
      const cod = (codigo && String(codigo).trim()) || undefined;
      const ord = ordem !== '' && ordem !== undefined ? parseInt(ordem, 10) : undefined;
      const ei = eh_inicio === 'on' || eh_inicio === true || eh_inicio === '1';
      const ef = eh_fim === 'on' || eh_fim === true || eh_fim === '1';
      let pid = null;
      if (proprietario_id !== undefined && proprietario_id !== null && proprietario_id !== '') {
        const tmp = parseInt(proprietario_id, 10);
        pid = Number.isNaN(tmp) ? null : tmp;
      }
      const docs = await buildDocumentosVinculados(req.body);
      const prazo = prazo_em_dias !== '' && prazo_em_dias != null ? parseInt(prazo_em_dias, 10) : null;
      const assinatura = exige_assinatura === 'on' || exige_assinatura === true || exige_assinatura === '1';
      if (ei) {
        await query('UPDATE fluxo_etapas SET eh_inicio = false WHERE fluxo_id = $1 AND id != $2', [fluxoId, etapaId]);
      }
      const camposReq = campos_requeridos ? tryParseJSON(campos_requeridos) : null;
      await query(
        `UPDATE fluxo_etapas SET
          nome = COALESCE($1, nome),
          codigo = COALESCE($2, codigo),
          ordem = COALESCE($3, ordem),
          eh_inicio = $4,
          eh_fim = $5,
          proprietario_tipo = 'grupo',
          proprietario_id = $6,
          tipo_acao = COALESCE($7, tipo_acao),
          documentos_vinculados = COALESCE($8, documentos_vinculados),
          prazo_em_dias = $9,
          exige_assinatura = $10,
          campos_requeridos = COALESCE($11, campos_requeridos)
         WHERE id = $12 AND fluxo_id = $13`,
        [nome && String(nome).trim() ? String(nome).trim() : null, cod, ord, ei, ef, pid, tipo_acao || undefined, JSON.stringify(docs), prazo, assinatura, camposReq ? JSON.stringify(camposReq) : null, etapaId, fluxoId]
      );
      const updated = await query('SELECT * FROM fluxo_etapas WHERE id = $1', [etapaId]);
      auditLog('FLUXO_ETAPA_ATUALIZADA', req.user.id, { fluxo_id: fluxoId, etapa_id: etapaId, ip: req.ip });
      if (req.xhr || req.headers.accept?.includes('application/json')) return res.json({ success: true, etapa: updated.rows[0] });
      req.flash('success', 'Etapa atualizada.');
      res.redirect('/fluxos/' + fluxoId + '/configurar');
    } catch (error) {
      if (error.code === '23505') {
        if (req.xhr || req.headers.accept?.includes('application/json')) return res.status(400).json({ success: false, message: 'Código da etapa já existe neste fluxo.' });
        req.flash('error', 'Código da etapa já existe neste fluxo.');
        return res.redirect('/fluxos/' + req.params.id + '/configurar');
      }
      console.error('Erro ao atualizar etapa:', error);
      if (req.xhr || req.headers.accept?.includes('application/json')) return res.status(500).json({ success: false, message: error.message || 'Erro ao atualizar etapa' });
      req.flash('error', error.message || 'Erro ao atualizar etapa.');
      res.redirect('/fluxos/' + req.params.id + '/configurar');
    }
  }

  static async destroyEtapa(req, res) {
    try {
      const { id: fluxoId, etapaId } = req.params;
      const etapa = await query('SELECT id FROM fluxo_etapas WHERE id = $1 AND fluxo_id = $2', [etapaId, fluxoId]);
      if (etapa.rows.length === 0) {
        if (req.xhr || req.headers.accept?.includes('application/json')) return res.status(404).json({ success: false, message: 'Etapa não encontrada.' });
        req.flash('error', 'Etapa não encontrada.');
        return res.redirect('/fluxos/' + fluxoId + '/configurar');
      }
      await query('DELETE FROM fluxo_etapas WHERE id = $1 AND fluxo_id = $2', [etapaId, fluxoId]);
      auditLog('FLUXO_ETAPA_EXCLUIDA', req.user.id, { fluxo_id: fluxoId, etapa_id: etapaId, ip: req.ip });
      if (req.xhr || req.headers.accept?.includes('application/json')) return res.json({ success: true });
      req.flash('success', 'Etapa removida.');
      res.redirect('/fluxos/' + fluxoId + '/configurar');
    } catch (error) {
      console.error('Erro ao excluir etapa:', error);
      if (req.xhr || req.headers.accept?.includes('application/json')) return res.status(500).json({ success: false, message: error.message || 'Erro ao excluir etapa' });
      req.flash('error', error.message || 'Erro ao excluir etapa.');
      res.redirect('/fluxos/' + req.params.id + '/configurar');
    }
  }

  static async updateEtapaArea(req, res) {
    try {
      const { id: fluxoId, etapaId } = req.params;
      const { proprietario_id } = req.body;
      const etapa = await query('SELECT id FROM fluxo_etapas WHERE id = $1 AND fluxo_id = $2', [etapaId, fluxoId]);
      if (etapa.rows.length === 0) return res.status(404).json({ success: false, message: 'Etapa não encontrada.' });
      const pid = proprietario_id != null && proprietario_id !== '' ? parseInt(proprietario_id, 10) : null;
      await query(
        `UPDATE fluxo_etapas SET proprietario_tipo = 'grupo', proprietario_id = $1 WHERE id = $2 AND fluxo_id = $3`,
        [pid, etapaId, fluxoId]
      );
      return res.json({ success: true });
    } catch (error) {
      console.error('Erro ao atualizar área da etapa:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async updateEtapaPosicao(req, res) {
    try {
      const { id: fluxoId, etapaId } = req.params;
      const { pos_x, pos_y } = req.body;
      const etapa = await query('SELECT id FROM fluxo_etapas WHERE id = $1 AND fluxo_id = $2', [etapaId, fluxoId]);
      if (etapa.rows.length === 0) return res.status(404).json({ success: false, message: 'Etapa não encontrada.' });
      const x = pos_x != null ? parseInt(pos_x, 10) : null;
      const y = pos_y != null ? parseInt(pos_y, 10) : null;
      await query(
        `UPDATE fluxo_etapas SET pos_x = $1, pos_y = $2 WHERE id = $3 AND fluxo_id = $4`,
        [x, y, etapaId, fluxoId]
      );
      return res.json({ success: true });
    } catch (error) {
      console.error('Erro ao atualizar posição da etapa:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async storeEdge(req, res) {
    try {
      const fluxoId = req.params.id;
      const { etapa_origem_id, etapa_destino_id, label } = req.body;
      const origemId = etapa_origem_id ? parseInt(etapa_origem_id, 10) : null;
      const destinoId = etapa_destino_id ? parseInt(etapa_destino_id, 10) : null;
      if (!origemId || !destinoId) return res.status(400).json({ success: false, message: 'Origem e destino são obrigatórios.' });
      const check = await query('SELECT id FROM fluxo_etapas WHERE id IN ($1, $2) AND fluxo_id = $3', [origemId, destinoId, fluxoId]);
      if (check.rows.length !== 2) return res.status(400).json({ success: false, message: 'Etapas devem pertencer ao fluxo.' });
      const result = await query(
        `INSERT INTO fluxo_edges (fluxo_id, etapa_origem_id, etapa_destino_id, label, ordem)
         VALUES ($1, $2, $3, $4, (SELECT COALESCE(MAX(ordem), 0) + 1 FROM fluxo_edges WHERE fluxo_id = $1))
         RETURNING *`,
        [fluxoId, origemId, destinoId, label ? String(label).trim() : null]
      );
      return res.json({ success: true, edge: result.rows[0] });
    } catch (error) {
      console.error('Erro ao criar transição:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async destroyEdge(req, res) {
    try {
      const { id: fluxoId, edgeId } = req.params;
      const result = await query('DELETE FROM fluxo_edges WHERE id = $1 AND fluxo_id = $2 RETURNING id', [edgeId, fluxoId]);
      if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Transição não encontrada.' });
      return res.json({ success: true });
    } catch (error) {
      console.error('Erro ao excluir transição:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async updateGrupos(req, res) {
    try {
      const fluxoId = req.params.id;
      const raw = req.body.grupo_ids;
      const grupoIds = Array.isArray(raw) ? raw : (raw != null && raw !== '' ? [].concat(raw) : []);
      const ids = grupoIds.map(g => parseInt(g, 10)).filter(n => !isNaN(n) && n > 0);
      await query('DELETE FROM fluxo_grupos WHERE fluxo_id = $1', [fluxoId]);
      for (const grupoId of ids) {
        await query('INSERT INTO fluxo_grupos (fluxo_id, grupo_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [fluxoId, grupoId]);
      }
      if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('application/json') !== -1)) {
        return res.json({ success: true, message: 'Grupos atualizados.' });
      }
      req.flash('success', 'Grupos do processo atualizados.');
      res.redirect('/fluxos/' + fluxoId + '/configurar');
    } catch (error) {
      console.error('Erro ao atualizar grupos do fluxo:', error);
      if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('application/json') !== -1)) {
        return res.status(500).json({ success: false, message: error.message || 'Erro ao atualizar grupos.' });
      }
      req.flash('error', 'Erro ao atualizar grupos.');
      res.redirect('/fluxos/' + req.params.id + '/configurar');
    }
  }

  static async uploadAnexo(req, res) {
    try {
      const { id: fluxoId, etapaId } = req.params;
      if (!req.file || !req.file.filename) {
        return res.status(400).json({ success: false, message: 'Nenhum arquivo enviado.' });
      }
      const etapa = await query('SELECT id FROM fluxo_etapas WHERE id = $1 AND fluxo_id = $2', [etapaId, fluxoId]);
      if (etapa.rows.length === 0) return res.status(404).json({ success: false, message: 'Etapa não encontrada.' });
      const nomeOriginal = req.file.originalname || req.file.filename;
      const result = await query(
        'INSERT INTO fluxo_etapa_anexos (etapa_id, nome_arquivo, nome_original, tamanho, tipo_mime) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [etapaId, req.file.filename, nomeOriginal, req.file.size || 0, req.file.mimetype || null]
      );
      return res.json({ success: true, anexo: result.rows[0] });
    } catch (error) {
      console.error('Erro ao fazer upload de anexo:', error);
      return res.status(500).json({ success: false, message: error.message || 'Erro ao anexar arquivo.' });
    }
  }

  static async deleteAnexo(req, res) {
    try {
      const { id: fluxoId, etapaId, anexoId } = req.params;
      const anexo = await query(
        'SELECT a.* FROM fluxo_etapa_anexos a INNER JOIN fluxo_etapas e ON e.id = a.etapa_id WHERE a.id = $1 AND a.etapa_id = $2 AND e.fluxo_id = $3',
        [anexoId, etapaId, fluxoId]
      );
      if (anexo.rows.length === 0) return res.status(404).json({ success: false, message: 'Anexo não encontrado.' });
      const nomeArquivo = anexo.rows[0].nome_arquivo;
      const filePath = path.join(fluxoEtapasUploadDir, nomeArquivo);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      await query('DELETE FROM fluxo_etapa_anexos WHERE id = $1', [anexoId]);
      return res.json({ success: true });
    } catch (error) {
      console.error('Erro ao excluir anexo:', error);
      return res.status(500).json({ success: false, message: error.message || 'Erro ao excluir anexo.' });
    }
  }

  static async downloadAnexo(req, res) {
    try {
      const { id: fluxoId, etapaId, anexoId } = req.params;
      const anexo = await query(
        'SELECT a.* FROM fluxo_etapa_anexos a INNER JOIN fluxo_etapas e ON e.id = a.etapa_id WHERE a.id = $1 AND a.etapa_id = $2 AND e.fluxo_id = $3',
        [anexoId, etapaId, fluxoId]
      );
      if (anexo.rows.length === 0) return res.status(404).send('Anexo não encontrado.');
      const filePath = path.join(fluxoEtapasUploadDir, anexo.rows[0].nome_arquivo);
      if (!fs.existsSync(filePath)) return res.status(404).send('Arquivo não encontrado.');
      res.download(filePath, anexo.rows[0].nome_original);
    } catch (error) {
      console.error('Erro ao baixar anexo:', error);
      res.status(500).send('Erro ao baixar arquivo.');
    }
  }

  static async aiSuggest(req, res) {
    try {
      const { descricao, grupos } = req.body;
      if (!descricao || !String(descricao).trim()) {
        return res.status(400).json({ success: false, message: 'Descrição do processo é obrigatória.' });
      }

      const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
      const hasGemini    = !!process.env.GEMINI_API_KEY;

      if (!hasAnthropic && !hasGemini) {
        return res.status(503).json({ success: false, message: 'Nenhuma chave de IA configurada. Adicione GEMINI_API_KEY (gratuito) ou ANTHROPIC_API_KEY no arquivo .env e reinicie o servidor.' });
      }

      const gruposStr = Array.isArray(grupos) && grupos.length > 0
        ? grupos.map(g => `- "${g.nome}" (id: ${g.id})`).join('\n')
        : '(nenhum grupo disponível)';

      const prompt = `Você é um especialista em mapeamento de processos e BPM (Business Process Management).
Analise a descrição do processo abaixo e gere uma estrutura de fluxo de trabalho no formato JSON.

Tipos de etapa disponíveis:
- "questionario": formulário que um usuário preenche com dados/informações
- "aprovacao": etapa de aprovação/reprovação por um responsável
- "parecer": emissão de parecer técnico por especialista
- "assinatura_digital": etapa que requer assinatura digital de documento

Regras:
1. UMA etapa com "eh_inicio": true (a primeira) e UMA com "eh_fim": true (a última)
2. Use "label": "sempre" para fluxo linear, "Sim"/"Não" para ramificações de aprovação
3. Sugira o grupo mais adequado usando os IDs dos grupos disponíveis
4. 3 a 8 etapas para a maioria dos processos

Grupos disponíveis:
${gruposStr}

Processo: ${String(descricao).trim()}

Retorne APENAS JSON válido neste formato (sem texto extra, sem markdown):
{"titulo_sugerido":"...","descricao_sugerida":"...","etapas":[{"ordem":1,"nome":"...","tipo_acao":"questionario","eh_inicio":true,"eh_fim":false,"grupo_id_sugerido":null,"prazo_em_dias":null}],"edges":[{"origem_ordem":1,"destino_ordem":2,"label":"sempre"}]}`;

      let raw = '';

      if (hasAnthropic) {
        const Anthropic = require('@anthropic-ai/sdk');
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const message = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2048,
          messages: [{ role: 'user', content: prompt }]
        });
        raw = message.content[0].text.trim();
      } else {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await model.generateContent(prompt);
        raw = result.response.text().trim();
      }

      const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/);
      if (!jsonMatch) {
        return res.status(500).json({ success: false, message: 'A IA não retornou JSON válido. Tente reformular a descrição.' });
      }
      const suggestion = JSON.parse(jsonMatch[1]);
      return res.json({ success: true, suggestion });
    } catch (error) {
      console.error('Erro no AI suggest:', error);
      const body = error.error || {};
      const msg = (error.status === 401 || (error.message||'').includes('API key'))
                    ? 'Chave de API inválida. Verifique o .env e reinicie o servidor.'
                  : error.status === 429
                    ? 'Limite de requisições atingido. Aguarde um momento e tente novamente.'
                  : (error.status === 400 && String(body.message||'').includes('credit'))
                    ? 'Saldo insuficiente na Anthropic API. Use GEMINI_API_KEY (gratuito) ou adicione créditos em console.anthropic.com.'
                  : error.message || 'Erro ao chamar a IA.';
      return res.status(500).json({ success: false, message: msg });
    }
  }
}

FluxoController.uploadAnexoMulter = uploadAnexoMulter;
module.exports = FluxoController;
