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
let dadosCarregados = false;

const BRL = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// --- TUTORIAL MELHORADO ---
async function iniciarTutorial() {
    // Garante que o dashboard e os dados estão prontos
    while(!dadosCarregados) { await new Promise(r => setTimeout(r, 100)); }

    const { value: aceitou } = await Swal.fire({
        title: 'BEM-VINDO!',
        text: 'Este é o MetasBoard. Quer um tour rápido?',
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: 'Sim!',
        cancelButtonText: 'Não',
        confirmButtonColor: '#a855f7'
    });

    if (!aceitou) return;

    const passos = [
        { el: 'step-saude', txt: 'Sua SAÚDE PATRIMONIAL. O HP cai se as dívidas subirem.' },
        { el: 'step-registro', txt: 'REGISTRO: Adicione ganhos e gastos aqui. Dica: Use o check de 5º dia útil para salários.' },
        { el: 'step-nav', txt: 'MENU: Navegue entre Início, Metas e Gestão Estratégica.' },
        { el: 'step-conversor', txt: 'CONVERSOR: Calcule Dólar e Euro em tempo real para suas metas!' }
    ];

    for (let p of passos) {
        const item = document.getElementById(p.el);
        
        // Esconder teclado se estiver aberto e focar no elemento
        document.activeElement.blur();
        item.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        await new Promise(r => setTimeout(r, 400)); // Espera o scroll
        item.classList.add('tutorial-highlight');
        
        await Swal.fire({ 
            text: p.txt, 
            confirmButtonText: 'PRÓXIMO', 
            confirmButtonColor: '#a855f7',
            backdrop: 'rgba(0,0,0,0.6)'
        });
        
        item.classList.remove('tutorial-highlight');
    }

    confetti({ particleCount: 150, spread: 60 });
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
    if(!e || !s) return;
    
    if(modoRegistro) {
        createUserWithEmailAndPassword(auth, e, s).then((cred) => {
            localStorage.setItem('novo_user_' + cred.user.uid, 'true');
        }).catch(err => alert("Erro: " + err.message));
    } else {
        signInWithEmailAndPassword(auth, e, s).catch(() => alert("Dados incorretos."));
    }
};

window.sairDoSistema = () => signOut(auth).then(() => { localStorage.clear(); location.reload(); });

onAuthStateChanged(auth, user => {
    if (user) { 
        userUID = user.uid; 
        document.getElementById('loginTela').style.display = 'none'; 
        document.getElementById('dashboard').classList.add('show-dash'); 
        iniciarRealtime(); 
        
        // Só dispara o tutorial se for um novo usuário marcado no registro
        if (localStorage.getItem('novo_user_' + userUID)) {
            localStorage.removeItem('novo_user_' + userUID);
            iniciarTutorial();
        }
    } else { 
        document.getElementById('loginTela').style.display = 'flex'; 
    }
});

// --- ENGINE ---
function iniciarRealtime() {
    onSnapshot(query(collection(db, "fluxo"), where("userId", "==", userUID)), snap => {
        let prev = 0, real = 0, div = 0; fin.lista = [];
        snap.forEach(ds => {
            const i = { ...ds.data(), id: ds.id };
            if (i.status !== 'paga') {
                if (i.tipo === 'ganho') { prev += i.valor; real += i.valor; } 
                else { div += i.valor; }
            }
            fin.lista.push(i);
        });
        fin.previsto = prev; fin.saldoReal = real; fin.dividas = div;
        dadosCarregados = true;
        atualizarUI();
    });

    onSnapshot(query(collection(db, "metas"), where("userId", "==", userUID), where("status", "==", "ativa")), snap => {
        const grid = document.getElementById('rankingGrid'); grid.innerHTML = ""; metasAtivas = [];
        snap.forEach(ds => {
            const m = { ...ds.data(), id: ds.id }; metasAtivas.push(m);
            const check = m.checklist || [];
            const done = check.filter(c => c.done).length;
            const perc = check.length > 0 ? (done / check.length) * 100 : 0;
            grid.innerHTML += `
            <div class="glass-card p-6 border-l-4 border-purple-500">
                <div class="flex justify-between mb-2"><h4 class="text-sm font-black uppercase">${m.nome}</h4><span class="text-purple-400 font-black text-xs">${perc.toFixed(0)}%</span></div>
                <div class="hp-bar mb-4"><div class="hp-fill bg-purple-600" style="width: ${perc}%"></div></div>
                <div class="space-y-2 mb-4">
                    ${check.map((c, idx) => `<div onclick="toggleSubmeta('${m.id}', ${idx}, ${c.done})" class="submeta-item p-4 rounded-2xl flex justify-between items-center text-[10px] font-bold ${c.done ? 'done' : ''}"><span>${c.item}</span><span>${c.done ? '✅' : '⭕'}</span></div>`).join('')}
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
    document.getElementById('txtSaude').innerText = perc > 70 ? "Excelente" : "Alerta";
    
    const t = document.getElementById('listaTimeline'); t.innerHTML = "";
    fin.lista.forEach(i => {
        t.innerHTML += `<div class="glass-card p-4 flex justify-between border-l-4 ${i.tipo === 'ganho' ? 'border-emerald-500' : 'border-rose-500'}" onclick="abrirAcao('${i.id}')">
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
};

window.salvarLancamento = async () => {
    const n = document.getElementById('fNome').value, v = Number(document.getElementById('fValor').value), d = document.getElementById('fData').value, s = document.getElementById('f5Dia').checked;
    if(n && v && d) {
        await addDoc(collection(db, "fluxo"), { nome: n, valor: v, data: d, tipo: tipoAtual, isSalario: s, status: 'pendente', userId: userUID });
        document.getElementById('fNome').value = ""; document.getElementById('fValor').value = "";
    }
};

window.abrirAcao = async (id) => {
    const { value: a } = await Swal.fire({ title: 'Ação', input: 'select', inputOptions: { paga: '✅ Pago', del: '🗑️ Excluir' } });
    if(a === 'paga') await updateDoc(doc(db, "fluxo", id), { status: 'paga' });
    else if(a === 'del') await deleteDoc(doc(db, "fluxo", id));
};

window.modalNovaMeta = async () => {
    const { value: n } = await Swal.fire({ title: 'Meta', input: 'text' });
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
    document.getElementById('tabGanho').style.opacity = t === 'ganho' ? "1" : "0.4";
    document.getElementById('tabDivida').style.opacity = t === 'divida' ? "1" : "0.4";
};
