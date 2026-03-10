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

let userUID = null, modoRegistro = false, tipoAtual = 'ganho', chart = null;
let fin = { ganhos: 0, dividas: 0, lista: [] };
let metas = [];

const BRL = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// --- AUTH ---
window.alternarModoAuth = () => {
    modoRegistro = !modoRegistro;
    document.getElementById('btnAuth').innerText = modoRegistro ? 'Criar Conta' : 'Acessar';
    document.getElementById('containerConfirmar').classList.toggle('hidden', !modoRegistro);
    document.getElementById('btnTrocar').innerText = modoRegistro ? 'Já tenho conta' : 'Criar Nova Conta';
};

window.executarAuth = () => {
    const e = document.getElementById('email').value, s = document.getElementById('senha').value;
    if (modoRegistro) {
        if(s !== document.getElementById('senhaConfirm').value) return alert('Senhas não batem');
        createUserWithEmailAndPassword(auth, e, s).catch(err => alert(err.message));
    } else {
        signInWithEmailAndPassword(auth, e, s).catch(() => alert('Erro no acesso'));
    }
};

window.sairDoSistema = () => signOut(auth).then(() => location.reload());

onAuthStateChanged(auth, user => {
    if (user) { 
        userUID = user.uid; 
        document.getElementById('loginTela').classList.add('hidden'); 
        document.getElementById('dashboard').classList.remove('hidden'); 
        iniciarRealtime(); 
    } else { 
        document.getElementById('loginTela').classList.remove('hidden'); 
    }
});

// --- REALTIME ENGINE ---
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
                    <div class="flex justify-between items-start mb-2"><h4 class="text-xs font-black uppercase italic">${m.nome}</h4><b>${perc.toFixed(0)}%</b></div>
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

// --- HISTÓRICO AVANÇADO ---
window.abrirHistorico = () => {
    let html = `
    <div class="text-left">
        <div class="flex justify-between mb-4 border-b border-white/10 pb-2">
            <button onclick="marcarTodosHistorico()" class="text-[9px] font-black text-purple-400 uppercase">Marcar Todos</button>
            <button onclick="apagarSelecionados()" class="text-[9px] font-black text-rose-500 uppercase">Apagar Marcados</button>
        </div>
        <div id="listaCheck" class="space-y-2 max-h-72 overflow-y-auto no-scrollbar">`;
    
    fin.lista.sort((a,b) => new Date(b.data) - new Date(a.data)).forEach(item => {
        html += `
        <label class="flex items-center gap-3 p-4 bg-white/5 rounded-2xl cursor-pointer hover:bg-white/10 transition-all">
            <input type="checkbox" value="${item.id}" class="historico-check w-4 h-4">
            <div class="flex-1">
                <p class="text-[10px] font-black uppercase text-white/90">${item.nome}</p>
                <p class="text-[8px] opacity-40">${item.data} • ${BRL(item.valor)}</p>
            </div>
        </label>`;
    });

    html += `</div>
        <button onclick="apagarTudoConfirmar()" class="w-full mt-4 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-[10px] font-black text-rose-500 uppercase">⚠️ Limpar Tudo</button>
    </div>`;

    Swal.fire({ title: 'HISTÓRICO', html: html, showConfirmButton: false, background: '#0a0c14', color: '#fff' });
};

window.marcarTodosHistorico = () => {
    const checks = document.querySelectorAll('.historico-check');
    const todos = Array.from(checks).every(c => c.checked);
    checks.forEach(c => c.checked = !todos);
};

window.apagarSelecionados = async () => {
    const ids = Array.from(document.querySelectorAll('.historico-check:checked')).map(c => c.value);
    if(ids.length === 0) return;
    if(confirm(`Apagar ${ids.length} itens?`)) {
        for(const id of ids) await deleteDoc(doc(db, "fluxo", id));
        Swal.close();
    }
};

window.apagarTudoConfirmar = async () => {
    if(confirm("Deseja apagar TODOS os registros?")) {
        for(const item of fin.lista) await deleteDoc(doc(db, "fluxo", item.id));
        Swal.close();
    }
};

// --- GESTÃO MINIMALISTA ---
function renderGestao() {
    const ctx = document.getElementById('chartGestao');
    if(chart) chart.destroy();
    const divs = fin.lista.filter(f => f.tipo === 'divida');
    document.getElementById('totalGestao').innerText = BRL(fin.dividas);
    chart = new Chart(ctx, { 
        type: 'doughnut', 
        data: { datasets: [{ data: divs.map(d => d.valor), backgroundColor: ['#a855f7','#7c3aed','#6366f1','#ef4444'], borderWidth: 0 }] }, 
        options: { cutout: '85%', plugins: { legend: { display: false } } } 
    });
    const list = document.getElementById('listaDetalhada'); list.innerHTML = "";
    divs.forEach(d => {
        list.innerHTML += `<div class="flex justify-between p-4 bg-white/[0.02] border-b border-white/5 last:border-0"><span class="text-[10px] font-black uppercase opacity-70">${d.nome}</span><span class="text-[10px] font-black text-rose-500">${BRL(d.valor)}</span></div>`;
    });
}

// --- METAS E ANIMAÇÃO ---
window.aportarMeta = async (id, atual, alvo) => {
    const { value: v } = await Swal.fire({ title: 'Quanto aportar?', input: 'number', background: '#0a0c14', color: '#fff' });
    if(v) {
        const novo = atual + Number(v);
        await updateDoc(doc(db, "metas", id), { atual: novo });
        if(novo >= alvo) {
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#a855f7','#ffffff'] });
            await updateDoc(doc(db, "metas", id), { status: 'concluida' });
            Swal.fire({ title: 'META BATIDA! 🏆', background: '#0a0c14', color: '#fff' });
        }
    }
};

window.verMetasConcluidas = () => {
    onSnapshot(query(collection(db, "metas"), where("userId", "==", userUID), where("status", "==", "concluida")), snap => {
        let h = `<div class="space-y-2">`;
        snap.forEach(d => { h += `<div class="p-4 glass-card text-emerald-400 text-xs font-black uppercase">🏆 ${d.data().nome}</div>`; });
        Swal.fire({ title: 'BATIDAS', html: h || 'Nenhuma meta concluída.', background: '#0a0c14', color: '#fff' });
    });
};

// --- CHAT IA ---
window.toggleChat = () => {
    const w = document.getElementById('chatWindow');
    w.style.display = w.style.display === 'flex' ? 'none' : 'flex';
};

window.aiMenu = (op) => {
    const c = document.getElementById('chatContent');
    let r = "";
    if(op === 'tutorial') r = "Cadastre seu salário na Home. Agende dívidas. O sistema dirá se sobra dinheiro para as Metas.";
    if(op === 'conversao') {
        const v = prompt("R$:");
        r = `R$ ${v} = $ ${(v/5.10).toFixed(2)} USD ou € ${(v/5.50).toFixed(2)} EUR.`;
    }
    if(op === 'dicas') r = "Use a regra 50/30/20 para equilibrar sua vida financeira.";
    if(op === 'analise') r = `Dívidas totais: ${BRL(fin.dividas)}. Salário: ${BRL(fin.ganhos)}.`;
    c.innerHTML += `<p class="bg-purple-600/40 p-3 rounded-2xl rounded-tr-none ml-4 self-end">${r}</p>`;
    c.scrollTop = c.scrollHeight;
};

// --- FUNÇÕES HOME ---
window.setTipo = (t) => {
    tipoAtual = t;
    document.getElementById('tabGanho').className = t === 'ganho' ? "text-[10px] font-black uppercase text-purple-400 border-b-2 border-purple-500 pb-1" : "text-[10px] font-black uppercase opacity-40 pb-1";
    document.getElementById('tabDivida').className = t === 'divida' ? "text-[10px] font-black uppercase text-purple-400 border-b-2 border-purple-500 pb-1" : "text-[10px] font-black uppercase opacity-40 pb-1";
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

    const t = document.getElementById('listaTimeline'); t.innerHTML = "";
    fin.lista.sort((a,b) => new Date(a.data) - new Date(b.data)).forEach(i => {
        t.innerHTML += `
        <div onclick="abrirAcao('${i.id}', '${i.nome}', ${i.valor})" class="glass-card p-5 flex justify-between border-l-4 ${i.tipo === 'ganho' ? 'border-emerald-500' : 'border-rose-500'}">
            <div><h4 class="text-xs font-black uppercase">${i.nome}</h4><p class="text-[9px] opacity-40">${i.data}</p></div>
            <b class="text-xs ${i.tipo === 'ganho' ? 'text-emerald-400' : 'text-rose-500'}">${BRL(i.valor)}</b>
        </div>`;
    });
}

window.abrirAcao = async (id, nome) => {
    const { value: a } = await Swal.fire({ title: nome, input: 'select', inputOptions: { paga: '✅ Pago', del: '🗑️ Deletar' }, background: '#0a0c14', color: '#fff' });
    if(a === 'paga') await updateDoc(doc(db, "fluxo", id), { status: 'paga' });
    else if(a === 'del') await deleteDoc(doc(db, "fluxo", id));
};

window.modalNovaMeta = async () => {
    const { value: f } = await Swal.fire({
        title: 'Novo Alvo',
        html: '<input id="mn" placeholder="Nome" class="swal2-input"><input id="ma" type="number" placeholder="Alvo R$" class="swal2-input">',
        background: '#0a0c14', color: '#fff',
        preConfirm: () => [document.getElementById('mn').value, document.getElementById('ma').value]
    });
    if(f && f[0]) await addDoc(collection(db, "metas"), { nome: f[0], alvo: Number(f[1]), atual: 0, status: 'ativa', userId: userUID });
};

window.excluirMeta = async (id) => { await deleteDoc(doc(db, "metas", id)); };
