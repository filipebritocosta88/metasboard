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
    } else {
        document.getElementById("loginTela").classList.remove("hidden");
        document.getElementById("dashboard").classList.add("hidden");
    }
});

window.login = () => signInWithEmailAndPassword(auth, document.getElementById("email").value, document.getElementById("senha").value);
window.logout = () => signOut(auth);

// --- NAVEGAÇÃO ---
window.mostrarSecao = (id, btn) => {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-btn, .nav-btn-m').forEach(b => b.classList.remove('active', 'text-purple-500'));
    btn.classList.add('active', 'text-purple-500');
    if(id === 'secDividas') setTimeout(renderizarGraficoDividas, 100);
};

// --- LISTENERS E DADOS ---
function inicializarListeners() {
    // Fluxo financeiro
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
        salvarHistoricoMensal();
    });

    // Metas
    onSnapshot(query(collection(db, "metas"), where("userId", "==", userUID)), snap => {
        const grid = document.getElementById("rankingGrid"); grid.innerHTML = "";
        let metasArr = [];
        snap.forEach(d => metasArr.push({ ...d.data(), id: d.id }));
        metasArr.sort((a,b) => (b.atual/b.alvo) - (a.atual/a.alvo));
        financeiro.metas = metasArr;

        metasArr.forEach((m, idx) => {
            const perc = Math.min(100, (m.atual / m.alvo) * 100).toFixed(1);
            grid.innerHTML += `
                <div class="glass-card p-5 border-t-4 ${idx === 0 ? 'border-yellow-500' : 'border-purple-600/30'}">
                    <div class="flex justify-between items-start mb-3">
                        <span class="text-[9px] font-black bg-white/5 px-2 py-1 rounded">RANKING #${idx + 1}</span>
                        <p class="text-xs font-black">${BRL(m.alvo)}</p>
                    </div>
                    <h4 class="text-sm font-black mb-3 truncate uppercase">${m.nome}</h4>
                    <div class="h-2 bg-black/40 rounded-full mb-2 overflow-hidden">
                        <div class="meta-bar-fill h-full bg-gradient-to-r from-purple-600 to-yellow-500" style="width: ${perc}%"></div>
                    </div>
                    <div class="flex justify-between text-[10px] font-black mb-4">
                        <span class="text-purple-400">${BRL(m.atual)}</span>
                        <span class="text-yellow-500">${perc}%</span>
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                        <button onclick="ajustarMeta('${m.id}', ${m.atual})" class="bg-purple-600 py-2 rounded-lg text-[10px] font-black uppercase">+ Aporte</button>
                        <button onclick="gerenciarMeta('${m.id}', '${m.nome}', ${m.alvo})" class="bg-white/5 py-2 rounded-lg text-[10px] font-black uppercase italic">Editar</button>
                    </div>
                </div>`;
        });
    });
}

// --- HISTÓRICO (!) ---
window.verHistoricoFluxo = () => {
    if (financeiro.listaFluxo.length === 0) {
        Swal.fire({ title: 'Sem registros', text: 'Adicione um ganho ou dívida primeiro.', icon: 'info', background: '#161b30', color: '#fff' });
        return;
    }
    let h = `<div class="text-left space-y-2 max-h-64 overflow-y-auto no-scrollbar pr-2">`;
    financeiro.listaFluxo.forEach(f => {
        h += `<div class="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5 mb-2">
                <div class="text-[11px]"><b class="uppercase text-white">${f.nome}</b><br><span class="opacity-50">Dia ${f.dia}</span></div>
                <div class="flex items-center gap-3">
                    <b class="text-xs ${f.tipo === 'ganho' ? 'text-emerald-400' : 'text-rose-500'}">${f.tipo === 'ganho' ? '+' : '-'} ${BRL(f.valor)}</b>
                    <button onclick="excluirRegistroGeral('${f.id}')" class="text-rose-500 font-bold p-2">✕</button>
                </div>
              </div>`;
    });
    Swal.fire({ title: 'HISTÓRICO', html: h + `</div>`, showConfirmButton: false, background: '#161b30', color: '#fff' });
};

window.excluirRegistroGeral = async (id) => {
    const res = await Swal.fire({ title: 'Excluir?', text: "Remover este registro permanentemente?", icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', background: '#161b30', color: '#fff' });
    if (res.isConfirmed) {
        await deleteDoc(doc(db, "fluxo", id));
        Swal.close();
    }
};

// --- GESTÃO DE DÍVIDAS ---
window.gerenciarDivida = async (id, nome, valor) => {
    const { value: acao } = await Swal.fire({
        title: nome, input: 'select', background: '#161b30', color: '#fff',
        inputOptions: { quitar: 'Quitar Total', amortizar: 'Pagar Parte', parcelar: 'Parcelar' },
        showCancelButton: true
    });
    if (acao === 'quitar') await deleteDoc(doc(db, "fluxo", id));
    if (acao === 'amortizar') {
        const { value: v } = await Swal.fire({ title: 'Quanto pagar?', input: 'number', background: '#161b30', color: '#fff' });
        if (v) await updateDoc(doc(db, "fluxo", id), { valor: valor - Number(v) });
    }
    if (acao === 'parcelar') {
        const { value: p } = await Swal.fire({ title: 'Nº de Parcelas?', input: 'number', background: '#161b30', color: '#fff' });
        if (p) await updateDoc(doc(db, "fluxo", id), { valor: valor / Number(p), nome: `${nome} (1/${p})` });
    }
};

// --- DASHBOARD E INVESTIMENTO ---
function atualizarDashboard() {
    document.getElementById("receitaTotal").innerText = BRL(financeiro.ganhos);
    document.getElementById("despesaTotal").innerText = BRL(financeiro.dividas);
    document.getElementById("saldoTotal").innerText = BRL(financeiro.saldo);
    document.getElementById("saldoInvestLabel").innerText = BRL(financeiro.saldo);

    const txtD = document.getElementById("txtDesafio");
    if(financeiro.saldo <= 0) txtD.innerText = "🔥 Missão: Venda 1 item parado para sair do vermelho.";
    else if(financeiro.saldo < 300) txtD.innerText = "🍕 Missão: Não peça delivery hoje e salve R$ 50.";
    else txtD.innerText = "📈 Missão: Aporte 10% deste saldo na sua meta principal.";

    const prox = financeiro.listaFluxo.filter(f => f.tipo === 'divida').sort((a,b) => a.dia - b.dia)[0];
    document.getElementById("txtVencimento").innerText = prox ? `${prox.nome} (Dia ${prox.dia})` : "Tudo limpo!";
    document.getElementById("iaTexto").innerText = financeiro.saldo < 0 ? "⚠️ Cuidado! Suas dívidas estão drenando sua paz. Hora de gerar renda extra urgente." : "✅ Você tem oxigênio financeiro. Mantenha a disciplina nas metas!";
}

window.analisarInvestimentoIA = () => {
    const box = document.getElementById("boxResultadoInvest");
    const s = financeiro.saldo;
    box.classList.remove("hidden");
    if (s <= 0) {
        box.innerHTML = `<div class="p-4 border-l-4 border-rose-500 bg-rose-500/10"><h4 class="font-black text-rose-500">PLANO DE EMERGÊNCIA</h4><p class="text-xs mt-2">Você está negativado. Não invista em bancos agora. Foque em <b>VENDAS</b>: OLX, desapegos ou serviços extras para gerar R$ 200 rápido.</p></div>`;
    } else if (s < 100) {
        box.innerHTML = `<div class="p-4 border-l-4 border-yellow-500 bg-yellow-500/10"><h4 class="font-black text-yellow-500">PLANO DE CRESCIMENTO</h4><p class="text-xs mt-2">Com ${BRL(s)}, o banco rende centavos. Compre R$ 50 de balas ou doces e revenda. O objetivo é dobrar esse valor até sexta.</p></div>`;
    } else {
        box.innerHTML = `<div class="p-4 border-l-4 border-emerald-500 bg-emerald-500/10"><h4 class="font-black text-emerald-500">PLANO DE MULTIPLICAÇÃO</h4><p class="text-xs mt-2">Ótimo saldo! Coloque 50% em CDB Liquidez Diária e use os outros 50% para revenda de produtos físicos rápidos (Marketplace).</p></div>`;
    }
};

// --- GRÁFICO ---
function renderizarGraficoDividas() {
    const ctx = document.getElementById('chartDividas');
    if(chartInstance) chartInstance.destroy();
    const divs = financeiro.listaFluxo.filter(f => f.tipo === 'divida');
    document.getElementById("chartTotalLabel").innerText = BRL(financeiro.dividas);
    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: divs.map(d => d.nome), datasets: [{ data: divs.map(d => d.valor), backgroundColor: ['#ef4444','#f97316','#8b5cf6','#ec4899','#06b6d4'], borderWidth: 0 }] },
        options: { cutout: '80%', plugins: { legend: { display: false } } }
    });
    const lista = document.getElementById("listaDividasDetalhada");
    lista.innerHTML = "";
    divs.forEach((d, i) => {
        const perc = ((d.valor/financeiro.dividas)*100).toFixed(0);
        lista.innerHTML += `<div class="flex justify-between items-center p-4 glass-card border-r-4" style="border-color:${chartInstance.data.datasets[0].backgroundColor[i]}">
            <div class="text-xs"><b>${d.nome}</b><br><span class="opacity-50">${perc}% do total</span></div>
            <div class="flex items-center gap-3"><b>${BRL(d.valor)}</b><button onclick="gerenciarDivida('${d.id}','${d.nome}',${d.valor})" class="bg-rose-500/20 text-rose-500 p-2 rounded-lg text-[10px] font-black">GERIR</button></div>
        </div>`;
    });
}

// --- CRUD METAS ---
window.gerenciarMeta = async (id, nome, alvo) => {
    const { value: acao } = await Swal.fire({
        title: 'Gerenciar Meta', text: nome, background: '#161b30', color: '#fff',
        input: 'select', inputOptions: { editar: 'Alterar Nome/Valor', excluir: 'Apagar Meta' },
        showCancelButton: true
    });
    if (acao === 'excluir') {
        const c = await Swal.fire({ title: 'Apagar?', icon: 'warning', showCancelButton: true, background: '#161b30', color: '#fff' });
        if (c.isConfirmed) await deleteDoc(doc(db, "metas", id));
    } else if (acao === 'editar') {
        const { value: f } = await Swal.fire({
            title: 'Editar', background: '#161b30', color: '#fff',
            html: `<input id="en" class="swal2-input" value="${nome}"><input id="ev" type="number" class="swal2-input" value="${alvo}">`,
            preConfirm: () => [document.getElementById('en').value, document.getElementById('ev').value]
        });
        if (f) await updateDoc(doc(db, "metas", id), { nome: f[0], alvo: Number(f[1]) });
    }
};

window.ajustarMeta = async (id, atual) => {
    const { value: v } = await Swal.fire({ title: 'Quanto aportar?', input: 'number', background: '#161b30', color: '#fff' });
    if (v) await updateDoc(doc(db, "metas", id), { atual: atual + Number(v) });
};

// --- AUXILIARES ---
window.adicionarFluxo = async () => {
    const n = document.getElementById("fluxoNome").value;
    const v = Number(document.getElementById("fluxoValor").value);
    const d = Number(document.getElementById("fluxoDia").value) || 1;
    const t = document.getElementById("fluxoTipo").value;
    if(n && v) {
        await addDoc(collection(db, "fluxo"), { nome: n, valor: v, dia: d, tipo: t, userId: userUID });
        document.getElementById("fluxoNome").value = ""; document.getElementById("fluxoValor").value = "";
        Swal.fire({ icon: 'success', title: 'Salvo!', toast: true, position: 'top-end', timer: 1500, showConfirmButton: false });
    }
};

window.abrirModalMeta = async () => {
    const { value: f } = await Swal.fire({
        title: 'NOVA META', background: '#161b30', color: '#fff',
        html: '<input id="sw-n" class="swal2-input" placeholder="Nome"><input id="sw-v" type="number" class="swal2-input" placeholder="Alvo R$">',
        preConfirm: () => [document.getElementById('sw-n').value, document.getElementById('sw-v').value]
    });
    if(f) await addDoc(collection(db, "metas"), { nome: f[0], alvo: Number(f[1]), atual: 0, userId: userUID });
};

async function salvarHistoricoMensal() {
    const d = new Date();
    const id = `${userUID}_${d.getMonth()+1}_${d.getFullYear()}`;
    await setDoc(doc(db, "historico", id), { userId: userUID, mes: d.getMonth()+1, ano: d.getFullYear(), saldo: financeiro.saldo });
    const q = query(collection(db, "historico"), where("userId", "==", userUID));
    const snap = await getDocs(q);
    const grid = document.getElementById("gridHistorico"); grid.innerHTML = "";
    snap.forEach(doc => {
        const h = doc.data();
        grid.innerHTML += `<div class="min-w-[85px] p-3 glass-card text-center border ${h.saldo >= 0 ? 'border-emerald-500/20' : 'border-rose-500/20'}">
            <p class="text-[8px] opacity-50 uppercase">${h.mes}/${h.ano}</p>
            <p class="text-[10px] font-black ${h.saldo >= 0 ? 'text-emerald-400' : 'text-rose-500'}">${BRL(h.saldo)}</p>
        </div>`;
    });
}
