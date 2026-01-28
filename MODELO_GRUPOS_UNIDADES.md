# 📋 Modelo de Grupos e Unidades - DataFlow

## 📌 Visão Geral

O sistema de **Grupos e Unidades** permite organizar usuários em equipes vinculadas a diferentes unidades hospitalares ou departamentos. Este modelo é essencial para:

- 🏥 Gerenciar múltiplas unidades (hospitais, clínicas, departamentos)
- 👥 Organizar usuários em grupos/equipes
- 🔗 Vincular usuários a grupos e unidades específicas
- 👑 Definir líderes de grupos
- 🔐 Controlar permissões baseadas em grupos e unidades

---

## 🗂️ Estrutura do Banco de Dados

### 1️⃣ Tabela: `unidades`

Armazena as unidades hospitalares, clínicas e departamentos.

| Coluna     | Tipo         | Descrição                                    |
|------------|--------------|----------------------------------------------|
| `id`       | SERIAL       | Identificador único (PK)                     |
| `nome`     | VARCHAR(255) | Nome da unidade                              |
| `cd_tipo`  | INT          | Tipo: 1=Hospital, 2=Clínica, 3=Departamento |
| `ativo`    | BOOLEAN      | Status ativo/inativo                         |

**Exemplo de dados:**
```sql
INSERT INTO unidades (nome, cd_tipo, ativo) VALUES
  ('Hospital São Lucas', 1, true),
  ('Clínica Ortopédica', 2, true),
  ('Departamento Administrativo', 3, true);
```

---

### 2️⃣ Tabela: `grupos`

Armazena os grupos de usuários (equipes, setores, comissões).

| Coluna        | Tipo         | Descrição                          |
|---------------|--------------|------------------------------------|
| `id`          | SERIAL       | Identificador único (PK)           |
| `nome`        | VARCHAR(255) | Nome do grupo                      |
| `descricao`   | TEXT         | Descrição do grupo                 |
| `unidade_id`  | INT          | FK para `unidades`                 |
| `ativo`       | BOOLEAN      | Status ativo/inativo               |
| `criado_em`   | TIMESTAMP    | Data de criação                    |

**Exemplo de dados:**
```sql
INSERT INTO grupos (nome, descricao, unidade_id, ativo) VALUES
  ('Administração', 'Grupo de administradores do sistema', 1, true),
  ('Farmácia', 'Equipe da farmácia hospitalar', 1, true),
  ('TI', 'Tecnologia da Informação', 1, true);
```

---

### 3️⃣ Tabela: `usuarios_grupos`

Relacionamento N:N entre usuários, grupos e unidades.

| Coluna       | Tipo      | Descrição                                |
|--------------|-----------|------------------------------------------|
| `id`         | SERIAL    | Identificador único (PK)                 |
| `usuario_id` | INT       | FK para `usuarios`                       |
| `grupo_id`   | INT       | FK para `grupos`                         |
| `unidade_id` | INT       | FK para `unidades`                       |
| `is_lider`   | BOOLEAN   | Define se o usuário é líder do grupo     |
| `criado_em`  | TIMESTAMP | Data do vínculo                          |
| `criado_por` | INT       | FK para `usuarios` (quem criou o vínculo)|

**Exemplo de dados:**
```sql
INSERT INTO usuarios_grupos (usuario_id, grupo_id, unidade_id, is_lider) VALUES
  (1, 1, 1, true),  -- Usuário 1 é líder do grupo Administração na unidade 1
  (2, 2, 1, false); -- Usuário 2 é membro do grupo Farmácia na unidade 1
```

---

## 🔍 Views Disponíveis

### 1️⃣ `vw_usuarios_grupos_unidades`

Visão completa de usuários com seus grupos e unidades.

```sql
SELECT * FROM vw_usuarios_grupos_unidades;
```

**Colunas retornadas:**
- `usuario_id`, `usuario_nome`, `usuario_email`, `usuario_perfil`
- `grupo_id`, `grupo_nome`, `grupo_descricao`
- `unidade_id`, `unidade_nome`, `unidade_tipo`
- `is_lider`, `vinculo_criado_em`

---

### 2️⃣ `vw_grupos_estatisticas`

Estatísticas de grupos com contagem de membros e líderes.

```sql
SELECT * FROM vw_grupos_estatisticas;
```

**Colunas retornadas:**
- `grupo_id`, `grupo_nome`, `grupo_descricao`
- `unidade_id`, `unidade_nome`
- `total_membros`, `total_lideres`
- `ativo`, `criado_em`

---

## 🛠️ Models JavaScript

### 📦 `models/Unidade.js`

```javascript
const Unidade = require('./models/Unidade');

// Criar nova unidade
const unidade = await Unidade.criar({
  nome: 'Hospital Central',
  cd_tipo: 1,
  criado_por: usuarioId
});

// Buscar todas as unidades
const unidades = await Unidade.buscarTodas();

// Buscar unidade por ID
const unidade = await Unidade.buscarPorId(1);

// Buscar grupos da unidade
const grupos = await Unidade.buscarGrupos(1);

// Buscar usuários da unidade
const usuarios = await Unidade.buscarUsuarios(1);

// Obter estatísticas
const stats = await Unidade.obterEstatisticas(1);
```

---

### 👥 `models/Grupo.js`

```javascript
const Grupo = require('./models/Grupo');

// Criar novo grupo
const grupo = await Grupo.criar({
  nome: 'Enfermagem',
  descricao: 'Equipe de enfermagem',
  unidade_id: 1,
  criado_por: usuarioId
});

// Buscar todos os grupos
const grupos = await Grupo.buscarTodos({ unidade_id: 1 });

// Buscar grupo por ID
const grupo = await Grupo.buscarPorId(1);

// Adicionar usuário ao grupo
await Grupo.adicionarUsuario(grupoId, usuarioId, unidadeId, isLider, criadoPor);

// Remover usuário do grupo
await Grupo.removerUsuario(grupoId, usuarioId);

// Buscar membros do grupo
const membros = await Grupo.buscarMembros(grupoId);

// Definir líder do grupo
await Grupo.definirLider(grupoId, usuarioId, true);

// Verificar se usuário pertence ao grupo
const pertence = await Grupo.usuarioPertence(grupoId, usuarioId);

// Buscar grupos do usuário
const grupos = await Grupo.buscarPorUsuario(usuarioId);
```

---

## 🚀 Como Usar

### 1️⃣ Executar Migration

```bash
# As tabelas já foram criadas automaticamente
# Se precisar recriar, use:
node scripts/fix-usuarios-grupos.js
node scripts/fix-grupos-unidades.js
node scripts/fix-grupos-unidade-id.js
node scripts/create-views.js
```

### 2️⃣ Popular Dados Iniciais

```bash
npm run seed              # Seed principal (usuários)
node scripts/seed-grupos-unidades.js  # Seed de grupos e unidades
```

### 3️⃣ Verificar Estrutura

```bash
node scripts/check-all-tables.js  # Verificar estrutura das tabelas
node scripts/test-db-structure.js # Verificar estrutura do banco
```

---

## 📊 Exemplos de Consultas SQL

### Buscar todos os grupos de um usuário

```sql
SELECT g.nome, u.nome as unidade, ug.is_lider
FROM grupos g
INNER JOIN usuarios_grupos ug ON g.id = ug.grupo_id
INNER JOIN unidades u ON g.unidade_id = u.id
WHERE ug.usuario_id = 1;
```

### Buscar todos os usuários de um grupo

```sql
SELECT u.nome, u.email, ug.is_lider
FROM usuarios u
INNER JOIN usuarios_grupos ug ON u.id = ug.usuario_id
WHERE ug.grupo_id = 1;
```

### Buscar líderes de todos os grupos

```sql
SELECT g.nome as grupo, u.nome as lider, un.nome as unidade
FROM grupos g
INNER JOIN usuarios_grupos ug ON g.id = ug.grupo_id
INNER JOIN usuarios u ON ug.usuario_id = u.id
INNER JOIN unidades un ON g.unidade_id = un.id
WHERE ug.is_lider = true;
```

### Contar membros por grupo

```sql
SELECT g.nome, COUNT(ug.usuario_id) as total_membros
FROM grupos g
LEFT JOIN usuarios_grupos ug ON g.id = ug.grupo_id
GROUP BY g.id, g.nome
ORDER BY total_membros DESC;
```

---

## 🎯 Casos de Uso

### 1️⃣ Adicionar usuário a um grupo

```javascript
const grupoId = 1; // Administração
const usuarioId = 5;
const unidadeId = 1; // Hospital São Lucas
const isLider = false;
const criadoPor = 1; // Admin

await Grupo.adicionarUsuario(grupoId, usuarioId, unidadeId, isLider, criadoPor);
```

### 2️⃣ Promover usuário a líder

```javascript
await Grupo.definirLider(grupoId, usuarioId, true);
```

### 3️⃣ Listar todos os membros de um grupo

```javascript
const membros = await Grupo.buscarMembros(grupoId);
membros.forEach(m => {
  console.log(`${m.nome} - ${m.is_lider ? 'Líder' : 'Membro'}`);
});
```

### 4️⃣ Verificar permissões

```javascript
// Verificar se usuário pertence ao grupo
const temAcesso = await Grupo.usuarioPertence(grupoId, usuarioId);

// Buscar grupos do usuário
const grupos = await Grupo.buscarPorUsuario(usuarioId);
```

---

## 🔐 Segurança e Boas Práticas

1. **Validação de Dados**: Sempre valide os dados antes de inserir no banco
2. **Soft Delete**: Use a coluna `ativo` para desativar registros ao invés de deletar
3. **Auditoria**: A coluna `criado_por` permite rastrear quem criou os vínculos
4. **Índices**: Índices foram criados para otimizar consultas frequentes
5. **Constraints**: Foreign keys garantem integridade referencial
6. **Unique Constraint**: Evita vínculos duplicados (usuario + grupo + unidade)

---

## 📝 Próximos Passos

- [ ] Criar controllers para grupos e unidades
- [ ] Criar rotas para gerenciar grupos e unidades
- [ ] Criar views EJS para interface de gerenciamento
- [ ] Implementar permissões baseadas em grupos
- [ ] Adicionar notificações para membros do grupo
- [ ] Criar relatórios por grupo/unidade

---

## 🆘 Suporte

Para dúvidas ou problemas, consulte:
- `CONFIGURACAO.md` - Configuração geral do projeto
- `README.md` - Documentação principal
- Logs em `logs/audit-*.log`
