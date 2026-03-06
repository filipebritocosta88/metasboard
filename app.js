import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC4wyouZuCsLZGpmTr5SdXTb7UixdetHoQ", // Verifique se é a sua
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
let dados = { receita: 0, divida: 0, reserva: 0, saldo: 0, metas: [] };

const BRL = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// --- AUTH ---
window.login = () => {
    const e = document.getElementById("email").value;
    const s = document.getElementById("senha").value;
    signInWithEmailAndPassword(auth, e, s).catch(err => alert("Erro: " + err.message));
};

window.registrar = () => {
    const e = document.getElementById("email").value;
    const s = document.getElementById("senha").value;
    createUserWithEmailAndPassword(auth, e, s).catch(err => alert("Erro ao registrar: " + err.message));
};

window.logout = () => signOut(auth);

onAuthStateChanged(auth, user => {
    if (user) {
        userUID = user.uid;
        document.getElementById("loginTela").classList.add("hidden");
        document.getElementById("dashboard").classList.remove("hidden");
        inicializarSistema();
    } else {
        document.getElementById("loginTela").classList.remove("hidden");
        document.getElementById("dashboard").classList.add("hidden");
    }
});

// --- UI ---
window.mostrarSecao = (id, btn) => {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active', 'text-purple-500'));
    btn.classList.add('active', 'text-purple-500');
};

window.togglePrivacidade = () => document.body.classList.toggle('privacy-mode');

// --- AUTOMAÇÕES E DADOS ---
async function verificarAutomacoes() {
    const hoje = new Date();
    const diaAtual = hoje.getDate();
    const mesReferencia = `${hoje.getMonth() + 1}-${hoje.getFullYear()}`;

    const q = query(collection(db, "agendamentos"), where("userId", "==", userUID));
    const snap = await getDocs(q);

    snap.forEach(async (d) => {
        const item = d.data();
        if (item.dia == diaAtual && item.ultimoProcesso !== mesReferencia) {
            // Se for ganho, soma nas contas. Se for dívida, lança em dívidas.
            const col = item.tipo === 'ganho' ? "contas" : "dividas";
            await addDoc(collection(db, col), { 
                nome: `[AUTO] ${item.desc}`, 
                valor: item.valor, 
                saldo: item.valor, 
                userId: userUID,
                data: Date.now()
            });
            await updateDoc(doc(db, "agendamentos", d.id), { ultimoProcesso: mesReferencia });
        }
    });
}

window.adicionarFixo = async () => {
    const desc = document.getElementById("descFixo").value;
    const valor = Number(document.getElementById("valorFixo").value);
    const dia = Number(document.getElementById("diaFixo").value);
    const tipo = document.getElementById("tipoFixo").value;

    if (!desc || !valor || !dia) return alert("Preencha tudo!");
    await addDoc(collection(db, "agendamentos"), { desc, valor, dia, tipo, userId: userUID, ultimoProcesso: "" });
    alert("Automação agendada!");
};

window.adicionarMetaPro = async () => {
    const nome = prompt("Nome do objetivo (ex: Viagem):");
    const alvo = Number(prompt("Valor total (R$):"));
    const mensal = Number(prompt("Quanto pretende guardar por mês?"));
    if (nome && alvo) {
        await addDoc(collection(db, "metas"), { nome, alvo, aporte: mensal || 100, atual: 0, userId: userUID });
    }
};

window.atualizarMeta = async (id, atualValor) => {
    const valor = Number(prompt("Quanto está depositando agora?"));
    if (valor) await updateDoc(doc(db, "metas", id), { atual: atualValor + valor });
};

window.excluirDoc = async (col, id) => { if(confirm("Excluir item?")) await deleteDoc(doc(db, col, id)); };

window.alterarReserva = async (acao) => {
    const v = Number(prompt("Valor:"));
    if (v) await addDoc(collection(db, "reserva"), { valor: acao === 'adicionar' ? v : -v, userId: userUID });
};

// --- RENDERIZAÇÃO REALTIME ---
function inicializarSistema() {
    verificarAutomacoes();

    // Contas (Receita)
    onSnapshot(query(collection(db, "contas"), where("userId", "==", userUID)), snap => {
        let t = 0; snap.forEach(d => t += (d.data().saldo || d.data().valor));
        dados.receita = t; atualizarDashboard();
    });

    // Dívidas (Soma Agendadas + Manuais)
    onSnapshot(query(collection(db, "agendamentos"), where("userId", "==", userUID), where("tipo", "==", "divida")), snap => {
        let t = 0; 
        const lista = document.getElementById("listaGanhosFixos"); lista.innerHTML = "";
        snap.forEach(d => {
            const item = d.data();
            t += item.valor;
            lista.innerHTML += `<li class="flex justify-between p-3 bg-slate-900/50 rounded-xl text-[10px] border border-slate-800">
                <span>${item.desc} (Todo dia ${item.dia})</span>
                <div class="flex gap-2"><b>${BRL(item.valor)}</b> <button onclick="excluirDoc('agendamentos','${d.id}')" class="text-red-500">X</button></div>
            </li>`;
        });
        dados.divida_auto = t; atualizarDashboard();
    });

    // Metas
    onSnapshot(query(collection(db, "metas"), where("userId", "==", userUID)), snap => {
        const grid = document.getElementById("gridMetas"); grid.innerHTML = "";
        snap.forEach(d => {
            const m = d.data();
            const perc = Math.min(100, (m.atual / m.alvo) * 100).toFixed(0);
            const meses = Math.ceil((m.alvo - m.atual) / (m.aporte || 1));
            grid.innerHTML += `
                <div class="glass-card p-6 rounded-[2rem] border border-yellow-500/10">
                    <div class="flex justify-between mb-2"><b>${m.nome}</b> <span class="text-yellow-500 font-bold">${perc}%</span></div>
                    <div class="meta-progress mb-4"><div class="meta-bar" style="width: ${perc}%"></div></div>
                    <p class="text-[10px] text-slate-500 mb-4">Faltam aprox. ${meses} meses para concluir.</p>
                    <div class="flex gap-2">
                        <button onclick="atualizarMeta('${d.id}', ${m.atual})" class="flex-1 bg-yellow-500 text-black py-2 rounded-lg text-xs font-black">DEPOSITAR</button>
                        <button onclick="excluirDoc('metas','${d.id}')" class="px-3 bg-red-900/20 text-red-500 rounded-lg">X</button>
                    </div>
                </div>`;
        });
    });

    // Reserva
    onSnapshot(query(collection(db, "reserva"), where("userId", "==", userUID)), snap => {
        let r = 0; snap.forEach(d => r += d.data().valor);
        dados.reserva = r; document.getElementById("accumuladoReserva").innerText = BRL(r);
    });
}

function atualizarDashboard() {
    const totalDivida = (dados.divida_auto || 0);
    const saldo = dados.receita - totalDivida;
    
    document.getElementById("receitaTotal").innerText = BRL(dados.receita);
    document.getElementById("despesaTotal").innerText = BRL(totalDivida);
    document.getElementById("saldoTotal").innerText = BRL(saldo);

    const alerta = document.getElementById("iaAlerta");
    if(totalDivida > 0) {
        alerta.classList.remove("hidden");
        document.getElementById("iaPrevisaoTexto").innerText = `IA: Você possui ${BRL(totalDivida)} em dívidas automáticas este mês. Seu saldo livre é de ${BRL(saldo)}.`;
    }
}

window.gerarPDF = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("RELATÓRIO METASBOARD", 10, 10);
    doc.text(`Receita: ${BRL(dados.receita)}`, 10, 20);
    doc.text(`Dívidas: ${BRL(dados.divida_auto)}`, 10, 30);
    doc.save("financeiro.pdf");
};
