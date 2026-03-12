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

let userUID = null, tAtual = 'divida', globalItems = [];
let calorOffset = 0; // Mês atual
const fmt = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// --- RECONHECIMENTO DE VOZ ---
const recognition = ('webkitSpeechRecognition' in window) ? new webkitSpeechRecognition() : null;
if (recognition) {
    recognition.lang = 'pt-BR';
    recognition.onresult = (e) => {
        const txt = e.results[0][0].transcript.toLowerCase();
        document.getElementById('masterInput').value = txt;
        const valMatch = txt.match(/(\d+([.,]\d+)?)/);
        if(valMatch) {
            document.getElementById('valManual').value = valMatch[0].replace(',', '.');
            document.getElementById('masterInput').value = txt.replace(valMatch[0], '').replace('reais', '').replace('real', '').trim();
        }
        document.getElementById('audioBtn').classList.remove('bg-red-500');
    };
}
window.toggleAudio = () => { recognition && recognition.start(); document.getElementById('audioBtn').classList.add('bg-red-500'); };

// --- NAVEGAÇÃO ---
window.nav = (id, btn) => {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('nav button').forEach(b => { b.classList.remove('nav-active'); b.classList.add('opacity-40'); });
    btn.classList.add('nav-active'); btn.classList.remove('opacity-40');
    if(id === 'secSimulador') renderCalor();
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

// --- GESTÃO SALARIAL ---
async function verificarSalario() {
    const snap = await getDoc(doc(db, "configs", userUID));
    const container = document.getElementById('statusSalario');
    if(snap.exists()) {
        const config = snap.data();
        container.innerHTML = `
            <div class="flex justify-between items-center bg-white/5 p-4 rounded-xl">
                <div><p class="text-[10px] font-black">${fmt(config.salario)}</p><p class="text-[7px] opacity-30">Todo 5º Dia Útil</p></div>
                <div class="flex gap-2">
                    <button onclick="editarSalario(${config.salario})" class="text-[10px] text-purple-400">EDITAR</button>
                    <button onclick="removerSalario()" class="text-[10px] text-rose-500">REMOVER</button>
                </div>
            </div>`;
        
        // Lógica de depósito automático
        const hoje = new Date(), ref = (hoje.getMonth()+1)+"/"+hoje.getFullYear();
        if(config.ultimoSalario !== ref && eQuintoDiaUtil(hoje)) {
            await addDoc(collection(db, "fluxo"), { nome: "SALÁRIO", valor: config.salario, tipo: "ganho", data: hoje.toISOString().split('T')[0], userId: userUID });
            await updateDoc(doc(db, "configs", userUID), { ultimoSalario: ref });
        }
    } else {
        container.innerHTML = `<input id="valSal" type="number" placeholder="Valor Salário" class="w-full mb-2"><button onclick="salvarSalario()" class="btn-main w-full py-2 text-[9px]">FIXAR SALÁRIO</button>`;
    }
}
window.salvarSalario = async () => {
    const v = parseFloat(document.getElementById('valSal').value);
    if(v) await setDoc(doc(db, "configs", userUID), { salario: v, userId: userUID }, { merge: true });
    verificarSalario();
};
window.removerSalario = async () => { if(confirm("Remover salário fixo?")) { await deleteDoc(doc(db, "configs", userUID)); verificarSalario(); } };
window.editarSalario = (v) => { document.getElementById('statusSalario').innerHTML = `<input id="valSal" type="number" value="${v}" class="w-full mb-2"><button onclick="salvarSalario()" class="btn-main w-full py-2 text-[9px]">ATUALIZAR</button>`; };

function eQuintoDiaUtil(data) {
    let du = 0, d = new Date(data.getFullYear(), data.getMonth(), 1);
    while(du < 5) { let s = d.getDay(); if(s !== 0 && s !== 6) du++; if(du < 5) d.setDate(d.getDate()+1); }
    return data.getDate() === d.getDate();
}

// --- CORE: REGISTROS E CALCULOS ---
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
            await addDoc(collection(db, "fluxo"), { nome: `${n} (${i+1}/${p})`, valor: vPart, tipo: tAtual, data: d.toISOString().split('T')[0], userId: userUID });
        }
    } else {
        await addDoc(collection(db, "fluxo"), { nome: n, valor: v, tipo: tAtual, data: dStr, userId: userUID });
    }
    document.getElementById('masterInput').value = ''; document.getElementById('valManual').value = '';
};

function initData() {
    onSnapshot(query(collection(db, "fluxo"), where("userId", "==", userUID)), snap => {
        let carteira = 0, rMesHoje = 0, gMesHoje = 0, rMesTotal = 0, gMesTotal = 0, rProx = 0, gProx = 0;
        const items = [], hoje = new Date(), proxMes = new Date(); proxMes.setMonth(hoje.getMonth()+1);
        
        snap.forEach(doc => {
            const i = doc.data(); const d = new Date(i.data + 'T12:00:00');
            // Carteira (Tudo até agora)
            if(d <= hoje) { if(i.tipo==='ganho') carteira += i.valor; else carteira -= i.valor; }
            
            // Mês Atual
            if(d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear()) {
                if(i.tipo==='ganho') { rMesTotal += i.valor; if(d <= hoje) rMesHoje += i.valor; }
                else { gMesTotal += i.valor; if(d <= hoje) gMesHoje += i.valor; }
            }
            
            // Próximo Mês
            if(d.getMonth() === proxMes.getMonth() && d.getFullYear() === proxMes.getFullYear()) {
                if(i.tipo==='ganho') rProx += i.valor; else gProx += i.valor;
            }
            items.push({...i, id: doc.id});
        });
        
        globalItems = items;
        updateUI(carteira, rMesHoje, gMesHoje, rMesTotal, gMesTotal, rProx, gProx, items);
    });
}

function updateUI(carteira, rH, gH, rT, gT, rP, gP, items) {
    document.getElementById('saldoReal').innerText = fmt(Math.max(0, carteira));
    document.getElementById('rendaMes').innerText = fmt(rH);
    document.getElementById('gastoMes').innerText = fmt(gH);
    document.getElementById('saldoPrevisto').innerText = fmt(carteira + (rT - rH) - (gT - gH));
    document.getElementById('resumoProxMes').innerText = fmt(rP - gP);
    
    // Histórico Gestão
    const f = document.getElementById('filtroMes').value;
    const hist = document.getElementById('listaDividasFull'); hist.innerHTML = '';
    items.filter(i => !f || i.data.startsWith(f)).sort((a,b) => new Date(b.data) - new Date(a.data)).forEach(i => {
        hist.innerHTML += `<div class="bg-white/5 p-4 rounded-xl flex justify-between items-center text-[10px]">
            <div><p class="font-bold">${i.nome}</p><p class="text-[8px] opacity-30">${i.data}</p></div>
            <div class="flex items-center gap-4"><b class="${i.tipo==='ganho'?'text-emerald-400':'text-rose-400'}">${fmt(i.valor)}</b>
            <button onclick="deletarItem('${i.id}')" class="text-rose-500 opacity-30">✕</button></div>
        </div>`;
    });

    // Feed Home
    const feed = document.getElementById('feed'); feed.innerHTML = '';
    items.sort((a,b) => new Date(b.data) - new Date(a.data)).slice(0,5).forEach(i => {
        feed.innerHTML += `<div class="glass p-4 flex justify-between items-center">
            <span class="text-[10px] font-black uppercase">${i.nome}</span>
            <b class="text-[10px] ${i.tipo==='ganho'?'text-emerald-400':'text-rose-400'}">${fmt(i.valor)}</b>
        </div>`;
    });
    renderCalor();
}
window.deletarItem = async (id) => await deleteDoc(doc(db, "fluxo", id));

// --- METAS ---
window.abrirModalMeta = async (id = null) => {
    let m = { n: '', v: '', t: 'hardware' };
    if(id) m = (await getDoc(doc(db, "metas", id))).data();
    
    const { value: f } = await Swal.fire({
        title: id ? 'Editar Meta' : 'Novo Objetivo',
        html: `<div class="flex flex-col gap-4">
                <input id="mn" class="swal2-input" placeholder="Ex: PC Gamer" value="${m.n}">
                <input id="mv" class="swal2-input" type="number" placeholder="Valor R$" value="${m.v}">
                <select id="mt" class="swal2-input"><option value="hardware">Hardware</option><option value="veiculo">Veículo</option><option value="celular">Celular</option></select>
               </div>`,
        preConfirm: () => ({ n: document.getElementById('mn').value, v: parseFloat(document.getElementById('mv').value), t: document.getElementById('mt').value })
    });
    if(f && f.n) {
        if(id) await updateDoc(doc(db, "metas", id), f);
        else await addDoc(collection(db, "metas"), { ...f, pago: 0, submetas: [], userId: userUID });
    }
};

function initMetas() {
    onSnapshot(query(collection(db, "metas"), where("userId", "==", userUID)), snap => {
        const c = document.getElementById('listaMetas'); c.innerHTML = '';
        snap.forEach(doc => {
            const m = doc.data(); const pct = (m.pago / m.v) * 100;
            c.innerHTML += `<div class="glass p-6 space-y-4">
                <div class="flex justify-between">
                    <div><h4 class="font-orbitron text-[10px] text-purple-400">${m.n}</h4><p class="text-[8px] opacity-40">ALVO: ${fmt(m.v)}</p></div>
                    <div class="flex gap-4">
                        <button onclick="adicionarSub('${doc.id}')" class="text-xl">🧩</button>
                        <button onclick="abrirModalMeta('${doc.id}')" class="text-xl">✏️</button>
                        <button onclick="deletarMeta('${doc.id}')" class="text-xl text-rose-500">🗑️</button>
                    </div>
                </div>
                <div class="h-1.5 bg-white/5 rounded-full overflow-hidden"><div class="progress-fill h-full bg-purple-500" style="width: ${pct}%"></div></div>
                <p class="text-[9px] italic opacity-60">🤖 Dica: Guarde ${fmt(m.v / 12)} por mês para realizar em 1 ano.</p>
            </div>`;
        });
    });
}
window.deletarMeta = async (id) => await deleteDoc(doc(db, "metas", id));

// --- FUTURO & CALOR ---
window.mudarMesCalor = (n) => { calorOffset += n; renderCalor(); };
function renderCalor() {
    const dRef = new Date(); dRef.setMonth(dRef.getMonth() + calorOffset);
    document.getElementById('calorDataRef').innerText = dRef.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
    
    const heatmap = document.getElementById('heatmap'); heatmap.innerHTML = '';
    const diasNoMes = new Date(dRef.getFullYear(), dRef.getMonth() + 1, 0).getDate();
    
    const gastosMes = globalItems.filter(i => {
        const d = new Date(i.data + 'T12:00:00');
        return d.getMonth() === dRef.getMonth() && d.getFullYear() === dRef.getFullYear() && i.tipo === 'divida';
    });

    for(let d=1; d<=diasNoMes; d++) {
        const totalDia = gastosMes.filter(i => new Date(i.data + 'T12:00:00').getDate() === d).reduce((acc, curr) => acc + curr.valor, 0);
        const color = totalDia === 0 ? 'rgba(255,255,255,0.05)' : (totalDia > 200 ? 'rgba(239, 68, 68, 0.8)' : 'rgba(239, 68, 68, 0.3)');
        heatmap.innerHTML += `<div class="heatmap-day" style="background: ${color}" onclick="verDetalheDia(${d})">${d}</div>`;
    }
}

window.verDetalheDia = (dia) => {
    const dRef = new Date(); dRef.setMonth(dRef.getMonth() + calorOffset);
    const gs = globalItems.filter(i => {
        const d = new Date(i.data + 'T12:00:00');
        return d.getDate() === dia && d.getMonth() === dRef.getMonth() && d.getFullYear() === dRef.getFullYear();
    });
    const html = gs.length ? gs.map(i => `<div class="flex justify-between p-2 border-b border-white/5"><span>${i.nome}</span><b>${fmt(i.valor)}</b></div>`).join('') : "Nada registrado.";
    Swal.fire({ title: `Detalhes ${dia}/${dRef.getMonth()+1}`, html: `<div class="text-[12px]">${html}</div>` });
};

window.calcularSimulador = () => {
    const inv = parseFloat(document.getElementById('inputInvest').value) || 0;
    const taxa = 0.01; // 1%
    const formula = (m) => inv * ((Math.pow(1 + taxa, m) - 1) / taxa);
    document.getElementById('sim6').innerText = fmt(formula(6));
    document.getElementById('sim12').innerText = fmt(formula(12));
    document.getElementById('sim60').innerText = fmt(formula(60));
    
    const gps = document.getElementById('scoreGPS');
    const txt = document.getElementById('textoGPS');
    if(inv > 500) { gps.innerText = "SCORE: 9.5"; txt.innerText = "Você está em rota de riqueza acelerada!"; }
    else { gps.innerText = "SCORE: 6.0"; txt.innerText = "Aumente seu aporte para atingir a liberdade antes dos 40."; }
};

window.converterMoeda = () => {
    const brl = parseFloat(document.getElementById('convReal').value) || 0;
    const taxa = parseFloat(document.getElementById('moedaDestino').value);
    document.getElementById('resConversao').innerText = (brl / taxa).toFixed(2);
};

window.mudarTipo = (t) => {
    tAtual = t;
    document.getElementById('t-div').className = t === 'divida' ? 'text-[9px] px-5 py-2 rounded-lg bg-purple-600 font-black' : 'text-[9px] px-5 py-2 rounded-lg opacity-20 font-black';
    document.getElementById('t-gan').className = t === 'ganho' ? 'text-[9px] px-5 py-2 rounded-lg bg-purple-600 font-black' : 'text-[9px] px-5 py-2 rounded-lg opacity-20 font-black';
};

window.abrirDetalheProximoMes = () => {
    const prox = new Date(); prox.setMonth(prox.getMonth()+1);
    const gs = globalItems.filter(i => {
        const d = new Date(i.data + 'T12:00:00');
        return d.getMonth() === prox.getMonth() && d.getFullYear() === prox.getFullYear();
    });
    const ganhos = gs.filter(i => i.tipo === 'ganho').reduce((a,b) => a+b.valor, 0);
    const percas = gs.filter(i => i.tipo === 'divida').reduce((a,b) => a+b.valor, 0);
    Swal.fire({
        title: 'Próximo Mês',
        html: `<div class="flex justify-around p-4"><div class="text-emerald-400">Ganhos<br><b>${fmt(ganhos)}</b></div><div class="text-rose-400">Percas<br><b>${fmt(percas)}</b></div></div>`
    });
};
