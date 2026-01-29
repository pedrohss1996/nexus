# Módulo de Documentos PDF

## Visão Geral

O módulo de Documentos PDF permite criar templates personalizados de documentos e gerar PDFs dinamicamente preenchendo variáveis.

## Funcionalidades

### 1. Gerenciamento de Templates
- ✅ Criar templates de documentos com HTML
- ✅ Editar templates existentes
- ✅ Excluir templates (soft delete)
- ✅ Filtrar templates por tipo de documento
- ✅ Detecção automática de variáveis

### 2. Tipos de Documentos Suportados
- Termos
- Ofícios
- Declarações
- Contratos
- Relatórios
- Atestados
- Solicitações
- Pareceres
- Outros

### 3. Geração de PDFs
- ✅ Formulário dinâmico baseado nas variáveis do template
- ✅ Preview em tempo real do documento
- ✅ Download direto do PDF gerado
- ✅ Histórico de documentos gerados

## Como Usar

### Criar um Novo Template

1. Acesse **Documentos** no menu principal
2. Clique em **Novo Template**
3. Preencha:
   - Nome do template
   - Descrição (opcional)
   - Tipo de documento
   - Conteúdo HTML com variáveis

#### Exemplo de Template:

```html
<h1 style="text-align: center;">TERMO DE RECEBIMENTO</h1>

<p style="margin-top: 30px;">
  Eu, <strong>{{nome_responsavel}}</strong>, 
  portador(a) do CPF <strong>{{cpf_responsavel}}</strong>, 
  declaro ter recebido em <strong>{{data_recebimento}}</strong> 
  os seguintes itens:
</p>

<p style="margin-top: 20px;"><strong>Descrição:</strong></p>
<p>{{descricao_itens}}</p>

<p style="margin-top: 40px; text-align: center;">
  _______________________________________
</p>
<p style="text-align: center;">{{nome_responsavel}}</p>
<p style="text-align: center;">Data: {{data_assinatura}}</p>
```

### Sistema de Variáveis

#### Sintaxe
Use `{{nome_variavel}}` para definir variáveis no template.

#### Detecção Automática
O sistema detecta automaticamente todas as variáveis no formato `{{variavel}}` e cria campos de formulário adequados:

- Variáveis com "data" → campo de data
- Variáveis com "valor" ou "preco" → campo numérico
- Variáveis com "texto", "descricao" ou "corpo" → textarea
- Outras variáveis → campo de texto

### Gerar um PDF

1. Na listagem de templates, clique em **Gerar PDF**
2. Preencha os valores das variáveis
3. Visualize o preview em tempo real
4. Clique em **Gerar PDF**
5. Faça o download do documento gerado

### HTML Suportado

O gerador de PDF suporta as seguintes tags HTML:

- `<h1>`, `<h2>` - Títulos
- `<p>` - Parágrafos
- `<strong>` - Texto em negrito
- `<br>` - Quebra de linha
- `<div>` - Container

#### Estilos CSS Suportados:
- `text-align` (left, center, right, justify)
- `margin-top`
- `margin-bottom`

## Estrutura do Banco de Dados

### Tabela: `templates_pdf`
Armazena os templates de documentos.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | SERIAL | Identificador único |
| nome | VARCHAR(255) | Nome do template |
| descricao | TEXT | Descrição do template |
| tipo_documento | VARCHAR(100) | Tipo do documento |
| conteudo_html | TEXT | Conteúdo HTML do template |
| variaveis | JSONB | Array com nomes das variáveis |
| configuracoes | JSONB | Configurações do PDF (tamanho, margens) |
| ativo | BOOLEAN | Status do template |
| criado_por | INTEGER | ID do usuário criador |
| criado_em | TIMESTAMP | Data de criação |
| atualizado_em | TIMESTAMP | Data da última atualização |

### Tabela: `documentos_gerados`
Armazena histórico de documentos gerados.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | SERIAL | Identificador único |
| template_id | INTEGER | ID do template usado |
| nome_arquivo | VARCHAR(255) | Nome do arquivo PDF |
| titulo | VARCHAR(255) | Título do documento |
| dados_variaveis | JSONB | Valores das variáveis usadas |
| caminho_arquivo | TEXT | Caminho do arquivo no servidor |
| tamanho_bytes | INTEGER | Tamanho do arquivo em bytes |
| gerado_por | INTEGER | ID do usuário que gerou |
| gerado_em | TIMESTAMP | Data de geração |
| processo_id | INTEGER | ID do processo relacionado (opcional) |
| unidade_id | INTEGER | ID da unidade (opcional) |

## Arquivos Principais

### Controller
- `controllers/DocumentoPDFController.js` - Lógica de negócio

### Routes
- `routes/documentoPDFRoutes.js` - Definição das rotas

### Utils
- `utils/pdfGenerator.js` - Gerador de PDFs com PDFKit

### Views
- `views/documentos-pdf/index.ejs` - Listagem de templates
- `views/documentos-pdf/form.ejs` - Formulário de template
- `views/documentos-pdf/gerar.ejs` - Geração de PDF
- `views/documentos-pdf/historico.ejs` - Histórico de documentos

### Migration
- `migrations/005-create-templates-pdf.js` - Criação das tabelas

## Configurações Avançadas

As configurações do PDF são armazenadas em JSON:

```json
{
  "tamanho_pagina": "A4",
  "orientacao": "portrait",
  "margens": {
    "top": 50,
    "right": 50,
    "bottom": 50,
    "left": 50
  }
}
```

### Tamanhos de Página Suportados
- A4 (padrão)
- A3
- Letter
- Legal

### Orientações
- portrait (retrato) - padrão
- landscape (paisagem)

## Templates Padrão

O sistema vem com 3 templates pré-configurados:

1. **Termo de Recebimento** - Para registro de recebimento de materiais
2. **Ofício** - Para comunicações oficiais
3. **Declaração Simples** - Para declarações diversas

## Permissões

Todos os usuários autenticados podem:
- Visualizar templates
- Gerar PDFs
- Ver histórico de documentos gerados

Apenas usuários com permissão adequada podem:
- Criar templates
- Editar templates
- Excluir templates

## Próximos Passos (Melhorias Futuras)

- [ ] Suporte a imagens nos templates
- [ ] Assinatura digital
- [ ] Templates com múltiplas páginas
- [ ] Exportação de templates
- [ ] Versionamento de templates
- [ ] Compartilhamento de templates entre unidades
- [ ] Integração com processos
- [ ] Upload de logotipos personalizados
- [ ] Campos calculados (ex: soma de valores)
- [ ] Tabelas dinâmicas

## Troubleshooting

### PDF não está sendo gerado
1. Verifique se o diretório `uploads/documentos-gerados` existe
2. Verifique permissões de escrita no diretório
3. Confira os logs do servidor para erros

### Variáveis não estão sendo substituídas
1. Certifique-se de usar a sintaxe correta: `{{nome_variavel}}`
2. Verifique se a variável foi detectada no formulário
3. Confirme que o valor foi preenchido antes de gerar

### Preview não atualiza
1. Limpe o cache do navegador
2. Verifique o console do navegador para erros JavaScript
