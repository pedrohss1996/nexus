# 📄 E-DOC - Sistema de Gestão Eletrônica de Documentos

## 🎯 Visão Geral

O **E-DOC** é um sistema completo de gestão eletrônica de documentos desenvolvido para modernizar e digitalizar processos documentais em organizações públicas e privadas.

## ✨ Principais Funcionalidades

### 📋 Protocolo Eletrônico
- **Geração automática de números de protocolo** (formato: 000001/2026)
- Cadastro de documentos oficiais (ofícios, memorandos, requerimentos, etc.)
- Controle de prioridades (baixa, normal, alta, urgente)
- Rastreamento completo do ciclo de vida do documento
- Registro de interessados (CPF/CNPJ)

### 🔄 Tramitação de Documentos
- **Envio de documentos entre unidades** de forma digital
- Tipos de tramitação:
  - Encaminhamento
  - Devolução
  - Arquivamento
  - Redistribuição
  - Ciência
- Despachos e orientações
- Definição de prazos de resposta
- Notificações de documentos pendentes
- Histórico completo de movimentações

### 📝 Criação de Documentos
- **Editor WYSIWYG** (CKEditor 5) completo e gratuito
- Inserção de imagens (Base64)
- Tabelas, formatação de texto, alinhamento
- **Sistema de variáveis** para personalização
- Templates reutilizáveis
- Geração de PDFs profissionais

### 🗂️ Arquivo Digital
- Estrutura preparada para arquivamento digital
- Classificação de documentos
- Controle de temporalidade
- Localização física (quando aplicável)
- Palavras-chave para busca

### ✍️ Assinatura Digital
- Estrutura preparada para múltiplos tipos de assinatura:
  - Assinatura simples
  - Certificado digital (ICP-Brasil)
  - Gov.br
  - Biometria
- Registro de hash do documento
- Validação de assinaturas

### 📊 Dashboard E-DOC
- Visão geral de protocolos ativos
- Tramitações pendentes
- Documentos gerados no período
- Assinaturas pendentes
- Ações rápidas
- Protocolos e tramitações recentes

## 🗄️ Estrutura do Banco de Dados

### Tabelas Principais

#### `protocolos`
Armazena todos os protocolos gerados no sistema.
- Número único de protocolo
- Tipo de documento
- Assunto, interessado, origem/destino
- Prioridade e status
- Vinculação com unidades e usuários

#### `tramitacoes`
Registra todas as movimentações de documentos.
- Origem e destino (unidades e usuários)
- Tipo de tramitação
- Despacho
- Prazo de resposta
- Status (pendente, recebido, rejeitado)

#### `assinaturas_digitais`
Controle de assinaturas em documentos.
- Tipo de assinatura
- Hash do documento
- Certificado digital
- Validação

#### `arquivo_digital`
Gestão do arquivo permanente.
- Localização física e digital
- Classificação
- Temporalidade
- Palavras-chave

#### `historico_acoes`
Auditoria completa de todas as ações.
- Ação realizada
- Usuário responsável
- Dados anteriores e novos
- IP e user agent

### Função Automática
```sql
gerar_numero_protocolo()
```
Gera automaticamente números sequenciais de protocolo no formato `000001/2026`.

## 🎨 Interface do Usuário

### Menu Principal
- **Novo Documento**: Criação rápida de documentos
- **Início**: Dashboard com visão geral
- **Protocolo**: Gestão de protocolos
- **Tramitação**: Envio e recebimento de documentos
- **Templates**: Modelos de documentos
- **Arquivo**: Arquivo digital
- **Assinatura**: Assinaturas digitais
- **Processos**: Processos administrativos
- **Cadastros**: Usuários, grupos e unidades

### Design
- **Tema claro e escuro** automático
- Layout **full-width** sem barras laterais
- Gradientes modernos (azul/índigo)
- Ícones intuitivos
- Responsivo (mobile-first)

## 🚀 Tecnologias Utilizadas

### Backend
- **Node.js** + **Express.js**
- **PostgreSQL** (banco de dados)
- **PDFKit** (geração de PDFs)
- **Multer** (upload de arquivos)
- **JWT** (autenticação)

### Frontend
- **EJS** (template engine)
- **Tailwind CSS** (estilização)
- **CKEditor 5** (editor WYSIWYG)
- **JavaScript** vanilla

### Segurança
- **Helmet.js** (headers de segurança)
- **CSP** (Content Security Policy)
- **Rate limiting**
- **Autenticação JWT**
- **Hashing de senhas**

## 📦 Instalação

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente (.env)
DB_HOST=localhost
DB_PORT=5432
DB_USER=seu_usuario
DB_PASSWORD=sua_senha
DB_NAME=edoc
JWT_SECRET=seu_secret_jwt
SESSION_SECRET=seu_secret_session

# 3. Executar migrations
node scripts/run-migration-001.js
node scripts/run-migration-002.js
node scripts/run-migration-003.js
node scripts/run-migration-004.js
node scripts/run-migration-005.js
node scripts/run-migration-006.js  # Tabelas E-DOC

# 4. Iniciar servidor
npm start
```

## 🔐 Perfis de Usuário

- **Administrador**: Acesso total ao sistema
- **Gestor**: Gestão de protocolos e tramitações
- **Operador**: Criação e tramitação de documentos
- **Visualizador**: Apenas visualização

## 📱 Funcionalidades Futuras

- [ ] App mobile (React Native)
- [ ] Integração com Gov.br
- [ ] OCR para digitalização
- [ ] Assinatura em lote
- [ ] Relatórios avançados
- [ ] API REST completa
- [ ] Notificações por e-mail/SMS
- [ ] Integração com e-mail
- [ ] Workflow customizável

## 🤝 Contribuindo

Este é um projeto em constante evolução. Sugestões e melhorias são bem-vindas!

## 📄 Licença

Proprietário - Todos os direitos reservados

---

**Desenvolvido com ❤️ para modernizar a gestão documental**
