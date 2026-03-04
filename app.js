// IMPORTS FIREBASE
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// CONFIG
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

let receita = 0;
let despesa = 0;
let usuarioAtual = null;

// ===== LOGIN =====

window.registrar = async function() {
  const email = document.getElementById("email").value;
  const senha = document.getElementById("senha").value;
  await createUserWithEmailAndPassword(auth, email, senha);
}

window.login = async function() {
  const email = document.getElementById("email").value;
  const senha = document.getElementById("senha").value;
  await signInWithEmailAndPassword(auth, email, senha);
}

window.logout = async function() {
  await signOut(auth);
}

// ===== CARREGAR DADOS DO USUÁRIO =====

async function carregarDados() {
  receita = 0;
  despesa = 0;

  const receitasRef = query(
    collection(db, "receitas"),
    where("uid", "==", usuarioAtual.uid)
  );

  const despesasRef = query(
    collection(db, "despesas"),
    where("uid", "==", usuarioAtual.uid)
  );

  const receitasSnapshot = await getDocs(receitasRef);
  receitasSnapshot.forEach(doc => {
    receita += doc.data().valor;
  });

  const despesasSnapshot = await getDocs(despesasRef);
  despesasSnapshot.forEach(doc => {
    despesa += doc.data().valor;
  });

  atualizarTela();
}

function atualizarTela() {
  document.getElementById("receitaTotal").innerText = "R$ " + receita;
  document.getElementById("despesaTotal").innerText = "R$ " + despesa;
  document.getElementById("saldoTotal").innerText = "R$ " + (receita - despesa);
}

// ===== ADICIONAR VALORES =====

window.adicionarReceita = async function() {
  const valor = parseFloat(document.getElementById("valor").value);
  if (!valor) return;

  await addDoc(collection(db, "receitas"), {
    valor: valor,
    uid: usuarioAtual.uid
  });

  receita += valor;
  atualizarTela();
}

window.adicionarDespesa = async function() {
  const valor = parseFloat(document.getElementById("valor").value);
  if (!valor) return;

  await addDoc(collection(db, "despesas"), {
    valor: valor,
    uid: usuarioAtual.uid
  });

  despesa += valor;
  atualizarTela();
}

// ===== OBSERVADOR DE LOGIN =====

onAuthStateChanged(auth, user => {
  if (user) {
    usuarioAtual = user;
    carregarDados();
  } else {
    usuarioAtual = null;
  }
});
