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
let financeiro = { ganhos: 0, dividas: 0, saldo: 0, listaFluxo: [], quitadas: [] };
let chartInstance = null;

const BRL = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// --- AUTH ---
window.alternarAuth = () => {
    isRegisterMode = !isRegisterMode;
    document.getElementById("btnPrincipal").innerText = isRegisterMode ? "Criar Minha Conta" : "Acessar";
    document.getElementById("confirmarSenhaContainer").classList.toggle("hidden", !isRegisterMode);
};

window.login = () => {
    const e = document.getElementById("email").value, s = document.getElementById("senha").value;
    if (isRegisterMode) createUserWithEmailAndPassword(auth, e, s).catch(err => alert(err.message));
    else signInWithEmailAndPassword(auth, e, s).catch(err => alert("Erro no login"));
};

onAuthStateChanged(auth, user => {
    if (user) { userUID = user.uid; document.getElementById("loginTela").classList.add("hidden"); document.getElementById("dashboard").classList.remove("hidden"); inicializarListeners(); }
    else { document.getElementById("loginTela").classList.remove("hidden"); document.getElementById("dashboard").classList.add("hidden"); }
});

window.logout = () => signOut(auth);

// --- LISTENERS ---
function inicializarListeners() {
    onSnapshot(query(collection(db, "fluxo"), where("userId", "==", userUID)), snap => {
        financeiro.listaFluxo = []; financeiro.quitadas = [];
        snap.forEach(d => {
            const data = d.data();
            if (data.status === 'paga') financeiro.quitadas.push({ ...data, id: d.id });
            else financeiro.listaFluxo.push({ ...data, id: d.id });
        });
        atualizarCalculos();
        gerarPerformanceAnual();
    });

    onSnapshot(query(collection(db, "metas"), where("userId", "==", userUID)), snap => {
        const grid = document.getElementById("rankingGrid"); grid.innerHTML = "";
        snap.forEach(d => {
            const m = d.data(); const perc = Math.min(100, (m.atual / m.alvo) * 100).toFixed(0);
            grid.innerHTML += `<div class="glass-card p-5 border-t-2 border-purple-500/20">
                <h4 class="text-xs font-black uppercase mb-3">${m.nome}</h4>
                <div class="h-1.5 bg-black/40 rounded-full mb-2"><div class="h-full bg-purple-600 rounded-full" style="width: ${perc}%"></div></div>
                <div class="flex justify-between text-[10px] mb-4"><span>${BRL(m.atual)}</span><span>${perc}%</span></div>
                <button onclick="ajustarMeta('${d.id}', ${m.atual})" class="w-full bg-white/5 py-2 rounded-lg text-[10px] font-bold">APORTAR</button>
            </div>`;
        });
    });
}

function atualizarCalculos(filtroData = null, filtroTipo = null) {
    let g = 0, d = 0;
    financeiro.listaFluxo.forEach(item => {
        const dataItem = new Date(item.data + "T00:00:00");
        let valid = true;
        if (filtroData) valid = (dataItem >= filtroData.inicio && dataItem <= filtroData.fim);
        if (filtroTipo && item.tipo !== filtroTipo) valid = false;

        if (valid) { if (item.tipo === 'ganho') g += item.valor; else d += item.valor; }
    });

    document.getElementById("receitaTotal").innerText = BRL(g);
    document.getElementById("despesaTotal").innerText = BRL(d);
    document.getElementById("saldoTotal").innerText = BRL(g - d);
    document.getElementById("saldoInvestLabel").innerText = BRL(g - d);
    financeiro.saldo = g - d; financeiro.dividas = d;

    if (!document.getElementById("secDividas").classList.contains("hidden")) renderizarGraficoDividas();
}

// --- FILTRO POR CARD ---
window.filtrarPorCard = async (tipo) => {
    const { value: formValues } = await Swal.fire({
        title: `Filtro de ${tipo === 'ganho' ? 'Entradas' : 'Dívidas'}`,
        html: '<input id="d1" type="date" class="swal2-input"><input id="d2" type="date" class="swal2-input">',
        confirmButtonText: 'Filtrar',
        showCancelButton: true,
        preConfirm: () => ({ inicio: new Date(document.getElementById('d1').value), fim: new Date(document.getElementById('d2').value) })
    });
    if (formValues && formValues.inicio) atualizarCalculos(formValues, tipo);
};

// --- GESTÃO E COFRE ---
function renderizarGraficoDividas() {
    const ctx = document.getElementById('chartDividas');
    if (chartInstance) chartInstance.destroy();
    const divs = financeiro.listaFluxo.filter(f => f.tipo === 'divida');
    document.getElementById("chartTotalLabel").innerText = BRL(financeiro.dividas);
    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: divs.map(d => d.nome),
            datasets: [{ data: divs.map(d => d.valor), backgroundColor: ['#ef4444','#f97316','#8b5cf6','#06b6d4'], borderWidth: 0 }]
        },
        options: { cutout: '80%', plugins: { legend: { display: false } } }
    });

    const lista = document.getElementById("listaDividasDetalhada"); lista.innerHTML = "";
    divs.forEach(d => {
        lista.innerHTML += `<div class="flex justify-between items-center p-4 glass-card border border-white/5">
            <div class="text-[11px]"><b class="uppercase">${d.nome}</b><br><span class="opacity-50 text-[9px]">${d.data}</span></div>
            <div class="flex items-center gap-3"><b>${BRL(d.valor)}</b><button onclick="gerenciarDividaPRO('${d.id}', '${d.nome}', ${d.valor})" class="bg-purple-600/10 text-purple-400 px-3 py-1 rounded-lg text-[10px] font-black">GERIR</button></div>
        </div>`;
    });
}

window.gerenciarDividaPRO = async (id, nome, valor) => {
    const { value: acao } = await Swal.fire({
        title: 'Gerir Débito',
        input: 'select',
        inputOptions: { paga: '✅ Marcar como Paga', parc: '分 Parcelar', edit: '✏️ Editar Nome/Valor', del: '🗑️ Excluir' },
        showCancelButton: true
    });

    if (acao === 'paga') {
        await updateDoc(doc(db, "fluxo", id), { status: 'paga', dataPagamento: new Date().toISOString().split('T')[0] });
        Swal.fire('Ótimo!', 'Dívida enviada para o cofre de quitadas.', 'success');
    } else if (acao === 'del') {
        await deleteDoc(doc(db, "fluxo", id));
    } else if (acao === 'edit') {
        const { value: f } = await Swal.fire({
            html: `<input id="en" class="swal2-input" value="${nome}"><input id="ev" type="number" class="swal2-input" value="${valor}">`,
            preConfirm: () => [document.getElementById('en').value, document.getElementById('ev').value]
        });
        if (f) await updateDoc(doc(db, "fluxo", id), { nome: f[0], valor: Number(f[1]) });
    } else if (acao === 'parc') {
        const { value: p } = await Swal.fire({ title: 'Quantas parcelas?', input: 'number' });
        if (p > 1) {
            await deleteDoc(doc(db, "fluxo", id));
            for(let i=1; i<=p; i++) {
                await addDoc(collection(db, "fluxo"), { nome: `${nome} (${i}/${p})`, valor: valor/p, data: new Date().toISOString().split('T')[0], tipo: 'divida', userId: userUID });
            }
        }
    }
};

window.verCofreQuitadas = () => {
    let html = `<div class="space-y-2 max-h-80 overflow-y-auto no-scrollbar">`;
    financeiro.quitadas.forEach(q => {
        html += `<div class="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex justify-between items-center text-left">
            <div class="text-[10px]"><b class="uppercase">${q.nome}</b><br><span class="opacity-50">Paga em: ${q.dataPagamento}</span></div>
            <b class="text-emerald-400 text-xs">${BRL(q.valor)}</b>
        </div>`;
    });
    if(financeiro.quitadas.length === 0) html = "<p class='opacity-50 text-xs text-center py-10'>Nenhuma dívida quitada ainda.</p>";
    Swal.fire({ title: '📁 COFRE DE QUITADAS', html: html + `</div>`, showConfirmButton: false });
};

// --- INVEST IA PRO ---
window.analisarIA = (perfil) => {
    const box = document.getElementById("boxResultadoInvest"); box.classList.remove("hidden");
    const s = financeiro.saldo;
    if (s <= 0) {
        box.innerHTML = `<div class="glass-card p-6 border border-rose-500/20"><h4 class="text-rose-500 font-black">DÉFICIT DETECTADO</h4><p class="text-xs opacity-70 mt-2">Você está no vermelho. Sugestão: Quitar a dívida de maior juros primeiro. Não invista agora.</p></div>`;
        return;
    }

    const perfis = {
        conservador: { t: "RESERVA DE PAZ", d: "70% CDB 100% CDI, 30% Tesouro Selic.", i: "Foco total em liquidez. Seu dinheiro está seguro e disponível." },
        moderado: { t: "EQUILÍBRIO ATIVO", d: "50% CDB, 30% Fundos Imobiliários, 20% Ações.", i: "Geração de renda passiva mensal com FIIs." },
        agressivo: { t: "MÁXIMA ESCALADA", d: "40% Ações Brasil, 40% Stocks (EUA), 20% Cripto.", i: "Busca de 10x o capital em 24-36 meses. Risco alto." }
    };

    const p = perfis[perfil];
    box.innerHTML = `<div class="glass-card p-6 border border-emerald-500/20 animate-pulse">
        <h4 class="text-emerald-400 font-black uppercase text-sm">${p.t}</h4>
        <p class="text-[10px] mt-2 italic text-slate-400">${p.d}</p>
        <p class="text-xs mt-4 leading-relaxed">${p.i}</p>
        <div class="mt-4 pt-4 border-t border-white/5 flex justify-between items-center text-[10px] font-black">
            <span>POTENCIAL DE LUCRO:</span><span class="text-emerald-400">+12% a +35% AA</span>
        </div>
    </div>`;
};

// --- AUXILIARES ---
window.adicionarFluxo = async () => {
    const n = document.getElementById("fluxoNome").value, v = Number(document.getElementById("fluxoValor").value), d = document.getElementById("fluxoData").value, t = document.getElementById("fluxoTipo").value;
    if (n && v && d) { await addDoc(collection(db, "fluxo"), { nome: n, valor: v, data: d, tipo: t, status: 'pendente', userId: userUID }); Swal.fire({ icon:'success', title: 'Salvo!', toast:true, position:'top-end', showConfirmButton:false, timer:1500 }); }
};

window.mostrarSecao = (id, btn) => {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-btn-m').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (id === 'secDividas') setTimeout(renderizarGraficoDividas, 100);
};

function gerarPerformanceAnual() {
    const grid = document.getElementById("gridMesesAnual"); grid.innerHTML = "";
    const meses = ["J","F","M","A","M","J","J","A","S","O","N","D"];
    for (let m = 0; m < 12; m++) {
        let saldo = 0;
        financeiro.listaFluxo.filter(f => new Date(f.data + "T00:00:00").getMonth() === m).forEach(f => { if(f.tipo === 'ganho') saldo += f.valor; else saldo -= f.valor; });
        const cor = saldo > 0 ? 'bg-emerald-500' : (saldo < 0 ? 'bg-rose-500' : 'bg-slate-800');
        grid.innerHTML += `<div class="mes-dot ${cor} text-white">${meses[m]}</div>`;
    }
}
