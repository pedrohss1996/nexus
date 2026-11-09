// Controller: Usuario
// Descrição: Gerencia operações de usuários

const Usuario = require('../models/Usuario');
const Grupo = require('../models/Grupo');
const { auditLog } = require('../utils/logger');
const acesso = require('../services/acesso');
const { unidadeDaRequisicao } = require('../utils/unidadeScope');

class UsuarioController {
  // Listar todos os usuários
  static async listar(req, res) {
    try {
      const { perfil, ativo, busca } = req.query;
      const filtros = {};
      
      if (perfil) filtros.perfil = perfil;
      if (ativo !== undefined) filtros.ativo = ativo === 'true';
      if (busca) filtros.busca = busca;

      const usuarios = await Usuario.buscarTodos(filtros);
      const estatisticas = await Usuario.obterEstatisticas();

      res.render('usuarios/listar', {
        title: 'Usuários - DataFlow',
        user: req.user,
        usuarios,
        estatisticas,
        filtros
      });
    } catch (error) {
      console.error('Erro ao listar usuários:', error);
      res.status(500).render('error', {
        title: 'Erro - DataFlow',
        message: 'Erro ao carregar usuários'
      });
    }
  }

  // Exibir detalhes do usuário
  static async detalhes(req, res) {
    try {
      const { id } = req.params;
      const usuario = await Usuario.buscarPorId(id);
      
      if (!usuario) {
        return res.status(404).render('error', {
          title: 'Erro - DataFlow',
          message: 'Usuário não encontrado'
        });
      }

      const grupos = await Usuario.buscarGrupos(id);

      res.render('usuarios/detalhes', {
        title: `${usuario.nome} - DataFlow`,
        user: req.user,
        usuario,
        grupos
      });
    } catch (error) {
      console.error('Erro ao buscar usuário:', error);
      res.status(500).render('error', {
        title: 'Erro - DataFlow',
        message: 'Erro ao carregar usuário'
      });
    }
  }

  // Exibir formulário de criação
  static async formCriar(req, res) {
    try {
      res.render('usuarios/form', {
        title: 'Novo Usuário - DataFlow',
        user: req.user,
        usuario: null,
        erro: null,
        ...(await UsuarioController._opcoesAcesso(req))
      });
    } catch (error) {
      console.error('Erro ao carregar formulário:', error);
      res.status(500).render('error', {
        title: 'Erro - DataFlow',
        message: 'Erro ao carregar formulário'
      });
    }
  }

  // Opções do campo "Acesso" (unidade → grupo) e o padrão sugerido:
  // o grupo Geral da unidade em que quem cadastra está trabalhando.
  static async _opcoesAcesso(req) {
    const grupos = await acesso.gruposDisponiveis(req.user);
    const unidadeAtual = unidadeDaRequisicao(req);
    const sugerido = grupos.find(g => g.unidade_id === unidadeAtual) || grupos[0] || null;
    return { unidadesAcesso: acesso.porUnidade(grupos), grupoSugerido: sugerido ? sugerido.id : null };
  }

  // Criar novo usuário — já com acesso a uma unidade, para não nascer
  // uma conta que loga mas não enxerga nada.
  static async criar(req, res) {
    const reRender = async (erro) => res.render('usuarios/form', {
      title: 'Novo Usuário - DataFlow', user: req.user,
      usuario: null, dados: req.body, erro,
      ...(await UsuarioController._opcoesAcesso(req))
    });

    try {
      const { nome, email, senha, confirmar_senha, perfil, grupo_id,
              cpf, telefone, cargo, matricula,
              cep, logradouro, numero, complemento, bairro, cidade, estado } = req.body;

      if (!nome || !email || !senha || !confirmar_senha) return reRender('Nome, e-mail e senha são obrigatórios');
      if (senha !== confirmar_senha) return reRender('As senhas não coincidem');
      if (senha.length < 6) return reRender('A senha deve ter no mínimo 6 caracteres');
      if (!grupo_id) return reRender('Escolha a unidade a que o usuário terá acesso');
      if (!Usuario.loginValido(req.body.login)) {
        return reRender('Nome de usuário inválido: use de 3 a 60 caracteres entre letras minúsculas, números, ponto, hífen ou sublinhado');
      }
      if (await Usuario.loginExiste(req.body.login)) return reRender('Este nome de usuário já está em uso');
      if (await Usuario.emailExiste(email)) return reRender('Este email já está cadastrado');

      const usuario = await Usuario.criar({
        nome, email, login: req.body.login, senha, perfil: perfil || 'usuario',
        cpf, telefone, cargo, matricula,
        cep, logradouro, numero, complemento, bairro, cidade, estado
      });

      let avisoAcesso = '';
      try {
        await acesso.concederAcesso({ usuarioId: usuario.id, grupoId: grupo_id, quem: req.user });
      } catch (e) {
        // O usuário já existe; avisa e leva direto à tela de acesso
        avisoAcesso = e instanceof acesso.ErroAcesso ? e.message : 'Não foi possível dar o acesso inicial.';
      }

      await auditLog('USUARIO_CRIADO', req.user.id, { usuario_id: usuario.id, nome, email, perfil, grupo_id });
      if (avisoAcesso) {
        return res.redirect(`/cadastros/usuarios/${usuario.id}/vinculos?erro=${encodeURIComponent(avisoAcesso)}`);
      }
      res.redirect(`/cadastros/usuarios/${usuario.id}`);
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      return reRender('Erro ao criar usuário. Tente novamente.');
    }
  }

  // Exibir formulário de edição
  static async formEditar(req, res) {
    try {
      const { id } = req.params;
      const usuario = await Usuario.buscarPorId(id);
      
      if (!usuario) {
        return res.status(404).render('error', {
          title: 'Erro - DataFlow',
          message: 'Usuário não encontrado'
        });
      }

      res.render('usuarios/form', {
        title: `Editar ${usuario.nome} - DataFlow`,
        user: req.user,
        usuario,
        erro: null,
        // Coluna da direita: em quais unidades a pessoa trabalha
        acessosUsuario: await acesso.acessosDoUsuario(id)
      });
    } catch (error) {
      console.error('Erro ao carregar formulário:', error);
      res.status(500).render('error', {
        title: 'Erro - DataFlow',
        message: 'Erro ao carregar formulário'
      });
    }
  }

  // Atualizar usuário
  static async atualizar(req, res) {
    try {
      const { id } = req.params;
      const { nome, email, perfil,
              cpf, telefone, cargo, matricula,
              cep, logradouro, numero, complemento, bairro, cidade, estado } = req.body;

      if (!nome || !email) {
        const usuario = await Usuario.buscarPorId(id);
        return res.render('usuarios/form', {
          title: `Editar ${usuario.nome} - DataFlow`, user: req.user,
          usuario: { ...usuario, ...req.body }, erro: 'Nome e email são obrigatórios'
        });
      }

      const emailExiste = await Usuario.emailExiste(email, id);
      if (emailExiste) {
        const usuario = await Usuario.buscarPorId(id);
        return res.render('usuarios/form', {
          title: `Editar ${usuario.nome} - DataFlow`, user: req.user,
          usuario: { ...usuario, ...req.body }, erro: 'Este email já está cadastrado'
        });
      }

      const isSelf  = parseInt(id, 10) === req.user.id;
      const isAdmin = req.user.perfil === 'admin';
      const dados   = {
        nome, email,
        cpf, telefone, cargo, matricula,
        cep, logradouro, numero, complemento, bairro, cidade, estado
      };
      if (isAdmin && !isSelf) dados.perfil = perfil;

      // Nome de usuário: só o admin altera
      if (isAdmin && req.body.login !== undefined) {
        const erroLogin = !Usuario.loginValido(req.body.login)
          ? 'Nome de usuário inválido: use de 3 a 60 caracteres entre letras minúsculas, números, ponto, hífen ou sublinhado'
          : (await Usuario.loginExiste(req.body.login, id) ? 'Este nome de usuário já está em uso' : null);
        if (erroLogin) {
          const atual = await Usuario.buscarPorId(id);
          return res.render('usuarios/form', {
            title: `Editar ${atual.nome} - DataFlow`, user: req.user,
            usuario: atual, dados: { ...atual, ...req.body }, erro: erroLogin,
            acessosUsuario: await acesso.acessosDoUsuario(id)
          });
        }
        dados.login = req.body.login;
      }

      const usuario = await Usuario.atualizar(id, dados);
      if (!usuario) {
        return res.status(404).render('error', { title: 'Erro', message: 'Usuário não encontrado' });
      }

      await auditLog('USUARIO_ATUALIZADO', req.user.id, { usuario_id: id, nome, email, perfil });
      res.redirect(`/cadastros/usuarios/${id}`);
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      const usuario = await Usuario.buscarPorId(req.params.id).catch(() => ({}));
      res.render('usuarios/form', {
        title: `Editar Usuário - DataFlow`, user: req.user,
        usuario: { ...usuario, ...req.body }, erro: 'Erro ao atualizar usuário. Tente novamente.'
      });
    }
  }

  // Desativar usuário
  static async desativar(req, res) {
    try {
      const { id } = req.params;
      
      // Não permitir desativar a si mesmo
      if (parseInt(id) === req.user.id) {
        return res.status(400).json({ 
          success: false, 
          message: 'Você não pode desativar sua própria conta' 
        });
      }

      const usuario = await Usuario.desativar(id);

      if (!usuario) {
        return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
      }

      await auditLog('USUARIO_DESATIVADO', req.user.id, { usuario_id: id });

      res.json({ success: true, message: 'Usuário desativado com sucesso' });
    } catch (error) {
      console.error('Erro ao desativar usuário:', error);
      res.status(500).json({ success: false, message: 'Erro ao desativar usuário' });
    }
  }

  // Reativar usuário
  static async reativar(req, res) {
    try {
      const { id } = req.params;
      
      const usuario = await Usuario.reativar(id);

      if (!usuario) {
        return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
      }

      await auditLog('USUARIO_REATIVADO', req.user.id, { usuario_id: id });

      res.json({ success: true, message: 'Usuário reativado com sucesso' });
    } catch (error) {
      console.error('Erro ao reativar usuário:', error);
      res.status(500).json({ success: false, message: 'Erro ao reativar usuário' });
    }
  }

  // Exibir formulário de alteração de senha
  static async formAlterarSenha(req, res) {
    try {
      const { id } = req.params;
      const usuario = await Usuario.buscarPorId(id);
      
      if (!usuario) {
        return res.status(404).render('error', {
          title: 'Erro - DataFlow',
          message: 'Usuário não encontrado'
        });
      }

      res.render('usuarios/alterar-senha', {
        title: `Alterar Senha - ${usuario.nome} - DataFlow`,
        user: req.user,
        usuario,
        erro: null
      });
    } catch (error) {
      console.error('Erro ao carregar formulário:', error);
      res.status(500).render('error', {
        title: 'Erro - DataFlow',
        message: 'Erro ao carregar formulário'
      });
    }
  }

  // Alterar senha
  static async alterarSenha(req, res) {
    try {
      const { id } = req.params;
      const { nova_senha, confirmar_senha } = req.body;
      const usuario = await Usuario.buscarPorId(id);

      if (!nova_senha || !confirmar_senha) {
        return res.render('usuarios/alterar-senha', {
          title: `Alterar Senha - ${usuario.nome} - DataFlow`,
          user: req.user,
          usuario,
          erro: 'Todos os campos são obrigatórios'
        });
      }

      if (nova_senha !== confirmar_senha) {
        return res.render('usuarios/alterar-senha', {
          title: `Alterar Senha - ${usuario.nome} - DataFlow`,
          user: req.user,
          usuario,
          erro: 'As senhas não coincidem'
        });
      }

      if (nova_senha.length < 6) {
        return res.render('usuarios/alterar-senha', {
          title: `Alterar Senha - ${usuario.nome} - DataFlow`,
          user: req.user,
          usuario,
          erro: 'A senha deve ter no mínimo 6 caracteres'
        });
      }

      await Usuario.atualizarSenha(id, nova_senha);
      await auditLog('USUARIO_SENHA_ALTERADA', req.user.id, { usuario_id: id });

      res.redirect(`/cadastros/usuarios/${id}?senha_alterada=true`);
    } catch (error) {
      console.error('Erro ao alterar senha:', error);
      const usuario = await Usuario.buscarPorId(req.params.id);
      res.render('usuarios/alterar-senha', {
        title: `Alterar Senha - ${usuario.nome} - DataFlow`,
        user: req.user,
        usuario,
        erro: 'Erro ao alterar senha. Tente novamente.'
      });
    }
  }

  // Acesso às unidades: em quais unidades (e grupos) o usuário trabalha
  static async gerenciarVinculos(req, res) {
    try {
      const { id } = req.params;
      const usuario = await Usuario.buscarPorId(id);
      if (!usuario) {
        return res.status(404).render('error', { title: 'Erro - DataFlow', message: 'Usuário não encontrado' });
      }

      const [acessos, grupos] = await Promise.all([
        acesso.acessosDoUsuario(id),
        acesso.gruposDisponiveis(req.user)
      ]);

      // Não oferecer de novo o grupo em que o usuário já está
      const jaTem = new Set(acessos.map(a => a.grupo_id));
      const disponiveis = grupos.filter(g => !jaTem.has(g.id));

      // Acessos agrupados por unidade, para a lista
      const porUnidade = [];
      for (const a of acessos) {
        let u = porUnidade.find(x => x.id === a.unidade_id);
        if (!u) { u = { id: a.unidade_id, nome: a.unidade_nome, ativa: a.unidade_ativa, grupos: [] }; porUnidade.push(u); }
        u.grupos.push(a);
      }

      res.render('usuarios/gerenciar-vinculos', {
        title: `Acesso de ${usuario.nome} - Nexus`,
        user: req.user,
        usuario,
        acessos: porUnidade,
        unidadesAcesso: acesso.porUnidade(disponiveis),
        ok: req.query.ok || null,
        erro: req.query.erro || null
      });
    } catch (error) {
      console.error('Erro ao carregar acessos:', error);
      res.status(500).render('error', { title: 'Erro - DataFlow', message: 'Erro ao carregar acessos do usuário' });
    }
  }

  // Dar acesso: só o grupo é escolhido; a unidade é a do grupo
  static async adicionarVinculo(req, res) {
    const { id } = req.params;
    const voltar = (q) => res.redirect(`/cadastros/usuarios/${id}/vinculos?${q}`);
    try {
      const { grupo_id, is_lider } = req.body;
      const grupo = await acesso.concederAcesso({
        usuarioId: id, grupoId: grupo_id, isLider: is_lider === 'true' || is_lider === 'on', quem: req.user
      });
      await auditLog('USUARIO_VINCULO_ADICIONADO', req.user.id, {
        usuario_id: id, grupo_id: grupo.id, unidade_id: grupo.unidade_id, is_lider: !!is_lider
      });
      voltar('ok=' + encodeURIComponent(`Acesso a ${grupo.unidade_nome} (${grupo.nome}) concedido.`));
    } catch (error) {
      if (error instanceof acesso.ErroAcesso) return voltar('erro=' + encodeURIComponent(error.message));
      console.error('Erro ao dar acesso:', error);
      voltar('erro=' + encodeURIComponent('Não foi possível dar o acesso. Tente novamente.'));
    }
  }

  // Remover acesso a um grupo
  static async removerVinculo(req, res) {
    const { id, grupoId } = req.params;
    const voltar = (q) => res.redirect(`/cadastros/usuarios/${id}/vinculos?${q}`);
    try {
      const { query } = require('../config/database');
      const r = await query(
        `SELECT ug.unidade_id, g.nome AS grupo_nome, u.nome AS unidade_nome
           FROM usuarios_grupos ug
           JOIN grupos g ON g.id = ug.grupo_id
           JOIN unidades u ON u.id = ug.unidade_id
          WHERE ug.usuario_id = $1 AND ug.grupo_id = $2`,
        [id, grupoId]
      );
      const vinculo = r.rows[0];
      if (!vinculo) return voltar('erro=' + encodeURIComponent('Esse acesso já não existe.'));

      if (req.user.perfil !== 'admin') {
        const Unidade = require('../models/Unidade');
        if (!(await Unidade.usuarioTemAcesso(req.user.id, req.user.perfil, vinculo.unidade_id))) {
          return voltar('erro=' + encodeURIComponent('Você só pode alterar acessos das unidades em que trabalha.'));
        }
      }

      await Grupo.removerUsuario(grupoId, id);
      await auditLog('USUARIO_VINCULO_REMOVIDO', req.user.id, { usuario_id: id, grupo_id: grupoId, unidade_id: vinculo.unidade_id });
      voltar('ok=' + encodeURIComponent(`Acesso a ${vinculo.unidade_nome} (${vinculo.grupo_nome}) removido.`));
    } catch (error) {
      console.error('Erro ao remover acesso:', error);
      voltar('erro=' + encodeURIComponent('Não foi possível remover o acesso.'));
    }
  }
}

module.exports = UsuarioController;
