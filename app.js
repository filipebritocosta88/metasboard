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

let userUID = null, tAtual = 'divida', cAtual = '💰', gInst = null;
const fmt = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// --- SMART ENGINE ---
window.ajudaInteligente = (val) => {
    const num = val.match(/\d+([.,]\d+)?/);
    if(num) document.getElementById('valManual').value = num[0].replace(',', '.');
    
    const t = val.toLowerCase();
    if(t.includes('mercado') || t.includes('comer')) setCat('🛒');
    else if(t.includes('casa') || t.includes('aluguel')) setCat('🏠');
    else if(t.includes('uber') || t.includes('ifood')) setCat('🍔');
    else if(t.includes('invest') || t.includes('guardar')) setCat('🚀');
};

window.setCat = (e) => {
    cAtual = e;
    Swal.fire({ toast: true, position: 'top-end', timer: 1000, showConfirmButton: false, title: `Categoria: ${e}`, background: '#111', color: '#fff' });
};

window.mudarTipo = (t) => {
    tAtual = t;
    document.getElementById('t-div').className = t === 'divida' ? 'text-[9px] px-3 py-1 rounded-md bg-purple-600 font-black' : 'text-[9px] px-3 py-1 rounded-md opacity-40 font-black';
    document.getElementById('t-gan').className = t === 'ganho' ? 'text-[9px] px-3 py-1 rounded-md bg-purple-600 font-black' : 'text-[9px] px-3 py-1 rounded-md opacity-40 font-black';
};

// --- CORE FUNCTIONS ---
window.salvar = async () => {
    const nome = document.getElementById('masterInput').value;
    const valor = parseFloat(document.getElementById('valManual').value);
    const data = document.getElementById('dateManual').value || new Date().toISOString().split('T')[0];

    if(!nome || !valor) return Swal.fire('Erro', 'Preencha o comando e o valor', 'error');

    await addDoc(collection(db, "fluxo"), {
        nome, valor, data, tipo: tAtual, categoria: cAtual, userId: userUID, status: 'ok'
    });

    document.getElementById('masterInput').value = '';
    document.getElementById('valManual').value = '';
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#a855f7', '#ffffff'] });
};

window.sair = () => signOut(auth).then(() => location.reload());

window.alternarAuth = () => {
    const b = document.getElementById('btnAuth');
    const t = document.getElementById('txtAuth');
    b.innerText = b.innerText === 'Inicializar' ? 'Criar Conta' : 'Inicializar';
    t.innerText = t.innerText === 'Novo por aqui? Criar ID' ? 'Já tenho ID? Acessar' : 'Novo por aqui? Criar ID';
};

window.executarAuth = () => {
    const e = document.getElementById('email').value;
    const s = document.getElementById('senha').value;
    if(document.getElementById('btnAuth').innerText === 'Inicializar') {
        signInWithEmailAndPassword(auth, e, s).catch(err => alert("Falha na inicialização"));
    } else {
        createUserWithEmailAndPassword(auth, e, s).catch(err => alert("Erro ao criar ID"));
    }
};

onAuthStateChanged(auth, u => {
    if(u) {
        userUID = u.uid;
        document.getElementById('loginTela').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        document.getElementById('dataRef').innerText = new Date().toLocaleDateString('pt-BR', {weekday:'long', day:'numeric', month:'long'});
        initData();
    } else {
        document.getElementById('loginTela').classList.remove('hidden');
    }
});

function initData() {
    onSnapshot(query(collection(db, "fluxo"), where("userId", "==", userUID)), snap => {
        let r=0, d=0; const lista = [];
        snap.forEach(doc => {
            const data = { ...doc.data(), id: doc.id };
            if(data.tipo === 'ganho') r += data.valor; else d += data.valor;
            lista.push(data);
        });
        updateUI(r, d, lista);
    });
}

function updateUI(r, d, lista) {
    const saldo = r - d;
    document.getElementById('saldoReal').innerText = fmt(saldo);
    document.getElementById('txtReceita').innerText = fmt(r);
    document.getElementById('txtDespesa').innerText = fmt(d);
    
    const hp = r > 0 ? Math.min(100, Math.max(0, (saldo / r) * 100)) : 0;
    document.getElementById('hpFill').style.width = hp + '%';
    document.getElementById('hpTexto').innerText = hp > 50 ? 'ESTÁVEL' : (hp > 20 ? 'ALERTA' : 'CRÍTICO');
    document.getElementById('hpTexto').className = `text-xl font-orbitron ${hp > 50 ? 'text-green-500' : (hp > 20 ? 'text-yellow-500' : 'text-red-500')}`;

    const feed = document.getElementById('feed');
    feed.innerHTML = '';
    lista.sort((a,b) => new Date(b.data) - new Date(a.data)).slice(0,10).forEach(i => {
        feed.innerHTML += `
            <div class="glass p-4 flex justify-between items-center border-r-4 ${i.tipo === 'ganho' ? 'border-emerald-500' : 'border-rose-500'}">
                <div class="flex items-center gap-3">
                    <span class="text-2xl">${i.categoria}</span>
                    <div><p class="text-[10px] font-black uppercase">${i.nome}</p><p class="text-[8px] opacity-30">${i.data}</p></div>
                </div>
                <div class="text-right">
                    <p class="money font-bold ${i.tipo === 'ganho' ? 'text-emerald-400' : 'text-rose-400'}">${fmt(i.valor)}</p>
                    <button onclick="deletar('${i.id}')" class="text-[7px] opacity-20 hover:opacity-100 uppercase font-bold">Remover</button>
                </div>
            </div>
        `;
    });
}

window.deletar = async (id) => {
    if(confirm('Apagar registro?')) await deleteDoc(doc(db, "fluxo", id));
};

window.nav = (id, btn) => {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('nav button').forEach(b => { b.classList.remove('nav-active'); b.classList.add('opacity-40'); });
    btn.classList.add('nav-active');
    btn.classList.remove('opacity-40');
};
