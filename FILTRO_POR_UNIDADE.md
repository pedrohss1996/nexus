# 🏥 Sistema de Filtro por Unidade

## 🎯 Objetivo

Quando o usuário seleciona uma unidade no header, **TODOS os dados da aplicação** devem ser filtrados para mostrar apenas informações relacionadas àquela unidade.

---

## 🔄 Fluxo Completo

### 1️⃣ **Seleção de Unidade**

```
Usuário seleciona unidade no header
         ↓
JavaScript auto-submete formulário
         ↓
POST /api/selecionar-unidade
         ↓
Salva na sessão: req.session.unidadeSelecionada
         ↓
Redireciona de volta para a página atual
         ↓
Middleware loadUnidades carrega unidade da sessão
         ↓
Todos os controllers filtram dados por unidade
```

---

## 📊 Como Implementar nos Controllers

### **Padrão Geral**

```javascript
// Em qualquer controller
const unidadeId = req.session.unidadeSelecionada;

// Filtrar dados por unidade
const dados = await Model.buscarPorUnidade(unidadeId);

// Passar para a view
res.render('view', {
  title: 'Título',
  user: req.user,
  dados,
  unidadeSelecionada: unidadeId
});
```

---

## 🎯 Exemplos por Módulo

### **Dashboard**

```javascript
// controllers/DashboardController.js
static async index(req, res) {
  const unidadeId = req.session.unidadeSelecionada;
  
  // Buscar dados filtrados por unidade
  const orcamento = await Orcamento.buscarPorUnidade(unidadeId);
  const solicitacoes = await Solicitacao.buscarPorUnidade(unidadeId);
  const processos = await Processo.buscarPorUnidade(unidadeId);
  
  res.render('dashboard/index', {
    title: 'Dashboard',
    user: req.user,
    orcamento,
    solicitacoes,
    processos,
    unidadeSelecionada: unidadeId
  });
}
```

---

### **Processos**

```javascript
// controllers/ProcessoController.js
static async listar(req, res) {
  const unidadeId = req.session.unidadeSelecionada;
  
  // Filtrar processos da unidade selecionada
  const processos = await Processo.buscarTodos({
    unidade_id: unidadeId,
    ...req.query // outros filtros
  });
  
  res.render('processos/listar', {
    title: 'Processos',
    user: req.user,
    processos,
    unidadeSelecionada: unidadeId
  });
}
```

---

### **Documentos**

```javascript
// controllers/DocumentoController.js
static async listar(req, res) {
  const unidadeId = req.session.unidadeSelecionada;
  
  // Filtrar documentos da unidade
  const documentos = await Documento.buscarTodos({
    unidade_id: unidadeId,
    ...req.query
  });
  
  res.render('documentos/listar', {
    title: 'Documentos',
    user: req.user,
    documentos,
    unidadeSelecionada: unidadeId
  });
}
```

---

### **Grupos**

```javascript
// controllers/GrupoController.js
static async listar(req, res) {
  const unidadeId = req.session.unidadeSelecionada;
  
  // Filtrar grupos da unidade
  const grupos = await Grupo.buscarTodos({
    unidade_id: unidadeId
  });
  
  res.render('grupos/listar', {
    title: 'Grupos',
    user: req.user,
    grupos,
    unidadeSelecionada: unidadeId
  });
}
```

---

## 🗄️ Modificações nos Models

### **Adicionar filtro por unidade**

```javascript
// models/Processo.js
static async buscarTodos(filtros = {}) {
  let sql = 'SELECT * FROM processos WHERE 1=1';
  const valores = [];
  let contador = 1;

  // Filtro por unidade
  if (filtros.unidade_id) {
    sql += ` AND unidade_id = $${contador}`;
    valores.push(filtros.unidade_id);
    contador++;
  }

  // Outros filtros...
  if (filtros.status) {
    sql += ` AND status = $${contador}`;
    valores.push(filtros.status);
    contador++;
  }

  sql += ' ORDER BY criado_em DESC';

  const resultado = await query(sql, valores);
  return resultado.rows;
}
```

---

## 🎨 Indicador Visual na Interface

### **Badge de Unidade Ativa**

```ejs
<!-- Mostrar qual unidade está ativa -->
<div class="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
  <div class="flex items-center">
    <svg class="w-5 h-5 text-blue-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
      <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"></path>
    </svg>
    <p class="text-sm text-blue-700">
      Visualizando dados de: <strong><%= unidades.find(u => u.id === unidadeSelecionada)?.nome %></strong>
    </p>
  </div>
</div>
```

---

## 🔐 Permissões por Unidade

### **Filtrar unidades por permissão do usuário**

```javascript
// middlewares/loadUnidades.js
const loadUnidades = async (req, res, next) => {
  try {
    if (req.user) {
      // Se for admin, mostrar todas as unidades
      if (req.user.perfil === 'admin') {
        const unidades = await Unidade.buscarTodas();
        res.locals.unidades = unidades || [];
      } else {
        // Se for gestor/usuário, mostrar apenas unidades vinculadas
        const unidades = await Usuario.buscarUnidades(req.user.id);
        res.locals.unidades = unidades || [];
      }
      
      // Definir unidade selecionada
      if (!req.session.unidadeSelecionada && res.locals.unidades.length > 0) {
        req.session.unidadeSelecionada = res.locals.unidades[0].id;
      }
      res.locals.unidadeSelecionada = req.session.unidadeSelecionada;
    } else {
      res.locals.unidades = [];
      res.locals.unidadeSelecionada = null;
    }
    
    next();
  } catch (error) {
    console.error('❌ Erro ao carregar unidades:', error);
    res.locals.unidades = [];
    res.locals.unidadeSelecionada = null;
    next();
  }
};
```

---

## 📝 Checklist de Implementação

### **Para cada módulo:**

- [ ] **Controller**: Adicionar filtro por `unidadeId`
- [ ] **Model**: Adicionar parâmetro `unidade_id` nas queries
- [ ] **View**: Mostrar indicador de unidade ativa
- [ ] **Criar**: Salvar `unidade_id` ao criar novo registro
- [ ] **Editar**: Manter `unidade_id` ao editar
- [ ] **Listar**: Filtrar por `unidade_id`
- [ ] **Detalhes**: Verificar se pertence à unidade

---

## 🎯 Módulos que Precisam de Filtro

### **Alta Prioridade**
- ✅ **Dashboard** - Métricas e gráficos
- ✅ **Processos** - Lista de processos
- ✅ **Documentos** - Lista de documentos
- ✅ **Solicitações** - Solicitações recentes
- ✅ **Orçamento** - Dados financeiros

### **Média Prioridade**
- ⏳ **Grupos** - Grupos da unidade
- ⏳ **Fornecedores** - Fornecedores por unidade
- ⏳ **Notas Fiscais** - NFs da unidade

### **Baixa Prioridade**
- ⏳ **Usuários** - Usuários da unidade
- ⏳ **Relatórios** - Relatórios por unidade

---

## 🚀 Próximos Passos

### **1. Adicionar coluna `unidade_id` nas tabelas**

```sql
-- Processos
ALTER TABLE processos ADD COLUMN unidade_id INT REFERENCES unidades(id);

-- Documentos
ALTER TABLE documentos ADD COLUMN unidade_id INT REFERENCES unidades(id);

-- Fornecedores
ALTER TABLE fornecedores ADD COLUMN unidade_id INT REFERENCES unidades(id);

-- Notas Fiscais
ALTER TABLE notas_fiscais ADD COLUMN unidade_id INT REFERENCES unidades(id);
```

### **2. Atualizar Models**

Adicionar filtro por `unidade_id` em todos os métodos `buscarTodos()`.

### **3. Atualizar Controllers**

Passar `unidadeId` para os models e views.

### **4. Atualizar Views**

Mostrar indicador de unidade ativa.

---

## ✅ Status Atual

**Implementado:**
- ✅ Seletor de unidades no header
- ✅ Salvamento na sessão
- ✅ Middleware de carregamento
- ✅ Redirecionamento correto

**Pendente:**
- ⏳ Adicionar `unidade_id` nas tabelas
- ⏳ Implementar filtros nos controllers
- ⏳ Atualizar models para filtrar por unidade
- ⏳ Adicionar indicadores visuais nas views

---

## 🎉 Resultado Final

Quando completo, o sistema funcionará assim:

```
1. Usuário seleciona "Hospital São Lucas"
   ↓
2. Dashboard mostra apenas dados do Hospital São Lucas
   ↓
3. Processos mostra apenas processos do Hospital São Lucas
   ↓
4. Documentos mostra apenas documentos do Hospital São Lucas
   ↓
5. Ao criar novo processo, automaticamente vincula ao Hospital São Lucas
   ↓
6. Usuário troca para "Clínica Ortopédica"
   ↓
7. TODOS os dados mudam para Clínica Ortopédica
```

**Cada unidade = Ambiente isolado!** 🏥
