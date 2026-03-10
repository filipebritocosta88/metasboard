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

let userUID = null, tipoAtual = 'divida', catAtual = '💸', chartInst = null;
let fin = { previsto: 0, saldoReal: 0, dividas: 0, lista: [] };

const BRL = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// --- SMART INPUT (INOVAÇÃO) ---
window.processarComando = (val) => {
    const partes = val.split(' ');
    const valorEncontrado = partes.find(p => !isNaN(p.replace(',', '.')) && p !== "");
    
    if (valorEncontrado) {
        document.getElementById('fValorManual').value = valorEncontrado.replace(',', '.');
    }

    // Auto-Categoria
    const texto = val.toLowerCase();
    if(texto.includes('mercado') || texto.includes('comida')) setCat('🛒');
    else if(texto.includes('aluguel') || texto.includes('luz') || texto.includes('casa')) setCat('🏠');
    else if(texto.includes('uber') || texto.includes('ifood') || texto.includes('lanche')) setCat('🍔');
    else if(texto.includes('invest') || texto.includes('nubank')) setCat('🚀');
};

// --- TUTORIAL ---
async function iniciarTutorial() {
    await Swal.fire({
        title: 'SISTEMA INICIALIZADO 🧠',
        text: 'Bem-vindo ao seu novo terminal. Menos cliques, mais velocidade.',
        confirmButtonText: 'VAMOS LÁ',
        confirmButtonColor: '#a855f7',
        background: '#0a0c14', color: '#fff'
    });
}

// --- PRIVACIDADE ---
window.toggleAnonimo = () => document.body.classList.toggle('blur-mode');

// --- AUTH ---
window.alternarModoAuth = () => {
    const btn = document.getElementById('btnAcessar');
    btn.innerText = btn.innerText === "Entrar no Terminal" ? "Criar Conta" : "Entrar no Terminal";
};

window.executarAuth = () => {
    const e = document.getElementById('email').value.trim();
    const s = document.getElementById('senha').value.trim();
    const modo = document.getElementById('btnAcessar').innerText;
    if(!e || !s) return;
    if(modo === "Criar Conta") {
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
        document.getElementById('dataHoje').innerText = new Date().toLocaleDateString('pt-br', {weekday:'long', day:'numeric'});
        iniciarRealtime(); 
        if(localStorage.getItem('novo_user_'+userUID)) {
            localStorage.removeItem('novo_user_'+userUID);
            setTimeout(iniciarTutorial, 1000);
        }
    } else { document.getElementById('loginTela').style.display = 'flex'; }
});

// --- ENGINE ---
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
        fin.previsto=p; fin.saldoReal=r-d; fin.dividas=d;
        atualizarUI();
    });
}

function atualizarUI() {
    document.getElementById('receitaTotal').innerText = BRL(fin.previsto);
    document.getElementById('saldoReal').innerText = BRL(fin.saldoReal);
    document.getElementById('despesaTotal').innerText = BRL(fin.dividas);
    const perc = Math.max(0, 100 - (fin.dividas / (fin.previsto || 1) * 100));
    document.getElementById('hpFill').style.width = perc + "%";
    document.getElementById('txtSaude').innerText = perc > 70 ? "SISTEMA ESTÁVEL" : "ALERTA DE CAIXA";
    
    const t = document.getElementById('listaTimeline'); t.innerHTML = "";
    fin.lista.sort((a,b) => new Date(b.data) - new Date(a.data)).slice(0, 8).forEach(i => {
        t.innerHTML += `<div class="glass-card p-4 flex justify-between border-l-4 ${i.tipo === 'ganho' ? 'border-emerald-500' : 'border-rose-500'}" onclick="abrirAcao('${i.id}')">
            <div class="flex items-center gap-3">
                <span class="text-xl">${i.categoria || '💸'}</span>
                <div><h4 class="text-[10px] font-black uppercase">${i.nome}</h4><p class="text-[8px] opacity-40">${i.data}</p></div>
            </div>
            <b class="money-val text-xs ${i.tipo === 'ganho' ? 'text-emerald-400' : 'text-rose-500'}">${BRL(i.valor)}</b>
        </div>`;
    });
}

window.salvarLancamento = async () => {
    const smart = document.getElementById('smartInput').value;
    const manualValor = document.getElementById('fValorManual').value;
    const data = document.getElementById('fData').value || new Date().toISOString().split('T')[0];
    
    if(smart && manualValor) {
        await addDoc(collection(db, "fluxo"), {
            nome: smart.split(' ')[0],
            valor: parseFloat(manualValor),
            data: data,
            tipo: tipoAtual,
            categoria: catAtual,
            userId: userUID,
            status: 'pendente'
        });
        document.getElementById('smartInput').value = "";
        document.getElementById('fValorManual').value = "";
        confetti({ particleCount: 50, spread: 60 });
    }
};

window.abrirAcao = async (id) => {
    const { value: a } = await Swal.fire({ title: 'Ação', input: 'select', inputOptions: { paga: '✅ Pago', del: '🗑️ Excluir' }, confirmButtonColor: '#a855f7' });
    if(a === 'paga') await updateDoc(doc(db, "fluxo", id), { status: 'paga' });
    else if(a === 'del') await deleteDoc(doc(db, "fluxo", id));
};

window.navegar = (id, btn) => {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-btn-m').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
};
