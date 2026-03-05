import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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

const BRL = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

// NAVEGAÇÃO
window.navegar = (id) => {
  document.querySelectorAll('.secao').forEach(s => s.classList.remove('ativa'));
  document.getElementById(id).classList.add('ativa');
  document.querySelectorAll('.menuBtn').forEach(b => b.classList.remove('active'));
  document.getElementById('btn-' + id).classList.add('active');
};

// AUTH
window.login = () => {
  const e = document.getElementById("email").value;
  const s = document.getElementById("senha").value;
  signInWithEmailAndPassword(auth, e, s).catch(err => alert("Erro ao entrar: " + err.message));
};
window.logout = () => signOut(auth);

// ADICIONAR (SALÁRIO / CONTAS)
window.addMovimento = async () => {
  const desc = document.getElementById("lan_desc").value;
  const valor = Number(document.getElementById("lan_valor").value);
  const dia = document.getElementById("lan_dia").value;
  const tipo = document.getElementById("lan_tipo").value;

  if(!valor) return alert("Digite o valor");

  await addDoc(collection(db, "recorrencias"), {
    descrição: desc,
    valor,
    dia: dia || null,
    tipo,
    userId: userUID,
    criadoEm: Date.now()
  });
  
  document.getElementById("lan_desc").value = "";
  document.getElementById("lan_valor").value = "";
};

// CARREGAMENTO EM TEMPO REAL
function observer() {
  // Observar Recorrências (Salário e Gastos Fixos)
  onSnapshot(query(collection(db, "recorrencias"), where("userId", "==", userUID)), snap => {
    let r = 0, d = 0;
    const lista = document.getElementById("listaHome");
    lista.innerHTML = "";
    snap.forEach(doc => {
      const item = doc.data();
      if(item.tipo === 'receita') r += item.valor; else d += item.valor;
      
      lista.innerHTML += `
        <li class="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/5">
          <div><p class="font-bold">${item.descrição}</p><p class="text-xs text-slate-500">${item.dia ? 'Dia ' + item.dia : 'Eventual'}</p></div>
          <span class="font-bold ${item.tipo === 'receita' ? 'text-emerald-400' : 'text-rose-400'}">${BRL(item.valor)}</span>
        </li>`;
    });
    document.getElementById("resumoReceita").innerText = BRL(r);
    document.getElementById("resumoDespesa").innerText = BRL(d);
    document.getElementById("resumoSaldo").innerText = BRL(r - d);
  });

  // Observar Dívidas (Puxando da sua coleção 'dividas')
  onSnapshot(query(collection(db, "dividas"), where("userId", "==", userUID)), snap => {
    const box = document.getElementById("listaDividas");
    box.innerHTML = "";
    snap.forEach(doc => {
      const item = doc.data();
      box.innerHTML += `
        <div class="glass p-4 rounded-2xl border-l-4 border-rose-500">
          <p class="font-bold">${item.nome || 'Dívida'}</p>
          <p class="text-xl font-black text-rose-400">${BRL(item.valor)}</p>
        </div>`;
    });
  });

  // Observar Metas (Puxando da sua coleção 'metas')
  onSnapshot(query(collection(db, "metas"), where("userId", "==", userUID)), snap => {
    const box = document.getElementById("listaMetas");
    box.innerHTML = "";
    snap.forEach(doc => {
      const item = doc.data();
      const perc = Math.min((item.atual / item.alvo) * 100, 100).toFixed(0);
      box.innerHTML += `
        <div class="glass p-5 rounded-3xl">
          <div class="flex justify-between font-bold mb-2"><span>${item.nome}</span><span>${perc}%</span></div>
          <div class="w-full bg-slate-900 h-3 rounded-full overflow-hidden">
            <div class="bg-gradient-to-r from-purple-500 to-emerald-500 h-full" style="width: ${perc}%"></div>
          </div>
          <p class="text-xs mt-2 text-slate-500">Alvo: ${BRL(item.alvo)} | Atual: ${BRL(item.atual)}</p>
        </div>`;
    });
  });
}

onAuthStateChanged(auth, user => {
  if (user) {
    userUID = user.uid;
    document.getElementById("loginTela").classList.add("hidden");
    document.getElementById("dashboard").style.display = "flex";
    observer();
  } else {
    document.getElementById("loginTela").classList.remove("hidden");
    document.getElementById("dashboard").style.display = "none";
  }
});
