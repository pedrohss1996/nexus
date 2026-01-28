# ✅ Sistema de Vínculos: Usuários ↔ Grupos ↔ Unidades

## 🎯 Conceito

O sistema permite que **um usuário** esteja em **múltiplos grupos** em **múltiplas unidades** com **funções diferentes** em cada combinação.

### 📊 Exemplo Prático

```
USUÁRIO: João Silva
├── Hospital São Lucas
│   ├── Grupo TI → LÍDER
│   └── Grupo Administração → MEMBRO
│
├── Clínica Ortopédica
│   └── Grupo TI → MEMBRO
│
└── Departamento Administrativo
    └── Grupo Compras → LÍDER
```

**Resultado:** João é líder de TI no Hospital, membro de TI na Clínica, líder de Compras no Departamento e membro da Administração no Hospital.

---

## 🎨 Telas Implementadas

### 1️⃣ **Adicionar Membro ao Grupo**
**Rota:** `/grupos/:id/adicionar-membro`

**Funcionalidades:**
- ✅ Selecionar usuário
- ✅ Selecionar unidade (pode ser diferente da unidade padrão do grupo)
- ✅ Definir função (Membro ou Líder)
- ✅ Validação de duplicatas
- ✅ Explicação visual do conceito

**Fluxo:**
1. Acesse detalhes de um grupo
2. Clique em "Adicionar Membro"
3. Selecione:
   - Usuário
   - Unidade (onde o vínculo será criado)
   - Função (Membro ou Líder)
4. Clique em "Adicionar Membro"

---

### 2️⃣ **Gerenciar Vínculos do Usuário**
**Rota:** `/cadastros/usuarios/:id/vinculos`

**Funcionalidades:**
- ✅ Visualizar todos os vínculos agrupados por unidade
- ✅ Adicionar novo vínculo (Grupo + Unidade + Função)
- ✅ Remover vínculos existentes
- ✅ Interface visual organizada por unidade

**Fluxo:**
1. Acesse detalhes de um usuário
2. Clique em "Gerenciar Vínculos"
3. Veja todos os vínculos organizados por unidade
4. Adicione novos vínculos usando o formulário no topo
5. Remova vínculos clicando em "Remover"

---

### 3️⃣ **Detalhes do Grupo (Atualizado)**
**Rota:** `/grupos/:id`

**Melhorias:**
- ✅ Mostra a **unidade específica** de cada membro
- ✅ Botão "Adicionar Membro" redireciona para formulário completo
- ✅ Ícone de unidade ao lado do nome

---

### 4️⃣ **Detalhes do Usuário (Atualizado)**
**Rota:** `/cadastros/usuarios/:id`

**Melhorias:**
- ✅ Botão "Gerenciar Vínculos" para admin e gestor
- ✅ Visualização de grupos com unidades

---

## 🗄️ Estrutura do Banco de Dados

### Tabela: `usuarios_grupos`

```sql
CREATE TABLE usuarios_grupos (
  id SERIAL PRIMARY KEY,
  usuario_id INT NOT NULL REFERENCES usuarios(id),
  grupo_id INT NOT NULL REFERENCES grupos(id),
  unidade_id INT NOT NULL REFERENCES unidades(id),
  is_lider BOOLEAN DEFAULT false,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  criado_por INT REFERENCES usuarios(id),
  UNIQUE(usuario_id, grupo_id, unidade_id)
);
```

**Constraint de Unicidade:**
- Um usuário **NÃO PODE** estar no mesmo grupo na mesma unidade duas vezes
- Um usuário **PODE** estar no mesmo grupo em unidades diferentes
- Um usuário **PODE** estar em múltiplos grupos na mesma unidade

---

## 🔄 Exemplos de Uso

### Exemplo 1: Adicionar João ao grupo TI em múltiplas unidades

```javascript
// Hospital São Lucas - Líder
await Grupo.adicionarUsuario(
  8,    // grupo_id (TI)
  3,    // usuario_id (João)
  1,    // unidade_id (Hospital São Lucas)
  true, // is_lider
  1     // criado_por
);

// Clínica Ortopédica - Membro
await Grupo.adicionarUsuario(
  8,     // grupo_id (TI)
  3,     // usuario_id (João)
  2,     // unidade_id (Clínica Ortopédica)
  false, // is_lider
  1      // criado_por
);
```

### Exemplo 2: Consultar vínculos de um usuário

```sql
SELECT 
  u.nome as usuario,
  g.nome as grupo,
  un.nome as unidade,
  CASE WHEN ug.is_lider THEN 'Líder' ELSE 'Membro' END as funcao
FROM usuarios_grupos ug
INNER JOIN usuarios u ON ug.usuario_id = u.id
INNER JOIN grupos g ON ug.grupo_id = g.id
INNER JOIN unidades un ON ug.unidade_id = un.id
WHERE u.id = 3
ORDER BY un.nome, g.nome;
```

### Exemplo 3: Listar membros de um grupo com suas unidades

```sql
SELECT 
  u.nome as usuario,
  un.nome as unidade,
  CASE WHEN ug.is_lider THEN 'Líder' ELSE 'Membro' END as funcao
FROM usuarios_grupos ug
INNER JOIN usuarios u ON ug.usuario_id = u.id
INNER JOIN unidades un ON ug.unidade_id = un.id
WHERE ug.grupo_id = 8  -- TI
ORDER BY un.nome, u.nome;
```

---

## 🎨 Interface Visual

### Página: Adicionar Membro

```
┌─────────────────────────────────────────────┐
│ Adicionar Membro ao Grupo                  │
│ Grupo: TI                                   │
├─────────────────────────────────────────────┤
│                                             │
│ Usuário: [João Silva ▼]                    │
│                                             │
│ Unidade: [Hospital São Lucas ▼]            │
│ O usuário será vinculado ao grupo TI        │
│ nesta unidade específica                    │
│                                             │
│ Função no Grupo:                            │
│ ○ Membro                                    │
│ ● Líder                                     │
│                                             │
│ ℹ️ Como funciona:                           │
│ Um usuário pode estar no mesmo grupo em     │
│ diferentes unidades com funções diferentes  │
│                                             │
│ [Cancelar]           [Adicionar Membro]    │
└─────────────────────────────────────────────┘
```

### Página: Gerenciar Vínculos

```
┌─────────────────────────────────────────────┐
│ Gerenciar Vínculos - João Silva            │
├─────────────────────────────────────────────┤
│ Adicionar Novo Vínculo:                     │
│ [Unidade ▼] [Grupo ▼] [Função ▼] [Adicionar]│
├─────────────────────────────────────────────┤
│ Vínculos Atuais:                            │
│                                             │
│ 🏥 Hospital São Lucas                       │
│ ┌──────────────┬──────────────┐            │
│ │ TI           │ Administração │            │
│ │ ⭐ Líder     │ Membro        │            │
│ │ [Remover]    │ [Remover]     │            │
│ └──────────────┴──────────────┘            │
│                                             │
│ 🏥 Clínica Ortopédica                       │
│ ┌──────────────┐                            │
│ │ TI           │                            │
│ │ Membro       │                            │
│ │ [Remover]    │                            │
│ └──────────────┘                            │
└─────────────────────────────────────────────┘
```

---

## 🛣️ Rotas Criadas

| Método | Rota | Descrição | Permissão |
|--------|------|-----------|-----------|
| GET | `/grupos/:id/adicionar-membro` | Form adicionar membro | Admin/Gestor |
| POST | `/grupos/:id/membros` | Adicionar membro | Admin/Gestor |
| DELETE | `/grupos/:id/membros/:usuario_id` | Remover membro | Admin/Gestor |
| GET | `/cadastros/usuarios/:id/vinculos` | Gerenciar vínculos | Admin/Gestor |
| POST | `/cadastros/usuarios/:id/vinculos` | Adicionar vínculo | Admin/Gestor |

---

## 🎯 Casos de Uso

### Caso 1: Usuário Multi-Unidade
**Cenário:** Maria trabalha em 3 unidades diferentes

```
Maria Silva
├── Hospital São Lucas
│   ├── Enfermagem → LÍDER
│   └── Administração → MEMBRO
├── Clínica Ortopédica
│   └── Enfermagem → MEMBRO
└── Hospital Central
    └── Enfermagem → LÍDER
```

**Como fazer:**
1. Acesse `/cadastros/usuarios/{maria_id}/vinculos`
2. Adicione cada vínculo separadamente:
   - Hospital São Lucas + Enfermagem + Líder
   - Hospital São Lucas + Administração + Membro
   - Clínica Ortopédica + Enfermagem + Membro
   - Hospital Central + Enfermagem + Líder

### Caso 2: Grupo Multi-Unidade
**Cenário:** Grupo TI atua em todas as unidades

```
Grupo: TI
├── Hospital São Lucas
│   ├── João (Líder)
│   └── Maria (Membro)
├── Clínica Ortopédica
│   ├── Pedro (Líder)
│   └── João (Membro)
└── Departamento Administrativo
    └── Ana (Líder)
```

**Como fazer:**
1. Acesse `/grupos/{ti_id}/adicionar-membro`
2. Para cada membro, selecione a unidade específica
3. João pode ser adicionado 2 vezes (unidades diferentes)

---

## 🔐 Permissões

### Quem pode gerenciar vínculos?
- ✅ **Admin** - Pode tudo
- ✅ **Gestor** - Pode adicionar/remover membros
- ❌ **Usuário** - Apenas visualiza seus próprios vínculos

---

## 📊 Consultas Úteis

### Usuários por Unidade
```sql
SELECT DISTINCT u.nome, u.email
FROM usuarios u
INNER JOIN usuarios_grupos ug ON u.id = ug.usuario_id
WHERE ug.unidade_id = 1  -- Hospital São Lucas
ORDER BY u.nome;
```

### Líderes por Unidade
```sql
SELECT u.nome, g.nome as grupo, un.nome as unidade
FROM usuarios_grupos ug
INNER JOIN usuarios u ON ug.usuario_id = u.id
INNER JOIN grupos g ON ug.grupo_id = g.id
INNER JOIN unidades un ON ug.unidade_id = un.id
WHERE ug.is_lider = true
ORDER BY un.nome, g.nome;
```

### Grupos de um Usuário em uma Unidade
```sql
SELECT g.nome, ug.is_lider
FROM usuarios_grupos ug
INNER JOIN grupos g ON ug.grupo_id = g.id
WHERE ug.usuario_id = 3 AND ug.unidade_id = 1;
```

---

## ✅ Resumo

**O sistema está completo para:**
- ✅ Adicionar usuários a grupos com unidade específica
- ✅ Gerenciar vínculos de forma visual e organizada
- ✅ Permitir mesmo usuário em mesmo grupo em unidades diferentes
- ✅ Definir funções diferentes por unidade
- ✅ Visualizar vínculos agrupados por unidade
- ✅ Remover vínculos específicos

**Tudo funcionando e pronto para uso!** 🎉
