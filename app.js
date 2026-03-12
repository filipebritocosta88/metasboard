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
let calorOffset = 0;
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
            document.getElementById('masterInput').value = txt.replace(valMatch[0], '').replace('reais', '').trim();
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
    if(id === 'secSimulador') { renderCalor(); calcularSimulador(); }
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
        verificarFixos();
    }
});

// --- RENDA E DÍVIDAS FIXAS ---
async function verificarFixos() {
    const snap = await getDoc(doc(db, "configs", userUID));
    const salDiv = document.getElementById('statusSalario');
    const fixDiv = document.getElementById('statusDividaFixa');
    
    if(snap.exists()) {
        const config = snap.data();
        // Render Salário
        if(config.salario) {
            salDiv.innerHTML = `<div class="flex justify-between items-center bg-white/5 p-4 rounded-xl">
                <div><p class="text-[10px] font-black">${fmt(config.salario)}</p><p class="text-[7px] opacity-30">5º Dia Útil</p></div>
                <button onclick="removerFixo('salario')" class="text-rose-500 text-[10px]">✕</button>
            </div>`;
        } else {
            salDiv.innerHTML = `<button onclick="abrirModalSalario()" class="w-full py-3 border border-dashed border-white/10 rounded-xl text-[9px] opacity-40">+ Definir Salário Mensal</button>`;
        }

        // Render Dívidas Fixas
        fixDiv.innerHTML = (config.dividasFixas || []).map((d, index) => `
            <div class="flex justify-between items-center bg-rose-500/5 p-4 rounded-xl border border-rose-500/10">
                <div><p class="text-[10px] font-bold uppercase">${d.nome}</p><p class="text-[7px] opacity-40">Todo dia ${d.dia}</p></div>
                <div class="flex items-center gap-4"><b class="text-[10px] text-rose-400">${fmt(d.valor)}</b>
                <button onclick="removerFixo('divida', ${index})" class="text-rose-500">✕</button></div>
            </div>
        `).join('');

        // Automação de Depósito/Saída (Todo mês)
        const hoje = new Date(), ref = (hoje.getMonth()+1)+"/"+hoje.getFullYear();
        if(config.ultimoUpdateFixos !== ref) {
            // Depósito Salário
            if(config.salario && eQuintoDiaUtil(hoje)) {
                await addDoc(collection(db, "fluxo"), { nome: "SALÁRIO MENSAL", valor: config.salario, tipo: "ganho", data: hoje.toISOString().split('T')[0], userId: userUID });
            }
            // Saída de Dívidas Fixas
            (config.dividasFixas || []).forEach(async d => {
                if(hoje.getDate() >= d.dia) {
                    await addDoc(collection(db, "fluxo"), { nome: d.nome + " (FIXO)", valor: d.valor, tipo: "divida", data: hoje.toISOString().split('T')[0], userId: userUID });
                }
            });
            await updateDoc(doc(db, "configs", userUID), { ultimoUpdateFixos: ref });
        }
    }
}

function eQuintoDiaUtil(data) {
    let du = 0, d = new Date(data.getFullYear(), data.getMonth(), 1);
    while(du < 5) { let s = d.getDay(); if(s !== 0 && s !== 6) du++; if(du < 5) d.setDate(d.getDate()+1); }
    return data.getDate() >= d.getDate();
}

window.abrirModalSalario = async () => {
    const { value: v } = await Swal.fire({ title: 'Salário Fixo', input: 'number', inputLabel: 'Valor que você recebe no 5º dia útil' });
    if(v) { await setDoc(doc(db, "configs", userUID), { salario: parseFloat(v) }, { merge: true }); verificarFixos(); }
};

window.abrirModalDividaFixa = async () => {
    const { value: f } = await Swal.fire({
        title: 'Nova Dívida Fixa',
        html: `<input id="fn" class="swal2-input" placeholder="Ex: Aluguel"><input id="fv" class="swal2-input" type="number" placeholder="Valor R$"><input id="fd" class="swal2-input" type="number" placeholder="Dia do Vencimento">`,
        preConfirm: () => ({ nome: document.getElementById('fn').value, valor: parseFloat(document.getElementById('fv').value), dia: parseInt(document.getElementById('fd').value) })
    });
    if(f && f.nome) {
        const snap = await getDoc(doc(db, "configs", userUID));
        const atuais = snap.exists() ? (snap.data().dividasFixas || []) : [];
        await setDoc(doc(db, "configs", userUID), { dividasFixas: [...atuais, f] }, { merge: true });
        verificarFixos();
    }
};

window.removerFixo = async (tipo, index) => {
    const snap = await getDoc(doc(db, "configs", userUID));
    if(tipo === 'salario') await updateDoc(doc(db, "configs", userUID), { salario: null });
    else {
        let atuais = snap.data().dividasFixas;
        atuais.splice(index, 1);
        await updateDoc(doc(db, "configs", userUID), { dividasFixas: atuais });
    }
    verificarFixos();
};

// --- ENGINE PRINCIPAL ---
window.salvar = async () => {
    const n = document.getElementById('masterInput').value, v = parseFloat(document.getElementById('valManual').value), 
          dStr = document.getElementById('dateManual').value || new Date().toISOString().split('T')[0];
    if(!n || isNaN(v)) return;

    if(document.getElementById('checkParcela').checked) {
        const p = parseInt(document.getElementById('numParcelas').value) || 1;
        for(let i=0; i<p; i++) {
            let d = new Date(dStr + 'T12:00:00'); d.setMonth(d.getMonth() + i);
            await addDoc(collection(db, "fluxo"), { nome: `${n} (${i+1}/${p})`, valor: v/p, tipo: tAtual, data: d.toISOString().split('T')[0], userId: userUID });
        }
    } else {
        await addDoc(collection(db, "fluxo"), { nome: n, valor: v, tipo: tAtual, data: dStr, userId: userUID });
    }
    document.getElementById('masterInput').value = ''; document.getElementById('valManual').value = '';
    confetti({ particleCount: 40, origin: { y: 0.7 } });
};

function initData() {
    onSnapshot(query(collection(db, "fluxo"), where("userId", "==", userUID)), snap => {
        let carteira = 0, rMesH = 0, gMesH = 0, rMesT = 0, gMesT = 0, rP = 0, gP = 0;
        const items = [], hoje = new Date(), amanhã = new Date(hoje); amanhã.setDate(hoje.getDate()+1);
        const proxM = new Date(); proxM.setMonth(hoje.getMonth()+1);
        
        snap.forEach(doc => {
            const i = doc.data(); const d = new Date(i.data + 'T12:00:00');
            // Carteira (Até hoje)
            if(d <= hoje) { if(i.tipo==='ganho') carteira += i.valor; else carteira -= i.valor; }
            
            // Mês Atual
            if(d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear()) {
                if(i.tipo==='ganho') { rMesT += i.valor; if(d <= hoje) rMesH += i.valor; }
                else { gMesT += i.valor; if(d <= hoje) gMesH += i.valor; }
            }
            // Próximo Mês
            if(d.getMonth() === proxM.getMonth() && d.getFullYear() === proxM.getFullYear()) {
                if(i.tipo==='ganho') rP += i.valor; else gP += i.valor;
            }
            items.push({...i, id: doc.id});
        });
        
        globalItems = items;
        updateUI(carteira, rMesH, gMesH, rMesT, gMesT, rP, gP, items);
    });
}

function updateUI(carteira, rH, gH, rT, gT, rP, gP, items) {
    document.getElementById('saldoReal').innerText = fmt(Math.max(0, carteira));
    document.getElementById('rendaMes').innerText = fmt(rH);
    document.getElementById('gastoMes').innerText = fmt(gH);
    document.getElementById('saldoPrevisto').innerText = fmt(carteira + (rT - rH) - (gT - gH));
    document.getElementById('resumoProxMes').innerText = fmt(rP - gP);
    
    // Histórico
    const f = document.getElementById('filtroMes').value;
    const hist = document.getElementById('listaDividasFull'); hist.innerHTML = '';
    items.filter(i => !f || i.data.startsWith(f)).sort((a,b) => new Date(b.data) - new Date(a.data)).forEach(i => {
        hist.innerHTML += `<div class="bg-white/5 p-4 rounded-xl flex justify-between items-center text-[10px]">
            <div><p class="font-bold uppercase tracking-tighter">${i.nome}</p><p class="text-[8px] opacity-30">${i.data}</p></div>
            <div class="flex items-center gap-4"><b class="${i.tipo==='ganho'?'text-emerald-400':'text-rose-400'}">${fmt(i.valor)}</b>
            <button onclick="deletarItem('${i.id}')" class="text-rose-500 opacity-20 hover:opacity-100">✕</button></div>
        </div>`;
    });

    // Feed
    const feed = document.getElementById('feed'); feed.innerHTML = '';
    items.sort((a,b) => new Date(b.data) - new Date(a.data)).slice(0,4).forEach(i => {
        feed.innerHTML += `<div class="glass p-4 flex justify-between items-center border-l-2 ${i.tipo==='ganho'?'border-emerald-500':'border-rose-500'}">
            <span class="text-[9px] font-black uppercase opacity-60">${i.nome}</span>
            <b class="text-[10px] ${i.tipo==='ganho'?'text-emerald-400':'text-rose-400'}">${fmt(i.valor)}</b>
        </div>`;
    });
}
window.deletarItem = async (id) => await deleteDoc(doc(db, "fluxo", id));

// --- METAS ---
window.abrirModalMeta = async (id = null) => {
    let m = { n: '', v: '', t: 'hardware' };
    if(id) m = (await getDoc(doc(db, "metas", id))).data();
    
    const { value: f } = await Swal.fire({
        title: id ? 'Editar Sonho' : 'Novo Objetivo',
        background: '#111', color: '#fff',
        html: `<input id="mn" class="swal2-input" placeholder="O que deseja?" value="${m.n}">
               <input id="mv" class="swal2-input" type="number" placeholder="Valor Total R$" value="${m.v}">
               <select id="mt" class="swal2-input"><option value="hardware">Hardware</option><option value="veiculo">Veículo</option><option value="celular">Celular</option></select>`,
        preConfirm: () => ({ n: document.getElementById('mn').value, v: parseFloat(document.getElementById('mv').value), t: document.getElementById('mt').value })
    });
    if(f && f.n) {
        if(id) await updateDoc(doc(db, "metas", id), f);
        else await addDoc(collection(db, "metas"), { ...f, pago: 0, userId: userUID, rank: Date.now() });
    }
};

function initMetas() {
    onSnapshot(query(collection(db, "metas"), where("userId", "==", userUID)), snap => {
        const c = document.getElementById('listaMetas'); c.innerHTML = '';
        const metas = []; snap.forEach(doc => metas.push({...doc.data(), id: doc.id}));
        
        metas.sort((a,b) => (b.pago/b.v) - (a.pago/a.v)).forEach((m, idx) => {
            const pct = Math.min(100, (m.pago / m.v) * 100);
            c.innerHTML += `<div class="glass p-6 space-y-4 ${idx === 0 ? 'meta-rank-1' : ''}">
                <div class="flex justify-between items-start">
                    <div><p class="text-[7px] font-black text-purple-400">#${idx+1} NO RANKING</p><h4 class="font-orbitron text-[11px] uppercase">${m.n}</h4></div>
                    <div class="flex gap-4">
                        <button onclick="addValorMeta('${m.id}')" class="text-lg">💰</button>
                        <button onclick="deletarMeta('${m.id}')" class="text-lg opacity-20">🗑️</button>
                    </div>
                </div>
                <div class="h-1.5 bg-white/5 rounded-full overflow-hidden"><div class="progress-fill bg-purple-500" style="width: ${pct}%"></div></div>
                <div class="flex justify-between text-[8px] opacity-40 font-black"><span>${fmt(m.pago)}</span><span>${fmt(m.v)}</span></div>
            </div>`;
        });
    });
}
window.addValorMeta = async (id) => {
    const { value: v } = await Swal.fire({ title: 'Aportar valor', input: 'number' });
    if(v) {
        const docRef = doc(db, "metas", id);
        const m = (await getDoc(docRef)).data();
        await updateDoc(docRef, { pago: m.pago + parseFloat(v) });
        if(m.pago + parseFloat(v) >= m.v) confetti();
    }
};
window.deletarMeta = async (id) => await deleteDoc(doc(db, "metas", id));

// --- FUTURO & CALOR ---
window.mudarMesCalor = (n) => { calorOffset += n; renderCalor(); };
function renderCalor() {
    const dRef = new Date(); dRef.setMonth(dRef.getMonth() + calorOffset);
    document.getElementById('calorDataRef').innerText = dRef.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
    const heatmap = document.getElementById('heatmap'); heatmap.innerHTML = '';
    const dias = new Date(dRef.getFullYear(), dRef.getMonth() + 1, 0).getDate();
    
    for(let d=1; d<=dias; d++) {
        const total = globalItems.filter(i => {
            const dt = new Date(i.data + 'T12:00:00');
            return dt.getDate() === d && dt.getMonth() === dRef.getMonth() && i.tipo === 'divida';
        }).reduce((acc, c) => acc + c.valor, 0);
        const color = total === 0 ? 'rgba(255,255,255,0.05)' : (total > 150 ? 'rgba(239, 68, 68, 0.7)' : 'rgba(239, 68, 68, 0.3)');
        heatmap.innerHTML += `<div class="heatmap-day" style="background: ${color}">${d}</div>`;
    }
}

window.calcularSimulador = () => {
    const inv = parseFloat(document.getElementById('inputInvest').value) || 0;
    const f = (m) => inv * ((Math.pow(1 + 0.01, m) - 1) / 0.01);
    document.getElementById('sim6').innerText = fmt(f(6));
    document.getElementById('sim12').innerText = fmt(f(12));
    document.getElementById('sim60').innerText = fmt(f(60));
    
    const score = inv > 500 ? 9.2 : (inv > 100 ? 6.5 : 3.0);
    document.getElementById('scoreGPS').innerText = score.toFixed(1);
    document.getElementById('textoGPS').innerText = inv > 200 ? "Rota de Independência. Seus aportes superam a inflação." : "Atenção: Seu motor financeiro precisa de mais combustível para o futuro.";
};

window.converterMoeda = () => {
    const brl = parseFloat(document.getElementById('convReal').value) || 0;
    const taxa = parseFloat(document.getElementById('moedaDestino').value);
    document.getElementById('resConversao').innerText = (brl / taxa).toFixed(2);
};

window.mudarTipo = (t) => {
    tAtual = t;
    document.getElementById('t-div').className = t === 'divida' ? 'text-[9px] px-6 py-2 rounded-xl bg-purple-600 font-black' : 'text-[9px] px-6 py-2 rounded-xl opacity-20 font-black';
    document.getElementById('t-gan').className = t === 'ganho' ? 'text-[9px] px-6 py-2 rounded-xl bg-purple-600 font-black' : 'text-[9px] px-6 py-2 rounded-xl opacity-20 font-black';
};

window.abrirDetalheProximoMes = async () => {
    const hoje = new Date();
    const proxM = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
    const snap = await getDoc(doc(db, "configs", userUID));
    let sal = 0, fixas = 0;
    if(snap.exists()){
        sal = snap.data().salario || 0;
        fixas = (snap.data().dividasFixas || []).reduce((a,b) => a+b.valor, 0);
    }
    const gs = globalItems.filter(i => {
        const d = new Date(i.data + 'T12:00:00');
        return d.getMonth() === proxM.getMonth();
    });
    const rVar = gs.filter(i => i.tipo === 'ganho').reduce((a,b) => a+b.valor, 0);
    const gVar = gs.filter(i => i.tipo === 'divida').reduce((a,b) => a+b.valor, 0);

    Swal.fire({
        title: 'Projeção Próximo Mês',
        html: `<div class="text-left text-[11px] space-y-2">
            <p class="flex justify-between"><span>Salário:</span> <b class="text-emerald-400">+ ${fmt(sal)}</b></p>
            <p class="flex justify-between"><span>Ganhos Extras:</span> <b class="text-emerald-400">+ ${fmt(rVar)}</b></p>
            <p class="flex justify-between"><span>Dívidas Fixas:</span> <b class="text-rose-400">- ${fmt(fixas)}</b></p>
            <p class="flex justify-between"><span>Gastos Parcelados:</span> <b class="text-rose-400">- ${fmt(gVar)}</b></p>
            <hr class="opacity-10">
            <p class="flex justify-between text-lg"><span>TOTAL:</span> <b>${fmt(sal + rVar - fixas - gVar)}</b></p>
        </div>`
    });
};
