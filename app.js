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

const BRL = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// --- AUTH & LOGIN ---
window.alternarAuth = () => {
    isRegisterMode = !isRegisterMode;
    const btnPrincipal = document.getElementById("btnPrincipal");
    const btnAlternar = document.getElementById("btnAlternar");
    const confirmContainer = document.getElementById("confirmarSenhaContainer");

    if (isRegisterMode) {
        btnPrincipal.innerText = "Criar Minha Conta";
        btnPrincipal.onclick = registrarUsuario;
        btnAlternar.innerText = "Já tenho conta? Fazer Login";
        confirmContainer.classList.remove("hidden");
    } else {
        btnPrincipal.innerText = "Acessar Painel";
        btnPrincipal.onclick = login;
        btnAlternar.innerText = "Novo usuário? Criar Senha";
        confirmContainer.classList.add("hidden");
    }
};

window.login = () => {
    const e = document.getElementById("email").value;
    const s = document.getElementById("senha").value;
    signInWithEmailAndPassword(auth, e, s)
        .catch(err => Swal.fire('Erro', 'E-mail ou senha inválidos', 'error'));
};

async function registrarUsuario() {
    const e = document.getElementById("email").value;
    const s = document.getElementById("senha").value;
    const sc = document.getElementById("senhaConfirm").value;

    if (s !== sc) return Swal.fire('Erro', 'As senhas não coincidem', 'warning');
    
    createUserWithEmailAndPassword(auth, e, s)
        .then(() => {
            Swal.fire('Sucesso', 'Conta criada! Faça seu login.', 'success');
            alternarAuth();
        })
        .catch(err => Swal.fire('Erro', err.message, 'error'));
}

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

// --- NAVEGAÇÃO ---
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
            // Só soma no dashboard se for do mês/ano ATUAL (Março 2026)
            if(item.mes == 3 && item.ano == 2026) {
                if(item.tipo === 'ganho') g += item.valor; else d += item.valor;
            }
            financeiro.listaFluxo.push({ ...item, id: docSnap.id });
        });
        financeiro.ganhos = g; financeiro.dividas = d; financeiro.saldo = g - d;
        atualizarDashboard();
        gerarPerformanceAnual();
    });

    onSnapshot(query(collection(db, "metas"), where("userId", "==", userUID)), snap => {
        const grid = document.getElementById("rankingGrid"); grid.innerHTML = "";
        let metasArr = [];
        snap.forEach(d => metasArr.push({ ...d.data(), id: d.id }));
        metasArr.sort((a,b) => (b.atual/b.alvo) - (a.atual/a.alvo));
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
                        <button onclick="gerenciarMeta('${m.id}', '${m.nome}', ${m.alvo})" class="bg-white/5 py-2 rounded-lg text-[10px] font-black uppercase">Editar</button>
                    </div>
                </div>`;
        });
    });
}

// --- PERFORMANCE ANUAL (12 POP-UPS) ---
function gerarPerformanceAnual() {
    const grid = document.getElementById("gridMesesAnual");
    grid.innerHTML = "";
    const mesesNomes = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

    for (let m = 1; m <= 12; m++) {
        const fluxosDoMes = financeiro.listaFluxo.filter(f => f.mes == m && f.ano == 2026);
        let saldoMes = 0;
        fluxosDoMes.forEach(f => {
            if(f.tipo === 'ganho') saldoMes += f.valor; else saldoMes -= f.valor;
        });

        const cor = saldoMes > 0 ? 'bg-emerald-500' : (saldoMes < 0 ? 'bg-rose-500' : 'bg-slate-700');
        
        grid.innerHTML += `
            <div onclick="popupMes(${m}, '${mesesNomes[m-1]}', ${saldoMes})" class="mes-dot ${cor} h-8 flex items-center justify-center text-[8px] font-black shadow-lg">
                ${mesesNomes[m-1][0]}
            </div>`;
    }
}

window.popupMes = (num, nome, saldo) => {
    const status = saldo >= 0 ? 'ALTA' : 'BAIXA';
    const corText = saldo >= 0 ? 'text-emerald-400' : 'text-rose-500';
    Swal.fire({
        title: `${nome} / 2026`,
        html: `Performance: <b class="${corText}">${status}</b><br>Saldo Final: <b>${BRL(saldo)}</b>`,
        background: '#161b30',
        color: '#fff',
        confirmButtonColor: '#a855f7'
    });
};

// --- GESTÃO DE DÍVIDAS (PARCELAMENTO) ---
window.gerenciarDivida = async (id, nome, valor) => {
    const { value: acao } = await Swal.fire({
        title: nome,
        input: 'select',
        inputOptions: { pagar: 'Já foi paga?', parcelar: 'Parcelar Dívida', excluir: 'Excluir Registro' },
        showCancelButton: true,
        background: '#161b30', color: '#fff'
    });

    if (acao === 'pagar') {
        await deleteDoc(doc(db, "fluxo", id));
        Swal.fire('Quitada!', 'A dívida sumiu do seu mapa.', 'success');
    } else if (acao === 'parcelar') {
        const { value: nParc } = await Swal.fire({ title: 'Parcelar em quantas vezes?', input: 'number', background: '#161b30', color: '#fff' });
        if (nParc > 1) {
            const valorParc = valor / nParc;
            // Atualiza a original como a primeira parcela
            await updateDoc(doc(db, "fluxo", id), { valor: valorParc, nome: `${nome} (1/${nParc})` });
            // Cria as próximas (simulação simplificada no mesmo mês para visualização)
            for (let i = 2; i <= nParc; i++) {
                await addDoc(collection(db, "fluxo"), {
                    nome: `${nome} (${i}/${nParc})`,
                    valor: valorParc,
                    tipo: 'divida',
                    mes: 3, // Simplificado: Ideal seria somar o mês
                    ano: 2026,
                    userId: userUID
                });
            }
            Swal.fire('Parcelado!', `Dívida dividida em ${nParc}x.`, 'success');
        }
    } else if (acao === 'excluir') {
        await deleteDoc(doc(db, "fluxo", id));
    }
};

// --- RESTANTE DAS FUNÇÕES ---
window.adicionarFluxo = async () => {
    const n = document.getElementById("fluxoNome").value;
    const v = Number(document.getElementById("fluxoValor").value);
    const m = Number(document.getElementById("fluxoMes").value);
    const a = Number(document.getElementById("fluxoAno").value);
    const t = document.getElementById("fluxoTipo").value;
    if(n && v) {
        await addDoc(collection(db, "fluxo"), { nome: n, valor: v, mes: m, ano: a, tipo: t, userId: userUID });
        document.getElementById("fluxoNome").value = ""; 
        document.getElementById("fluxoValor").value = "";
        Swal.fire({ icon: 'success', title: 'Salvo!', toast: true, position: 'top-end', timer: 2000, showConfirmButton: false });
    }
};

window.verHistoricoFluxo = () => {
    let html = `<div class="text-left space-y-2 max-h-64 overflow-y-auto no-scrollbar pr-2">`;
    financeiro.listaFluxo.forEach(f => {
        html += `<div class="flex justify-between items-center p-3 bg-white/5 rounded-xl mb-2">
            <div class="text-[10px]"><b>${f.nome}</b><br><span class="opacity-50">${f.mes}/${f.ano}</span></div>
            <div class="flex items-center gap-3">
                <b class="${f.tipo === 'ganho' ? 'text-emerald-400' : 'text-rose-500'}">${BRL(f.valor)}</b>
                <button onclick="excluirRegistro('${f.id}')" class="text-rose-500 font-bold">✕</button>
            </div>
        </div>`;
    });
    Swal.fire({ title: 'REGISTROS', html: html + `</div>`, showConfirmButton: false, background: '#161b30', color: '#fff' });
};

window.excluirRegistro = async (id) => { await deleteDoc(doc(db, "fluxo", id)); Swal.close(); };

function atualizarDashboard() {
    document.getElementById("receitaTotal").innerText = BRL(financeiro.ganhos);
    document.getElementById("despesaTotal").innerText = BRL(financeiro.dividas);
    document.getElementById("saldoTotal").innerText = BRL(financeiro.saldo);
    document.getElementById("iaTexto").innerText = financeiro.saldo < 0 ? "Alerta: Seus gastos de Março superam sua receita. Hora de amortizar dívidas!" : "Bom trabalho! Seu saldo está positivo, considere aportar em suas metas.";
}

function renderizarGraficoDividas() {
    const ctx = document.getElementById('chartDividas');
    if(chartInstance) chartInstance.destroy();
    const divs = financeiro.listaFluxo.filter(f => f.tipo === 'divida' && f.mes == 3);
    document.getElementById("chartTotalLabel").innerText = BRL(financeiro.dividas);
    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: divs.map(d => d.nome),
            datasets: [{ data: divs.map(d => d.valor), backgroundColor: ['#ef4444','#f97316','#8b5cf6','#ec4899','#06b6d4'], borderWidth: 0 }]
        },
        options: { cutout: '80%', plugins: { legend: { display: false } } }
    });
    const lista = document.getElementById("listaDividasDetalhada");
    lista.innerHTML = "";
    divs.forEach((d, i) => {
        lista.innerHTML += `<div class="flex justify-between items-center p-4 glass-card border-r-4" style="border-color:${chartInstance.data.datasets[0].backgroundColor[i]}">
            <div class="text-[11px]"><b>${d.nome}</b><br><span class="opacity-50">${d.mes}/${d.ano}</span></div>
            <div class="flex items-center gap-4"><b>${BRL(d.valor)}</b><button onclick="gerenciarDivida('${d.id}','${d.nome}',${d.valor})" class="bg-purple-600/20 text-purple-400 p-2 rounded-lg text-[10px] font-black uppercase">Gerir</button></div>
        </div>`;
    });
}
// Funções de Metas e Investimento seguem o padrão anterior corrigido...
window.gerenciarMeta = async (id, nome, alvo) => {
    const { value: acao } = await Swal.fire({
        title: 'Gerenciar Meta',
        input: 'select',
        inputOptions: { editar: 'Mudar Nome/Valor', excluir: 'Apagar Meta' },
        showCancelButton: true, background: '#161b30', color: '#fff'
    });
    if (acao === 'excluir') await deleteDoc(doc(db, "metas", id));
    else if (acao === 'editar') {
        const { value: f } = await Swal.fire({
            html: `<input id="en" class="swal2-input" value="${nome}"><input id="ev" type="number" class="swal2-input" value="${alvo}">`,
            preConfirm: () => [document.getElementById('en').value, document.getElementById('ev').value],
            background: '#161b30', color: '#fff'
        });
        if (f) await updateDoc(doc(db, "metas", id), { nome: f[0], alvo: Number(f[1]) });
    }
};
window.ajustarMeta = async (id, atual) => {
    const { value: v } = await Swal.fire({ title: 'Quanto aportar?', input: 'number', background: '#161b30', color: '#fff' });
    if (v) await updateDoc(doc(db, "metas", id), { atual: atual + Number(v) });
};
window.abrirModalMeta = async () => {
    const { value: f } = await Swal.fire({
        html: '<input id="mn" class="swal2-input" placeholder="Nome"><input id="ma" type="number" class="swal2-input" placeholder="Alvo R$">',
        preConfirm: () => [document.getElementById('mn').value, document.getElementById('ma').value],
        background: '#161b30', color: '#fff'
    });
    if(f) await addDoc(collection(db, "metas"), { nome: f[0], alvo: Number(f[1]), atual: 0, userId: userUID });
};
