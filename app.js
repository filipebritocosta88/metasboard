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

let userUID = null, tAtual = 'divida', chart = null, globalItems = [];
const fmt = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// --- RECONHECIMENTO DE VOZ (MELHORADO) ---
const recognition = ('webkitSpeechRecognition' in window) ? new webkitSpeechRecognition() : null;
if (recognition) {
    recognition.lang = 'pt-BR';
    recognition.onresult = (e) => {
        const txt = e.results[0][0].transcript.toLowerCase();
        document.getElementById('masterInput').value = txt;
        // Regex para pegar números mesmo com "reais" ou vírgula
        const valMatch = txt.match(/(\d+([.,]\d+)?)/);
        if(valMatch) {
            document.getElementById('valManual').value = valMatch[0].replace(',', '.');
            document.getElementById('masterInput').value = txt.replace(valMatch[0], '').replace('reais', '').replace('real', '').trim();
        }
        document.getElementById('audioBtn').classList.remove('recording');
    };
}
window.toggleAudio = () => { recognition && recognition.start(); document.getElementById('audioBtn').classList.add('recording'); };

// --- NAVEGAÇÃO ---
window.nav = (id, btn) => {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('nav button').forEach(b => { b.classList.remove('nav-active'); b.classList.add('opacity-40'); });
    btn.classList.add('nav-active'); btn.classList.remove('opacity-40');
    if(id === 'secSimulador') initSimulador();
};

// --- AUTH ---
window.alternarAuth = () => { const b = document.getElementById('btnAuth'); b.innerText = b.innerText === 'ENTRAR NO SISTEMA' ? 'CRIAR NOVA CHAVE' : 'ENTRAR NO SISTEMA'; };
window.executarAuth = () => {
    const e = document.getElementById('email').value, s = document.getElementById('senha').value;
    if(document.getElementById('btnAuth').innerText === 'ENTRAR NO SISTEMA') signInWithEmailAndPassword(auth, e, s);
    else createUserWithEmailAndPassword(auth, e, s);
};
window.sair = () => signOut(auth).then(() => location.reload());

onAuthStateChanged(auth, u => {
    if(u) {
        userUID = u.uid;
        document.getElementById('loginTela').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        document.getElementById('dataRef').innerText = new Date().toLocaleDateString('pt-BR', {weekday:'long', day:'numeric', month:'long'});
        initData();
        initMetas();
        verificarSalario();
    }
});

// --- SALÁRIO NO 5º DIA ÚTIL ---
async function verificarSalario() {
    const snap = await getDoc(doc(db, "configs", userUID));
    if(snap.exists()) {
        const config = snap.data();
        document.getElementById('valSalario').value = config.salario || 0;
        const hoje = new Date(), ref = (hoje.getMonth()+1)+"/"+hoje.getFullYear();
        if(config.ultimoSalario !== ref && eQuintoDiaUtil(hoje)) {
            await addDoc(collection(db, "fluxo"), { nome: "DEPÓSITO SALARIAL", valor: config.salario, tipo: "ganho", data: hoje.toISOString().split('T')[0], userId: userUID, ts: serverTimestamp() });
            await updateDoc(doc(db, "configs", userUID), { ultimoSalario: ref });
        }
    }
}
function eQuintoDiaUtil(data) {
    let du = 0, d = new Date(data.getFullYear(), data.getMonth(), 1);
    while(du < 5) { let s = d.getDay(); if(s !== 0 && s !== 6) du++; if(du < 5) d.setDate(d.getDate()+1); }
    return data.getDate() === d.getDate();
}
window.salvarSalario = async () => {
    const v = parseFloat(document.getElementById('valSalario').value);
    await setDoc(doc(db, "configs", userUID), { salario: v, userId: userUID }, { merge: true });
    Swal.fire("Sistema Atualizado", "Salário fixado para o 5º dia útil.", "success");
};

// --- CORE ENGINE: REGISTROS E PARCELAS ---
document.getElementById('checkParcela').onchange = (e) => document.getElementById('numParcelas').classList.toggle('hidden', !e.target.checked);

window.salvar = async () => {
    const n = document.getElementById('masterInput').value, v = parseFloat(document.getElementById('valManual').value), 
          dStr = document.getElementById('dateManual').value || new Date().toISOString().split('T')[0];
    if(!n || isNaN(v)) return;

    if(document.getElementById('checkParcela').checked) {
        const p = parseInt(document.getElementById('numParcelas').value) || 1;
        const vPart = v / p;
        for(let i=0; i<p; i++) {
            let d = new Date(dStr + 'T12:00:00'); d.setMonth(d.getMonth() + i);
            await addDoc(collection(db, "fluxo"), { nome: `${n} (${i+1}/${p})`, valor: vPart, tipo: tAtual, data: d.toISOString().split('T')[0], userId: userUID, ts: serverTimestamp() });
        }
    } else {
        await addDoc(collection(db, "fluxo"), { nome: n, valor: v, tipo: tAtual, data: dStr, userId: userUID, ts: serverTimestamp() });
    }
    document.getElementById('masterInput').value = ''; document.getElementById('valManual').value = '';
    confetti({ particleCount: 40 });
};

function initData() {
    const filtro = document.getElementById('filtroMes').value; // YYYY-MM
    onSnapshot(query(collection(db, "fluxo"), where("userId", "==", userUID)), snap => {
        let carteira = 0, mesR = 0, mesD = 0, proxD = 0;
        const items = [], heatmap = {}, hoje = new Date(), mesSeg = new Date(); mesSeg.setMonth(hoje.getMonth()+1);
        
        snap.forEach(doc => {
            const i = doc.data(); const d = new Date(i.data + 'T12:00:00');
            // Cálculo Carteira (Tudo até hoje)
            if(d <= hoje) { if(i.tipo==='ganho') carteira += i.valor; else carteira -= i.valor; }
            // Cálculo Mês Atual
            if(d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear()) {
                if(i.tipo==='ganho') mesR += i.valor; else { mesD += i.valor; heatmap[d.getDate()] = (heatmap[d.getDate()]||0) + i.valor; }
            }
            // Mês Seguinte
            if(d.getMonth() === mesSeg.getMonth() && d.getFullYear() === mesSeg.getFullYear()) {
                if(i.tipo==='divida') proxD += i.valor;
            }
            items.push({...i, id: doc.id});
        });
        
        globalItems = items;
        updateUI(Math.max(0, carteira), mesR, mesD, proxD, items, heatmap, filtro);
    });
}

function updateUI(carteira, rMes, dMes, dProx, items, heatmap, filtro) {
    document.getElementById('saldoReal').innerText = fmt(carteira);
    document.getElementById('rendaMes').innerText = fmt(rMes);
    document.getElementById('gastoMes').innerText = fmt(dMes);
    document.getElementById('dividaProximoMes').innerText = fmt(dProx);
    document.getElementById('totalLivre').innerText = fmt(carteira + (rMes - dMes));
    
    // Filtro do Histórico
    const hist = document.getElementById('listaDividasFull'); hist.innerHTML = '';
    const itemsFiltrados = filtro ? items.filter(i => i.data.startsWith(filtro)) : items;
    
    itemsFiltrados.sort((a,b) => new Date(b.data) - new Date(a.data)).forEach(i => {
        hist.innerHTML += `<div class="bg-white/5 p-4 rounded-2xl flex justify-between items-center text-[10px]">
            <div><p class="font-bold opacity-80 uppercase">${i.nome}</p><p class="text-[8px] opacity-30">${i.data}</p></div>
            <div class="flex items-center gap-4"><b class="${i.tipo==='ganho'?'text-emerald-400':'text-rose-400'}">${fmt(i.valor)}</b>
            <button onclick="deletar('${i.id}')" class="text-rose-500 opacity-30">✕</button></div>
        </div>`;
    });

    // Feed Home (últimos 4)
    const feed = document.getElementById('feed'); feed.innerHTML = '';
    items.sort((a,b) => new Date(b.data) - new Date(a.data)).slice(0,4).forEach(i => {
        feed.innerHTML += `<div class="glass p-4 flex justify-between border-l-4 ${i.tipo==='ganho'?'border-emerald-500':'border-rose-500'}">
            <span class="text-[10px] uppercase font-black">${i.nome}</span>
            <b class="text-[10px] ${i.tipo==='ganho'?'text-emerald-400':'text-rose-400'}">${fmt(i.valor)}</b>
        </div>`;
    });

    renderHeatmap(heatmap);
}

window.deletar = async (id) => { if(confirm("Apagar permanentemente?")) await deleteDoc(doc(db, "fluxo", id)); };

// --- HEATMAP INTERATIVO ---
function renderHeatmap(data) {
    const h = document.getElementById('heatmap'); h.innerHTML = '';
    const max = Math.max(...Object.values(data), 1);
    for(let d=1; d<=31; d++) {
        const val = data[d] || 0;
        const color = val === 0 ? 'rgba(255,255,255,0.05)' : `rgba(239, 68, 68, ${0.3 + (val/max)*0.7})`;
        h.innerHTML += `<div class="heatmap-day" style="background: ${color}" onclick="detalharDia(${d})">${d}</div>`;
    }
}
window.detalharDia = (dia) => {
    const gastosDia = globalItems.filter(i => new Date(i.data + 'T12:00:00').getDate() === dia && i.tipo === 'divida');
    const txt = gastosDia.length > 0 ? gastosDia.map(g => `${g.nome}: ${fmt(g.valor)}`).join('\n') : "Nenhum gasto neste dia.";
    Swal.fire(`Dia ${dia}`, txt, "info");
};

// --- METAS COM EDIÇÃO ---
window.abrirModalMeta = async (id = null) => {
    let meta = { n: '', v: 0, t: 'hardware' };
    if(id) { meta = (await getDoc(doc(db, "metas", id))).data(); }

    const { value: f } = await Swal.fire({
        title: id ? 'Editar Meta' : 'Novo Sonho',
        html: `<input id="mn" class="swal2-input" placeholder="Nome" value="${meta.n}">
               <input id="mv" class="swal2-input" type="number" placeholder="Valor" value="${meta.v}">
               <select id="mt" class="swal2-input"><option value="hardware">Hardware</option><option value="veiculo">Veículo</option><option value="celular">Celular</option></select>`,
        showCancelButton: true,
        preConfirm: () => ({ n: document.getElementById('mn').value, v: parseFloat(document.getElementById('mv').value), t: document.getElementById('mt').value })
    });
    if(f && f.n) {
        if(id) await updateDoc(doc(db, "metas", id), f);
        else await addDoc(collection(db, "metas"), { ...f, pago: 0, submetas: [], userId: userUID, ts: serverTimestamp() });
    }
};

function initMetas() {
    onSnapshot(query(collection(db, "metas"), where("userId", "==", userUID)), snap => {
        const c = document.getElementById('listaMetas'); c.innerHTML = '';
        snap.forEach(doc => {
            const m = doc.data(); const pct = (m.pago / m.valorTotal) * 100;
            const dica = getDicaMentor(m.t, m.valorTotal);
            c.innerHTML += `<div class="glass p-6 space-y-4">
                <div class="flex justify-between">
                    <div><h4 class="font-orbitron text-[10px] text-purple-400">${m.n}</h4><p class="text-[8px] opacity-40">${fmt(m.valorTotal)}</p></div>
                    <div class="flex gap-3">
                        <button onclick="adicionarSub('${doc.id}')" class="text-xl">🧩</button>
                        <button onclick="abrirModalMeta('${doc.id}')" class="text-xl">✏️</button>
                        <button onclick="deletarMeta('${doc.id}')" class="text-xl text-rose-500">🗑️</button>
                    </div>
                </div>
                <div class="h-1.5 bg-white/5 rounded-full overflow-hidden"><div class="progress-fill" style="width: ${pct}%"></div></div>
                <p class="text-[9px] italic text-purple-300">🤖 ${dica}</p>
            </div>`;
        });
    });
}
window.deletarMeta = async (id) => { if(confirm("Excluir meta?")) await deleteDoc(doc(db, "metas", id)); };

function getDicaMentor(tipo, valor) {
    if(tipo === 'hardware') return valor > 5000 ? "Setup High-End: Sugiro focar em uma RTX 4070 para durar anos." : "Setup Entrada: Um Ryzen 5 5600G será seu melhor amigo aqui.";
    if(tipo === 'veiculo') return valor > 30000 ? "Carros seminovos como Polo ou HB20 estão com boa revenda." : "Motos Honda 160 são o padrão ouro para economia diária.";
    return "A estratégia é clara: Divida o valor por 12 e guarde essa meta por mês.";
}

// --- GPS & SIMULADOR REAL ---
async function initSimulador() {
    const invest = parseFloat(document.getElementById('inputInvest').value) || 0;
    const r = 0.01; // 1% ao mês fictício
    
    const sim = (meses) => invest * ((Math.pow(1 + r, meses) - 1) / r);
    
    document.getElementById('sim6').innerText = fmt(sim(6));
    document.getElementById('sim12').innerText = fmt(sim(12));
    document.getElementById('sim60').innerText = fmt(sim(60));

    const gps = document.getElementById('textoGPS');
    const score = document.getElementById('notaFinanceira');
    
    // Lógica de Score
    const lucro = document.getElementById('totalLivre').innerText.replace(/\D/g,'');
    if(lucro > 2000) { gps.innerText = "Caminho Imperial. Sua sobra financeira permite saltos maiores. Rota para independência ativa."; score.innerText = "Score: 9/10"; }
    else if(lucro > 500) { gps.innerText = "Rota Segura. Você está mantendo a altitude. Cuidado com gastos invisíveis no fim de semana."; score.innerText = "Score: 6/10"; }
    else { gps.innerText = "ALERTA DE TURBULÊNCIA. Sua margem de erro é zero. Recalculando rota para sobrevivência."; score.innerText = "Score: 3/10"; }
}
