# 🚀 Guia de Deploy - DataFlow

## 📋 Pré-requisitos

- Conta no [Railway](https://railway.app/)
- Repositório no GitHub
- Banco de dados PostgreSQL configurado

---

## 🔧 Configuração do Railway

### 1. Variáveis de Ambiente

Configure as seguintes variáveis no Railway:

```env
# Banco de Dados
DB_HOST=seu_host_postgres
DB_PORT=5432
DB_USER=seu_usuario
DB_PASSWORD=sua_senha
DB_NAME=dataflow

# Segurança
JWT_SECRET=seu_jwt_secret_aqui
SESSION_SECRET=seu_session_secret_aqui

# Ambiente
NODE_ENV=production
PORT=3000
```

### 2. Build e Deploy

O Railway irá automaticamente:
1. ✅ Executar `npm install`
2. ✅ Executar `npm run build:css` (gera o CSS do Tailwind)
3. ✅ Iniciar com `node server.js`

### 3. Migrations

Após o primeiro deploy, execute as migrations:

```bash
# No Railway CLI ou via terminal do Railway
npm run migrate
```

Ou execute manualmente cada migration:

```bash
node scripts/run-migration-001.js
node scripts/run-migration-002.js
node scripts/run-migration-003.js
node scripts/run-migration-004.js
node scripts/run-migration-005.js
node scripts/run-migration-006.js
```

---

## 📦 Deploy via GitHub

### 1. Commit e Push

```bash
# Adicionar arquivos
git add .

# Commit
git commit -m "Deploy: Configuração para Railway"

# Push
git push origin main
```

### 2. Conectar ao Railway

1. Acesse [Railway](https://railway.app/)
2. Clique em "New Project"
3. Selecione "Deploy from GitHub repo"
4. Escolha seu repositório
5. Configure as variáveis de ambiente
6. Deploy automático será iniciado

---

## 🗄️ Configuração do Banco de Dados

### Opção 1: Railway PostgreSQL

1. No Railway, clique em "New"
2. Selecione "Database" → "PostgreSQL"
3. Copie as credenciais para as variáveis de ambiente
4. Conecte ao serviço principal

### Opção 2: Banco Externo

Configure as variáveis `DB_*` com as credenciais do seu banco.

---

## ✅ Checklist Pós-Deploy

- [ ] Variáveis de ambiente configuradas
- [ ] Banco de dados conectado
- [ ] Migrations executadas
- [ ] CSS carregando corretamente
- [ ] Login funcionando
- [ ] Criar primeiro usuário admin

### Criar Usuário Admin

```bash
# Via Railway CLI
npm run seed:marlon
```

Ou acesse: `https://seu-app.railway.app/auth/register` (se habilitado)

---

## 🐛 Troubleshooting

### CSS não carrega

**Problema**: Página sem estilos

**Solução**:
```bash
# Localmente
npm run build:css
git add public/css/output.css -f
git commit -m "Add compiled CSS"
git push
```

### Erro de conexão com banco

**Problema**: `ECONNREFUSED` ou `Connection timeout`

**Solução**:
1. Verifique as variáveis `DB_*`
2. Certifique-se que o banco está acessível
3. Verifique firewall/whitelist

### Erro 500 ao acessar

**Problema**: Internal Server Error

**Solução**:
1. Verifique logs no Railway
2. Execute migrations: `npm run migrate`
3. Verifique variáveis de ambiente

### Imagens não carregam

**Problema**: Logo ou imagens quebradas

**Solução**:
```bash
# Certifique-se que as imagens estão no git
git add public/imgs/ -f
git commit -m "Add images"
git push
```

---

## 📊 Monitoramento

### Logs

```bash
# Railway CLI
railway logs

# Ou via Dashboard do Railway
```

### Métricas

- CPU, RAM, Network disponíveis no Dashboard
- Configure alertas se necessário

---

## 🔄 Atualizações

### Deploy Automático

Cada `git push` para `main` dispara deploy automático.

### Deploy Manual

1. Acesse Railway Dashboard
2. Clique no serviço
3. Clique em "Deploy"
4. Selecione "Redeploy"

---

## 🔐 Segurança

### Checklist de Segurança

- [ ] `JWT_SECRET` e `SESSION_SECRET` únicos e fortes
- [ ] Variáveis sensíveis apenas no Railway (não no código)
- [ ] HTTPS habilitado (Railway faz automaticamente)
- [ ] Rate limiting configurado
- [ ] Helmet.js ativo

### Gerar Secrets

```bash
npm run generate-secrets
```

---

## 📞 Suporte

Em caso de problemas:
1. Verifique logs no Railway
2. Consulte este guia
3. Verifique documentação do Railway

---

**Deploy realizado com sucesso! 🎉**
