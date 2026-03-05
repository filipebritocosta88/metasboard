import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// !!! ATENÇÃO: SUBSTITUA O VALOR ABAIXO PELA SUA CHAVE QUE VOCÊ SALVOU NO PASSO 1 !!!
const firebaseConfig = {
  apiKey: "COLE_SUA_API_KEY_AQUI", 
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

// FUNÇÕES GLOBAIS
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

window.mostrarSecao = (id) => {
  document.getElementById('secDashboard').classList.remove('hidden'); // Simplificado para este exemplo
};

window.adicionarReceita = () => salvarMovimento("receita");
window.adicionarDespesa = () => salvarMovimento("despesa");

async function salvarMovimento(tipo) {
  const valor = Number(document.getElementById("valor").value);
  const descricao = document.getElementById("categoriaTransacao").value;
  if (!valor || valor <= 0) return alert("Valor inválido");

  await addDoc(collection(db, "recorrencias"), {
    tipo,
    valor,
    descrição: descricao || "Geral",
    userId: usuarioAtual.uid,
    criadoEm: Date.now()
  });

  document.getElementById("valor").value = "";
  document.getElementById("categoriaTransacao").value = "";
}

function carregarMovimentos() {
  const q = query(collection(db, "recorrencias"), where("userId", "==", usuarioAtual.uid));

  onSnapshot(q, snap => {
    let rec = 0, des = 0;
    const lista = document.getElementById("listaMovimentos");
    lista.innerHTML = "";

    snap.forEach(d => {
      const data = d.data();
      if (data.tipo === "receita") rec += data.valor;
      else des += data.valor;

      const li = document.createElement("li");
      li.className = "flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/5";
      li.innerHTML = `
        <div>
          <p class="font-bold">${data.descrição || "Sem título"}</p>
          <p class="text-xs text-slate-500">${new Date(data.criadoEm).toLocaleDateString()}</p>
        </div>
        <div class="flex items-center gap-4">
          <span class="${data.tipo === 'receita' ? 'text-emerald-400' : 'text-rose-400'} font-bold">
            ${BRL(data.valor)}
          </span>
          <button onclick="excluirItem('recorrencias','${d.id}')" class="text-slate-600 hover:text-rose-500"><i class="fas fa-trash"></i></button>
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
  if (confirm("Apagar item?")) await deleteDoc(doc(db, col, id));
};

onAuthStateChanged(auth, user => {
  if (user) {
    usuarioAtual = user;
    document.getElementById("loginTela").classList.add("hidden");
    document.getElementById("dashboard").style.display = "flex";
    carregarMovimentos();
  } else {
    document.getElementById("loginTela").classList.remove("hidden");
    document.getElementById("dashboard").style.display = "none";
  }
});
