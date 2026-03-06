import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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
let global = { ganhos: 0, dividas: 0, saldo: 0, metas: [] };

const BRL = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// --- AUTH & TELAS ---
onAuthStateChanged(auth, user => {
    if (user) {
        userUID = user.uid;
        document.getElementById("loginTela").classList.add("hidden");
        document.getElementById("dashboard").classList.remove("hidden");
        carregarTudo();
    } else {
        document.getElementById("loginTela").classList.remove("hidden");
        document.getElementById("dashboard").classList.add("hidden");
    }
});

window.login = () => signInWithEmailAndPassword(auth, document.getElementById("email").value, document.getElementById("senha").value).catch(e => alert("Erro no login"));
window.registrar = () => createUserWithEmailAndPassword(auth, document.getElementById("email").value, document.getElementById("senha").value).catch(e => alert("Erro no registro"));
window.logout = () => signOut(auth);

window.mostrarSecao = (id, btn) => {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active', 'text-purple-500'));
    btn.classList.add('active', 'text-purple-500');
};

// --- FLUXO FINANCEIRO (DASHBOARD) ---
window.salvarFluxo = async () => {
    const nome = document.getElementById("nomeFluxo").value;
    const valor = Number(document.getElementById("valorFluxo").value);
    const tipo = document.getElementById("tipoFluxo").value;
    if(nome && valor > 0) {
        await addDoc(collection(db, "fluxo"), { nome, valor, tipo, userId: userUID, data: Date.now() });
        document.getElementById("nomeFluxo").value = "";
        document.getElementById("valorFluxo").value = "";
    }
};

function carregarTudo() {
    // Escuta Ganhos e Dívidas
    onSnapshot(query(collection(db, "fluxo"), where("userId", "==", userUID)), snap => {
        let g = 0; let d = 0;
        const lista = document.getElementById("listaFluxo"); lista.innerHTML = "";
        snap.forEach(docSnap => {
            const item = docSnap.data();
            if(item.tipo === 'ganho') g += item.valor; else d += item.valor;
            lista.innerHTML += `
                <div class="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5 text-xs">
                    <span>${item.nome}</span>
                    <div class="flex gap-4 items-center">
                        <b class="${item.tipo === 'ganho' ? 'text-emerald-400' : 'text-rose-500'}">${BRL(item.valor)}</b>
                        <button onclick="excluirDoc('fluxo','${docSnap.id}')" class="opacity-30 hover:opacity-100 text-red-500 font-bold">✕</button>
                    </div>
                </div>`;
        });
        global.ganhos = g; global.dividas = d; global.saldo = g - d;
        atualizarCards();
        atualizarCoachingDividas(snap);
    });

    // Escuta Metas com Ranking
    onSnapshot(query(collection(db, "metas"), where("userId", "==", userUID)), snap => {
        const grid = document.getElementById("gridMetas"); grid.innerHTML = "";
        const metasArr = [];
        snap.forEach(d => metasArr.push({ ...d.data(), id: d.id }));
        
        // Ranking: Mais perto de 100% no topo
        metasArr.sort((a,b) => (b.atual/b.alvo) - (a.atual/a.alvo));
        global.metas = metasArr;

        metasArr.forEach((m, index) => {
            const perc = Math.min(100, (m.atual / m.alvo) * 100).toFixed(0);
            grid.innerHTML += `
                <div class="glass-card p-8 rounded-[2.5rem] relative ${index === 0 ? 'border-yellow-500/40 border-2' : 'border-white/5'}">
                    ${index === 0 ? '<span class="absolute -top-3 left-6 bg-yellow-500 text-black text-[10px] font-black px-3 py-1 rounded-full italic">🏆 LÍDER DO RANKING</span>' : ''}
                    <div class="flex justify-between items-start mb-6">
                        <div><h4 class="text-xl font-black">${m.nome}</h4><p class="text-[10px] text-slate-500">ALVO: ${BRL(m.alvo)}</p></div>
                        <div class="flex gap-2">
                            <button onclick="editarMeta('${m.id}', '${m.nome}', ${m.alvo})" class="text-xs text-slate-500 hover:text-white">Editar</button>
                            <button onclick="excluirDoc('metas','${m.id}')" class="text-xs text-slate-500 hover:text-red-500">Excluir</button>
                        </div>
                    </div>
                    <div class="h-4 bg-black/40 rounded-full overflow-hidden mb-4"><div class="meta-bar h-full bg-yellow-500" style="width: ${perc}%"></div></div>
                    <div class="flex justify-between items-center">
                        <span class="money-val text-2xl font-black">${BRL(m.atual)}</span>
                        <div class="flex gap-2">
                             <button onclick="movimentarMeta('${m.id}', ${m.atual}, 'add')" class="bg-emerald-600 px-4 py-2 rounded-xl text-xs font-black">+</button>
                             <button onclick="movimentarMeta('${m.id}', ${m.atual}, 'sub')" class="bg-rose-600 px-4 py-2 rounded-xl text-xs font-black">-</button>
                        </div>
                    </div>
                </div>`;
        });
    });
}

function atualizarCards() {
    document.getElementById("receitaTotal").innerText = BRL(global.ganhos);
    document.getElementById("despesaTotal").innerText = BRL(global.dividas);
    document.getElementById("saldoTotal").innerText = BRL(global.saldo);

    const box = document.getElementById("iaBox");
    const msg = document.getElementById("iaMsg");
    const label = document.getElementById("iaLabel");
    
    if(global.saldo < 0) {
        box.className = "ia-vermelho p-8 rounded-[2.5rem] flex items-center gap-6";
        label.innerText = "ALERTA DE SOBREVIVÊNCIA";
        msg.innerText = "Suas dívidas venceram sua renda! Você precisa cortar gastos supérfluos IMEDIATAMENTE ou seu patrimônio irá sangrar.";
    } else if (global.saldo > 0) {
        box.className = "ia-roxo p-8 rounded-[2.5rem] flex items-center gap-6";
        label.innerText = "ESTRATÉGIA DE CRESCIMENTO";
        msg.innerText = `Você tem ${BRL(global.saldo)} livres. Se investir esse valor a 1% ao mês, em um ano você terá ${BRL(global.saldo * 12.68)}. Não gaste, multiplique!`;
    }
}

// --- METAS ACTIONS ---
window.novaMeta = async () => {
    const { value: formValues } = await Swal.fire({
        title: 'NOVO SONHO',
        html: '<input id="sw-nome" class="swal2-input" placeholder="Nome da Meta"><input id="sw-alvo" type="number" class="swal2-input" placeholder="Valor Total R$">',
        focusConfirm: false,
        preConfirm: () => [document.getElementById('sw-nome').value, document.getElementById('sw-alvo').value]
    });
    if(formValues && formValues[0]) {
        await addDoc(collection(db, "metas"), { nome: formValues[0], alvo: Number(formValues[1]), atual: 0, userId: userUID });
        Swal.fire('META CRIADA!', 'O primeiro passo para conquistar é planejar.', 'success');
    }
};

window.movimentarMeta = async (id, atual, acao) => {
    const valor = Number(prompt("Qual o valor?"));
    if(!valor) return;
    const novo = acao === 'add' ? atual + valor : atual - valor;
    await updateDoc(doc(db, "metas", id), { atual: Math.max(0, novo) });

    if(acao === 'add') {
        const frases = ["Você está mais perto do seu sonho!", "Excelente escolha financeira!", "Cada centavo conta na sua liberdade!", "O seu 'eu' do futuro agradece!"];
        Swal.fire({ title: 'BOA!', text: frases[Math.floor(Math.random()*frases.length)], icon: 'success', toast: true, position: 'top-end', timer: 3000, showConfirmButton: false });
    }
};

window.editarMeta = async (id, nome, alvo) => {
    const novoNome = prompt("Novo nome:", nome);
    const novoAlvo = Number(prompt("Novo valor alvo:", alvo));
    if(novoNome && novoAlvo) await updateDoc(doc(db, "metas", id), { nome: novoNome, alvo: novoAlvo });
};

// --- DÍVIDAS COACHING ---
function atualizarCoachingDividas(snap) {
    const container = document.getElementById("listaDívidasCoaching");
    container.innerHTML = "";
    let temDivida = false;
    snap.forEach(d => {
        const item = d.data();
        if(item.tipo === 'divida') {
            temDivida = true;
            container.innerHTML += `
                <div class="flex justify-between items-center p-4 bg-rose-500/10 rounded-2xl border border-rose-500/20">
                    <div>
                        <b class="text-rose-400 uppercase text-xs">${item.nome}</b>
                        <p class="text-[10px] text-slate-500">Sugestão: Tente renegociar ou eliminar gastos fixos de ${item.nome} para liberar ${BRL(item.valor/30)} por dia.</p>
                    </div>
                    <b class="money-val">${BRL(item.valor)}</b>
                </div>`;
        }
    });
    if(!temDivida) container.innerHTML = "<p class='text-emerald-500 font-black'>PARABÉNS! Nenhuma dívida registrada. Você é dono do seu dinheiro!</p>";
}

window.excluirDoc = async (col, id) => {
    if(confirm("Deseja realmente excluir?")) await deleteDoc(doc(db, col, id));
};

// --- CHAT & PRIVACIDADE ---
window.togglePrivacidade = () => document.body.classList.toggle("privacy-mode");
window.toggleChat = () => document.getElementById("janelaChat").classList.toggle("hidden");

window.perguntaIA = (sugestao) => {
    const input = document.getElementById("chatInput");
    const q = sugestao || input.value;
    if(!q) return;
    const box = document.getElementById("chatBox");
    box.innerHTML += `<div class="bg-purple-900/40 p-3 rounded-xl ml-6 text-right">${q}</div>`;
    
    setTimeout(() => {
        let r = "Interessante... vamos analisar seu fluxo financeiro.";
        if(q.includes("investir")) r = `Com seu saldo de ${BRL(global.saldo)}, recomendo diversificar 50% em Tesouro Selic e 50% em Fundos Imobiliários para gerar renda passiva.`;
        box.innerHTML += `<div class="bg-slate-800 p-3 rounded-xl mr-6 text-left border-l-2 border-purple-500">🤖 ${r}</div>`;
        box.scrollTop = box.scrollHeight;
    }, 800);
    input.value = "";
};
