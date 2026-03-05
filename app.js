// ======================================================
// 🔥 METASBOARD - FIREBASE SDK 11.0.1
// Estrutura limpa com Auth + Firestore + Dashboard
// ======================================================

// 🔹 Import Firebase v11.0.1 (Modular)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";

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


// ======================================================
// 🔴 CONFIGURAÇÃO FIREBASE (COLE A SUA AQUI)
// ======================================================

const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_AUTH_DOMAIN",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_BUCKET",
  messagingSenderId: "SEU_SENDER",
  appId: "SEU_APP_ID"
};


// ======================================================
// 🔥 INICIALIZAÇÃO
// ======================================================

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const content = document.getElementById("appContent");


// ======================================================
// 🔐 CONTROLE DE AUTENTICAÇÃO
// ======================================================

onAuthStateChanged(auth, (user) => {
  if (user) {
    // Salva UID globalmente
    window.currentUserId = user.uid;
    showPage("dashboard");
  } else {
    content.innerHTML = `
      <div class="card">
        <h2>Você precisa estar logado</h2>
      </div>
    `;
  }
});


// ======================================================
// 📌 CONTROLE DE PÁGINAS (MENU LATERAL)
// ======================================================

window.showPage = function (page) {

  if (page === "dashboard") {
    loadDashboard();
  }

  if (page === "contas") {
    content.innerHTML = `
      <div class="card">
        <h2>Contas</h2>
        <p>Área de contas ativa.</p>
      </div>
    `;
  }

  if (page === "dividas") {
    content.innerHTML = `
      <div class="card">
        <h2>Dívidas</h2>
        <p>Área de dívidas ativa.</p>
      </div>
    `;
  }

  if (page === "metas") {
    content.innerHTML = `
      <div class="card">
        <h2>Metas</h2>
        <p>Área de metas ativa.</p>
      </div>
    `;
  }
};


// ======================================================
// 📊 DASHBOARD - RESUMO INTELIGENTE
// ======================================================

async function loadDashboard() {

  if (!window.currentUserId) return;

  let totalReceita = 0;
  let totalDespesa = 0;

  // 🔎 Busca apenas dados do usuário logado
  const q = query(
    collection(db, "recorrencias"),
    where("userId", "==", window.currentUserId)
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

  const saldoFinal = totalReceita - totalDespesa;

  const statusClass = saldoFinal >= 0 ? "green" : "red";
  const statusText =
    saldoFinal >= 0
      ? "Fluxo saudável este mês ✅"
      : "🚨 Atenção! Você ficará negativo";

  content.innerHTML = `
    <div class="card">
      <h2>Resumo Mensal</h2>

      <p><strong>Receitas:</strong> R$ ${totalReceita.toFixed(2)}</p>
      <p><strong>Despesas:</strong> R$ ${totalDespesa.toFixed(2)}</p>
      <p><strong>Saldo Previsto:</strong> R$ ${saldoFinal.toFixed(2)}</p>

      <div class="alert ${statusClass}">
        ${statusText}
      </div>

      <button onclick="logout()">Sair</button>
    </div>
  `;
}


// ======================================================
// 🔓 LOGOUT
// ======================================================

window.logout = async function () {
  await signOut(auth);
};
