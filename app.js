import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc, serverTimestamp, getDocs, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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

// Registro do Service Worker para PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then(reg => console.log('Metasboard: SW Ativo'))
            .catch(err => console.log('Erro SW:', err));
    });
}

let userUID = null;
let tAtual = 'divida';
let globalItems = [];
let globalMetas = [];
let calorOffset = 0;
const fmt = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Voz
const recognition = ('webkitSpeechRecognition' in window) ? new webkitSpeechRecognition() : null;
if (recognition) {
    recognition.lang = 'pt-BR';
    recognition.onresult = (e) => {
        const txt = e.results[0][0].transcript.toLowerCase();
        document.getElementById('masterInput').value = txt;
        const valMatch = txt.match(/(\d+([.,]\d+)?)/);
        if(valMatch) {
            document.getElementById('valManual').value = valMatch[0].replace(',', '.');
            document.getElementById('masterInput').value = txt.replace(valMatch[0], '').replace('reais', '').trim();
        }
        document.getElementById('audioBtn').classList.remove('bg-red-500');
    };
}
window.toggleAudio = () => { if(recognition) { recognition.start(); document.getElementById('audioBtn').classList.add('bg-red-500'); } };

// Navegação
window.nav = (id, btn) => {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('nav button').forEach(b => { b.classList.remove('nav-active'); b.classList.add('opacity-40'); });
    btn.classList.add('nav-active'); btn.classList.remove('opacity-40');
    if(id === 'secSimulador') { renderCalor(); calcularSimulador(); }
};

// Auth
window.alternarAuth = () => { 
    const b = document.getElementById('btnAuth'); 
    b.innerText = b.innerText === 'ACESSAR TERMINAL' ? 'CRIAR NOVO ACESSO' : 'ACESSAR TERMINAL'; 
};

window.executarAuth = () => {
    const e = document.getElementById('email').value, s = document.getElementById('senha').value;
    if(!e || !s) return Swal.fire('Erro', 'Preencha os campos.', 'error');
    if(document.getElementById('btnAuth').innerText === 'ACESSAR TERMINAL') 
        signInWithEmailAndPassword(auth, e, s).catch(err => Swal.fire('Erro', 'Acesso negado.', 'error'));
    else 
        createUserWithEmailAndPassword(auth, e, s).then(() => {
             setDoc(doc(db, "configs", auth.currentUser.uid), { salario: 0, dividasFixas: [] });
        }).catch(err => Swal.fire('Erro', 'Falha no cadastro.', 'error'));
};

window.sair = () => signOut(auth);

onAuthStateChanged(auth, u => {
    if(u) {
        userUID = u.uid;
        document.getElementById('loginTela').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        document.getElementById('dataRef').innerText = new Date().toLocaleDateString('pt-BR', {weekday:'long', day:'numeric', month:'long'});
        initData(); initMetas(); verificarFixos();
    } else {
        document.getElementById('loginTela').classList.remove('hidden');
        document.getElementById('app').classList.add('hidden');
    }
});

// Dados e Lógica
async function initData() {
    if(!userUID) return;
    const mesFiltro = document.getElementById('filtroMes').value || new Date().toISOString().slice(0, 7);
    const q = query(collection(db, "movimentacoes"), where("uid", "==", userUID));
    onSnapshot(q, (snap) => {
        globalItems = [];
        snap.forEach(d => globalItems.push({id: d.id, ...d.data()}));
        render();
    });
}

function render() {
    const mesFiltro = document.getElementById('filtroMes').value || new Date().toISOString().slice(0, 7);
    const itensMes = globalItems.filter(i => i.data.startsWith(mesFiltro));
    
    const entradas = itensMes.filter(i => i.tipo === 'ganho').reduce((a, b) => a + b.valor, 0);
    const saidas = itensMes.filter(i => i.tipo === 'divida').reduce((a, b) => a + b.valor, 0);
    
    document.getElementById('rendaMes').innerText = fmt(entradas);
    document.getElementById('gastoMes').innerText = fmt(saidas);
    document.getElementById('saldoReal').innerText = fmt(entradas - saidas);
    
    const feed = document.getElementById('feed');
    feed.innerHTML = itensMes.sort((a,b) => b.timestamp - a.timestamp).slice(0, 10).map(i => `
        <div class="glass p-4 flex justify-between items-center border-l-4 ${i.tipo === 'ganho' ? 'border-emerald-500' : 'border-rose-500'}">
            <div>
                <p class="text-[10px] font-black uppercase">${i.desc}</p>
                <p class="text-[8px] opacity-40">${i.data.split('-').reverse().join('/')}</p>
            </div>
            <div class="flex items-center gap-4">
                <b class="${i.tipo === 'ganho' ? 'text-emerald-400' : 'text-rose-400'} font-orbitron text-xs">${fmt(i.valor)}</b>
                <button onclick="apagarItem('${i.id}')" class="opacity-20 hover:opacity-100">✕</button>
            </div>
        </div>
    `).join('');

    const listaFull = document.getElementById('listaDividasFull');
    listaFull.innerHTML = itensMes.map(i => `
        <div class="flex justify-between p-2 border-b border-white/5 text-[10px]">
            <span class="opacity-60">${i.data.split('-').reverse().join('/')} - ${i.desc}</span>
            <b class="${i.tipo === 'ganho' ? 'text-emerald-400' : 'text-rose-400'}">${fmt(i.valor)}</b>
        </div>
    `).join('');
}

window.mudarTipo = (t) => {
    tAtual = t;
    document.getElementById('t-div').className = t === 'divida' ? 'text-[9px] px-6 py-2 rounded-xl bg-purple-600 font-black' : 'text-[9px] px-6 py-2 rounded-xl opacity-20 font-black';
    document.getElementById('t-gan').className = t === 'ganho' ? 'text-[9px] px-6 py-2 rounded-xl bg-purple-600 font-black' : 'text-[9px] px-6 py-2 rounded-xl opacity-20 font-black';
};

window.salvar = async () => {
    const desc = document.getElementById('masterInput').value;
    const valor = parseFloat(document.getElementById('valManual').value);
    const data = document.getElementById('dateManual').value || new Date().toISOString().slice(0, 10);
    const parcelado = document.getElementById('checkParcela').checked;
    const numP = parseInt(document.getElementById('numParcelas').value) || 1;

    if(!desc || !valor) return Swal.fire('Ops', 'Dados incompletos', 'warning');

    for(let i=0; i < numP; i++) {
        let d = new Date(data + 'T12:00:00');
        d.setMonth(d.getMonth() + i);
        await addDoc(collection(db, "movimentacoes"), {
            uid: userUID, desc: parcelado ? `${desc} (${i+1}/${numP})` : desc,
            valor: parcelado ? valor / numP : valor,
            tipo: tAtual, data: d.toISOString().slice(0, 10), timestamp: Date.now()
        });
    }
    
    if(tAtual === 'divida') confetti({ particleCount: 50, colors: ['#ff0000'] });
    else confetti({ particleCount: 150, colors: ['#a855f7', '#ffffff'] });

    document.getElementById('masterInput').value = '';
    document.getElementById('valManual').value = '';
};

window.apagarItem = (id) => deleteDoc(doc(db, "movimentacoes", id));

// Metas
async function initMetas() {
    onSnapshot(query(collection(db, "metas"), where("uid", "==", userUID)), snap => {
        globalMetas = [];
        snap.forEach(d => globalMetas.push({id: d.id, ...d.data()}));
        renderMetas();
    });
}

function renderMetas() {
    const lista = document.getElementById('listaMetas');
    lista.innerHTML = globalMetas.map(m => {
        const perc = Math.min((m.poupado / m.objetivo) * 100, 100);
        return `
        <div class="glass p-6 space-y-3">
            <div class="flex justify-between items-end">
                <div><h4 class="font-orbitron text-sm">${m.nome}</h4><p class="text-[9px] opacity-40 uppercase">Faltam ${fmt(m.objetivo - m.poupado)}</p></div>
                <div class="text-right"><b class="text-purple-400 font-orbitron">${perc.toFixed(1)}%</b></div>
            </div>
            <div class="progress-bar"><div class="progress-fill" style="width: ${perc}%"></div></div>
            <div class="flex gap-2">
                <button onclick="pouparMeta('${m.id}', ${m.poupado})" class="flex-1 bg-white/5 py-3 rounded-xl text-[10px] font-black">+ ADICIONAR</button>
                <button onclick="apagarMeta('${m.id}')" class="bg-rose-500/10 text-rose-500 px-4 rounded-xl">✕</button>
            </div>
        </div>`;
    }).join('');
}

window.abrirModalMeta = async () => {
    const { value: f } = await Swal.fire({
        title: 'Nova Meta',
        html: `<input id="mn" class="swal2-input" placeholder="O que deseja?"><input id="mv" class="swal2-input" type="number" placeholder="Valor Total">`,
        preConfirm: () => ({ nome: document.getElementById('mn').value, objetivo: parseFloat(document.getElementById('mv').value) })
    });
    if(f.nome && f.objetivo) await addDoc(collection(db, "metas"), { ...f, poupado: 0, uid: userUID });
};

window.pouparMeta = async (id, atual) => {
    const { value: v } = await Swal.fire({ title: 'Quanto poupou?', input: 'number' });
    if(v) await updateDoc(doc(db, "metas", id), { poupado: atual + parseFloat(v) });
};

window.apagarMeta = (id) => deleteDoc(doc(db, "metas", id));

// Outros
async function verificarFixos() {
    const snap = await getDoc(doc(db, "configs", userUID));
    if(snap.exists()) {
        const c = snap.data();
        document.getElementById('statusSalario').innerHTML = c.salario > 0 ? `<div class="p-4 bg-emerald-500/10 rounded-2xl flex justify-between items-center"><span>${fmt(c.salario)}</span><button onclick="removerFixo('salario')" class="text-rose-500">✕</button></div>` : `<button onclick="abrirModalSalario()" class="w-full p-4 border-2 border-dashed border-white/10 rounded-2xl opacity-40">Definir Salário</button>`;
    }
}

window.abrirModalSalario = async () => {
    const { value: v } = await Swal.fire({ title: 'Renda Mensal', input: 'number' });
    if(v) { await setDoc(doc(db, "configs", userUID), { salario: parseFloat(v) }, { merge: true }); verificarFixos(); }
};

window.removerFixo = async (tipo) => {
    if(tipo === 'salario') await updateDoc(doc(db, "configs", userUID), { salario: 0 });
    verificarFixos();
};

function renderCalor() {
    const h = document.getElementById('heatmap');
    h.innerHTML = '';
    const agora = new Date();
    agora.setMonth(agora.getMonth() + calorOffset);
    document.getElementById('calorDataRef').innerText = agora.toLocaleDateString('pt-BR', {month:'short', year:'numeric'});
    
    const diasNoMes = new Date(agora.getFullYear(), agora.getMonth()+1, 0).getDate();
    for(let d=1; d<=diasNoMes; d++) {
        const dataStr = `${agora.getFullYear()}-${String(agora.getMonth()+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const temGasto = globalItems.some(i => i.data === dataStr);
        h.innerHTML += `<div class="heatmap-day ${temGasto ? 'bg-purple-600 shadow-[0_0_10px_#a855f7]' : 'bg-white/5 opacity-20'}">${d}</div>`;
    }
}
window.mudarMesCalor = (n) => { calorOffset += n; renderCalor(); };

window.abrirChatIA = () => document.getElementById('chatAI').classList.add('open');
window.fecharChatIA = () => document.getElementById('chatAI').classList.remove('open');
