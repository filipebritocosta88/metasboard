import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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
let dadosGlobais = { rec: 0, div: 0, res: 0, metas: [], auto: 0 };

const BRL = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// --- UI ---
window.fecharModal = () => document.getElementById("modalBoasVindas").classList.add("hidden");
window.toggleChat = () => document.getElementById("janelaChat").classList.toggle("hidden");
window.mostrarSecao = (id, btn) => {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active', 'bg-purple-900/20'));
    btn.classList.add('active', 'bg-purple-900/20');
};

// --- AUTH ---
window.login = () => signInWithEmailAndPassword(auth, document.getElementById("email").value, document.getElementById("senha").value);
window.registrar = () => createUserWithEmailAndPassword(auth, document.getElementById("email").value, document.getElementById("senha").value);
window.logout = () => signOut(auth);

onAuthStateChanged(auth, user => {
    if (user) {
        usuarioAtual = user;
        document.getElementById("loginTela").classList.add("hidden");
        document.getElementById("dashboard").classList.replace("hidden", "flex");
        document.getElementById("modalBoasVindas").classList.remove("hidden");
        carregarSistema();
    } else {
        document.getElementById("loginTela").classList.remove("hidden");
        document.getElementById("dashboard").classList.replace("flex", "hidden");
    }
});

// --- LÓGICA DE DADOS ---
window.adicionarFixo = async () => {
    const desc = document.getElementById("descFixo").value;
    const valor = Number(document.getElementById("valorFixo").value);
    const dia = Number(document.getElementById("diaFixo").value);
    const tipo = document.getElementById("tipoFixo").value;
    if (!desc || !valor || !dia) return alert("Preencha todos os campos!");
    await addDoc(collection(db, "agendamentos"), { desc, valor, dia, tipo, userId: usuarioAtual.uid, ultimoMes: "" });
    document.getElementById("descFixo").value = "";
    document.getElementById("valorFixo").value = "";
    document.getElementById("diaFixo").value = "";
};

window.adicionarMeta = async () => {
    const nome = prompt("Nome da Meta:");
    const alvo = Number(prompt("Valor Alvo:"));
    if (nome && alvo) await addDoc(collection(db, "metas"), { nome, alvo, atual: 0, userId: usuarioAtual.uid });
};

window.alterarReserva = async (acao) => {
    const v = Number(prompt(acao === 'adicionar' ? "Guardar quanto?" : "Retirar quanto?"));
    if (v > 0) await addDoc(collection(db, "reserva"), { valor: acao === 'adicionar' ? v : -v, userId: usuarioAtual.uid });
};

window.excluirDoc = async (col, id) => {
    if (confirm("Deseja realmente excluir?")) await deleteDoc(doc(db, col, id));
};

window.atualizarMeta = async (id, atual) => {
    const novo = Number(prompt("Novo valor acumulado:", atual));
    if (!isNaN(novo)) await updateDoc(doc(db, "metas", id), { atual: novo });
};

window.adicionarConta = async () => {
    const n = prompt("Nome do Banco:"); const s = Number(prompt("Saldo atual:"));
    if (n) await addDoc(collection(db, "contas"), { nome: n, saldo: s, userId: usuarioAtual.uid });
};

// --- CARREGAMENTO REALTIME ---
function carregarSistema() {
    // 1. Contas -> Receita
    onSnapshot(query(collection(db, "contas"), where("userId", "==", usuarioAtual.uid)), snap => {
        let total = 0; const lista = document.getElementById("listaContas"); lista.innerHTML = "";
        snap.forEach(d => {
            total += d.data().saldo;
            lista.innerHTML += `<li class="flex justify-between p-3 glass-card rounded-xl"><span>${d.data().nome}</span> <div class="flex gap-4"><b>${BRL(d.data().saldo)}</b> <button onclick="excluirDoc('contas','${d.id}')" class="text-red-500 text-xs">Excluir</button></div></li>`;
        });
        dadosGlobais.rec = total; atualizarDashboard();
    });

    // 2. Dívidas + Agendamentos de Dívida -> Total Dívidas
    onSnapshot(query(collection(db, "dividas"), where("userId", "==", usuarioAtual.uid)), snap => {
        let manual = 0; const lista = document.getElementById("listaDividas"); lista.innerHTML = "";
        snap.forEach(d => {
            manual += d.data().valor;
            lista.innerHTML += `<li class="flex justify-between p-3 glass-card rounded-xl border-l-2 border-rose-500"><span>${d.data().nome}</span> <div class="flex gap-4"><b>${BRL(d.data().valor)}</b> <button onclick="excluirDoc('dividas','${d.id}')" class="text-red-500 text-xs">Excluir</button></div></li>`;
        });
        dadosGlobais.div_manual = manual; atualizarDashboard();
    });

    // 3. Agendamentos (Calcula soma para o Dashboard e lista na tela)
    onSnapshot(query(collection(db, "agendamentos"), where("userId", "==", usuarioAtual.uid)), snap => {
        let autoDiv = 0; const lista = document.getElementById("listaGanhosFixos"); lista.innerHTML = "";
        snap.forEach(d => {
            const data = d.data();
            if(data.tipo === 'divida') autoDiv += data.valor;
            lista.innerHTML += `
                <li class="flex justify-between p-3 bg-slate-900/50 rounded-xl border border-slate-800 text-[10px]">
                    <span class="${data.tipo==='ganho'?'text-emerald-400':'text-rose-400'} font-bold">${data.desc} (Dia ${data.dia})</span>
                    <div class="flex gap-3"><b>${BRL(data.valor)}</b> <button onclick="excluirDoc('agendamentos','${d.id}')" class="text-red-500">X</button></div>
                </li>`;
        });
        dadosGlobais.div_auto = autoDiv; atualizarDashboard();
    });

    // 4. Metas
    onSnapshot(query(collection(db, "metas"), where("userId", "==", usuarioAtual.uid)), snap => {
        const grid = document.getElementById("gridMetas"); grid.innerHTML = "";
        dadosGlobais.metas = [];
        snap.forEach(d => {
            const m = d.data(); const p = Math.min(100, (m.atual / m.alvo) * 100).toFixed(0);
            dadosGlobais.metas.push(m);
            grid.innerHTML += `
                <div class="glass-card p-6 rounded-[2rem] border border-yellow-500/10">
                    <div class="flex justify-between mb-2"><b>${m.nome}</b> <span class="text-yellow-500 font-black">${p}%</span></div>
                    <div class="meta-progress mb-4"><div class="meta-bar" style="width: ${p}%"></div></div>
                    <div class="flex justify-between text-[10px] text-slate-500 mb-4"><span>Acumulado: ${BRL(m.atual)}</span> <span>Alvo: ${BRL(m.alvo)}</span></div>
                    <div class="flex gap-2">
                        <button onclick="atualizarMeta('${d.id}', ${m.atual})" class="flex-1 bg-slate-800 py-2 rounded-xl text-[10px] font-bold">ATUALIZAR</button>
                        <button onclick="excluirDoc('metas','${d.id}')" class="bg-red-900/20 px-3 rounded-xl text-red-500">X</button>
                    </div>
                </div>`;
        });
    });

    // 5. Reserva
    onSnapshot(query(collection(db, "reserva"), where("userId", "==", usuarioAtual.uid)), snap => {
        let res = 0; snap.forEach(d => res += d.data().valor);
        dadosGlobais.res = res;
        document.getElementById("accumuladoReserva").innerText = BRL(res);
    });
}

function atualizarDashboard() {
    const totalDiv = (dadosGlobais.div_manual || 0) + (dadosGlobais.div_auto || 0);
    const saldo = dadosGlobais.rec - totalDiv;
    
    document.getElementById("receitaTotal").innerText = BRL(dadosGlobais.rec);
    document.getElementById("despesaTotal").innerText = BRL(totalDiv);
    document.getElementById("saldoTotal").innerText = BRL(saldo);
    
    const perc = dadosGlobais.rec > 0 ? Math.max(0, (saldo / dadosGlobais.rec) * 100) : 0;
    document.getElementById("barraProgresso").style.width = perc + "%";
}

// --- CHAT IA PRO ---
window.perguntaIA = (sugestao) => {
    const input = document.getElementById("inputChat");
    const cont = document.getElementById("chatConteudo");
    const q = sugestao || input.value;
    if (!q) return;

    cont.innerHTML += `<div class="bg-purple-900/20 p-3 rounded-xl ml-8 text-right text-purple-400 font-bold border border-purple-500/20">${q}</div>`;
    
    let resp = "Estou analisando... Tente perguntar sobre seu 'saldo' ou 'dicas'.";
    const low = q.toLowerCase();

    if(low.includes("saúde") || low.includes("relatório") || low.includes("saldo")) {
        const saldo = dadosGlobais.rec - (dadosGlobais.div_manual + dadosGlobais.div_auto);
        resp = `Seu saldo livre projetado é ${BRL(saldo)}. Suas dívidas automáticas somam ${BRL(dadosGlobais.div_auto)}. ${saldo < 0 ? 'ALERTA: Suas dívidas superam sua receita!' : 'Você está no azul, continue assim!'}`;
    } else if(low.includes("metas")) {
        resp = `Você tem ${dadosGlobais.metas.length} metas. ${dadosGlobais.metas.length > 0 ? 'Foque na meta ' + dadosGlobais.metas[0].nome : 'Que tal criar uma nova meta hoje?'}`;
    } else if(low.includes("economia") || low.includes("dica")) {
        resp = "Dica: Tente guardar 10% da sua receita fixa assim que ela cair na conta. Atualmente sua receita é de " + BRL(dadosGlobais.rec);
    }

    setTimeout(() => {
        cont.innerHTML += `<div class="bg-slate-800 p-4 rounded-xl border-l-4 border-purple-500 text-slate-300">🤖 ${resp}</div>`;
        cont.scrollTop = cont.scrollHeight;
    }, 600);
    input.value = "";
};
