import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 🔥 COLOQUE SUA CONFIG DO FIREBASE AQUI
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_AUTH_DOMAIN",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_BUCKET",
  messagingSenderId: "SEU_SENDER",
  appId: "SEU_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const content = document.getElementById("appContent");

window.showPage = async function(page) {
  if (page === "dashboard") {
    loadDashboard();
  }

  if (page === "contas") {
    content.innerHTML = "<div class='card'><h2>Contas</h2><p>Área de contas funcionando.</p></div>";
  }

  if (page === "dividas") {
    content.innerHTML = "<div class='card'><h2>Dívidas</h2><p>Área de dívidas funcionando.</p></div>";
  }

  if (page === "metas") {
    content.innerHTML = "<div class='card'><h2>Metas</h2><p>Área de metas funcionando.</p></div>";
  }
};

async function loadDashboard() {
  let receita = 0;
  let despesa = 0;

  const querySnapshot = await getDocs(collection(db, "recorrencias"));

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
  let statusText = saldo >= 0 ? "Fluxo saudável" : "Alerta! Saldo negativo";

  content.innerHTML = `
    <div class="card">
      <h2>Resumo Mensal</h2>
      <p><strong>Receitas:</strong> R$ ${receita.toFixed(2)}</p>
      <p><strong>Despesas:</strong> R$ ${despesa.toFixed(2)}</p>
      <p><strong>Saldo Previsto:</strong> R$ ${saldo.toFixed(2)}</p>

      <div class="alert ${statusClass}">
        ${statusText}
      </div>
    </div>
  `;
}

showPage("dashboard");
