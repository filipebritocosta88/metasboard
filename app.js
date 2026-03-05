import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  deleteDoc, 
  doc, 
  updateDoc, 
  getDoc 
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

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

const BRL = (v) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(v || 0);

window.registrar = () => {
  const email = document.getElementById("email").value;
  const senha = document.getElementById("senha").value;
  createUserWithEmailAndPassword(auth, email, senha)
    .catch(e => alert(e.message));
};

window.login = () => {
  const email = document.getElementById("email").value;
  const senha = document.getElementById("senha").value;
  signInWithEmailAndPassword(auth, email, senha)
    .catch(e => alert(e.message));
};

window.logout = () => signOut(auth);

window.adicionarReceita = () => salvarMovimento("receita");
window.adicionarDespesa = () => salvarMovimento("despesa");

async function salvarMovimento(tipo) {
  const valor = Number(document.getElementById("valor").value);
  const categoria = document.getElementById("categoriaTransacao").value || "Geral";

  if (!valor || valor <= 0) return alert("Valor inválido");

  await addDoc(collection(db, "movimentos"), {
    tipo,
    valor,
    categoria,
    userId: usuarioAtual.uid,
    criadoEm: Date.now()
  });

  document.getElementById("valor").value = "";
  document.getElementById("categoriaTransacao").value = "";
}

function carregarMovimentos() {
  const q = query(collection(db, "movimentos"), where("userId", "==", usuarioAtual.uid));

  onSnapshot(q, snap => {
    let rec = 0, des = 0;
    const lista = document.getElementById("listaMovimentos");
    lista.innerHTML = "";

    let docs = [];
    snap.forEach(d => docs.push({ id: d.id, ...d.data() }));
    docs.sort((a, b) => b.criadoEm - a.criadoEm);

    docs.forEach(data => {
      data.tipo === "receita" ? rec += data.valor : des += data.valor;

      const li = document.createElement("li");
      li.className = "flex justify-between items-center p-4 glass rounded-2xl";

      li.innerHTML = `
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-full flex items-center justify-center ${data.tipo === "receita" ? "bg-emerald-500/20 text-emerald-500" : "bg-rose-500/20 text-rose-500"}">
            <i class="fas ${data.tipo === "receita" ? "fa-plus" : "fa-minus"} text-xs"></i>
          </div>
          <div>
            <p class="font-bold text-sm">${data.categoria}</p>
            <p class="text-[10px] text-slate-500">${new Date(data.criadoEm).toLocaleDateString()}</p>
          </div>
        </div>
        <div class="flex items-center gap-4 font-black ${data.tipo === "receita" ? "text-emerald-400" : "text-rose-400"}">
          ${BRL(data.valor)}
          <button onclick="excluirItem('movimentos','${data.id}')" class="text-slate-700 hover:text-rose-500 ml-2">
            <i class="fas fa-trash text-xs"></i>
          </button>
        </div>
      `;

      lista.appendChild(li);
    });

    document.getElementById("receitaTotal").innerText = BRL(rec);
    document.getElementById("despesaTotal").innerText = BRL(des);
    document.getElementById("saldoTotal").innerText = BRL(rec - des);
  });
}

window.excluirItem = async (col, id) => {
  if (confirm("Deseja apagar?")) {
    await deleteDoc(doc(db, col, id));
  }
};

onAuthStateChanged(auth, user => {
  if (user) {
    usuarioAtual = user;
    document.getElementById("loginTela").classList.add("hidden");
    document.getElementById("dashboard").classList.remove("hidden");
    carregarMovimentos();
  } else {
    document.getElementById("loginTela").classList.remove("hidden");
    document.getElementById("dashboard").classList.add("hidden");
  }
});
