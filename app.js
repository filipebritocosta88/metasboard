import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc, serverTimestamp, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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

let userUID = null, tAtual = 'divida', chart = null;
const fmt = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// --- COMANDO DE VOZ REFINADO ---
const recognition = ('webkitSpeechRecognition' in window) ? new webkitSpeechRecognition() : null;
if (recognition) {
    recognition.lang = 'pt-BR';
    recognition.onresult = (e) => {
        const txt = e.results[0][0].transcript.toLowerCase();
        document.getElementById('masterInput').value = txt;
        
        // Extração Inteligente: "Coxinha 20 reais"
        const valorMatch = txt.match(/\d+([.,]\d+)?/);
        if(valorMatch) {
            document.getElementById('valManual').value = valorMatch[0].replace(',', '.');
            const desc = txt.replace(valorMatch[0], '').replace('reais', '').replace('real', '').trim();
            document.getElementById('masterInput').value = desc;
        }
        document.getElementById('audioBtn').classList.remove('recording');
    };
}

window.toggleAudio = () => {
    if (!recognition) return alert("Voz não suportada");
    document.getElementById('audioBtn').classList.add('recording');
    recognition.start();
};

// --- NAVEGAÇÃO ---
window.nav = (id, btn) => {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('nav-active'));
    btn.classList.add('nav-active');
    if(id === 'secGestao') initChart();
};

// --- AUTENTICAÇÃO ---
window.alternarAuth = () => {
    const b = document.getElementById('btnAuth');
    b.innerText = b.innerText === 'ENTRAR' ? 'CRIAR CONTA' : 'ENTRAR';
};

window.executarAuth = () => {
    const e = document.getElementById('email').value;
    const s = document.getElementById('senha').value;
    const modo = document.getElementById('btnAuth').innerText;
    if(modo === 'ENTRAR') signInWithEmailAndPassword(auth, e, s);
    else createUserWithEmailAndPassword(auth, e, s);
};

window.sair = () => signOut(auth).then(() => location.reload());

onAuthStateChanged(auth, u => {
    if(u) {
        userUID = u.uid;
        document.getElementById('loginTela').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        document.getElementById('dataRef').innerText = new Date().toLocaleDateString('pt-BR', {weekday:'long', day:'numeric', month:'long'});
        processarSalarioAgendado();
        initData();
        initMetas();
    }
});

// --- LÓGICA DE SALÁRIO (5º DIA ÚTIL) ---
async function processarSalarioAgendado() {
    const docRef = doc(db, "configs", userUID);
    const snap = await getDocs(query(collection(db, "configs"), where("userId", "==", userUID)));
    
    let config = { valorSalario: 0, ultimoMesPago: "" };
    snap.forEach(d => config = d.data());

    const hoje = new Date();
    const mesAtual = (hoje.getMonth() + 1) + "/" + hoje.getFullYear();
    
    if (config.ultimoMesPago !== mesAtual && eQuintoDiaUtil(hoje)) {
        await addDoc(collection(db, "fluxo"), {
            nome: "SALÁRIO MENSAL (Automático)",
            valor: config.valorSalario,
            tipo: "ganho",
            data: hoje.toISOString().split('T')[0],
            userId: userUID,
            ts: serverTimestamp()
        });
        // Atualiza que já pagou esse mês
        const configDoc = doc(db, "configs", snap.docs[0].id);
        await updateDoc(configDoc, { ultimoMesPago: mesAtual });
    }
    document.getElementById('txtProximoSalario').innerText = fmt(config.valorSalario || 0);
}

function eQuintoDiaUtil(data) {
    let diasUteis = 0;
    let d = new Date(data.getFullYear(), data.getMonth(), 1);
    while (diasUteis < 5) {
        let diaSemana = d.getDay();
        if (diaSemana !== 0 && diaSemana !== 6) diasUteis++;
        if (diasUteis < 5) d.setDate(d.getDate() + 1);
    }
    return data.getDate() === d.getDate();
}

window.configurarSalario = async () => {
    const val = parseFloat(document.getElementById('inputSalarioBase').value);
    const snap = await getDocs(query(collection(db, "configs"), where("userId", "==", userUID)));
    if(snap.empty) {
        await addDoc(collection(db, "configs"), { userId: userUID, valorSalario: val, ultimoMesPago: "" });
    } else {
        await updateDoc(doc(db, "configs", snap.docs[0].id), { valorSalario: val });
    }
    Swal.fire("Sucesso", "Salário atualizado!", "success");
};

// --- GESTÃO DE METAS (Meta dentro de Meta) ---
window.abrirModalMeta = async () => {
    const { value: formValues } = await Swal.fire({
        title: 'Nova Meta Estratégica',
        html: '<input id="swal-n" class="swal2-input" placeholder="Nome da Meta">' +
              '<input id="swal-v" class="swal2-input" type="number" placeholder="Valor Total">',
        focusConfirm: false,
        preConfirm: () => [document.getElementById('swal-n').value, document.getElementById('swal-v').value]
    });
    if(formValues) {
        await addDoc(collection(db, "metas"), {
            nome: formValues[0],
            valorTotal: parseFloat(formValues[1]),
            pago: 0,
            userId: userUID,
            submetas: []
        });
    }
};

function initMetas() {
    onSnapshot(query(collection(db, "metas"), where("userId", "==", userUID)), snap => {
        const container = document.getElementById('listaMetas');
        container.innerHTML = '';
        snap.forEach(d => {
            const meta = d.data();
            const pct = (meta.pago / meta.valorTotal) * 100;
            container.innerHTML += `
                <div class="glass p-5 space-y-3">
                    <div class="flex justify-between items-start">
                        <div>
                            <p class="text-xs font-black uppercase">${meta.nome}</p>
                            <p class="text-[10px] opacity-40">${fmt(meta.pago)} de ${fmt(meta.valorTotal)}</p>
                        </div>
                        <div class="flex gap-2">
                             <button onclick="adicionarSubmeta('${d.id}')" class="text-[15px]">➕</button>
                             <button onclick="excluirMeta('${d.id}')" class="text-[15px]">🗑️</button>
                        </div>
                    </div>
                    <div class="progress-bg"><div class="progress-fill" style="width: ${pct}%"></div></div>
                    <div id="subs-${d.id}" class="pl-4 border-l border-white/10 space-y-2">
                        ${meta.submetas.map(s => `<div class="flex justify-between text-[9px] opacity-60"><span>${s.n}</span><span>${fmt(s.v)}</span></div>`).join('')}
                    </div>
                </div>`;
        });
    });
}

window.adicionarSubmeta = async (id) => {
    const { value: form } = await Swal.fire({
        title: 'Adicionar Item',
        html: '<input id="sub-n" class="swal2-input" placeholder="Ex: Placa de Vídeo">' +
              '<input id="sub-v" class="swal2-input" type="number" placeholder="Valor">',
        preConfirm: () => ({ n: document.getElementById('sub-n').value, v: parseFloat(document.getElementById('sub-v').value) })
    });
    if(form) {
        const docRef = doc(db, "metas", id);
        const snap = await getDocs(query(collection(db, "metas"), where("__name__", "==", id)));
        const meta = snap.docs[0].data();
        const novasSub = [...meta.submetas, form];
        await updateDoc(docRef, { submetas: novasSub, pago: meta.pago + form.v });
    }
};

window.excluirMeta = async (id) => { if(confirm("Excluir meta?")) await deleteDoc(doc(db, "metas", id)); };

// --- ENGINE PRINCIPAL ---
window.salvar = async () => {
    const n = document.getElementById('masterInput').value;
    const v = parseFloat(document.getElementById('valManual').value);
    if(!n || !v) return;
    await addDoc(collection(db, "fluxo"), {
        nome: n, valor: v, data: document.getElementById('dateManual').value || new Date().toISOString().split('T')[0],
        tipo: tAtual, userId: userUID, ts: serverTimestamp()
    });
    document.getElementById('masterInput').value = '';
    document.getElementById('valManual').value = '';
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
};

function initData() {
    onSnapshot(query(collection(db, "fluxo"), where("userId", "==", userUID)), snap => {
        let r=0, d=0; const items = [];
        snap.forEach(doc => {
            const item = doc.data();
            if(item.tipo === 'ganho') r += item.valor; else d += item.valor;
            items.push({...item, id: doc.id});
        });
        updateUI(r, d, items);
    });
}

function updateUI(r, d, items) {
    const saldo = r - d;
    document.getElementById('saldoReal').innerText = fmt(saldo);
    document.getElementById('hpFill').style.width = Math.min(100, (saldo/r)*100) + '%';
    
    const feed = document.getElementById('feed');
    feed.innerHTML = '';
    items.sort((a,b) => b.ts - a.ts).slice(0,5).forEach(i => {
        feed.innerHTML += `
            <div class="glass p-4 flex justify-between items-center border-l-4 ${i.tipo==='ganho'?'border-emerald-500':'border-rose-500'}">
                <div><p class="text-[10px] font-black uppercase">${i.nome}</p><p class="text-[8px] opacity-30">${i.data}</p></div>
                <p class="money font-bold ${i.tipo==='ganho'?'text-emerald-400':'text-rose-400'}">${fmt(i.valor)}</p>
            </div>`;
    });

    // Mentor
    const mentor = document.getElementById('textoMentor');
    if(saldo < 0) mentor.innerText = "Cuidado! Suas saídas superaram as entradas. Evite compras parceladas este mês.";
    else if(saldo > r * 0.3) mentor.innerText = "Excelente! Você está poupando 30% da renda. Que tal acelerar uma de suas metas?";
    else mentor.innerText = "Seu fluxo está equilibrado, mas tente reduzir gastos pequenos para sobrar mais para o seu PC.";
}

function initChart() {
    const ctx = document.getElementById('meuGrafico').getContext('2d');
    if(chart) chart.destroy();
    chart = new Chart(ctx, {
        type: 'line',
        data: { labels: ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'], datasets: [{ label: 'Fluxo R$', data: [1200, 1900, 3000, 2500], borderColor: '#a855f7', tension: 0.4 }] },
        options: { plugins: { legend: { display: false } }, scales: { y: { display: false }, x: { grid: { display: false } } } }
    });
}

window.mudarTipo = (t) => {
    tAtual = t;
    document.getElementById('t-div').className = t === 'divida' ? 'text-[9px] px-4 py-1.5 rounded-md bg-purple-600 font-black' : 'text-[9px] px-4 py-1.5 rounded-md opacity-30 font-black';
    document.getElementById('t-gan').className = t === 'ganho' ? 'text-[9px] px-4 py-1.5 rounded-md bg-purple-600 font-black' : 'text-[9px] px-4 py-1.5 rounded-md opacity-30 font-black';
};
