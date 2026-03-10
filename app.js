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

let userUID = null, tipoAtual = 'ganho', catAtual = '🛒', chartInst = null;
let fin = { previsto: 0, saldoReal: 0, dividas: 0, lista: [] };
let dadosCarregados = false;

const BRL = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// --- TUTORIAL ---
async function iniciarTutorial() {
    while(!dadosCarregados) { await new Promise(r => setTimeout(r, 100)); }
    const { value: ok } = await Swal.fire({ title: 'BEM-VINDO!', text: 'Quer um tour rápido?', icon: 'info', showCancelButton: true, confirmButtonText: 'Sim!', confirmButtonColor: '#a855f7' });
    if (!ok) return;

    const passos = [
        { el: 'step-saude', txt: 'Seu HP financeiro. Mantenha as dívidas baixas!' },
        { el: 'step-registro', txt: 'REGISTRO: Escolha a categoria e salve seus gastos.' }
    ];

    for (let p of passos) {
        document.getElementById(p.el).scrollIntoView({ behavior: 'smooth', block: 'center' });
        await new Promise(r => setTimeout(r, 400));
        document.getElementById(p.el).classList.add('tutorial-highlight');
        await Swal.fire({ text: p.txt, confirmButtonText: 'PRÓXIMO', confirmButtonColor: '#a855f7' });
        document.getElementById(p.el).classList.remove('tutorial-highlight');
    }
    confetti({ particleCount: 100 });
}

// --- AUTH ---
window.alternarModoAuth = () => {
    const btn = document.getElementById('btnAcessar');
    btn.innerText = btn.innerText === "ENTRAR" ? "CRIAR CONTA" : "ENTRAR";
};

window.executarAuth = () => {
    const e = document.getElementById('email').value.trim();
    const s = document.getElementById('senha').value.trim();
    const modo = document.getElementById('btnAcessar').innerText;
    if(!e || !s) return;

    if(modo === "CRIAR CONTA") {
        createUserWithEmailAndPassword(auth, e, s).then(c => localStorage.setItem('novo_user_'+c.user.uid, '1')).catch(a => alert(a.message));
    } else {
        signInWithEmailAndPassword(auth, e, s).catch(() => alert("Erro no login"));
    }
};

window.sairDoSistema = () => signOut(auth).then(() => location.reload());

onAuthStateChanged(auth, user => {
    if (user) { 
        userUID = user.uid; 
        document.getElementById('loginTela').style.display = 'none'; 
        document.getElementById('dashboard').classList.add('show-dash'); 
        iniciarRealtime(); 
        if(localStorage.getItem('novo_user_'+userUID)) { localStorage.removeItem('novo_user_'+userUID); iniciarTutorial(); }
    } else { document.getElementById('loginTela').style.display = 'flex'; }
});

// --- CORE ---
function iniciarRealtime() {
    onSnapshot(query(collection(db, "fluxo"), where("userId", "==", userUID)), snap => {
        let p=0, r=0, d=0; fin.lista = [];
        snap.forEach(ds => {
            const i = { ...ds.data(), id: ds.id };
            if(i.status !== 'paga') {
                if(i.tipo === 'ganho') { p += i.valor; r += i.valor; } else { d += i.valor; }
            }
            fin.lista.push(i);
        });
        fin.previsto=p; fin.saldoReal=r; fin.dividas=d; dadosCarregados=true;
        atualizarUI();
    });

    onSnapshot(query(collection(db, "metas"), where("userId", "==", userUID), where("status", "==", "ativa")), snap => {
        const grid = document.getElementById('rankingGrid'); grid.innerHTML = "";
        snap.forEach(ds => {
            const m = ds.data();
            const done = (m.checklist || []).filter(c => c.done).length;
            const perc = m.checklist?.length ? (done / m.checklist.length) * 100 : 0;
            grid.innerHTML += `<div class="glass-card p-6 border-l-4 border-purple-500">
                <div class="flex justify-between mb-2"><h4 class="text-xs font-black uppercase">${m.nome}</h4><span>${perc.toFixed(0)}%</span></div>
                <div class="hp-bar"><div class="hp-fill bg-purple-500" style="width: ${perc}%"></div></div>
            </div>`;
        });
    });
}

function atualizarUI() {
    document.getElementById('receitaTotal').innerText = BRL(fin.previsto);
    document.getElementById('saldoReal').innerText = BRL(fin.saldoReal);
    document.getElementById('despesaTotal').innerText = BRL(fin.dividas);
    const perc = Math.max(0, 100 - (fin.dividas / (fin.previsto || 1) * 100));
    document.getElementById('hpFill').style.width = perc + "%";
    
    const t = document.getElementById('listaTimeline'); t.innerHTML = "";
    fin.lista.sort((a,b) => new Date(b.data) - new Date(a.data)).forEach(i => {
        t.innerHTML += `<div class="glass-card p-4 flex justify-between border-l-4 ${i.tipo === 'ganho' ? 'border-emerald-500' : 'border-rose-500'}" onclick="abrirAcao('${i.id}')">
            <div><h4 class="text-[10px] font-black uppercase">${i.categoria || '💸'} ${i.nome}</h4><p class="text-[8px] opacity-40">${i.data}</p></div>
            <b class="text-xs ${i.tipo === 'ganho' ? 'text-emerald-400' : 'text-rose-500'}">${BRL(i.valor)}</b>
        </div>`;
    });
}

// --- WINDOW FUNCTIONS (PARA OS BOTÕES FUNCIONAREM) ---
window.setTipo = (t) => {
    tipoAtual = t;
    document.getElementById('tabGanho').className = t==='ganho' ? "text-[10px] font-black uppercase text-purple-500 border-b-2 border-purple-500 pb-1" : "text-[10px] opacity-40 pb-1";
    document.getElementById('tabDivida').className = t==='divida' ? "text-[10px] font-black uppercase text-purple-500 border-b-2 border-purple-500 pb-1" : "text-[10px] opacity-40 pb-1";
};

window.setCat = (emoji, btn) => {
    catAtual = emoji;
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
};

window.salvarLancamento = async () => {
    const n = document.getElementById('fNome').value, v = Number(document.getElementById('fValor').value), d = document.getElementById('fData').value;
    if(n && v && d) {
        await addDoc(collection(db, "fluxo"), { nome: n, valor: v, data: d, tipo: tipoAtual, categoria: catAtual, userId: userUID, status: 'pendente' });
        document.getElementById('fNome').value = ""; document.getElementById('fValor').value = "";
    }
};

window.abrirAcao = async (id) => {
    const { value: a } = await Swal.fire({ title: 'Ação', input: 'select', inputOptions: { paga: '✅ Pago', del: '🗑️ Excluir' }, confirmButtonColor: '#a855f7' });
    if(a === 'paga') await updateDoc(doc(db, "fluxo", id), { status: 'paga' });
    else if(a === 'del') await deleteDoc(doc(db, "fluxo", id));
};

window.abrirHistorico = () => {
    let h = `<div class="space-y-2 text-left">`;
    fin.lista.forEach(i => h += `<div class="p-3 bg-white/5 rounded-xl text-[10px] uppercase font-black">${i.nome} - ${BRL(i.valor)}</div>`);
    Swal.fire({ title: 'HISTÓRICO', html: h + '</div>', showConfirmButton: false });
};

window.navegar = (id, btn) => {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-btn-m').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if(id === 'secGestao') renderGestao();
};

window.modalNovaMeta = async () => {
    const { value: n } = await Swal.fire({ title: 'Nova Meta', input: 'text', confirmButtonColor: '#a855f7' });
    if(n) await addDoc(collection(db, "metas"), { nome: n, status: 'ativa', checklist: [], userId: userUID });
};

function renderGestao() {
    const ctx = document.getElementById('chartGestao');
    if(chartInst) chartInst.destroy();
    const divs = fin.lista.filter(f => f.tipo === 'divida');
    document.getElementById('totalGestao').innerText = BRL(fin.dividas);
    chartInst = new Chart(ctx, {
        type: 'doughnut',
        data: { datasets: [{ data: divs.length ? divs.map(d => d.valor) : [1], backgroundColor: ['#a855f7', '#7c3aed', '#6366f1', '#4ade80'], borderWidth: 0 }] },
        options: { cutout: '85%', plugins: { legend: { display: false } } }
    });
}
