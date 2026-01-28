# DataFlow - Sistema de Gerenciamento de Documentos e Processos

Sistema profissional e escalável para gerenciamento de documentos e processos hospitalares, desenvolvido com padrão MVC e segurança extrema para dados sensíveis.

## 🚀 Tecnologias

- **Backend:** Node.js + Express
- **Frontend:** EJS (Server Side Rendering) + TailwindCSS + JavaScript Vanilla
- **Database:** PostgreSQL (SQL Raw)
- **Real-time:** Socket.io
- **Autenticação:** JWT + Express Sessions
- **Segurança:** Helmet, Rate Limiting, CORS, Validação de Inputs

## 📋 Pré-requisitos

- Node.js 16+ 
- PostgreSQL 12+
- npm ou yarn

## 🔧 Instalação

1. Clone o repositório:
```bash
git clone <repo-url>
cd dataflow
```

2. Instale as dependências:
```bash
npm install
```

3. Configure o arquivo `.env`:
```bash
cp .env.example .env
```

Edite o `.env` com suas configurações:
- Credenciais do PostgreSQL
- JWT_SECRET (mínimo 32 caracteres)
- SESSION_SECRET (mínimo 32 caracteres)

4. Execute as migrations:
```bash
psql -U postgres -d dataflow -f migrations/001_create_tables.sql
```

5. Inicie o servidor em modo desenvolvimento:
```bash
npm run dev
```

O servidor estará rodando em `http://localhost:3000`

## 📁 Estrutura do Projeto

```
dataflow/
├── config/           # Configurações (banco de dados)
├── controllers/      # Controllers (lógica de negócio)
├── middlewares/      # Middlewares (auth, validação, erros)
├── migrations/       # Scripts SQL de migração
├── models/           # Modelos de dados (se necessário)
├── public/           # Arquivos estáticos (CSS, JS, uploads)
├── routes/           # Rotas da aplicação
├── sockets/          # Handlers do Socket.io
├── utils/            # Utilitários (logger, helpers)
├── views/            # Templates EJS
├── logs/             # Logs de auditoria e erros
├── uploads/          # Arquivos enviados
└── server.js         # Arquivo principal
```

## 🔐 Segurança

- **Autenticação JWT** com tokens seguros
- **Helmet** para headers de segurança
- **Rate Limiting** para prevenir ataques
- **Sanitização de inputs** antes de queries
- **Validação de dados** com express-validator
- **Logs de auditoria** para ações sensíveis
- **Soft delete** para preservar histórico
- **Criptografia de senhas** com bcrypt

## 📊 Funcionalidades

### Dashboard
- Métricas em tempo real (Total, Pendentes, Aprovados, Requer Atenção)
- Orçamento por centro de custos
- Documentos por etapa
- Processos recentes

### Processos
- CRUD completo
- Fluxo de aprovação
- Histórico de alterações
- Notificações em tempo real

### Documentos
- Upload seguro
- Versionamento
- Status (Pendente, Em Análise, Aprovado, Rejeitado, Enviado, Arquivado)
- Associação com processos

### Fornecedores
- Cadastro completo
- Associação com processos e notas fiscais

## 👤 Usuário Padrão

Após executar as migrations, você pode fazer login com:
- **Email:** admin@dataflow.com
- **Senha:** admin123

**⚠️ IMPORTANTE:** Altere a senha após o primeiro login!

## 🛠️ Scripts Disponíveis

- `npm start` - Inicia o servidor em produção
- `npm run dev` - Inicia em modo desenvolvimento (com hot-reload)
- `npm run build:css` - Compila o CSS do Tailwind

## 📝 Próximos Passos

1. Configurar variáveis de ambiente
2. Executar migrations do banco
3. Criar usuário administrador
4. Configurar uploads de arquivos
5. Implementar notificações em tempo real

## 🔒 Dados Sensíveis

Este sistema lida com dados sensíveis de saúde (PHI/PII). Certifique-se de:
- Usar HTTPS em produção
- Configurar backups regulares
- Implementar políticas de retenção de dados
- Cumprir LGPD e HIPAA (se aplicável)

## 📄 Licença

ISC
