import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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
let dadosGlobais = { receita: 0, divida: 0, reserva: 0, metas: [] };

const BRL = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// --- NAVEGAÇÃO ---
window.mostrarSecao = (id, btn) => {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active', 'bg-purple-900/20'));
    btn.classList.add('active', 'bg-purple-900/20');
};
window.fecharModal = () => document.getElementById("modalBoasVindas").classList.add("hidden");
window.toggleChat = () => document.getElementById("janelaChat").classList.toggle("hidden");

// --- AUTH ---
window.login = () => signInWithEmailAndPassword(auth, document.getElementById("email").value, document.getElementById("senha").value).catch(e => alert(e.message));
window.registrar = () => createUserWithEmailAndPassword(auth, document.getElementById("email").value, document.getElementById("senha").value).catch(e => alert(e.message));
window.logout = () => signOut(auth);

onAuthStateChanged(auth, user => {
    if (user) {
        usuarioAtual = user;
        document.getElementById("loginTela").classList.add("hidden");
        document.getElementById("dashboard").classList.replace("hidden", "flex");
        document.getElementById("modalBoasVindas").classList.remove("hidden");
        inicializarApp();
    } else {
        document.getElementById("loginTela").classList.remove("hidden");
        document.getElementById("dashboard").classList.replace("flex", "hidden");
    }
});

// --- AUTOMAÇÃO DE DATAS (O SEGREDO) ---
async function verificarAutomacoes() {
    const hoje = new Date();
    const diaAtual = hoje.getDate();
    const mesAnoAtual = `${hoje.getMonth()}-${hoje.getFullYear()}`;

    const q = query(collection(db, "agendamentos"), where("userId", "==", usuarioAtual.uid));
    const snap = await getDocs(q);

    snap.forEach(async (d) => {
        const item = d.data();
        // Se hoje for o dia agendado E ainda não rodou este mês
        if (item.dia == diaAtual && item.ultimoProcesso !== mesAnoAtual) {
            if (item.tipo === "ganho") {
                await addDoc(collection(db, "contas"), { nome: `AUTO: ${item.desc}`, saldo: item.valor, userId: usuarioAtual.uid });
            } else {
                await addDoc(collection(db, "dividas"), { nome: `AUTO: ${item.desc}`, valor: item.valor, userId: usuarioAtual.uid });
            }
            // Marcar como processado este mês
            await updateDoc(doc(db, "agendamentos", d.id), { ultimoProcesso: mesAnoAtual });
        }
    });
}

// --- FUNÇÕES DE CADASTRO ---
window.adicionarFixo = async (tipo) => {
    const d = tipo === 'ganho' ? document.getElementById("descFixo").value : document.getElementById("descDivFixo").value;
    const v = Number(tipo === 'ganho' ? document.getElementById("valorFixo").value : document.getElementById("valorDivFixo").value);
    const dia = Number(tipo === 'ganho' ? document.getElementById("diaFixo").value : document.getElementById("diaDivFixo").value);

    if (!d || !v || !dia) return alert("Preencha tudo!");
    await addDoc(collection(db, "agendamentos"), { desc: d, valor: v, dia, tipo: tipo.includes('ganho') ? 'ganho' : 'divida', userId: usuarioAtual.uid, ultimoProcesso: "" });
    alert("Agendamento realizado!");
};

window.abrirModalMeta = async () => {
    const nome = prompt("Nome da Meta (Ex: Carro Novo):");
    const alvo = Number(prompt("Valor Alvo:"));
    if (nome && alvo) await addDoc(collection(db, "metas"), { nome, alvo, atual: 0, userId: usuarioAtual.uid });
};

window.atualizarMeta = async (id, valorAtual) => {
    const novo = Number(prompt("Qual o novo valor acumulado para esta meta?", valorAtual));
    if (!isNaN(novo)) await updateDoc(doc(db, "metas", id), { atual: novo });
};

window.alterarReserva = async (acao) => {
    const v = Number(prompt(acao === 'adicionar' ? "Quanto guardar?" : "Quanto retirar?"));
    if (v > 0) await addDoc(collection(db, "reserva"), { valor: acao === 'adicionar' ? v : -v, userId: usuarioAtual.uid });
};

window.adicionarConta = async () => {
    const n = prompt("Nome do Banco:"); const s = Number(prompt("Saldo:"));
    if (n) await addDoc(collection(db, "contas"), { nome: n, saldo: s, userId: usuarioAtual.uid });
};

// --- CARREGAMENTO REATIVO ---
function inicializarApp() {
    verificarAutomacoes();

    // Contas -> Receita
    onSnapshot(query(collection(db, "contas"), where("userId", "==", usuarioAtual.uid)), snap => {
        let total = 0;
        const lista = document.getElementById("listaContas"); lista.innerHTML = "";
        snap.forEach(d => {
            total += d.data().saldo;
            lista.innerHTML += `<li class="flex justify-between p-3 glass-card rounded-xl"><span>${d.data().nome}</span> <b>${BRL(d.data().saldo)}</b></li>`;
        });
        dadosGlobais.receita = total;
        document.getElementById("receitaTotal").innerText = BRL(total);
        renderizarResumos();
    });

    // Dividas -> Despesa
    onSnapshot(query(collection(db, "dividas"), where("userId", "==", usuarioAtual.uid)), snap => {
        let total = 0;
        const lista = document.getElementById("listaDividas"); lista.innerHTML = "";
        snap.forEach(d => {
            total += d.data().valor;
            lista.innerHTML += `<li class="flex justify-between p-3 glass-card rounded-xl border-l-2 border-rose-500"><span>${d.data().nome}</span> <b>${BRL(d.data().valor)}</b></li>`;
        });
        dadosGlobais.divida = total;
        document.getElementById("despesaTotal").innerText = BRL(total);
        renderizarResumos();
    });

    // Metas -> Grid com Barra
    onSnapshot(query(collection(db, "metas"), where("userId", "==", usuarioAtual.uid)), snap => {
        const grid = document.getElementById("gridMetas"); grid.innerHTML = "";
        dadosGlobais.metas = [];
        snap.forEach(d => {
            const m = d.data();
            const perc = Math.min(100, (m.atual / m.alvo) * 100).toFixed(1);
            dadosGlobais.metas.push(m);
            grid.innerHTML += `
                <div class="glass-card p-6 rounded-3xl space-y-4">
                    <div class="flex justify-between"><b>${m.nome}</b> <span class="text-xs text-yellow-500">${perc}%</span></div>
                    <div class="meta-progress"><div class="meta-bar" style="width: ${perc}%"></div></div>
                    <div class="flex justify-between text-[10px] text-slate-500"><span>${BRL(m.atual)}</span> <span>Alvo: ${BRL(m.alvo)}</span></div>
                    <button onclick="atualizarMeta('${d.id}', ${m.atual})" class="w-full bg-slate-800 py-2 rounded-xl text-[10px] font-bold">ATUALIZAR PROGRESSO</button>
                </div>`;
        });
    });

    // Reserva
    onSnapshot(query(collection(db, "reserva"), where("userId", "==", usuarioAtual.uid)), snap => {
        let res = 0; snap.forEach(d => res += d.data().valor);
        dadosGlobais.reserva = res;
        document.getElementById("accumuladoReserva").innerText = BRL(res);
    });

    // Agendamentos na lista do dashboard
    onSnapshot(query(collection(db, "agendamentos"), where("userId", "==", usuarioAtual.uid), where("tipo","==","ganho")), snap => {
        const l = document.getElementById("listaGanhosFixos"); l.innerHTML = "";
        snap.forEach(d => {
            l.innerHTML += `<li class="text-[10px] p-2 bg-emerald-900/10 rounded-lg flex justify-between"><span>${d.data().desc} (Todo dia ${d.data().dia})</span> <b>${BRL(d.data().valor)}</b></li>`;
        });
    });
}

function renderizarResumos() {
    const saldo = dadosGlobais.receita - dadosGlobais.divida;
    document.getElementById("saldoTotal").innerText = BRL(saldo);
    const p = dadosGlobais.receita > 0 ? (saldo / dadosGlobais.receita) * 100 : 0;
    document.getElementById("barraProgresso").style.width = p + "%";
}

// --- MENTOR IA PRO ---
window.perguntaIA = () => {
    const q = document.getElementById("inputChat").value;
    const cont = document.getElementById("chatConteudo");
    if(!q) return;

    cont.innerHTML += `<div class="text-right text-purple-400 font-bold">"${q}"</div>`;
    
    let r = "Não tenho certeza sobre isso, tente perguntar 'Como estou hoje?' ou 'Dicas'.";
    
    const lowQ = q.toLowerCase();
    if(lowQ.includes("como estou") || lowQ.includes("saldo") || lowQ.includes("ajuda")) {
        r = `Analisando seus dados... Seu saldo livre é de ${BRL(dadosGlobais.receita - dadosGlobais.divida)}. 
            Você tem ${dadosGlobais.metas.length} metas em andamento. 
            ${dadosGlobais.divida > dadosGlobais.receita * 0.5 ? "Cuidado! Suas dívidas ocupam mais de 50% da sua renda." : "Sua saúde financeira está estável!"}`;
    } else if(lowQ.includes("reserva")) {
        r = `Sua reserva atual é ${BRL(dadosGlobais.reserva)}. Especialistas sugerem que ela cubra pelo menos 6 meses de gastos.`;
    }

    setTimeout(() => {
        cont.innerHTML += `<div class="bg-slate-800 p-4 rounded-2xl border-l-4 border-purple-500">🤖 ${r}</div>`;
        cont.scrollTop = cont.scrollHeight;
    }, 600);
    document.getElementById("inputChat").value = "";
};
