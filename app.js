import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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

let userUID = null;
let totalReceitas = 0;
let totalDividas = 0;
let totalReservaTotal = 0;
let listaMetasNomes = [];

const BRL = (v) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);


// NAVEGAÇÃO
window.navegar = (id) => {
  document.querySelectorAll(".secao").forEach((s) => s.classList.remove("ativa"));
  document.getElementById(id).classList.add("ativa");

  document.querySelectorAll(".menuBtn").forEach((b) => b.classList.remove("active"));
  document.getElementById("btn-" + id).classList.add("active");
};


// TROCAR ENTRE LOGIN E CADASTRO
window.alternarTela = (cadastrar) => {
  document.getElementById("botoesLogin").classList.toggle("hidden", cadastrar);
  document.getElementById("botoesCadastro").classList.toggle("hidden", !cadastrar);

  document.getElementById("subtituloLogin").innerText = cadastrar
    ? "Crie sua conta gratuita agora"
    : "Seu controle financeiro inteligente";
};


// LOGIN
window.login = () => {
  const email = document.getElementById("email").value;
  const senha = document.getElementById("senha").value;

  if (!email || !senha) {
    alert("Preencha email e senha");
    return;
  }

  signInWithEmailAndPassword(auth, email, senha)
    .catch((err) => alert("Erro ao entrar: " + err.message));
};


// REGISTRAR CONTA
window.registrar = () => {
  const email = document.getElementById("email").value;
  const senha = document.getElementById("senha").value;

  if (!email || !senha) {
    alert("Preencha todos os campos!");
    return;
  }

  createUserWithEmailAndPassword(auth, email, senha)
    .then(() => {

      const modal = document.getElementById("modalBoasVindas");
      if (modal) modal.style.display = "flex";

    })
    .catch((err) => alert(err.message));
};


// FECHAR MODAL
window.fecharBoasVindas = () => {
  const modal = document.getElementById("modalBoasVindas");
  if (modal) modal.style.display = "none";
};


// LOGOUT
window.logout = () => signOut(auth);


// RECEITAS
window.addRecorrencia = async () => {
  const desc = document.getElementById("rec_desc").value;
  const valor = Number(document.getElementById("rec_valor").value);

  if (valor > 0)
    await addDoc(collection(db, "recorrencias"), {
      descrição: desc,
      valor,
      userId: userUID,
    });
};

window.excluirReceita = async (id) => {
  if (confirm("Excluir receita?"))
    await deleteDoc(doc(db, "recorrencias", id));
};


// DIVIDAS
window.addDivida = async () => {
  const nome = document.getElementById("div_nome").value;
  const valor = Number(document.getElementById("div_valor").value);
  const data = document.getElementById("div_data").value;

  if (valor > 0 && data)
    await addDoc(collection(db, "dividas"), {
      nome,
      valor,
      vencimento: data,
      userId: userUID,
    });
};

window.darBaixa = async (id) => {
  if (confirm("Confirmar pagamento?"))
    await deleteDoc(doc(db, "dividas", id));
};


// METAS
window.addMeta = async () => {
  const nome = document.getElementById("meta_nome").value;
  const alvo = Number(document.getElementById("meta_alvo").value);

  if (alvo > 0)
    await addDoc(collection(db, "metas"), {
      nome,
      alvo,
      atual: 0,
      userId: userUID,
    });
};

window.ajustarMeta = async (id, tipo) => {
  const valor = Number(prompt("Valor:"));
  if (!valor) return;

  const ref = doc(db, "metas", id);
  const snap = await getDoc(ref);

  const atual = snap.data().atual;

  const novo =
    tipo === "add"
      ? atual + valor
      : Math.max(0, atual - valor);

  await updateDoc(ref, { atual: novo });
};


// RESERVA
window.sugerirReserva = async () => {
  const valor = (totalReceitas - totalDividas) * 0.1;

  if (valor > 0 && confirm(`Guardar ${BRL(valor)} na reserva?`))
    await addDoc(collection(db, "reserva"), {
      valor,
      userId: userUID,
    });
};

window.retirarReserva = async () => {
  const valor = Number(prompt("Valor para retirar:"));

  if (valor > 0)
    await addDoc(collection(db, "reserva"), {
      valor: -valor,
      userId: userUID,
    });
};


// CHAT IA
window.toggleChat = () => {
  const box = document.getElementById("boxChat");
  if (box) box.classList.toggle("hidden");
};

window.perguntarIA = () => {
  const input = document.getElementById("inputIA");
  const msg = input.value.toLowerCase();
  const box = document.getElementById("chatMensagens");

  if (!msg) return;

  box.innerHTML += `<div class="bg-slate-700/50 p-3 rounded-2xl text-right">${input.value}</div>`;

  let resp = "Não entendi sua pergunta.";

  const saldo = totalReceitas - totalDividas;

  if (msg.includes("saude") || msg.includes("situação")) {
    const p = (totalDividas / totalReceitas) * 100;

    resp = `Sua saúde financeira está ${
      p < 40 ? "ÓTIMA" : "EM ALERTA"
    }. Dívidas representam ${p.toFixed(1)}% da renda.`;
  }

  if (msg.includes("guardar") || msg.includes("reserva")) {
    resp = `Recomendo guardar ${BRL(saldo * 0.15)} hoje.`;
  }

  if (msg.includes("meta")) {
    resp = `Suas metas são: ${listaMetasNomes.join(", ")}`;
  }

  setTimeout(() => {
    box.innerHTML += `<div class="bg-purple-600/20 p-3 rounded-2xl"><b>IA:</b><br>${resp}</div>`;
  }, 500);

  input.value = "";
};


// DICAS FINANCEIRAS
function gerarDica() {

  const dicas = [
    "Evite comprometer mais de 30% da sua renda com dívidas.",
    "Ter uma reserva de emergência de 6 meses traz segurança.",
    "Registrar todos os gastos aumenta o controle financeiro.",
    "Guardar pelo menos 10% da renda mensal cria patrimônio.",
    "Pequenos gastos recorrentes impactam muito no mês."
  ];

  const aleatoria = dicas[Math.floor(Math.random() * dicas.length)];

  const el = document.getElementById("dicaFinanceira");

  if (el) el.innerText = aleatoria;
}

setInterval(gerarDica, 8000);
gerarDica();


// ATUALIZAÇÃO UI
function atualizarUI() {

  const saldo = totalReceitas - totalDividas;

  document.getElementById("resumoReceita").innerText = BRL(totalReceitas);
  document.getElementById("resumoDividas").innerText = BRL(totalDividas);
  document.getElementById("resumoSaldo").innerText = BRL(saldo);

}


// FIREBASE AUTH
onAuthStateChanged(auth, (user) => {

  const login = document.getElementById("loginTela");
  const dash = document.getElementById("dashboard");

  if (user) {

    userUID = user.uid;

    login.classList.add("hidden");
    dash.classList.remove("hidden");

  } else {

    login.classList.remove("hidden");
    dash.classList.add("hidden");

  }

});
