import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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

let userUID = null, tipoAtual = 'ganho', chartInst = null;
let fin = { previsto: 0, saldoReal: 0, dividas: 0, lista: [] };
let metasAtivas = [];

const BRL = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// --- AUX: 5º DIA ÚTIL ---
function getQuintoDiaUtil() {
    let d = new Date(); d.setDate(1); let c = 0;
    while (c < 5) {
        let day = d.getDay();
        if (day !== 0 && day !== 6) c++;
        if (c < 5) d.setDate(d.getDate() + 1);
    }
    return d;
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
    // Escuta Fluxo Financeiro
    onSnapshot(query(collection(db, "fluxo"), where("userId", "==", userUID)), snap => {
        let prev = 0, real = 0, div = 0; fin.lista = [];
        const hoje = new Date();
        const quinto = getQuintoDiaUtil();

        snap.forEach(ds => {
            const i = { ...ds.data(), id: ds.id };
            if (i.status !== 'paga') {
                if (i.tipo === 'ganho') {
                    prev += i.valor;
                    if (i.isSalario) { if (hoje >= quinto) real += i.valor; }
                    else { if (hoje >= new Date(i.data)) real += i.valor; }
                } else { div += i.valor; }
            }
            fin.lista.push(i);
        });
        fin.previsto = prev; fin.saldoReal = real; fin.dividas = div;
        atualizarUI();
    });

    // Escuta Metas Ativas
    onSnapshot(query(collection(db, "metas"), where("userId", "==", userUID), where("status", "==", "ativa")), snap => {
        metasAtivas = [];
        const grid = document.getElementById('rankingGrid'); grid.innerHTML = "";
        snap.forEach(ds => {
            const m = { ...ds.data(), id: ds.id }; metasAtivas.push(m);
            const check = m.checklist || [];
            const doneCount = check.filter(c => c.done).length;
            const perc = check.length > 0 ? (doneCount / check.length) * 100 : 0;

            grid.innerHTML += `
            <div class="glass-card p-6 border-l-4 border-purple-500">
                <div class="flex justify-between items-start mb-2">
                    <h4 class="text-sm font-black uppercase italic">${m.nome}</h4>
                    <span class="text-purple-400 font-black text-xs">${perc.toFixed(0)}%</span>
                </div>
                <div class="hp-bar mb-4"><div class="hp-fill bg-purple-600" style="width: ${perc}%"></div></div>
                <div class="space-y-2 mb-4">
                    ${check.map((c, idx) => `
                        <div onclick="toggleSubmeta('${m.id}', ${idx}, ${c.done})" class="submeta-item p-3 rounded-xl flex justify-between items-center text-[10px] ${c.done ? 'done' : ''}">
                            <span>${c.item}</span>
                            <span>${c.done ? '✅' : '⭕'}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="flex gap-2">
                    <button onclick="addSubmeta('${m.id}')" class="flex-1 bg-white/5 py-3 rounded-xl text-[9px] font-black uppercase">+ Requisito</button>
                    <button onclick="excluirMeta('${m.id}')" class="p-3 bg-white/5 rounded-xl">🗑️</button>
                </div>
            </div>`;
        });
    });
}

// --- HISTÓRICO FUNCIONAL ---
window.abrirHistorico = () => {
    let html = `
    <div class="text-left space-y-4">
        <div class="flex justify-between border-b border-white/10 pb-2">
            <button onclick="apagarSelecionados()" class="text-[9px] font-black text-rose-500 uppercase">Apagar Selecionados</button>
            <button onclick="Swal.close()" class="text-[9px] font-black opacity-40 uppercase">Fechar</button>
        </div>
        <div class="max-h-72 overflow-y-auto no-scrollbar space-y-2">
            ${fin.lista.map(i => `
                <label class="flex items-center gap-3 p-4 bg-white/5 rounded-2xl cursor-pointer">
                    <input type="checkbox" value="${i.id}" class="hist-check w-4 h-4 accent-purple-500">
                    <div class="flex-1 text-[10px] uppercase font-black">
                        ${i.nome} <span class="block text-[8px] opacity-40 font-normal">${i.data} • ${BRL(i.valor)}</span>
                    </div>
                </label>
            `).join('')}
        </div>
        <button onclick="apagarTudo()" class="w-full p-4 bg-rose-500/20 text-rose-500 rounded-2xl text-[9px] font-black uppercase">Limpar Todo o Histórico</button>
    </div>`;

    Swal.fire({ title: 'HISTÓRICO', html, showConfirmButton: false });
};

window.apagarSelecionados = async () => {
    const ids = Array.from(document.querySelectorAll('.hist-check:checked')).map(c => c.value);
    for(const id of ids) await deleteDoc(doc(db, "fluxo", id));
    Swal.fire({ icon: 'success', title: 'Removido!', toast: true, position: 'top', showConfirmButton: false, timer: 1000 });
};

window.apagarTudo = async () => {
    if(confirm("Apagar TUDO definitivamente?")) {
        for(const i of fin.lista) await deleteDoc(doc(db, "fluxo", i.id));
        Swal.close();
    }
};

// --- METAS E SUBMETAS ---
window.toggleSubmeta = async (mId, idx, status) => {
    const m = metasAtivas.find(x => x.id === mId);
    let nova = [...m.checklist];
    nova[idx].done = !status;
    await updateDoc(doc(db, "metas", mId), { checklist: nova });

    if(nova.every(c => c.done)) {
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        await updateDoc(doc(db, "metas", mId), { status: 'concluida' });
        Swal.fire({ title: '🏆 META CONCLUÍDA!', text: 'Seu objetivo foi movido para o arquivo de vitórias.', icon: 'success' });
    }
};

window.verMetasConcluidas = () => {
    onSnapshot(query(collection(db, "metas"), where("userId", "==", userUID), where("status", "==", "concluida")), snap => {
        let h = `<div class="space-y-2">`;
        snap.forEach(d => h += `<div class="p-4 glass-card text-emerald-400 text-[10px] font-black uppercase italic">🏆 ${d.data().nome}</div>`);
        Swal.fire({ title: 'VITÓRIAS', html: h || 'Nenhuma meta concluída ainda.' });
    });
};

// --- GESTÃO E GRÁFICO ---
function renderGestao() {
    const ctx = document.getElementById('chartGestao');
    if(chartInst) chartInst.destroy();
    
    const divs = fin.lista.filter(f => f.tipo === 'divida');
    document.getElementById('totalGestao').innerText = BRL(fin.dividas);
    
    chartInst = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: divs.map(d => d.nome),
            datasets: [{
                data: divs.map(d => d.valor),
                backgroundColor: ['#a855f7', '#7c3aed', '#6366f1', '#ef4444'],
                borderWidth: 0,
                borderRadius: 5
            }]
        },
        options: { cutout: '85%', plugins: { legend: { display: false } } }
    });

    const list = document.getElementById('listaDetalhada'); list.innerHTML = "";
    divs.forEach(d => {
        list.innerHTML += `<div class="flex justify-between p-4 bg-white/[0.02] border-b border-white/5 text-[10px] font-black uppercase">
            <span class="opacity-70">${d.nome}</span><span class="text-rose-500">${BRL(d.valor)}</span></div>`;
    });
}

// --- ENGINE ---
window.salvarLancamento = async () => {
    const n = document.getElementById('fNome').value, v = Number(document.getElementById('fValor').value), d = document.getElementById('fData').value, s = document.getElementById('f5Dia').checked;
    if(n && v && d) {
        await addDoc(collection(db, "fluxo"), { nome: n, valor: v, data: d, tipo: tipoAtual, isSalario: s, status: 'pendente', userId: userUID });
        document.getElementById('fNome').value = ""; document.getElementById('fValor').value = "";
    }
};

function atualizarUI() {
    document.getElementById('receitaTotal').innerText = BRL(fin.previsto);
    document.getElementById('saldoReal').innerText = BRL(fin.saldoReal);
    document.getElementById('despesaTotal').innerText = BRL(fin.dividas);
    document.getElementById('hpFill').style.width = Math.max(0, 100 - (fin.dividas / (fin.previsto || 1) * 100)) + "%";
}

window.navegar = (id, btn) => {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-btn-m').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if(id === 'secGestao') renderGestao();
};

window.modalNovaMeta = async () => {
    const { value: n } = await Swal.fire({ title: 'Nova Meta Principal', input: 'text', placeholder: 'Ex: Trocar de Carro' });
    if(n) await addDoc(collection(db, "metas"), { nome: n, status: 'ativa', checklist: [], userId: userUID });
};

window.addSubmeta = async (id) => {
    const { value: i } = await Swal.fire({ title: 'Requisito', input: 'text', placeholder: 'Ex: Guardar R$ 500' });
    if(i) await updateDoc(doc(db, "metas", id), { checklist: arrayUnion({ item: i, done: false }) });
};

window.excluirMeta = async (id) => { await deleteDoc(doc(db, "metas", id)); };
window.toggleChat = () => { const w = document.getElementById('chatWindow'); w.style.display = w.style.display === 'flex' ? 'none' : 'flex'; };
window.setTipo = (t) => {
    tipoAtual = t;
    document.getElementById('tabGanho').className = t === 'ganho' ? "text-[10px] font-black text-purple-400 border-b-2 border-purple-500 pb-1" : "text-[10px] opacity-40 pb-1";
    document.getElementById('tabDivida').className = t === 'divida' ? "text-[10px] font-black text-purple-400 border-b-2 border-purple-500 pb-1" : "text-[10px] opacity-40 pb-1";
};

window.aiMenu = (op) => {
    const c = document.getElementById('chatContent'); let r = "";
    if(op === 'status') r = metasAtivas.length > 0 ? `Você tem ${metasAtivas.length} meta(s) em andamento. Foco nos requisitos!` : "Sem metas ativas.";
    if(op === 'previsao') r = `Seu salário cairá no 5º dia útil (${getQuintoDiaUtil().toLocaleDateString()}).`;
    c.innerHTML += `<p class="bg-purple-600/30 p-3 rounded-2xl rounded-tl-none ml-4 self-end">${r}</p>`;
    c.scrollTop = c.scrollHeight;
};
