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

// --- SISTEMA DE AUTENTICAÇÃO ---
window.alternarModoAuth = () => {
    modoRegistro = !modoRegistro;
    document.getElementById('btnAuth').innerText = modoRegistro ? 'Criar Conta' : 'Acessar';
    document.getElementById('containerConfirmar').classList.toggle('hidden', !modoRegistro);
    document.getElementById('btnTrocar').innerText = modoRegistro ? 'Já tenho conta' : 'Criar Nova Conta';
};

window.executarAuth = () => {
    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;
    if (modoRegistro) {
        if(senha !== document.getElementById('senhaConfirm').value) return alert('Senhas não batem');
        createUserWithEmailAndPassword(auth, email, senha).catch(e => alert(e.message));
    } else {
        signInWithEmailAndPassword(auth, email, senha).catch(e => alert('Erro de login'));
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
        document.getElementById('dashboard').classList.add('hidden');
    }
});

// --- LÓGICA DE DADOS REAIS ---
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
            const m = { ...ds.data(), id: ds.id }; metas.push(m);
            const perc = Math.min(100, (m.atual / m.alvo) * 100).toFixed(0);
            grid.innerHTML += `
            <div class="glass-card p-6 border-l-4 border-purple-500">
                <div class="flex justify-between items-start mb-3">
                    <h4 class="text-xs font-black uppercase italic">${m.nome}</h4>
                    <span class="text-purple-400 text-xs font-black">${perc}%</span>
                </div>
                <div class="hp-bar"><div class="hp-fill bg-purple-600" style="width: ${perc}%"></div></div>
                <div class="flex justify-between mt-3 text-[9px] font-bold opacity-50 uppercase">
                    <span>${BRL(m.atual)}</span><span>${BRL(m.alvo)}</span>
                </div>
                <div class="flex gap-2 mt-4">
                    <button onclick="aportarMeta('${m.id}', ${m.atual})" class="flex-1 bg-white/5 py-3 rounded-xl text-[9px] font-black uppercase">Aportar</button>
                    <button onclick="removerMeta('${m.id}')" class="p-3 bg-white/5 rounded-xl">🗑️</button>
                </div>
            </div>`;
        });
    });
}

// --- FUNÇÕES DA HOME ---
window.setTipo = (t) => {
    tipoAtual = t;
    document.getElementById('tabGanho').className = t === 'ganho' ? "text-[10px] font-black uppercase text-purple-400 border-b-2 border-purple-500 pb-1" : "text-[10px] font-black uppercase opacity-40 pb-1";
    document.getElementById('tabDivida').className = t === 'divida' ? "text-[10px] font-black uppercase text-purple-400 border-b-2 border-purple-500 pb-1" : "text-[10px] font-black uppercase opacity-40 pb-1";
};

window.salvarLancamento = async () => {
    const n = document.getElementById('fNome').value, v = Number(document.getElementById('fValor').value), d = document.getElementById('fData').value, m = document.getElementById('fMensal').checked;
    if (n && v && d) {
        await addDoc(collection(db, "fluxo"), { nome: n, valor: v, data: d, tipo: tipoAtual, recorrente: m, status: 'pendente', userId: userUID });
        document.getElementById('fNome').value = ""; document.getElementById('fValor').value = "";
        Swal.fire({ icon: 'success', title: 'Agendado!', toast: true, position: 'top-end', showConfirmButton: false, timer: 1500, background: '#0a0c14', color: '#fff' });
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
    const saldo = fin.ganhos - fin.dividas;
    document.getElementById('saldoTotal').innerText = BRL(saldo);

    const perc = Math.max(0, 100 - (fin.dividas / (fin.ganhos || 1) * 100));
    document.getElementById('hpFill').style.width = perc + "%";

    const ia = document.getElementById('iaTexto');
    if (saldo > 0 && metas.length > 0) {
        ia.innerHTML = `Dívidas do mês cobertas. Sobrou <b>${BRL(saldo)}</b>. Sugiro investir 20% disso na sua meta mais próxima!`;
    } else if (saldo < 0) {
        ia.innerHTML = `<span class="text-rose-500 font-black">ALERTA:</span> Suas dívidas superam seu salário em <b>${BRL(Math.abs(saldo))}</b>.`;
    }

    const timeline = document.getElementById('listaTimeline'); timeline.innerHTML = "";
    fin.lista.sort((a,b) => new Date(a.data) - new Date(b.data)).forEach(item => {
        timeline.innerHTML += `
        <div onclick="abrirAcao('${item.id}', '${item.nome}', ${item.valor})" class="glass-card p-5 flex justify-between items-center border-l-4 ${item.tipo === 'ganho' ? 'border-emerald-500' : 'border-rose-500'}">
            <div><h4 class="text-xs font-black uppercase">${item.nome}</h4><p class="text-[9px] opacity-40">${item.data} ${item.recorrente ? '🔄' : ''}</p></div>
            <b class="text-xs ${item.tipo === 'ganho' ? 'text-emerald-400' : 'text-rose-500'}">${BRL(item.valor)}</b>
        </div>`;
    });
}

// --- PRIVACIDADE (OLHO MÁGICO) ---
window.togglePrivacidade = () => {
    document.getElementById('valoresPrivados').classList.toggle('blur-value');
};

// --- METAS E GESTÃO ---
window.modalNovaMeta = async () => {
    const { value: f } = await Swal.fire({
        title: 'Novo Alvo',
        html: '<input id="mn" placeholder="Nome" class="swal2-input"><input id="ma" type="number" placeholder="Valor Final R$" class="swal2-input">',
        background: '#0a0c14', color: '#fff',
        preConfirm: () => [document.getElementById('mn').value, document.getElementById('ma').value]
    });
    if(f && f[0]) await addDoc(collection(db, "metas"), { nome: f[0], alvo: Number(f[1]), atual: 0, userId: userUID });
};

window.aportarMeta = async (id, atual) => {
    const { value: v } = await Swal.fire({ title: 'Quanto quer guardar?', input: 'number', background: '#0a0c14', color: '#fff' });
    if(v) await updateDoc(doc(db, "metas", id), { atual: atual + Number(v) });
};

window.removerMeta = async (id) => {
    const confirm = await Swal.fire({ title: 'Excluir meta?', showCancelButton: true, background: '#0a0c14', color: '#fff' });
    if(confirm.isConfirmed) await deleteDoc(doc(db, "metas", id));
};

function renderGestao() {
    const ctx = document.getElementById('chartGestao');
    if(chart) chart.destroy();
    const divs = fin.lista.filter(f => f.tipo === 'divida');
    document.getElementById('totalGestao').innerText = BRL(fin.dividas);
    
    chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: divs.map(d => d.nome),
            datasets: [{ data: divs.map(d => d.valor), backgroundColor: ['#a855f7','#7c3aed','#ef4444','#f59e0b'], borderWidth: 0 }]
        },
        options: { cutout: '85%', plugins: { legend: { display: false } } }
    });

    const list = document.getElementById('listaDetalhada'); list.innerHTML = "";
    divs.forEach(d => {
        list.innerHTML += `<div class="p-4 glass-card flex justify-between text-xs"><span>${d.nome}</span><b>${BRL(d.valor)}</b></div>`;
    });
}

window.abrirAcao = async (id, nome, valor) => {
    const { value: acao } = await Swal.fire({
        title: nome,
        input: 'select',
        inputOptions: { paga: '✅ Marcar como Pago', del: '🗑️ Deletar Registro' },
        background: '#0a0c14', color: '#fff'
    });
    if(acao === 'paga') await updateDoc(doc(db, "fluxo", id), { status: 'paga' });
    else if(acao === 'del') await deleteDoc(doc(db, "fluxo", id));
};
