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

// --- DASHBOARD ---
window.mostrarSecao = (id, btn) => {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-btn-m').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if(id === 'secDividas') setTimeout(renderizarGraficoDividas, 100);
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
    
    const iaTexto = document.getElementById("iaTexto");
    const iaCard = document.getElementById("iaCard");
    const comprometimento = financeiro.ganhos > 0 ? (financeiro.dividas / financeiro.ganhos) * 100 : 0;

    if (comprometimento > 70) {
        iaCard.classList.replace('border-purple-500', 'border-rose-500');
        iaTexto.innerHTML = `<span class="text-rose-500 font-black italic">ALERTA CRÍTICO:</span> Suas dívidas consomem ${comprometimento.toFixed(0)}% da renda. Pare de gastar imediatamente!`;
    } else {
        iaCard.classList.replace('border-rose-500', 'border-purple-500');
        iaTexto.innerText = financeiro.saldo > 0 ? "Fluxo saudável. Momento ideal para focar nas metas." : "Dica: Revise seus gastos variáveis para aumentar o aporte mensal.";
    }
}

// --- FUNÇÕES DE AÇÃO ---
window.adicionarFluxo = async () => {
    const n = document.getElementById("fluxoNome").value, 
          v = Number(document.getElementById("fluxoValor").value), 
          d = document.getElementById("fluxoData").value, 
          t = document.getElementById("fluxoTipo").value,
          c = document.getElementById("fluxoCat").value;

    if (n && v && d) { 
        await addDoc(collection(db, "fluxo"), { nome: n, valor: v, data: d, tipo: t, categoria: c, status: 'pendente', userId: userUID });
        document.getElementById("fluxoNome").value = "";
        document.getElementById("fluxoValor").value = "";
        Swal.fire({ icon:'success', title:'Salvo!', toast:true, position:'top-end', timer:1500, showConfirmButton:false });
    } else {
        Swal.fire('Atenção', 'Preencha todos os campos!', 'warning');
    }
};

window.simularJuros = () => {
    const aporte = Number(document.getElementById('simuMes').value);
    const anos = Number(document.getElementById('simuAnos').value);
    const meses = anos * 12;
    const taxaMensal = Math.pow(1 + 0.12, 1/12) - 1;
    const total = aporte * (Math.pow(1 + taxaMensal, meses) - 1) / taxaMensal;
    const res = document.getElementById('resSimulador');
    res.classList.remove('hidden');
    res.innerHTML = `<p class="text-[9px] uppercase opacity-50 italic">Em ${anos} anos você teria:</p><h4 class="text-xl font-black text-emerald-400">${BRL(total)}</h4>`;
};

// As funções de gráfico e modal de metas continuam seguindo a mesma lógica original
function renderizarGraficoDividas() {
    const ctx = document.getElementById('chartDividas');
    if(chartInstance) chartInstance.destroy();
    const divs = financeiro.listaFluxo.filter(f => f.tipo === 'divida' && f.status !== 'paga');
    
    // Agrupar por categoria para o gráfico
    const categorias = {};
    divs.forEach(d => categorias[d.categoria] = (categorias[d.categoria] || 0) + d.valor);

    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(categorias),
            datasets: [{ data: Object.values(categorias), backgroundColor: ['#ef4444','#f97316','#8b5cf6','#ec4899'], borderWidth: 0 }]
        },
        options: { cutout: '80%', plugins: { legend: { display: false } } }
    });

    const lista = document.getElementById("listaDividasDetalhada"); lista.innerHTML = "";
    divs.forEach(d => {
        lista.innerHTML += `<div class="flex justify-between items-center p-4 glass-card">
            <div class="text-[10px]"><b class="uppercase">${d.nome}</b><br><span class="opacity-40">${d.categoria} | ${d.data}</span></div>
            <button onclick="gerenciarDivida('${d.id}', '${d.nome}', ${d.valor})" class="text-purple-400 font-black text-[10px]">GERIR</button>
        </div>`;
    });
}
// (Demais funções window.gerenciarDivida, abrirCofre, etc seguem o padrão enviado anteriormente)
