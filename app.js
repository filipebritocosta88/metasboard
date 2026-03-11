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

let userUID = null, tAtual = 'divida', chart = null;
const fmt = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// --- VOZ ---
const recognition = ('webkitSpeechRecognition' in window) ? new webkitSpeechRecognition() : null;
if (recognition) {
    recognition.lang = 'pt-BR';
    recognition.onresult = (e) => {
        const txt = e.results[0][0].transcript.toLowerCase();
        document.getElementById('masterInput').value = txt;
        const val = txt.match(/\d+([.,]\d+)?/);
        if(val) {
            document.getElementById('valManual').value = val[0].replace(',', '.');
            document.getElementById('masterInput').value = txt.replace(val[0], '').replace('reais', '').trim();
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
    if(id === 'secGestao') initChart();
    if(id === 'secSimulador') initSimulador();
};

// --- AUTH ---
window.alternarAuth = () => { const b = document.getElementById('btnAuth'); b.innerText = b.innerText === 'ENTRAR' ? 'CRIAR CONTA' : 'ENTRAR'; };
window.executarAuth = () => {
    const e = document.getElementById('email').value, s = document.getElementById('senha').value;
    if(document.getElementById('btnAuth').innerText === 'ENTRAR') signInWithEmailAndPassword(auth, e, s);
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

// --- GESTÃO DE SALÁRIO ---
async function verificarSalario() {
    const snap = await getDoc(doc(db, "configs", userUID));
    if(snap.exists()) {
        const config = snap.data();
        document.getElementById('valSalario').value = config.salario || 0;
        const hoje = new Date(), ref = (hoje.getMonth()+1)+"/"+hoje.getFullYear();
        if(config.ultimoSalario !== ref && eQuintoDiaUtil(hoje)) {
            await addDoc(collection(db, "fluxo"), { nome: "SALÁRIO AUTOMÁTICO", valor: config.salario, tipo: "ganho", data: hoje.toISOString().split('T')[0], userId: userUID, ts: serverTimestamp() });
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
    Swal.fire("OK", "Salário fixado!", "success");
};

// --- CORE: REGISTROS & PARCELAMENTO ---
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
    confetti({ particleCount: 50 });
};

function initData() {
    onSnapshot(query(collection(db, "fluxo"), where("userId", "==", userUID)), snap => {
        let totalR=0, totalD=0, mesR=0, mesD=0, proxD=0;
        const items = [], heatmapData = {}, hoje = new Date(), mesSeg = new Date(); mesSeg.setMonth(hoje.getMonth() + 1);
        
        snap.forEach(doc => {
            const i = doc.data(); const d = new Date(i.data + 'T12:00:00');
            if(i.tipo === 'ganho') totalR += i.valor; else totalD += i.valor;
            
            if(d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear()) {
                if(i.tipo === 'ganho') mesR += i.valor; else { mesD += i.valor; heatmapData[d.getDate()] = (heatmapData[d.getDate()] || 0) + i.valor; }
            }
            if(d.getMonth() === mesSeg.getMonth() && d.getFullYear() === mesSeg.getFullYear()) {
                if(i.tipo === 'divida') proxD += i.valor;
            }
            items.push({...i, id: doc.id});
        });
        updateUI(totalR - totalD, mesR, mesD, proxD, items, heatmapData);
    });
}

function updateUI(saldo, rMes, dMes, dProx, items, heatmap) {
    document.getElementById('saldoReal').innerText = fmt(saldo);
    document.getElementById('rendaMes').innerText = fmt(rMes);
    document.getElementById('gastoMes').innerText = fmt(dMes);
    document.getElementById('dividaProximoMes').innerText = fmt(dProx);
    document.getElementById('totalLivre').innerText = fmt(saldo - dMes);
    
    // Feed Home (últimos 5)
    const feed = document.getElementById('feed'); feed.innerHTML = '';
    items.sort((a,b) => new Date(b.data) - new Date(a.data)).slice(0,5).forEach(i => {
        feed.innerHTML += `<div class="glass p-4 flex justify-between border-l-2 ${i.tipo==='ganho'?'border-emerald-500':'border-rose-500'}">
            <div><p class="text-[9px] font-black uppercase">${i.nome}</p><p class="text-[7px] opacity-30">${i.data}</p></div>
            <p class="font-bold text-[10px] ${i.tipo==='ganho'?'text-emerald-400':'text-rose-400'}">${fmt(i.valor)}</p>
        </div>`;
    });

    // Histórico Gestão
    const hist = document.getElementById('listaDividasFull'); hist.innerHTML = '';
    items.forEach(i => {
        hist.innerHTML += `<div class="bg-white/5 p-3 rounded-xl flex justify-between items-center text-[9px]">
            <span>${i.data} - ${i.nome}</span>
            <div class="flex items-center gap-3"><b class="${i.tipo==='ganho'?'text-emerald-400':'text-rose-400'}">${fmt(i.valor)}</b>
            <button onclick="deletar('${i.id}')" class="text-rose-500 opacity-40">✕</button></div>
        </div>`;
    });

    renderHeatmap(heatmap);
}

window.deletar = async (id) => { if(confirm("Remover este registro?")) await deleteDoc(doc(db, "fluxo", id)); };

// --- MAPA DE CALOR ---
function renderHeatmap(data) {
    const h = document.getElementById('heatmap'); h.innerHTML = '';
    const max = Math.max(...Object.values(data), 1);
    for(let d=1; d<=31; d++) {
        const val = data[d] || 0;
        const intensity = val > 0 ? Math.min(1, val/max) : 0;
        const color = val === 0 ? 'rgba(255,255,255,0.05)' : `rgba(239, 68, 68, ${0.2 + intensity * 0.8})`;
        h.innerHTML += `<div class="heatmap-day" style="background: ${color}">${d}</div>`;
    }
}

// --- METAS & MENTOR ---
window.abrirModalMeta = async () => {
    const { value: f } = await Swal.fire({
        title: 'Novo Sonho',
        html: `<input id="mn" class="swal2-input" placeholder="O que deseja? (PC, Carro, etc)">
               <input id="mv" class="swal2-input" type="number" placeholder="Valor Estimado R$">
               <select id="mt" class="swal2-input"><option value="hardware">Computador/Hardware</option><option value="veiculo">Carro/Moto</option><option value="celular">Celular</option></select>`,
        preConfirm: () => ({ n: document.getElementById('mn').value, v: parseFloat(document.getElementById('mv').value), t: document.getElementById('mt').value })
    });
    if(f && f.n) await addDoc(collection(db, "metas"), { ...f, pago: 0, submetas: [], userId: userUID, ts: serverTimestamp() });
};

function initMetas() {
    onSnapshot(query(collection(db, "metas"), where("userId", "==", userUID)), snap => {
        const c = document.getElementById('listaMetas'); c.innerHTML = '';
        snap.forEach(doc => {
            const m = doc.data(); const pct = (m.pago / m.valorTotal) * 100;
            const dica = getDicaMentor(m.t, m.valorTotal);
            c.innerHTML += `<div class="glass p-6 space-y-4 meta-card">
                <div class="flex justify-between items-start">
                    <div><h4 class="font-orbitron text-[10px] text-purple-400 uppercase tracking-widest">${m.n}</h4><p class="text-[8px] opacity-40">Alvo: ${fmt(m.valorTotal)}</p></div>
                    <button onclick="adicionarSub('${doc.id}')" class="text-xl">🧩</button>
                </div>
                <div class="h-2 bg-white/5 rounded-full overflow-hidden"><div class="progress-fill" style="width: ${pct}%"></div></div>
                <p class="text-[9px] italic opacity-70 text-purple-300">🤖 Dica: ${dica}</p>
                <div class="space-y-1">${m.submetas.map(s => `<div class="flex justify-between text-[8px] bg-black/20 p-2 rounded-lg"><span>${s.n}</span><b>${fmt(s.v)}</b></div>`).join('')}</div>
            </div>`;
        });
    });
}

function getDicaMentor(tipo, valor) {
    if(tipo === 'hardware') {
        if(valor < 3000) return "Para este valor, recomendo um setup com Ryzen 5 5600G, focado em custo-benefício.";
        if(valor < 7000) return "Com este orçamento, já miramos em uma RTX 4060 Ti para rodar tudo no Ultra.";
        return "Setup High-End detectado! Considere a linha i9 ou Ryzen 9 com refrigeração líquida.";
    }
    if(tipo === 'veiculo') {
        if(valor < 15000) return "Nesta faixa, as motos Honda CG ou Yamaha Factor são rainhas da economia.";
        if(valor < 50000) return "Você pode buscar carros como Onix ou HB20 seminovos, muito confiáveis.";
        return "Orçamento para um carro Premium ou zero km. Pesquise SUVs com bom valor de revenda.";
    }
    return "Foque em guardar um valor fixo mensal para atingir este objetivo mais rápido!";
}

window.adicionarSub = async (id) => {
    const { value: f } = await Swal.fire({ title: 'Adicionar Peça', html: '<input id="sn" class="swal2-input" placeholder="Item"><input id="sv" class="swal2-input" type="number" placeholder="Valor">', preConfirm: () => ({ n: document.getElementById('sn').value, v: parseFloat(document.getElementById('sv').value) }) });
    if(f && f.n) {
        const docRef = doc(db, "metas", id), snap = await getDoc(docRef);
        const m = snap.data(); const novas = [...(m.submetas || []), f];
        await updateDoc(docRef, { submetas: novas, pago: m.pago + f.v });
        confetti({ particleCount: 100 });
    }
};

// --- SIMULADOR & GPS ---
async function initSimulador() {
    const snap = await getDocs(query(collection(db, "fluxo"), where("userId", "==", userUID)));
    let r=0, d=0; snap.forEach(doc => { const i = doc.data(); if(i.tipo==='ganho') r += i.valor; else d += i.valor; });
    const saldo = r - d;
    
    // Projeção simples (Saldo atual + (Lucro mensal estimado * meses))
    const lucroMensal = 500; // Valor base para simulação se não houver dados suficientes
    document.getElementById('sim6').innerText = fmt(saldo + (lucroMensal * 6));
    document.getElementById('sim12').innerText = fmt(saldo + (lucroMensal * 12));
    document.getElementById('sim60').innerText = fmt(saldo + (lucroMensal * 60));

    const gps = document.getElementById('textoGPS');
    if(saldo < 0) gps.innerText = "GPS Financeiro: Rota perigosa detectada. Recalculando... Sugiro cortar gastos variáveis imediatamente.";
    else gps.innerText = "GPS Financeiro: Caminho livre! Você está em rota de crescimento. Ótimo momento para acelerar suas metas.";
}

function initChart() {
    const ctx = document.getElementById('meuGrafico').getContext('2d');
    if(chart) chart.destroy();
    chart = new Chart(ctx, { type: 'line', data: { labels: ['S1', 'S2', 'S3', 'S4'], datasets: [{ data: [15, 40, 20, 50], borderColor: '#a855f7', tension: 0.4, fill: true, backgroundColor: 'rgba(168, 85, 247, 0.1)' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { display: false }, x: { grid: { display: false }, ticks: { color: '#ffffff20' } } } } });
}

window.mudarTipo = (t) => {
    tAtual = t;
    document.getElementById('t-div').className = t === 'divida' ? 'text-[9px] px-5 py-2 rounded-lg bg-purple-600 font-black' : 'text-[9px] px-5 py-2 rounded-lg opacity-20 font-black';
    document.getElementById('t-gan').className = t === 'ganho' ? 'text-[9px] px-5 py-2 rounded-lg bg-purple-600 font-black' : 'text-[9px] px-5 py-2 rounded-lg opacity-20 font-black';
};
