# TODO: Implementações para Melhorias no Gerenciador Financeiro

## Passos Lógicos Baseados no Plano Aprovado

- [x] **Atualizar HTML (Gerenciador Financeiro.html)**:
  - Corrigir rótulo da aba de "Entradas Gerais" para "Gastos e Entradas" (atualizar texto do botão).
  - Adicionar formulário "Adicionar Entrada" na aba gastos-gerais-tab (similar ao de despesas, mas sem categoria/paymentMethod obrigatórios, com type='income').
  - Adicionar seção "Extrato Financeiro" na resumo-tab, abaixo do dashboard: Incluir UI de filtros (dropdown para type: all/income/expense; category: all + opções; payment: all + opções; inputs para data from/to) e div para lista (id="statement-list").

- [x] **Atualizar JS (Gerenciador Financeiro.js)**:
  - Adicionar campo 'type' ('income' ou 'expense') ao schema de transaction.
  - Modificar addTransaction para aceitar type (default 'expense'); criar addIncome como wrapper.
  - Atualizar loadFromLocalStorage: Se monthlyInputs >0 e sem transações de income existentes, auto-criar transações iniciais de income (salary, investments, mealVoucher) com timestamp atual e description como "Entrada Mensal: [Tipo]".
  - Atualizar saveMonthlyInputs: Além de salvar, se valores mudarem, atualizar ou recriar transações de income correspondentes.
  - Atualizar calculateBalance: Somar incomes de transações (filter type='income') em vez de monthlyInputs fixos; manter monthlyInputs como fallback ou para reset mensal.
  - Implementar renderStatement: Combinar transações (incomes + expenses) + investments (como income), ordenar por timestamp desc, renderizar como timeline com data, description, type (cor verde/vermelho), value (positivo/negativo), running balance. Incluir delete buttons.
  - Adicionar handleFilters: Event listeners nos filtros para re-renderizar statement com filtros aplicados (e.g., filterFn baseada em selects/inputs).
  - Atualizar switchTab: Para 'resumo', chamar renderDashboard() + renderStatement().
  - Adicionar search input em listas existentes e statement para filtrar por description.
  - Opcional: Adicionar botão export CSV no statement (gerar e download simples).

- [x] **Atualizar CSS (Gerenciador Financeiro.css)**:
  - Adicionar estilos para .tab-button: transition: all 0.2s ease; hover: transform translateY(-1px), box-shadow; active: background #e0f2fe, border-radius top.
  - Estilos para statement items: Linhas alternadas, running balance col, filtro bar responsiva.

- [ ] **Testes e Verificações**:
  - Adicionar dados de teste (incomes/expenses via forms).
  - Testar switch tabs: Verificar re-render, placeholders em resumo se vazio.
  - Aplicar filtros no extrato: Verificar timeline, running balance, busca.
  - Verificar localStorage: Persistência de incomes, deletes.
  - Testar toggle values, mobile view.
  - Opcional: Usar browser_action para verificar UI.

- [ ] **Melhorias Gerais**:
  - Adicionar confirmações para deletes (confirm dialog).
  - Garantir placeholders: Em resumo, se sem transações, mostrar "Registre entradas e despesas para ver o extrato."
  - Priorizar: Extrato + filtros primeiro, depois polish (search/export).
