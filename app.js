import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc, serverTimestamp, getDocs, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// --- CONFIGURAÇÃO FIREBASE ---
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

// --- VARIÁVEIS GLOBAIS DE ESTADO ---
let userUID = null;
let tAtual = 'divida';
let globalItems = [];
let globalMetas = [];
let calorOffset = 0;
let abaMetaAtual = 'ativas'; // Nova variável para abas
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
window.toggleAudio = () => { if(recognition) { recognition.start(); document.getElementById('audioBtn').classList.add('bg-red-500'); } };

// --- NAVEGAÇÃO ---
window.nav = (id, btn) => {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('nav button').forEach(b => { b.classList.remove('nav-active'); b.classList.add('opacity-40'); });
    btn.classList.add('nav-active'); btn.classList.remove('opacity-40');
    if(id === 'secSimulador') { renderCalor(); calcularSimulador(); }
};

// --- AUTH ---
window.alternarAuth = () => { 
    const b = document.getElementById('btnAuth'); 
    b.innerText = b.innerText === 'ACESSAR TERMINAL' ? 'CRIAR NOVO ACESSO' : 'ACESSAR TERMINAL'; 
};

window.executarAuth = () => {
    const e = document.getElementById('email').value, s = document.getElementById('senha').value;
    if(!e || !s) return Swal.fire('Erro', 'Preencha os campos.', 'error');
    if(document.getElementById('btnAuth').innerText === 'ACESSAR TERMINAL') 
        signInWithEmailAndPassword(auth, e, s).catch(err => Swal.fire('Erro', 'Acesso negado.', 'error'));
    else 
        createUserWithEmailAndPassword(auth, e, s).catch(err => Swal.fire('Erro', 'Cadastro falhou.', 'error'));
};

window.sair = () => {
    signOut(auth).then(() => {
        userUID = null;
        document.getElementById('app').classList.add('hidden');
        document.getElementById('loginTela').classList.remove('hidden');
    });
};

onAuthStateChanged(auth, u => {
    if(u) {
        userUID = u.uid;
        document.getElementById('loginTela').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        document.getElementById('dataRef').innerText = new Date().toLocaleDateString('pt-BR', {weekday:'long', day:'numeric', month:'long'});
        initData(); initMetas(); verificarFixos();
    }
});

// --- RENDA E FIXOS ---
async function verificarFixos() {
    if(!userUID) return;
    const snap = await getDoc(doc(db, "configs", userUID));
    const salDiv = document.getElementById('statusSalario');
    const fixDiv = document.getElementById('statusDividaFixa');
    if(snap.exists()) {
        const config = snap.data();
        salDiv.innerHTML = config.salario ? `<div class="flex justify-between items-center bg-emerald-500/5 p-4 rounded-2xl border border-emerald-500/10"><div><p class="text-[12px] font-black">${fmt(config.salario)}</p><p class="text-[8px] opacity-40 uppercase">Geração Automática</p></div><button onclick="removerFixo('salario')" class="bg-rose-500/20 text-rose-500 p-2 rounded-lg">✕</button></div>` : `<button onclick="abrirModalSalario()" class="w-full py-4 border-2 border-dashed border-white/10 rounded-2xl text-[10px] font-bold opacity-40">+ Renda Mensal</button>`;
        fixDiv.innerHTML = (config.dividasFixas || []).map((d, i) => `<div class="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/10"><div><p class="text-[11px] font-black uppercase">${d.nome}</p><p class="text-[8px] opacity-40">Dia ${d.dia}</p></div><div class="flex items-center gap-4"><b class="text-rose-400 font-black">${fmt(d.valor)}</b><button onclick="removerFixo('divida', ${i})" class="text-rose-500 opacity-40">✕</button></div></div>`).join('');
    }
}

window.abrirModalSalario = async () => {
    const { value: v } = await Swal.fire({ title: 'Renda Mensal', input: 'number' });
    if(v) { await setDoc(doc(db, "configs", userUID), { salario: parseFloat(v) }, { merge: true }); verificarFixos(); }
};

window.abrirModalDividaFixa = async () => {
    const { value: f } = await Swal.fire({
        title: 'Nova Conta Fixa',
        html: `<input id="fn" class="swal2-input" placeholder="Nome"><input id="fv" class="swal2-input" type="number" placeholder="Valor"><input id="fd" class="swal2-input" type="number" placeholder="Dia">`,
        preConfirm: () => ({ nome: document.getElementById('fn').value, valor: parseFloat(document.getElementById('fv').value), dia: parseInt(document.getElementById('fd').value) })
    });
    if(f && f.nome) {
        const snap = await getDoc(doc(db, "configs", userUID));
        const atuais = snap.exists() ? (snap.data().dividasFixas || []) : [];
        await setDoc(doc(db, "configs", userUID), { dividasFixas: [...atuais, f] }, { merge: true });
        verificarFixos();
    }
};

window.removerFixo = async (tipo, idx) => {
    const snap = await getDoc(doc(db, "configs", userUID));
    if(tipo === 'salario') await updateDoc(doc(db, "configs", userUID), { salario: null });
    else { let list = snap.data().dividasFixas; list.splice(idx, 1); await updateDoc(doc(db, "configs", userUID), { dividasFixas: list }); }
    verificarFixos();
};

// --- LANÇAMENTOS ---
window.salvar = async () => {
    const n = document.getElementById('masterInput').value, v = parseFloat(document.getElementById('valManual').value), 
          dStr = document.getElementById('dateManual').value || new Date().toISOString().split('T')[0];
    if(!n || isNaN(v)) return Swal.fire('Oops', 'Preencha corretamente.', 'warning');
    if(document.getElementById('checkParcela').checked) {
        const p = parseInt(document.getElementById('numParcelas').value) || 1;
        for(let i=0; i<p; i++) {
            let d = new Date(dStr + 'T12:00:00'); d.setMonth(d.getMonth() + i);
            await addDoc(collection(db, "fluxo"), { nome: `${n} (${i+1}/${p})`, valor: v/p, tipo: tAtual, data: d.toISOString().split('T')[0], userId: userUID });
        }
    } else { await addDoc(collection(db, "fluxo"), { nome: n, valor: v, tipo: tAtual, data: dStr, userId: userUID }); }
    document.getElementById('masterInput').value = ''; document.getElementById('valManual').value = '';
    confetti({ particleCount: 100, spread: 70 });
};

// --- DATA ENGINE ---
function initData() {
    if(!userUID) return;
    onSnapshot(query(collection(db, "fluxo"), where("userId", "==", userUID)), snap => {
        let carteira = 0, rMesH = 0, gMesH = 0, rMesT = 0, gMesT = 0;
        const items = [], hoje = new Date();
        const filtroMes = document.getElementById('filtroMes').value; // Acessando filtro de data

        snap.forEach(doc => {
            const i = doc.data(); const d = new Date(i.data + 'T12:00:00');
            // Saldo da Carteira (tudo até hoje)
            if(d <= hoje) { if(i.tipo==='ganho') carteira += i.valor; else carteira -= i.valor; }
            
            // Lógica do Filtro na Gestão
            if(d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear()) {
                if(i.tipo==='ganho') { rMesT += i.valor; if(d <= hoje) rMesH += i.valor; }
                else { gMesT += i.valor; if(d <= hoje) gMesH += i.valor; }
            }
            items.push({...i, id: doc.id});
        });
        globalItems = items; 
        updateUI(carteira, rMesH, gMesH, rMesT, gMesT);
    });
}

async function updateUI(carteira, rH, gH, rT, gT) {
    document.getElementById('saldoReal').innerText = fmt(carteira);
    document.getElementById('rendaMes').innerText = fmt(rH);
    document.getElementById('gastoMes').innerText = fmt(gH);
    document.getElementById('saldoPrevisto').innerText = fmt(carteira + (rT - rH) - (gT - gH));
    
    const snap = await getDoc(doc(db, "configs", userUID));
    const sal = snap.exists() ? (snap.data().salario || 0) : 0;
    const fix = snap.exists() ? (snap.data().dividasFixas || []).reduce((a,b)=>a+b.valor, 0) : 0;
    
    // Projeção Próximo Mês
    const proxM = new Date(); proxM.setMonth(proxM.getMonth() + 1);
    const varG = globalItems.filter(i => { const d = new Date(i.data + 'T12:00:00'); return d.getMonth() === proxM.getMonth() && i.tipo === 'divida'; }).reduce((a,b)=>a+b.valor, 0);
    const varR = globalItems.filter(i => { const d = new Date(i.data + 'T12:00:00'); return d.getMonth() === proxM.getMonth() && i.tipo === 'ganho'; }).reduce((a,b)=>a+b.valor, 0);
    document.getElementById('resumoProxMes').innerText = fmt(sal + varR - fix - varG);

    // Histórico Filtrado (Melhorado visualmente)
    const hDiv = document.getElementById('listaDividasFull'); 
    const filtroData = document.getElementById('filtroMes').value;
    hDiv.innerHTML = '';
    
    globalItems
        .filter(i => !filtroData || i.data.includes(filtroData))
        .sort((a,b) => new Date(b.data) - new Date(a.data))
        .forEach(i => {
            hDiv.innerHTML += `<div class="bg-white/5 p-4 rounded-2xl flex justify-between items-center border border-white/5"><div><p class="text-[11px] font-black uppercase">${i.nome}</p><p class="text-[8px] opacity-30">${i.data}</p></div><div class="flex items-center gap-4"><b class="${i.tipo==='ganho'?'text-emerald-400':'text-rose-400'}">${fmt(i.valor)}</b><button onclick="deletarItem('${i.id}')" class="text-rose-500 opacity-20">✕</button></div></div>`;
        });

    const feed = document.getElementById('feed'); feed.innerHTML = '';
    globalItems.sort((a,b) => new Date(b.data) - new Date(a.data)).slice(0,5).forEach(i => {
        feed.innerHTML += `<div class="glass p-4 flex justify-between items-center border-l-4 ${i.tipo==='ganho'?'border-emerald-500':'border-rose-500'}"><span class="text-[10px] font-black uppercase opacity-60">${i.nome}</span><b class="text-[11px] ${i.tipo==='ganho'?'text-emerald-400':'text-rose-400'}">${fmt(i.valor)}</b></div>`;
    });
}
window.deletarItem = async (id) => await deleteDoc(doc(db, "fluxo", id));

// --- METAS ENGINE ---
window.mudarAbaMeta = (aba) => {
    abaMetaAtual = aba;
    document.getElementById('tabAtivas').classList.toggle('active', aba === 'ativas');
    document.getElementById('tabConcluidas').classList.toggle('active', aba === 'concluidas');
    renderMetas();
};

function renderMetas() {
    const c = document.getElementById('listaMetas'); c.innerHTML = '';
    const filtradas = globalMetas.filter(m => abaMetaAtual === 'ativas' ? m.pago < m.v : m.pago >= m.v);
    
    filtradas.sort((a,b) => (b.pago/b.v) - (a.pago/a.v)).forEach((m, idx) => {
        const pct = Math.min(100, (m.pago / m.v) * 100);
        c.innerHTML += `<div class="glass p-6 space-y-4 border-l-4 ${m.pago >= m.v ? 'border-emerald-500' : (idx===0?'border-yellow-500':'border-purple-500')}">
            <div class="flex justify-between items-start">
                <div><p class="text-[8px] font-black text-purple-400">${m.pago >= m.v ? 'CONCLUÍDO' : 'RANK #'+(idx+1)}</p><h4 class="font-orbitron text-[13px] uppercase">${m.n}</h4></div>
                <div class="flex gap-4">
                    ${m.pago < m.v ? `<button onclick="addValorMeta('${m.id}')" class="text-xl">💰</button>` : '✅'}
                    <button onclick="deletarMeta('${m.id}')" class="text-lg opacity-20">🗑️</button>
                </div>
            </div>
            <div class="progress-bar"><div class="progress-fill" style="width: ${pct}%"></div></div>
            <div class="flex justify-between text-[10px] font-black"><span>${fmt(m.pago)}</span><span class="opacity-30">${fmt(m.v)}</span></div>
        </div>`;
    });
}

function initMetas() {
    onSnapshot(query(collection(db, "metas"), where("userId", "==", userUID)), snap => {
        const mArr = []; snap.forEach(doc => mArr.push({...doc.data(), id: doc.id}));
        globalMetas = mArr;
        renderMetas();
    });
}

window.abrirModalMeta = async () => {
    const { value: f } = await Swal.fire({
        title: 'Novo Objetivo',
        html: `<input id="mn" class="swal2-input" placeholder="O que deseja?"><input id="mv" class="swal2-input" type="number" placeholder="Valor Total">`,
        preConfirm: () => ({ n: document.getElementById('mn').value, v: parseFloat(document.getElementById('mv').value) })
    });
    if(f && f.n) await addDoc(collection(db, "metas"), { ...f, pago: 0, userId: userUID, ts: Date.now() });
};

window.addValorMeta = async (id) => {
    const { value: v } = await Swal.fire({ title: 'Aportar Capital', input: 'number' });
    if(v) {
        const docRef = doc(db, "metas", id); const m = (await getDoc(docRef)).data();
        const novoV = m.pago + parseFloat(v); await updateDoc(docRef, { pago: novoV });
        if(novoV >= m.v) confetti({ particleCount: 200, spread: 100 });
    }
};
window.deletarMeta = async (id) => await deleteDoc(doc(db, "metas", id));

// --- SIMULADOR DE VIDA ---
window.simularCenario = () => {
    const nome = document.getElementById('cenarioNome').value;
    const valor = parseFloat(document.getElementById('cenarioValor').value) || 0;
    const meses = document.getElementById('cenarioMeses').value || 1;
    const res = document.getElementById('resultadoCenario');
    
    if(!nome || valor <= 0) return Swal.fire('Erro', 'Insira nome e valor.', 'warning');
    
    // Pegando valor livre do elemento resumoProxMes
    const saldoLivreStr = document.getElementById('resumoProxMes').innerText;
    const saldoLivre = parseFloat(saldoLivreStr.replace(/[R$\s.]/g, '').replace(',', '.'));
    
    const novoSaldo = saldoLivre - valor;
    res.classList.remove('hidden');
    res.innerHTML = `<h5 class="text-[9px] font-black uppercase text-purple-400">Análise: ${nome}</h5>
        <p class="text-[11px]">Seu saldo mensal livre cairia para <b class="${novoSaldo < 0 ? 'text-rose-500' : 'text-emerald-400'}">${fmt(novoSaldo)}</b>.</p>
        <p class="text-[10px] opacity-60">Impacto no Score: <b>-${(valor/(saldoLivre||1)*5).toFixed(1)} pts</b></p>
        <p class="mt-2 text-[10px] italic border-t border-white/5 pt-2">Dica: Se investisse esse valor, teria ${fmt(valor * Math.pow(1.01, meses))} em ${meses} meses.</p>`;
};

// --- FUTURO E MAPA ---
window.mudarMesCalor = (n) => { calorOffset += n; renderCalor(); };
async function renderCalor() {
    const snap = await getDoc(doc(db, "configs", userUID));
    const config = snap.exists() ? snap.data() : {};
    const sal = config.salario || 0;
    const fixos = config.dividasFixas || [];

    const dRef = new Date(); dRef.setMonth(dRef.getMonth() + calorOffset);
    document.getElementById('calorDataRef').innerText = dRef.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).toUpperCase();
    const heatmap = document.getElementById('heatmap'); heatmap.innerHTML = '';
    
    for(let d=1; d<=new Date(dRef.getFullYear(), dRef.getMonth() + 1, 0).getDate(); d++) {
        // Soma gastos variáveis + fixos do dia
        const gastosVar = globalItems.filter(i => { 
            const dt = new Date(i.data + 'T12:00:00'); 
            return dt.getDate() === d && dt.getMonth() === dRef.getMonth() && i.tipo === 'divida'; 
        }).reduce((acc, c) => acc + c.valor, 0);

        const gastoFixoDoDia = fixos.filter(f => f.dia === d).reduce((a, b) => a + b.valor, 0);
        const totalDia = gastosVar + gastoFixoDoDia;
        
        const color = totalDia === 0 ? 'rgba(255,255,255,0.05)' : (totalDia > 200 ? '#f43f5e' : '#fb7185');
        heatmap.innerHTML += `<div class="heatmap-day" style="background: ${color}" onclick="verDetalheDia(${d})">${d}</div>`;
    }
}

window.verDetalheDia = async (dia) => {
    const snap = await getDoc(doc(db, "configs", userUID));
    const fixos = snap.exists() ? (snap.data().dividasFixas || []) : [];
    const dRef = new Date(); dRef.setMonth(dRef.getMonth() + calorOffset);
    const dStr = `${dRef.getFullYear()}-${String(dRef.getMonth()+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
    
    const diaItems = globalItems.filter(i => i.data === dStr);
    const diaFixos = fixos.filter(f => f.dia === dia);
    
    let html = `<div class="text-left text-xs">`;
    diaItems.forEach(i => html += `<div class='flex justify-between py-1'><span>${i.nome}</span><b>${fmt(i.valor)}</b></div>`);
    diaFixos.forEach(f => html += `<div class='flex justify-between py-1 text-rose-400'><span>[FIXO] ${f.nome}</span><b>${fmt(f.valor)}</b></div>`);
    if(diaItems.length === 0 && diaFixos.length === 0) html += 'Sem gastos.';
    html += `</div>`;
    
    Swal.fire({ title: `Dia ${dia}`, html: html });
};

window.calcularSimulador = () => {
    const inv = parseFloat(document.getElementById('inputInvest').value) || 0;
    const f = (m) => inv * ((Math.pow(1.01, m) - 1) / 0.01);
    document.getElementById('sim6').innerText = fmt(f(6));
    document.getElementById('sim12').innerText = fmt(f(12));
    document.getElementById('sim60').innerText = fmt(f(60));
    const score = (inv/100) + ((globalMetas.reduce((a,b)=>a+b.pago,0)/(globalMetas.reduce((a,b)=>a+b.v,0)||1))*5);
    document.getElementById('scoreGPS').innerText = Math.min(10.0, score).toFixed(1);
    document.getElementById('textoGPS').innerText = score > 7 ? "Performance Excelente." : "Ajuste Necessário.";
};

window.converterMoeda = () => {
    const brl = parseFloat(document.getElementById('convReal').value) || 0;
    const s = document.getElementById('moedaDestino').value.split('|');
    document.getElementById('bandeiraMoeda').innerText = s[1];
    document.getElementById('resConversao').innerText = (brl / parseFloat(s[0])).toLocaleString('en-US', { minimumFractionDigits: 2 });
};

// --- CHAT IA ---
window.abrirChatIA = () => document.getElementById('chatAI').classList.add('open');
window.fecharChatIA = () => document.getElementById('chatAI').classList.remove('open');
window.enviarPerguntaIA = () => {
    const input = document.getElementById('iaInput'); const msg = input.value.trim().toLowerCase(); if(!msg) return;
    const chat = document.getElementById('chatMessages');
    chat.innerHTML += `<div class="bg-white/5 p-4 rounded-2xl rounded-tr-none ml-auto max-w-[80%] text-right text-xs">${input.value}</div>`;
    
    let r = "Sou o Metasboard AI. Posso te dar dicas sobre seu saldo de " + document.getElementById('saldoReal').innerText;
    if(msg.includes("metas")) r = "Você tem " + globalMetas.length + " metas. A meta mais próxima de concluir é " + (globalMetas[0]?.n || "nenhuma no momento.");
    else if(msg.includes("gastos")) r = "Neste mês você já registrou " + document.getElementById('gastoMes').innerText + " em saídas.";
    
    setTimeout(() => { chat.innerHTML += `<div class="bg-purple-500/10 p-4 rounded-2xl rounded-tl-none border border-purple-500/20 max-w-[80%] text-xs">${r}</div>`; chat.scrollTop = chat.scrollHeight; }, 600);
    input.value = '';
};

window.mudarTipo = (t) => { tAtual = t; document.getElementById('t-div').className = t === 'divida' ? 'text-[9px] px-6 py-2 rounded-xl bg-purple-600 font-black' : 'text-[9px] px-6 py-2 rounded-xl opacity-20 font-black'; document.getElementById('t-gan').className = t === 'ganho' ? 'text-[9px] px-6 py-2 rounded-xl bg-purple-600 font-black' : 'text-[9px] px-6 py-2 rounded-xl opacity-20 font-black'; };

window.abrirDetalheProximoMes = async () => {
    const snap = await getDoc(doc(db, "configs", userUID));
    const config = snap.exists() ? snap.data() : {};
    const sal = config.salario || 0; const fix = (config.dividasFixas || []).reduce((a,b)=>a+b.valor, 0);
    const proxM = new Date(); proxM.setMonth(proxM.getMonth() + 1);
    const varG = globalItems.filter(i => { const d = new Date(i.data + 'T12:00:00'); return d.getMonth() === proxM.getMonth() && i.tipo === 'divida'; }).reduce((a,b)=>a+b.valor, 0);
    Swal.fire({ title: 'Projeção Próximo Mês', html: `<div class='text-left text-xs space-y-2'><div class='flex justify-between'><span>Salário Base:</span><b>+${fmt(sal)}</b></div><div class='flex justify-between'><span>Saídas Fixas:</span><b>-${fmt(fix)}</b></div><div class='flex justify-between'><span>Parcelas Variáveis:</span><b>-${fmt(varG)}</b></div><hr><div class='flex justify-between text-orange-400'><span>Livre Projetado:</span><b>${fmt(sal-fix-varG)}</b></div></div>` });
};

initData();
