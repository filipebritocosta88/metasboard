import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// CONFIGURAÇÃO FIREBASE
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
let totalReceitas = 0, totalDividas = 0, totalReservaTotal = 0;
let listaMetasNomes = [];

const BRL = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

// NAVEGAÇÃO
window.navegar = (id) => {
  document.querySelectorAll('.secao').forEach(s => s.classList.remove('ativa'));
  document.getElementById(id).classList.add('ativa');
  document.querySelectorAll('.menuBtn').forEach(b => b.classList.remove('active'));
  document.getElementById('btn-' + id).classList.add('active');
};

// AUTENTICAÇÃO
window.login = () => {
  const e = document.getElementById("email").value;
  const s = document.getElementById("senha").value;
  signInWithEmailAndPassword(auth, e, s).catch(err => alert("Erro: " + err.message));
};
window.logout = () => signOut(auth);

// OPERAÇÕES FINANCEIRAS
window.addRecorrencia = async () => {
  const desc = document.getElementById("rec_desc").value;
  const valor = Number(document.getElementById("rec_valor").value);
  if(valor > 0) await addDoc(collection(db, "recorrencias"), { descrição: desc, valor, userId: userUID });
};

window.excluirReceita = async (id) => {
    if(confirm("Excluir receita?")) await deleteDoc(doc(db, "recorrencias", id));
};

window.addDivida = async () => {
  const nome = document.getElementById("div_nome").value;
  const valor = Number(document.getElementById("div_valor").value);
  const data = document.getElementById("div_data").value;
  if(valor > 0 && data) await addDoc(collection(db, "dividas"), { nome, valor, vencimento: data, userId: userUID });
};

window.darBaixa = async (id) => {
    if(confirm("Confirmar pagamento?")) await deleteDoc(doc(db, "dividas", id));
};

window.addMeta = async () => {
    const nome = document.getElementById("meta_nome").value;
    const alvo = Number(document.getElementById("meta_alvo").value);
    if(alvo > 0) await addDoc(collection(db, "metas"), { nome, alvo, atual: 0, userId: userUID });
};

window.ajustarMeta = async (id, tipo) => {
    const v = Number(prompt("Valor:"));
    if(!v) return;
    const ref = doc(db, "metas", id);
    const snap = await getDoc(ref);
    const novo = tipo === 'add' ? snap.data().atual + v : Math.max(0, snap.data().atual - v);
    await updateDoc(ref, { atual: novo });
};

window.sugerirReserva = async () => {
    const saldo = totalReceitas - totalDividas;
    const v = (saldo * 0.1);
    if(v > 0 && confirm(`Guardar ${BRL(v)} na reserva?`)) await addDoc(collection(db, "reserva"), { valor: v, userId: userUID });
};

window.retirarReserva = async () => {
    const v = Number(prompt("Valor para retirar:"));
    if(v > 0) await addDoc(collection(db, "reserva"), { valor: -v, userId: userUID });
};

// CHAT IA FUNCIONAL
window.toggleChat = () => document.getElementById("boxChat").classList.toggle('hidden');
window.perguntarIA = () => {
    const input = document.getElementById("inputIA");
    const msg = input.value.toLowerCase();
    const box = document.getElementById("chatMensagens");
    if(!msg) return;

    box.innerHTML += `<div class="bg-slate-700/50 p-3 rounded-2xl rounded-tr-none text-right ml-10">${input.value}</div>`;
    
    let resp = "Não entendi. Tente perguntar: 'como está minha saúde?', 'quanto guardar?' ou 'minhas metas'.";
    const saldo = totalReceitas - totalDividas;

    if(msg.includes("saúde") || msg.includes("situação")) {
        const perc = (totalDividas / totalReceitas) * 100;
        resp = `Sua saúde está ${(perc < 40) ? 'ÓTIMA' : 'EM ALERTA'}. Suas dívidas consomem ${perc.toFixed(1)}% da sua renda total.`;
    } else if(msg.includes("guardar") || msg.includes("reserva")) {
        const sugestao = saldo * 0.15;
        resp = `Com saldo de ${BRL(saldo)}, recomendo guardar ${BRL(sugestao)} (15%) hoje para sua Reserva de Emergência!`;
    } else if(msg.includes("meta") || msg.includes("carro") || msg.includes("moto")) {
        resp = `Suas metas cadastradas são: ${listaMetasNomes.join(", ")}. Qual delas quer priorizar hoje?`;
    } else if(msg.includes("dívida") || msg.includes("boleto")) {
        resp = `Você tem ${BRL(totalDividas)} em contas agendadas. Pagando tudo, te sobram ${BRL(saldo)} livres.`;
    }

    setTimeout(() => {
        box.innerHTML += `<div class="bg-purple-600/20 p-3 rounded-2xl rounded-tl-none border border-purple-500/30 mr-10"><b>IA:</b><br>${resp}</div>`;
        box.scrollTop = box.scrollHeight;
    }, 500);
    input.value = "";
};

// MONITORAMENTO EM TEMPO REAL
function carregarDados() {
  onSnapshot(query(collection(db, "recorrencias"), where("userId", "==", userUID)), snap => {
    totalReceitas = 0;
    const lista = document.getElementById("listaGanhos");
    lista.innerHTML = "";
    snap.forEach(d => {
        totalReceitas += d.data().valor;
        lista.innerHTML += `<li class="flex justify-between items-center p-4 glass rounded-2xl border-l-4 border-emerald-500">
            <div><span class="font-bold italic">${d.data().descrição}</span><br><b class="text-emerald-400">${BRL(d.data().valor)}</b></div>
            <button onclick="excluirReceita('${d.id}')" class="text-slate-600 hover:text-rose-500"><i class="fas fa-trash-alt"></i></button>
        </li>`;
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
        grid.innerHTML += `<div class="glass p-6 rounded-[2rem] border-2 ${eHoje ? 'border-rose-600 animate-pulse' : 'border-slate-800'}">
            <div class="flex justify-between items-start mb-4">
                <span class="text-[9px] font-black ${eHoje ? 'text-rose-500' : 'text-slate-500'}">VENCE: ${item.vencimento}</span>
                <button onclick="darBaixa('${d.id}')" class="text-rose-400 font-bold text-[10px]">PAGO</button>
            </div>
            <p class="font-bold text-slate-300 text-sm italic">${item.nome}</p>
            <p class="text-2xl font-black text-rose-400 italic">${BRL(item.valor)}</p>
        </div>`;
    });
    atualizarUI();
  });

  onSnapshot(query(collection(db, "metas"), where("userId", "==", userUID)), snap => {
    const grid = document.getElementById("listaMetasGrid");
    grid.innerHTML = ""; listaMetasNomes = [];
    snap.forEach(d => {
        const item = d.data();
        listaMetasNomes.push(item.nome);
        const perc = Math.min(100, (item.atual / item.alvo) * 100).toFixed(0);
        grid.innerHTML += `<div class="glass p-8 rounded-[2.5rem] border border-white/5">
            <div class="flex justify-between font-black text-sm mb-4 italic uppercase"><span>${item.nome}</span><span class="text-purple-400">${perc}%</span></div>
            <div class="w-full bg-slate-900 h-4 rounded-full overflow-hidden mb-6"><div class="bg-gradient-to-r from-purple-500 to-pink-500 h-full" style="width: ${perc}%"></div></div>
            <div class="flex justify-between text-[11px] font-bold mb-6"><span class="text-slate-500">ALVO: ${BRL(item.alvo)}</span><span class="text-emerald-400">TEM: ${BRL(item.atual)}</span></div>
            <div class="flex gap-3">
                <button onclick="ajustarMeta('${d.id}', 'add')" class="flex-1 bg-emerald-500/10 text-emerald-400 p-4 rounded-2xl text-[11px] font-black">+ VALOR</button>
                <button onclick="ajustarMeta('${d.id}', 'sub')" class="flex-1 bg-rose-500/10 text-rose-400 p-4 rounded-2xl text-[11px] font-black">- VALOR</button>
                <button onclick="deleteDoc(doc(db,'metas','${d.id}'))" class="p-4 text-slate-600 hover:text-rose-500"><i class="fas fa-trash-alt"></i></button>
            </div>
        </div>`;
    });
  });

  onSnapshot(query(collection(db, "reserva"), where("userId", "==", userUID)), snap => {
    totalReservaTotal = 0; snap.forEach(d => totalReservaTotal += d.data().valor);
    document.getElementById("totalReserva").innerText = BRL(totalReservaTotal);
  });
}

function atualizarUI() {
    const saldo = totalReceitas - totalDividas;
    document.getElementById("resumoReceita").innerText = BRL(totalReceitas);
    document.getElementById("resumoDividas").innerText = BRL(totalDividas);
    document.getElementById("resumoSaldo").innerText = BRL(saldo);
    const p = totalReceitas > 0 ? (totalDividas / totalReceitas) * 100 : 0;
    const bar = document.getElementById("barSaude");
    const txt = document.getElementById("txtSaude");
    bar.style.width = Math.min(100, p) + "%";
    if(p < 35) { bar.className="h-full bg-emerald-500"; txt.innerText="SAUDÁVEL"; txt.className="text-emerald-400"; }
    else if(p < 75) { bar.className="h-full bg-yellow-500"; txt.innerText="EM ALERTA"; txt.className="text-yellow-500"; }
    else { bar.className="h-full bg-rose-500"; txt.innerText="CRÍTICO"; txt.className="text-rose-500"; }
}

onAuthStateChanged(auth, user => {
  if (user) { userUID = user.uid; document.getElementById("loginTela").classList.add("hidden"); document.getElementById("dashboard").style.display = "flex"; carregarDados(); }
  else { document.getElementById("loginTela").classList.remove("hidden"); document.getElementById("dashboard").style.display = "none"; }
});
