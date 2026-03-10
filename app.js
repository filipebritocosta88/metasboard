import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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

let userUID = null, tipoAtual = 'ganho', chart = null;
let fin = { previsto: 0, saldoReal: 0, dividas: 0, lista: [] };
let metas = [];

const BRL = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// --- AUX: CALCULAR 5º DIA ÚTIL ---
function getQuintoDiaUtil() {
    let date = new Date();
    date.setDate(1);
    let count = 0;
    while (count < 5) {
        let day = date.getDay();
        if (day !== 0 && day !== 6) count++;
        if (count < 5) date.setDate(date.getDate() + 1);
    }
    return date;
}

// --- AUTH ---
window.executarAuth = () => {
    const e = document.getElementById('email').value, s = document.getElementById('senha').value;
    signInWithEmailAndPassword(auth, e, s).catch(() => createUserWithEmailAndPassword(auth, e, s));
};
window.sairDoSistema = () => signOut(auth).then(() => location.reload());

onAuthStateChanged(auth, user => {
    if (user) { 
        userUID = user.uid; 
        document.getElementById('loginTela').classList.add('hidden'); 
        document.getElementById('dashboard').classList.remove('hidden'); 
        iniciarRealtime(); 
    } else { document.getElementById('loginTela').classList.remove('hidden'); }
});

function iniciarRealtime() {
    onSnapshot(query(collection(db, "fluxo"), where("userId", "==", userUID)), snap => {
        let prev = 0, real = 0, div = 0; fin.lista = [];
        const hoje = new Date();
        const quintoDia = getQuintoDiaUtil();

        snap.forEach(ds => {
            const i = { ...ds.data(), id: ds.id };
            if (i.status !== 'paga') {
                if (i.tipo === 'ganho') {
                    prev += i.valor;
                    // Lógica 5º Dia Útil: Se marcado como salário e hoje >= 5º dia útil
                    if (i.isSalario) {
                        if (hoje >= quintoDia) real += i.valor;
                    } else {
                        // Rendas normais caem na data do lançamento
                        if (hoje >= new Date(i.data)) real += i.valor;
                    }
                } else {
                    div += i.valor;
                }
            }
            fin.lista.push(i);
        });
        fin.previsto = prev; fin.saldoReal = real; fin.dividas = div;
        atualizarUI();
    });

    onSnapshot(query(collection(db, "metas"), where("userId", "==", userUID), where("status", "==", "ativa")), snap => {
        metas = [];
        const grid = document.getElementById('rankingGrid'); grid.innerHTML = "";
        snap.forEach(ds => {
            const m = { ...ds.data(), id: ds.id }; metas.push(m);
            const checklist = m.checklist || [];
            const concluidos = checklist.filter(c => c.done).length;
            const perc = checklist.length > 0 ? (concluidos / checklist.length) * 100 : 0;

            grid.innerHTML += `
            <div class="glass-card p-6 border-l-4 border-purple-500">
                <div class="flex justify-between items-start mb-2">
                    <h4 class="text-sm font-black uppercase italic">${m.nome}</h4>
                    <span class="text-purple-400 font-black text-xs">${perc.toFixed(0)}%</span>
                </div>
                <div class="hp-bar mb-4"><div class="hp-fill bg-purple-600" style="width: ${perc}%"></div></div>
                <div class="space-y-2 mb-4">
                    ${checklist.map((c, idx) => `
                        <div onclick="toggleSubmeta('${m.id}', ${idx}, ${c.done})" class="submeta-item p-3 rounded-xl flex justify-between items-center text-[10px] ${c.done ? 'done' : ''}">
                            <span>${c.item}</span>
                            <span>${c.done ? '✅' : '⭕'}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="flex gap-2">
                    <button onclick="addSubmeta('${m.id}')" class="flex-1 bg-white/5 py-3 rounded-xl text-[9px] font-black">+ Item</button>
                    <button onclick="excluirMeta('${m.id}')" class="p-3 bg-white/5 rounded-xl">🗑️</button>
                </div>
            </div>`;
        });
    });
}

// --- LÓGICA DE METAS DENTRO DE METAS ---
window.modalNovaMeta = async () => {
    const { value: nome } = await Swal.fire({ title: 'Meta Principal', input: 'text', placeholder: 'Ex: Comprar Moto', background: '#0a0c14', color: '#fff' });
    if(nome) await addDoc(collection(db, "metas"), { nome, status: 'ativa', checklist: [], userId: userUID });
};

window.addSubmeta = async (metaId) => {
    const { value: item } = await Swal.fire({ title: 'Novo Requisito', input: 'text', placeholder: 'Ex: Tirar Habilitação', background: '#0a0c14', color: '#fff' });
    if(item) {
        const mRef = doc(db, "metas", metaId);
        await updateDoc(mRef, { checklist: arrayUnion({ item, done: false }) });
    }
};

window.toggleSubmeta = async (metaId, index, atualStatus) => {
    const m = metas.find(x => x.id === metaId);
    let novaLista = [...m.checklist];
    novaLista[index].done = !atualStatus;
    
    await updateDoc(doc(db, "metas", metaId), { checklist: novaLista });
    
    // Verificar Conclusão Total
    if (novaLista.every(c => c.done)) {
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        await updateDoc(doc(db, "metas", metaId), { status: 'concluida' });
    }
};

// --- CHAT IA MELHORADO ---
window.aiMenu = (op) => {
    const c = document.getElementById('chatContent');
    let r = "";
    if(op === 'status') {
        const metaAtiva = metas[0];
        if(!metaAtiva) r = "Você não tem metas ativas. Que tal planejar seu próximo sonho?";
        else {
            const faltam = metaAtiva.checklist.filter(x => !x.done).length;
            r = `Para concluir <b>${metaAtiva.nome}</b>, ainda faltam ${faltam} passos. Foco no próximo item!`;
        }
    }
    if(op === 'previsao') {
        const quinto = getQuintoDiaUtil().toLocaleDateString();
        r = `O 5º dia útil deste mês cai em <b>${quinto}</b>. Seu salário previsto de ${BRL(fin.previsto)} entrará no saldo real nesta data.`;
    }
    if(op === 'conversao') {
        r = "Dólar: R$ 5.12 | Euro: R$ 5.54. Mantenha reserva em moedas fortes se a meta for viagem!";
    }
    if(op === 'dicas') r = "Dica: Tente pagar as dívidas menores primeiro (Método Bola de Neve) para liberar fluxo para suas metas.";
    
    c.innerHTML += `<p class="bg-purple-600/30 p-3 rounded-2xl rounded-tl-none ml-4 self-end text-white">${r}</p>`;
    c.scrollTop = c.scrollHeight;
};

// --- HOME E GESTÃO ---
window.salvarLancamento = async () => {
    const n = document.getElementById('fNome').value, v = Number(document.getElementById('fValor').value), d = document.getElementById('fData').value, s = document.getElementById('f5Dia').checked;
    if (n && v && d) {
        await addDoc(collection(db, "fluxo"), { nome: n, valor: v, data: d, tipo: tipoAtual, isSalario: s, status: 'pendente', userId: userUID });
        document.getElementById('fNome').value = ""; document.getElementById('fValor').value = "";
    }
};

function atualizarUI() {
    document.getElementById('receitaTotal').innerText = BRL(fin.previsto);
    document.getElementById('saldoReal').innerText = BRL(fin.saldoReal);
    document.getElementById('despesaTotal').innerText = BRL(fin.dividas);
    const perc = Math.max(0, 100 - (fin.dividas / (fin.previsto || 1) * 100));
    document.getElementById('hpFill').style.width = perc + "%";
    
    const t = document.getElementById('listaTimeline'); t.innerHTML = "";
    fin.lista.sort((a,b) => new Date(a.data) - new Date(b.data)).forEach(i => {
        t.innerHTML += `<div class="glass-card p-4 flex justify-between border-l-4 ${i.tipo === 'ganho' ? 'border-emerald-500' : 'border-rose-500'}">
            <div><h4 class="text-[10px] font-black uppercase">${i.nome}</h4><p class="text-[8px] opacity-40">${i.data}</p></div>
            <b class="text-xs ${i.tipo === 'ganho' ? 'text-emerald-400' : 'text-rose-500'}">${BRL(i.valor)}</b>
        </div>`;
    });
}

window.navegar = (id, btn) => {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-btn-m').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if(id === 'secGestao') renderGestao();
};

window.toggleChat = () => {
    const w = document.getElementById('chatWindow');
    w.style.display = w.style.display === 'flex' ? 'none' : 'flex';
};

window.setTipo = (t) => {
    tipoAtual = t;
    document.getElementById('tabGanho').className = t === 'ganho' ? "text-[10px] font-black text-purple-400 border-b-2 border-purple-500 pb-1" : "text-[10px] opacity-40 pb-1";
    document.getElementById('tabDivida').className = t === 'divida' ? "text-[10px] font-black text-purple-400 border-b-2 border-purple-500 pb-1" : "text-[10px] opacity-40 pb-1";
};

window.excluirMeta = async (id) => { await deleteDoc(doc(db, "metas", id)); };
window.verMetasConcluidas = () => { /* Abre modal similar ao historico filtrando por status concluida */ };
