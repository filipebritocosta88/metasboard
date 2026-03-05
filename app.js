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

// NAVEGAÇÃO E AUTENTICAÇÃO
window.navegar = (id) => {
  document.querySelectorAll('.secao').forEach(s => s.classList.remove('ativa'));
  document.getElementById(id).classList.add('ativa');
  document.querySelectorAll('.menuBtn').forEach(b => b.classList.remove('active'));
  document.getElementById('btn-' + id).classList.add('active');
};

window.login = () => {
  const e = document.getElementById("email").value;
  const s = document.getElementById("senha").value;
  signInWithEmailAndPassword(auth, e, s).catch(err => alert("Erro ao entrar: " + err.message));
};

window.registrar = () => {
    const e = document.getElementById("email").value;
    const s = document.getElementById("senha").value;
    createUserWithEmailAndPassword(auth, e, s).then(() => alert("Conta criada!")).catch(err => alert(err.message));
};

window.logout = () => signOut(auth);

// ADICIONAR DADOS
window.addRecorrencia = async () => {
  const desc = document.getElementById("rec_desc").value;
  const valor = Number(document.getElementById("rec_valor").value);
  if(valor > 0) await addDoc(collection(db, "recorrencias"), { descrição: desc, valor, userId: userUID });
};

window.addDivida = async () => {
  const nome = document.getElementById("div_nome").value;
  const valor = Number(document.getElementById("div_valor").value);
  const data = document.getElementById("div_data").value;
  if(valor > 0 && data) await addDoc(collection(db, "dividas"), { nome, valor, vencimento: data, userId: userUID });
};

window.addMeta = async () => {
    const nome = document.getElementById("meta_nome").value;
    const alvo = Number(document.getElementById("meta_alvo").value);
    if(alvo > 0) await addDoc(collection(db, "metas"), { nome, alvo, atual: 0, userId: userUID });
};

// AJUSTE DINÂMICO DE METAS
window.ajustarMeta = async (id, tipo) => {
    const valor = Number(prompt("Valor para " + (tipo === 'add' ? 'depositar:' : 'retirar:')));
    if(!valor) return;
    const ref = doc(db, "metas", id);
    const snap = await getDoc(ref);
    const novo = tipo === 'add' ? snap.data().atual + valor : Math.max(0, snap.data().atual - valor);
    await updateDoc(ref, { atual: novo });
};

// DAR BAIXA EM DÍVIDAS
window.darBaixa = async (id) => {
    if(confirm("Confirmar pagamento?")) await deleteDoc(doc(db, "dividas", id));
};

// CHAT IA FINANCEIRO (Lógica de Decisão)
window.toggleChat = () => document.getElementById("boxChat").classList.toggle('hidden');

window.perguntarIA = () => {
    const input = document.getElementById("inputIA");
    const msg = input.value.toLowerCase();
    const box = document.getElementById("chatMensagens");
    if(!msg) return;

    box.innerHTML += `<div class="bg-slate-700/50 p-3 rounded-2xl rounded-tr-none text-right ml-10">${input.value}</div>`;
    
    // Simulação de IA Baseada em Dados
    setTimeout(() => {
        let resposta = "Desculpe, não entendi. Tente perguntar sobre guardar dinheiro ou sobre suas dívidas.";
        const saldo = totalReceitas - totalDividas;

        if(msg.includes("vale a pena") || msg.includes("guardar")) {
            const perc = msg.match(/\d+/);
            if(perc) {
                const valor = (saldo * (perc[0]/100));
                resposta = `Filipe, guardar ${perc[0]}% representaria ${BRL(valor)}. Como seu saldo é ${BRL(saldo)}, isso é **excelente** para sua segurança futura!`;
            } else {
                resposta = `Com um saldo livre de ${BRL(saldo)}, recomendo guardar ao menos 10% hoje!`;
            }
        } else if(msg.includes("dívida") || msg.includes("vence")) {
            resposta = `Você tem ${BRL(totalDividas)} em dívidas agendadas. Fique atento aos prazos em vermelho no painel!`;
        }

        box.innerHTML += `<div class="bg-purple-600/20 p-3 rounded-2xl rounded-tl-none border border-purple-500/30 mr-10">${resposta}</div>`;
        box.scrollTop = box.scrollHeight;
    }, 600);
    input.value = "";
};

// OBSERVERS
function carregarDados() {
  onSnapshot(query(collection(db, "recorrencias"), where("userId", "==", userUID)), snap => {
    totalReceitas = 0;
    document.getElementById("listaGanhos").innerHTML = "";
    snap.forEach(d => {
        totalReceitas += d.data().valor;
        document.getElementById("listaGanhos").innerHTML += `<li class="flex justify-between items-center p-4 glass rounded-2xl border-l-4 border-emerald-500">
            <span class="font-bold italic">${d.data().descrição}</span><b class="text-emerald-400">${BRL(d.data().valor)}</b></li>`;
    });
    atualizarUI();
  });

  onSnapshot(query(collection(db, "dividas"), where("userId", "==", userUID)), snap => {
    totalDividas = 0;
    const grid = document.getElementById("listaDividasGrid");
    grid.innerHTML = "";
    const hoje = new Date().toISOString().split('T')[0];

    snap.forEach(d => {
        const item = d.data();
        totalDividas += item.valor;
        const eHoje = item.vencimento === hoje;
        grid.innerHTML += `<div class="glass p-6 rounded-[2rem] border-2 ${eHoje ? 'border-rose-600 animate-pulse' : 'border-slate-800'} relative overflow-hidden">
            <div class="flex justify-between items-start mb-4">
                <span class="text-[9px] font-black tracking-widest ${eHoje ? 'text-rose-500' : 'text-slate-500'}">VENCIMENTO: ${item.vencimento}</span>
                <button onclick="darBaixa('${d.id}')" class="text-rose-400 font-bold text-[10px] hover:underline tracking-widest">MARCAR PAGO</button>
            </div>
            <p class="font-bold text-slate-300 mb-1 text-sm italic">${item.nome}</p>
            <p class="text-2xl font-black text-rose-400 italic">${BRL(item.valor)}</p>
        </div>`;
    });
    atualizarUI();
  });

  onSnapshot(query(collection(db, "metas"), where("userId", "==", userUID)), snap => {
    const grid = document.getElementById("listaMetasGrid");
    grid.innerHTML = "";
    snap.forEach(d => {
        const item = d.data();
        const perc = Math.min(100, (item.atual / item.alvo) * 100).toFixed(0);
        grid.innerHTML += `
        <div class="glass p-8 rounded-[2.5rem] border border-white/5 relative">
            <div class="flex justify-between font-black text-sm mb-4 italic uppercase tracking-tighter">
                <span>${item.nome}</span><span class="text-purple-400">${perc}%</span>
            </div>
            <div class="w-full bg-slate-900 h-4 rounded-full overflow-hidden mb-6 shadow-inner">
                <div class="bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500 h-full transition-all duration-1000" style="width: ${perc}%"></div>
            </div>
            <div class="flex justify-between text-[11px] font-bold mb-6">
                <span class="text-slate-500">OBJETIVO: ${BRL(item.alvo)}</span>
                <span class="text-emerald-400 font-black">GUARDADO: ${BRL(item.atual)}</span>
            </div>
            <div class="flex gap-3">
                <button onclick="ajustarMeta('${d.id}', 'add')" class="flex-1 bg-emerald-500/10 text-emerald-400 p-4 rounded-2xl text-[11px] font-black hover:bg-emerald-500/20">+ VALOR</button>
                <button onclick="ajustarMeta('${d.id}', 'sub')" class="flex-1 bg-rose-500/10 text-rose-400 p-4 rounded-2xl text-[11px] font-black hover:bg-rose-500/20">- VALOR</button>
                <button onclick="deleteDoc(doc(db,'metas','${d.id}'))" class="w-12 h-12 flex items-center justify-center text-slate-600 hover:text-rose-500"><i class="fas fa-trash-alt"></i></button>
            </div>
        </div>`;
    });
  });

  onSnapshot(query(collection(db, "reserva"), where("userId", "==", userUID)), snap => {
    let r = 0; snap.forEach(d => r += d.data().valor);
    document.getElementById("totalReserva").innerText = BRL(r);
  });
}

function atualizarUI() {
    const saldo = totalReceitas - totalDividas;
    document.getElementById("resumoReceita").innerText = BRL(totalReceitas);
    document.getElementById("resumoDividas").innerText = BRL(totalDividas);
    document.getElementById("resumoSaldo").innerText = BRL(saldo);

    const percent = totalReceitas > 0 ? (totalDividas / totalReceitas) * 100 : 0;
    const bar = document.getElementById("barSaude");
    const txt = document.getElementById("txtSaude");
    bar.style.width = Math.min(100, percent) + "%";

    if(percent < 35) { bar.className="h-full bg-emerald-500"; txt.innerText="SAUDÁVEL"; txt.className="text-emerald-400"; }
    else if(percent < 75) { bar.className="h-full bg-yellow-500"; txt.innerText="EM ALERTA"; txt.className="text-yellow-500"; }
    else { bar.className="h-full bg-rose-500"; txt.innerText="CRÍTICO"; txt.className="text-rose-500"; }
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
