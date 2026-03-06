import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
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
let usuarioAtual = null;

const BRL = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// --- UI E NAVEGAÇÃO ---
window.fecharModal = () => document.getElementById("modalBoasVindas").classList.add("hidden");
window.toggleChat = () => document.getElementById("janelaChat").classList.toggle("hidden");

window.mostrarSecao = (id, btn) => {
    const secoes = ['secDashboard', 'secContas', 'secDividas', 'secMetas'];
    secoes.forEach(s => document.getElementById(s).classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');

    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active', 'text-purple-400', 'bg-purple-900/20'));
    btn.classList.add('active', 'text-purple-400', 'bg-purple-900/20');
};

// --- AUTH ---
window.registrar = () => {
  const email = document.getElementById("email").value;
  const senha = document.getElementById("senha").value;
  createUserWithEmailAndPassword(auth, email, senha).catch(e => alert(e.message));
};

window.login = () => {
  const email = document.getElementById("email").value;
  const senha = document.getElementById("senha").value;
  signInWithEmailAndPassword(auth, email, senha).catch(e => alert(e.message));
};

window.logout = () => signOut(auth);

onAuthStateChanged(auth, user => {
  if (user) {
    usuarioAtual = user;
    document.getElementById("loginTela").classList.add("hidden");
    document.getElementById("dashboard").classList.replace("hidden", "flex");
    document.getElementById("modalBoasVindas").classList.remove("hidden");
    carregarDadosBase();
  } else {
    document.getElementById("loginTela").classList.remove("hidden");
    document.getElementById("dashboard").classList.replace("flex", "hidden");
  }
});

// --- FUNÇÕES DE NEGÓCIO ---

// 1. Ganhos Fixos (Agendamento)
window.adicionarReceita = async () => {
    const desc = document.getElementById("desc").value;
    const valor = Number(document.getElementById("valor").value);
    if (!desc || !valor) return alert("Preencha descrição e valor!");
    await addDoc(collection(db, "ganhosFixos"), { desc, valor, userId: usuarioAtual.uid });
    document.getElementById("desc").value = ""; document.getElementById("valor").value = "";
};

window.excluirGanhoFixo = async (id) => {
    if(confirm("Deseja remover este ganho fixo?")) await deleteDoc(doc(db, "ganhosFixos", id));
};

// 2. Reserva (Adicionar/Retirar)
window.alterarReserva = async (acao) => {
    const valor = Number(prompt(`${acao === 'adicionar' ? 'Quanto guardar?' : 'Quanto retirar?'}`));
    if (!valor || valor <= 0) return;
    const finalVal = acao === 'adicionar' ? valor : -valor;
    await addDoc(collection(db, "reserva"), { valor: finalVal, userId: usuarioAtual.uid, data: Date.now() });
};

// 3. Contas, Dívidas e Metas
window.adicionarConta = async () => {
    const nome = prompt("Banco:");
    const saldo = Number(prompt("Saldo:"));
    if (nome && !isNaN(saldo)) await addDoc(collection(db, "contas"), { nome, saldo, userId: usuarioAtual.uid });
};

window.adicionarDivida = async () => {
    const nome = prompt("Credor (Ex: Cartão):");
    const valor = Number(prompt("Valor total devido:"));
    if (nome && valor) await addDoc(collection(db, "dividas"), { nome, valor, userId: usuarioAtual.uid });
};

window.excluirItem = async (col, id) => {
    if(confirm("Excluir item?")) await deleteDoc(doc(db, col, id));
};

// --- CARREGAMENTO REATIVO (O CÉREBRO) ---
function carregarDadosBase() {
    let totalContas = 0;
    let totalDividas = 0;

    // Monitorar Contas para somar na Receita Principal
    onSnapshot(query(collection(db, "contas"), where("userId", "==", usuarioAtual.uid)), snap => {
        totalContas = 0;
        const lista = document.getElementById("listaContas"); lista.innerHTML = "";
        snap.forEach(d => {
            const data = d.data(); totalContas += data.saldo;
            lista.innerHTML += `<li class="flex justify-between p-4 glass-card rounded-xl"><span>${data.nome}</span> <div class="flex gap-4 font-black"><span>${BRL(data.saldo)}</span><button onclick="excluirItem('contas','${d.id}')" class="text-red-500 text-xs">X</button></div></li>`;
        });
        document.getElementById("receitaTotal").innerText = BRL(totalContas);
        atualizarResumos(totalContas, totalDividas);
    });

    // Monitorar Dívidas para somar no Dashboard
    onSnapshot(query(collection(db, "dividas"), where("userId", "==", usuarioAtual.uid)), snap => {
        totalDividas = 0;
        const lista = document.getElementById("listaDividas"); lista.innerHTML = "";
        snap.forEach(d => {
            const data = d.data(); totalDividas += data.valor;
            lista.innerHTML += `<li class="flex justify-between p-4 glass-card rounded-xl"><span>${data.nome}</span> <div class="flex gap-4 font-black"><span>${BRL(data.valor)}</span><button onclick="excluirItem('dividas','${d.id}')" class="text-red-500 text-xs">X</button></div></li>`;
        });
        document.getElementById("despesaTotal").innerText = BRL(totalDividas);
        atualizarResumos(totalContas, totalDividas);
    });

    // Monitorar Ganhos Fixos (Dashboard)
    onSnapshot(query(collection(db, "ganhosFixos"), where("userId", "==", usuarioAtual.uid)), snap => {
        const lista = document.getElementById("listaMovimentos"); lista.innerHTML = "";
        snap.forEach(d => {
            const m = d.data();
            lista.innerHTML += `<li class="flex justify-between p-3 bg-slate-900/50 rounded-xl border border-slate-800 text-xs">
                <span>${m.desc} (Mensal)</span> <div class="flex gap-3"><b>${BRL(m.valor)}</b><button onclick="excluirGanhoFixo('${d.id}')" class="text-red-500">Excluir</button></div>
            </li>`;
        });
    });

    // Monitorar Reserva
    onSnapshot(query(collection(db, "reserva"), where("userId", "==", usuarioAtual.uid)), snap => {
        let res = 0; snap.forEach(d => res += d.data().valor);
        document.getElementById("accumuladoReserva").innerText = BRL(res);
    });
}

function atualizarResumos(rec, div) {
    const saldo = rec - div;
    document.getElementById("saldoTotal").innerText = BRL(saldo);
    const perc = rec > 0 ? Math.max(0, Math.min(100, (saldo/rec)*100)) : 0;
    const barra = document.getElementById("barraProgresso");
    barra.style.width = perc + "%";
    document.getElementById("statusTexto").innerText = perc > 50 ? "SAUDÁVEL" : "CRÍTICO";
    barra.className = `progress-fill h-full ${perc > 50 ? 'bg-emerald-500' : 'bg-rose-500'}`;
}

// --- MENTOR IA ---
window.perguntaIA = () => {
    const input = document.getElementById("inputChat");
    const conteudo = document.getElementById("chatConteudo");
    if (!input.value) return;
    conteudo.innerHTML += `<div class="text-right text-blue-400">"${input.value}"</div>`;
    setTimeout(() => {
        conteudo.innerHTML += `<div class="bg-slate-800 p-3 rounded-xl">🤖 Tente focar em quitar as dívidas que somam ${document.getElementById("despesaTotal").innerText} antes de aumentar seus gastos fixos.</div>`;
        conteudo.scrollTop = conteudo.scrollHeight;
    }, 500);
    input.value = "";
};
