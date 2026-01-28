# 🔧 Guia de Configuração - DataFlow

## 1. Configurar o arquivo .env

O arquivo `.env` já foi criado na raiz do projeto. Você precisa preencher as seguintes informações:

### 📝 Variáveis Obrigatórias

#### Banco de Dados PostgreSQL
```env
DB_HOST=localhost          # Host do PostgreSQL
DB_PORT=5432              # Porta do PostgreSQL (padrão: 5432)
DB_NAME=dataflow          # Nome do banco de dados
DB_USER=postgres          # Usuário do PostgreSQL
DB_PASSWORD=sua_senha_aqui # Senha do PostgreSQL
```

#### Segurança (JWT e Session)
```env
JWT_SECRET=seu_secret_aqui        # Secret para JWT (mínimo 32 caracteres)
SESSION_SECRET=seu_secret_aqui    # Secret para sessões (mínimo 32 caracteres)
```

**⚠️ IMPORTANTE:** Para gerar secrets seguros automaticamente, execute:
```bash
npm run generate-secrets
```

Este comando irá:
- Gerar secrets aleatórios e seguros
- Atualizar automaticamente o arquivo `.env`

### 📝 Variáveis Opcionais (já configuradas)

```env
NODE_ENV=development              # Ambiente (development/production)
PORT=3000                         # Porta do servidor
JWT_EXPIRES_IN=24h                # Tempo de expiração do token
UPLOAD_MAX_SIZE=10485760          # Tamanho máximo de upload (10MB)
UPLOAD_PATH=./uploads             # Pasta de uploads
SOCKET_CORS_ORIGIN=http://localhost:3000
CORS_ORIGIN=http://localhost:3000
```

## 2. Criar o Banco de Dados

No PostgreSQL, execute:

```sql
CREATE DATABASE dataflow;
```

## 3. Executar as Migrations

### Opção 1: Usando o script Node.js (Recomendado)
```bash
npm run migrate
```

### Opção 2: Usando psql (se estiver no PATH)
```bash
psql -U postgres -d dataflow -f migrations/001_create_tables.sql
```

### Opção 3: Manualmente
Conecte ao PostgreSQL usando pgAdmin, DBeaver ou outra ferramenta e execute o conteúdo do arquivo `migrations/001_create_tables.sql`.

## 4. Executar o Seed (Dados Iniciais)

```bash
npm run seed
```

Isso criará:
- ✅ Usuário admin: `admin@dataflow.com` / `admin123`
- ✅ Centro de custo exemplo

## 5. Iniciar a Aplicação

```bash
# Instalar dependências (se ainda não fez)
npm install

# Iniciar em modo desenvolvimento
npm run dev
```

A aplicação estará disponível em: `http://localhost:3000`

## 🔐 Gerar Secrets Seguros

Se preferir gerar os secrets manualmente, você pode usar:

```bash
# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Ou use o script fornecido
npm run generate-secrets
```

## ✅ Checklist de Configuração

- [ ] Arquivo `.env` criado e preenchido
- [ ] Secrets JWT e Session configurados (use `npm run generate-secrets`)
- [ ] Banco de dados PostgreSQL criado
- [ ] Migrations executadas
- [ ] Seed executado (`npm run seed`)
- [ ] Dependências instaladas (`npm install`)
- [ ] Servidor iniciado (`npm run dev`)

## 🆘 Problemas Comuns

### Erro de conexão com o banco
- Verifique se o PostgreSQL está rodando
- Confirme as credenciais no `.env`
- Verifique se o banco `dataflow` foi criado

### Erro de autenticação
- Certifique-se de que os secrets JWT e Session têm pelo menos 32 caracteres
- Execute `npm run generate-secrets` para gerar novos secrets

### Porta já em uso
- Altere a `PORT` no `.env` para outra porta (ex: 3001)
