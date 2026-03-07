import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc, setDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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
let filtroDatas = { inicio: null, fim: null };

const BRL = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// --- AUTH ---
window.alternarAuth = () => {
    isRegisterMode = !isRegisterMode;
    document.getElementById("btnPrincipal").innerText = isRegisterMode ? "Criar Minha Conta" : "Acessar Painel";
    document.getElementById("btnAlternar").innerText = isRegisterMode ? "Já tenho conta? Login" : "Novo? Criar Senha";
    document.getElementById("confirmarSenhaContainer").classList.toggle("hidden", !isRegisterMode);
};

window.login = () => {
    const e = document.getElementById("email").value;
    const s = document.getElementById("senha").value;
    if (isRegisterMode) {
        const sc = document.getElementById("senhaConfirm").value;
        if (s !== sc) return Swal.fire('Erro', 'Senhas não conferem', 'warning');
        createUserWithEmailAndPassword(auth, e, s).catch(err => Swal.fire('Erro', err.message, 'error'));
    } else {
        signInWithEmailAndPassword(auth, e, s).catch(() => Swal.fire('Erro', 'Acesso negado', 'error'));
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

// --- FILTRO DE DATAS ---
window.aplicarFiltroData = () => {
    const d1 = document.getElementById("dataInicio").value;
    const d2 = document.getElementById("dataFim").value;
    if (!d1 || !d2) return Swal.fire('Aviso', 'Selecione as duas datas', 'info');
    filtroDatas = { inicio: new Date(d1), fim: new Date(d2) };
    calcularResumo();
};

// --- CORE DATA ---
function inicializarListeners() {
    onSnapshot(query(collection(db, "fluxo"), where("userId", "==", userUID)), snap => {
        financeiro.listaFluxo = [];
        snap.forEach(d => financeiro.listaFluxo.push({ ...d.data(), id: d.id }));
        calcularResumo();
        gerarPerformanceAnual();
    });

    onSnapshot(query(collection(db, "metas"), where("userId", "==", userUID)), snap => {
        const grid = document.getElementById("rankingGrid"); grid.innerHTML = "";
        let metas = [];
        snap.forEach(d => metas.push({ ...d.data(), id: d.id }));
        metas.sort((a,b) => (b.atual/b.alvo) - (a.atual/a.alvo));
        metas.forEach(m => {
            const perc = Math.min(100, (m.atual / m.alvo) * 100).toFixed(1);
            grid.innerHTML += `
                <div class="glass-card p-5 border-t-4 border-purple-600/30">
                    <h4 class="text-sm font-black uppercase mb-3">${m.nome}</h4>
                    <div class="h-2 bg-black/40 rounded-full mb-2 overflow-hidden">
                        <div class="h-full bg-purple-600" style="width: ${perc}%"></div>
                    </div>
                    <div class="flex justify-between text-[10px] font-black mb-4">
                        <span>${BRL(m.atual)}</span><span>${perc}%</span>
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                        <button onclick="ajustarMeta('${m.id}', ${m.atual})" class="bg-purple-600 py-2 rounded-lg text-[10px] font-black uppercase">+ Aporte</button>
                        <button onclick="gerenciarMeta('${m.id}', '${m.nome}', ${m.alvo})" class="bg-white/5 py-2 rounded-lg text-[10px] font-black">EDITAR</button>
                    </div>
                </div>`;
        });
    });
}

function calcularResumo() {
    let g = 0, d = 0;
    financeiro.listaFluxo.forEach(item => {
        const dataItem = new Date(item.data + "T00:00:00");
        // Se houver filtro, obedece. Se não, soma tudo do mês atual (Março 2026).
        const matchesFiltro = filtroDatas.inicio ? (dataItem >= filtroDatas.inicio && dataItem <= filtroDatas.fim) : (dataItem.getMonth() === 2 && dataItem.getFullYear() === 2026);
        
        if (matchesFiltro) {
            if (item.tipo === 'ganho') g += item.valor; else d += item.valor;
        }
    });

    financeiro.ganhos = g; financeiro.dividas = d; financeiro.saldo = g - d;
    document.getElementById("receitaTotal").innerText = BRL(g);
    document.getElementById("despesaTotal").innerText = BRL(d);
    document.getElementById("saldoTotal").innerText = BRL(g - d);
    document.getElementById("saldoInvestLabel").innerText = BRL(g - d);
    document.getElementById("iaTexto").innerText = g - d < 0 ? "⚠️ Cuidado! Suas despesas superam seus ganhos no período selecionado." : "✅ Saldo positivo! Ótimo momento para investir ou bater metas.";
    
    // Atualiza gráfico automaticamente
    if (document.getElementById('secDividas').classList.contains('hidden') === false) renderizarGraficoDividas();
}

// --- HISTÓRICO ANUAL ---
function gerarPerformanceAnual() {
    const grid = document.getElementById("gridMesesAnual"); grid.innerHTML = "";
    const meses = ["J","F","M","A","M","J","J","A","S","O","N","D"];
    for (let m = 0; m < 12; m++) {
        let saldoMes = 0;
        financeiro.listaFluxo.filter(f => new Date(f.data + "T00:00:00").getMonth() === m && new Date(f.data + "T00:00:00").getFullYear() === 2026).forEach(f => {
            if(f.tipo === 'ganho') saldoMes += f.valor; else saldoMes -= f.valor;
        });
        const cor = saldoMes > 0 ? 'bg-emerald-500' : (saldoMes < 0 ? 'bg-rose-500' : 'bg-slate-700');
        grid.innerHTML += `<div onclick="Swal.fire('Mês ${m+1}','Saldo: ${BRL(saldoMes)}','info')" class="mes-dot ${cor}">${meses[m]}</div>`;
    }
}

// --- REGISTRO ---
window.adicionarFluxo = async () => {
    const n = document.getElementById("fluxoNome").value;
    const v = Number(document.getElementById("fluxoValor").value);
    const d = document.getElementById("fluxoData").value;
    const t = document.getElementById("fluxoTipo").value;
    if(!n || !v || !d) return Swal.fire('Erro','Preencha tudo','warning');
    await addDoc(collection(db, "fluxo"), { nome: n, valor: v, data: d, tipo: t, userId: userUID });
    Swal.fire({ icon: 'success', title: 'Salvo', toast: true, position: 'top-end', timer: 2000 });
};

// --- GESTÃO DE DÍVIDAS E GRÁFICO ---
function renderizarGraficoDividas() {
    const ctx = document.getElementById('chartDividas');
    if(chartInstance) chartInstance.destroy();
    const divs = financeiro.listaFluxo.filter(f => f.tipo === 'divida');
    document.getElementById("chartTotalLabel").innerText = BRL(financeiro.dividas);
    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: divs.map(d => d.nome),
            datasets: [{ data: divs.map(d => d.valor), backgroundColor: ['#ef4444','#f97316','#8b5cf6','#ec4899','#06b6d4'], borderWidth: 0 }]
        },
        options: { cutout: '70%', plugins: { legend: { display: false } } }
    });
    const lista = document.getElementById("listaDividasDetalhada"); lista.innerHTML = "";
    divs.forEach(d => {
        lista.innerHTML += `<div class="flex justify-between items-center p-4 glass-card">
            <div class="text-[11px]"><b>${d.nome}</b><br><span class="opacity-50">${d.data}</span></div>
            <div class="flex items-center gap-3"><b>${BRL(d.valor)}</b><button onclick="gerenciarDivida('${d.id}')" class="text-rose-500 font-bold">GERIR</button></div>
        </div>`;
    });
}

window.gerenciarDivida = async (id) => {
    const { value: acao } = await Swal.fire({
        title: 'Gerir Dívida',
        input: 'select',
        inputOptions: { paga: 'Marcar como Paga', excluir: 'Excluir' },
        showCancelButton: true
    });
    if (acao) await deleteDoc(doc(db, "fluxo", id));
};

// --- INVESTIMENTOS ---
window.analisarInvestimentoIA = () => {
    const box = document.getElementById("boxResultadoInvest");
    box.classList.remove("hidden");
    const s = financeiro.saldo;
    if (s <= 0) {
        box.innerHTML = `<p class="text-rose-500">Saldo Negativo. Foque em quitar dívidas e reduzir custos antes de investir.</p>`;
    } else {
        box.innerHTML = `<p class="text-emerald-500">Com ${BRL(s)}, reserve 50% para emergência (CDB) e 50% para revenda rápida de produtos.</p>`;
    }
};

// --- AUXILIARES ---
window.mostrarSecao = (id, btn) => {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-btn, .nav-btn-m').forEach(b => b.classList.remove('active', 'text-purple-500'));
    btn.classList.add('active', 'text-purple-500');
    if(id === 'secDividas') setTimeout(renderizarGraficoDividas, 100);
};

window.verHistoricoFluxo = () => {
    let html = `<div class="text-left space-y-2 max-h-60 overflow-y-auto no-scrollbar">`;
    financeiro.listaFluxo.forEach(f => {
        html += `<div class="flex justify-between items-center p-2 border-b border-white/5">
            <span class="text-[10px]">${f.nome}</span>
            <div class="flex items-center gap-2"><b class="text-[10px]">${BRL(f.valor)}</b><button onclick="excluirRegistro('${f.id}')">✕</button></div>
        </div>`;
    });
    Swal.fire({ title: 'HISTÓRICO', html: html + `</div>`, showConfirmButton: false });
};

window.excluirRegistro = async (id) => { await deleteDoc(doc(db, "fluxo", id)); Swal.close(); };

window.ajustarMeta = async (id, atual) => {
    const { value: v } = await Swal.fire({ title: 'Aporte', input: 'number' });
    if(v) await updateDoc(doc(db, "metas", id), { atual: atual + Number(v) });
};

window.gerenciarMeta = async (id, nome, alvo) => {
    const { value: acao } = await Swal.fire({ title: nome, input: 'select', inputOptions: { edit: 'Editar', del: 'Apagar' }, showCancelButton: true });
    if(acao === 'del') await deleteDoc(doc(db, "metas", id));
    else if(acao === 'edit') {
        const { value: f } = await Swal.fire({ html: `<input id="en" value="${nome}"><input id="ev" type="number" value="${alvo}">`, preConfirm: () => [document.getElementById('en').value, document.getElementById('ev').value] });
        if(f) await updateDoc(doc(db, "metas", id), { nome: f[0], alvo: Number(f[1]) });
    }
};

window.abrirModalMeta = async () => {
    const { value: f } = await Swal.fire({ html: '<input id="n" placeholder="Nome"><input id="v" type="number" placeholder="Alvo">', preConfirm: () => [document.getElementById('n').value, document.getElementById('v').value] });
    if(f) await addDoc(collection(db, "metas"), { nome: f[0], alvo: Number(f[1]), atual: 0, userId: userUID });
};
