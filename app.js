import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
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

let userUID = null, tipoAtual = 'ganho', chart = null;
let fin = { ganhos: 0, dividas: 0, lista: [] };
let metas = [];

const BRL = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// --- AUTH ---
window.executarAuth = () => {
    const e = document.getElementById('email').value, s = document.getElementById('senha').value;
    signInWithEmailAndPassword(auth, e, s).catch(() => {
        createUserWithEmailAndPassword(auth, e, s).catch(err => alert(err.message));
    });
};
window.sairDoSistema = () => signOut(auth).then(() => location.reload());

onAuthStateChanged(auth, user => {
    if (user) { userUID = user.uid; document.getElementById('loginTela').classList.add('hidden'); document.getElementById('dashboard').classList.remove('hidden'); iniciarRealtime(); }
    else { document.getElementById('loginTela').classList.remove('hidden'); }
});

function iniciarRealtime() {
    onSnapshot(query(collection(db, "fluxo"), where("userId", "==", userUID)), snap => {
        let g = 0, d = 0; fin.lista = [];
        snap.forEach(ds => {
            const item = { ...ds.data(), id: ds.id };
            if (item.status !== 'paga') {
                if (item.tipo === 'ganho') g += item.valor; else d += item.valor;
            }
            fin.lista.push(item);
        });
        fin.ganhos = g; fin.dividas = d;
        atualizarUI();
    });

    onSnapshot(query(collection(db, "metas"), where("userId", "==", userUID)), snap => {
        metas = [];
        const grid = document.getElementById('rankingGrid'); grid.innerHTML = "";
        snap.forEach(ds => {
            const m = { ...ds.data(), id: ds.id };
            if (m.status !== 'concluida') {
                metas.push(m);
                const perc = Math.min(100, (m.atual / m.alvo) * 100);
                grid.innerHTML += `
                <div class="glass-card p-6 border-l-4 border-purple-500">
                    <div class="flex justify-between items-start mb-2"><h4 class="text-xs font-black uppercase">${m.nome}</h4><b>${perc.toFixed(0)}%</b></div>
                    <div class="hp-bar mb-4"><div class="hp-fill bg-purple-600" style="width: ${perc}%"></div></div>
                    <div class="flex gap-2">
                        <button onclick="aportarMeta('${m.id}', ${m.atual}, ${m.alvo})" class="flex-1 bg-white/5 py-3 rounded-xl text-[9px] font-black">APORTAR</button>
                        <button onclick="excluirMeta('${m.id}')" class="p-3 bg-white/5 rounded-xl">🗑️</button>
                    </div>
                </div>`;
            }
        });
    });
}

// --- HISTÓRICO E GESTÃO ---
window.abrirHistorico = () => {
    let html = `<div class="space-y-2 max-h-60 overflow-y-auto no-scrollbar">`;
    fin.lista.forEach(item => {
        html += `<div class="flex justify-between p-3 bg-white/5 rounded-xl text-[10px] items-center">
            <span>${item.nome} (${BRL(item.valor)})</span>
            <div class="flex gap-2">
                <button onclick="excluirRegistro('${item.id}')" class="text-rose-500">Apagar</button>
            </div>
        </div>`;
    });
    Swal.fire({ title: 'HISTÓRICO', html: html + '</div>', background: '#0a0c14', color: '#fff' });
};

window.excluirRegistro = async (id) => {
    await deleteDoc(doc(db, "fluxo", id));
    Swal.fire({ title: 'Excluído!', icon: 'success', toast: true, position: 'top', showConfirmButton: false, timer: 1000 });
};

// --- METAS CONCLUÍDAS E ANIMAÇÃO ---
window.aportarMeta = async (id, atual, alvo) => {
    const { value: v } = await Swal.fire({ title: 'Quanto aportar?', input: 'number', background: '#0a0c14', color: '#fff' });
    if(v) {
        const novoValor = atual + Number(v);
        await updateDoc(doc(db, "metas", id), { atual: novoValor });
        if(novoValor >= alvo) {
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#a855f7', '#ffffff'] });
            await updateDoc(doc(db, "metas", id), { status: 'concluida' });
            Swal.fire({ title: 'META BATIDA! 🏆', text: 'Objetivo movido para a galeria de conquistas.', icon: 'success', background: '#0a0c14', color: '#fff' });
        }
    }
};

window.verMetasConcluidas = () => {
    onSnapshot(query(collection(db, "metas"), where("userId", "==", userUID), where("status", "==", "concluida")), snap => {
        let html = `<div class="space-y-2">`;
        snap.forEach(d => { html += `<div class="p-4 glass-card text-emerald-400 text-xs font-black uppercase">🏆 ${d.data().nome} - ${BRL(d.data().alvo)}</div>`; });
        Swal.fire({ title: 'CONQUISTAS', html: html || 'Nenhuma meta concluída ainda.', background: '#0a0c14', color: '#fff' });
    });
};

// --- CHAT IA MENU ---
window.toggleChat = () => {
    const win = document.getElementById('chatWindow');
    win.style.display = win.style.display === 'flex' ? 'none' : 'flex';
};

window.aiMenu = (opcao) => {
    const cont = document.getElementById('chatContent');
    let resposta = "";
    if(opcao === 'tutorial') resposta = "Para começar, cadastre seu salário na Home. Depois, agende suas dívidas. O site vai te avisar se o dinheiro sobra para as Metas!";
    if(opcao === 'conversao') {
        const val = prompt("Valor em R$:");
        resposta = `O valor de R$ ${val} equivale a aproximadamente $ ${(val/5.10).toFixed(2)} USD ou € ${(val/5.50).toFixed(2)} EUR.`;
    }
    if(opcao === 'dicas') resposta = "Siga a regra 50/30/20: 50% para necessidades, 30% para desejos e 20% para suas METAS.";
    if(opcao === 'analise') {
        const meses = Math.ceil(fin.dividas / (fin.ganhos || 1));
        resposta = `Você tem ${BRL(fin.dividas)} em dívidas. Com seu salário de ${BRL(fin.ganhos)}, você levaria cerca de ${meses} mês(es) para quitar tudo se usasse 100% da renda.`;
    }
    cont.innerHTML += `<p class="bg-purple-600/40 p-3 rounded-2xl rounded-tr-none ml-4 self-end text-white opacity-100">${resposta}</p>`;
    cont.scrollTop = cont.scrollHeight;
};

// (Auxiliares de Navegação e Salvar mantidos da versão anterior para garantir o fluxo)
window.setTipo = (t) => {
    tipoAtual = t;
    document.getElementById('tabGanho').className = t === 'ganho' ? "text-[10px] font-black text-purple-400 border-b-2 border-purple-500 pb-1" : "text-[10px] opacity-40 pb-1";
    document.getElementById('tabDivida').className = t === 'divida' ? "text-[10px] font-black text-purple-400 border-b-2 border-purple-500 pb-1" : "text-[10px] opacity-40 pb-1";
};

window.salvarLancamento = async () => {
    const n = document.getElementById('fNome').value, v = Number(document.getElementById('fValor').value), d = document.getElementById('fData').value;
    if (n && v && d) {
        await addDoc(collection(db, "fluxo"), { nome: n, valor: v, data: d, tipo: tipoAtual, status: 'pendente', userId: userUID });
        document.getElementById('fNome').value = ""; document.getElementById('fValor').value = "";
    }
};

window.navegar = (id, btn) => {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-btn-m').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if(id === 'secGestao') renderGestao();
};

function atualizarUI() {
    document.getElementById('receitaTotal').innerText = BRL(fin.ganhos);
    document.getElementById('despesaTotal').innerText = BRL(fin.dividas);
    document.getElementById('saldoTotal').innerText = BRL(fin.ganhos - fin.dividas);
    document.getElementById('hpFill').style.width = Math.max(0, 100 - (fin.dividas / (fin.ganhos || 1) * 100)) + "%";
}

window.modalNovaMeta = async () => {
    const { value: f } = await Swal.fire({
        title: 'Nova Meta',
        html: '<input id="mn" placeholder="Nome" class="swal2-input"><input id="ma" type="number" placeholder="Alvo R$" class="swal2-input">',
        background: '#0a0c14', color: '#fff',
        preConfirm: () => [document.getElementById('mn').value, document.getElementById('ma').value]
    });
    if(f && f[0]) await addDoc(collection(db, "metas"), { nome: f[0], alvo: Number(f[1]), atual: 0, status: 'ativa', userId: userUID });
};

window.excluirMeta = async (id) => { await deleteDoc(doc(db, "metas", id)); };

function renderGestao() {
    const ctx = document.getElementById('chartGestao');
    if(chart) chart.destroy();
    const divs = fin.lista.filter(f => f.tipo === 'divida');
    document.getElementById('totalGestao').innerText = BRL(fin.dividas);
    chart = new Chart(ctx, { type: 'doughnut', data: { datasets: [{ data: divs.map(d => d.valor), backgroundColor: ['#a855f7','#7c3aed','#ef4444'], borderWidth: 0 }] }, options: { cutout: '80%' } });
    const list = document.getElementById('listaDetalhada'); list.innerHTML = "";
    divs.forEach(d => { list.innerHTML += `<div class="p-4 glass-card flex justify-between text-[10px] uppercase font-bold"><span>${d.nome}</span><button onclick="excluirRegistro('${d.id}')" class="text-rose-500">Apagar</button></div>`; });
}
