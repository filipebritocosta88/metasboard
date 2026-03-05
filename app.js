import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
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
let totalReceitas = 0;
let totalDividas = 0;

const BRL = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

window.navegar = (id) => {
  document.querySelectorAll('.secao').forEach(s => s.classList.remove('ativa'));
  document.getElementById(id).classList.add('ativa');
  document.querySelectorAll('.menuBtn').forEach(b => b.classList.remove('active'));
  document.getElementById('btn-' + id).classList.add('active');
};

// LOGIN E CADASTRO
window.login = () => {
  const e = document.getElementById("email").value;
  const s = document.getElementById("senha").value;
  signInWithEmailAndPassword(auth, e, s).catch(err => alert("Erro ao entrar: " + err.message));
};

window.registrar = () => {
  const e = document.getElementById("email").value;
  const s = document.getElementById("senha").value;
  createUserWithEmailAndPassword(auth, e, s).then(() => alert("Conta criada com sucesso!")).catch(err => alert("Erro: " + err.message));
};

window.logout = () => signOut(auth);

// ADICIONAR DADOS
window.addRecorrencia = async () => {
  const desc = document.getElementById("rec_desc").value;
  const valor = Number(document.getElementById("rec_valor").value);
  const dia = document.getElementById("rec_dia").value;
  if(!valor || !desc) return alert("Preencha os ganhos!");
  await addDoc(collection(db, "recorrencias"), { descrição: desc, valor, dia, tipo: "receita", userId: userUID });
  limparInputs(['rec_desc', 'rec_valor', 'rec_dia']);
};

window.addDivida = async () => {
  const nome = document.getElementById("div_nome").value;
  const valor = Number(document.getElementById("div_valor").value);
  if(!valor || !nome) return alert("Preencha a dívida!");
  await addDoc(collection(db, "dividas"), { nome, valor, userId: userUID });
  limparInputs(['div_nome', 'div_valor']);
};

window.addMeta = async () => {
  const nome = document.getElementById("meta_nome").value;
  const alvo = Number(document.getElementById("meta_alvo").value);
  const atual = Number(document.getElementById("meta_atual").value);
  await addDoc(collection(db, "metas"), { nome, alvo, atual, userId: userUID });
  limparInputs(['meta_nome', 'meta_alvo', 'meta_atual']);
};

// CARREGAMENTO EM TEMPO REAL
function observer() {
  // Ganhos
  onSnapshot(query(collection(db, "recorrencias"), where("userId", "==", userUID)), snap => {
    totalReceitas = 0;
    const lista = document.getElementById("listaGanhos");
    lista.innerHTML = "";
    snap.forEach(d => {
      const item = d.data();
      totalReceitas += item.valor;
      lista.innerHTML += `<li class="flex justify-between p-4 glass rounded-xl border-l-4 border-emerald-400">
        <div><p class="font-bold">${item.descrição}</p><p class="text-xs text-slate-500">Dia ${item.dia}</p></div>
        <div class="text-right"><p class="text-emerald-400 font-bold">${BRL(item.valor)}</p>
        <button onclick="excluir('recorrencias','${d.id}')" class="text-[10px] text-rose-400">Excluir</button></div></li>`;
    });
    atualizarDashboard();
  });

  // Dívidas
  onSnapshot(query(collection(db, "dividas"), where("userId", "==", userUID)), snap => {
    totalDividas = 0;
    const grid = document.getElementById("listaDividasGrid");
    grid.innerHTML = "";
    snap.forEach(d => {
      const item = d.data();
      totalDividas += item.valor;
      grid.innerHTML += `<div class="glass p-6 rounded-3xl border-l-4 border-rose-500">
        <p class="text-xs font-bold text-slate-500 uppercase">${item.nome}</p>
        <p class="text-xl font-black text-rose-400 mb-2">${BRL(item.valor)}</p>
        <button onclick="excluir('dividas','${d.id}')" class="text-xs text-slate-600 hover:text-rose-400">REMOVER</button></div>`;
    });
    atualizarDashboard();
  });

  // Metas
  onSnapshot(query(collection(db, "metas"), where("userId", "==", userUID)), snap => {
    const grid = document.getElementById("listaMetasGrid");
    grid.innerHTML = "";
    snap.forEach(d => {
      const item = d.data();
      const perc = Math.min((item.atual / item.alvo) * 100, 100).toFixed(0);
      grid.innerHTML += `<div class="glass p-6 rounded-3xl">
        <div class="flex justify-between mb-2"><strong>${item.nome}</strong><span>${perc}%</span></div>
        <div class="w-full bg-slate-900 h-3 rounded-full overflow-hidden mb-2">
            <div class="bg-gradient-to-r from-purple-500 to-emerald-500 h-full" style="width: ${perc}%"></div>
        </div>
        <div class="flex justify-between text-xs"><span>Faltam: ${BRL(item.alvo - item.atual)}</span>
        <button onclick="excluir('metas','${d.id}')" class="text-rose-400">Excluir</button></div></div>`;
    });
  });
}

function atualizarDashboard() {
    document.getElementById("resumoReceita").innerText = BRL(totalReceitas);
    document.getElementById("resumoDividas").innerText = BRL(totalDividas);
    document.getElementById("resumoSaldo").innerText = BRL(totalReceitas - totalDividas);
    document.getElementById("alertaSaude").classList.toggle('hidden', totalReceitas >= totalDividas);
}

window.excluir = async (col, id) => { if(confirm("Deseja remover?")) await deleteDoc(doc(db, col, id)); };
function limparInputs(ids) { ids.forEach(id => document.getElementById(id).value = ""); }

onAuthStateChanged(auth, user => {
  if (user) {
    userUID = user.uid;
    document.getElementById("loginTela").classList.add("hidden");
    document.getElementById("dashboard").style.display = "flex";
    observer();
  } else {
    document.getElementById("loginTela").classList.remove("hidden");
    document.getElementById("dashboard").style.display = "none";
  }
});
