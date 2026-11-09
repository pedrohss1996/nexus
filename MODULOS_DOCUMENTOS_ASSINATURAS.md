# Módulos: Documentos, Assinaturas e Verificação

**Projeto:** Nexus / DataFlow  
**Framework:** Express.js + Node.js  
**Template Engine:** EJS  
**Banco de Dados:** PostgreSQL  
**Autenticação:** JWT + Session

---

## Sumário

1. [Visão Geral da Arquitetura](#1-visão-geral-da-arquitetura)
2. [Módulo: Documentos PDF (Templates)](#2-módulo-documentos-pdf-templates)
3. [Módulo: Assinaturas de Documentos (Grupos)](#3-módulo-assinaturas-de-documentos-grupos)
4. [Módulo: Assinaturas Digitais (gov.br)](#4-módulo-assinaturas-digitais-govbr)
5. [Módulo: Verificação Pública](#5-módulo-verificação-pública)
6. [Schema do Banco de Dados](#6-schema-do-banco-de-dados)
7. [Camada de Serviços e Utilitários](#7-camada-de-serviços-e-utilitários)
8. [Middleware e Segurança](#8-middleware-e-segurança)
9. [Fluxo Completo de Ciclo de Vida](#9-fluxo-completo-de-ciclo-de-vida)
10. [Variáveis de Ambiente Necessárias](#10-variáveis-de-ambiente-necessárias)

---

## 1. Visão Geral da Arquitetura

O sistema possui **dois sistemas de assinatura** distintos que coexistem:

| Sistema | Tabela | Tipo | Validade Legal |
|---------|--------|------|----------------|
| Assinaturas de Documentos | `assinaturas_documentos` | Por grupos internos | Prova interna |
| Assinaturas Digitais | `assinaturas_digitais` | gov.br OAuth2 / Simples | Sim (gov.br ITI) |

### Arquivos principais

| Arquivo | Responsabilidade |
|---------|-----------------|
| `controllers/DocumentoPDFController.js` | Templates e geração de PDF |
| `controllers/AssinaturaDocController.js` | Assinaturas por grupo + verificação |
| `controllers/AssinaturaController.js` | Integração gov.br |
| `controllers/DocumentoController.js` | CRUD básico de documentos |
| `services/GovBrAssinaturaService.js` | OAuth2 + assinatura ITI |
| `utils/pdfGeneratorAdvanced.js` | Geração de PDF via Puppeteer |
| `routes/documentoPDFRoutes.js` | Rotas de templates |
| `routes/assinaturaDocRoutes.js` | Rotas de assinatura por grupo |
| `routes/assinaturaRoutes.js` | Rotas gov.br |

---

## 2. Módulo: Documentos PDF (Templates)

**Controller:** `controllers/DocumentoPDFController.js`  
**Routes:** `routes/documentoPDFRoutes.js`  
**Views:** `views/documentos-pdf/`  
**Prefixo:** `/documentos-pdf`  
**Autenticação:** Obrigatória (`authenticateToken + loadUnidades`)

### 2.1 Rotas

| Método | Rota | Handler | Descrição |
|--------|------|---------|-----------|
| GET | `/` | `index()` | Lista todos os templates ativos |
| GET | `/novo` | `novo()` | Formulário de criação de template |
| POST | `/criar` | `criar()` | Salva novo template |
| GET | `/:id/editar` | `editar()` | Formulário de edição |
| POST | `/:id/atualizar` | `atualizar()` | Atualiza template |
| DELETE | `/:id` | `excluir()` | Soft delete (ativo=false) |
| POST | `/:id/excluir` | `excluir()` | Soft delete via form |
| GET | `/:id/gerar` | `gerarFormulario()` | Formulário de geração de PDF |
| POST | `/:id/gerar` | `gerar()` | Gera PDF com variáveis preenchidas |
| GET | `/download/:nomeArquivo` | `download()` | Download do PDF gerado |
| GET | `/historico` | `historico()` | Histórico de documentos gerados |

### 2.2 Lógica de Geração de PDF (`gerar()`)

Esta é a função mais complexa do módulo. Ao gerar um PDF:

1. **Extrai variáveis** do template HTML automaticamente com regex `{{VARIAVEL}}`
2. **Substitui variáveis comuns** (nome, data, etc.) preservando `{{ASSINATURA:X}}`
3. **Detecta grupos de assinatura** via padrão `{{ASSINATURA:grupo_id}}`
4. **Cria registro** em `documentos_gerados` com `token_assinatura` único
5. **Cria registros pendentes** em `assinaturas_documentos` (um por grupo)
6. **Gera `token_individual`** único por grupo para links diretos
7. **Dispara notificações** para membros dos grupos que precisam assinar
8. **Gera PDF** com blocos "Aguardando assinatura" nos placeholders
9. **Retorna PDF** com headers de metadados:
   - `X-Assinatura-Token`
   - `X-Assinatura-Link`
   - `X-Assinaturas-JSON`

### 2.3 Views

| Arquivo | Descrição |
|---------|-----------|
| `index.ejs` | Grid de templates com filtro por tipo e busca |
| `form-ckeditor.ejs` | Editor HTML com CKEditor para criação/edição |
| `gerar.ejs` | Formulário dinâmico baseado nas variáveis do template |
| `historico.ejs` | Lista de `documentos_gerados` com status |
| `form.ejs`, `form-tinymce.ejs` | Editores alternativos |

### 2.4 Variáveis de Template

**Variáveis comuns** (substituídas na geração):
```
{{NOME}}, {{DATA}}, {{CARGO}}, {{MATRICULA}}, etc.
```

**Placeholders de assinatura** (preservados até assinatura real):
```
{{ASSINATURA:1}}   → grupo_id = 1
{{ASSINATURA:5}}   → grupo_id = 5
```

---

## 3. Módulo: Assinaturas de Documentos (Grupos)

**Controller:** `controllers/AssinaturaDocController.js`  
**Routes:** `routes/assinaturaDocRoutes.js`  
**Views:** `views/assinatura/`  
**Prefixo:** `/assinaturas-doc`  
**Autenticação:** Obrigatória (exceto `/verificar`)

### 3.1 Rotas

| Método | Rota | Handler | Auth | Descrição |
|--------|------|---------|------|-----------|
| GET | `/pendentes` | `pendentes()` | Sim | Lista documentos aguardando assinatura do usuário |
| GET | `/assinar/:token` | `paginaAssinar()` | Sim | Página de assinatura por token de grupo |
| POST | `/assinar/:token` | `assinar()` | Sim | Executa assinatura do grupo |
| GET | `/i/:tokenIndividual` | `paginaAssinarIndividual()` | Sim | Página de assinatura por link individual |
| POST | `/i/:tokenIndividual` | `assinarIndividual()` | Sim | Executa assinatura individual |
| GET | `/pdf-assinado/:token` | `gerarPDFAssinado()` | Sim | Regenera PDF com blocos de assinatura |

### 3.2 Processo de Assinatura

Ao executar `assinar()` ou `assinarIndividual()`:

1. Verifica que o usuário pertence ao grupo requerido
2. Atualiza o registro em `assinaturas_documentos`:
   - `status` → `'assinado'`
   - `usuario_id`, `nome_assinante`, `cpf_assinante`, `cargo_assinante`
   - `ip_assinante` (IP público via `x-forwarded-for` ou `api.ipify.org`)
   - `data_hora` (timezone: `America/Sao_Paulo`)
   - `hash_documento` (SHA-256 do `conteudo_html`)
   - `hash_assinatura` (16 chars hex único — código de verificação)
3. Verifica se **todos** os grupos assinaram
4. Se completo: atualiza `documentos_gerados.status_assinatura = 'assinado'`

### 3.3 Geração do Hash de Assinatura

```javascript
gerarHashAssinatura({
  docId,      // ID do documento gerado
  userId,     // ID do usuário
  assinId,    // ID do registro assinaturas_documentos
  hDoc,       // SHA-256 do conteudo_html
  ip          // IP do assinante
})
// Retorna: 16 chars HEX uppercase (código verificador público)
```

### 3.4 Regeneração de PDF com Assinaturas (`gerarPDFAssinado()`)

1. Busca `conteudo_html` original de `documentos_gerados`
2. Remove wrappers dos placeholders `{{ASSINATURA:X}}`
3. Para cada assinatura **concluída** → substitui por `_blocoAssinaturaHTML()`:
   ```
   ┌─────────────────────────────────────┐
   │ Assinado Eletronicamente            │
   │ Nome Completo — Cargo               │
   │ CPF: ***.***.***-**  |  Grupo: X    │
   │ Data/Hora  |  IP: x.x.x.x          │
   │ Código: ABCD1234EFGH5678           │
   │ Verificar em: /verificar/ABCD...    │
   │ Hash doc: sha256...                │
   └─────────────────────────────────────┘
   ```
4. Para assinaturas **pendentes** → substitui por `_blocoPendenteHTML()`
5. Gera novo PDF via Puppeteer e retorna para download

### 3.5 Views

| Arquivo | Descrição |
|---------|-----------|
| `assinatura/assinar.ejs` | Lista de assinaturas pendentes do usuário por grupo, relógio em tempo real, submissão AJAX, download automático do PDF assinado |
| `assinatura/assinar-individual.ejs` | Assinatura via link individual, preview do documento, status de todos os grupos |
| `assinatura/pendentes.ejs` | Lista de documentos aguardando assinatura do usuário |
| `assinatura/verificar.ejs` | Página pública de verificação (sem autenticação) |

---

## 4. Módulo: Assinaturas Digitais (gov.br)

**Controller:** `controllers/AssinaturaController.js`  
**Routes:** `routes/assinaturaRoutes.js`  
**Views:** `views/assinaturas/`  
**Prefixo:** `/assinaturas`  
**Autenticação:** Obrigatória

### 4.1 Rotas

| Método | Rota | Handler | Permissão | Descrição |
|--------|------|---------|-----------|-----------|
| GET | `/documento/:documentoId` | `index()` | Usuário | Painel de assinatura do documento |
| GET | `/documento/:documentoId/govbr/iniciar` | `iniciarGovBr()` | Usuário | Inicia OAuth2 gov.br |
| GET | `/govbr/callback` | `callbackGovBr()` | Usuário | Callback OAuth2 gov.br |
| POST | `/documento/:documentoId/simples` | `assinarSimples()` | Usuário | Assinatura simples interna |
| GET | `/:assinaturaId/download-p7s` | `downloadP7s()` | Usuário | Download arquivo `.p7s` |
| POST | `/:assinaturaId/remover` | `remover()` | Admin/Gestor | Remove assinatura |

### 4.2 Fluxo gov.br OAuth2

```
1. Usuário clica em "Assinar com gov.br"
   ↓
2. iniciarGovBr() → GovBrAssinaturaService.redirectUrl()
   Redireciona para: cas.iti.br/oauth2/authorize?...
   ↓
3. Usuário autentica no gov.br (conta Prata ou Ouro)
   ↓
4. callbackGovBr() → GovBrAssinaturaService.exchangeCode()
   Troca code por access_token
   ↓
5. GovBrAssinaturaService.getCertificado()
   Obtém certificado do usuário
   (Lança CONTA_BRONZE se conta for básica)
   ↓
6. GovBrAssinaturaService.assinarHash()
   Envia SHA-256 do documento → recebe PKCS#7
   ↓
7. Salva .p7s em: public/documentos/{nome}_govbr.p7s
8. Cria registro em assinaturas_digitais
```

### 4.3 Tipos de Assinatura

| Tipo | Descrição | Validação Externa |
|------|-----------|------------------|
| `gov_br` | OAuth2 + certificado ITI, gera `.p7s` | `validar.iti.gov.br` |
| `simples` | Hash interno apenas, sem certificado externo | Não |

### 4.4 View: `assinaturas/index.ejs`

- Dois cards de ação: assinatura gov.br e assinatura simples
- Verificação de status da integração gov.br
- Tabela de histórico de assinaturas do documento
- Links para download de `.p7s`
- Instruções de validação no ITI

---

## 5. Módulo: Verificação Pública

**Controller:** `AssinaturaDocController.verificar()`  
**Rota:** `GET /verificar/:hash`  
**Autenticação:** **NENHUMA** — página completamente pública

### 5.1 Rotas (registradas diretamente no server.js)

```javascript
app.get('/verificar', (req, res) => res.render('assinatura/verificar', { ... }));
app.get('/verificar/:hash', AssinaturaDocController.verificar);
```

### 5.2 Lógica de Verificação

1. Recebe `hash_assinatura` (16 chars) na URL
2. Converte para UPPERCASE (busca case-insensitive)
3. Query no banco:

```sql
SELECT a.*, u.nome, u.email, g.nome as grupo_nome,
       d.titulo, d.nome_arquivo, d.token_assinatura,
       t.nome as template_nome
FROM assinaturas_documentos a
LEFT JOIN usuarios u ON u.id = a.usuario_id
LEFT JOIN grupos g ON g.id = a.grupo_id
LEFT JOIN documentos_gerados d ON d.id = a.documento_gerado_id
LEFT JOIN templates_pdf t ON t.id = a.template_id
WHERE UPPER(a.hash_assinatura) = $1
```

4. Retorna `null` → exibe mensagem "não encontrado"
5. `status = 'assinado'` → exibe detalhes completos
6. `status = 'pendente'` → exibe aviso de assinatura pendente

### 5.3 Dados exibidos publicamente

- Nome completo do assinante
- CPF mascarado (`***.***.***-**`)
- Cargo e grupo do assinante
- Data e hora da assinatura
- IP de origem
- Código de verificação (hash)
- Hash de integridade do documento (SHA-256)
- Título e tipo do documento
- Status da assinatura

### 5.4 View: `assinatura/verificar.ejs`

- Formulário de busca por código
- Indicador visual de status (válido / pendente / inválido)
- Seção de detalhes técnicos expansível
- Formato para impressão

---

## 6. Schema do Banco de Dados

### 6.1 `templates_pdf` (Migration 005)

```sql
CREATE TABLE templates_pdf (
  id            SERIAL PRIMARY KEY,
  nome          VARCHAR(255) NOT NULL,
  descricao     TEXT,
  tipo_documento VARCHAR(100),
  conteudo_html TEXT,
  variaveis     JSON,
  configuracoes JSON,
  criado_por    INTEGER REFERENCES usuarios(id),
  criado_em     TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW(),
  ativo         BOOLEAN DEFAULT true
);
```

### 6.2 `documentos_gerados` (Migration 005 + 008)

```sql
CREATE TABLE documentos_gerados (
  id                 SERIAL PRIMARY KEY,
  template_id        INTEGER REFERENCES templates_pdf(id),
  nome_arquivo       VARCHAR(255),
  titulo             VARCHAR(255),
  dados_variaveis    JSON,
  caminho_arquivo    VARCHAR(500),
  tamanho_bytes      INTEGER,
  gerado_por         INTEGER REFERENCES usuarios(id),
  unidade_id         INTEGER REFERENCES unidades(id),
  -- Adicionados na Migration 008:
  conteudo_html      TEXT,
  token_assinatura   VARCHAR(64) UNIQUE,
  status_assinatura  VARCHAR(30) DEFAULT 'nao_requer',
  criado_em          TIMESTAMP DEFAULT NOW()
);
```

**Valores de `status_assinatura`:** `nao_requer` | `pendente` | `assinado`

### 6.3 `assinaturas_documentos` (Migration 008 + 010)

```sql
CREATE TABLE assinaturas_documentos (
  id                  SERIAL PRIMARY KEY,
  documento_gerado_id INTEGER REFERENCES documentos_gerados(id) ON DELETE CASCADE,
  template_id         INTEGER REFERENCES templates_pdf(id),
  grupo_id            INTEGER REFERENCES grupos(id),
  placeholder_key     VARCHAR(100),
  usuario_id          INTEGER REFERENCES usuarios(id),
  nome_assinante      VARCHAR(255),
  cpf_assinante       VARCHAR(30),
  cargo_assinante     VARCHAR(255),
  ip_assinante        VARCHAR(60),
  data_hora           TIMESTAMPTZ,
  hash_documento      VARCHAR(64),
  hash_assinatura     VARCHAR(16) UNIQUE,  -- código público de verificação
  status              VARCHAR(20) DEFAULT 'pendente',
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  -- Adicionado na Migration 010:
  token_individual    VARCHAR(64) UNIQUE
);

-- Índices
CREATE INDEX idx_assin_doc_documento ON assinaturas_documentos(documento_gerado_id);
CREATE INDEX idx_assin_doc_usuario   ON assinaturas_documentos(usuario_id);
CREATE INDEX idx_assin_doc_hash      ON assinaturas_documentos(hash_assinatura);
CREATE INDEX idx_assin_doc_status    ON assinaturas_documentos(status);
CREATE INDEX idx_assin_token_individual ON assinaturas_documentos(token_individual);
```

**Valores de `status`:** `pendente` | `assinado` | `recusado`

### 6.4 `assinaturas_digitais` (Migration 006)

```sql
CREATE TABLE assinaturas_digitais (
  id                  SERIAL PRIMARY KEY,
  documento_id        INTEGER REFERENCES documentos_gerados(id) ON DELETE CASCADE,
  protocolo_id        INTEGER REFERENCES protocolos(id),
  usuario_id          INTEGER REFERENCES usuarios(id),
  tipo_assinatura     VARCHAR(50),  -- simples | gov_br
  hash_documento      TEXT,
  certificado_digital TEXT,
  ip_assinante        VARCHAR(50),
  localizacao         VARCHAR(255),
  assinado_em         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  validado            BOOLEAN DEFAULT false,
  data_validacao      TIMESTAMP,
  observacoes         TEXT,
  govbr_pkcs7_path    VARCHAR(255)  -- caminho para arquivo .p7s
);
```

---

## 7. Camada de Serviços e Utilitários

### 7.1 `services/GovBrAssinaturaService.js`

| Função | Retorno | Descrição |
|--------|---------|-----------|
| `redirectUrl(documentoId, scope)` | `{ url, state }` | Gera URL OAuth2 para autorização |
| `exchangeCode(code)` | `{ access_token, ... }` | Troca code por token |
| `getCertificado(accessToken)` | PEM string | Obtém certificado do usuário |
| `assinarHash(accessToken, conteudo)` | `{ pkcs7, hashBase64 }` | Assina hash do documento |
| `calcularHash(buffer)` | base64 string | SHA-256 do buffer |

**Endpoints por ambiente:**

| Ambiente | OAuth2 | API Assinatura |
|----------|--------|----------------|
| Produção | `cas.iti.br` | `assinatura-api.iti.br` |
| Staging | `cas.staging.iti.br` | `assinatura-api.staging.iti.br` |

**Erro lançado:** `CONTA_BRONZE` — quando a conta gov.br não é Prata ou Ouro.

### 7.2 `utils/pdfGeneratorAdvanced.js`

| Função | Descrição |
|--------|-----------|
| `gerarPDF({ templateHTML, variaveis, outputPath, retornarBuffer })` | Renderiza HTML via Puppeteer, formato A4, margens 20mm |
| `substituirVariaveis(template, variaveis)` | Substitui `{{VAR}}` preservando `{{ASSINATURA:X}}` |
| `extrairVariaveis(templateHTML)` | Retorna Set de variáveis únicas (excluindo assinaturas) |
| `extrairVariaveisAssinatura(templateHTML)` | Retorna `[{ placeholder, grupo_id }]` |

**Notas de compatibilidade:**
- Puppeteer com `--no-sandbox` para deploy Linux/Railway
- IP detection via `x-forwarded-for` quando atrás de proxy

---

## 8. Middleware e Segurança

### 8.1 Middlewares aplicados

```javascript
// server.js
app.use('/documentos-pdf',  authenticateToken, loadUnidades, documentoPDFRoutes);
app.use('/assinaturas',     authenticateToken, loadUnidades, assinaturaRoutes);
app.use('/assinaturas-doc', authenticateToken, loadUnidades, assinaturaDocRoutes);

// Verificação: SEM autenticação
app.get('/verificar',       (req, res) => res.render('assinatura/verificar', {...}));
app.get('/verificar/:hash', AssinaturaDocController.verificar);
```

### 8.2 `authenticateToken`

- Verifica JWT via header `Authorization` ou cookie
- Busca usuário no banco pelo ID do token
- Define `req.user` com: `id`, `nome`, `email`, `perfil`, `ativo`
- Redireciona para `/auth/login` em caso de falha

### 8.3 `requireRole(roles[])`

- Verifica `req.user.perfil` contra os papéis permitidos
- Retorna 403 se negado
- Uso: `POST /assinaturas/:id/remover` → requer `[admin, gestor]`

### 8.4 Segurança adicional

| Medida | Implementação |
|--------|---------------|
| Rate limiting | 10 tentativas / 15 min no login |
| CPF mascarado | Exibido como `***.***.***-**` na verificação pública |
| IP tracking | `x-forwarded-for` ou `api.ipify.org` |
| Integridade | SHA-256 do `conteudo_html` gravado na assinatura |
| Tokens únicos | UUID v4 para `token_assinatura` e `token_individual` |
| Hash verificador | 16 chars HEX uppercase — único por assinatura |

---

## 9. Fluxo Completo de Ciclo de Vida

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. CRIAÇÃO DE TEMPLATE                                           │
│    DocumentoPDFController.criar()                               │
│    → Salva em templates_pdf                                      │
│    → conteudo_html contém {{VARIAVEIS}} e {{ASSINATURA:X}}      │
└──────────────────────────┬──────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. GERAÇÃO DE PDF                                                │
│    DocumentoPDFController.gerar()                               │
│    → Substitui variáveis comuns                                  │
│    → Detecta {{ASSINATURA:grupo_id}}                            │
│    → Cria registro em documentos_gerados                         │
│    → Cria N registros em assinaturas_documentos (status=pendente)│
│    → Gera token_individual por grupo                             │
│    → Notifica membros dos grupos                                 │
│    → Gera PDF com blocos "Aguardando assinatura"                │
└──────────────────────────┬──────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. ASSINATURA                                                    │
│    AssinaturaDocController.assinar() ou assinarIndividual()     │
│    → Verifica pertencimento ao grupo                             │
│    → Registra: nome, CPF, cargo, IP, data/hora, hashes          │
│    → Gera hash_assinatura (16 chars — código verificador)       │
│    → Atualiza status para 'assinado'                             │
│    → Se todos grupos assinaram: status_assinatura='assinado'    │
└──────────────────────────┬──────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. DOWNLOAD DO PDF ASSINADO                                      │
│    AssinaturaDocController.gerarPDFAssinado()                   │
│    → Busca conteudo_html original                                │
│    → Substitui {{ASSINATURA:X}} por blocos formatados:          │
│       - Assinados: nome, CPF, cargo, data, IP, hash, URL        │
│       - Pendentes: bloco "Aguardando assinatura"                │
│    → Gera novo PDF via Puppeteer                                 │
└──────────────────────────┬──────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. VERIFICAÇÃO PÚBLICA                                           │
│    GET /verificar/:hash  (sem autenticação)                     │
│    → Busca hash_assinatura no banco                              │
│    → Exibe: nome, CPF mascarado, cargo, grupo, data, IP, hash   │
│    → Indica status: Válida / Pendente / Não encontrada          │
└─────────────────────────────────────────────────────────────────┘
```

### Relacionamentos entre tabelas

```
templates_pdf
    ↓ (1:N)
documentos_gerados
    ↓ (1:N)
assinaturas_documentos ── grupos
    ↓ (quando assinado)
    hash_assinatura → /verificar/:hash
```

---

## 10. Variáveis de Ambiente Necessárias

```env
# Servidor
NODE_ENV=production
PORT=3000

# Banco de Dados
DB_HOST=
DB_PORT=
DB_NAME=
DB_USER=
DB_PASSWORD=
DATABASE_URL=

# JWT e Session
JWT_SECRET=          # mínimo 32 chars
JWT_EXPIRES_IN=24h
SESSION_SECRET=      # mínimo 32 chars

# gov.br (opcional — necessário para assinatura digital ITI)
GOVBR_ASSINATURA_CLIENT_ID=
GOVBR_ASSINATURA_CLIENT_SECRET=
GOVBR_ASSINATURA_REDIRECT_URI=

# Upload
UPLOAD_MAX_SIZE=10485760
UPLOAD_PATH=./uploads

# CORS e Socket.io
CORS_ORIGIN=https://seudominio.com
SOCKET_CORS_ORIGIN=https://seudominio.com
```

### Armazenamento de arquivos

| Tipo | Localização |
|------|-------------|
| PDFs gerados | `public/documentos/` |
| Arquivos `.p7s` (gov.br) | `public/documentos/{nome}_govbr.p7s` |
