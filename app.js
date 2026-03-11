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

// --- RECONHECIMENTO DE VOZ MELHORADO ---
const recognition = ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) 
    ? new (window.SpeechRecognition || window.webkitSpeechRecognition)() 
    : null;

if (recognition) {
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
        const fala = event.results[0][0].transcript;
        console.log("Ouvido:", fala);
        
        // Escreve a frase inteira no campo principal
        document.getElementById('masterInput').value = fala;
        
        // Processa os dados (valor e categoria)
        window.processarVozInteligente(fala);
        
        document.getElementById('audioBtn').classList.remove('recording');
        Swal.fire({ toast: true, position: 'top', timer: 1500, title: "Lido!", icon: 'success', showConfirmButton: false, background: '#111', color: '#fff' });
    };

    recognition.onerror = () => document.getElementById('audioBtn').classList.remove('recording');
    recognition.onend = () => document.getElementById('audioBtn').classList.remove('recording');
}

window.toggleAudio = () => {
    if (!recognition) return Swal.fire("Erro", "Voz não suportada neste celular.", "error");
    const btn = document.getElementById('audioBtn');
    if (btn.classList.contains('recording')) {
        recognition.stop();
    } else {
        btn.classList.add('recording');
        recognition.start();
    }
};

window.processarVozInteligente = (frase) => {
    const texto = frase.toLowerCase();
    
    // 1. Extrair Valor: Procura por números na frase
    const numeros = texto.match(/\d+([.,]\d+)?/);
    if (numeros) {
        document.getElementById('valManual').value = numeros[0].replace(',', '.');
        // Remove o valor do texto para deixar apenas a descrição
        const descricaoSugerida = texto.replace(numeros[0], '').replace('reais', '').replace('real', '').trim();
        if(descricaoSugerida) document.getElementById('masterInput').value = descricaoSugerida;
    }

    // 2. Definir Categoria por palavras-chave
    if (texto.includes('comer') || texto.includes('coxinha') || texto.includes('lanche') || texto.includes('ifood')) setCat('🍔');
    else if (texto.includes('mercado') || texto.includes('compras')) setCat('🛒');
    else if (texto.includes('casa') || texto.includes('aluguel') || texto.includes('luz')) setCat('🏠');
    else if (texto.includes('investir') || texto.includes('nubank')) setCat('🚀');
};

window.setCat = (cat) => {
    cAtual = cat;
    Swal.fire({ toast: true, position: 'top', timer: 1000, title: `Categoria: ${cat}`, showConfirmButton: false, background: '#111', color: '#fff' });
};

window.mudarTipo = (t) => {
    tAtual = t;
    document.getElementById('t-div').className = t === 'divida' ? 'text-[10px] px-6 py-2 rounded-lg bg-purple-600 font-black transition-all' : 'text-[10px] px-6 py-2 rounded-lg opacity-20 font-black transition-all';
    document.getElementById('t-gan').className = t === 'ganho' ? 'text-[10px] px-6 py-2 rounded-lg bg-purple-600 font-black transition-all' : 'text-[10px] px-6 py-2 rounded-lg opacity-20 font-black transition-all';
};

// --- AUTH ---
window.alternarAuth = () => {
    const b = document.getElementById('btnAuth');
    const t = document.getElementById('txtAuth');
    if (b.innerText === 'ENTRAR') {
        b.innerText = 'CRIAR ACESSO';
        t.innerText = 'VOLTAR AO LOGIN';
        document.getElementById('authTitle').innerText = 'Novo Registro';
    } else {
        b.innerText = 'ENTRAR';
        t.innerText = 'CRIAR NOVA CHAVE DE ACESSO';
        document.getElementById('authTitle').innerText = 'Identificação';
    }
};

window.executarAuth = () => {
    const e = document.getElementById('email').value.trim();
    const s = document.getElementById('senha').value.trim();
    const modo = document.getElementById('btnAuth').innerText;

    if (!e || !s) return Swal.fire('Ops!', 'Preencha os campos de acesso.', 'warning');

    if (modo === 'ENTRAR') {
        signInWithEmailAndPassword(auth, e, s).catch(() => Swal.fire('Erro', 'Acesso negado. Verifique os dados.', 'error'));
    } else {
        createUserWithEmailAndPassword(auth, e, s).catch(() => Swal.fire('Erro', 'Não foi possível criar esse acesso.', 'error'));
    }
};

window.sair = () => signOut(auth).then(() => location.reload());

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

// --- CORE ---
window.salvar = async () => {
    const n = document.getElementById('masterInput').value;
    const v = parseFloat(document.getElementById('valManual').value);
    const d = document.getElementById('dateManual').value || new Date().toISOString().split('T')[0];

    if(!n || isNaN(v)) return Swal.fire('Dados Inválidos', 'Informe a descrição e o valor.', 'info');

    try {
        await addDoc(collection(db, "fluxo"), { nome: n, valor: v, data: d, tipo: tAtual, categoria: cAtual, userId: userUID, ts: serverTimestamp() });
        document.getElementById('masterInput').value = '';
        document.getElementById('valManual').value = '';
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.7 }, colors: ['#a855f7', '#ffffff'] });
    } catch(e) {
        Swal.fire('Erro', 'Falha ao salvar no banco.', 'error');
    }
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
    const hp = r > 0 ? Math.min(100, Math.max(0, (saldo / r) * 100)) : (d > 0 ? 0 : 100);
    
    document.getElementById('saldoReal').innerText = fmt(saldo);
    document.getElementById('txtReceita').innerText = fmt(r);
    document.getElementById('txtDespesa').innerText = fmt(d);
    document.getElementById('txtPrevisto').innerText = fmt(r); 
    document.getElementById('hpFill').style.width = hp + '%';
    document.getElementById('hpPorcentagem').innerText = Math.round(hp) + '%';
    
    const status = document.getElementById('hpTexto');
    if (hp > 70) { status.innerText = 'EFICIENTE'; status.style.color = '#22c55e'; }
    else if (hp > 30) { status.innerText = 'MODERADO'; status.style.color = '#eab308'; }
    else { status.innerText = 'CRÍTICO'; status.style.color = '#ef4444'; }

    const feed = document.getElementById('feed');
    feed.innerHTML = '';
    lista.sort((a,b) => b.ts - a.ts).slice(0,10).forEach(i => {
        feed.innerHTML += `
            <div class="glass p-5 flex justify-between items-center border-r-2 ${i.tipo === 'ganho' ? 'border-emerald-500' : 'border-rose-500'} card-entry">
                <div class="flex items-center gap-4">
                    <span class="text-2xl opacity-80">${i.categoria || '💰'}</span>
                    <div><p class="text-[10px] font-black uppercase tracking-widest">${i.nome}</p><p class="text-[8px] opacity-30">${i.data}</p></div>
                </div>
                <div class="text-right">
                    <p class="money font-black ${i.tipo === 'ganho' ? 'text-emerald-400' : 'text-rose-400'}">${fmt(i.valor)}</p>
                    <button onclick="deletar('${i.id}')" class="text-[7px] opacity-20 hover:opacity-100 uppercase font-black text-rose-500 tracking-tighter">Deletar</button>
                </div>
            </div>`;
    });
}

window.deletar = async (id) => { if(confirm('Excluir este registro?')) await deleteDoc(doc(db, "fluxo", id)); };

window.nav = (id, btn) => {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('nav-active'));
    btn.classList.add('nav-active');
};
