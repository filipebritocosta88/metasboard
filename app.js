import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// --- COLE SUAS CREDENCIAIS DO FIREBASE AQUI ---
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
let isRegisterMode = false;
let financeiro = { ganhos: 0, dividas: 0, saldo: 0, listaFluxo: [] };
let chartInstance = null;

const BRL = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// --- AUTH ---
window.alternarAuth = () => {
    isRegisterMode = !isRegisterMode;
    document.getElementById("btnPrincipal").innerText = isRegisterMode ? "Criar Minha Conta" : "Acessar Painel";
    document.getElementById("confirmarSenhaContainer").classList.toggle("hidden", !isRegisterMode);
};

window.login = () => {
    const e = document.getElementById("email").value, s = document.getElementById("senha").value;
    if (isRegisterMode) {
        const sc = document.getElementById("senhaConfirm").value;
        if(s !== sc) return Swal.fire('Erro', 'Senhas não conferem', 'error');
        createUserWithEmailAndPassword(auth, e, s).catch(err => Swal.fire('Erro', err.message, 'error'));
    } else {
        signInWithEmailAndPassword(auth, e, s).catch(err => Swal.fire('Erro', 'E-mail ou senha inválidos', 'error'));
    }
};

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

window.logout = () => signOut(auth);

// --- DASHBOARD E NAVEGAÇÃO ---
window.mostrarSecao = (id, btn) => {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-btn-m').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if(id === 'secDividas') setTimeout(renderizarGraficoDividas, 100);
    if(id === 'secInvest') gerarSugestoesInvestimento();
};

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
        gerarPerformanceAnual();
    });

    onSnapshot(query(collection(db, "metas"), where("userId", "==", userUID)), snap => {
        const grid = document.getElementById("rankingGrid"); grid.innerHTML = "";
        snap.forEach(d => {
            const m = d.data(); const perc = Math.min(100, (m.atual / m.alvo) * 100).toFixed(0);
            grid.innerHTML += `<div class="glass-card p-5 border-t-2 border-purple-500/20">
                <h4 class="text-[10px] font-black uppercase mb-3">${m.nome}</h4>
                <div class="h-1 bg-black/40 rounded-full mb-2"><div class="h-full bg-purple-600 rounded-full" style="width: ${perc}%"></div></div>
                <div class="flex justify-between text-[9px] mb-4 font-black"><span>${BRL(m.atual)}</span><span class="text-purple-400">${perc}%</span></div>
                <button onclick="ajustarMeta('${d.id}', ${m.atual})" class="w-full bg-white/5 py-2 rounded-lg text-[10px] font-black">APORTAR</button>
            </div>`;
        });
    });
}

function atualizarDashboard() {
    document.getElementById("receitaTotal").innerText = BRL(financeiro.ganhos);
    document.getElementById("despesaTotal").innerText = BRL(financeiro.dividas);
    document.getElementById("saldoTotal").innerText = BRL(financeiro.saldo);
    
    const ia = document.getElementById("iaTexto");
    const comprometimento = (financeiro.dividas / financeiro.ganhos) * 100;
    if (comprometimento > 70) {
        ia.innerHTML = `<span class="text-rose-500 font-black">ALERTA:</span> Suas dívidas consomem ${comprometimento.toFixed(0)}% da renda. Evite novos gastos!`;
    } else {
        ia.innerText = financeiro.saldo > 0 ? "Saldo positivo! Momento ideal para aportar em suas metas." : "Atenção ao seu fluxo de caixa este mês.";
    }
}

// --- GESTÃO DE DÍVIDAS ---
function renderizarGraficoDividas() {
    const ctx = document.getElementById('chartDividas');
    if(chartInstance) chartInstance.destroy();
    const divs = financeiro.listaFluxo.filter(f => f.tipo === 'divida' && f.status !== 'paga');
    document.getElementById("chartTotalLabel").innerText = BRL(financeiro.dividas);
    
    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: divs.map(d => d.nome),
            datasets: [{ data: divs.map(d => d.valor), backgroundColor: ['#ef4444','#f97316','#8b5cf6','#ec4899'], borderWidth: 0 }]
        },
        options: { cutout: '80%', plugins: { legend: { display: false } } }
    });

    const lista = document.getElementById("listaDividasDetalhada"); lista.innerHTML = "";
    divs.forEach(d => {
        lista.innerHTML += `<div class="flex justify-between items-center p-4 glass-card border-r-4 border-white/5">
            <div class="text-[10px]"><b class="uppercase">${d.nome}</b><br><span class="opacity-40">${d.data}</span></div>
            <button onclick="gerenciarDivida('${d.id}', '${d.nome}', ${d.valor})" class="text-purple-400 font-black text-[10px] uppercase">Gerir</button>
        </div>`;
    });
}

window.gerenciarDivida = async (id, nome, valor) => {
    const { value: acao } = await Swal.fire({
        title: nome,
        input: 'select',
        inputOptions: { paga: '✅ Marcar como Paga', parc: '分 Parcelar Dívida', del: '🗑️ Excluir' },
        showCancelButton: true
    });

    if (acao === 'paga') await updateDoc(doc(db, "fluxo", id), { status: 'paga' });
    else if (acao === 'del') await deleteDoc(doc(db, "fluxo", id));
    else if (acao === 'parc') {
        const { value: p } = await Swal.fire({ title: 'Quantas parcelas?', input: 'number' });
        if (p > 1) {
            await deleteDoc(doc(db, "fluxo", id));
            for(let i=1; i<=p; i++) {
                await addDoc(collection(db, "fluxo"), { nome: `${nome} (${i}/${p})`, valor: valor/p, data: new Date().toISOString().split('T')[0], tipo: 'divida', userId: userUID });
            }
        }
    }
};

window.abrirCofre = () => {
    const pagas = financeiro.listaFluxo.filter(f => f.status === 'paga');
    let html = `<div class="space-y-2">`;
    pagas.forEach(p => {
        html += `<div class="p-3 bg-emerald-500/10 rounded-xl flex justify-between items-center border-l-2 border-emerald-500">
            <span class="text-[10px] font-black uppercase">${p.nome}</span>
            <b class="text-emerald-400">${BRL(p.valor)}</b>
        </div>`;
    });
    Swal.fire({ title: 'DÍVIDAS QUITADAS', html: pagas.length ? html + `</div>` : "Nenhuma dívida paga ainda.", showConfirmButton: false });
};

// --- INVESTIMENTOS ---
window.simularJuros = () => {
    const aporte = Number(document.getElementById('simuMes').value);
    const anos = Number(document.getElementById('simuAnos').value);
    const taxaMensal = Math.pow(1 + 0.12, 1/12) - 1; // 12% ao ano
    const total = aporte * (Math.pow(1 + taxaMensal, anos * 12) - 1) / taxaMensal;
    const res = document.getElementById('resSimulador');
    res.classList.remove('hidden');
    res.innerHTML = `<p class="text-[9px] uppercase opacity-50">Projeção em ${anos} anos:</p><h4 class="text-xl font-black text-emerald-400">${BRL(total)}</h4>`;
};

function gerarSugestoesInvestimento() {
    const container = document.getElementById('cardsSugestaoInvest');
    container.innerHTML = `
        <div class="glass-card p-4 border-l-4 border-emerald-500">
            <b class="text-[10px] text-emerald-400 uppercase">🛡️ Conservador (Tesouro Selic)</b>
            <p class="text-[10px] opacity-60 mt-1">Ideal para sua reserva. Rendimento atual ~11.25% a.a.</p>
        </div>
        <div class="glass-card p-4 border-l-4 border-yellow-500">
            <b class="text-[10px] text-yellow-400 uppercase">⚖️ Moderado (FIIs)</b>
            <p class="text-[10px] opacity-60 mt-1">Renda mensal isenta de IR. Ideal para gerar fluxo de caixa.</p>
        </div>`;
}

// --- AUXILIARES ---
window.adicionarFluxo = async () => {
    const n = document.getElementById("fluxoNome").value, v = Number(document.getElementById("fluxoValor").value), d = document.getElementById("fluxoData").value, t = document.getElementById("fluxoTipo").value;
    if (n && v && d) { 
        await addDoc(collection(db, "fluxo"), { nome: n, valor: v, data: d, tipo: t, userId: userUID });
        Swal.fire({ icon:'success', title:'Salvo!', toast:true, position:'top-end', timer:1500, showConfirmButton:false });
    }
};

function gerarPerformanceAnual() {
    const grid = document.getElementById("gridMesesAnual"); grid.innerHTML = "";
    const meses = ["J","F","M","A","M","J","J","A","S","O","N","D"];
    for (let m = 0; m < 12; m++) {
        grid.innerHTML += `<div class="mes-dot bg-slate-800 text-slate-500">${meses[m]}</div>`;
    }
}

window.ajustarMeta = async (id, atual) => {
    const { value: v } = await Swal.fire({ title: 'Quanto aportar?', input: 'number' });
    if (v) await updateDoc(doc(db, "metas", id), { atual: atual + Number(v) });
};

window.abrirModalMeta = async () => {
    const { value: f } = await Swal.fire({
        html: '<input id="mn" placeholder="Nome da Meta" class="swal2-input"><input id="ma" type="number" placeholder="Valor Alvo" class="swal2-input">',
        preConfirm: () => [document.getElementById('mn').value, document.getElementById('ma').value]
    });
    if(f) await addDoc(collection(db, "metas"), { nome: f[0], alvo: Number(f[1]), atual: 0, userId: userUID });
};
