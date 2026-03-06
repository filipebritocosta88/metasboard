import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
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
        carregarHistoricoAnual();
    } else {
        document.getElementById("loginTela").classList.remove("hidden");
        document.getElementById("dashboard").classList.add("hidden");
    }
});

window.login = () => signInWithEmailAndPassword(auth, document.getElementById("email").value, document.getElementById("senha").value);
window.logout = () => signOut(auth);

// --- NAVIGATION ---
window.mostrarSecao = (id, btn) => {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-btn, .nav-btn-m').forEach(b => b.classList.remove('active', 'text-purple-500'));
    btn.classList.add('active', 'text-purple-500');
    if(id === 'secDividas') setTimeout(renderizarGraficoDividas, 100);
};

// --- CORE DATA ---
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
        salvarNoHistoricoMensal();
    });

    onSnapshot(query(collection(db, "metas"), where("userId", "==", userUID)), snap => {
        const grid = document.getElementById("rankingGrid"); grid.innerHTML = "";
        let metasArr = [];
        snap.forEach(d => metasArr.push({ ...d.data(), id: d.id }));
        metasArr.sort((a,b) => (b.atual/b.alvo) - (a.atual/a.alvo));
        financeiro.metas = metasArr;

        metasArr.forEach((m, idx) => {
            const perc = Math.min(100, (m.atual / m.alvo) * 100).toFixed(1);
            grid.innerHTML += `
                <div class="glass-card p-6 relative border-t-4 ${idx === 0 ? 'border-yellow-500' : 'border-purple-600/30'}">
                    <div class="flex justify-between items-start mb-4">
                        <span class="text-[9px] font-black bg-white/5 px-2 py-1 rounded">RANKING #${idx + 1}</span>
                        <div class="text-right">
                            <p class="text-[9px] text-slate-500 font-black">ALVO SOFISTICADO</p>
                            <p class="text-sm font-black italic">${BRL(m.alvo)}</p>
                        </div>
                    </div>
                    <h4 class="text-lg font-black mb-4 truncate uppercase">${m.nome}</h4>
                    <div class="h-2 bg-black/40 rounded-full mb-2 overflow-hidden">
                        <div class="meta-bar-fill h-full bg-gradient-to-r from-purple-600 to-yellow-500" style="width: ${perc}%"></div>
                    </div>
                    <div class="flex justify-between text-[10px] font-black mb-6">
                        <span class="text-purple-400">POUPADO: ${BRL(m.atual)}</span>
                        <span class="text-yellow-500">${perc}%</span>
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                        <button onclick="ajustarMeta('${m.id}', ${m.atual}, 'add')" class="bg-purple-600 p-3 rounded-xl text-[10px] font-black uppercase">+ APORTAR</button>
                        <button onclick="gerenciarMetaCompleta('${m.id}', '${m.nome}', ${m.alvo})" class="bg-white/5 p-3 rounded-xl text-[10px] font-black uppercase">EDITAR META</button>
                    </div>
                </div>`;
        });
    });
}

// --- BANCO DE DADOS HISTÓRICO ---
async function salvarNoHistoricoMensal() {
    const data = new Date();
    const mesAno = `${data.getMonth() + 1}-${data.getFullYear()}`;
    await setDoc(doc(db, "historico", `${userUID}_${mesAno}`), {
        userId: userUID,
        mes: data.getMonth() + 1,
        ano: data.getFullYear(),
        saldo: financeiro.saldo,
        status: financeiro.saldo >= 0 ? 'positivo' : 'negativo'
    });
    carregarHistoricoAnual();
}

async function carregarHistoricoAnual() {
    const q = query(collection(db, "historico"), where("userId", "==", userUID));
    const snap = await getDocs(q);
    const grid = document.getElementById("gridHistorico");
    grid.innerHTML = "";
    snap.forEach(d => {
        const h = d.data();
        grid.innerHTML += `
            <div class="min-w-[80px] p-3 glass-card text-center border ${h.status === 'positivo' ? 'border-emerald-500/30' : 'border-rose-500/30'}">
                <p class="text-[9px] font-black text-slate-500">${h.mes}/${h.ano}</p>
                <p class="text-xs font-black ${h.status === 'positivo' ? 'text-emerald-400' : 'text-rose-500'}">${BRL(h.saldo)}</p>
            </div>`;
    });
}

// --- GESTÃO DE DÍVIDAS (QUITAR / PARCELAR) ---
window.gerenciarDivida = async (id, nome, valor) => {
    const { value: acao } = await Swal.fire({
        title: `GESTÃO: ${nome}`,
        input: 'select',
        inputOptions: {
            quitar: 'Quitar Totalmente',
            amortizar: 'Pagar Valor Parcial',
            parcelar: 'Parcelar Dívida'
        },
        showCancelButton: true,
        confirmButtonText: 'Prosseguir'
    });

    if (acao === 'quitar') {
        await deleteDoc(doc(db, "fluxo", id));
        Swal.fire('Quitado!', 'Dívida eliminada com sucesso.', 'success');
    } else if (acao === 'amortizar') {
        const { value: pague } = await Swal.fire({ title: 'Quanto vai pagar?', input: 'number' });
        if(pague) await updateDoc(doc(db, "fluxo", id), { valor: valor - Number(pague) });
    } else if (acao === 'parcelar') {
        const { value: parc } = await Swal.fire({ title: 'Quantas parcelas?', input: 'number' });
        if(parc) await updateDoc(doc(db, "fluxo", id), { valor: valor / Number(parc), nome: `${nome} (Parc. 1/${parc})` });
    }
};

// --- DASHBOARD & DESAFIO ---
function atualizarDashboard() {
    document.getElementById("receitaTotal").innerText = BRL(financeiro.ganhos);
    document.getElementById("despesaTotal").innerText = BRL(financeiro.dividas);
    document.getElementById("saldoTotal").innerText = BRL(financeiro.saldo);
    document.getElementById("saldoInvestLabel").innerText = BRL(financeiro.saldo);

    // Desafio da Semana Inteligente
    const tDesafio = document.getElementById("txtDesafio");
    if(financeiro.saldo <= 0) {
        tDesafio.innerText = "🚨 FOCO: Você está no vermelho. Desafio: Venda 1 item parado hoje ou faça 1 bico de R$ 50.";
    } else if(financeiro.saldo < 500) {
        tDesafio.innerText = "🌱 RETENÇÃO: Não gaste com lanches/delivery esta semana. Destine essa sobra para sua meta líder.";
    } else {
        tDesafio.innerText = "💎 MULTIPLICAÇÃO: Tente economizar 10% do seu saldo livre e invista em conhecimento.";
    }

    // Mentoria e Vencimentos
    const tIA = document.getElementById("iaTexto");
    const prox = financeiro.listaFluxo.filter(f => f.tipo === 'divida').sort((a,b) => a.dia - b.dia)[0];
    document.getElementById("txtVencimento").innerText = prox ? `${prox.nome} vence dia ${prox.dia}` : "Tudo em dia!";
    tIA.innerText = financeiro.saldo < 0 ? "⚠️ Seu estilo de vida custa mais do que você ganha. Hora de cortar o supérfluo!" : "🚀 Você tem oxigênio financeiro. Mantenha a disciplina!";
}

// --- HISTÓRICO DE FLUXO (!) ---
window.verHistoricoFluxo = async () => {
    let html = `<div class="text-left space-y-2 max-h-64 overflow-y-auto no-scrollbar">`;
    financeiro.listaFluxo.forEach(f => {
        html += `<div class="flex justify-between p-2 border-b border-white/5 text-[11px]">
                    <span>${f.nome} (Dia ${f.dia})</span>
                    <b class="${f.tipo === 'ganho' ? 'text-emerald-400' : 'text-rose-500'}">${BRL(f.valor)}</b>
                    <button onclick="excluirItem('fluxo','${f.id}')" class="ml-2 text-red-500">✕</button>
                 </div>`;
    });
    html += `</div>`;
    Swal.fire({ title: 'HISTÓRICO DE REGISTROS', html: html, showConfirmButton: false });
};

// --- GRÁFICO E LISTA ---
function renderizarGraficoDividas() {
    const ctx = document.getElementById('chartDividas');
    if(chartInstance) chartInstance.destroy();
    const divData = financeiro.listaFluxo.filter(f => f.tipo === 'divida');
    document.getElementById("chartTotalLabel").innerText = BRL(financeiro.dividas);

    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: divData.map(d => d.nome),
            datasets: [{
                data: divData.map(d => d.valor),
                backgroundColor: ['#ef4444', '#f97316', '#8b5cf6', '#ec4899', '#06b6d4'],
                borderWidth: 0
            }]
        },
        options: { cutout: '80%', plugins: { legend: { display: false } } }
    });

    const lista = document.getElementById("listaDividasDetalhada");
    lista.innerHTML = "";
    divData.forEach((d, i) => {
        const p = ((d.valor/financeiro.dividas)*100).toFixed(0);
        lista.innerHTML += `
            <div class="flex justify-between items-center p-4 glass-card border-r-4" style="border-color: ${chartInstance.data.datasets[0].backgroundColor[i]}">
                <div><b class="text-sm uppercase">${d.nome}</b><p class="text-[9px] text-slate-500">${p}% do peso total</p></div>
                <div class="flex gap-3">
                    <b class="text-sm">${BRL(d.valor)}</b>
                    <button onclick="gerenciarDivida('${d.id}', '${d.nome}', ${d.valor})" class="bg-rose-600/20 text-rose-500 px-3 py-1 rounded-lg text-[10px] font-black">GERENCIAR</button>
                </div>
            </div>`;
    });
}

// --- AÇÕES METAS ---
window.gerenciarMetaCompleta = async (id, nome, alvo) => {
    const { value: acao } = await Swal.fire({
        title: `EDITAR: ${nome}`,
        input: 'select',
        inputOptions: { editar: 'Mudar Nome/Valor', excluir: 'Apagar Meta' },
        showCancelButton: true
    });
    if(acao === 'excluir') {
        if(confirm("Apagar meta?")) await deleteDoc(doc(db, "metas", id));
    } else if(acao === 'editar') {
        const { value: f } = await Swal.fire({
            title: 'Novos Dados',
            html: `<input id="en" class="swal2-input" value="${nome}"><input id="ev" type="number" class="swal2-input" value="${alvo}">`,
            preConfirm: () => [document.getElementById('en').value, document.getElementById('ev').value]
        });
        if(f) await updateDoc(doc(db, "metas", id), { nome: f[0], alvo: Number(f[1]) });
    }
};

window.adicionarFluxo = async () => {
    const n = document.getElementById("fluxoNome").value;
    const v = Number(document.getElementById("fluxoValor").value);
    const d = Number(document.getElementById("fluxoDia").value) || 1;
    const t = document.getElementById("fluxoTipo").value;
    if(n && v) {
        await addDoc(collection(db, "fluxo"), { nome: n, valor: v, dia: d, tipo: t, userId: userUID });
        document.getElementById("fluxoNome").value = ""; document.getElementById("fluxoValor").value = "";
        Swal.fire({ icon: 'success', title: 'Registrado!', toast: true, position: 'top-end', timer: 2000, showConfirmButton: false });
    }
};

window.excluirItem = async (col, id) => {
    await deleteDoc(doc(db, col, id));
    Swal.close();
};

window.ajustarMeta = async (id, atual, acao) => {
    const { value: v } = await Swal.fire({ title: 'Quanto quer aportar?', input: 'number' });
    if(v) await updateDoc(doc(db, "metas", id), { atual: atual + Number(v) });
};

window.abrirModalMeta = async () => {
    const { value: f } = await Swal.fire({
        title: 'NOVA META',
        html: '<input id="sw-n" class="swal2-input" placeholder="O que vai conquistar?"><input id="sw-v" type="number" class="swal2-input" placeholder="Preço do Sonho R$">',
        preConfirm: () => [document.getElementById('sw-n').value, document.getElementById('sw-v').value]
    });
    if(f) await addDoc(collection(db, "metas"), { nome: f[0], alvo: Number(f[1]), atual: 0, userId: userUID });
};
