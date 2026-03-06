import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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

/* =========================
   AUTH
========================= */

window.registrar = async () => {
  const email = document.getElementById("email").value;
  const senha = document.getElementById("senha").value;
  await createUserWithEmailAndPassword(auth, email, senha);
};

window.login = async () => {
  const email = document.getElementById("email").value;
  const senha = document.getElementById("senha").value;
  await signInWithEmailAndPassword(auth, email, senha);
};

window.logout = () => signOut(auth);

/* =========================
   EXECUTAR RECORRÊNCIAS
========================= */

async function executarRecorrencias() {
  const hoje = new Date();
  const mes = hoje.getMonth();
  const ano = hoje.getFullYear();

  const q = query(
    collection(db, "recorrencias"),
    where("userId", "==", usuarioAtual.uid)
  );

  const snap = await getDocs(q);

  let eventos = [];

  snap.forEach((doc) => {
    const data = doc.data();
    const dataEvento = new Date(ano, mes, data.dia).getTime();

    eventos.push({
      descricao: data.descricao,
      tipo: data.tipo,
      valor: data.valor,
      data: dataEvento
    });
  });

  eventos.sort((a, b) => a.data - b.data);

  let saldo = 0;
  let receitaTotal = 0;
  let despesaTotal = 0;
  let alerta = null;

  for (let ev of eventos) {
    if (ev.tipo === "receita") {
      saldo += ev.valor;
      receitaTotal += ev.valor;
    } else {
      saldo -= ev.valor;
      despesaTotal += ev.valor;
    }

    if (saldo < 0 && !alerta) {
      alerta = {
        descricao: ev.descricao,
        saldo
      };
    }
  }

  document.getElementById("receitaTotal").innerText = BRL(receitaTotal);
  document.getElementById("despesaTotal").innerText = BRL(despesaTotal);
  document.getElementById("saldoTotal").innerText = BRL(saldo);

  const alertaBox = document.getElementById("alertaFinanceiro");
  const mensagem = document.getElementById("mensagemAlerta");

  alertaBox.classList.remove("hidden");

  if (alerta) {
    alertaBox.classList.remove("border-yellow-500");
    alertaBox.classList.add("border-rose-500");
    mensagem.innerText =
      "🚨 Atenção! Você ficará negativo após: " +
      alerta.descricao +
      " | Saldo previsto: " +
      BRL(alerta.saldo);
  } else {
    alertaBox.classList.remove("border-rose-500");
    alertaBox.classList.add("border-emerald-500");
    mensagem.innerText =
      "✅ Fluxo saudável! Após todas as contas, saldo previsto: " +
      BRL(saldo);
  }
}

/* =========================
   LOGIN STATE
========================= */

onAuthStateChanged(auth, async (user) => {
  if (user) {
    usuarioAtual = user;
    document.getElementById("loginTela").classList.add("hidden");
    document.getElementById("dashboard").classList.remove("hidden");

    await executarRecorrencias();
  } else {
    document.getElementById("loginTela").classList.remove("hidden");
    document.getElementById("dashboard").classList.add("hidden");
  }
});
