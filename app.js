// CONFIGURAÇÃO INICIAL E ESTADO
let db = JSON.parse(localStorage.getItem('metasboard_v2')) || {
    user: null,
    transactions: [], // {id, desc, value, type, date}
    goals: [] // {id, name, target, current, completed: false}
};

function save() {
    localStorage.setItem('metasboard_v2', JSON.stringify(db));
    render();
}

// --- SISTEMA DE AUTENTICAÇÃO ---
function toggleAuth() {
    document.getElementById('login-form').classList.toggle('hidden');
    document.getElementById('register-form').classList.toggle('hidden');
}

function handleLogin() {
    const email = document.getElementById('login-email').value;
    if(email) {
        db.user = { email: email };
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('main-dashboard').style.display = 'block';
        save();
    }
}

function handleRegister() {
    const name = document.getElementById('reg-name').value;
    if(name) {
        db.user = { name: name };
        toggleAuth();
        alert("Conta criada! Faça login.");
    }
}

function handleLogout() {
    db.user = null;
    localStorage.removeItem('metasboard_v2');
    location.reload();
}

// --- GESTÃO DE TRANSAÇÕES ---
function addTransaction() {
    const desc = document.getElementById('reg-desc').value;
    const val = parseFloat(document.getElementById('reg-val').value);
    const type = document.getElementById('reg-type').value;

    if(!desc || !val) return alert("Preencha os dados!");

    db.transactions.push({
        id: Date.now(),
        desc,
        value: val,
        type,
        date: new Date().toISOString()
    });

    save();
    document.getElementById('reg-desc').value = '';
    document.getElementById('reg-val').value = '';
}

// --- FILTROS DE HISTÓRICO ---
function updateHistory() {
    const filterDate = document.getElementById('filter-date').value; // YYYY-MM
    const filterCat = document.getElementById('filter-category').value;
    const container = document.getElementById('history-content');

    let filtered = db.transactions;

    if(filterDate) {
        filtered = filtered.filter(t => t.date.includes(filterDate));
    }
    if(filterCat !== 'all') {
        filtered = filtered.filter(t => t.type === filterCat);
    }

    container.innerHTML = filtered.map(t => `
        <div style="display:flex; justify-content:space-between; padding:12px; border-bottom:1px solid var(--border);">
            <div>
                <strong>${t.desc}</strong><br>
                <small>${new Date(t.date).toLocaleDateString('pt-BR')}</small>
            </div>
            <span style="color: ${t.type === 'income' ? 'var(--success)' : 'var(--danger)'}">
                ${t.type === 'income' ? '+' : '-'} R$ ${t.value.toLocaleString()}
            </span>
        </div>
    `).join('') || '<p style="padding:20px; text-align:center;">Nada encontrado.</p>';
}

// --- METAS ---
let currentMetaTab = 'active';
function switchMetaTab(tab) {
    currentMetaTab = tab;
    document.getElementById('btn-metas-ativas').classList.toggle('active', tab === 'active');
    document.getElementById('btn-metas-concluidas').classList.toggle('active', tab === 'completed');
    renderMetas();
}

function renderMetas() {
    const container = document.getElementById('metas-list');
    const filtered = db.goals.filter(g => currentMetaTab === 'active' ? !g.completed : g.completed);
    
    container.innerHTML = filtered.map(g => `
        <div style="background:var(--bg-color); padding:15px; border-radius:10px; margin-bottom:10px;">
            <div style="display:flex; justify-content:space-between;">
                <span>${g.name}</span>
                <strong>R$ ${g.target}</strong>
            </div>
            ${!g.completed ? `<button onclick="completeGoal(${g.id})" style="font-size:0.7em; margin-top:5px; cursor:pointer;">Concluir</button>` : ''}
        </div>
    `).join('') || '<p>Nenhuma meta aqui.</p>';
}

function completeGoal(id) {
    const goal = db.goals.find(g => g.id === id);
    if(goal) goal.completed = true;
    save();
}

// --- SIMULADOR E MAPA DO FUTURO ---
function calculateSimulation() {
    const extra = parseFloat(document.getElementById('sim-val').value) || 0;
    const years = parseInt(document.getElementById('sim-years').value) || 0;
    const resultDiv = document.getElementById('sim-result');

    const monthlyIncome = db.transactions.filter(t => t.type === 'income').reduce((a,b) => a + b.value, 0);
    const monthlyFixed = db.transactions.filter(t => t.type === 'expense').reduce((a,b) => a + b.value, 0);
    
    const savings = (monthlyIncome - monthlyFixed) + extra;
    const total = savings * (years * 12);

    resultDiv.classList.remove('hidden');
    resultDiv.innerHTML = `
        <p>Projeção de Acúmulo:</p>
        <h2 style="color: var(--accent-color)">R$ ${total.toLocaleString('pt-BR')}</h2>
        <small>Poupando R$ ${savings}/mês por ${years} anos.</small>
    `;
}

function renderActivityMap() {
    const map = document.getElementById('activity-map');
    const income = db.transactions.filter(t => t.type === 'income').reduce((a,b) => a + b.value, 0);
    const fixed = db.transactions.filter(t => t.type === 'expense').reduce((a,b) => a + b.value, 0);
    
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const d = new Date();
    
    map.innerHTML = '';
    for(let i=0; i<12; i++) {
        const m = (d.getMonth() + i) % 12;
        map.innerHTML += `
            <div class="map-item">
                <strong>${months[m]}</strong>
                <span style="color:var(--success)">+ R$ ${income}</span>
                <span style="color:var(--danger)">- R$ ${fixed}</span>
            </div>
        `;
    }
}

// --- IA ASSISTANT ---
function runAIAssistant() {
    const balance = db.transactions.reduce((acc, t) => t.type === 'income' ? acc + t.value : acc - t.value, 0);
    alert(`[Metasboard IA]: Olá! Analisei seus dados. Seu saldo atual é R$ ${balance.toLocaleString()}. No simulador, você pode alcançar seus objetivos mais rápido se reduzir as despesas fixas em 10%. Posso ajudar com mais algo?`);
}

// --- RENDERIZAÇÃO GERAL ---
function render() {
    if(db.user) {
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('main-dashboard').style.display = 'block';
    }

    const income = db.transactions.filter(t => t.type === 'income').reduce((a,b) => a + b.value, 0);
    const expense = db.transactions.filter(t => t.type === 'expense').reduce((a,b) => a + b.value, 0);
    
    document.getElementById('wallet-display').innerHTML = `
        <p style="color: var(--text-secondary)">Saldo Geral</p>
        <h2 style="font-size: 2em; color: ${income-expense >= 0 ? 'var(--success)' : 'var(--danger)'}">
            R$ ${(income - expense).toLocaleString()}
        </h2>
    `;

    renderMetas();
    updateHistory();
    renderActivityMap();
}

// Início
render();
