import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

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
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "SUA_API_KEY_AQUI",
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

// ================= AUTH =================

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

// ================= MOVIMENTOS =================

window.adicionarReceita = () => salvarMovimento("receita");
window.adicionarDespesa = () => salvarMovimento("despesa");

async function salvarMovimento(tipo) {
  const valor = Number(document.getElementById("valor").value);
  const categoria = document.getElementById("categoriaTransacao").value;

  if (!valor || valor <= 0) return alert("Valor inválido");

  await addDoc(collection(db, "movimentos"), {
    tipo,
    valor,
    categoria: categoria || "Geral",
    userId: usuarioAtual.uid,
    criadoEm: Date.now()
  });

  document.getElementById("valor").value = "";
  document.getElementById("categoriaTransacao").value = "";
}

function carregarMovimentos() {
  const q = query(
    collection(db, "movimentos"),
    where("userId", "==", usuarioAtual.uid)
  );

  onSnapshot(q, snap => {
    let rec = 0;
    let des = 0;

    const lista = document.getElementById("listaMovimentos");
    lista.innerHTML = "";

    let docs = [];
    snap.forEach(d => docs.push({ id: d.id, ...d.data() }));
    docs.sort((a, b) => b.criadoEm - a.criadoEm);

    docs.forEach(data => {
      if (data.tipo === "receita") rec += data.valor;
      else des += data.valor;

      const li = document.createElement("li");

      li.innerHTML = `
        <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
          <div>
            <strong>${data.categoria}</strong><br>
            <small>${new Date(data.criadoEm).toLocaleDateString()}</small>
          </div>
          <div>
            ${BRL(data.valor)}
            <button onclick="excluirItem('movimentos','${data.id}')">🗑</button>
          </div>
        </div>
      `;

      lista.appendChild(li);
    });

    document.getElementById("receitaTotal").innerText = BRL(rec);
    document.getElementById("despesaTotal").innerText = BRL(des);
    document.getElementById("saldoTotal").innerText = BRL(rec - des);
  });
}

// ================= EXCLUIR =================

window.excluirItem = async (col, id) => {
  if (confirm("Deseja apagar?")) {
    await deleteDoc(doc(db, col, id));
  }
};

// ================= AUTH STATE =================

onAuthStateChanged(auth, user => {
  if (user) {
    usuarioAtual = user;

    document.getElementById("loginTela").style.display = "none";
    document.getElementById("dashboard").style.display = "block";

    carregarMovimentos();
  } else {
    document.getElementById("loginTela").style.display = "block";
    document.getElementById("dashboard").style.display = "none";
  }
});
