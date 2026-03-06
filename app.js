import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// CONFIGURAÇÃO DO FIREBASE (SUBSTITUA PELAS SUAS SE O LOGIN FALHAR)
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
let dadosGlobais = { receita: 0, dividaManual: 0, dividaAuto: 0, reserva: 0, metas: [] };

const BRL = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// --- SISTEMA DE AUTENTICAÇÃO (LOGIN PRIMEIRO) ---
onAuthStateChanged(auth, (user) => {
    const loginTela = document.getElementById("loginTela");
    const dashboard = document.getElementById("dashboard");

    if (user) {
        userUID = user.uid;
        loginTela.classList.add("hidden");
        dashboard.classList.remove("hidden");
        carregarSistema();
    } else {
        loginTela.classList.remove("hidden");
        dashboard.classList.add("hidden");
        userUID = null;
    }
});

window.login = () => {
    const e = document.getElementById("email").value;
    const s = document.getElementById("senha").value;
    if (!e || !s) return alert("Preencha e-mail e senha!");
    signInWithEmailAndPassword(auth, e, s).catch(err => alert("Erro: Verifique seus dados ou se a conta existe."));
};

window.registrar = () => {
    const e = document.getElementById("email").value;
    const s = document.getElementById("senha").value;
    if (s.length < 6) return alert("A senha deve ter no mínimo 6 caracteres.");
    createUserWithEmailAndPassword(auth, e, s).then(() => alert("Conta criada!")).catch(err => alert("Erro: " + err.message));
};

window.logout = () => signOut(auth);

// --- UTILITÁRIOS ---
window.mostrarSecao = (id, btn) => {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active', 'text-purple-500'));
    btn.classList.add('active', 'text-purple-500');
};

window.togglePrivacidade = () => {
    document.body.classList.toggle('privacy-mode');
    const isPriv = document.body.classList.contains('privacy-mode');
    document.getElementById('privIcon').innerText = isPriv ? '🙈' : '👁️';
    document.getElementById('privText').innerText = isPriv ? 'Valores Ocultos' : 'Modo Privacidade';
};

window.toggleChat = () => document.getElementById("janelaChat").classList.toggle("hidden");

// --- LÓGICA DE DADOS (FIREBASE) ---
window.adicionarFixo = async () => {
    const desc = document.getElementById("descFixo").value;
    const valor = Number(document.getElementById("valorFixo").value);
    const dia = Number(document.getElementById("diaFixo").value);
    const tipo = document.getElementById("tipoFixo").value;
    if (!desc || !valor || !dia) return alert("Preencha todos os campos da automação.");
    await addDoc(collection(db, "agendamentos"), { desc, valor, dia, tipo, userId: userUID });
    document.getElementById("descFixo").value = "";
    document.getElementById("valorFixo").value = "";
    document.getElementById("diaFixo").value = "";
};

window.adicionarMetaPro = async () => {
    const nome = prompt("O que você quer conquistar?");
    const alvo = Number(prompt("Valor total necessário (R$):"));
    const aporte = Number(prompt("Quanto pretende guardar por mês para essa meta?"));
    if (nome && alvo > 0) {
        await addDoc(collection(db, "metas"), { nome, alvo, aporteMensal: aporte || 100, atual: 0, userId: userUID });
    }
};

window.adicionarDividaManual = async () => {
    const nome = prompt("Nome da dívida:");
    const valor = Number(prompt("Valor (R$):"));
    if (nome && valor > 0) await addDoc(collection(db, "dividas_manuais"), { nome, valor, userId: userUID });
};

window.alterarReserva = async (acao) => {
    const v = Number(prompt(acao === 'adicionar' ? "Quanto quer guardar?" : "Quanto quer retirar?"));
    if (v > 0) await addDoc(collection(db, "reserva"), { valor: acao === 'adicionar' ? v : -v, userId: userUID });
};

window.excluirDoc = async (col, id) => {
    if (confirm("Tem certeza que deseja excluir?")) await deleteDoc(doc(db, col, id));
};

window.atualizarMeta = async (id, atual) => {
    const novo = Number(prompt("Valor do depósito na meta:", 0));
    if (!isNaN(novo)) await updateDoc(doc(db, "metas", id), { atual: atual + novo });
};

// --- CARREGAMENTO REALTIME ---
function carregarSistema() {
    // 1. Receitas (Vem das automações tipo ganho)
    onSnapshot(query(collection(db, "agendamentos"), where("userId", "==", userUID), where("tipo", "==", "ganho")), snap => {
        let total = 0; snap.forEach(d => total += d.data().valor);
        dadosGlobais.receita = total; atualizarDashboard();
    });

    // 2. Dívidas Automáticas
    onSnapshot(query(collection(db, "agendamentos"), where("userId", "==", userUID), where("tipo", "==", "divida")), snap => {
        let total = 0; const lista = document.getElementById("listaGanhosFixos"); lista.innerHTML = "";
        snap.forEach(d => {
            const item = d.data();
            total += item.valor;
            lista.innerHTML += `<li class="flex justify-between p-3 bg-slate-900/50 rounded-xl border border-slate-800 text-[10px]">
                <span class="text-rose-400 font-bold">${item.desc} (Dia ${item.dia})</span>
                <div class="flex gap-3"><b>${BRL(item.valor)}</b> <button onclick="excluirDoc('agendamentos','${d.id}')" class="text-red-500">X</button></div>
            </li>`;
        });
        dadosGlobais.dividaAuto = total; atualizarDashboard();
    });

    // 3. Dívidas Manuais
    onSnapshot(query(collection(db, "dividas_manuais"), where("userId", "==", userUID)), snap => {
        let total = 0; const lista = document.getElementById("listaDividas"); lista.innerHTML = "";
        snap.forEach(d => {
            const item = d.data();
            total += item.valor;
            lista.innerHTML += `<li class="flex justify-between p-4 glass-card rounded-xl border-l-4 border-rose-600">
                <span>${item.nome}</span> <div class="flex gap-4"><b>${BRL(item.valor)}</b> <button onclick="excluirDoc('dividas_manuais','${d.id}')" class="text-red-500 text-xs">Apagar</button></div>
            </li>`;
        });
        dadosGlobais.dividaManual = total; atualizarDashboard();
    });

    // 4. Metas
    onSnapshot(query(collection(db, "metas"), where("userId", "==", userUID)), snap => {
        const grid = document.getElementById("gridMetas"); grid.innerHTML = "";
        dadosGlobais.metas = [];
        snap.forEach(d => {
            const m = d.data(); 
            const perc = Math.min(100, (m.atual / m.alvo) * 100).toFixed(0);
            const meses = Math.ceil((m.alvo - m.atual) / (m.aporteMensal || 1));
            dadosGlobais.metas.push(m);
            grid.innerHTML += `
                <div class="glass-card p-6 rounded-[2rem] border border-yellow-500/10 shadow-xl">
                    <div class="flex justify-between mb-2"><b>${m.nome}</b> <span class="text-yellow-500 font-black">${perc}%</span></div>
                    <div class="meta-progress mb-4"><div class="meta-bar" style="width: ${perc}%"></div></div>
                    <div class="flex justify-between text-[10px] text-slate-500 mb-4"><span>Acumulado: ${BRL(m.atual)}</span> <span>Alvo: ${BRL(m.alvo)}</span></div>
                    <p class="text-[9px] text-slate-400 italic mb-4">Previsão: ${meses <= 0 ? 'Concluída!' : meses + ' meses para atingir.'}</p>
                    <div class="flex gap-2">
                        <button onclick="atualizarMeta('${d.id}', ${m.atual})" class="flex-1 bg-yellow-600 text-black py-2 rounded-xl text-[10px] font-black hover:bg-yellow-500 transition">DEPOSITAR</button>
                        <button onclick="excluirDoc('metas','${d.id}')" class="bg-red-900/20 px-3 rounded-xl text-red-500">X</button>
                    </div>
                </div>`;
        });
    });

    // 5. Reserva
    onSnapshot(query(collection(db, "reserva"), where("userId", "==", userUID)), snap => {
        let res = 0; snap.forEach(d => res += d.data().valor);
        dadosGlobais.reserva = res;
        document.getElementById("accumuladoReserva").innerText = BRL(res);
    });
}

function atualizarDashboard() {
    const totalDiv = dadosGlobais.dividaManual + dadosGlobais.dividaAuto;
    const saldo = dadosGlobais.receita - totalDiv;
    
    document.getElementById("receitaTotal").innerText = BRL(dadosGlobais.receita);
    document.getElementById("despesaTotal").innerText = BRL(totalDiv);
    document.getElementById("saldoTotal").innerText = BRL(saldo);
    
    // BOLA DE CRISTAL (IA)
    const alerta = document.getElementById("iaAlerta");
    if(totalDiv > 0) {
        alerta.classList.remove("hidden");
        const msg = saldo < 0 
            ? `ALERTA CRÍTICO: Suas dívidas (${BRL(totalDiv)}) superam sua receita fixa. Você terá um déficit de ${BRL(Math.abs(saldo))} este mês.`
            : `SAÚDE OK: Após pagar suas dívidas, você terá ${BRL(saldo)} livres. Sugiro aportar ${BRL(saldo * 0.2)} em suas metas.`;
        document.getElementById("iaPrevisaoTexto").innerText = msg;
    } else {
        alerta.classList.add("hidden");
    }
}

// --- CHAT IA ---
window.perguntaIA = (sugestao) => {
    const input = document.getElementById("inputChat");
    const cont = document.getElementById("chatConteudo");
    const q = sugestao || input.value;
    if (!q) return;

    cont.innerHTML += `<div class="bg-purple-900/20 p-3 rounded-xl ml-8 text-right text-purple-400 font-bold border border-purple-500/10">${q}</div>`;
    
    let resp = "Estou processando seus dados financeiros...";
    const low = q.toLowerCase();

    if(low.includes("saúde") || low.includes("financeira")) {
        const saldo = dadosGlobais.receita - (dadosGlobais.dividaManual + dadosGlobais.dividaAuto);
        resp = `Sua receita é ${BRL(dadosGlobais.receita)} e dívidas totais são ${BRL(dadosGlobais.dividaManual + dadosGlobais.dividaAuto)}. Seu saldo livre é ${BRL(saldo)}. ${saldo > 0 ? 'Bom trabalho!' : 'Cuidado com os gastos!'}`;
    } else if(low.includes("metas")) {
        resp = `Você tem ${dadosGlobais.metas.length} metas ativas. A mais próxima de concluir é ${dadosGlobais.metas[0]?.nome || 'nenhuma no momento'}.`;
    }

    setTimeout(() => {
        cont.innerHTML += `<div class="bg-slate-800 p-4 rounded-xl border-l-4 border-purple-500 text-slate-300">🤖 ${resp}</div>`;
        cont.scrollTop = cont.scrollHeight;
    }, 600);
    input.value = "";
};

window.gerarPDF = () => {
    const { jsPDF } = window.jspdf;
    const docPdf = new jsPDF();
    docPdf.text("RELATÓRIO FINANCEIRO - METASBOARD", 10, 10);
    docPdf.text(`Receitas: ${BRL(dadosGlobais.receita)}`, 10, 20);
    docPdf.text(`Dívidas Totais: ${BRL(dadosGlobais.dividaManual + dadosGlobais.dividaAuto)}`, 10, 30);
    docPdf.text(`Reserva: ${BRL(dadosGlobais.reserva)}`, 10, 40);
    docPdf.save("MetasBoard_Relatorio.pdf");
};
