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
let dados = { receita: 0, despesaFixa: 0, reserva: 0, metas: [], dividas: [] };

const BRL = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// --- AUTH ---
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

window.login = () => {
    const e = document.getElementById("email").value;
    const s = document.getElementById("senha").value;
    signInWithEmailAndPassword(auth, e, s).catch(err => alert("Erro ao entrar."));
};

window.registrar = () => {
    const e = document.getElementById("email").value;
    const s = document.getElementById("senha").value;
    createUserWithEmailAndPassword(auth, e, s).then(() => alert("Conta criada!")).catch(err => alert("Erro ao criar conta."));
};

window.logout = () => signOut(auth);

// --- UI CONTROL ---
window.mostrarSecao = (id, btn) => {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active', 'text-purple-500'));
    btn.classList.add('active', 'text-purple-500');
};

window.togglePrivacidade = () => document.body.classList.toggle('privacy-mode');
window.toggleChat = () => document.getElementById("janelaChat").classList.toggle("hidden");

// --- CORE DATA ---
function carregarTudo() {
    // 1. Snapshot Agendamentos (Ganhos e Dívidas Fixas)
    onSnapshot(query(collection(db, "agendamentos"), where("userId", "==", userUID)), snap => {
        let rec = 0; let des = 0;
        const lista = document.getElementById("listaGanhosFixos"); lista.innerHTML = "";
        snap.forEach(d => {
            const item = d.data();
            if(item.tipo === 'ganho') rec += item.valor; else des += item.valor;
            lista.innerHTML += `
                <div class="flex justify-between p-3 bg-black/20 rounded-xl border border-white/5 text-xs">
                    <span class="${item.tipo === 'ganho' ? 'text-emerald-400' : 'text-rose-400'} font-bold">${item.desc} (Dia ${item.dia})</span>
                    <div class="flex gap-4"><b>${BRL(item.valor)}</b> <button onclick="excluirDoc('agendamentos','${d.id}')" class="text-white/20 hover:text-red-500">✕</button></div>
                </div>`;
        });
        dados.receita = rec; dados.despesaFixa = des; 
        atualizarIA();
    });

    // 2. Snapshot Metas (Com Correção de Exibição)
    onSnapshot(query(collection(db, "metas"), where("userId", "==", userUID)), snap => {
        const grid = document.getElementById("gridMetas"); grid.innerHTML = "";
        dados.metas = [];
        snap.forEach(d => {
            const m = d.data();
            m.id = d.id;
            dados.metas.push(m);
            const perc = Math.min(100, (m.atual / m.alvo) * 100).toFixed(1);
            const corBarra = perc > 80 ? '#10b981' : perc > 40 ? '#eab308' : '#3b82f6';
            
            grid.innerHTML += `
                <div class="glass-card p-8 rounded-[2.5rem] border-white/5 hover:border-yellow-500/20 shadow-2xl">
                    <div class="flex justify-between items-start mb-6">
                        <div><h4 class="text-xl font-black">${m.nome}</h4><p class="text-[10px] text-slate-500 uppercase tracking-widest">Alvo: ${BRL(m.alvo)}</p></div>
                        <span class="text-2xl font-black italic text-white/20">${perc}%</span>
                    </div>
                    <div class="meta-progress mb-6 shadow-inner"><div class="meta-bar" style="width: ${perc}%; background: ${corBarra}; box-shadow: 0 0 15px ${corBarra}44"></div></div>
                    <div class="text-center mb-6"><span class="money-val text-2xl font-black italic">${BRL(m.atual)}</span></div>
                    <div class="grid grid-cols-2 gap-3">
                        <button onclick="ajustarMeta('${d.id}', ${m.atual}, 'add')" class="bg-white/5 p-3 rounded-xl font-bold hover:bg-emerald-600 transition">+ Adicionar</button>
                        <button onclick="ajustarMeta('${d.id}', ${m.atual}, 'sub')" class="bg-white/5 p-3 rounded-xl font-bold hover:bg-rose-900 transition">- Retirar</button>
                    </div>
                    <button onclick="excluirDoc('metas','${d.id}')" class="w-full mt-4 text-[10px] text-slate-600 hover:text-red-500 uppercase font-bold tracking-widest transition">Excluir Meta</button>
                </div>`;
        });
        atualizarIA();
    });

    // 3. Snapshot Dívidas com Importância
    onSnapshot(query(collection(db, "dividas_especiais"), where("userId", "==", userUID)), snap => {
        const lista = document.getElementById("listaDividas"); lista.innerHTML = "";
        dados.dividas = [];
        snap.forEach(d => {
            const div = d.data();
            dados.dividas.push(div);
            const corPrioridade = div.prioridade === 'alta' ? 'bg-rose-600' : div.prioridade === 'media' ? 'bg-orange-500' : 'bg-blue-500';
            lista.innerHTML += `
                <div class="flex justify-between items-center p-5 glass-card rounded-2xl border-l-8 ${div.prioridade === 'alta' ? 'border-rose-600' : 'border-slate-700'}">
                    <div>
                        <span class="${corPrioridade} text-[9px] px-2 py-1 rounded-full font-black uppercase mb-1 inline-block">Prioridade ${div.prioridade}</span>
                        <h4 class="font-bold">${div.nome}</h4>
                    </div>
                    <div class="flex items-center gap-6">
                        <b class="money-val text-xl">${BRL(div.valor)}</b>
                        <button onclick="excluirDoc('dividas_especiais','${d.id}')" class="text-slate-600 hover:text-red-500">✕</button>
                    </div>
                </div>`;
        });
        atualizarIA();
    });

    // 4. Reserva
    onSnapshot(query(collection(db, "reserva"), where("userId", "==", userUID)), snap => {
        let r = 0; snap.forEach(d => r += d.data().valor);
        dados.reserva = r;
        document.getElementById("accumuladoReserva").innerText = BRL(r);
    });
}

// --- IA PREDITIVA CAMALEÃO ---
function atualizarIA() {
    const saldo = dados.receita - dados.despesaFixa;
    const dividasAltas = dados.dividas.filter(d => d.prioridade === 'alta').reduce((acc, v) => acc + v.valor, 0);
    
    document.getElementById("receitaTotal").innerText = BRL(dados.receita);
    document.getElementById("despesaTotal").innerText = BRL(dados.despesaFixa);
    document.getElementById("saldoTotal").innerText = BRL(saldo);

    const container = document.getElementById("iaContainer");
    const titulo = document.getElementById("iaTitulo");
    const texto = document.getElementById("iaTexto");
    const icone = document.getElementById("iaIcon");

    container.className = "p-8 rounded-[2.5rem] flex items-center gap-6 transition-all duration-1000 ";

    if (dividasAltas > 0 && saldo < dividasAltas) {
        container.classList.add("ia-anim-vermelho");
        titulo.innerText = "ALERTA DE PRIORIDADE CRÍTICA";
        icone.innerText = "⚠️";
        texto.innerText = `Você possui ${BRL(dividasAltas)} em dívidas de ALTA importância. Seu saldo livre (${BRL(saldo)}) não cobre essas prioridades. Cuidado!`;
    } else if (saldo > 0) {
        container.classList.add("ia-anim-roxo");
        titulo.innerText = "SAÚDE FINANCEIRA ESTÁVEL";
        icone.innerText = "💜";
        texto.innerText = `Análise concluída: Você tem ${BRL(saldo)} sobrando. Recomendo destinar 20% para sua meta de maior progresso.`;
    } else {
        container.classList.add("ia-anim-azul");
        titulo.innerText = "DICA DO ESTRATEGISTA";
        icone.innerText = "💡";
        texto.innerText = "Tente reduzir custos fixos para liberar margem para suas metas de longo prazo.";
    }
}

// --- ACTIONS ---
window.adicionarFixo = async () => {
    const desc = document.getElementById("descFixo").value;
    const valor = Number(document.getElementById("valorFixo").value);
    const dia = Number(document.getElementById("diaFixo").value);
    const tipo = document.getElementById("tipoFixo").value;
    if(desc && valor) await addDoc(collection(db, "agendamentos"), { desc, valor, dia, tipo, userId: userUID });
    document.getElementById("descFixo").value = ""; document.getElementById("valorFixo").value = "";
};

window.adicionarMetaPro = async () => {
    const nome = prompt("Nome do objetivo:");
    const alvo = Number(prompt("Valor Alvo (R$):"));
    if(nome && alvo) await addDoc(collection(db, "metas"), { nome, alvo, atual: 0, userId: userUID, criadoEm: Date.now() });
};

window.ajustarMeta = async (id, atual, acao) => {
    const v = Number(prompt("Valor da movimentação:"));
    if(!v) return;
    const novoValor = acao === 'add' ? atual + v : atual - v;
    await updateDoc(doc(db, "metas", id), { atual: Math.max(0, novoValor) });
};

window.adicionarDividaManual = async () => {
    const nome = prompt("Nome da dívida:");
    const valor = Number(prompt("Valor (R$):"));
    const prioridade = prompt("Importância (alta, media, baixa):").toLowerCase();
    if(nome && valor) await addDoc(collection(db, "dividas_especiais"), { nome, valor, prioridade, userId: userUID });
};

window.alterarReserva = async (acao) => {
    const v = Number(prompt("Valor:"));
    if(v) await addDoc(collection(db, "reserva"), { valor: acao === 'adicionar' ? v : -v, userId: userUID });
};

window.excluirDoc = async (col, id) => { if(confirm("Remover item?")) await deleteDoc(doc(db, col, id)); };

// --- CHAT IA EXPANDIDO ---
window.perguntaIA = (sugestao) => {
    const input = document.getElementById("inputChat");
    const cont = document.getElementById("chatConteudo");
    const q = sugestao || input.value;
    if(!q) return;

    cont.innerHTML += `<div class="bg-purple-600/20 p-4 rounded-2xl ml-10 text-right text-xs border border-purple-500/20">${q}</div>`;
    
    let resp = "Analisando seus dados em tempo real...";
    const low = q.toLowerCase();

    if(low.includes("saúde")) {
        resp = `Seu saldo livre hoje é ${BRL(dados.receita - dados.despesaFixa)}. Você tem ${dados.dividas.filter(d => d.prioridade === 'alta').length} dívidas críticas pendentes.`;
    } else if(low.includes("meta")) {
        const top = dados.metas.sort((a,b) => (b.atual/b.alvo) - (a.atual/a.alvo))[0];
        resp = top ? `Sua meta mais próxima é "${top.nome}" com ${(top.atual/top.alvo*100).toFixed(1)}% concluído.` : "Você ainda não tem metas cadastradas.";
    } else if(low.includes("economizar") || low.includes("dívidas")) {
        resp = "Para dívidas de ALTA importância, tente renegociar os juros imediatamente ou use 50% da sua reserva se os juros forem maiores que 2% ao mês.";
    }

    setTimeout(() => {
        cont.innerHTML += `<div class="bg-slate-800 p-4 rounded-2xl text-xs border-l-4 border-purple-500">🤖 ${resp}</div>`;
        cont.scrollTop = cont.scrollHeight;
    }, 800);
    input.value = "";
};
