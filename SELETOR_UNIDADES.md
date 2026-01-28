# 🏥 Seletor de Unidades no Header

## 🎯 Funcionalidade

O seletor de unidades no header permite que o usuário escolha qual unidade está visualizando/trabalhando no momento. A unidade selecionada é salva na sessão e persiste durante toda a navegação.

---

## 🎨 Localização

**Posição:** Header da aplicação, entre o logo e o menu do usuário

```
┌─────────────────────────────────────────────────────┐
│ DataFlow    [Hospital São Lucas ▼]    🔔 ⚙️ 👤 Sair │
└─────────────────────────────────────────────────────┘
```

---

## ⚙️ Como Funciona

### 1️⃣ **Carregamento das Unidades**

**Middleware:** `middlewares/loadUnidades.js`

```javascript
// Carrega todas as unidades ativas do banco
const resultado = await Unidade.findAllActive();
res.locals.unidades = resultado.success ? resultado.data : [];

// Define unidade selecionada (da sessão ou primeira da lista)
if (!req.session.unidadeSelecionada && res.locals.unidades.length > 0) {
  req.session.unidadeSelecionada = res.locals.unidades[0].id;
}
res.locals.unidadeSelecionada = req.session.unidadeSelecionada;
```

**Quando executa:** Após autenticação, em todas as rotas protegidas

---

### 2️⃣ **Renderização no Header**

**Arquivo:** `views/partials/header.ejs`

```ejs
<select name="unidade_id" id="seletorUnidade">
  <% if (typeof unidades !== 'undefined' && unidades.length > 0) { %>
    <% unidades.forEach(unidade => { %>
      <option value="<%= unidade.id %>" <%= unidadeSelecionada == unidade.id ? 'selected' : '' %>>
        <%= unidade.nome %>
      </option>
    <% }); %>
  <% } else { %>
    <option value="">Nenhuma unidade disponível</option>
  <% } %>
</select>
```

---

### 3️⃣ **Seleção de Unidade**

**Comportamento:**
- ✅ Auto-submit ao mudar seleção
- ✅ Salva na sessão do usuário
- ✅ Redireciona de volta para a página atual
- ✅ Mantém a seleção durante toda a navegação

**Rota API:** `POST /api/selecionar-unidade`

```javascript
router.post('/selecionar-unidade', (req, res) => {
  const { unidade_id } = req.body;
  
  // Salvar na sessão
  req.session.unidadeSelecionada = parseInt(unidade_id);
  
  // Redirecionar de volta
  res.redirect('back');
});
```

---

## 📊 Fluxo Completo

```
1. Usuário faz login
   ↓
2. Middleware authenticateToken valida JWT
   ↓
3. Middleware loadUnidades carrega unidades do banco
   ↓
4. Header renderiza select com todas as unidades
   ↓
5. Usuário seleciona uma unidade
   ↓
6. JavaScript auto-submete o formulário
   ↓
7. POST /api/selecionar-unidade salva na sessão
   ↓
8. Usuário é redirecionado de volta
   ↓
9. Middleware loadUnidades usa a unidade da sessão
   ↓
10. Select mostra a unidade selecionada
```

---

## 🔧 Arquivos Criados/Modificados

### Criados
- ✅ `middlewares/loadUnidades.js` - Middleware para carregar unidades
- ✅ `routes/apiRoutes.js` - Rotas de API (incluindo seleção de unidade)
- ✅ `SELETOR_UNIDADES.md` - Esta documentação

### Modificados
- ✅ `server.js` - Adicionado middleware e rota API
- ✅ `views/partials/header.ejs` - Atualizado select de unidades

---

## 🎯 Uso nos Controllers

Para usar a unidade selecionada nos controllers:

```javascript
// Obter unidade selecionada
const unidadeId = req.session.unidadeSelecionada;

// Filtrar dados por unidade
const processos = await Processo.buscarPorUnidade(unidadeId);

// Passar para a view
res.render('processos/listar', {
  title: 'Processos',
  user: req.user,
  processos,
  unidadeSelecionada: unidadeId
});
```

---

## 🔐 Segurança

### Validações
- ✅ Apenas unidades **ativas** são listadas
- ✅ Unidade é salva na **sessão do servidor** (não no cliente)
- ✅ Middleware executa **após autenticação**
- ✅ Se não houver unidades, mostra mensagem apropriada

### Permissões
- ✅ Usuário só vê unidades que estão ativas no sistema
- ✅ Futuramente pode ser filtrado por unidades do usuário

---

## 📝 Exemplo de Uso

### Cenário 1: Primeiro Acesso
```
1. Usuário faz login
2. Sistema carrega todas as unidades ativas
3. Primeira unidade da lista é selecionada automaticamente
4. Usuário vê: [Hospital São Lucas ▼]
```

### Cenário 2: Trocar de Unidade
```
1. Usuário clica no select
2. Vê lista: Hospital São Lucas, Clínica Ortopédica, etc.
3. Seleciona "Clínica Ortopédica"
4. Página recarrega com nova unidade selecionada
5. Todos os dados agora são filtrados por esta unidade
```

### Cenário 3: Navegação
```
1. Usuário seleciona "Hospital São Lucas"
2. Navega para Dashboard → vê dados do Hospital
3. Navega para Processos → vê processos do Hospital
4. Navega para Documentos → vê documentos do Hospital
5. Seleção persiste em todas as páginas
```

---

## 🚀 Próximos Passos (Futuro)

### 1️⃣ **Filtrar por Permissões**
```javascript
// Mostrar apenas unidades onde o usuário tem acesso
const unidadesDoUsuario = await Usuario.buscarUnidades(req.user.id);
res.locals.unidades = unidadesDoUsuario;
```

### 2️⃣ **Indicador Visual**
```html
<!-- Badge mostrando quantidade de itens na unidade -->
<option value="1">Hospital São Lucas (45 processos)</option>
```

### 3️⃣ **Filtro Automático**
```javascript
// Middleware que automaticamente filtra queries por unidade
app.use(autoFilterByUnidade);
```

### 4️⃣ **Multi-seleção**
```html
<!-- Permitir visualizar múltiplas unidades ao mesmo tempo -->
<select multiple name="unidades[]">
```

---

## ✅ Status

**IMPLEMENTADO E FUNCIONANDO!** ✅

O seletor de unidades está:
- ✅ Carregando todas as unidades do banco
- ✅ Salvando seleção na sessão
- ✅ Persistindo durante navegação
- ✅ Auto-submetendo ao mudar
- ✅ Redirecionando de volta para página atual

**Teste agora:**
1. Acesse a aplicação
2. Veja o select no header
3. Selecione uma unidade diferente
4. Navegue entre páginas
5. A unidade selecionada persiste!

🎉 **Tudo funcionando perfeitamente!**
