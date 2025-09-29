// Configurações e Variáveis Globais para armazenamento local
let userId = 'local-user';
let isAuthReady = true;

const STATE = {
    monthlyInputs: { salary: 0, investments: 0, mealVoucher: 0 },
    transactions: [],
    showValues: true, // Novo estado para controlar a visibilidade dos valores
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

// --- Funções de Armazenamento Local ---

function loadFromLocalStorage() {
    const monthlyInputs = localStorage.getItem('monthlyInputs');
    if (monthlyInputs) {
        STATE.monthlyInputs = JSON.parse(monthlyInputs);
    }

    const transactions = localStorage.getItem('transactions');
    if (transactions) {
        STATE.transactions = JSON.parse(transactions).map(t => ({
            ...t,
            timestamp: new Date(t.timestamp)
        }));
    }

    renderDashboard();
    renderInputForms();
    renderTransactionList();
}

function saveMonthlyInputs(salary, investments, mealVoucher) {
    if (salary !== '') STATE.monthlyInputs.salary = parseFloat(salary) || 0;
    if (investments !== '') STATE.monthlyInputs.investments = parseFloat(investments) || 0;
    if (mealVoucher !== '') STATE.monthlyInputs.mealVoucher = parseFloat(mealVoucher) || 0;
    localStorage.setItem('monthlyInputs', JSON.stringify(STATE.monthlyInputs));
    renderDashboard();
    renderInputForms();
    console.log("Entradas mensais atualizadas com sucesso.");
}

function addTransaction(description, value, category) {
    const transaction = {
        id: Date.now().toString(),
        description: description,
        value: parseFloat(value) || 0,
        category: category,
        timestamp: new Date(),
    };
    STATE.transactions.unshift(transaction); // Adiciona no início para ordem desc
    localStorage.setItem('transactions', JSON.stringify(STATE.transactions));
    renderDashboard();
    renderTransactionList();
    console.log("Transação adicionada com sucesso.");
}

function deleteTransaction(id) {
    STATE.transactions = STATE.transactions.filter(t => t.id !== id);
    localStorage.setItem('transactions', JSON.stringify(STATE.transactions));
    renderDashboard();
    renderTransactionList();
    console.log("Transação excluída com sucesso:", id);
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
    const totalIncome = STATE.monthlyInputs.salary + STATE.monthlyInputs.investments + STATE.monthlyInputs.mealVoucher;
    const totalExpenses = STATE.transactions.reduce((sum, t) => sum + t.value, 0);
    const balance = totalIncome - totalExpenses;
    
    // Calcula o resumo por categoria
    const categorySummary = STATE.transactions.reduce((acc, t) => {
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
    const categorySelect = document.getElementById('expense-category');
    if (categorySelect.options.length === 0) {
         CATEGORIES.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.key;
            option.textContent = cat.name;
            categorySelect.appendChild(option);
        });
    }
}

function renderTransactionList() {
    const listEl = document.getElementById('transaction-list');
    listEl.innerHTML = ''; // Limpa a lista antes de renderizar

    if (STATE.transactions.length === 0) {
        listEl.innerHTML = '<p class="text-center text-gray-500 py-4">Nenhuma despesa registrada ainda.</p>';
        return;
    }

    const items = STATE.transactions.map(t => {
        const category = CATEGORIES.find(c => c.key === t.category);
        const colorClass = category ? category.color : 'bg-gray-500';
        const categoryName = category ? category.name : 'Desconhecida';
        // Garante que t.timestamp é uma data válida antes de chamar toLocaleDateString
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

    listEl.innerHTML = `<ul class="space-y-3">${items}</ul>`;
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

    const description = descriptionEl.value.trim();
    const value = valueEl.value;
    const category = categoryEl.value;

    // Validação
    if (!description || !value || !category || isNaN(parseFloat(value)) || parseFloat(value) <= 0) {
        document.getElementById('expense-message').textContent = 'Preencha todos os campos com valores válidos.';
        document.getElementById('expense-message').classList.remove('hidden', 'text-green-500');
        document.getElementById('expense-message').classList.add('text-red-500');
        return;
    }
    
    addTransaction(description, value, category);

    // Limpa formulário
    descriptionEl.value = '';
    valueEl.value = '';
    categoryEl.value = CATEGORIES[0].key; // Reseta para a primeira categoria

    document.getElementById('expense-message').textContent = 'Despesa registrada com sucesso!';
    document.getElementById('expense-message').classList.remove('hidden', 'text-red-500');
    document.getElementById('expense-message').classList.add('text-green-500');
    setTimeout(() => document.getElementById('expense-message').classList.add('hidden'), 3000);
}

// Expondo as funções globais
window.deleteTransaction = deleteTransaction;
window.toggleValueVisibility = toggleValueVisibility;

// --- Inicialização ---

window.onload = () => {
    loadFromLocalStorage();
    document.getElementById('input-form').addEventListener('submit', handleInputFormSubmit);
    document.getElementById('expense-form').addEventListener('submit', handleExpenseFormSubmit);
    document.getElementById('toggle-values-btn').addEventListener('click', toggleValueVisibility); // Listener do botão de segurança

    updateToggleIcon(); // Define o ícone inicial
    renderInputForms();
};
