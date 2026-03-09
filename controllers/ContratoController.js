const Contrato = require('../models/Contrato');
const { query } = require('../config/database');
const { auditLog } = require('../utils/logger');
const path = require('path');
const fs = require('fs');

const TIPO_LABELS = { prestacao_servico: 'Prestação de Serviço', fornecimento: 'Fornecimento', locacao: 'Locação', terceirizacao: 'Terceirização' };
const STATUS_LABELS = { ativo: 'Ativo', suspenso: 'Suspenso', encerrado: 'Encerrado', em_renovacao: 'Em Renovação', cancelado: 'Cancelado' };

class ContratoController {
  // ─── Listagem com mini-dashboard, gráfico e alertas ────────────────
  static async index(req, res) {
    try {
      const filtros = {
        status: req.query.status, tipo: req.query.tipo,
        busca: req.query.busca, departamento: req.query.departamento,
        mes: req.query.mes || null
      };

      const agora = new Date();
      const grafInicio = req.query.graf_inicio || `${agora.getFullYear()}-01-01`;
      const grafFim = req.query.graf_fim || `${agora.getFullYear()}-12-01`;

      const [contratos, dash, alertas, departamentos, custoMensal] = await Promise.all([
        Contrato.listar(filtros),
        Contrato.dashboard(),
        Contrato.alertas(),
        Contrato.listarDepartamentos(),
        Contrato.custoMensalPorPeriodo(grafInicio, grafFim)
      ]);
      const totalAlertas = (alertas.vencendo?.length || 0) + (alertas.obrigacoesAtrasadas?.length || 0) + (alertas.slaFora?.length || 0) + (alertas.reajustes?.length || 0);
      res.render('contratos/index', {
        title: 'Contratos - DataFlow', user: req.user,
        contratos, dash, alertas, totalAlertas, filtros, departamentos,
        custoMensal, grafInicio, grafFim,
        TIPO_LABELS, STATUS_LABELS
      });
    } catch (error) {
      console.error('Erro ao listar contratos:', error);
      res.status(500).render('error', { title: 'Erro', message: 'Erro ao carregar contratos' });
    }
  }

  // ─── Formulário novo ──────────────────────────────────────────────
  static async formNovo(req, res) {
    try {
      const [proximoCodigo, fornecedores, usuarios] = await Promise.all([
        Contrato.proximoCodigo(),
        query('SELECT id, nome_fantasia, razao_social, cnpj FROM fornecedores WHERE ativo=true ORDER BY COALESCE(nome_fantasia,razao_social) ASC'),
        query('SELECT id, nome FROM usuarios WHERE ativo=true ORDER BY nome ASC')
      ]);
      res.render('contratos/form', {
        title: 'Novo Contrato - DataFlow', user: req.user,
        contrato: { codigo: proximoCodigo, status: 'ativo', moeda: 'BRL' },
        fornecedores: fornecedores.rows, usuarios: usuarios.rows,
        editando: false, erro: null, TIPO_LABELS, STATUS_LABELS
      });
    } catch (error) {
      console.error('Erro ao abrir formulário:', error);
      res.status(500).render('error', { title: 'Erro', message: 'Erro ao abrir formulário de contrato' });
    }
  }

  // ─── Criar contrato ───────────────────────────────────────────────
  static async criar(req, res) {
    try {
      const dados = req.body;
      if (!dados.codigo || !dados.nome || !dados.tipo) {
        const [fornecedores, usuarios] = await Promise.all([
          query('SELECT id, nome_fantasia, razao_social, cnpj FROM fornecedores WHERE ativo=true ORDER BY COALESCE(nome_fantasia,razao_social) ASC'),
          query('SELECT id, nome FROM usuarios WHERE ativo=true ORDER BY nome ASC')
        ]);
        return res.render('contratos/form', {
          title: 'Novo Contrato - DataFlow', user: req.user,
          contrato: dados, fornecedores: fornecedores.rows, usuarios: usuarios.rows,
          editando: false, erro: 'Código, nome e tipo são obrigatórios.', TIPO_LABELS, STATUS_LABELS
        });
      }
      dados.unidade_id = req.session?.unidadeSelecionada || null;
      const contrato = await Contrato.criar(dados);
      auditLog('CONTRATO_CRIADO', req.user.id, { contrato_id: contrato.id, codigo: contrato.codigo, ip: req.ip });
      await Contrato.registrarAuditoria(contrato.id, req.user.id, 'criacao', null, `Contrato ${contrato.codigo} criado`);
      req.flash && req.flash('success', 'Contrato criado com sucesso!');
      res.redirect(`/contratos/${contrato.id}`);
    } catch (error) {
      if (error.code === '23505') {
        req.flash && req.flash('error', 'Código de contrato já existe.');
        return res.redirect('/contratos/novo');
      }
      console.error('Erro ao criar contrato:', error);
      res.status(500).render('error', { title: 'Erro', message: 'Erro ao criar contrato' });
    }
  }

  // ─── Detalhes (com todas as abas) ─────────────────────────────────
  static async detalhes(req, res) {
    try {
      const { id } = req.params;
      const contrato = await Contrato.buscarPorId(id);
      if (!contrato) return res.status(404).render('error', { title: 'Erro', message: 'Contrato não encontrado' });

      const [obrigacoes, pagamentos, slas, aditivos, anexos, auditoria, financeiro, slaTaxa, usuarios] = await Promise.all([
        Contrato.listarObrigacoes(id),
        Contrato.listarPagamentos(id),
        Contrato.listarSLAs(id),
        Contrato.listarAditivos(id),
        Contrato.listarAnexos(id),
        Contrato.listarAuditoria(id),
        Contrato.resumoFinanceiro(id),
        Contrato.taxaCumprimentoSLA(id),
        query('SELECT id, nome FROM usuarios WHERE ativo=true ORDER BY nome ASC')
      ]);

      res.render('contratos/detalhes', {
        title: `${contrato.codigo} - Contrato - DataFlow`, user: req.user,
        contrato, obrigacoes, pagamentos, slas, aditivos, anexos, auditoria,
        financeiro, slaTaxa, usuarios: usuarios.rows,
        TIPO_LABELS, STATUS_LABELS,
        aba: req.query.aba || 'resumo',
        cancelar: req.query.cancelar === '1'
      });
    } catch (error) {
      console.error('Erro ao buscar contrato:', error);
      res.status(500).render('error', { title: 'Erro', message: 'Erro ao carregar contrato' });
    }
  }

  // ─── Formulário edição ────────────────────────────────────────────
  static async formEditar(req, res) {
    try {
      const contrato = await Contrato.buscarPorId(req.params.id);
      if (!contrato) return res.status(404).render('error', { title: 'Erro', message: 'Contrato não encontrado' });
      const [fornecedores, usuarios] = await Promise.all([
        query('SELECT id, nome_fantasia, razao_social, cnpj FROM fornecedores WHERE ativo=true ORDER BY COALESCE(nome_fantasia,razao_social) ASC'),
        query('SELECT id, nome FROM usuarios WHERE ativo=true ORDER BY nome ASC')
      ]);
      res.render('contratos/form', {
        title: `Editar ${contrato.codigo} - DataFlow`, user: req.user,
        contrato, fornecedores: fornecedores.rows, usuarios: usuarios.rows,
        editando: true, erro: null, TIPO_LABELS, STATUS_LABELS
      });
    } catch (error) {
      console.error('Erro ao carregar formulário:', error);
      res.status(500).render('error', { title: 'Erro', message: 'Erro ao carregar formulário' });
    }
  }

  // ─── Salvar edição ────────────────────────────────────────────────
  static async atualizar(req, res) {
    try {
      const { id } = req.params;
      const antigo = await Contrato.buscarPorId(id);
      if (!antigo) return res.status(404).render('error', { title: 'Erro', message: 'Contrato não encontrado' });

      const dados = req.body;
      const contrato = await Contrato.atualizar(id, dados);

      const campos = ['nome','tipo','descricao','empresa_contratada','departamento_responsavel','valor_total','valor_mensal','moeda','forma_pagamento','indice_reajuste','data_inicio','data_termino','prazo_meses','data_proximo_reajuste','status'];
      for (const campo of campos) {
        const va = antigo[campo] != null ? String(antigo[campo]) : '';
        const vn = dados[campo] != null ? String(dados[campo]) : '';
        if (va !== vn) await Contrato.registrarAuditoria(id, req.user.id, campo, va, vn);
      }

      auditLog('CONTRATO_ATUALIZADO', req.user.id, { contrato_id: id, ip: req.ip });
      req.flash && req.flash('success', 'Contrato atualizado!');
      res.redirect(`/contratos/${id}`);
    } catch (error) {
      console.error('Erro ao atualizar contrato:', error);
      res.status(500).render('error', { title: 'Erro', message: 'Erro ao atualizar contrato' });
    }
  }

  // ─── Excluir contrato ─────────────────────────────────────────────
  static async excluir(req, res) {
    try {
      await Contrato.excluir(req.params.id);
      auditLog('CONTRATO_EXCLUIDO', req.user.id, { contrato_id: req.params.id, ip: req.ip });
      if (req.xhr || req.headers.accept?.includes('application/json')) return res.json({ success: true });
      req.flash && req.flash('success', 'Contrato excluído.');
      res.redirect('/contratos');
    } catch (error) {
      console.error('Erro ao excluir contrato:', error);
      res.status(500).json({ success: false, message: 'Erro ao excluir contrato' });
    }
  }

  // ─── Cancelar contrato ───────────────────────────────────────────
  static async cancelar(req, res) {
    try {
      const { id } = req.params;
      const { motivo_cancelamento, motivo_outro } = req.body;

      if (!motivo_cancelamento) {
        req.flash && req.flash('error', 'Selecione um motivo de cancelamento.');
        return res.redirect(`/contratos/${id}`);
      }

      const motivoFinal = motivo_cancelamento === 'outro'
        ? (motivo_outro || 'Outro').trim()
        : motivo_cancelamento;

      const antigo = await Contrato.buscarPorId(id);
      if (!antigo) return res.status(404).render('error', { title: 'Erro', message: 'Contrato não encontrado' });

      await Contrato.cancelar(id, motivoFinal);
      await Contrato.registrarAuditoria(id, req.user.id, 'status', antigo.status, 'cancelado');
      await Contrato.registrarAuditoria(id, req.user.id, 'motivo_cancelamento', null, motivoFinal);
      auditLog('CONTRATO_CANCELADO', req.user.id, { contrato_id: id, motivo: motivoFinal, ip: req.ip });

      req.flash && req.flash('success', 'Contrato cancelado com sucesso.');
      res.redirect(`/contratos/${id}`);
    } catch (error) {
      console.error('Erro ao cancelar contrato:', error);
      req.flash && req.flash('error', 'Erro ao cancelar contrato.');
      res.redirect(`/contratos/${req.params.id}`);
    }
  }

  // ─── Obrigações ───────────────────────────────────────────────────
  static async criarObrigacao(req, res) {
    try {
      const dados = { ...req.body, contrato_id: req.params.id };
      await Contrato.criarObrigacao(dados);
      await Contrato.registrarAuditoria(req.params.id, req.user.id, 'obrigacao_criada', null, dados.descricao);
      req.flash && req.flash('success', 'Obrigação adicionada.');
      res.redirect(`/contratos/${req.params.id}?aba=obrigacoes`);
    } catch (error) {
      console.error('Erro ao criar obrigação:', error);
      req.flash && req.flash('error', 'Erro ao criar obrigação.');
      res.redirect(`/contratos/${req.params.id}?aba=obrigacoes`);
    }
  }

  static async atualizarObrigacao(req, res) {
    try {
      await Contrato.atualizarObrigacao(req.params.obrigacaoId, req.body);
      res.redirect(`/contratos/${req.params.id}?aba=obrigacoes`);
    } catch (error) {
      console.error('Erro ao atualizar obrigação:', error);
      res.redirect(`/contratos/${req.params.id}?aba=obrigacoes`);
    }
  }

  static async excluirObrigacao(req, res) {
    try {
      await Contrato.excluirObrigacao(req.params.obrigacaoId);
      res.redirect(`/contratos/${req.params.id}?aba=obrigacoes`);
    } catch (error) {
      console.error('Erro ao excluir obrigação:', error);
      res.redirect(`/contratos/${req.params.id}?aba=obrigacoes`);
    }
  }

  // ─── Pagamentos ───────────────────────────────────────────────────
  static async criarPagamento(req, res) {
    try {
      const dados = { ...req.body, contrato_id: req.params.id };
      await Contrato.criarPagamento(dados);
      await Contrato.registrarAuditoria(req.params.id, req.user.id, 'pagamento_registrado', null, `R$ ${dados.valor_pago}`);
      req.flash && req.flash('success', 'Pagamento registrado.');
      res.redirect(`/contratos/${req.params.id}?aba=financeiro`);
    } catch (error) {
      console.error('Erro ao registrar pagamento:', error);
      req.flash && req.flash('error', 'Erro ao registrar pagamento.');
      res.redirect(`/contratos/${req.params.id}?aba=financeiro`);
    }
  }

  static async excluirPagamento(req, res) {
    try {
      await Contrato.excluirPagamento(req.params.pagamentoId);
      res.redirect(`/contratos/${req.params.id}?aba=financeiro`);
    } catch (error) {
      console.error('Erro ao excluir pagamento:', error);
      res.redirect(`/contratos/${req.params.id}?aba=financeiro`);
    }
  }

  // ─── SLAs ─────────────────────────────────────────────────────────
  static async criarSLA(req, res) {
    try {
      const dados = { ...req.body, contrato_id: req.params.id };
      await Contrato.criarSLA(dados);
      req.flash && req.flash('success', 'Medição de SLA registrada.');
      res.redirect(`/contratos/${req.params.id}?aba=sla`);
    } catch (error) {
      console.error('Erro ao criar SLA:', error);
      req.flash && req.flash('error', 'Erro ao registrar SLA.');
      res.redirect(`/contratos/${req.params.id}?aba=sla`);
    }
  }

  static async excluirSLA(req, res) {
    try {
      await Contrato.excluirSLA(req.params.slaId);
      res.redirect(`/contratos/${req.params.id}?aba=sla`);
    } catch (error) {
      console.error('Erro ao excluir SLA:', error);
      res.redirect(`/contratos/${req.params.id}?aba=sla`);
    }
  }

  // ─── Aditivos ─────────────────────────────────────────────────────
  static async criarAditivo(req, res) {
    try {
      const dados = { ...req.body, contrato_id: req.params.id };
      await Contrato.criarAditivo(dados);
      await Contrato.registrarAuditoria(req.params.id, req.user.id, 'aditivo_criado', null, dados.tipo);

      if (dados.novo_valor) await Contrato.atualizar(req.params.id, { ...(await Contrato.buscarPorId(req.params.id)), valor_total: dados.novo_valor });
      if (dados.nova_data_termino) await Contrato.atualizar(req.params.id, { ...(await Contrato.buscarPorId(req.params.id)), data_termino: dados.nova_data_termino });

      req.flash && req.flash('success', 'Aditivo registrado.');
      res.redirect(`/contratos/${req.params.id}?aba=aditivos`);
    } catch (error) {
      console.error('Erro ao criar aditivo:', error);
      req.flash && req.flash('error', 'Erro ao registrar aditivo.');
      res.redirect(`/contratos/${req.params.id}?aba=aditivos`);
    }
  }

  static async excluirAditivo(req, res) {
    try {
      await Contrato.excluirAditivo(req.params.aditivoId);
      res.redirect(`/contratos/${req.params.id}?aba=aditivos`);
    } catch (error) {
      console.error('Erro ao excluir aditivo:', error);
      res.redirect(`/contratos/${req.params.id}?aba=aditivos`);
    }
  }

  // ─── Anexos ───────────────────────────────────────────────────────
  static async uploadAnexo(req, res) {
    try {
      if (!req.file) {
        req.flash && req.flash('error', 'Nenhum arquivo enviado.');
        return res.redirect(`/contratos/${req.params.id}?aba=anexos`);
      }
      const caminho = ['uploads', 'contratos', req.params.id, req.file.filename].join('/');
      await Contrato.criarAnexo({
        contrato_id: req.params.id,
        nome_original: req.file.originalname,
        nome_arquivo: req.file.filename,
        caminho,
        tipo: req.file.mimetype,
        tamanho: req.file.size,
        criado_por: req.user.id
      });
      req.flash && req.flash('success', 'Arquivo anexado.');
      res.redirect(`/contratos/${req.params.id}?aba=anexos`);
    } catch (error) {
      console.error('Erro ao anexar:', error);
      req.flash && req.flash('error', 'Erro ao anexar arquivo.');
      res.redirect(`/contratos/${req.params.id}?aba=anexos`);
    }
  }

  static async excluirAnexo(req, res) {
    try {
      const anexo = await Contrato.buscarAnexo(req.params.anexoId);
      if (anexo) {
        const caminhoFisico = path.join(__dirname, '..', 'public', anexo.caminho);
        if (fs.existsSync(caminhoFisico)) fs.unlinkSync(caminhoFisico);
        await Contrato.excluirAnexo(req.params.anexoId);
      }
      res.redirect(`/contratos/${req.params.id}?aba=anexos`);
    } catch (error) {
      console.error('Erro ao excluir anexo:', error);
      res.redirect(`/contratos/${req.params.id}?aba=anexos`);
    }
  }
}

module.exports = ContratoController;
