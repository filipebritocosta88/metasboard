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

// --- UI CONTROLS ---
window.fecharModal = () => document.getElementById("modalBoasVindas").classList.add("hidden");
window.toggleChat = () => document.getElementById("janelaChat").classList.toggle("hidden");

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

// --- FIREBASE OBSERVER ---
onAuthStateChanged(auth, user => {
  if (user) {
    usuarioAtual = user;
    document.getElementById("loginTela").classList.add("hidden");
    document.getElementById("dashboard").classList.replace("hidden", "flex");
    document.getElementById("modalBoasVindas").classList.remove("hidden");
    carregarTudo();
  } else {
    document.getElementById("loginTela").classList.remove("hidden");
    document.getElementById("dashboard").classList.replace("flex", "hidden");
  }
});

// --- MOVIMENTOS ---
window.adicionarReceita = async () => {
    const desc = document.getElementById("desc").value;
    const valor = Number(document.getElementById("valor").value);
    if (!desc || !valor) return alert("Preencha os campos corretamente!");
    await addDoc(collection(db, "movimentos"), { desc, valor, tipo: "receita", userId: usuarioAtual.uid, criadoEm: Date.now() });
    document.getElementById("desc").value = "";
    document.getElementById("valor").value = "";
};

// --- RESERVA ---
window.guardarReserva = async () => {
    const v = Number(prompt("Quanto deseja guardar hoje?"));
    if (v > 0) await addDoc(collection(db, "reserva"), { valor: v, userId: usuarioAtual.uid, data: Date.now() });
};

// --- CONTAS, DIVIDAS, METAS (BOTÕES ATIVADOS) ---
window.adicionarConta = async () => {
    const nome = prompt("Banco ou Carteira:");
    const saldo = Number(prompt("Saldo inicial:"));
    if (nome && !isNaN(saldo)) await addDoc(collection(db, "contas"), { nome, saldo, userId: usuarioAtual.uid });
};

window.adicionarDivida = async () => {
    const nome = prompt("Descrição da dívida:");
    const valor = Number(prompt("Valor total:"));
    if (nome && valor) await addDoc(collection(db, "dividas"), { nome, valor, userId: usuarioAtual.uid, status: "Pendente" });
};

window.adicionarMeta = async () => {
    const nome = prompt("O que deseja conquistar?");
    const valor = Number(prompt("Valor alvo:"));
    if (nome && valor) await addDoc(collection(db, "metas"), { nome, valor, atual: 0, userId: usuarioAtual.uid });
};

// --- CARREGAMENTO CENTRALIZADO ---
function carregarTudo() {
    // Carregar Dashboard e Movimentos
    onSnapshot(query(collection(db, "movimentos"), where("userId", "==", usuarioAtual.uid)), snap => {
        let r = 0, d = 2630; // 2630 como base fixa para dívidas se quiser manter o visual da imagem
        const lista = document.getElementById("listaMovimentos");
        lista.innerHTML = "";
        snap.forEach(docSnap => {
            const m = docSnap.data();
            r += m.valor;
            lista.innerHTML += `<li class="flex justify-between p-4 bg-[#0b0e14] rounded-2xl border border-slate-800 text-sm">
                <span>${m.desc}</span> <span class="font-black text-emerald-400">${BRL(m.valor)}</span>
            </li>`;
        });
        document.getElementById("receitaTotal").innerText = BRL(r);
        document.getElementById("despesaTotal").innerText = BRL(d);
        document.getElementById("saldoTotal").innerText = BRL(r - d);
        
        const perc = r > 0 ? Math.max(0, 100 - (d/r * 100)) : 0;
        document.getElementById("barraProgresso").style.width = perc + "%";
        document.getElementById("statusTexto").innerText = perc > 50 ? "SAUDÁVEL" : "ALERTA";
    });

    // Carregar Reserva
    onSnapshot(query(collection(db, "reserva"), where("userId", "==", usuarioAtual.uid)), snap => {
        let total = 0;
        snap.forEach(d => total += d.data().valor);
        document.getElementById("acumuladoReserva").innerText = BRL(total);
    });

    // Carregar Contas, Dívidas e Metas para as abas específicas
    const listas = { contas: "listaContas", dividas: "listaDividas", metas: "listaMetas" };
    Object.keys(listas).forEach(colecao => {
        onSnapshot(query(collection(db, colecao), where("userId", "==", usuarioAtual.uid)), snap => {
            const el = document.getElementById(listas[colecao]);
            el.innerHTML = "";
            snap.forEach(d => {
                const data = d.data();
                el.innerHTML += `<li class="flex justify-between items-center p-4 glass-card rounded-2xl">
                    <span class="font-bold">${data.nome}</span>
                    <span class="font-black text-purple-400">${BRL(data.valor || data.saldo || 0)}</span>
                </li>`;
            });
        });
    });
}

// --- MENTOR IA ---
window.perguntaIA = () => {
    const input = document.getElementById("inputChat");
    const conteudo = document.getElementById("chatConteudo");
    const msg = input.value.toLowerCase();
    if (!msg) return;

    conteudo.innerHTML += `<div class="bg-blue-900/40 p-3 rounded-2xl ml-auto text-right max-w-[80%] border border-blue-500/30">${msg}</div>`;
    
    let resp = "Para dicas personalizadas, me pergunte sobre 'reserva', 'dívidas' ou 'meta'.";
    if (msg.includes("reserva")) resp = "Tente guardar 10% do seu saldo. O ideal é ter 6 meses de gastos guardados.";
    if (msg.includes("dívida")) resp = "Ataque a dívida com maior juros primeiro. Renegociar é sempre uma opção!";
    if (msg.includes("meta")) resp = "Divida sua meta em marcos pequenos. Isso mantém a motivação alta!";

    setTimeout(() => {
        conteudo.innerHTML += `<div class="bg-slate-800 p-4 rounded-2xl mr-auto max-w-[80%] border-l-4 border-blue-500 text-slate-300">🤖 ${resp}</div>`;
        conteudo.scrollTop = conteudo.scrollHeight;
    }, 600);
    input.value = "";
};
