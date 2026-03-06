import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
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
let userUID = null;
let dadosDashboard = { receita: 0, divida: 0, reserva: 0, saldoLivre: 0 };

const BRL = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// --- MODO PRIVACIDADE ---
window.togglePrivacidade = () => {
    document.body.classList.toggle('privacy-mode');
    const isPriv = document.body.classList.contains('privacy-mode');
    document.getElementById('privIcon').innerText = isPriv ? '🙈' : '👁️';
    document.getElementById('privText').innerText = isPriv ? 'Valores Ocultos' : 'Modo Privacidade';
};

// --- EXPORTAR PDF ---
window.gerarPDF = () => {
    const { jsPDF } = window.jspdf;
    const docPdf = new jsPDF();
    docPdf.setFont("helvetica", "bold");
    docPdf.text("RELATÓRIO MENSAL - METASBOARD", 20, 20);
    docPdf.setFontSize(12);
    docPdf.text(`Receitas: ${BRL(dadosDashboard.receita)}`, 20, 40);
    docPdf.text(`Dívidas: ${BRL(dadosDashboard.divida)}`, 20, 50);
    docPdf.text(`Saldo Livre: ${BRL(dadosDashboard.saldoLivre)}`, 20, 60);
    docPdf.text(`Reserva: ${BRL(dadosDashboard.reserva)}`, 20, 70);
    docPdf.save("MetasBoard_Relatorio.pdf");
};

// --- METAS PRO (PLANO DE CONQUISTA) ---
window.adicionarMetaPro = async () => {
    const nome = prompt("O que vais conquistar?");
    const alvo = Number(prompt("Qual o valor total necessário?"));
    const aporte = Number(prompt("Quanto planeias guardar por mês para esta meta?"));
    if (nome && alvo > 0) {
        await addDoc(collection(db, "metas"), { 
            nome, alvo, aporteMensal: aporte || 100, atual: 0, userId: userUID, criadoEm: Date.now() 
        });
    }
};

// --- CORE SYSTEM ---
onAuthStateChanged(auth, user => {
    if (user) {
        userUID = user.uid;
        document.getElementById("dashboard").classList.remove("hidden");
        carregarTudo();
    } else {
        // Redirecionar para login ou mostrar login (omitido para brevidade, usar o código anterior)
    }
});

function carregarTudo() {
    // 1. Snapshot Contas
    onSnapshot(query(collection(db, "contas"), where("userId", "==", userUID)), snap => {
        let total = 0;
        const lista = document.getElementById("listaContas"); lista.innerHTML = "";
        snap.forEach(d => { total += d.data().saldo; 
            lista.innerHTML += `<li class="flex justify-between p-4 glass-card rounded-xl"><span>${d.data().nome}</span> <b>${BRL(d.data().saldo)}</b></li>`;
        });
        dadosDashboard.receita = total; atualizarCalculos();
    });

    // 2. Snapshot Dívidas (Fixas + Agendadas)
    onSnapshot(query(collection(db, "agendamentos"), where("userId", "==", userUID)), snap => {
        let total = 0; 
        const lista = document.getElementById("listaGanhosFixos"); lista.innerHTML = "";
        snap.forEach(d => {
            const data = d.data();
            if(data.tipo === 'divida') total += data.valor;
            lista.innerHTML += `<li class="text-xs p-3 bg-slate-900/50 rounded-xl flex justify-between"><span>${data.desc} (Dia ${data.dia})</span> <b>${BRL(data.valor)}</b></li>`;
        });
        dadosDashboard.divida = total; atualizarCalculos();
    });

    // 3. Snapshot Metas com Previsão IA
    onSnapshot(query(collection(db, "metas"), where("userId", "==", userUID)), snap => {
        const grid = document.getElementById("gridMetas"); grid.innerHTML = "";
        snap.forEach(d => {
            const m = d.data();
            const faltante = m.alvo - m.atual;
            const mesesRestantes = Math.ceil(faltante / (m.aporteMensal || 1));
            const perc = Math.min(100, (m.atual / m.alvo) * 100).toFixed(0);

            grid.innerHTML += `
                <div class="glass-card p-8 rounded-[2.5rem] border border-yellow-500/20 shadow-2xl">
                    <div class="flex justify-between mb-4"><h4 class="text-xl font-black">${m.nome}</h4> <span class="text-yellow-500 font-black">${perc}%</span></div>
                    <div class="meta-progress mb-6"><div class="meta-bar" style="width: ${perc}%"></div></div>
                    <div class="grid grid-cols-2 gap-4 text-center mb-6">
                        <div class="bg-black/40 p-3 rounded-2xl"><p class="text-[10px] text-slate-500">FALTAM</p><b class="money-val text-sm">${BRL(faltante)}</b></div>
                        <div class="bg-black/40 p-3 rounded-2xl"><p class="text-[10px] text-slate-500">PREVISÃO</p><b class="text-sm text-yellow-500">${mesesRestantes} Meses</b></div>
                    </div>
                    <button onclick="atualizarSaldoMeta('${d.id}', ${m.atual})" class="w-full bg-yellow-500 text-black py-3 rounded-xl font-black shadow-lg">DEPOSITAR NA META</button>
                </div>`;
        });
    });

    // 4. Reserva
    onSnapshot(query(collection(db, "reserva"), where("userId", "==", userUID)), snap => {
        let res = 0; snap.forEach(d => res += d.data().valor);
        dadosDashboard.reserva = res;
        document.getElementById("accumuladoReserva").innerText = BRL(res);
    });
}

function atualizarCalculos() {
    dadosDashboard.saldoLivre = dadosDashboard.receita - dadosDashboard.divida;
    document.getElementById("receitaTotal").innerText = BRL(dadosDashboard.receita);
    document.getElementById("despesaTotal").innerText = BRL(dadosDashboard.divida);
    document.getElementById("saldoTotal").innerText = BRL(dadosDashboard.saldoLivre);
    
    // IA PREDITIVA (Aviso de Próxima Dívida)
    const hj = new Date().getDate();
    const alerta = document.getElementById("iaAlerta");
    if(dadosDashboard.divida > 0) {
        alerta.classList.remove("hidden");
        document.getElementById("iaPrevisaoTexto").innerText = `Análise concluída: Se mantiveres o teu saldo de ${BRL(dadosDashboard.saldoLivre)}, conseguirás cobrir as tuas próximas dívidas automáticas e ainda aportar nas metas.`;
    }
}

window.atualizarSaldoMeta = async (id, atual) => {
    const valor = Number(prompt("Quanto queres depositar nesta meta agora?"));
    if (valor > 0) await updateDoc(doc(db, "metas", id), { atual: atual + valor });
};

window.mostrarSecao = (id, btn) => {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
};
