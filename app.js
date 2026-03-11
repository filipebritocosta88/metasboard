import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, deleteDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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

let userUID = null, tAtual = 'divida', cAtual = '💰';
const fmt = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// --- RECONHECIMENTO DE VOZ ---
const recognition = 'webkitSpeechRecognition' in window ? new webkitSpeechRecognition() : null;
if (recognition) {
    recognition.lang = 'pt-BR';
    recognition.onresult = (e) => {
        const res = e.results[0][0].transcript;
        document.getElementById('masterInput').value = res;
        window.ajudaInteligente(res);
        document.getElementById('audioBtn').classList.remove('recording');
    };
    recognition.onerror = () => document.getElementById('audioBtn').classList.remove('recording');
}

window.toggleAudio = () => {
    if (!recognition) return alert("Voz indisponível");
    const btn = document.getElementById('audioBtn');
    btn.classList.toggle('recording') ? recognition.start() : recognition.stop();
};

window.ajudaInteligente = (v) => {
    const n = v.match(/\d+([.,]\d+)?/);
    if(n) document.getElementById('valManual').value = n[0].replace(',', '.');
    const t = v.toLowerCase();
    if(t.includes('mercado')) setCat('🛒');
    else if(t.includes('lanche')) setCat('🍔');
    else if(t.includes('casa')) setCat('🏠');
};

window.setCat = (e) => {
    cAtual = e;
    document.querySelectorAll('#cats button').forEach(b => b.classList.add('grayscale'));
    Swal.fire({ toast: true, position: 'top', timer: 800, showConfirmButton: false, title: e });
};

window.mudarTipo = (t) => {
    tAtual = t;
    document.getElementById('t-div').className = t === 'divida' ? 'text-[9px] px-5 py-2 rounded-lg bg-purple-600 font-black' : 'text-[9px] px-5 py-2 rounded-lg opacity-30 font-black';
    document.getElementById('t-gan').className = t === 'ganho' ? 'text-[9px] px-5 py-2 rounded-lg bg-purple-600 font-black' : 'text-[9px] px-5 py-2 rounded-lg opacity-30 font-black';
};

// --- AUTENTICAÇÃO CORRIGIDA ---
window.alternarAuth = () => {
    const btn = document.getElementById('btnAuth');
    const txt = document.getElementById('txtAuth');
    const title = document.getElementById('authTitle');
    
    if (btn.innerText === 'ENTRAR NO SISTEMA') {
        btn.innerText = 'CRIAR MINHA CONTA';
        txt.innerText = 'JÁ POSSUO CADASTRO';
        title.innerText = 'Novo Recrutamento';
    } else {
        btn.innerText = 'ENTRAR NO SISTEMA';
        txt.innerText = 'NOVO POR AQUI? CRIAR CONTA';
        title.innerText = 'Bem-vindo de volta';
    }
};

window.executarAuth = () => {
    const e = document.getElementById('email').value.trim();
    const s = document.getElementById('senha').value.trim();
    const modo = document.getElementById('btnAuth').innerText;

    if (!e || !s) return Swal.fire('Erro', 'Preencha os campos', 'warning');

    if (modo === 'ENTRAR NO SISTEMA') {
        signInWithEmailAndPassword(auth, e, s).catch(() => Swal.fire('Erro', 'E-mail ou senha inválidos', 'error'));
    } else {
        createUserWithEmailAndPassword(auth, e, s).catch(err => Swal.fire('Erro no Cadastro', 'E-mail em uso ou inválido', 'error'));
    }
};

window.sair = () => signOut(auth);

onAuthStateChanged(auth, u => {
    if(u) {
        userUID = u.uid;
        document.getElementById('loginTela').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        document.getElementById('dataRef').innerText = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
        initData();
    } else {
        document.getElementById('loginTela').classList.remove('hidden');
        document.getElementById('app').classList.add('hidden');
    }
});

// --- ENGINE ---
window.salvar = async () => {
    const n = document.getElementById('masterInput').value;
    const v = parseFloat(document.getElementById('valManual').value);
    const d = document.getElementById('dateManual').value || new Date().toISOString().split('T')[0];

    if(!n || isNaN(v)) return Swal.fire('Atenção', 'Nome e valor obrigatórios', 'info');

    await addDoc(collection(db, "fluxo"), { nome: n, valor: v, data: d, tipo: tAtual, categoria: cAtual, userId: userUID, ts: serverTimestamp() });
    document.getElementById('masterInput').value = '';
    document.getElementById('valManual').value = '';
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#a855f7', '#ffffff'] });
};

function initData() {
    onSnapshot(query(collection(db, "fluxo"), where("userId", "==", userUID)), snap => {
        let r=0, d=0; const lista = [];
        snap.forEach(doc => {
            const item = { ...doc.data(), id: doc.id };
            if(item.tipo === 'ganho') r += item.valor; else d += item.valor;
            lista.push(item);
        });
        updateUI(r, d, lista);
    });
}

function updateUI(r, d, lista) {
    const saldo = r - d;
    const hp = r > 0 ? Math.min(100, Math.max(0, (saldo / r) * 100)) : 0;
    
    document.getElementById('saldoReal').innerText = fmt(saldo);
    document.getElementById('txtReceita').innerText = fmt(r);
    document.getElementById('txtDespesa').innerText = fmt(d);
    document.getElementById('txtPrevisto').innerText = fmt(r * 1.1); // Simulação de previsto
    document.getElementById('hpFill').style.width = hp + '%';
    document.getElementById('hpPorcentagem').innerText = Math.round(hp) + '%';
    
    const status = document.getElementById('hpTexto');
    status.innerText = hp > 50 ? 'ESTÁVEL' : 'CRÍTICO';
    status.className = `text-[10px] font-orbitron px-3 py-1 rounded-full bg-white/5 border ${hp > 50 ? 'border-emerald-500/30 text-emerald-400' : 'border-rose-500/30 text-rose-400'}`;

    const feed = document.getElementById('feed');
    feed.innerHTML = '';
    lista.sort((a,b) => b.ts - a.ts).slice(0,8).forEach(i => {
        feed.innerHTML += `
            <div class="glass p-5 flex justify-between items-center border-l-4 ${i.tipo === 'ganho' ? 'border-emerald-500' : 'border-rose-500'} card-entry">
                <div class="flex items-center gap-4">
                    <span class="text-2xl">${i.categoria}</span>
                    <div><p class="text-[10px] font-black uppercase tracking-wider">${i.nome}</p><p class="text-[8px] opacity-30">${i.data}</p></div>
                </div>
                <div class="text-right">
                    <p class="money font-bold ${i.tipo === 'ganho' ? 'text-emerald-400' : 'text-rose-400'}">${fmt(i.valor)}</p>
                    <button onclick="deletar('${i.id}')" class="text-[7px] opacity-20 hover:opacity-100 uppercase font-black text-rose-500">Remover</button>
                </div>
            </div>`;
    });
}

window.deletar = async (id) => { if(confirm('Apagar?')) await deleteDoc(doc(db, "fluxo", id)); };

window.nav = (id, btn) => {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('nav-active'));
    btn.classList.add('nav-active');
};
