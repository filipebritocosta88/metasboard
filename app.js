import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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

const BRL = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

window.login = () => {
  const email = document.getElementById("email").value;
  const senha = document.getElementById("senha").value;
  signInWithEmailAndPassword(auth, email, senha).catch(e => alert("Erro: " + e.message));
};

window.registrar = () => {
  const email = document.getElementById("email").value;
  const senha = document.getElementById("senha").value;
  createUserWithEmailAndPassword(auth, email, senha).catch(e => alert("Erro: " + e.message));
};

window.logout = () => signOut(auth);

window.adicionarReceita = () => salvarMovimento("receita");
window.adicionarDespesa = () => salvarMovimento("despesa");

async function salvarMovimento(tipo) {
  const valor = Number(document.getElementById("valor").value);
  const desc = document.getElementById("categoriaTransacao").value;
  if (!valor || valor <= 0) return alert("Insira um valor");

  await addDoc(collection(db, "recorrencias"), {
    tipo,
    valor,
    descrição: desc || "Geral",
    userId: usuarioAtual.uid,
    criadoEm: Date.now()
  });

  document.getElementById("valor").value = "";
  document.getElementById("categoriaTransacao").value = "";
}

function carregarMovimentos() {
  const q = query(collection(db, "recorrencias"), where("userId", "==", usuarioAtual.uid));

  onSnapshot(q, (snap) => {
    let rec = 0, des = 0;
    const lista = document.getElementById("listaMovimentos");
    lista.innerHTML = "";

    snap.forEach((d) => {
      const data = d.data();
      if (data.tipo === "receita") rec += data.valor;
      else des += data.valor;

      const li = document.createElement("li");
      li.className = "flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/5";
      li.innerHTML = `
        <div>
          <p class="font-bold text-slate-100">${data.descrição || "Sem título"}</p>
          <p class="text-xs text-slate-500">${new Date(data.criadoEm || Date.now()).toLocaleDateString()}</p>
        </div>
        <div class="flex items-center gap-4">
          <span class="font-bold ${data.tipo === 'receita' ? 'text-emerald-400' : 'text-rose-400'}">
            ${data.tipo === 'receita' ? '+' : '-'} ${BRL(data.valor)}
          </span>
          <button onclick="excluirItem('${d.id}')" class="text-slate-600 hover:text-rose-500"><i class="fas fa-trash"></i></button>
        </div>
      `;
      lista.appendChild(li);
    });

    document.getElementById("receitaTotal").innerText = BRL(rec);
    document.getElementById("despesaTotal").innerText = BRL(des);
    document.getElementById("saldoTotal").innerText = BRL(rec - des);
  });
}

window.excluirItem = async (id) => {
  if (confirm("Apagar?")) await deleteDoc(doc(db, "recorrencias", id));
};

onAuthStateChanged(auth, (user) => {
  const loginTela = document.getElementById("loginTela");
  const dashboard = document.getElementById("dashboard");

  if (user) {
    usuarioAtual = user;
    loginTela.classList.add("hidden");
    dashboard.style.display = "flex";
    carregarMovimentos();
  } else {
    loginTela.classList.remove("hidden");
    dashboard.style.display = "none";
  }
});
