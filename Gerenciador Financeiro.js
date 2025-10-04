// Configurações e Variáveis Globais para IndexedDB
let userId = 'local-user';
let isAuthReady = true;

const DB_NAME = 'GerenciadorFinanceiroDB';
const DB_VERSION = 1;

const STATE = {
    monthlyInputs: { salary: 0, investments: 0, mealVoucher: 0 },
    transactions: [],
    investments: [],
    showValues: true, // Novo estado para controlar a visibilidade dos valores
    filters: { type: 'all', category: 'all', payment: 'all', from: '', to: '', search: '' }, // Filtros para extrato
};

const CATEGORIES = [
    { key: 'alimentacao', name: 'Alimentação', color: 'bg-red-500' },
    { key: 'moradia', name: 'Moradia/Contas', color: 'bg-blue-500' },
    { key: 'transporte', name: 'Transporte', color: 'bg-indigo-500' },
    { key: 'saude', name: 'Saúde', color: 'bg-green-500' },
    { key: 'lazer', name: 'Lazer', color: 'bg-yellow-500' },
    { key: 'educacao', name: 'Educação', color: 'bg-purple-500' },
    { key: 'outros', name: 'Outros', color: 'bg-gray-500' },
];

const PAYMENT_METHODS = [
    { key: 'dinheiro', name: 'Dinheiro' },
    { key: 'vale-alimentacao', name: 'Vale Alimentação' },
    { key: 'cartao', name: 'Cartão' },
    { key: 'outros', name: 'Outros' },
];

// Função de mapeamento de cores para D3 (precisa de cores hex)
const categoryColorMap = CATEGORIES.reduce((acc, cat) => {
    const colorMapping = {
        'bg-red-500': '#ef4444',
        'bg-blue-500': '#3b82f6',
        'bg-indigo-500': '#6366f1',
        'bg-green-500': '#10b981',
        'bg-yellow-500': '#f59e0b',
        'bg-purple-500': '#a855f7',
        'bg-gray-500': '#6b7280',
    };
    acc[cat.key] = colorMapping[cat.color] || '#000000';
    return acc;
}, {});


// --- Funções de Utilitários ---
const formatCurrency = (value) => {
    if (!STATE.showValues) {
        // Retorna asteriscos se os valores estiverem ocultos
        return 'R$ ****.**';
    }
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

// --- Funções de Armazenamento IndexedDB ---

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('data')) {
                db.createObjectStore('data');
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function loadFromIndexedDB() {
    const db = await openDB();
    const store = db.transaction('data').objectStore('data');

    // Load monthlyInputs
    const monthlyInputsRequest = store.get('monthlyInputs');
    monthlyInputsRequest.onsuccess = () => {
        if (monthlyInputsRequest.result) {
            STATE.monthlyInputs = monthlyInputsRequest.result;
        } else {
            // Try to migrate from localStorage
            const ls = localStorage.getItem('monthlyInputs');
            if (ls) {
                STATE.monthlyInputs = JSON.parse(ls);
                saveToDB('monthlyInputs', STATE.monthlyInputs);
            }
        }
    };

    // Load transactions
    const transactionsRequest = store.get('transactions');
    transactionsRequest.onsuccess = () => {
        if (transactionsRequest.result) {
            STATE.transactions = transactionsRequest.result.map(t => ({
                ...t,
                type: t.type || 'expense',
                timestamp: new Date(t.timestamp),
                paymentMethod: t.paymentMethod || 'dinheiro',
                category: t.category || 'outros'
            }));
        } else {
            // Migrate
            const ls = localStorage.getItem('transactions');
            if (ls) {
                STATE.transactions = JSON.parse(ls).map(t => ({
                    ...t,
                    type: t.type || 'expense',
                    timestamp: new Date(t.timestamp),
                    paymentMethod: t.paymentMethod || 'dinheiro',
                    category: t.category || 'outros'
                }));
                saveToDB('transactions', STATE.transactions);
            }
        }
    };

    // Load investments
    const investmentsRequest = store.get('investments');
    investmentsRequest.onsuccess = () => {
        if (investmentsRequest.result) {
            STATE.investments = investmentsRequest.result.map(i => ({
                ...i,
                timestamp: new Date(i.timestamp)
            }));
        } else {
            // Migrate
            const ls = localStorage.getItem('investments');
            if (ls) {
                STATE.investments = JSON.parse(ls).map(i => ({
                    ...i,
                    timestamp: new Date(i.timestamp)
                }));
                saveToDB('investments', STATE.investments);
            }
        }
    };

    // Wait for all loads
    await new Promise(resolve => {
        let count = 0;
        const check = () => {
            count++;
            if (count === 3) resolve();
        };
        monthlyInputsRequest.addEventListener('success', check);
        transactionsRequest.addEventListener('success', check);
        investmentsRequest.addEventListener('success', check);
    });

    db.close();

    // Auto-criar transações iniciais de income se monthlyInputs >0 e não há incomes
    const hasIncomes = STATE.transactions.some(t => t.type === 'income');
    if (!hasIncomes && (STATE.monthlyInputs.salary > 0 || STATE.monthlyInputs.investments > 0 || STATE.monthlyInputs.mealVoucher > 0)) {
        (async () => {
            if (STATE.monthlyInputs.salary > 0) {
                await addTransaction('Entrada Mensal: Salário', STATE.monthlyInputs.salary, '', '', 'income');
            }
            if (STATE.monthlyInputs.investments > 0) {
                await addTransaction('Entrada Mensal: Investimentos', STATE.monthlyInputs.investments, '', '', 'income');
            }
            if (STATE.monthlyInputs.mealVoucher > 0) {
                await addTransaction('Entrada Mensal: Vale Refeição', STATE.monthlyInputs.mealVoucher, '', 'vale-alimentacao', 'income');
            }
        })();
    }

    renderDashboard();
    renderInputForms();
    renderTransactionList();
    renderValeBalance();
    renderInvestmentsList();
    populateFilterOptions();
    if (document.getElementById('resumo-tab').classList.contains('hidden') === false) {
        renderStatement();
    }
}

async function saveToDB(key, value) {
    const db = await openDB();
    const store = db.transaction('data', 'readwrite').objectStore('data');
    store.put(value, key);
    db.close();
}

async function saveMonthlyInputs(salary, investments, mealVoucher) {
    const oldSalary = STATE.monthlyInputs.salary;
    const oldInvestments = STATE.monthlyInputs.investments;
    const oldMealVoucher = STATE.monthlyInputs.mealVoucher;

    if (salary !== '') STATE.monthlyInputs.salary = parseFloat(salary) || 0;
    if (investments !== '') STATE.monthlyInputs.investments = parseFloat(investments) || 0;
    if (mealVoucher !== '') STATE.monthlyInputs.mealVoucher = parseFloat(mealVoucher) || 0;

    await saveToDB('monthlyInputs', STATE.monthlyInputs);

    // Atualizar transações iniciais se valores mudaram
    if (oldSalary !== STATE.monthlyInputs.salary) {
        await updateMonthlyTransaction('Entrada Mensal: Salário', STATE.monthlyInputs.salary);
    }
    if (oldInvestments !== STATE.monthlyInputs.investments) {
        await updateMonthlyTransaction('Entrada Mensal: Investimentos', STATE.monthlyInputs.investments);
    }
    if (oldMealVoucher !== STATE.monthlyInputs.mealVoucher) {
        await updateMonthlyTransaction('Entrada Mensal: Vale Refeição', STATE.monthlyInputs.mealVoucher);
    }

    renderDashboard();
    renderInputForms();
    console.log("Entradas mensais atualizadas com sucesso.");
}

async function updateMonthlyTransaction(description, value) {
    const existing = STATE.transactions.find(t => t.description === description && t.type === 'income');
    if (existing) {
        existing.value = value;
    } else if (value > 0) {
        await addTransaction(description, value, '', '', 'income');
    }
    await saveToDB('transactions', STATE.transactions);
    renderDashboard();
    renderStatement();
}

async function addTransaction(description, value, category, paymentMethod, type = 'expense') {
    const transaction = {
        id: Date.now().toString(),
        description: description,
        value: parseFloat(value) || 0,
        category: category || 'outros',
        paymentMethod: paymentMethod || 'dinheiro',
        type: type,
        timestamp: new Date(),
    };
    STATE.transactions.unshift(transaction); // Adiciona no início para ordem desc
    await saveToDB('transactions', STATE.transactions);
    renderDashboard();
    renderTransactionList();
    renderValeBalance();
    renderStatement();
    console.log("Transação adicionada com sucesso.");
}

function addIncome(description, value, category = '', paymentMethod = '') {
    addTransaction(description, value, category, paymentMethod, 'income');
}

async function deleteTransaction(id) {
    if (!confirm('Tem certeza que deseja excluir esta transação?')) return;
    STATE.transactions = STATE.transactions.filter(t => t.id !== id);
    await saveToDB('transactions', STATE.transactions);
    renderDashboard();
    renderTransactionList();
    renderStatement();
    console.log("Transação excluída com sucesso:", id);
}

async function addInvestment(description, value) {
    const investment = {
        id: Date.now().toString(),
        description: description,
        value: parseFloat(value) || 0,
        timestamp: new Date(),
    };
    STATE.investments.unshift(investment); // Adiciona no início para ordem desc
    await saveToDB('investments', STATE.investments);
    renderInvestmentsList();
    console.log("Investimento adicionado com sucesso.");
}

async function deleteInvestment(id) {
    STATE.investments = STATE.investments.filter(i => i.id !== id);
    await saveToDB('investments', STATE.investments);
    renderInvestmentsList();
    console.log("Investimento excluído com sucesso:", id);
}

// --- Funções de Toggle de Valores ---

function toggleValueVisibility() {
    STATE.showValues = !STATE.showValues;
    // Re-renderiza todos os componentes que exibem valores
    renderDashboard();
    renderTransactionList();
    updateToggleIcon();
    // renderInputForms() não é necessário pois ele apenas define os valores numéricos dos inputs.
}

function updateToggleIcon() {
    const btn = document.getElementById('toggle-values-btn');
    if (!btn) return;
    
    // Ícone de olho aberto (valores visíveis)
    const openEyeIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.016 12C3.266 7.6 7.216 4 12.016 4C16.816 4 20.766 7.6 22.016 12C20.766 16.4 16.816 20 12.016 20C7.216 20 3.266 16.4 2.016 12Z"/><circle cx="12.016" cy="12" r="3"/></svg>`;
    // Ícone de olho fechado (valores ocultos)
    const closedEyeIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-5.16 0-9.58-3.75-10.71-8 1.13-4.25 5.55-8 10.71-8a10.07 10.07 0 0 1 5.94 2.06M12 7a5 5 0 0 0-5 5M2 2l20 20M15 12a3 3 0 0 0-3-3"/></svg>`;
    
    btn.innerHTML = STATE.showValues ? openEyeIcon : closedEyeIcon;
}


// --- Funções de Renderização ---

function calculateBalance() {
    const totalIncome = STATE.transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.value, 0) +
                        STATE.investments.reduce((sum, i) => sum + i.value, 0);
    const totalExpenses = STATE.transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.value, 0);
    const balance = totalIncome - totalExpenses;
    
    // Calcula o resumo por categoria para despesas
    const categorySummary = STATE.transactions.filter(t => t.type === 'expense').reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.value;
        return acc;
    }, {});

    return { totalIncome, totalExpenses, balance, categorySummary };
}

function renderDonutChart(categorySummary, totalExpenses) {
    const chartData = CATEGORIES
        .map(cat => ({
            key: cat.key,
            name: cat.name,
            value: categorySummary[cat.key] || 0
        }))
        .filter(d => d.value > 0); // Remove categorias sem despesas

    const container = document.getElementById('expense-chart-container');
    if (!container) return;

    // Limpa o container para evitar gráficos duplicados
    container.innerHTML = '';
    
    if (chartData.length === 0 || totalExpenses === 0) {
         container.innerHTML = '<p class="text-center text-gray-500 p-4">Registre despesas para visualizar o gráfico de distribuição.</p>';
         return;
    }

    // Configurações do gráfico
    const width = container.clientWidth;
    const height = 300;
    const radius = Math.min(width, height) / 2 - 10;

    const svg = d3.select(container)
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("class", "mx-auto")
        .append("g")
        .attr("transform", `translate(${width / 2}, ${height / 2})`);

    const pie = d3.pie()
        .value(d => d.value)
        .sort(null);

    const arc = d3.arc()
        .innerRadius(radius * 0.6)
        .outerRadius(radius * 0.9);

    const arcs = svg.selectAll("arc")
        .data(pie(chartData))
        .enter()
        .append("g")
        .attr("class", "arc");

    arcs.append("path")
        .attr("d", arc)
        .attr("fill", d => categoryColorMap[d.data.key])
        .attr("stroke", "white")
        .style("stroke-width", "2px")
        .transition()
        .duration(700)
        .attrTween("d", function(d) {
            const i = d3.interpolate(d.startAngle, d.endAngle);
            return function(t) {
                d.endAngle = i(t);
                return arc(d);
            }
        });
        
    // Adiciona rótulos percentuais no gráfico (se houver espaço)
    if (STATE.showValues) {
        arcs.append("text")
            .attr("transform", d => `translate(${arc.centroid(d)})`)
            .attr("text-anchor", "middle")
            .attr("dy", "0.35em")
            .style("fill", "white")
            .style("font-size", "10px")
            .style("pointer-events", "none")
            .text(d => {
                const percent = (d.data.value / totalExpenses) * 100;
                return percent > 5 ? `${Math.round(percent)}%` : ''; 
            });
    }
}


function renderDashboard() {
    const { totalIncome, totalExpenses, balance, categorySummary } = calculateBalance();

    const dashboardEl = document.getElementById('dashboard');
    let distributionSection = '';

    if (totalExpenses === 0) {
        // Layout compacto quando não há despesas
        distributionSection = `
            <div class="bg-white p-6 rounded-xl shadow-lg text-center">
                <h3 class="text-xl font-semibold text-gray-800 mb-4 pb-2">Distribuição de Despesas</h3>
                <p class="text-gray-500">Registre despesas para visualizar a distribuição.</p>
            </div>
        `;
    } else {
        // Layout completo com duas colunas
        distributionSection = `
            <div class="bg-white p-6 rounded-xl shadow-lg grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                
                <!-- Coluna 1: Gráfico Donut -->
                <div>
                    <h3 class="text-xl font-semibold text-gray-800 mb-4 pb-2">Distribuição de Despesas</h3>
                    <div id="expense-chart-container" class="w-full h-72">
                        <!-- Gráfico D3 será renderizado aqui -->
                    </div>
                </div>

                <!-- Coluna 2: Lista Resumo por Categoria -->
                <div>
                    <h3 class="text-xl font-semibold text-gray-800 mb-4 pb-2 border-b">Detalhes da Distribuição</h3>
                    <div class="space-y-3 max-h-72 overflow-y-auto pr-2">
                        ${CATEGORIES.map(cat => {
                            const total = categorySummary[cat.key] || 0;
                            const percentage = (total / totalExpenses) * 100;
                            const colorClass = cat.color;
                            return `
                                <div class="flex items-center justify-between space-x-3">
                                    <div class="flex items-center space-x-2">
                                        <div class="w-3 h-3 rounded-full ${colorClass}"></div>
                                        <div class="text-sm font-medium text-gray-700">${cat.name}</div>
                                    </div>
                                    <div class="text-right">
                                        <span class="text-sm font-bold text-gray-900">${formatCurrency(total)}</span>
                                        <span class="text-xs text-gray-500 ml-2">(${percentage.toFixed(1)}%)</span>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    dashboardEl.innerHTML = `
        <!-- Cards de Saldo -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <!-- Card 1: Entradas Totais -->
            <div class="bg-white p-5 rounded-xl shadow-lg border-b-4 border-indigo-500 transition duration-300 hover:shadow-xl">
                <p class="text-sm font-medium text-gray-500">Entradas Mensais (Estimado)</p>
                <p class="text-2xl font-bold text-indigo-700 mt-1">${formatCurrency(totalIncome)}</p>
            </div>
            
            <!-- Card 2: Despesas Totais -->
            <div class="bg-white p-5 rounded-xl shadow-lg border-b-4 border-red-500 transition duration-300 hover:shadow-xl">
                <p class="text-sm font-medium text-gray-500">Despesas Registradas</p>
                <p class="text-2xl font-bold text-red-600 mt-1">${formatCurrency(totalExpenses)}</p>
            </div>
            
            <!-- Card 3: Saldo Final -->
            <div class="bg-white p-5 rounded-xl shadow-lg border-b-4 ${balance >= 0 ? 'border-green-500' : 'border-gray-400'} transition duration-300 hover:shadow-xl">
                <p class="text-sm font-medium text-gray-500">Saldo Atual</p>
                <p class="text-2xl font-bold ${balance >= 0 ? 'text-green-700' : 'text-gray-700'} mt-1">${formatCurrency(balance)}</p>
            </div>
        </div>
        
        ${distributionSection}
    `;

    // Renderiza o gráfico apenas se houver despesas
    if (totalExpenses > 0) {
        renderDonutChart(categorySummary, totalExpenses);
    }
}

function renderInputForms() {
    const inputs = STATE.monthlyInputs;
    document.getElementById('salario').value = inputs.salary || '';
    document.getElementById('investimentos').value = inputs.investments || '';
    document.getElementById('vale-refeicao').value = inputs.mealVoucher || '';

    // Renderiza as categorias no select do formulário de despesa
    const expenseCategorySelect = document.getElementById('expense-category');
    if (expenseCategorySelect && expenseCategorySelect.options.length === 0) {
         CATEGORIES.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.key;
            option.textContent = cat.name;
            expenseCategorySelect.appendChild(option);
        });
    }

    // Renderiza os métodos de pagamento no select do formulário de despesa
    const expensePaymentSelect = document.getElementById('expense-payment-method');
    if (expensePaymentSelect && expensePaymentSelect.options.length === 0) {
         PAYMENT_METHODS.forEach(method => {
            const option = document.createElement('option');
            option.value = method.key;
            option.textContent = method.name;
            expensePaymentSelect.appendChild(option);
        });
    }

    // Para income form (opcional)
    const incomeCategorySelect = document.getElementById('income-category');
    if (incomeCategorySelect && incomeCategorySelect.options.length <= 1) {
        const noneOption = incomeCategorySelect.querySelector('option[value=""]');
        CATEGORIES.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.key;
            option.textContent = cat.name;
            incomeCategorySelect.appendChild(option);
        });
    }

    const incomePaymentSelect = document.getElementById('income-payment-method');
    if (incomePaymentSelect && incomePaymentSelect.options.length <= 1) {
        const noneOption = incomePaymentSelect.querySelector('option[value=""]');
        PAYMENT_METHODS.forEach(method => {
            const option = document.createElement('option');
            option.value = method.key;
            option.textContent = method.name;
            incomePaymentSelect.appendChild(option);
        });
    }
}

function populateFilterOptions() {
    const filterCategory = document.getElementById('filter-category');
    if (filterCategory && filterCategory.options.length <= 1) {
        const allOption = filterCategory.querySelector('option[value="all"]');
        CATEGORIES.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.key;
            option.textContent = cat.name;
            filterCategory.appendChild(option);
        });
    }

    const filterPayment = document.getElementById('filter-payment');
    if (filterPayment && filterPayment.options.length <= 1) {
        const allOption = filterPayment.querySelector('option[value="all"]');
        PAYMENT_METHODS.forEach(method => {
            const option = document.createElement('option');
            option.value = method.key;
            option.textContent = method.name;
            filterPayment.appendChild(option);
        });
    }
}

function renderValeBalance() {
    const valeTransactions = STATE.transactions.filter(t => t.paymentMethod === 'vale-alimentacao');
    const totalValeSpent = valeTransactions.reduce((sum, t) => sum + t.value, 0);
    const valeBalance = STATE.monthlyInputs.mealVoucher - totalValeSpent;

    const valeBalanceEl = document.getElementById('vale-balance');
    if (valeBalanceEl) {
        valeBalanceEl.textContent = formatCurrency(valeBalance);
    }
}

function renderTransactionList(filterFn = null) {
    const listEl = document.getElementById('transaction-list');
    if (listEl) {
        listEl.innerHTML = ''; // Limpa a lista antes de renderizar

        let transactionsToShow = STATE.transactions.filter(t => t.type === 'expense'); // Apenas despesas para esta lista
        if (filterFn) {
            transactionsToShow = transactionsToShow.filter(filterFn);
        }

        if (transactionsToShow.length === 0) {
            listEl.innerHTML = '<p class="text-center text-gray-500 py-4">Nenhuma despesa registrada ainda.</p>';
            return;
        }

        const items = transactionsToShow.map(t => {
            const category = CATEGORIES.find(c => c.key === t.category);
            const colorClass = category ? category.color : 'bg-gray-500';
            const categoryName = category ? category.name : 'Desconhecida';
            const paymentMethod = PAYMENT_METHODS.find(m => m.key === t.paymentMethod);
            const paymentMethodName = paymentMethod ? paymentMethod.name : 'Desconhecido';
            const dateString = t.timestamp instanceof Date && !isNaN(t.timestamp) ? t.timestamp.toLocaleDateString('pt-BR') : 'Sem data';

            return `
                <li class="flex justify-between items-center p-4 bg-white rounded-lg shadow-sm border-l-4 ${colorClass.replace('bg-', 'border-')}">
                    <div class="flex-1 min-w-0">
                        <p class="text-gray-800 font-semibold truncate">${t.description}</p>
                        <p class="text-sm text-gray-500">
                            <span class="font-medium ${colorClass.replace('bg-', 'text-')}">${categoryName}</span>
                            <span class="ml-2 text-xs">(${dateString})</span>
                            <span class="ml-2 text-xs bg-gray-100 px-2 py-1 rounded">${paymentMethodName}</span>
                        </p>
                    </div>
                    <div class="flex items-center space-x-3">
                        <span class="text-lg font-bold text-red-600">${formatCurrency(t.value)}</span>
                        <button onclick="deleteTransaction('${t.id}')" class="text-gray-400 hover:text-red-500 p-1 rounded-full transition duration-150" aria-label="Excluir transação">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 10-2 0v6a1 1 0 102 0V8z" clip-rule="evenodd" />
                            </svg>
                        </button>
                    </div>
                </li>
            `;
        }).join('');

        listEl.innerHTML = `<ul class="space-y-3">${items}</ul>`;
    }

    // Renderizar lista específica para Vale Alimentação (apenas despesas)
    const valeListEl = document.getElementById('transaction-list-vale');
    if (valeListEl) {
        valeListEl.innerHTML = ''; // Limpa a lista antes de renderizar

        const valeTransactions = STATE.transactions.filter(t => t.type === 'expense' && t.paymentMethod === 'vale-alimentacao');

        if (valeTransactions.length === 0) {
            valeListEl.innerHTML = '<p class="text-center text-gray-500 py-4">Nenhuma despesa com Vale Alimentação registrada ainda.</p>';
            return;
        }

        const valeItems = valeTransactions.map(t => {
            const category = CATEGORIES.find(c => c.key === t.category);
            const colorClass = category ? category.color : 'bg-gray-500';
            const categoryName = category ? category.name : 'Desconhecida';
            const dateString = t.timestamp instanceof Date && !isNaN(t.timestamp) ? t.timestamp.toLocaleDateString('pt-BR') : 'Sem data';

            return `
                <li class="flex justify-between items-center p-4 bg-white rounded-lg shadow-sm border-l-4 ${colorClass.replace('bg-', 'border-')}">
                    <div class="flex-1 min-w-0">
                        <p class="text-gray-800 font-semibold truncate">${t.description}</p>
                        <p class="text-sm text-gray-500">
                            <span class="font-medium ${colorClass.replace('bg-', 'text-')}">${categoryName}</span>
                            <span class="ml-2 text-xs">(${dateString})</span>
                        </p>
                    </div>
                    <div class="flex items-center space-x-3">
                        <span class="text-lg font-bold text-red-600">${formatCurrency(t.value)}</span>
                        <button onclick="deleteTransaction('${t.id}')" class="text-gray-400 hover:text-red-500 p-1 rounded-full transition duration-150" aria-label="Excluir transação">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 10-2 0v6a1 1 0 102 0V8z" clip-rule="evenodd" />
                            </svg>
                        </button>
                    </div>
                </li>
            `;
        }).join('');

        valeListEl.innerHTML = `<ul class="space-y-3">${valeItems}</ul>`;
    }
}

function renderStatement() {
    const listEl = document.getElementById('statement-list');
    if (!listEl) return;

    // Combinar transações e investimentos
    let allItems = [
        ...STATE.transactions.map(t => ({ ...t, isInvestment: false })),
        ...STATE.investments.map(i => ({ ...i, type: 'income', isInvestment: true, category: '', paymentMethod: '' }))
    ];

    // Aplicar filtros
    let filteredItems = allItems.filter(item => {
        if (STATE.filters.type !== 'all' && item.type !== STATE.filters.type) return false;
        if (STATE.filters.category !== 'all' && item.category !== STATE.filters.category) return false;
        if (STATE.filters.payment !== 'all' && item.paymentMethod !== STATE.filters.payment) return false;
        if (STATE.filters.search && !item.description.toLowerCase().includes(STATE.filters.search.toLowerCase())) return false;
        if (STATE.filters.from) {
            const fromDate = new Date(STATE.filters.from);
            if (item.timestamp < fromDate) return false;
        }
        if (STATE.filters.to) {
            const toDate = new Date(STATE.filters.to);
            toDate.setHours(23, 59, 59, 999);
            if (item.timestamp > toDate) return false;
        }
        return true;
    });

    if (filteredItems.length === 0) {
        listEl.innerHTML = '<p class="text-center text-gray-500 py-8">Nenhuma transação encontrada com os filtros aplicados.</p>';
        return;
    }

    // Ordenar por timestamp desc (mais recente primeiro)
    filteredItems.sort((a, b) => b.timestamp - a.timestamp);

    // Calcular running balance: Para display desc, calcular do total atual para trás
    const { balance: currentBalance } = calculateBalance();
    let runningBalance = currentBalance;
    filteredItems.forEach(item => {
        const signedValue = item.type === 'income' ? item.value : -item.value;
        item.runningBalance = runningBalance;
        runningBalance -= signedValue; // Subtrai o valor da transação para o anterior
    });

    // Inverter para display desc com running balance correto (agora runningBalance é o balance ANTES da transação? Wait, adjust.
    // Actually, for statement: running balance is AFTER the transaction.
    // So, better: sort asc, compute cumulative forward, then reverse array.
    filteredItems.sort((a, b) => a.timestamp - b.timestamp); // Asc
    let cumulative = 0;
    filteredItems.forEach(item => {
        const signedValue = item.type === 'income' ? item.value : -item.value;
        cumulative += signedValue;
        item.runningBalance = cumulative;
    });
    filteredItems.reverse(); // Now desc, with runningBalance as after each (from oldest)

    const items = filteredItems.map((item, index) => {
        const category = CATEGORIES.find(c => c.key === item.category);
        const colorClass = item.type === 'income' ? 'bg-green-500' : (category ? category.color : 'bg-gray-500');
        const categoryName = item.type === 'income' ? (category ? category.name : 'Entrada') : (category ? category.name : 'Desconhecida');
        const paymentMethod = PAYMENT_METHODS.find(m => m.key === item.paymentMethod);
        const paymentMethodName = paymentMethod ? paymentMethod.name : '';
        const dateString = item.timestamp instanceof Date && !isNaN(item.timestamp) ? item.timestamp.toLocaleDateString('pt-BR') : 'Sem data';
        const valueSign = item.type === 'income' ? '+' : '-';
        const valueColor = item.type === 'income' ? 'text-green-600' : 'text-red-600';
        const borderColor = colorClass.replace('bg-', 'border-');

        return `
            <div class="p-4 border-b border-gray-100 ${index % 2 === 0 ? 'bg-gray-50' : ''}">
                <div class="flex justify-between items-center">
                    <div class="flex-1">
                        <p class="text-gray-800 font-semibold">${item.description}</p>
                        <p class="text-sm text-gray-500">
                            <span class="font-medium ${colorClass.replace('bg-', 'text-')}">${categoryName}</span>
                            ${paymentMethodName ? `<span class="ml-2 text-xs bg-gray-100 px-2 py-1 rounded">${paymentMethodName}</span>` : ''}
                            <span class="ml-2 text-xs">(${dateString})</span>
                            ${item.isInvestment ? '<span class="ml-2 text-xs bg-blue-100 px-2 py-1 rounded text-blue-800">Investimento</span>' : ''}
                        </p>
                    </div>
                    <div class="text-right">
                        <span class="text-lg font-bold ${valueColor}">${valueSign}${formatCurrency(item.value)}</span>
                        <p class="text-sm text-gray-600 mt-1">Saldo: ${formatCurrency(item.runningBalance)}</p>
                    </div>
                    ${!item.isInvestment ? `
                    <button onclick="deleteTransaction('${item.id}')" class="text-gray-400 hover:text-red-500 p-1 rounded-full transition duration-150 ml-3" aria-label="Excluir">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 10-2 0v6a1 1 0 102 0V8z" clip-rule="evenodd" />
                        </svg>
                    </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');

    listEl.innerHTML = `
        <div class="overflow-x-auto">
            <div class="min-w-full">
                ${items}
            </div>
        </div>
        <div class="p-4 bg-gray-100 font-bold text-right">
            Saldo Final: ${formatCurrency(calculateBalance().balance)}
        </div>
    `;
}

function applyFilters() {
    STATE.filters.type = document.getElementById('filter-type')?.value || 'all';
    STATE.filters.category = document.getElementById('filter-category')?.value || 'all';
    STATE.filters.payment = document.getElementById('filter-payment')?.value || 'all';
    STATE.filters.from = document.getElementById('filter-from')?.value || '';
    STATE.filters.to = document.getElementById('filter-to')?.value || '';
    STATE.filters.search = document.getElementById('search-description')?.value || '';

    // Listener para search real-time
    document.getElementById('search-description')?.addEventListener('input', applyFilters);

    renderStatement();
}

function exportStatement() {
    applyFilters(); // Apply current filters
    // Reuse the filtered logic from renderStatement
    let allItems = [
        ...STATE.transactions.map(t => ({ ...t, isInvestment: false })),
        ...STATE.investments.map(i => ({ ...i, type: 'income', isInvestment: true, category: '', paymentMethod: '' }))
    ];
    let filtered = allItems.filter(item => {
        // Same filter logic as renderStatement
        if (STATE.filters.type !== 'all' && item.type !== STATE.filters.type) return false;
        if (STATE.filters.category !== 'all' && item.category !== STATE.filters.category) return false;
        if (STATE.filters.payment !== 'all' && item.paymentMethod !== STATE.filters.payment) return false;
        if (STATE.filters.search && !item.description.toLowerCase().includes(STATE.filters.search.toLowerCase())) return false;
        if (STATE.filters.from) {
            const fromDate = new Date(STATE.filters.from);
            if (item.timestamp < fromDate) return false;
        }
        if (STATE.filters.to) {
            const toDate = new Date(STATE.filters.to);
            toDate.setHours(23, 59, 59, 999);
            if (item.timestamp > toDate) return false;
        }
        return true;
    });

    // Compute running balance like in renderStatement
    filtered.sort((a, b) => a.timestamp - b.timestamp); // Asc
    let cumulative = 0;
    filtered.forEach(item => {
        const signedValue = item.type === 'income' ? item.value : -item.value;
        cumulative += signedValue;
        item.runningBalance = cumulative;
    });
    filtered.sort((a, b) => b.timestamp - a.timestamp); // Desc for output

    let csv = 'Data,Descrição,Tipo,Valor,Categoria,Pagamento,Saldo\n';
    filtered.forEach(item => {
        const date = item.timestamp.toLocaleDateString('pt-BR');
        const type = item.type;
        const value = item.type === 'income' ? `+${item.value}` : `-${item.value}`;
        const category = item.category || '';
        const payment = item.paymentMethod || '';
        const balance = formatCurrency(item.runningBalance || 0);
        csv += `"${date}","${item.description}","${type}","${value}","${category}","${payment}","${balance}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'extrato-financeiro.csv';
    a.click();
    window.URL.revokeObjectURL(url);
}

function renderInvestmentsList() {
    const listEl = document.getElementById('investment-list');
    if (listEl) {
        listEl.innerHTML = ''; // Limpa a lista antes de renderizar

        if (STATE.investments.length === 0) {
            listEl.innerHTML = '<p class="text-center text-gray-500 py-4">Nenhum investimento registrado ainda.</p>';
            return;
        }

        const items = STATE.investments.map(i => {
            const dateString = i.timestamp instanceof Date && !isNaN(i.timestamp) ? i.timestamp.toLocaleDateString('pt-BR') : 'Sem data';

            return `
                <li class="flex justify-between items-center p-4 bg-white rounded-lg shadow-sm border-l-4 border-green-500">
                    <div class="flex-1 min-w-0">
                        <p class="text-gray-800 font-semibold truncate">${i.description}</p>
                        <p class="text-sm text-gray-500">
                            <span class="text-xs">(${dateString})</span>
                        </p>
                    </div>
                    <div class="flex items-center space-x-3">
                        <span class="text-lg font-bold text-green-600">${formatCurrency(i.value)}</span>
                        <button onclick="deleteInvestment('${i.id}')" class="text-gray-400 hover:text-red-500 p-1 rounded-full transition duration-150" aria-label="Excluir investimento">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 10-2 0v6a1 1 0 102 0V8z" clip-rule="evenodd" />
                            </svg>
                        </button>
                    </div>
                </li>
            `;
        }).join('');

        listEl.innerHTML = `<ul class="space-y-3">${items}</ul>`;
    }
}

// --- Event Handlers (Funções que interagem com o DOM) ---

function handleInputFormSubmit(event) {
    event.preventDefault();
    const salary = document.getElementById('salario').value.trim();
    const investments = document.getElementById('investimentos').value.trim();
    const mealVoucher = document.getElementById('vale-refeicao').value.trim();

    // Validação: apenas os campos preenchidos devem ser números válidos
    let hasError = false;
    if (salary && isNaN(parseFloat(salary))) hasError = true;
    if (investments && isNaN(parseFloat(investments))) hasError = true;
    if (mealVoucher && isNaN(parseFloat(mealVoucher))) hasError = true;

    if (hasError) {
        document.getElementById('input-message').textContent = 'Por favor, insira números válidos para os campos preenchidos.';
        document.getElementById('input-message').classList.remove('hidden', 'text-green-500');
        document.getElementById('input-message').classList.add('text-red-500');
        return;
    }

    if (!salary && !investments && !mealVoucher) {
        document.getElementById('input-message').textContent = 'Preencha pelo menos um campo para salvar.';
        document.getElementById('input-message').classList.remove('hidden', 'text-green-500');
        document.getElementById('input-message').classList.add('text-red-500');
        return;
    }

    saveMonthlyInputs(salary, investments, mealVoucher);
    document.getElementById('input-message').textContent = 'Entradas atualizadas com sucesso!';
    document.getElementById('input-message').classList.remove('hidden', 'text-red-500');
    document.getElementById('input-message').classList.add('text-green-500');
    setTimeout(() => document.getElementById('input-message').classList.add('hidden'), 3000);
}

function handleExpenseFormSubmit(event) {
    event.preventDefault();
    
    const descriptionEl = document.getElementById('expense-description');
    const valueEl = document.getElementById('expense-value');
    const categoryEl = document.getElementById('expense-category');
    const paymentMethodEl = document.getElementById('expense-payment-method');

    const description = descriptionEl.value.trim();
    const value = valueEl.value;
    const category = categoryEl.value;
    const paymentMethod = paymentMethodEl.value;

    // Validação
    if (!description || !value || !category || !paymentMethod || isNaN(parseFloat(value)) || parseFloat(value) <= 0) {
        document.getElementById('expense-message').textContent = 'Preencha todos os campos com valores válidos.';
        document.getElementById('expense-message').classList.remove('hidden', 'text-green-500');
        document.getElementById('expense-message').classList.add('text-red-500');
        return;
    }
    
    addTransaction(description, value, category, paymentMethod);

    // Limpa formulário
    descriptionEl.value = '';
    valueEl.value = '';
    categoryEl.value = CATEGORIES[0].key; // Reseta para a primeira categoria
    paymentMethodEl.value = PAYMENT_METHODS[0].key; // Reseta para o primeiro método

    document.getElementById('expense-message').textContent = 'Despesa registrada com sucesso!';
    document.getElementById('expense-message').classList.remove('hidden', 'text-red-500');
    document.getElementById('expense-message').classList.add('text-green-500');
    setTimeout(() => document.getElementById('expense-message').classList.add('hidden'), 3000);
}

function handleIncomeFormSubmit(event) {
    event.preventDefault();
    
    const descriptionEl = document.getElementById('income-description');
    const valueEl = document.getElementById('income-value');
    const categoryEl = document.getElementById('income-category');
    const paymentMethodEl = document.getElementById('income-payment-method');

    const description = descriptionEl.value.trim();
    const value = valueEl.value;
    const category = categoryEl.value || '';
    const paymentMethod = paymentMethodEl.value || '';

    // Validação
    if (!description || !value || isNaN(parseFloat(value)) || parseFloat(value) <= 0) {
        document.getElementById('income-message').textContent = 'Preencha descrição e valor válidos.';
        document.getElementById('income-message').classList.remove('hidden', 'text-green-500');
        document.getElementById('income-message').classList.add('text-red-500');
        return;
    }
    
    addIncome(description, value, category, paymentMethod);

    // Limpa formulário
    descriptionEl.value = '';
    valueEl.value = '';
    categoryEl.value = '';
    paymentMethodEl.value = '';

    document.getElementById('income-message').textContent = 'Entrada registrada com sucesso!';
    document.getElementById('income-message').classList.remove('hidden', 'text-red-500');
    document.getElementById('income-message').classList.add('text-green-500');
    setTimeout(() => document.getElementById('income-message').classList.add('hidden'), 3000);
}

function handleInvestmentFormSubmit(event) {
    event.preventDefault();

    const descriptionEl = document.getElementById('investment-description');
    const valueEl = document.getElementById('investment-value');

    const description = descriptionEl.value.trim();
    const value = valueEl.value;

    // Validação
    if (!description || !value || isNaN(parseFloat(value)) || parseFloat(value) <= 0) {
        document.getElementById('investment-message').textContent = 'Preencha todos os campos com valores válidos.';
        document.getElementById('investment-message').classList.remove('hidden', 'text-green-500');
        document.getElementById('investment-message').classList.add('text-red-500');
        return;
    }

    addInvestment(description, value);

    // Limpa formulário
    descriptionEl.value = '';
    valueEl.value = '';

    document.getElementById('investment-message').textContent = 'Investimento registrado com sucesso!';
    document.getElementById('investment-message').classList.remove('hidden', 'text-red-500');
    document.getElementById('investment-message').classList.add('text-green-500');
    setTimeout(() => document.getElementById('investment-message').classList.add('hidden'), 3000);
}

// --- Função de Navegação de Abas ---

function switchTab(tabName) {
    // Remove a classe 'active' de todos os botões de aba
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(btn => btn.classList.remove('active'));

    // Adiciona a classe 'active' ao botão clicado
    const activeButton = document.getElementById(`tab-${tabName}`);
    if (activeButton) {
        activeButton.classList.add('active');
    }

    // Esconde todas as abas
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => content.classList.add('hidden'));

    // Mostra a aba selecionada
    const activeTab = document.getElementById(`${tabName}-tab`);
    if (activeTab) {
        activeTab.classList.remove('hidden');
    }

    // Re-renderiza conteúdo específico por aba
    if (tabName === 'resumo') {
        renderDashboard();
        renderStatement();
    } else if (tabName === 'gastos-gerais') {
        applyTransactionSearch();
    } else if (tabName === 'vale-alimentacao') {
        applyValeSearch();
        renderValeBalance();
    } else if (tabName === 'investimentos') {
        renderInvestmentsList();
    }
}

// Expondo as funções globais
window.deleteTransaction = deleteTransaction;
window.toggleValueVisibility = toggleValueVisibility;
window.switchTab = switchTab;

// --- Funções de Busca ---

function applyTransactionSearch() {
    const searchValue = document.getElementById('transaction-search')?.value.toLowerCase() || '';
    const filterFn = searchValue ? (t) => t.description.toLowerCase().includes(searchValue) : null;
    renderTransactionList(filterFn);
}

function applyValeSearch() {
    const searchValue = document.getElementById('vale-search')?.value.toLowerCase() || '';
    const filterFn = searchValue ? (t) => t.description.toLowerCase().includes(searchValue) : null;
    renderTransactionList(filterFn); // For vale, it's the same list but filtered
}

// --- Inicialização ---

window.onload = () => {
    loadFromIndexedDB();
    document.getElementById('input-form').addEventListener('submit', handleInputFormSubmit);
    document.getElementById('expense-form').addEventListener('submit', handleExpenseFormSubmit);
    document.getElementById('income-form').addEventListener('submit', handleIncomeFormSubmit);
    document.getElementById('investment-form').addEventListener('submit', handleInvestmentFormSubmit);
    document.getElementById('toggle-values-btn').addEventListener('click', toggleValueVisibility); // Listener do botão de segurança

    // Listeners para busca
    document.getElementById('transaction-search')?.addEventListener('input', applyTransactionSearch);
    document.getElementById('vale-search')?.addEventListener('input', applyValeSearch);

    updateToggleIcon(); // Define o ícone inicial
    renderInputForms();
};
