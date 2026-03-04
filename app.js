import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Mantenha sua configuração aqui
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

// Helper: Formatar Moeda
const BRL = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);

// ----- LOGIN / REGISTRO -----
window.registrar = () => {
  const email = document.getElementById("email").value;
  const senha = document.getElementById("senha").value;
  if(!email || !senha) return alert("Preencha todos os campos");
  createUserWithEmailAndPassword(auth, email, senha).catch(e => alert("Erro ao criar conta: " + e.message));
};

window.login = () => {
  const email = document.getElementById("email").value;
  const senha = document.getElementById("senha").value;
  signInWithEmailAndPassword(auth, email, senha).catch(e => alert("Dados incorretos: " + e.message));
};

window.logout = () => signOut(auth);

// ----- MOVIMENTOS -----
window.adicionarReceita = () => salvarMovimento("receita");
window.adicionarDespesa = () => salvarMovimento("despesa");

async function salvarMovimento(tipo) {
  const valorInput = document.getElementById("valor");
  const catInput = document.getElementById("categoriaTransacao");
  const valor = Number(valorInput.value);
  const categoria = catInput.value || "Geral";

  if (!valor || valor <= 0) return alert("Digite um valor válido");

  await addDoc(collection(db, "movimentos"), {
    tipo,
    valor,
    categoria,
    userId: usuarioAtual.uid,
    criadoEm: Date.now()
  });

  valorInput.value = "";
  catInput.value = "";
}

// ----- FUNÇÕES DE CARREGAMENTO (SNAPSHOT REAL-TIME) -----

function carregarMovimentos() {
  const q = query(collection(db, "movimentos"), where("userId", "==", usuarioAtual.uid), orderBy("criadoEm", "desc"));
  
  onSnapshot(q, snapshot => {
    let receita = 0, despesa = 0;
    const lista = document.getElementById("listaMovimentos");
    lista.innerHTML = "";

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const id = docSnap.id;
      if (data.tipo === "receita") receita += data.valor;
      else despesa += data.valor;

      const item = document.createElement("li");
      item.className = "flex justify-between items-center p-4 bg-slate-900/50 rounded-2xl border border-slate-700/50 hover:border-slate-500 transition-all";
      item.innerHTML = `
        <div class="flex items-center gap-4">
            <div class="w-10 h-10 rounded-full flex items-center justify-center ${data.tipo === 'receita' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'}">
                <i class="fas ${data.tipo === 'receita' ? 'fa-arrow-up' : 'fa-arrow-down'} text-sm"></i>
            </div>
            <div>
                <p class="font-bold text-slate-100">${data.categoria}</p>
                <p class="text-xs text-slate-500">${new Date(data.criadoEm).toLocaleDateString()}</p>
            </div>
        </div>
        <div class="flex items-center gap-4">
            <span class="font-bold ${data.tipo === 'receita' ? 'text-emerald-400' : 'text-rose-400'}">${data.tipo === 'receita' ? '+' : '-'} ${BRL(data.valor)}</span>
            <button onclick="excluirItem('movimentos', '${id}')" class="text-slate-600 hover:text-rose-500 transition-colors"><i class="fas fa-trash"></i></button>
        </div>
      `;
      lista.appendChild(item);
    });

    document.getElementById("receitaTotal").innerText = BRL(receita);
    document.getElementById("despesaTotal").innerText = BRL(despesa);
    document.getElementById("saldoTotal").innerText = BRL(receita - despesa);
  });
}

function carregarMetas() {
  const q = query(collection(db, "metas"), where("userId", "==", usuarioAtual.uid));
  onSnapshot(q, snapshot => {
    const lista = document.getElementById("listaMetas");
    lista.innerHTML = "";
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const id = docSnap.id;
      const progresso = Math.min((data.atual / data.valor) * 100, 100);

      const card = document.createElement("div");
      card.className = "bg-slate-800 p-6 rounded-3xl border border-slate-700 space-y-4";
      card.innerHTML = `
        <div class="flex justify-between items-start">
            <div>
                <h4 class="text-xl font-bold text-white">${data.nome}</h4>
                <p class="text-sm text-slate-400">Meta: ${BRL(data.valor)}</p>
            </div>
            <button onclick="excluirItem('metas', '${id}')" class="text-slate-500 hover:text-rose-500"><i class="fas fa-trash"></i></button>
        </div>
        <div class="w-full bg-slate-900 rounded-full h-4 overflow-hidden">
            <div class="bg-gradient-to-r from-purple-500 to-pink-500 h-full transition-all duration-1000" style="width: ${progresso}%"></div>
        </div>
        <div class="flex justify-between items-center">
            <span class="text-sm font-bold text-purple-400">${progresso.toFixed(1)}% concluído</span>
            <div class="flex gap-2">
                <button onclick="atualizarMeta('${id}', ${data.atual})" class="bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded-lg text-xs font-bold transition-all">Aportar</button>
            </div>
        </div>
      `;
      lista.appendChild(card);
    });
  });
}

// Funções globais utilitárias
window.excluirItem = async (colecao, id) => {
  if (confirm("Tem certeza que deseja excluir?")) {
    await deleteDoc(doc(db, colecao, id));
  }
};

window.atualizarMeta = async (id, valorAtual) => {
    const aporte = Number(prompt("Quanto deseja adicionar a esta meta?"));
    if(!aporte || isNaN(aporte)) return;
    await updateDoc(doc(db, "metas", id), { atual: valorAtual + aporte });
};

// Funções de Adição (Contas/Dívidas simplificadas)
window.adicionarConta = async () => {
    const nome = prompt("Nome do Banco/Carteira:");
    const saldo = Number(prompt("Saldo inicial:"));
    if(nome && !isNaN(saldo)) await addDoc(collection(db, "contas"), { nome, saldo, userId: usuarioAtual.uid });
};

window.adicionarDivida = async () => {
    const banco = prompt("Nome do Credor:");
    const valor = Number(prompt("Valor total da dívida:"));
    if(banco && !isNaN(valor)) await addDoc(collection(db, "dividas"), { banco, valor, userId: usuarioAtual.uid, status: "pendente" });
};

// Monitor de Auth
onAuthStateChanged(auth, user => {
  if (user) {
    usuarioAtual = user;
    document.getElementById("loginTela").classList.add("hidden");
    document.getElementById("dashboard").classList.remove("hidden");
    carregarMovimentos();
    carregarMetas();
    // Carregar os outros se desejar...
  } else {
    document.getElementById("loginTela").classList.remove("hidden");
    document.getElementById("dashboard").classList.add("hidden");
  }
});
