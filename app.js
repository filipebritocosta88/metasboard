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
    recognition.continuous = false;
    recognition.onresult = (e) => {
        const result = e.results[0][0].transcript;
        document.getElementById('masterInput').value = result;
        window.ajudaInteligente(result);
        document.getElementById('audioBtn').classList.remove('recording');
        Swal.fire({ toast: true, position: 'top', timer: 2000, title: "Voz processada!", icon: 'success', showConfirmButton: false });
    };
    recognition.onerror = () => document.getElementById('audioBtn').classList.remove('recording');
    recognition.onend = () => document.getElementById('audioBtn').classList.remove('recording');
}

window.toggleAudio = () => {
    if (!recognition) return Swal.fire("Erro", "Navegador não suporta voz.", "error");
    const btn = document.getElementById('audioBtn');
    if (btn.classList.contains('recording')) {
        recognition.stop();
    } else {
        btn.classList.add('recording');
        recognition.start();
    }
};

// --- LÓGICA DE INPUT INTELIGENTE ---
window.ajudaInteligente = (val) => {
    // Extrai números (valores) da frase
    const num = val.match(/\d+([.,]\d+)?/);
    if(num) document.getElementById('valManual').value = num[0].replace(',', '.');
    
    // Identifica categoria por palavras-chave
    const t = val.toLowerCase();
    if(t.includes('mercado') || t.includes('compras') || t.includes('feira')) setCat('🛒');
    else if(t.includes('lanche') || t.includes('comer') || t.includes('ifood') || t.includes('restaurante')) setCat('🍔');
    else if(t.includes('casa') || t.includes('aluguel') || t.includes('luz') || t.includes('agua')) setCat('🏠');
    else if(t.includes('investir') || t.includes('poupanca') || t.includes('guardar')) setCat('🚀');
    else if(t.includes('cartao') || t.includes('banco') || t.includes('nubank')) setCat('💳');
};

window.setCat = (e) => {
    cAtual = e;
    const btns = document.querySelectorAll('#cats button');
    btns.forEach(b => b.classList.add('grayscale'));
    // Feedback visual simples ao selecionar
    Swal.fire({ toast: true, position: 'top', timer: 1000, showConfirmButton: false, title: `Categoria: ${e}`, background: '#111', color: '#fff' });
};

window.mudarTipo = (t) => {
    tAtual = t;
    document.getElementById('t-div').className = t === 'divida' ? 'text-[9px] px-4 py-1 rounded-md bg-purple-600 font-black' : 'text-[9px] px-4 py-1 rounded-md opacity-40 font-black';
    document.getElementById('t-gan').className = t === 'ganho' ? 'text-[9px] px-4 py-1 rounded-md bg-purple-600 font-black' : 'text-[9px] px-4 py-1 rounded-md opacity-40 font-black';
};

// --- AUTENTICAÇÃO CORRIGIDA ---
window.alternarAuth = () => {
    const b = document.getElementById('btnAuth');
    const t = document.getElementById('txtAuth');
    if (b.innerText === 'Acessar Terminal') {
        b.innerText = 'Criar Conta';
        t.innerText = 'Já tenho ID? Acessar';
    } else {
        b.innerText = 'Acessar Terminal';
        t.innerText = 'Novo por aqui? Criar ID';
    }
};

window.executarAuth = () => {
    const e = document.getElementById('email').value.trim();
    const s = document.getElementById('senha').value.trim();
    const modo = document.getElementById('btnAuth').innerText;

    if(!e || !s) return Swal.fire('Atenção', 'Preencha todos os campos.', 'warning');

    if(modo === 'Acessar Terminal') {
        signInWithEmailAndPassword(auth, e, s).catch(err => {
            Swal.fire('Erro no Login', 'Verifique sua senha e e-mail.', 'error');
        });
    } else {
        createUserWithEmailAndPassword(auth, e, s).then(() => {
            Swal.fire('Bem-vindo!', 'Sua conta foi criada com sucesso.', 'success');
        }).catch(err => {
            Swal.fire('Erro no Cadastro', 'Este e-mail já está em uso ou é inválido.', 'error');
        });
    }
};

window.sair = () => signOut(auth).then(() => location.reload());

onAuthStateChanged(auth, u => {
    if(u) {
        userUID = u.uid;
        document.getElementById('loginTela').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        document.getElementById('dataRef').innerText = new Date().toLocaleDateString('pt-BR', {weekday:'long', day:'numeric', month:'long'});
        initData();
    } else {
        document.getElementById('loginTela').classList.remove('hidden');
        document.getElementById('app').classList.add('hidden');
    }
});

// --- OPERAÇÕES DE DADOS ---
window.salvar = async () => {
    const nome = document.getElementById('masterInput').value;
    const valor = parseFloat(document.getElementById('valManual').value);
    const data = document.getElementById('dateManual').value || new Date().toISOString().split('T')[0];

    if(!nome || isNaN(valor)) return Swal.fire('Campos Vazios', 'Preencha a descrição e o valor.', 'info');

    try {
        await addDoc(collection(db, "fluxo"), {
            nome, valor, data, tipo: tAtual, categoria: cAtual, userId: userUID, timestamp: serverTimestamp()
        });
        document.getElementById('masterInput').value = '';
        document.getElementById('valManual').value = '';
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#a855f7', '#ffffff'] });
    } catch (e) {
        Swal.fire('Erro', 'Não foi possível salvar os dados.', 'error');
    }
};

function initData() {
    const q = query(collection(db, "fluxo"), where("userId", "==", userUID));
    onSnapshot(q, snap => {
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
    const hpFill = document.getElementById('hpFill');
    hpFill.style.width = hp + '%';
    
    const status = document.getElementById('hpTexto');
    if(hp > 60) { status.innerText = 'EXCELENTE'; status.className = 'text-xl font-orbitron text-green-500'; }
    else if(hp > 25) { status.innerText = 'ALERTA'; status.className = 'text-xl font-orbitron text-yellow-500'; }
    else { status.innerText = 'CRÍTICO'; status.className = 'text-xl font-orbitron text-red-500'; }

    const feed = document.getElementById('feed');
    feed.innerHTML = '';
    lista.sort((a,b) => new Date(b.data) - new Date(a.data)).slice(0,10).forEach(i => {
        feed.innerHTML += `
            <div class="glass p-4 flex justify-between items-center border-r-4 ${i.tipo === 'ganho' ? 'border-emerald-500' : 'border-rose-500'} animate-in">
                <div class="flex items-center gap-3">
                    <span class="text-2xl">${i.categoria || '💰'}</span>
                    <div>
                        <p class="text-[10px] font-black uppercase">${i.nome}</p>
                        <p class="text-[8px] opacity-30">${i.data}</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="money font-bold ${i.tipo === 'ganho' ? 'text-emerald-400' : 'text-rose-400'}">${fmt(i.valor)}</p>
                    <button onclick="deletar('${i.id}')" class="text-[7px] opacity-20 hover:opacity-100 uppercase font-bold text-rose-500">Excluir</button>
                </div>
            </div>`;
    });
}

window.deletar = async (id) => {
    const result = await Swal.fire({
        title: 'Excluir registro?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#a855f7',
        cancelButtonColor: '#333',
        confirmButtonText: 'Sim',
        background: '#111', color: '#fff'
    });
    if(result.isConfirmed) await deleteDoc(doc(db, "fluxo", id));
};

window.nav = (id, btn) => {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('nav button').forEach(b => { b.classList.remove('nav-active'); b.classList.add('opacity-40'); });
    btn.classList.add('nav-active');
};
