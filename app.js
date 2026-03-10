import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
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
let userUID = null, isRegisterMode = false, chartInstance = null;
let financeiro = { ganhos: 0, dividas: 0, saldo: 0, listaFluxo: [] };

const BRL = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// --- AUTH ---
window.alternarAuth = () => {
    isRegisterMode = !isRegisterMode;
    document.getElementById("btnPrincipal").innerText = isRegisterMode ? "Criar Conta" : "Acessar Sistema";
    document.getElementById("confirmarSenhaContainer").classList.toggle("hidden", !isRegisterMode);
};

window.login = () => {
    const e = document.getElementById("email").value, s = document.getElementById("senha").value;
    if (isRegisterMode) {
        createUserWithEmailAndPassword(auth, e, s).catch(err => Swal.fire('Erro', err.message, 'error'));
    } else {
        signInWithEmailAndPassword(auth, e, s).catch(err => Swal.fire('Erro', 'Credenciais Inválidas', 'error'));
    }
};

window.logout = () => signOut(auth);

onAuthStateChanged(auth, user => {
    if (user) { 
        userUID = user.uid; 
        document.getElementById("loginTela").classList.add("hidden"); 
        document.getElementById("dashboard").classList.remove("hidden"); 
        inicializarListeners(); 
    } else { 
        document.getElementById("loginTela").classList.remove("hidden"); 
        document.getElementById("dashboard").classList.add("hidden"); 
    }
});

// --- ENGINE ---
function inicializarListeners() {
    onSnapshot(query(collection(db, "fluxo"), where("userId", "==", userUID)), snap => {
        let g = 0, d = 0; financeiro.listaFluxo = [];
        snap.forEach(docSnap => {
            const item = { ...docSnap.data(), id: docSnap.id };
            if (item.status !== 'paga') {
                if (item.tipo === 'ganho') g += item.valor; else d += item.valor;
            }
            financeiro.listaFluxo.push(item);
        });
        financeiro.ganhos = g; financeiro.dividas = d; financeiro.saldo = g - d;
        atualizarDashboard();
        gerarConquistas();
    });

    onSnapshot(query(collection(db, "metas"), where("userId", "==", userUID)), snap => {
        const grid = document.getElementById("rankingGrid"); grid.innerHTML = "";
        snap.forEach(d => {
            const m = d.data(); const perc = Math.min(100, (m.atual / m.alvo) * 100).toFixed(0);
            grid.innerHTML += `
            <div class="glass-card p-6 border-l-4 ${perc >= 100 ? 'border-emerald-500' : 'border-purple-500'}">
                <div class="flex justify-between items-start mb-4">
                    <div><h4 class="text-xs font-black uppercase">${m.nome}</h4><p class="text-[9px] opacity-40 uppercase">Progresso Alvo</p></div>
                    <span class="text-xs font-black ${perc >= 100 ? 'text-emerald-400' : 'text-purple-400'}">${perc}%</span>
                </div>
                <div class="hp-bar mb-4"><div class="hp-fill ${perc >= 100 ? 'bg-emerald-500' : 'bg-purple-600'}" style="width: ${perc}%"></div></div>
                <div class="flex gap-2">
                    <button onclick="ajustarMeta('${d.id}', ${m.atual})" class="flex-1 bg-white/5 py-3 rounded-xl text-[9px] font-black uppercase">Aportar</button>
                    <button onclick="excluirMeta('${d.id}')" class="p-3 bg-white/5 rounded-xl">🗑️</button>
                </div>
            </div>`;
        });
    });
}

function atualizarDashboard() {
    document.getElementById("receitaTotal").innerText = BRL(financeiro.ganhos);
    document.getElementById("despesaTotal").innerText = BRL(financeiro.dividas);
    document.getElementById("saldoTotal").innerText = BRL(financeiro.saldo);
    
    // RPG HEALTH BAR LOGIC
    const hpFill = document.getElementById("hpFill");
    const hpStatus = document.getElementById("hpStatus");
    const percComprometimento = (financeiro.dividas / (financeiro.ganhos || 1)) * 100;
    const hp = Math.max(0, 100 - percComprometimento);

    hpFill.style.width = hp + "%";
    if (hp > 70) { hpFill.className = "hp-fill bg-emerald-500"; hpStatus.innerText = "Imbatível"; hpStatus.className = "text-[10px] font-black text-emerald-400"; }
    else if (hp > 30) { hpFill.className = "hp-fill bg-yellow-500"; hpStatus.innerText = "Alerta"; hpStatus.className = "text-[10px] font-black text-yellow-400"; }
    else { hpFill.className = "hp-fill bg-rose-500"; hpStatus.innerText = "Crítico"; hpStatus.className = "text-[10px] font-black text-rose-500 animate-pulse"; }

    const ia = document.getElementById("iaTexto");
    if (financeiro.saldo > 0) {
        ia.innerText = `Você possui ${BRL(financeiro.saldo)} livres. Se investir isso agora a 1% amanhã você terá mais. Foco no longo prazo.`;
    } else {
        ia.innerText = "Atenção: Seu custo de vida ultrapassou sua renda. Hora de cortar gastos não essenciais.";
    }
}

function gerarConquistas() {
    const grid = document.getElementById("conquistasGrid"); grid.innerHTML = "";
    const conquistas = [];
    if (financeiro.ganhos > 5000) conquistas.push({icon: "💰", title: "High Earner"});
    if (financeiro.listaFluxo.filter(f => f.status === 'paga').length > 5) conquistas.push({icon: "🛡️", title: "Debt Killer"});
    if (financeiro.saldo > 1000) conquistas.push({icon: "💎", title: "Investor"});

    conquistas.forEach(c => {
        grid.innerHTML += `<div class="glass-card p-3 min-w-[100px] text-center badge-glow border-purple-500/30">
            <span class="text-xl">${c.icon}</span>
            <p class="text-[8px] font-black uppercase mt-1">${c.title}</p>
        </div>`;
    });
}

// --- ACTIONS ---
window.adicionarFluxo = async () => {
    const n = document.getElementById("fluxoNome").value, v = Number(document.getElementById("fluxoValor").value), d = document.getElementById("fluxoData").value, t = document.getElementById("fluxoTipo").value;
    if (n && v && d) { 
        await addDoc(collection(db, "fluxo"), { nome: n, valor: v, data: d, tipo: t, userId: userUID });
        document.getElementById("fluxoNome").value = ""; document.getElementById("fluxoValor").value = "";
        Swal.fire({ icon:'success', title:'Registrado', background:'#0a0c14', color:'#fff', toast:true, position:'top-end', timer:1500, showConfirmButton:false });
    }
};

window.mostrarSecao = (id, btn) => {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-btn-m').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if(id === 'secDividas') setTimeout(renderizarGraficoDividas, 100);
};

window.ajustarMeta = async (id, atual) => {
    const { value: v } = await Swal.fire({ title: 'Aporte R$', input: 'number', background: '#0a0c14', color: '#fff' });
    if (v) await updateDoc(doc(db, "metas", id), { atual: atual + Number(v) });
};

window.excluirMeta = async (id) => {
    const res = await Swal.fire({ title: 'Excluir meta?', showCancelButton: true, background: '#0a0c14', color: '#fff' });
    if(res.isConfirmed) await deleteDoc(doc(db, "metas", id));
};

window.abrirModalMeta = async () => {
    const { value: f } = await Swal.fire({
        title: 'Novo Objetivo',
        html: '<input id="mn" placeholder="Nome" class="swal2-input"><input id="ma" type="number" placeholder="Alvo R$" class="swal2-input">',
        background: '#0a0c14',
        preConfirm: () => [document.getElementById('mn').value, document.getElementById('ma').value]
    });
    if(f && f[0]) await addDoc(collection(db, "metas"), { nome: f[0], alvo: Number(f[1]), atual: 0, userId: userUID });
};

function renderizarGraficoDividas() {
    const ctx = document.getElementById('chartDividas');
    if(chartInstance) chartInstance.destroy();
    const divs = financeiro.listaFluxo.filter(f => f.tipo === 'divida' && f.status !== 'paga');
    document.getElementById("chartTotalLabel").innerText = BRL(financeiro.dividas);
    
    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: divs.map(d => d.nome),
            datasets: [{ data: divs.map(d => d.valor), backgroundColor: ['#a855f7','#7c3aed','#6366f1','#4f46e5'], borderWidth: 0 }]
        },
        options: { cutout: '85%', plugins: { legend: { display: false } } }
    });

    const lista = document.getElementById("listaDividasDetalhada"); lista.innerHTML = "";
    divs.forEach(d => {
        lista.innerHTML += `<div class="flex justify-between items-center p-4 glass-card border-r-4 border-rose-500/50">
            <div class="text-[10px] font-black uppercase">${d.nome}</div>
            <button onclick="gerenciarDivida('${d.id}', '${d.nome}', ${d.valor})" class="text-purple-400 font-black text-[9px]">GERENCIAR</button>
        </div>`;
    });
}

window.gerenciarDivida = async (id, nome, valor) => {
    const { value: acao } = await Swal.fire({
        title: nome,
        input: 'select',
        inputOptions: { paga: '✅ Quitar', del: '🗑️ Deletar' },
        background: '#0a0c14', color: '#fff'
    });
    if (acao === 'paga') await updateDoc(doc(db, "fluxo", id), { status: 'paga' });
    else if (acao === 'del') await deleteDoc(doc(db, "fluxo", id));
};

window.abrirCofre = () => {
    const pagas = financeiro.listaFluxo.filter(f => f.status === 'paga');
    let html = `<div class="space-y-2">`;
    pagas.forEach(p => { html += `<div class="p-3 bg-white/5 rounded-xl flex justify-between text-xs"><span>${p.nome}</span><b>${BRL(p.valor)}</b></div>`; });
    Swal.fire({ title: 'COFRE', html: html || 'Vazio', background: '#0a0c14', color: '#fff' });
};

window.simularJuros = () => {
    const aporte = Number(document.getElementById('simuMes').value);
    const anos = Number(document.getElementById('simuAnos').value);
    const total = aporte * anos * 12 * 1.15; // Simulação simples com 15% de lucro hipotético
    const res = document.getElementById('resSimulador');
    res.classList.remove('hidden');
    res.innerHTML = `<h2 class="text-3xl font-black text-emerald-400">${BRL(total)}</h2><p class="text-[10px] uppercase font-black opacity-40 mt-2">Expectativa para ${anos} anos</p>`;
};
