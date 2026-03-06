import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC4wyouZuCsLZGpmTr5SdXTb7UixdetHoQ",
  authDomain: "metasboard.firebaseapp.com",
  projectId: "metasboard",
  storageBucket: "metasboard.firebasestorage.app",
  messagingSenderId: "958671032163",
  appId: "1:958671032163:web:3d150d966e103ca2e78d56"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let userUID = null;
let financeiro = { ganhos: 0, dividas: 0, saldo: 0, metas: [], listaFluxo: [] };
let chartInstance = null;

const BRL = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// --- AUTH ---
onAuthStateChanged(auth, user => {
    if (user) {
        userUID = user.uid;
        document.getElementById("loginTela").classList.add("hidden");
        document.getElementById("dashboard").classList.remove("hidden");
        inicializarListeners();
        definirDesafioSemanal();
    } else {
        document.getElementById("loginTela").classList.remove("hidden");
        document.getElementById("dashboard").classList.add("hidden");
    }
});

window.login = () => signInWithEmailAndPassword(auth, document.getElementById("email").value, document.getElementById("senha").value);
window.logout = () => signOut(auth);

// --- NAVIGATION MOBILE FRIENDLY ---
window.mostrarSecao = (id, btn) => {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    
    // UI Desktop
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active', 'text-purple-500'));
    // UI Mobile
    document.querySelectorAll('.nav-btn-m').forEach(b => b.classList.remove('active', 'text-purple-500'));
    
    btn.classList.add('active', 'text-purple-500');
    if(id === 'secDividas') setTimeout(renderizarGraficoDividas, 100);
};

// --- DATA ---
function inicializarListeners() {
    onSnapshot(query(collection(db, "fluxo"), where("userId", "==", userUID)), snap => {
        let g = 0; let d = 0;
        financeiro.listaFluxo = [];
        snap.forEach(docSnap => {
            const item = docSnap.data();
            if(item.tipo === 'ganho') g += item.valor; else d += item.valor;
            financeiro.listaFluxo.push({ ...item, id: docSnap.id });
        });
        financeiro.ganhos = g; financeiro.dividas = d; financeiro.saldo = g - d;
        atualizarDashboard();
        atualizarVencimentos();
    });

    onSnapshot(query(collection(db, "metas"), where("userId", "==", userUID)), snap => {
        const grid = document.getElementById("rankingGrid"); grid.innerHTML = "";
        let metasArr = [];
        snap.forEach(d => metasArr.push({ ...d.data(), id: d.id }));
        
        // Ranking Sofisticado
        metasArr.sort((a,b) => (b.atual/b.alvo) - (a.atual/a.alvo));
        financeiro.metas = metasArr;

        metasArr.forEach((m, idx) => {
            const perc = Math.min(100, (m.atual / m.alvo) * 100).toFixed(1);
            grid.innerHTML += `
                <div class="ranking-item glass-card p-6 relative border-t-4 ${idx === 0 ? 'border-yellow-500' : 'border-purple-600/30'}">
                    <div class="flex justify-between items-start mb-4">
                        <span class="text-xs font-black bg-white/5 px-2 py-1 rounded text-slate-400">#${idx + 1} LUGAR</span>
                        <div class="text-right">
                            <p class="text-[9px] text-slate-500 font-bold uppercase">Meta de Valor</p>
                            <p class="text-sm font-black text-white italic">${BRL(m.alvo)}</p>
                        </div>
                    </div>
                    <h4 class="text-xl font-black mb-4 truncate uppercase tracking-tighter">${m.nome}</h4>
                    <div class="meta-bar bg-black/40 mb-2">
                        <div class="meta-bar-fill bg-gradient-to-r from-purple-600 to-yellow-400" style="width: ${perc}%"></div>
                    </div>
                    <div class="flex justify-between text-xs font-bold mb-6">
                        <span class="text-purple-400">${BRL(m.atual)}</span>
                        <span class="text-yellow-500">${perc}%</span>
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                        <button onclick="ajustarMeta('${m.id}', ${m.atual}, 'add')" class="bg-purple-600 py-3 rounded-xl text-xs font-black">+ APORTAR</button>
                        <button onclick="editarMeta('${m.id}', ${m.alvo})" class="bg-white/5 py-3 rounded-xl text-xs font-black">EDITAR</button>
                    </div>
                </div>`;
        });
    });
}

// --- ACTIONS ---
window.adicionarFluxo = async () => {
    const nome = document.getElementById("fluxoNome").value;
    const valor = Number(document.getElementById("fluxoValor").value);
    const dia = Number(document.getElementById("fluxoDia").value) || 1;
    const tipo = document.getElementById("fluxoTipo").value;
    if(nome && valor) {
        await addDoc(collection(db, "fluxo"), { nome, valor, dia, tipo, userId: userUID });
        Swal.fire({ icon: 'success', title: 'Salvo!', toast: true, position: 'top-end', timer: 2000, showConfirmButton: false });
    }
};

function atualizarDashboard() {
    document.getElementById("receitaTotal").innerText = BRL(financeiro.ganhos);
    document.getElementById("despesaTotal").innerText = BRL(financeiro.dividas);
    document.getElementById("saldoTotal").innerText = BRL(financeiro.saldo);
    document.getElementById("saldoInvestLabel").innerText = BRL(financeiro.saldo);

    const msg = document.getElementById("iaTexto");
    const divCritica = financeiro.listaFluxo.filter(f => f.tipo === 'divida').sort((a,b) => b.valor - a.valor)[0];
    
    if(financeiro.saldo < 0) {
        msg.innerHTML = `⚠️ <b>SUGESTÃO DE CORTE:</b> Sua conta "${divCritica.nome}" de ${BRL(divCritica.valor)} é seu maior peso. Reduzir 15% aqui te daria ${BRL(divCritica.valor*0.15)} extras por mês!`;
    } else {
        msg.innerHTML = `✅ <b>MENTORIA:</b> Você está retendo ${((financeiro.saldo / financeiro.ganhos)*100).toFixed(0)}% da sua renda. O segredo é chegar nos 30%. Evite gastos emocionais hoje!`;
    }
}

function atualizarVencimentos() {
    const hoje = new Date().getDate();
    const proximas = financeiro.listaFluxo
        .filter(f => f.tipo === 'divida' && f.dia >= hoje)
        .sort((a,b) => a.dia - b.dia)[0];
    
    document.getElementById("txtVencimento").innerText = proximas 
        ? `${proximas.nome} vence dia ${proximas.dia}` 
        : "Sem contas pendentes p/ este mês.";
}

function definirDesafioSemanal() {
    const desafios = [
        "Sem Delivery: Cozinhe em casa e guarde R$ 50.",
        "Desapego: Venda algo parado no Marketplace hoje.",
        "Transporte: Tente usar menos app de carona esta semana.",
        "Sem Supérfluos: Não compre nada que não seja comida hoje."
    ];
    document.getElementById("txtDesafio").innerText = desafios[Math.floor(Math.random() * desafios.length)];
}

// --- GRÁFICO PROFISSIONAL ---
function renderizarGraficoDividas() {
    const ctx = document.getElementById('chartDividas');
    if(chartInstance) chartInstance.destroy();
    
    const divData = financeiro.listaFluxo.filter(f => f.tipo === 'divida');
    const labels = divData.map(d => d.nome);
    const valores = divData.map(d => d.valor);
    
    document.getElementById("chartTotalLabel").innerText = BRL(financeiro.dividas);

    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: valores,
                backgroundColor: ['#ef4444', '#f97316', '#eab308', '#8b5cf6', '#ec4899', '#06b6d4'],
                hoverOffset: 10,
                borderWidth: 0
            }]
        },
        options: {
            cutout: '80%',
            plugins: { legend: { display: false } }
        }
    });

    const lista = document.getElementById("listaDividasDetalhada");
    lista.innerHTML = "";
    divData.forEach((d, i) => {
        const perc = ((d.valor / financeiro.dividas) * 100).toFixed(1);
        lista.innerHTML += `
            <div class="flex justify-between items-center p-4 bg-white/5 rounded-2xl border-l-4" style="border-color: ${chartInstance.data.datasets[0].backgroundColor[i]}">
                <div><b class="text-xs uppercase">${d.nome}</b><p class="text-[10px] text-slate-500">${perc}% do total</p></div>
                <b class="text-sm">${BRL(d.valor)}</b>
            </div>`;
    });
}

// --- IA DE INVESTIMENTOS CRIATIVA ---
window.analisarInvestimentoIA = () => {
    const box = document.getElementById("boxResultadoInvest");
    const texto = document.getElementById("textoInvestIA");
    const saldo = financeiro.saldo;
    
    box.classList.remove("hidden");
    let r = "";

    if (saldo <= 0) {
        r = `
            <h4 class="text-rose-500 font-black">🚨 PLANO DE EMERGÊNCIA</h4>
            <p>Seu saldo está no vermelho. Não há o que investir agora, precisamos <b>GERAR</b> caixa.</p>
            <div class="grid grid-cols-1 gap-3">
                <div class="bg-white/5 p-4 rounded-xl"><b>Opção 1: Desapego Flash</b><br>Tire foto de 3 itens parados na sua casa e poste agora. Objetivo: Levantar R$ 150 em 24h.</div>
                <div class="bg-white/5 p-4 rounded-xl"><b>Opção 2: Freelance Express</b><br>Ofereça serviços de limpeza, passeio com cães ou suporte técnico para vizinhos.</div>
            </div>`;
    } else if (saldo < 100) {
        r = `
            <h4 class="text-yellow-500 font-black">🌱 FASE DE ACUMULAÇÃO</h4>
            <p>Você tem ${BRL(saldo)}. É pouco para o mercado financeiro, mas ótimo para o <b>Empreendedorismo de Rua</b>.</p>
            <div class="bg-white/5 p-4 rounded-xl">
                <b>Dica de Ouro: O Doce Lucrativo</b><br>
                Compre um pacote de paçoca ou faça geladinhos gourmet. O custo unitário é baixo (R$ 0,50) e a venda é alta (R$ 2,50). Seus R$ ${saldo.toFixed(0)} podem virar R$ ${ (saldo*4).toFixed(0) } até o fim da semana.
            </div>`;
    } else {
        r = `
            <h4 class="text-emerald-500 font-black">🚀 MULTIPLICAÇÃO ATIVA</h4>
            <p>Com ${BRL(saldo)}, você já pode diversificar.</p>
            <div class="space-y-4">
                <div class="bg-white/5 p-4 rounded-xl"><b>Estratégia 50/50:</b><br>Coloque 50% em um CDB de liquidez diária (Reserva) e use 50% para comprar produtos de revenda (Ex: Acessórios de celular na Shopee para revender no bairro).</div>
                <div class="bg-white/5 p-4 rounded-xl"><b>Educação:</b><br>Invista R$ 50 em um livro de vendas ou tráfego pago. O conhecimento vai te fazer ganhar 10x mais esse saldo.</div>
            </div>`;
    }
    texto.innerHTML = r;
};

// --- CRUD METAS ---
window.abrirModalMeta = async () => {
    const { value: f } = await Swal.fire({
        title: 'NOVA META',
        html: '<input id="sw-n" class="swal2-input" placeholder="Nome"><input id="sw-v" type="number" class="swal2-input" placeholder="Alvo R$">',
        preConfirm: () => [document.getElementById('sw-n').value, document.getElementById('sw-v').value]
    });
    if(f) await addDoc(collection(db, "metas"), { nome: f[0], alvo: Number(f[1]), atual: 0, userId: userUID });
};

window.ajustarMeta = async (id, atual, acao) => {
    const { value: v } = await Swal.fire({ title: 'Valor:', input: 'number' });
    if(v) await updateDoc(doc(db, "metas", id), { atual: atual + Number(v) });
};
