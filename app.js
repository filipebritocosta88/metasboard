import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc, orderBy, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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

const BRL = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

// --- AUTH ---
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

// --- DASHBOARD & MOVIMENTOS ---
window.adicionarReceita = () => salvarMovimento("receita");
window.adicionarDespesa = () => salvarMovimento("despesa");

async function salvarMovimento(tipo) {
    const valInput = document.getElementById("valor");
    const catInput = document.getElementById("categoriaTransacao");
    const valor = Number(valInput.value);
    if (!valor || valor <= 0) return alert("Valor inválido");

    await addDoc(collection(db, "movimentos"), {
        tipo, valor, categoria: catInput.value || "Geral",
        userId: usuarioAtual.uid, criadoEm: Date.now()
    });
    valInput.value = ""; catInput.value = "";
}

function carregarMovimentos() {
    const q = query(collection(db, "movimentos"), where("userId", "==", usuarioAtual.uid), orderBy("criadoEm", "desc"));
    onSnapshot(q, snap => {
        let rec = 0, des = 0;
        const lista = document.getElementById("listaMovimentos");
        lista.innerHTML = "";
        snap.forEach(d => {
            const data = d.data();
            data.tipo === "receita" ? rec += data.valor : des += data.valor;
            const li = document.createElement("li");
            li.className = "flex justify-between items-center p-4 glass rounded-2xl hover:border-slate-500 transition-all";
            li.innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full flex items-center justify-center ${data.tipo === 'receita' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'}">
                        <i class="fas ${data.tipo === 'receita' ? 'fa-plus' : 'fa-minus'} text-xs"></i>
                    </div>
                    <div>
                        <p class="font-bold text-sm">${data.categoria}</p>
                        <p class="text-[10px] text-slate-500">${new Date(data.criadoEm).toLocaleDateString()}</p>
                    </div>
                </div>
                <div class="flex items-center gap-4 font-black ${data.tipo === 'receita' ? 'text-emerald-400' : 'text-rose-400'}">
                    ${BRL(data.valor)}
                    <button onclick="excluirItem('movimentos','${d.id}')" class="text-slate-700 hover:text-rose-500 ml-2"><i class="fas fa-trash text-xs"></i></button>
                </div>
            `;
            lista.appendChild(li);
        });
        document.getElementById("receitaTotal").innerText = BRL(rec);
        document.getElementById("despesaTotal").innerText = BRL(des);
        document.getElementById("saldoTotal").innerText = BRL(rec - des);
    });
}

// --- DÍVIDAS ---
window.adicionarDivida = async () => {
    const banco = prompt("Nome do Banco/Credor:");
    const valor = Number(prompt("Valor total da dívida:"));
    if (banco && valor) {
        await addDoc(collection(db, "dividas"), { banco, valor, userId: usuarioAtual.uid, criadoEm: Date.now() });
    }
};

function carregarDividas() {
    const q = query(collection(db, "dividas"), where("userId", "==", usuarioAtual.uid));
    onSnapshot(q, snap => {
        const lista = document.getElementById("listaDividas");
        let total = 0; lista.innerHTML = "";
        snap.forEach(d => {
            const data = d.data(); total += data.valor;
            const div = document.createElement("div");
            div.className = "glass p-5 rounded-2xl flex justify-between items-center border-l-4 border-rose-500";
            div.innerHTML = `<div><p class="font-bold uppercase text-xs text-slate-400">${data.banco}</p><p class="text-xl font-black">${BRL(data.valor)}</p></div>
                             <button onclick="excluirItem('dividas','${d.id}')" class="text-slate-600 hover:text-rose-500"><i class="fas fa-trash"></i></button>`;
            lista.appendChild(div);
        });
        document.getElementById("totalDividas").innerText = BRL(total);
    });
}

// --- BANCOS ---
window.adicionarConta = async () => {
    const nome = prompt("Nome do Banco:");
    const saldo = Number(prompt("Saldo atual:"));
    if (nome && !isNaN(saldo)) {
        await addDoc(collection(db, "contas"), { nome, saldo, userId: usuarioAtual.uid, criadoEm: Date.now() });
    }
};

function carregarContas() {
    const q = query(collection(db, "contas"), where("userId", "==", usuarioAtual.uid));
    onSnapshot(q, snap => {
        const lista = document.getElementById("listaContas");
        let total = 0; lista.innerHTML = "";
        snap.forEach(d => {
            const data = d.data(); total += data.saldo;
            const div = document.createElement("div");
            div.className = "glass p-5 rounded-2xl border-l-4 border-blue-500";
            div.innerHTML = `<div class="flex justify-between"><div><p class="font-bold uppercase text-xs text-slate-400">${data.nome}</p><p class="text-xl font-black">${BRL(data.saldo)}</p></div>
                             <button onclick="excluirItem('contas','${d.id}')" class="text-slate-600 hover:text-rose-500"><i class="fas fa-trash"></i></button></div>`;
            lista.appendChild(div);
        });
        document.getElementById("totalContas").innerText = BRL(total);
    });
}

// --- METAS COM APORTE E CALENDÁRIO ---
window.adicionarMeta = async () => {
    const nome = prompt("O que você quer conquistar?");
    const valor = Number(prompt("Qual o valor total necessário?"));
    if (nome && valor) {
        await addDoc(collection(db, "metas"), { nome, valor, atual: 0, userId: usuarioAtual.uid, criadoEm: Date.now() });
    }
};

function carregarMetas() {
    const q = query(collection(db, "metas"), where("userId", "==", usuarioAtual.uid));
    onSnapshot(q, snap => {
        const lista = document.getElementById("listaMetas");
        lista.innerHTML = "";
        snap.forEach(d => {
            const data = d.data();
            const perc = Math.min((data.atual / data.valor) * 100, 100).toFixed(1);
            const card = document.createElement("div");
            card.className = "glass p-6 rounded-3xl space-y-4 relative overflow-hidden group";
            card.innerHTML = `
                <div class="flex justify-between items-start relative z-10">
                    <div><h3 class="text-2xl font-black uppercase italic italic">${data.nome}</h3><p class="text-xs text-slate-400 font-bold uppercase tracking-widest">Alvo: ${BRL(data.valor)}</p></div>
                    <button onclick="excluirItem('metas','${d.id}')" class="text-slate-600 hover:text-rose-500"><i class="fas fa-times-circle text-xl"></i></button>
                </div>
                <div class="space-y-2 relative z-10">
                    <div class="flex justify-between text-[10px] font-black uppercase italic"><span>Progresso: ${perc}%</span><span>Acumulado: ${BRL(data.atual)}</span></div>
                    <div class="w-full bg-slate-900 rounded-full h-4 p-1 border border-white/5"><div class="bg-gradient-to-r from-purple-500 via-emerald-400 to-blue-500 h-full rounded-full transition-all duration-1000 progress-glow" style="width:${perc}%"></div></div>
                </div>
                <div class="flex justify-between items-center relative z-10">
                    <p class="text-[10px] text-slate-500 font-bold italic">Último aporte: ${data.ultimoAporteDate || 'Sem registros'}</p>
                    <button onclick="prepararAporte('${d.id}', '${data.nome}')" class="bg-white text-slate-900 px-4 py-2 rounded-xl font-black text-[10px] hover:bg-emerald-400 hover:scale-105 transition-all uppercase tracking-tighter shadow-xl shadow-emerald-500/20">+ Aportar agora</button>
                </div>
                <i class="fas fa-bullseye absolute -bottom-4 -right-4 text-white/5 text-8xl transform group-hover:scale-125 transition-all"></i>
            `;
            lista.appendChild(card);
        });
    });
}

window.prepararAporte = async (id, nome) => {
    const valor = Number(prompt(`Quanto está guardando para ${nome}?`));
    if (!valor || valor <= 0) return;
    const dataAporte = prompt(`Data do depósito (DD/MM/AAAA):`, new Date().toLocaleDateString('pt-BR'));
    
    const ref = doc(db, "metas", id);
    const snap = await getDoc(ref);
    if(snap.exists()) {
        const novoTotal = snap.data().atual + valor;
        await updateDoc(ref, { atual: novoTotal, ultimoAporteDate: dataAporte });
        
        // Também registra como despesa (investimento) no histórico geral
        await addDoc(collection(db, "movimentos"), {
            tipo: "despesa", valor: valor, categoria: `Aporte: ${nome}`,
            userId: usuarioAtual.uid, criadoEm: Date.now()
        });
    }
};

window.excluirItem = async (col, id) => { if(confirm("Deseja apagar?")) await deleteDoc(doc(db, col, id)); };

// --- OBSERVAR ESTADO ---
onAuthStateChanged(auth, user => {
    if (user) {
        usuarioAtual = user;
        document.getElementById("loginTela").classList.add("hidden");
        document.getElementById("dashboard").classList.remove("hidden");
        carregarMovimentos(); carregarContas(); carregarDividas(); carregarMetas();
    } else {
        document.getElementById("loginTela").classList.remove("hidden");
        document.getElementById("dashboard").classList.add("hidden");
    }
});
