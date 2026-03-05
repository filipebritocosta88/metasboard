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
let totalReceitas = 0, totalDividas = 0;

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

window.registrar = () => {
  const e = document.getElementById("email").value;
  const s = document.getElementById("senha").value;
  createUserWithEmailAndPassword(auth, e, s).then(() => alert("Conta Criada!")).catch(err => alert("Erro: " + err.message));
};

window.logout = () => signOut(auth);

// ADICIONAR DADOS
window.addRecorrencia = async () => {
  const desc = document.getElementById("rec_desc").value;
  const valor = Number(document.getElementById("rec_valor").value);
  if(!valor) return;
  await addDoc(collection(db, "recorrencias"), { descrição: desc, valor, userId: userUID, tipo: 'receita' });
};

window.addDivida = async () => {
  const nome = document.getElementById("div_nome").value;
  const valor = Number(document.getElementById("div_valor").value);
  const dataVenc = document.getElementById("div_data").value;
  if(!valor || !dataVenc) return alert("Preencha valor e data!");
  await addDoc(collection(db, "dividas"), { nome, valor, vencimento: dataVenc, userId: userUID });
};

window.addMeta = async () => {
    const nome = document.getElementById("meta_nome").value;
    const alvo = Number(document.getElementById("meta_alvo").value);
    await addDoc(collection(db, "metas"), { nome, alvo, atual: 0, userId: userUID });
};

// AJUSTE DINÂMICO DE METAS
window.ajustarMeta = async (id, acao) => {
    const valor = Number(prompt("Qual valor deseja " + (acao === 'add' ? 'adicionar?' : 'remover?')));
    if(!valor) return;
    const ref = doc(db, "metas", id);
    const snap = await getDoc(ref);
    let novo = acao === 'add' ? snap.data().atual + valor : snap.data().atual - valor;
    await updateDoc(ref, { atual: Math.max(0, novo) });
};

// DAR BAIXA EM DÍVIDA (SISTEMA DE HISTÓRICO)
window.darBaixa = async (id, valor, nome) => {
    if(confirm(`Confirmar pagamento de ${nome}?`)){
        await deleteDoc(doc(db, "dividas", id));
        // Opcional: Adicionar a uma coleção 'historico' futuramente
    }
};

// RESERVA AUTOMÁTICA (10% DO SALDO)
window.sugerirReserva = async () => {
    const saldo = totalReceitas - totalDividas;
    const sugestao = (saldo * 0.1).toFixed(2);
    if(confirm(`Deseja mover R$ ${sugestao} (10% do saldo) para sua Reserva?`)){
        await addDoc(collection(db, "reserva"), { valor: Number(sugestao), userId: userUID, data: Date.now() });
    }
};

function carregarDados() {
  // Receitas
  onSnapshot(query(collection(db, "recorrencias"), where("userId", "==", userUID)), snap => {
    totalReceitas = 0;
    const lista = document.getElementById("listaGanhos");
    lista.innerHTML = "";
    snap.forEach(d => {
        const item = d.data();
        totalReceitas += item.valor;
        lista.innerHTML += `<li class="flex justify-between text-sm glass p-3 rounded-xl border-l-4 border-emerald-500">
            <span>${item.descrição}</span><b class="text-emerald-400">${BRL(item.valor)}</b></li>`;
    });
    atualizarTudo();
  });

  // Dívidas com Calendário de Cores
  onSnapshot(query(collection(db, "dividas"), where("userId", "==", userUID)), snap => {
    totalDividas = 0;
    const grid = document.getElementById("listaDividasGrid");
    grid.innerHTML = "";
    snap.forEach(d => {
        const item = d.data();
        totalDividas += item.valor;
        const hoje = new Date().toISOString().split('T')[0];
        const cor = item.vencimento === hoje ? 'border-rose-600 bg-rose-500/20 animate-pulse' : 'border-slate-700 bg-slate-800/40';
        
        grid.innerHTML += `<div class="glass p-5 rounded-3xl border-2 ${cor} transition-all">
            <div class="flex justify-between items-start mb-2">
                <span class="text-[10px] font-bold uppercase text-slate-500 tracking-tighter">${item.vencimento === hoje ? '⚠️ VENCE HOJE' : 'Vencimento: ' + item.vencimento}</span>
                <button onclick="darBaixa('${d.id}', ${item.valor}, '${item.nome}')" class="text-rose-400 text-[10px] font-bold">DAR BAIXA</button>
            </div>
            <p class="font-bold text-white">${item.nome}</p>
            <p class="text-xl font-black text-rose-400">${BRL(item.valor)}</p>
        </div>`;
    });
    atualizarTudo();
  });

  // Metas
  onSnapshot(query(collection(db, "metas"), where("userId", "==", userUID)), snap => {
    const grid = document.getElementById("listaMetasGrid");
    grid.innerHTML = "";
    snap.forEach(d => {
        const item = d.data();
        const perc = Math.min((item.atual / item.alvo) * 100, 100).toFixed(0);
        grid.innerHTML += `<div class="glass p-6 rounded-3xl">
            <div class="flex justify-between font-bold mb-3"><span>${item.nome}</span><span class="text-purple-400">${perc}%</span></div>
            <div class="w-full bg-slate-900 h-3 rounded-full overflow-hidden mb-4"><div class="bg-gradient-to-r from-purple-500 to-indigo-500 h-full transition-all duration-1000" style="width: ${perc}%"></div></div>
            <div class="flex gap-2">
                <button onclick="ajustarMeta('${d.id}','add')" class="flex-1 p-2 bg-emerald-500/10 text-emerald-400 rounded-xl text-xs font-bold">+ Valor</button>
                <button onclick="ajustarMeta('${d.id}','sub')" class="flex-1 p-2 bg-rose-500/10 text-rose-400 rounded-xl text-xs font-bold">- Valor</button>
            </div>
        </div>`;
    });
  });

  // Reserva Acumulada
  onSnapshot(query(collection(db, "reserva"), where("userId", "==", userUID)), snap => {
    let totalR = 0;
    snap.forEach(d => totalR += d.data().valor);
    document.getElementById("totalReserva").innerText = BRL(totalR);
  });
}

function atualizarTudo() {
    const saldo = totalReceitas - totalDividas;
    document.getElementById("resumoReceita").innerText = BRL(totalReceitas);
    document.getElementById("resumoDividas").innerText = BRL(totalDividas);
    document.getElementById("resumoSaldo").innerText = BRL(saldo);

    // TERMÔMETRO DE SAÚDE
    const percentComprometido = totalReceitas > 0 ? (totalDividas / totalReceitas) * 100 : 0;
    const bar = document.getElementById("barSaude");
    const txt = document.getElementById("txtSaude");
    
    bar.style.width = percentComprometido + "%";
    if(percentComprometido < 30) { bar.className = "h-full bg-emerald-500"; txt.innerText = "EXCELENTE"; txt.className = "text-emerald-400"; }
    else if(percentComprometido < 65) { bar.className = "h-full bg-yellow-500"; txt.innerText = "ATENÇÃO"; txt.className = "text-yellow-500"; }
    else { bar.className = "h-full bg-rose-500"; txt.innerText = "CRÍTICO"; txt.className = "text-rose-500"; }
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
