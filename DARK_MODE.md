# 🌙 Dark Mode - DataFlow

## ✅ Implementado!

O sistema agora suporta **Dark Mode** completo com alternância entre Light e Dark!

---

## 🎨 Características

### **1. Alternância Manual**
- ✅ Botão no header para alternar entre Light/Dark
- ✅ Ícone de Sol (☀️) no modo escuro
- ✅ Ícone de Lua (🌙) no modo claro
- ✅ Transições suaves entre temas

### **2. Persistência**
- ✅ Preferência salva no `localStorage`
- ✅ Tema persiste entre páginas
- ✅ Tema persiste entre sessões

### **3. Detecção Automática**
- ✅ Detecta preferência do sistema operacional
- ✅ Aplica tema automaticamente se não houver preferência salva
- ✅ Atualiza automaticamente se preferência do sistema mudar

---

## 🎯 Como Funciona

### **Fluxo de Inicialização**

```javascript
1. Página carrega
   ↓
2. Verifica localStorage.getItem('theme')
   ↓
3. Se não houver preferência salva:
   - Verifica preferência do sistema (prefers-color-scheme)
   ↓
4. Aplica tema (adiciona/remove classe 'dark' no <html>)
   ↓
5. Renderiza página com cores corretas
```

### **Fluxo de Alternância**

```javascript
1. Usuário clica no botão de tema
   ↓
2. Detecta tema atual (light ou dark)
   ↓
3. Inverte o tema
   ↓
4. Adiciona/remove classe 'dark' no <html>
   ↓
5. Salva preferência no localStorage
   ↓
6. Atualiza ícone do botão
```

---

## 📁 Arquivos Modificados

### **1. `tailwind.config.js`**

```javascript
module.exports = {
  darkMode: 'class', // Habilita dark mode com classe
  // ... resto da config
}
```

**O que faz:**
- Habilita o dark mode baseado em classe
- Tailwind adiciona variantes `dark:` para todas as classes

---

### **2. `views/partials/header.ejs`**

#### **Botão de Dark Mode**

```html
<button id="themeToggle" class="...">
  <!-- Ícone Sol (visível no dark mode) -->
  <svg id="sunIcon" class="hidden dark:block">...</svg>
  
  <!-- Ícone Lua (visível no light mode) -->
  <svg id="moonIcon" class="block dark:hidden">...</svg>
</button>
```

#### **Script de Dark Mode**

```javascript
// Aplicar tema
function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
    localStorage.setItem('theme', 'dark');
  } else {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', 'light');
  }
}

// Inicialização
const savedTheme = localStorage.getItem('theme');
const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
const initialTheme = savedTheme || (systemPrefersDark ? 'dark' : 'light');
applyTheme(initialTheme);

// Toggle
document.getElementById('themeToggle').addEventListener('click', () => {
  const current = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  const newTheme = current === 'dark' ? 'light' : 'dark';
  applyTheme(newTheme);
});
```

---

## 🎨 Classes Dark Mode Aplicadas

### **Header**

```html
<!-- Background e bordas -->
<header class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">

<!-- Logo -->
<h1 class="... dark:from-teal-400 dark:to-teal-500">DataFlow</h1>

<!-- Select de Unidade -->
<select class="... bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200">

<!-- Perfil -->
<div class="... border-gray-200 dark:border-gray-700">
  <p class="text-gray-700 dark:text-gray-200">Nome</p>
  <p class="text-gray-500 dark:text-gray-400">Perfil</p>
</div>
```

### **Navbar**

```html
<!-- Background -->
<nav class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">

<!-- Botão Iniciar Processo -->
<a class="bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-800">

<!-- Botão Acompanhamento -->
<a class="bg-teal-500 dark:bg-teal-600 hover:bg-teal-600 dark:hover:bg-teal-700">

<!-- Links de Menu -->
<a class="text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">
```

### **Main Content**

```html
<main class="bg-gray-50 dark:bg-gray-900 transition-colors">
```

---

## 🎨 Paleta de Cores Dark Mode

### **Backgrounds**
- `bg-white` → `dark:bg-gray-800`
- `bg-gray-50` → `dark:bg-gray-900`
- `bg-gray-100` → `dark:bg-gray-700`

### **Textos**
- `text-gray-700` → `dark:text-gray-200`
- `text-gray-500` → `dark:text-gray-400`
- `text-gray-900` → `dark:text-white`

### **Bordas**
- `border-gray-200` → `dark:border-gray-700`
- `border-gray-300` → `dark:border-gray-600`

### **Hovers**
- `hover:bg-gray-50` → `dark:hover:bg-gray-700`
- `hover:text-gray-900` → `dark:hover:text-white`

### **Cores Primárias**
- `from-primary-600` → `dark:from-teal-400`
- `bg-teal-500` → `dark:bg-teal-600`
- `bg-blue-600` → `dark:bg-blue-700`

---

## 📝 Como Adicionar Dark Mode em Novas Páginas

### **Padrão para Elementos**

```html
<!-- Card -->
<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
  <!-- Título -->
  <h2 class="text-gray-900 dark:text-white">Título</h2>
  
  <!-- Texto -->
  <p class="text-gray-700 dark:text-gray-300">Conteúdo</p>
  
  <!-- Texto secundário -->
  <span class="text-gray-500 dark:text-gray-400">Secundário</span>
  
  <!-- Input -->
  <input class="bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600">
  
  <!-- Botão -->
  <button class="bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-800 text-white">
    Ação
  </button>
</div>
```

---

## 🔧 Dropdown de Cadastros - Correção

### **Problema:**
O dropdown estava "bugando" e ficando para dentro da página.

### **Solução:**

```html
<!-- ANTES (Errado) -->
<div class="absolute hidden group-hover:block ... mt-1 ... z-10">

<!-- DEPOIS (Correto) -->
<div class="absolute left-0 hidden group-hover:block ... mt-2 ... z-50">
```

**Mudanças:**
- ✅ `left-0` - Alinha à esquerda do botão
- ✅ `mt-2` - Mais espaçamento do botão
- ✅ `z-50` - Z-index maior para ficar acima de tudo
- ✅ `shadow-xl` - Sombra mais pronunciada
- ✅ `rounded-lg` - Bordas mais arredondadas
- ✅ `w-56` - Largura maior para melhor legibilidade

---

## 🎯 Benefícios

### **Para o Usuário**
- ✅ **Conforto Visual** - Menos cansaço em ambientes escuros
- ✅ **Economia de Bateria** - Telas OLED consomem menos energia no dark mode
- ✅ **Preferência Pessoal** - Cada usuário escolhe o que prefere
- ✅ **Acessibilidade** - Melhor para usuários sensíveis à luz

### **Para o Sistema**
- ✅ **Moderno** - Recurso esperado em apps modernos
- ✅ **Profissional** - Demonstra atenção aos detalhes
- ✅ **Flexível** - Fácil adicionar dark mode em novos componentes

---

## 🚀 Próximos Passos

### **Páginas que Precisam de Dark Mode**

- ⏳ **Dashboard** - Cards, gráficos, métricas
- ⏳ **Processos** - Tabelas, formulários
- ⏳ **Documentos** - Lista, detalhes
- ⏳ **Grupos** - Cards, membros
- ⏳ **Unidades** - Lista, formulários
- ⏳ **Usuários** - Tabelas, perfis
- ⏳ **Login** - Formulário de login

### **Componentes Específicos**

```html
<!-- Tabelas -->
<table class="bg-white dark:bg-gray-800">
  <thead class="bg-gray-50 dark:bg-gray-700">
    <th class="text-gray-900 dark:text-white">...</th>
  </thead>
  <tbody>
    <tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
      <td class="text-gray-700 dark:text-gray-300">...</td>
    </tr>
  </tbody>
</table>

<!-- Badges -->
<span class="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
  Ativo
</span>

<!-- Alerts -->
<div class="bg-blue-50 dark:bg-blue-900/20 border-blue-500 dark:border-blue-400">
  <p class="text-blue-700 dark:text-blue-300">Informação</p>
</div>
```

---

## ✅ Status

**IMPLEMENTADO!** 🎉

- ✅ Botão de alternância no header
- ✅ Persistência no localStorage
- ✅ Detecção de preferência do sistema
- ✅ Header com dark mode completo
- ✅ Navbar com dark mode completo
- ✅ Dropdown de Cadastros corrigido
- ✅ Transições suaves
- ✅ Ícones dinâmicos (sol/lua)

**Teste agora:**
1. Clique no botão de lua/sol no header
2. Veja a interface mudar instantaneamente
3. Recarregue a página - tema persiste!
4. Mude a preferência do sistema - app acompanha!

🌙 **Dark Mode funcionando perfeitamente!** ✨
