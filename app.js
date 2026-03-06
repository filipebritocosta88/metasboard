import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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

// Formatação BRL
const formatar = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ----- LOGIN / REGISTRO -----
window.registrar = () => {
  const email = document.getElementById("email").value;
  const senha = document.getElementById("senha").value;
  createUserWithEmailAndPassword(auth, email, senha).catch(e => alert(e.message));
};

window.login = () => {
  const email = document.getElementById("email").value;
  const senha = document.getElementById("senha").value;
  signInWithEmailAndPassword(auth, email, senha).catch(e => alert(e.message));
};

window.logout = () => signOut(auth);

// ----- MOVIMENTOS -----
window.adicionarReceita = async () => salvarMovimento("receita");

async function salvarMovimento(tipo) {
  const desc = document.getElementById("desc").value;
  const valor = Number(document.getElementById("valor").value);
  if (!valor || !desc) return alert("Preencha descrição e valor");
  
  await addDoc(collection(db, "movimentos"), {
    desc, tipo, valor, userId: usuarioAtual.uid, criadoEm: Date.now()
  });
  document.getElementById("desc").value = "";
  document.getElementById("valor").value = "";
}

// ----- CARREGAR DADOS -----
function carregarDashboard() {
  const q = query(collection(db, "movimentos"), where("userId", "==", usuarioAtual.uid));
  onSnapshot(q, snap => {
    let rec = 0, des = 0;
    const lista = document.getElementById("listaMovimentos");
    lista.innerHTML = "";

    snap.forEach(d => {
      const item = d.data();
      if (item.tipo === "receita") rec += item.valor; else des += item.valor;
      
      const li = document.createElement("li");
      li.className = "flex justify-between bg-[#0b0e14] p-3 rounded-xl border border-slate-800 text-sm";
      li.innerHTML = `<span>${item.desc}</span> <span class="font-bold ${item.tipo === 'receita' ? 'text-emerald-400' : 'text-rose-400'}">${formatar(item.valor)}</span>`;
      lista.appendChild(li);
    });

    const saldo = rec - des;
    document.getElementById("receitaTotal").innerText = formatar(rec);
    document.getElementById("despesaTotal").innerText = formatar(des);
    document.getElementById("saldoTotal").innerText = formatar(saldo);
    
    // Termômetro
    const perc = rec > 0 ? Math.max(0, 100 - (des/rec * 100)) : 100;
    const barra = document.getElementById("barraProgresso");
    const txtStatus = document.getElementById("statusTexto");
    barra.style.width = perc + "%";
    
    if(perc < 30) { 
        barra.className = "progress-fill bg-rose-500 h-full"; 
        txtStatus.innerText = "CRÍTICO"; txtStatus.className = "text-[10px] font-black text-rose-500";
    } else {
        barra.className = "progress-fill bg-emerald-500 h-full";
        txtStatus.innerText = "SAUDÁVEL"; txtStatus.className = "text-[10px] font-black text-emerald-500";
    }
  });
}

// ----- OBSERVER -----
onAuthStateChanged(auth, user => {
  if (user) {
    usuarioAtual = user;
    document.getElementById("loginTela").classList.add("hidden");
    document.getElementById("dashboard").classList.replace("hidden", "flex");
    carregarDashboard();
  } else {
    document.getElementById("loginTela").classList.remove("hidden");
    document.getElementById("dashboard").classList.replace("flex", "hidden");
  }
});
