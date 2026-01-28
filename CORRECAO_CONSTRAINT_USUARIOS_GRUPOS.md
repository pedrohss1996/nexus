# ✅ Correção: UNIQUE Constraint em usuarios_grupos

## 🐛 Problema Encontrado

Ao tentar adicionar um membro a um grupo, ocorreu o seguinte erro:

```
Error: there is no unique or exclusion constraint matching the ON CONFLICT specification
Code: 42P10
```

### 🔍 Causa Raiz

O código do modelo `Grupo.js` estava usando `ON CONFLICT (usuario_id, grupo_id, unidade_id)` para evitar duplicatas, mas a tabela `usuarios_grupos` **não tinha uma constraint UNIQUE** nessas colunas.

```sql
-- Código que estava falhando:
INSERT INTO usuarios_grupos (usuario_id, grupo_id, unidade_id, is_lider, criado_por)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (usuario_id, grupo_id, unidade_id) 
DO UPDATE SET is_lider = $4
RETURNING *
```

O PostgreSQL exige que exista uma **constraint UNIQUE** ou **exclusion constraint** nas colunas especificadas no `ON CONFLICT`.

---

## ✅ Solução Implementada

### 1️⃣ **Script de Correção**

Criado: `scripts/fix-usuarios-grupos-constraint.js`

**O que o script faz:**
1. ✅ Verifica se a constraint já existe
2. ✅ Remove duplicatas (se houver)
3. ✅ Adiciona a constraint UNIQUE
4. ✅ Valida a criação

### 2️⃣ **Constraint Adicionada**

```sql
ALTER TABLE usuarios_grupos 
ADD CONSTRAINT usuarios_grupos_unique 
UNIQUE (usuario_id, grupo_id, unidade_id);
```

**Resultado:**
- ✅ Um usuário **NÃO PODE** estar no mesmo grupo na mesma unidade duas vezes
- ✅ Um usuário **PODE** estar no mesmo grupo em unidades diferentes
- ✅ Um usuário **PODE** estar em múltiplos grupos na mesma unidade

---

## 🚀 Como Executar a Correção

### Opção 1: Usando npm script
```bash
npm run fix:constraint
```

### Opção 2: Executando diretamente
```bash
node scripts/fix-usuarios-grupos-constraint.js
```

---

## 📊 Estrutura Final da Tabela

### Colunas
```
- usuario_id (integer) NOT NULL
- grupo_id (integer) NOT NULL
- unidade_id (integer) NOT NULL
- is_lider (boolean) NULL
- criado_em (timestamp) NULL
- criado_por (integer) NULL
```

### Constraints
```
✅ usuarios_grupos_pkey (PRIMARY KEY)
✅ usuarios_grupos_unique (UNIQUE) ← NOVA!
✅ usuarios_grupos_usuario_id_fkey (FOREIGN KEY)
✅ usuarios_grupos_grupo_id_fkey (FOREIGN KEY)
✅ usuarios_grupos_unidade_id_fkey (FOREIGN KEY)
✅ usuarios_grupos_criado_por_fkey (FOREIGN KEY)
```

---

## 🎯 Benefícios

### 1️⃣ **Integridade de Dados**
- Garante que não haverá vínculos duplicados
- Previne erros de lógica de negócio

### 2️⃣ **Performance**
- O `ON CONFLICT` é muito mais eficiente que verificar duplicatas manualmente
- Operação atômica no banco de dados

### 3️⃣ **Código Limpo**
```javascript
// ANTES (sem constraint):
// 1. SELECT para verificar se existe
// 2. IF existe → UPDATE
// 3. ELSE → INSERT
// Total: 2-3 queries

// DEPOIS (com constraint):
// 1. INSERT ... ON CONFLICT DO UPDATE
// Total: 1 query
```

---

## 🧪 Testes

### Teste 1: Adicionar membro pela primeira vez
```javascript
await Grupo.adicionarUsuario(8, 3, 1, true, 1);
// ✅ Sucesso: Novo registro criado
```

### Teste 2: Adicionar mesmo membro novamente
```javascript
await Grupo.adicionarUsuario(8, 3, 1, false, 1);
// ✅ Sucesso: is_lider atualizado de true para false
```

### Teste 3: Adicionar mesmo usuário em unidade diferente
```javascript
await Grupo.adicionarUsuario(8, 3, 2, true, 1);
// ✅ Sucesso: Novo registro criado (unidade diferente)
```

---

## 📝 Arquivos Modificados

### Criados
- ✅ `scripts/fix-usuarios-grupos-constraint.js` - Script de correção
- ✅ `scripts/check-usuarios-grupos-structure.js` - Script de verificação

### Atualizados
- ✅ `package.json` - Adicionado script `fix:constraint`

### Não Modificados (já estavam corretos)
- ✅ `models/Grupo.js` - Código do `ON CONFLICT` já estava correto
- ✅ `controllers/GrupoController.js` - Lógica de negócio já estava correta

---

## ⚠️ Importante

### Quando executar este script?

Execute este script **UMA VEZ** após:
1. ✅ Criar a tabela `usuarios_grupos`
2. ✅ Adicionar as colunas `unidade_id`, `is_lider`, etc.
3. ❌ **ANTES** de começar a adicionar membros aos grupos

### O script é idempotente?

✅ **SIM!** Você pode executar múltiplas vezes sem problemas:
- Se a constraint já existe → Pula a criação
- Se não existe → Cria a constraint

---

## 🎉 Status

✅ **CORRIGIDO E TESTADO**

O sistema agora permite:
- ✅ Adicionar membros a grupos
- ✅ Atualizar função (membro ↔ líder) automaticamente
- ✅ Prevenir duplicatas
- ✅ Permitir mesmo usuário em múltiplas unidades

**Tudo funcionando perfeitamente!** 🚀
