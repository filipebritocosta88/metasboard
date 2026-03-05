// ======================================================
// 🚀 METASBOARD - ARQUITETURA ORGANIZADA
// Firebase SDK v11.0.1
// ======================================================


// ===============================
// 🔹 IMPORTS FIREBASE
// ===============================
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

import {
  getFirestore,
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";


// ===============================
// 🔹 CONFIG FIREBASE (COLE A SUA)
// ===============================
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_AUTH_DOMAIN",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_BUCKET",
  messagingSenderId: "SEU_SENDER",
  appId: "SEU_APP_ID"
};


// ===============================
// 🔹 INICIALIZAÇÃO SEGURA
// Evita erro de múltiplas inicializações
// ===============================
const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApps()[0];

const auth = getAuth(app);
const db = getFirestore(app);


// ===============================
// 🔹 ESTADO GLOBAL DA APLICAÇÃO
// ===============================
const AppState = {
  user: null,
};

const content = document.getElementById("appContent");


// ===============================
// 🔐 CONTROLE DE AUTENTICAÇÃO
// ===============================
function initAuth() {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      AppState.user = user;
      renderPage("dashboard");
    } else {
      AppState.user = null;
      renderLoginMessage();
    }
  });
}


// ===============================
// 🔹 RENDERIZAÇÃO
// ===============================
function renderLoginMessage() {
  content.innerHTML = `
    <div class="card">
      <h2>Você precisa estar logado</h2>
    </div>
  `;
}


window.showPage = function(page) {
  renderPage(page);
};


function renderPage(page) {

  if (!AppState.user) {
    renderLoginMessage();
    return;
  }

  switch (page) {

    case "dashboard":
      loadDashboard();
      break;

    case "contas":
      content.innerHTML = `
        <div class="card">
          <h2>Contas</h2>
          <p>Área ativa.</p>
        </div>
      `;
      break;

    case "dividas":
      content.innerHTML = `
        <div class="card">
          <h2>Dívidas</h2>
          <p>Área ativa.</p>
        </div>
      `;
      break;

    case "metas":
      content.innerHTML = `
        <div class="card">
          <h2>Metas</h2>
          <p>Área ativa.</p>
        </div>
      `;
      break;
  }
}


// ===============================
// 📊 DASHBOARD INTELIGENTE
// ===============================
async function loadDashboard() {

  let totalReceita = 0;
  let totalDespesa = 0;

  const q = query(
    collection(db, "recorrencias"),
    where("userId", "==", AppState.user.uid)
  );

  const snapshot = await getDocs(q);

  snapshot.forEach((doc) => {
    const data = doc.data();

    if (data.tipo === "receita") {
      totalReceita += Number(data.valor);
    }

    if (data.tipo === "despesa") {
      totalDespesa += Number(data.valor);
    }
  });

  const saldo = totalReceita - totalDespesa;

  const statusClass = saldo >= 0 ? "green" : "red";
  const statusText = saldo >= 0
    ? "Fluxo saudável ✅"
    : "🚨 Atenção! Saldo negativo";

  content.innerHTML = `
    <div class="card">
      <h2>Resumo Mensal</h2>
      <p><strong>Receitas:</strong> R$ ${totalReceita.toFixed(2)}</p>
      <p><strong>Despesas:</strong> R$ ${totalDespesa.toFixed(2)}</p>
      <p><strong>Saldo Previsto:</strong> R$ ${saldo.toFixed(2)}</p>

      <div class="alert ${statusClass}">
        ${statusText}
      </div>

      <button onclick="logout()">Sair</button>
    </div>
  `;
}


// ===============================
// 🔓 LOGOUT
// ===============================
window.logout = async function() {
  await signOut(auth);
};


// ===============================
// 🚀 INICIALIZAÇÃO DA APP
// ===============================
initAuth();
