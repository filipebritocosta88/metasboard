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

let userUID = null, tipoAtual = 'ganho', chartInst = null, modoRegistro = false;
let fin = { previsto: 0, saldoReal: 0, dividas: 0, lista: [] };
let metasAtivas = [];

const BRL = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// --- TUTORIAL / ONBOARDING ---
async function iniciarTutorial() {
    const { value: aceitou } = await Swal.fire({
        title: 'BEM-VINDO AO METASBOARD',
        text: 'Este é o seu novo ecossistema de produtividade e controle financeiro. Quer que eu te mostre como funciona?',
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: 'Sim, me ensine!',
        cancelButtonText: 'Pular',
        confirmButtonColor: '#a855f7'
    });

    if (!aceitou) return;

    const passos = [
        { el: 'step-saude', txt: 'Aqui você vê sua Saúde Patrimonial. O HP desce conforme suas dívidas aumentam!' },
        { el: 'step-registro', txt: 'Nesta área você registra o que ganha e o que gasta. Use o check do 5º dia útil para salários!' },
        { el: 'step-nav', txt: 'Navegue entre o Início, suas Metas e a Gestão detalhada por aqui.' },
        { el: 'step-conversor', txt: 'Precisa converter R$ para Dólar ou Euro para suas metas internacionais? Clique aqui!' }
    ];

    for (let p of passos) {
        const item = document.getElementById(p.el);
        item.classList.add('tutorial-highlight');
        await Swal.fire({ text: p.txt, toast: true, position: 'top', showConfirmButton: true, confirmButtonText: 'Próximo' });
        item.classList.remove('tutorial-highlight');
    }

    Swal.fire({ title: 'Tudo pronto!', text: 'Agora é com você. Conquiste seus objetivos!', icon: 'success', timer: 3000 });
}

// --- AUTH ---
window.alternarModoAuth = () => {
    modoRegistro = !modoRegistro;
    document.getElementById('btnAcessar').innerText = modoRegistro ? "CRIAR CONTA" : "ENTRAR NO BOARD";
    document.getElementById('btnTrocarAuth').innerText = modoRegistro ? "JÁ TENHO CONTA" : "CRIAR NOVA CONTA";
};

window.executarAuth = () => {
    const e = document.getElementById('email').value.trim();
    const s = document.getElementById('senha').value.trim();
    if(!e || !s) return alert("Preencha os dados.");
    
    if(modoRegistro) {
        createUserWithEmailAndPassword(auth, e, s).then(() => {
            localStorage.setItem('novo_user_' + auth.currentUser.uid, 'true');
        }).catch(err => alert(err.message));
    } else {
        signInWithEmailAndPassword(auth, e, s).catch(() => alert("Erro no login."));
    }
};

window.sairDoSistema = () => signOut(auth).then(() => location.reload());

onAuthStateChanged(auth, user => {
    if (user) { 
        userUID = user.uid; 
        document.getElementById('loginTela').style.display = 'none'; 
        document.getElementById('dashboard').classList.add('show-dash'); 
        iniciarRealtime(); 
        
        // Checa se é o primeiro acesso
        if (localStorage.getItem('novo_user_' + userUID)) {
            localStorage.removeItem('novo_user_' + userUID);
            iniciarTutorial();
        }
    } else { 
        document.getElementById('loginTela').style.display = 'flex'; 
        document.getElementById('dashboard').classList.remove('show-dash'); 
    }
});

// --- CORE ---
function getQuintoDiaUtil() {
    let d = new Date(); d.setDate(1); let c = 0;
    while (c < 5) {
        let day = d.getDay();
        if (day !== 0 && day !== 6) c++;
        if (c < 5) d.setDate(d.getDate() + 1);
    }
    return d;
}

function iniciarRealtime() {
    onSnapshot(query(collection(db, "fluxo"), where("userId", "==", userUID)), snap => {
        let prev = 0, real = 0, div = 0; fin.lista = [];
        const hoje = new Date(), quinto = getQuintoDiaUtil();
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

    onSnapshot(query(collection(db, "metas"), where("userId", "==", userUID), where("status", "==", "ativa")), snap => {
        metasAtivas = [];
        const grid = document.getElementById('rankingGrid'); grid.innerHTML = "";
        snap.forEach(ds => {
            const m = { ...ds.data(), id: ds.id }; metasAtivas.push(m);
            const check = m.checklist || [];
            const done = check.filter(c => c.done).length;
            const perc = check.length > 0 ? (done / check.length) * 100 : 0;
            grid.innerHTML += `
            <div class="glass-card p-6 border-l-4 border-purple-500">
                <div class="flex justify-between mb-2">
                    <h4 class="text-sm font-black italic uppercase">${m.nome}</h4>
                    <span class="text-purple-400 font-black text-xs">${perc.toFixed(0)}%</span>
                </div>
                <div class="hp-bar mb-4"><div class="hp-fill bg-purple-600" style="width: ${perc}%"></div></div>
                <div class="space-y-2 mb-4">
                    ${check.map((c, idx) => `
                        <div onclick="toggleSubmeta('${m.id}', ${idx}, ${c.done})" class="submeta-item p-4 rounded-2xl flex justify-between items-center text-[10px] font-bold ${c.done ? 'done' : ''}">
                            <span>${c.item}</span><span>${c.done ? '✅' : '⭕'}</span>
                        </div>
                    `).join('')}
                </div>
                <button onclick="addSubmeta('${m.id}')" class="w-full bg-white/5 py-3 rounded-xl text-[9px] font-black uppercase">+ Requisito</button>
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
    document.getElementById('txtSaude').innerText = perc > 70 ? "Excelente" : perc > 40 ? "Alerta" : "Crítico";
    
    const t = document.getElementById('listaTimeline'); t.innerHTML = "";
    fin.lista.sort((a,b) => new Date(a.data) - new Date(b.data)).forEach(i => {
        t.innerHTML += `<div class="glass-card p-4 flex justify-between border-l-4 ${i.tipo === 'ganho' ? 'border-emerald-500' : 'border-rose-500'}" onclick="abrirAcao('${i.id}')">
            <div><h4 class="text-[10px] font-black uppercase">${i.nome}</h4><p class="text-[8px] opacity-40">${i.data}</p></div>
            <b class="text-xs ${i.tipo === 'ganho' ? 'text-emerald-400' : 'text-rose-500'}">${BRL(i.valor)}</b>
        </div>`;
    });
}

function renderGestao() {
    const ctx = document.getElementById('chartGestao');
    if(chartInst) chartInst.destroy();
    const divs = fin.lista.filter(f => f.tipo === 'divida');
    document.getElementById('totalGestao').innerText = BRL(fin.dividas);
    chartInst = new Chart(ctx, {
        type: 'doughnut',
        data: { datasets: [{ data: divs.map(d => d.valor), backgroundColor: ['#a855f7', '#7c3aed', '#6366f1'], borderWidth: 0 }] },
        options: { cutout: '85%', plugins: { legend: { display: false } } }
    });
    const conselho = document.getElementById('conselhoMentor');
    const ratio = fin.dividas / (fin.previsto || 1);
    conselho.innerText = ratio > 0.6 ? "Cuidado com os gastos!" : "Finanças saudáveis para novos sonhos.";
}

window.navegar = (id, btn) => {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-btn-m').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if(id === 'secGestao') renderGestao();
};

window.salvarLancamento = async () => {
    const n = document.getElementById('fNome').value, v = Number(document.getElementById('fValor').value), d = document.getElementById('fData').value, s = document.getElementById('f5Dia').checked;
    if(n && v && d) {
        await addDoc(collection(db, "fluxo"), { nome: n, valor: v, data: d, tipo: tipoAtual, isSalario: s, status: 'pendente', userId: userUID });
        document.getElementById('fNome').value = ""; document.getElementById('fValor').value = "";
    }
};

window.toggleSubmeta = async (mId, idx, status) => {
    const m = metasAtivas.find(x => x.id === mId);
    let nova = [...m.checklist];
    nova[idx].done = !status;
    await updateDoc(doc(db, "metas", mId), { checklist: nova });
    if(nova.every(c => c.done)) {
        confetti({ particleCount: 150, spread: 70 });
        await updateDoc(doc(db, "metas", mId), { status: 'concluida' });
    }
};

window.abrirAcao = async (id) => {
    const { value: a } = await Swal.fire({ title: 'Ação', input: 'select', inputOptions: { paga: '✅ Pago', del: '🗑️ Excluir' } });
    if(a === 'paga') await updateDoc(doc(db, "fluxo", id), { status: 'paga' });
    else if(a === 'del') await deleteDoc(doc(db, "fluxo", id));
};

window.modalNovaMeta = async () => {
    const { value: n } = await Swal.fire({ title: 'Meta Principal', input: 'text' });
    if(n) await addDoc(collection(db, "metas"), { nome: n, status: 'ativa', checklist: [], userId: userUID });
};

window.addSubmeta = async (id) => {
    const { value: i } = await Swal.fire({ title: 'Requisito', input: 'text' });
    if(i) await updateDoc(doc(db, "metas", id), { checklist: arrayUnion({ item: i, done: false }) });
};

window.toggleChat = () => { const w = document.getElementById('chatWindow'); w.classList.toggle('hidden'); w.classList.toggle('flex'); };
window.converterMoedas = () => {
    const brl = Number(document.getElementById('convValor').value);
    document.getElementById('resDolar').innerText = "$ " + (brl / 5.10).toFixed(2);
    document.getElementById('resEuro').innerText = "€ " + (brl / 5.50).toFixed(2);
};

window.setTipo = (t) => {
    tipoAtual = t;
    document.getElementById('tabGanho').className = t === 'ganho' ? "text-[10px] font-black uppercase text-purple-500 border-b-2 border-purple-500 pb-1" : "text-[10px] opacity-40 pb-1";
    document.getElementById('tabDivida').className = t === 'divida' ? "text-[10px] font-black uppercase text-purple-500 border-b-2 border-purple-500 pb-1" : "text-[10px] opacity-40 pb-1";
};

window.abrirHistorico = () => {
    let h = `<div class="space-y-2 text-left">`;
    fin.lista.forEach(i => h += `<div class="p-3 bg-white/5 rounded-xl text-[10px] uppercase font-black">${i.nome} - ${BRL(i.valor)}</div>`);
    Swal.fire({ title: 'HISTÓRICO', html: h + '</div>', showConfirmButton: false });
};
