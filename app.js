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
let financeiro = { ganhos: 0, dividas: 0, listaFluxo: [] };

const BRL = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// --- AUTH ---
window.login = () => {
    const e = document.getElementById("email").value, s = document.getElementById("senha").value;
    signInWithEmailAndPassword(auth, e, s).catch(err => Swal.fire('Erro', 'Verifique seus dados', 'error'));
};
onAuthStateChanged(auth, user => {
    if (user) { userUID = user.uid; document.getElementById("loginTela").classList.add("hidden"); document.getElementById("dashboard").classList.remove("hidden"); inicializarListeners(); }
    else { document.getElementById("loginTela").classList.remove("hidden"); document.getElementById("dashboard").classList.add("hidden"); }
});

// --- LÓGICA DE CADASTRO DINÂMICO ---
window.mudarTabCadastro = (tipo) => {
    const btnSalario = document.querySelectorAll('button[onclick*="salario"]')[0];
    const btnExtra = document.querySelectorAll('button[onclick*="extra"]')[0];
    const inputTipo = document.getElementById('fluxoTipo');

    if (tipo === 'salario') {
        inputTipo.value = 'ganho';
        btnSalario.classList.replace('opacity-40', 'text-purple-400');
        btnExtra.classList.replace('text-purple-400', 'opacity-40');
    } else {
        inputTipo.value = 'divida';
        btnExtra.classList.replace('opacity-40', 'text-purple-400');
        btnSalario.classList.replace('text-purple-400', 'opacity-40');
    }
};

// --- ESCUTAR DADOS ---
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
        financeiro.ganhos = g; financeiro.dividas = d;
        renderizarTimeline();
        atualizarHP();
    });
}

function renderizarTimeline() {
    const lista = document.getElementById("listaTimeline");
    lista.innerHTML = "";
    const hoje = new Date().toISOString().split('T')[0];

    // Ordenar por data
    const itensOrdenados = financeiro.listaFluxo.sort((a,b) => new Date(a.data) - new Date(b.data));

    itensOrdenados.forEach(item => {
        const isFuturo = item.data > hoje;
        const corValor = item.tipo === 'ganho' ? 'text-emerald-400' : 'text-rose-500';
        const icone = item.tipo === 'ganho' ? '💰' : '💸';

        lista.innerHTML += `
        <div onclick="analisarViabilidade('${item.id}', '${item.nome}', ${item.valor}, '${item.tipo}')" 
             class="glass-card p-5 flex justify-between items-center transition-all active:scale-95 ${isFuturo ? 'futuro-badge opacity-70' : 'border-l-4 border-purple-500'}">
            <div class="flex items-center gap-3">
                <span class="text-xl">${icone}</span>
                <div>
                    <h4 class="text-xs font-black uppercase">${item.nome}</h4>
                    <p class="text-[9px] opacity-40 font-bold">${isFuturo ? '📅 AGENDADO: ' : '✅ DATA: '} ${formatarData(item.data)}</p>
                </div>
            </div>
            <b class="${corValor} text-xs">${BRL(item.valor)}</b>
        </div>`;
    });
}

// --- A INTELIGÊNCIA QUE VOCÊ PEDIU ---
window.analisarViabilidade = (id, nome, valor, tipo) => {
    if (tipo === 'ganho') {
        Swal.fire({ title: nome, text: "Este é um recebimento agendado.", background: '#0a0c14', color: '#fff' });
        return;
    }

    // Se for dívida, vamos ver se o salário cobre
    const salarioDisponivel = financeiro.ganhos;
    const sobra = salarioDisponivel - valor;

    if (sobra >= 0) {
        Swal.fire({
            title: 'Viabilidade de Pagamento',
            html: `Seu salário de <b>${BRL(salarioDisponivel)}</b> cobre esta dívida.<br><br>Após pagar <b>${nome}</b>, restará <b>${BRL(sobra)}</b>.`,
            icon: 'success',
            showCancelButton: true,
            confirmButtonText: 'Quitar Agora',
            cancelButtonText: 'Apenas Visualizar',
            background: '#0a0c14', color: '#fff'
        }).then(res => {
            if(res.isConfirmed) quitarItem(id);
        });
    } else {
        Swal.fire({
            title: 'Saldo Insuficiente',
            html: `Para pagar <b>${nome}</b> (${BRL(valor)}), faltam <b>${BRL(Math.abs(sobra))}</b> do seu salário atual.`,
            icon: 'warning',
            background: '#0a0c14', color: '#fff'
        });
    }
};

async function quitarItem(id) {
    await updateDoc(doc(db, "fluxo", id), { status: 'paga' });
    Swal.fire({ title: 'Pago!', icon: 'success', timer: 1000, showConfirmButton: false, background: '#0a0c14' });
}

window.adicionarFluxo = async () => {
    const n = document.getElementById("fluxoNome").value, 
          v = Number(document.getElementById("fluxoValor").value), 
          d = document.getElementById("fluxoData").value, 
          t = document.getElementById("fluxoTipo").value;
    
    if (n && v && d) { 
        await addDoc(collection(db, "fluxo"), { nome: n, valor: v, data: d, tipo: t, status: 'pendente', userId: userUID });
        limparCampos();
    }
};

// Auxiliares
function formatarData(dataStr) {
    const [ano, mes, dia] = dataStr.split('-');
    return `${dia}/${mes}`;
}
function limparCampos() {
    document.getElementById("fluxoNome").value = "";
    document.getElementById("fluxoValor").value = "";
}
function atualizarHP() {
    const hpFill = document.getElementById("hpFill");
    const perc = Math.max(0, 100 - (financeiro.dividas / (financeiro.ganhos || 1) * 100));
    hpFill.style.width = perc + "%";
}
window.mostrarSecao = (id, btn) => {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-btn-m').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
};
