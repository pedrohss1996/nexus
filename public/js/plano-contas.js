(function () {
  const tree = window.__PLANO_TREE__ || [];
  const unidadeId = window.__UNIDADE_ID__ || '';
  const canEdit = window.__CAN_EDIT__ === true;
  const container = document.getElementById('plano-contas-tree');
  const alertId = window.__CONTAINER_ALERT_ID__ || 'plano-alerta';
  const alertEl = document.getElementById(alertId);

  if (!container) return;

  function formatCurrency(value) {
    const n = typeof value === 'number' ? value : parseFloat(value) || 0;
    return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function parseCurrency(str) {
    if (str === '' || str == null) return 0;
    const cleaned = String(str).replace(/\D/g, '');
    return parseInt(cleaned, 10) / 100;
  }

  function maskCurrencyInput(input) {
    function format() {
      let v = input.value.replace(/\D/g, '');
      if (v.length > 2) v = v.replace(/^0+/, '') || '0';
      const num = parseInt(v, 10) / 100;
      input.value = formatCurrency(num);
      input.dataset.raw = String(num);
    }
    input.addEventListener('input', format);
    input.addEventListener('blur', format);
  }

  const borderColors = ['border-cyan-600', 'border-slate-600', 'border-cyan-500', 'border-slate-500'];

  function renderNode(node, level) {
    const depth = level || 0;
    const borderClass = depth === 0 ? borderColors[node.codigo ? (parseInt(node.codigo, 10) - 1) % borderColors.length : 0] : 'border-slate-300';
    const card = document.createElement('div');
    card.className = 'plano-card border-l-4 ' + borderClass + ' bg-slate-50 rounded p-2 text-xs';
    card.style.marginLeft = (depth * 16) + 'px';
    card.dataset.contaId = node.id;
    card.dataset.parentId = node.parent_id || '';

    const valorNum = typeof node.valor === 'number' ? node.valor : parseFloat(node.valor) || 0;
    const dispNum = typeof node.disponivel === 'number' ? node.disponivel : parseFloat(node.disponivel) || 0;

    const deleteBtn = canEdit
      ? '<button type="button" class="plano-del w-6 h-6 rounded text-red-600 hover:bg-red-50 flex items-center justify-center flex-shrink-0" title="Excluir conta e subcontas" data-conta-id="' + node.id + '"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>'
      : '';

    card.innerHTML =
      '<div class="flex flex-wrap items-center gap-2">' +
        '<span class="font-mono text-slate-600 w-14 flex-shrink-0">' + (node.codigo || '') + '</span>' +
        (canEdit
          ? '<input type="text" class="plano-nome flex-1 min-w-[120px] border border-slate-300 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-cyan-500" value="' + (node.nome || '').replace(/"/g, '&quot;') + '" placeholder="Nome" data-conta-id="' + node.id + '">'
          : '<span class="flex-1 text-slate-900">' + (node.nome || '').replace(/</g, '&lt;') + '</span>') +
        (canEdit
          ? '<input type="text" class="plano-valor w-28 border border-slate-300 rounded px-2 py-1 text-xs text-right focus:ring-2 focus:ring-cyan-500" value="' + formatCurrency(valorNum) + '" data-conta-id="' + node.id + '" data-raw="' + valorNum + '" placeholder="R$ 0,00">'
          : '<span class="w-28 text-right text-slate-900">' + formatCurrency(valorNum) + '</span>') +
        (canEdit ? '<button type="button" class="plano-add w-7 h-7 rounded bg-cyan-600 text-white hover:bg-cyan-700 flex items-center justify-center flex-shrink-0" title="Adicionar subconta" data-conta-id="' + node.id + '">+</button>' : '') +
        deleteBtn +
      '</div>' +
      '<div class="mt-1 text-slate-500 text-xs">DISPONÍVEL: ' + formatCurrency(dispNum) + '</div>' +
      '<div class="plano-children mt-2 space-y-2"></div>';

    const childrenContainer = card.querySelector('.plano-children');
    (node.children || []).forEach(function (child) {
      childrenContainer.appendChild(renderNode(child, depth + 1));
    });

    if (canEdit) {
      const valorInput = card.querySelector('.plano-valor');
      if (valorInput) maskCurrencyInput(valorInput);
    }

    return card;
  }

  function showInlineCreateRow(parentContainer, parentId, depth, isRoot) {
    var i, el;
    for (i = parentContainer.children.length - 1; i >= 0; i--) {
      el = parentContainer.children[i];
      if (el.classList && el.classList.contains('plano-inline-create')) parentContainer.removeChild(el);
    }

    var wrap = document.createElement('div');
    wrap.className = 'plano-inline-create border border-dashed border-slate-300 rounded p-2 bg-slate-100/50 text-xs flex flex-wrap items-center gap-2';
    wrap.style.marginLeft = (depth * 16) + 'px';
    var input = document.createElement('input');
    input.type = 'text';
    input.placeholder = isRoot ? 'Nome da conta principal' : 'Nome da subconta';
    input.className = 'flex-1 min-w-[120px] border border-slate-300 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-cyan-500';
    var inputValor = document.createElement('input');
    inputValor.type = 'text';
    inputValor.placeholder = 'R$ 0,00';
    inputValor.className = 'plano-inline-valor w-24 border border-slate-300 rounded px-2 py-1 text-xs text-right focus:ring-2 focus:ring-cyan-500';
    inputValor.dataset.raw = '0';
    maskCurrencyInput(inputValor);
    var btnCriar = document.createElement('button');
    btnCriar.type = 'button';
    btnCriar.className = 'px-2 py-1 rounded bg-cyan-600 text-white hover:bg-cyan-700 text-xs';
    btnCriar.textContent = 'Criar';
    var btnCancelar = document.createElement('button');
    btnCancelar.type = 'button';
    btnCancelar.className = 'px-2 py-1 rounded bg-slate-200 text-slate-700 hover:bg-slate-300 text-xs';
    btnCancelar.textContent = 'Cancelar';

    function removeRow() {
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    }

    btnCriar.addEventListener('click', function () {
      var nome = input.value.trim();
      if (!nome) { showAlert('Informe o nome.', true); return; }
      var valor = parseCurrency(inputValor.value);
      postSubconta(parentId, nome, valor).then(function (r) {
        return r.json().then(function (data) {
          if (!data.success) {
            showAlert(data.message || (data.erro === 'teto' && data.disponivel != null ? 'Valor excede o teto. Disponível: ' + formatCurrency(data.disponivel) : 'Erro ao criar conta'), true);
            return;
          }
          removeRow();
          var newNode = {
            id: data.conta.id,
            codigo: data.conta.codigo,
            nome: data.conta.nome,
            valor: data.conta.valor || 0,
            disponivel: data.conta.disponivel != null ? data.conta.disponivel : data.conta.valor || 0,
            parent_id: parentId ? parseInt(parentId, 10) : null,
            children: []
          };
          parentContainer.appendChild(renderNode(newNode, depth));
          attachEditHandlers();
          attachDeleteHandlers();
        });
      }).catch(function () { showAlert('Erro ao criar conta', true); });
    });

    btnCancelar.addEventListener('click', removeRow);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') btnCriar.click();
      if (e.key === 'Escape') removeRow();
    });
    inputValor.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') btnCriar.click();
      if (e.key === 'Escape') removeRow();
    });

    wrap.appendChild(input);
    wrap.appendChild(inputValor);
    wrap.appendChild(btnCriar);
    wrap.appendChild(btnCancelar);
    parentContainer.appendChild(wrap);
    input.focus();
  }

  function showAlert(msg, isError) {
    if (!alertEl) return;
    alertEl.textContent = msg;
    alertEl.classList.remove('hidden');
    alertEl.className = 'rounded-lg p-3 text-xs border ' + (isError ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-800');
    setTimeout(function () { alertEl.classList.add('hidden'); }, 5000);
  }

  function patchConta(contaId, dados) {
    return fetch('/unidades/' + unidadeId + '/contas-contabeis/' + contaId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(dados),
      credentials: 'same-origin'
    });
  }

  function postSubconta(parentId, nome, valor) {
    var payload = { parent_id: parentId ? parseInt(parentId, 10) : null, nome: nome };
    if (valor != null && valor > 0) payload.valor = valor;
    return fetch('/unidades/' + unidadeId + '/plano-contas/contas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'same-origin'
    });
  }

  function deleteConta(contaId) {
    return fetch('/unidades/' + unidadeId + '/contas-contabeis/' + contaId, {
      method: 'DELETE',
      headers: { 'Accept': 'application/json' },
      credentials: 'same-origin'
    });
  }

  function attachEditHandlers() {
    container.querySelectorAll('.plano-nome').forEach(function (input) {
      var contaId = input.dataset.contaId;
      var original = input.value;
      function save() {
        var v = input.value.trim();
        if (v === original) return;
        patchConta(contaId, { nome: v }).then(function (r) {
          return r.json().then(function (data) {
            if (!r.ok) {
              showAlert(data.mensagem || 'Erro ao salvar', true);
              input.value = original;
            }
          });
        }).catch(function () {
          showAlert('Erro ao salvar nome', true);
          input.value = original;
        });
      }
      input.addEventListener('blur', save);
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') input.blur(); });
    });

    container.querySelectorAll('.plano-valor').forEach(function (input) {
      var contaId = input.dataset.contaId;
      var originalRaw = parseFloat(input.dataset.raw) || 0;
      function save() {
        var raw = parseCurrency(input.value);
        if (raw === originalRaw) return;
        patchConta(contaId, { valor: raw }).then(function (r) {
          return r.json().then(function (data) {
            if (!r.ok) {
              if (data.erro === 'teto' && data.disponivel != null) {
                showAlert((data.mensagem || 'Valor excede o teto.') + ' Saldo disponível: ' + formatCurrency(data.disponivel), true);
              } else {
                showAlert(data.mensagem || 'Erro ao salvar valor', true);
              }
              input.value = formatCurrency(originalRaw);
              input.dataset.raw = originalRaw;
            } else {
              input.dataset.raw = raw;
              var dispEl = input.closest('.plano-card').querySelector('.text-slate-500');
              if (dispEl && data.conta) dispEl.textContent = 'DISPONÍVEL: ' + formatCurrency(data.conta.disponivel != null ? data.conta.disponivel : (data.conta.valor || 0));
            }
          });
        }).catch(function () {
          showAlert('Erro ao salvar valor', true);
          input.value = formatCurrency(originalRaw);
        });
      }
      input.addEventListener('blur', save);
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') input.blur(); });
    });
  }

  function onAddClick(ev) {
    var btn = ev.target.closest('.plano-add');
    if (!btn) return;
    var parentId = btn.dataset.contaId;
    var parentCard = btn.closest('.plano-card');
    var childrenContainer = parentCard ? parentCard.querySelector('.plano-children') : null;
    if (!childrenContainer) return;
    var depth = 0;
    var p = parentCard;
    while (p && p.classList && p.classList.contains('plano-card')) {
      depth++;
      p = p.parentElement && p.parentElement.closest('.plano-card');
    }
    showInlineCreateRow(childrenContainer, parentId, depth, false);
  }

  function attachDeleteHandlers() {
    container.querySelectorAll('.plano-del').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var contaId = btn.dataset.contaId;
        if (!window.confirm('Excluir esta conta e todas as subcontas? Esta ação não pode ser desfeita.')) return;
        deleteConta(contaId).then(function (r) {
          return r.json().then(function (data) {
            if (!r.ok) {
              showAlert(data.message || 'Erro ao excluir', true);
              return;
            }
            var card = btn.closest('.plano-card');
            if (card && card.parentNode) card.parentNode.removeChild(card);
          });
        }).catch(function () { showAlert('Erro ao excluir conta', true); });
      });
    });
  }

  function addNovaContaPrincipalBtn(targetEl) {
    if (!targetEl || !canEdit) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'px-3 py-2 rounded bg-cyan-600 text-white text-xs font-medium hover:bg-cyan-700';
    btn.textContent = '+ Nova conta principal';
    btn.addEventListener('click', function () {
      showInlineCreateRow(container, null, 0, true);
    });
    targetEl.appendChild(btn);
  }

  var addWrap = document.getElementById('plano-add-raiz-wrap');
  if (tree.length > 0 && canEdit) {
    if (addWrap) {
      addWrap.innerHTML = '';
      addNovaContaPrincipalBtn(addWrap);
    } else {
      var wrap = document.createElement('div');
      wrap.className = 'mb-3';
      addNovaContaPrincipalBtn(wrap);
      container.insertBefore(wrap, container.firstChild);
    }
  }

  tree.forEach(function (node) {
    container.appendChild(renderNode(node, 0));
  });

  if (tree.length === 0 && canEdit) {
    var emptyMsg = document.createElement('p');
    emptyMsg.className = 'text-slate-500 text-xs';
    emptyMsg.textContent = 'Nenhuma conta. Use a linha abaixo para criar a primeira conta principal.';
    container.appendChild(emptyMsg);
    showInlineCreateRow(container, null, 0, true);
  }

  container.addEventListener('click', onAddClick);
  attachEditHandlers();
  attachDeleteHandlers();
})();
