# Editor Visual de Documentos PDF

## 🎨 Visão Geral

O sistema agora possui um **editor visual WYSIWYG** (What You See Is What You Get) completo, semelhante aos editores de documentos profissionais, permitindo criar templates de documentos com formatação rica, tabelas, imagens e muito mais!

## ✨ Recursos do Editor

### 📝 Formatação de Texto

#### Fontes e Tamanhos
- **Tipos de fonte**: Selecione entre diferentes estilos de fonte
- **Tamanhos**: Do muito pequeno ao muito grande
- **Estilos**: Negrito, Itálico, Sublinhado, Tachado

#### Cores
- **Cor do texto**: Palette completa de cores
- **Cor de fundo**: Destacar texto com cores de fundo
- **Combinações personalizadas**: Crie seu próprio esquema de cores

### 📐 Alinhamento e Formatação

- **Alinhamento**: Esquerda, Centro, Direita, Justificado
- **Listas**: Numeradas e com marcadores
- **Indentação**: Aumentar ou diminuir recuo
- **Espaçamento**: Controle de espaços entre linhas e parágrafos

### 🖼️ Inserção de Elementos

#### Imagens
- Insira imagens via URL
- Suporte a imagens base64
- Redimensionamento automático
- ✅ Renderização no PDF final

#### Tabelas
- Botão dedicado para inserir tabelas
- Escolha número de linhas e colunas
- Células editáveis
- Bordas e estilos automáticos
- ✅ Renderização completa no PDF

#### Links
- Adicione links clicáveis
- Links para sites externos
- Links para documentos

### 🏷️ Variáveis Dinâmicas

#### Inserção de Variáveis
1. Clique no botão **"Variável"**
2. Digite o nome da variável (ex: `nome_servidor`, `data_emissao`)
3. A variável é inserida com destaque roxo: `{{nome_variavel}}`

#### Variáveis Comuns
- `{{nome_servidor}}` - Nome do servidor
- `{{cpf}}` - CPF
- `{{data_emissao}}` - Data de emissão
- `{{cargo}}` - Cargo
- `{{unidade}}` - Unidade/Setor
- `{{numero_documento}}` - Número do documento
- `{{ano}}` - Ano

### 📋 Templates Prontos

#### Cabeçalho Oficial
- Clique em **"Cabeçalho"**
- Insira o nome do órgão
- Insira o nome da secretaria
- Um cabeçalho formatado é criado automaticamente

## 🎯 Como Usar

### Criando um Novo Template

1. **Acesse**: Menu "Documentos" → "Novo Template"
2. **Preencha as informações básicas**:
   - Nome do template
   - Tipo de documento
   - Descrição

3. **Use o Editor Visual**:
   - Digite normalmente, como em um editor de textos
   - Use a barra de ferramentas para formatação
   - Insira tabelas, imagens e variáveis conforme necessário

4. **Preview em Tempo Real**:
   - Veja o resultado no painel à direita
   - Variáveis são destacadas automaticamente

5. **Salvar**: Clique em "Criar Template"

### Exemplos Práticos

#### Exemplo 1: Comunicação de Abono

```html
[Usar o botão Cabeçalho]
GOVERNO DO ESTADO DO ESPÍRITO SANTO
SECRETARIA DE ESTADO DE GESTÃO E RECURSOS HUMANOS - SEGER

COMUNICAÇÃO DE ABONO

DADOS PESSOAIS DO SERVIDOR
Nome: {{nome_servidor}}
Nº Funcional: {{numero_funcional}}
Órgão/Setor: {{orgao_setor}}
Cargo: {{cargo}}

ESCOLHA UMA DAS OPÇÕES ABAIXO:

( X ) Comunicação Inicial
A Unidade de RH,
Comunico a utilização do abono no dia {{data_abono}}, tendo em vista o que preceita o artigo 32 da Lei Complementar nº. 46/94.

{{nome_servidor}}
(assinado eletronicamente)

( ) Cancelamento de abono solicitado para o dia {{data_cancelamento}}
Deseja remarcar? ( ) Sim, para o dia ___/___/_____ ( ) Não desejo remarcar.
```

#### Exemplo 2: Termo com Tabela

```
TERMO DE RECEBIMENTO DE MATERIAIS

Eu, {{nome_responsavel}}, CPF {{cpf}}, declaro ter recebido os seguintes materiais:

[Inserir Tabela 5x4]
| Item | Descrição | Quantidade | Valor Unit. |
|------|-----------|------------|-------------|
| 1    | Material  | 10         | R$ 50,00    |
| 2    | Material  | 5          | R$ 100,00   |

Valor Total: R$ {{valor_total}}
Data: {{data_recebimento}}

_______________________________
{{nome_responsavel}}
```

## 🎨 Barra de Ferramentas Completa

### Primeira Seção - Fonte
- **Select Font**: Escolher tipo de letra
- **Select Size**: Tamanho da fonte

### Segunda Seção - Estilo
- **B**: Negrito
- **I**: Itálico  
- **U**: Sublinhado
- **S**: Tachado

### Terceira Seção - Cores
- **A** com cor: Cor do texto
- **Fundo**: Cor de fundo/destaque

### Quarta Seção - Alinhamento
- **≡**: Alinhar à esquerda
- **☰**: Centralizar
- **≣**: Alinhar à direita
- **▭**: Justificar

### Quinta Seção - Listas
- **1.2.3.**: Lista numerada
- **•**: Lista com marcadores
- **◁**: Diminuir recuo
- **▷**: Aumentar recuo

### Sexta Seção - Inserir
- **🔗**: Inserir link
- **🖼️**: Inserir imagem

### Sétima Seção
- **🧹**: Limpar formatação

## 🚀 Botões Extras

### Botão "Variável" (Roxo)
- Insere variáveis dinâmicas
- Formato: `{{nome_variavel}}`
- Destaque automático em roxo

### Botão "Tabela" (Verde)
- Pergunta número de linhas e colunas
- Cria tabela formatada automaticamente
- Células editáveis

### Botão "Cabeçalho" (Azul)
- Insere cabeçalho oficial
- Título e subtítulo personalizáveis
- Linha divisória automática

## 💡 Dicas e Truques

### 1. Formatação de Datas
Use variáveis para datas que serão preenchidas dinamicamente:
- `{{data_emissao}}` - será preenchido como "29/01/2026"
- O sistema detecta "data" no nome e cria um campo de data automaticamente

### 2. Campos Numéricos
Variáveis com "valor", "preco" ou "numero" se tornam campos numéricos:
- `{{valor_total}}` → Campo numérico
- `{{numero_funcional}}` → Campo numérico

### 3. Campos de Texto Longo
Variáveis com "texto", "descricao" ou "corpo" viram textareas:
- `{{texto_declaracao}}` → Textarea grande
- `{{descricao_itens}}` → Textarea

### 4. Tabelas Profissionais
- Use células de cabeçalho (`<th>`) para títulos
- Mantenha tamanhos consistentes
- Use alinhamento para números (direita) e texto (esquerda)

### 5. Preview é Seu Amigo
- O preview atualiza em tempo real
- Teste diferentes formatações
- Verifique se as variáveis estão corretas

## 🔧 Suporte Técnico

### HTML Suportado no PDF

#### Tags Suportadas
- `<h1>`, `<h2>`, `<h3>` - Títulos
- `<p>` - Parágrafos
- `<strong>`, `<b>` - Negrito
- `<em>`, `<i>` - Itálico
- `<u>` - Sublinhado
- `<s>`, `<strike>` - Tachado
- `<ul>`, `<ol>`, `<li>` - Listas
- `<table>`, `<tr>`, `<td>`, `<th>` - Tabelas
- `<img>` - Imagens
- `<br>` - Quebra de linha
- `<hr>` - Linha horizontal

#### Estilos CSS Suportados
- `text-align`: left, center, right, justify
- `color`: cores hexadecimais ou nomes
- `font-size`: tamanhos em px
- `margin-top`, `margin-bottom`: espaçamento
- `background-color`: cor de fundo

## 🎓 Tutoriais Rápidos

### Tutorial 1: Criar Comunicação Simples
1. Clique em "Documentos" → "Novo Template"
2. Nome: "Comunicação Simples"
3. Tipo: "Comunicação"
4. No editor:
   - Clique em "Cabeçalho"
   - Digite: "SECRETARIA DE GESTÃO"
   - Digite o conteúdo
   - Clique em "Variável" para campos dinâmicos
5. Salvar

### Tutorial 2: Criar Termo com Tabela
1. Novo Template
2. Digite o título
3. Clique em "Tabela" → 5 linhas, 3 colunas
4. Preencha cabeçalhos
5. Adicione variáveis nas células
6. Salvar

### Tutorial 3: Documento com Imagem
1. Novo Template
2. Digite texto
3. Clique no ícone de imagem na barra
4. Cole URL da imagem ou brasão
5. Imagem aparece no preview
6. Salvar

## ⚙️ Configurações Avançadas

### Tamanho de Página
- A4 (padrão) - 210 x 297 mm
- A3 - 297 x 420 mm
- Letter - 215.9 x 279.4 mm
- Legal - 215.9 x 355.6 mm

### Orientação
- Retrato (portrait) - padrão
- Paisagem (landscape) - para tabelas largas

### Margens
Personalize margens em pixels:
```json
{
  "margens": {
    "top": 50,
    "right": 50,
    "bottom": 50,
    "left": 50
  }
}
```

## 🆘 Solução de Problemas

### Problema: Tabela não aparece no PDF
**Solução**: Certifique-se de que a tabela tem tags `<table>`, `<tr>`, `<td>` corretas

### Problema: Imagem não carrega
**Solução**: Use URLs públicas ou imagens em base64

### Problema: Formatação perdida
**Solução**: Verifique se os estilos CSS são suportados (veja lista acima)

### Problema: Variável não detectada
**Solução**: Use apenas letras minúsculas e underline. Ex: `{{nome_completo}}`

## 📞 Suporte

Para dúvidas ou problemas, entre em contato com a equipe de TI ou consulte a documentação completa.

---

**Última atualização**: 29/01/2026
**Versão do Sistema**: 1.1.0
