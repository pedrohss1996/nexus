# ✅ Sistema de Cadastro de Usuários - DataFlow

## 🎉 Implementação Completa!

Sistema completo para gerenciar usuários do DataFlow, incluindo criação, edição, alteração de senha, ativação/desativação e visualização de grupos.

---

## 📁 Arquivos Criados

### 📦 **Model**
- `models/Usuario.js` - Model completo com todas as operações de usuários

### 🎮 **Controller**
- `controllers/UsuarioController.js` - Controller com 11 métodos

### 🛣️ **Routes**
- `routes/usuarioRoutes.js` - 11 rotas configuradas

### 🎨 **Views EJS**
1. `views/usuarios/listar.ejs` - Lista com filtros e estatísticas
2. `views/usuarios/detalhes.ejs` - Detalhes completos do usuário
3. `views/usuarios/form.ejs` - Formulário criar/editar
4. `views/usuarios/alterar-senha.ejs` - Formulário de alteração de senha

---

## 🛣️ Rotas Disponíveis

| Método | Rota | Descrição | Permissão |
|--------|------|-----------|-----------|
| GET | `/cadastros/usuarios` | Listar usuários | Admin/Gestor |
| GET | `/cadastros/usuarios/novo` | Formulário novo usuário | Admin |
| POST | `/cadastros/usuarios` | Criar usuário | Admin |
| GET | `/cadastros/usuarios/:id` | Detalhes do usuário | Admin/Gestor |
| GET | `/cadastros/usuarios/:id/editar` | Formulário editar | Admin |
| POST | `/cadastros/usuarios/:id` | Atualizar usuário | Admin |
| GET | `/cadastros/usuarios/:id/alterar-senha` | Form alterar senha | Admin |
| POST | `/cadastros/usuarios/:id/alterar-senha` | Alterar senha | Admin |
| DELETE | `/cadastros/usuarios/:id` | Desativar usuário | Admin |
| PATCH | `/cadastros/usuarios/:id/reativar` | Reativar usuário | Admin |

---

## 🎨 Funcionalidades

### 📊 **Página de Listagem**

**Estatísticas no Topo:**
- 📈 Total de usuários
- ✅ Usuários ativos
- 🔴 Administradores
- 💼 Gestores

**Filtros Disponíveis:**
- Por perfil (Admin, Gestor, Usuário)
- Por status (Ativo/Inativo)
- Busca por nome ou email

**Tabela com:**
- Avatar colorido com inicial do nome
- Nome e email
- Badge de perfil (Admin/Gestor/Usuário)
- Badge de status (Ativo/Inativo)
- Data de cadastro
- Ações: Ver, Editar, Desativar/Reativar

**Recursos:**
- Usuários inativos aparecem com opacidade reduzida
- Botões contextuais (desativar ou reativar)
- Proteção: não pode desativar a si mesmo

---

### 👤 **Página de Detalhes**

**Informações Exibidas:**
- Avatar grande com inicial
- Nome completo
- Email
- Perfil de acesso (badge)
- Status (ativo/inativo)
- Data de cadastro
- Data da última atualização

**Estatísticas:**
- Total de grupos que o usuário participa

**Grupos do Usuário:**
- Cards com nome do grupo
- Descrição do grupo
- Badge de "Líder" se aplicável
- Nome da unidade
- Link para detalhes do grupo

**Ações Disponíveis:**
- ✏️ Editar usuário
- 🔑 Alterar senha

**Alerta de Sucesso:**
- Mostra mensagem quando senha é alterada

---

### 📝 **Formulário de Cadastro/Edição**

**Campos:**
- Nome completo (obrigatório)
- Email (obrigatório, validação de email único)
- Senha (apenas na criação, mínimo 6 caracteres)
- Confirmar senha (apenas na criação)
- Perfil de acesso (Usuário/Gestor/Admin)

**Validações:**
- Todos os campos obrigatórios preenchidos
- Email único no sistema
- Senhas coincidem
- Senha com mínimo 6 caracteres
- Email válido

**Mensagens de Erro:**
- Exibidas em destaque no topo do formulário
- Mantém os dados preenchidos após erro

**Descrições dos Perfis:**
- **Usuário:** Acesso básico ao sistema
- **Gestor:** Pode gerenciar grupos e processos
- **Administrador:** Acesso total ao sistema

---

### 🔑 **Alteração de Senha**

**Características:**
- Formulário dedicado e seguro
- Campos: Nova senha + Confirmar senha
- Validação de coincidência
- Mínimo 6 caracteres

**Alertas de Segurança:**
- Usuário precisará usar nova senha no próximo login
- Comunicar senha de forma segura
- Recomendar alteração após primeiro acesso

**Após Alteração:**
- Redireciona para detalhes do usuário
- Exibe mensagem de sucesso

---

## 🔐 Permissões e Segurança

### Matriz de Permissões

| Ação | Usuário | Gestor | Admin |
|------|---------|--------|-------|
| Ver lista de usuários | ❌ | ✅ | ✅ |
| Ver detalhes | ❌ | ✅ | ✅ |
| Criar usuário | ❌ | ❌ | ✅ |
| Editar usuário | ❌ | ❌ | ✅ |
| Alterar senha | ❌ | ❌ | ✅ |
| Desativar usuário | ❌ | ❌ | ✅ |
| Reativar usuário | ❌ | ❌ | ✅ |

### Proteções Implementadas

1. **Autenticação Obrigatória** - Todas as rotas requerem login
2. **Controle de Perfil** - Middleware `requireRole`
3. **Validação de Email Único** - Impede duplicatas
4. **Hash de Senha** - Bcrypt com salt de 10 rounds
5. **Soft Delete** - Desativa ao invés de deletar
6. **Auto-proteção** - Não pode desativar a si mesmo
7. **Validação de Dados** - Todos os campos são validados
8. **Auditoria** - Todas as ações são registradas em log

---

## 📦 Model: Usuario.js

### Métodos Disponíveis

```javascript
// Criar usuário
Usuario.criar({ nome, email, senha, perfil })

// Buscar todos com filtros
Usuario.buscarTodos({ perfil, ativo, busca })

// Buscar por ID
Usuario.buscarPorId(id)

// Buscar por email
Usuario.buscarPorEmail(email)

// Atualizar usuário
Usuario.atualizar(id, { nome, email, perfil, ativo })

// Atualizar senha
Usuario.atualizarSenha(id, novaSenha)

// Desativar usuário
Usuario.desativar(id)

// Reativar usuário
Usuario.reativar(id)

// Buscar grupos do usuário
Usuario.buscarGrupos(usuarioId)

// Verificar se email existe
Usuario.emailExiste(email, excluirId)

// Obter estatísticas
Usuario.obterEstatisticas()

// Validar senha
Usuario.validarSenha(senhaPlana, senhaHash)
```

---

## 🎨 Design e UX

### Cores e Badges

**Perfis:**
- 🔴 **Admin**: Vermelho (`bg-red-100 text-red-800`)
- 🔵 **Gestor**: Azul (`bg-blue-100 text-blue-800`)
- ⚫ **Usuário**: Cinza (`bg-gray-100 text-gray-800`)

**Status:**
- ✅ **Ativo**: Verde (`bg-green-100 text-green-800`)
- ⚫ **Inativo**: Cinza (`bg-gray-100 text-gray-800`)

**Grupos:**
- ⭐ **Líder**: Âmbar (`bg-amber-100 text-amber-800`)

### Avatares
- Círculo gradiente teal-emerald
- Inicial do nome em branco
- Tamanhos: 40px (lista), 80px (detalhes)

### Ícones
- Todos em SVG inline
- Stroke width 2
- Tamanho 20px (w-5 h-5)

---

## 🚀 Como Usar

### 1️⃣ Acessar Lista de Usuários
```
http://localhost:3000/cadastros/usuarios
```
- Visualize todos os usuários
- Veja estatísticas no topo
- Filtre por perfil, status ou busque por nome/email

### 2️⃣ Criar Novo Usuário
1. Clique em "Novo Usuário"
2. Preencha: nome, email, senha, confirmar senha, perfil
3. Clique em "Criar Usuário"
4. Será redirecionado para detalhes do usuário criado

### 3️⃣ Editar Usuário
1. Na lista, clique no ícone de editar (lápis)
2. Ou nos detalhes, clique em "Editar"
3. Altere os dados necessários
4. Clique em "Salvar Alterações"

### 4️⃣ Alterar Senha
1. Acesse os detalhes do usuário
2. Clique em "Alterar Senha"
3. Digite a nova senha duas vezes
4. Clique em "Alterar Senha"
5. Comunique a nova senha ao usuário de forma segura

### 5️⃣ Desativar/Reativar Usuário
1. Na lista de usuários
2. Clique no ícone de desativar (X) ou reativar (✓)
3. Confirme a ação
4. O usuário será desativado/reativado imediatamente

---

## 📊 Estatísticas

A página de listagem exibe 4 cards com estatísticas:

1. **Total de Usuários** - Todos os usuários cadastrados
2. **Usuários Ativos** - Apenas os ativos
3. **Administradores** - Total de admins
4. **Gestores** - Total de gestores

---

## 🔄 Fluxos de Uso

### Cenário 1: Onboarding de Novo Funcionário
1. Admin acessa `/cadastros/usuarios/novo`
2. Preenche dados do funcionário
3. Define perfil apropriado (geralmente "usuario")
4. Cria o usuário
5. Comunica credenciais ao funcionário
6. Adiciona o usuário aos grupos necessários

### Cenário 2: Promoção de Usuário a Gestor
1. Admin acessa detalhes do usuário
2. Clica em "Editar"
3. Altera perfil de "usuario" para "gestor"
4. Salva alterações
5. Usuário ganha permissões de gestor

### Cenário 3: Desligamento de Funcionário
1. Admin acessa lista de usuários
2. Localiza o usuário
3. Clica em desativar
4. Confirma ação
5. Usuário perde acesso ao sistema (soft delete)

### Cenário 4: Esquecimento de Senha
1. Admin acessa detalhes do usuário
2. Clica em "Alterar Senha"
3. Define nova senha temporária
4. Comunica ao usuário de forma segura
5. Orienta usuário a alterar após login

---

## 🛡️ Segurança

### Hashing de Senhas
```javascript
// Criação
const senhaHash = await bcrypt.hash(senha, 10);

// Validação
const valido = await bcrypt.compare(senhaPlana, senhaHash);
```

### Validação de Email Único
```javascript
const emailExiste = await Usuario.emailExiste(email, excluirId);
if (emailExiste) {
  // Retorna erro
}
```

### Auditoria
```javascript
await logAudit(req.user.id, 'CREATE', 'usuarios', usuario.id, { 
  nome, email, perfil 
});
```

---

## 📝 Validações Implementadas

### Criação de Usuário
- ✅ Nome obrigatório
- ✅ Email obrigatório e válido
- ✅ Email único no sistema
- ✅ Senha obrigatória
- ✅ Senha mínimo 6 caracteres
- ✅ Senhas coincidem
- ✅ Perfil obrigatório

### Edição de Usuário
- ✅ Nome obrigatório
- ✅ Email obrigatório e válido
- ✅ Email único (excluindo próprio usuário)
- ✅ Perfil obrigatório

### Alteração de Senha
- ✅ Nova senha obrigatória
- ✅ Nova senha mínimo 6 caracteres
- ✅ Senhas coincidem

---

## 🎯 Próximos Passos Sugeridos

- [ ] Adicionar foto de perfil
- [ ] Implementar alteração de senha pelo próprio usuário
- [ ] Adicionar campo de telefone
- [ ] Criar sistema de recuperação de senha por email
- [ ] Adicionar autenticação de dois fatores (2FA)
- [ ] Implementar histórico de logins
- [ ] Adicionar paginação na lista de usuários
- [ ] Criar relatório de usuários ativos/inativos
- [ ] Implementar importação em lote (CSV)
- [ ] Adicionar campo de departamento/cargo

---

## 🆘 Troubleshooting

### Erro: "Este email já está cadastrado"
**Causa**: Email duplicado no banco de dados  
**Solução**: Use outro email ou edite o usuário existente

### Erro: "As senhas não coincidem"
**Causa**: Senha e confirmação diferentes  
**Solução**: Digite a mesma senha nos dois campos

### Erro: "Você não pode desativar sua própria conta"
**Causa**: Tentativa de auto-desativação  
**Solução**: Peça a outro admin para desativar sua conta

### Usuário não consegue fazer login após criação
**Causa**: Usuário pode estar inativo  
**Solução**: Verifique se o usuário está ativo na lista

---

## 📚 Documentação Relacionada

- `MODELO_GRUPOS_UNIDADES.md` - Sistema de grupos e unidades
- `CADASTROS_GRUPOS_UNIDADES.md` - Cadastros de grupos
- `CONFIGURACAO.md` - Configuração geral
- `README.md` - Documentação principal

---

**Status**: ✅ **100% Implementado e Funcional**

Sistema completo de cadastro de usuários pronto para uso! 🎉
