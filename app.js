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
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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

// REGISTRAR
window.registrar = function () {
  const email = document.getElementById("email").value;
  const senha = document.getElementById("senha").value;

  createUserWithEmailAndPassword(auth, email, senha)
    .catch(error => alert(error.message));
};

// LOGIN
window.login = function () {
  const email = document.getElementById("email").value;
  const senha = document.getElementById("senha").value;

  signInWithEmailAndPassword(auth, email, senha)
    .catch(error => alert(error.message));
};

// LOGOUT
window.logout = function () {
  signOut(auth);
};

// ADICIONAR RECEITA
window.adicionarReceita = async function () {
  const valor = Number(document.getElementById("valor").value);
  if (!valor) return alert("Digite um valor válido");

  await addDoc(collection(db, "movimentos"), {
    tipo: "receita",
    valor: valor,
    userId: usuarioAtual.uid
  });

  document.getElementById("valor").value = "";
};

// ADICIONAR DESPESA
window.adicionarDespesa = async function () {
  const valor = Number(document.getElementById("valor").value);
  if (!valor) return alert("Digite um valor válido");

  await addDoc(collection(db, "movimentos"), {
    tipo: "despesa",
    valor: valor,
    userId: usuarioAtual.uid
  });

  document.getElementById("valor").value = "";
};

// OBSERVAR USUÁRIO
onAuthStateChanged(auth, (user) => {
  if (user) {
    usuarioAtual = user;

    document.getElementById("loginTela").classList.add("hidden");
    document.getElementById("dashboard").classList.remove("hidden");

    carregarDados();
  } else {
    document.getElementById("loginTela").classList.remove("hidden");
    document.getElementById("dashboard").classList.add("hidden");
  }
});

// CARREGAR DADOS EM TEMPO REAL
function carregarDados() {
  const q = query(
    collection(db, "movimentos"),
    where("userId", "==", usuarioAtual.uid)
  );

  onSnapshot(q, (snapshot) => {
    let receita = 0;
    let despesa = 0;

    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.tipo === "receita") receita += data.valor;
      if (data.tipo === "despesa") despesa += data.valor;
    });

    document.getElementById("receitaTotal").innerText = "R$ " + receita;
    document.getElementById("despesaTotal").innerText = "R$ " + despesa;
    document.getElementById("saldoTotal").innerText = "R$ " + (receita - despesa);
  });
}
