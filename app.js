// 🔥 Firebase SDK v11 (atual)
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


// 🔴 COLE SUA CONFIG REAL AQUI
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_AUTH_DOMAIN",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_BUCKET",
  messagingSenderId: "SEU_SENDER",
  appId: "SEU_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const content = document.getElementById("appContent");


// 🔥 CONTROLE DE LOGIN
onAuthStateChanged(auth, async (user) => {
  if (user) {
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


// 🔥 NAVEGAÇÃO
window.showPage = async function(page) {
  if (page === "dashboard") {
    loadDashboard();
  }

  if (page === "contas") {
    content.innerHTML = "<div class='card'><h2>Contas</h2></div>";
  }

  if (page === "dividas") {
    content.innerHTML = "<div class='card'><h2>Dívidas</h2></div>";
  }

  if (page === "metas") {
    content.innerHTML = "<div class='card'><h2>Metas</h2></div>";
  }
};


// 🔥 DASHBOARD INTELIGENTE
async function loadDashboard() {
  if (!window.currentUserId) return;

  let receita = 0;
  let despesa = 0;

  const q = query(
    collection(db, "recorrencias"),
    where("userId", "==", window.currentUserId)
  );

  const querySnapshot = await getDocs(q);

  querySnapshot.forEach((doc) => {
    const data = doc.data();

    if (data.tipo === "receita") {
      receita += Number(data.valor);
    }

    if (data.tipo === "despesa") {
      despesa += Number(data.valor);
    }
  });

  const saldo = receita - despesa;

  let statusClass = saldo >= 0 ? "green" : "red";
  let statusText = saldo >= 0 
    ? "Fluxo saudável" 
    : "🚨 Atenção! Você ficará negativo este mês";

  content.innerHTML = `
    <div class="card">
      <h2>Resumo Mensal</h2>
      <p><strong>Receitas:</strong> R$ ${receita.toFixed(2)}</p>
      <p><strong>Despesas:</strong> R$ ${despesa.toFixed(2)}</p>
      <p><strong>Saldo Previsto:</strong> R$ ${saldo.toFixed(2)}</p>

      <div class="alert ${statusClass}">
        ${statusText}
      </div>

      <button onclick="logout()">Sair</button>
    </div>
  `;
}


// 🔥 LOGOUT
window.logout = async function() {
  await signOut(auth);
};
