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

window.navegar = (id) => {
  document.querySelectorAll('.secao').forEach(s => s.classList.remove('ativa'));
  document.getElementById(id).classList.add('ativa');
  document.querySelectorAll('.menuBtn').forEach(b => b.classList.remove('active'));
  document.getElementById('btn-' + id).classList.add('active');
};

window.login = () => {
  const e = document.getElementById("email").value;
  const s = document.getElementById("senha").value;
  signInWithEmailAndPassword(auth, e, s).catch(err => alert("Erro: " + err.message));
};

window.logout = () => signOut(auth);

window.addMovimento = async () => {
  const desc = document.getElementById("lan_desc").value;
  const valor = Number(document.getElementById("lan_valor").value);
  const dia = document.getElementById("lan_dia").value;
  const tipo = document.getElementById("lan_tipo").value;

  if(!valor || !desc) return alert("Preencha Descrição e Valor");

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

function carregarDados() {
  // Fluxo de Caixa (Recorrências)
  onSnapshot(query(collection(db, "recorrencias"), where("userId", "==", userUID)), snap => {
    let r = 0, d = 0;
    const lista = document.getElementById("listaHome");
    lista.innerHTML = "";
    snap.forEach(docSnap => {
      const item = docSnap.data();
      if(item.tipo === 'receita') r += item.valor; else d += item.valor;
      
      lista.innerHTML += `
        <li class="flex justify-between items-center bg-slate-900/40 p-4 rounded-2xl border border-white/5 group hover:border-purple-500/30 transition-all">
          <div class="flex items-center gap-4">
            <div class="w-10 h-10 rounded-full flex items-center justify-center ${item.tipo === 'receita' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}">
                <i class="fas ${item.tipo === 'receita' ? 'fa-arrow-up' : 'fa-arrow-down'}"></i>
            </div>
            <div>
                <p class="font-bold text-white">${item.descrição || "Sem nome"}</p>
                <p class="text-xs text-slate-500">${item.dia ? 'Dia ' + item.dia : 'Pagamento Único'}</p>
            </div>
          </div>
          <div class="text-right">
            <p class="font-black ${item.tipo === 'receita' ? 'text-emerald-400' : 'text-rose-400'}">${BRL(item.valor)}</p>
            <button onclick="excluirItem('recorrencias','${docSnap.id}')" class="text-[10px] text-slate-600 hover:text-rose-400 uppercase font-bold tracking-tighter">Excluir</button>
          </div>
        </li>`;
    });
    document.getElementById("resumoReceita").innerText = BRL(r);
    document.getElementById("resumoDespesa").innerText = BRL(d);
    document.getElementById("resumoSaldo").innerText = BRL(r - d);
  });

  // Dívidas
  onSnapshot(query(collection(db, "dividas"), where("userId", "==", userUID)), snap => {
    const box = document.getElementById("listaDividas");
    box.innerHTML = "";
    snap.forEach(docSnap => {
      const item = docSnap.data();
      box.innerHTML += `
        <div class="glass p-6 rounded-3xl border-l-4 border-rose-500 hover:bg-rose-500/5 transition-all">
          <p class="text-slate-400 text-xs font-bold uppercase mb-2">${item.nome || 'Dívida'}</p>
          <p class="text-2xl font-black text-white mb-4">${BRL(item.valor)}</p>
          <button onclick="excluirItem('dividas','${docSnap.id}')" class="text-xs text-rose-400/50 hover:text-rose-400 font-bold">MARCAR COMO PAGO</button>
        </div>`;
    });
  });

  // Metas
  onSnapshot(query(collection(db, "metas"), where("userId", "==", userUID)), snap => {
    const box = document.getElementById("listaMetas");
    box.innerHTML = "";
    snap.forEach(docSnap => {
      const item = docSnap.data();
      const perc = Math.min((item.atual / item.alvo) * 100, 100).toFixed(0);
      box.innerHTML += `
        <div class="glass p-6 rounded-3xl group">
          <div class="flex justify-between items-end mb-4">
            <div>
                <h4 class="font-bold text-white text-lg">${item.nome}</h4>
                <p class="text-xs text-slate-500">Alvo: ${BRL(item.alvo)}</p>
            </div>
            <span class="text-2xl font-black text-purple-400">${perc}%</span>
          </div>
          <div class="w-full bg-slate-900 h-4 rounded-full overflow-hidden border border-white/5">
            <div class="bg-gradient-to-r from-purple-600 to-emerald-500 h-full transition-all duration-1000 shadow-[0_0_15px_rgba(168,85,247,0.4)]" style="width: ${perc}%"></div>
          </div>
          <div class="mt-4 flex justify-between items-center">
            <p class="text-sm font-bold text-emerald-400">Guardado: ${BRL(item.atual)}</p>
             <button onclick="excluirItem('metas','${docSnap.id}')" class="text-slate-600 hover:text-rose-400 transition-colors"><i class="fas fa-trash-alt"></i></button>
          </div>
        </div>`;
    });
  });
}

window.excluirItem = async (colecao, id) => {
    if(confirm("Deseja realmente excluir este item?")) {
        await deleteDoc(doc(db, colecao, id));
    }
}

onAuthStateChanged(auth, user => {
  if (user) {
    userUID = user.uid;
    document.getElementById("loginTela").classList.add("hidden");
    document.getElementById("dashboard").style.display = "flex";
    carregarDados();
  } else {
    document.getElementById("loginTela").classList.remove("hidden");
    document.getElementById("dashboard").style.display = "none";
  }
});
