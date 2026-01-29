# 🔧 Troubleshooting CSS - DataFlow

## 🚨 Erro: MIME type 'text/html' ao invés de 'text/css'

### Sintoma
```
Refused to apply style from 'https://seu-app.railway.app/css/output.css' 
because its MIME type ('text/html') is not a supported stylesheet MIME type
```

---

## ✅ Soluções Implementadas

### 1. **Headers MIME Explícitos**
O servidor agora define explicitamente o Content-Type correto:

```javascript
// server.js
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    }
  }
}));
```

### 2. **Build Automático no Railway**
```json
// railway.json
{
  "build": {
    "buildCommand": "npm ci && npm run build:css"
  }
}
```

### 3. **Nixpacks Configuration**
```toml
# nixpacks.toml
[phases.build]
cmds = ["npm run build:css"]
```

---

## 🧪 Como Testar

### 1. **Rota de Debug**
Acesse: `https://seu-app.railway.app/test-css`

Resposta esperada:
```json
{
  "cssExists": true,
  "cssPath": "/app/public/css/output.css",
  "cssSize": 47693,
  "publicPath": "/app/public"
}
```

### 2. **Health Check**
Acesse: `https://seu-app.railway.app/health`

Resposta esperada:
```json
{
  "status": "ok",
  "timestamp": "2026-01-29T...",
  "env": "production"
}
```

### 3. **Testar CSS Diretamente**
Acesse: `https://seu-app.railway.app/css/output.css`

Deve retornar CSS minificado, não HTML.

---

## 🔍 Diagnóstico

### Verificar Logs no Railway

```bash
# Railway CLI
railway logs

# Procure por:
# ✅ "npm run build:css" executado com sucesso
# ✅ "Done in XXXms" do Tailwind
# ❌ Erros de build
```

### Verificar Variáveis de Ambiente

No Railway Dashboard, certifique-se que:
- ✅ `NODE_ENV=production` está definido
- ✅ Todas as variáveis `DB_*` estão corretas

---

## 🛠️ Soluções Alternativas

### Opção 1: Rebuild Forçado

```bash
# No Railway Dashboard
1. Vá em Settings
2. Clique em "Redeploy"
3. Aguarde o build completo
```

### Opção 2: Limpar Cache

```bash
# Localmente
rm -rf node_modules
rm package-lock.json
npm install
npm run build:css

# Commit e push
git add .
git commit -m "Rebuild CSS"
git push
```

### Opção 3: Verificar Estrutura de Pastas

```bash
# No Railway, via terminal ou logs
ls -la public/css/

# Deve mostrar:
# output.css (47KB+)
# input.css
# fullwidth-layout.css
```

---

## 📋 Checklist de Verificação

Antes de fazer deploy, verifique:

- [ ] `public/css/output.css` existe localmente
- [ ] Arquivo tem mais de 40KB (CSS minificado)
- [ ] `.gitignore` NÃO ignora `output.css`
- [ ] `package.json` tem `postinstall` script
- [ ] `railway.json` tem `buildCommand` correto
- [ ] `nixpacks.toml` existe
- [ ] Commit incluiu o arquivo CSS

---

## 🔄 Processo de Deploy Correto

### 1. Build Local
```bash
npm run build:css
```

### 2. Verificar Arquivo
```bash
ls -lh public/css/output.css
# Deve mostrar ~47KB
```

### 3. Commit
```bash
git add public/css/output.css -f
git add .
git commit -m "Update CSS"
```

### 4. Push
```bash
git push origin main
```

### 5. Aguardar Deploy
- Railway detecta push
- Executa `npm ci`
- Executa `npm run build:css`
- Inicia aplicação

---

## 🎯 Verificação Final

Após deploy bem-sucedido:

1. ✅ Acesse `/test-css` - deve retornar `cssExists: true`
2. ✅ Acesse `/css/output.css` - deve retornar CSS, não HTML
3. ✅ Acesse `/auth/login` - deve ter estilos aplicados
4. ✅ Inspecione elemento - CSS deve estar carregado

---

## 🆘 Se Nada Funcionar

### Último Recurso: CDN Tailwind

**Temporariamente**, adicione no `header.ejs`:

```html
<!-- Fallback CDN (apenas desenvolvimento) -->
<script src="https://cdn.tailwindcss.com"></script>
```

⚠️ **NÃO recomendado para produção!**

---

## 📞 Suporte

Se o problema persistir:

1. Verifique logs do Railway
2. Teste rotas `/test-css` e `/health`
3. Confirme que `output.css` está no repositório
4. Verifique se build está executando

---

**Última atualização:** 29/01/2026
