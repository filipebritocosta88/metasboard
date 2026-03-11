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

// --- VOICE ENGINE (PRESERVADO E OTIMIZADO) ---
const recognition = ('webkitSpeechRecognition' in window) ? new webkitSpeechRecognition() : null;
if (recognition) {
    recognition.lang = 'pt-BR';
    recognition.onresult = (e) => {
        const txt = e.results[0][0].transcript.toLowerCase();
        document.getElementById('masterInput').value = txt;
        const valMatch = txt.match(/\d+([.,]\d+)?/);
        if(valMatch) {
            document.getElementById('valManual').value = valMatch[0].replace(',', '.');
            document.getElementById('masterInput').value = txt.replace(valMatch[0], '').replace('reais', '').replace('real', '').trim();
        }
        document.getElementById('audioBtn').classList.remove('recording');
    };
}

window.toggleAudio = () => {
    if (!recognition) return Swal.fire("Erro", "Voz não suportada", "error");
    document.getElementById('audioBtn').classList.add('recording');
    recognition.start();
};

// --- NAVEGAÇÃO E UX ---
window.nav = (id, btn) => {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('nav button').forEach(b => { b.classList.remove('nav-active'); b.classList.add('opacity-40'); });
    btn.classList.add('nav-active');
    btn.classList.remove('opacity-40');
    if(id === 'secGestao') initChart();
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// --- AUTH ---
window.alternarAuth = () => {
    const b = document.getElementById('btnAuth');
    b.innerText = b.innerText === 'ENTRAR' ? 'CRIAR CONTA' : 'ENTRAR';
};

window.executarAuth = () => {
    const e = document.getElementById('email').value, s = document.getElementById('senha').value;
    if(document.getElementById('btnAuth').innerText === 'ENTRAR') signInWithEmailAndPassword(auth, e, s).catch(err => Swal.fire("Erro", "Credenciais Inválidas", "error"));
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
        processarSalarioAgendado();
    }
});

// --- SALÁRIO 5º DIA ÚTIL (BLINDADO) ---
async function processarSalarioAgendado() {
    const snap = await getDoc(doc(db, "configs", userUID));
    if(snap.exists()) {
        const config = snap.data();
        document.getElementById('txtProximoSalario').innerText = fmt(config.valorSalario || 0);
        const hoje = new Date(), mesAtual = (hoje.getMonth() + 1) + "/" + hoje.getFullYear();
        if (config.ultimoMesPago !== mesAtual && eQuintoDiaUtil(hoje)) {
            await addDoc(collection(db, "fluxo"), { 
                nome: "SALÁRIO AUTOMÁTICO", valor: config.valorSalario, tipo: "ganho", 
                data: hoje.toISOString().split('T')[0], userId: userUID, ts: serverTimestamp() 
            });
            await updateDoc(doc(db, "configs", userUID), { ultimoMesPago: mesAtual });
        }
    }
}

function eQuintoDiaUtil(data) {
    let diasUteis = 0, d = new Date(data.getFullYear(), data.getMonth(), 1);
    while (diasUteis < 5) {
        let ds = d.getDay();
        if (ds !== 0 && ds !== 6) diasUteis++;
        if (diasUteis < 5) d.setDate(d.getDate() + 1);
    }
    return data.getDate() === d.getDate();
}

window.configurarSalario = async () => {
    const val = parseFloat(document.getElementById('inputSalarioBase').value);
    await setDoc(doc(db, "configs", userUID), { valorSalario: val, userId: userUID }, { merge: true });
    Swal.fire("Sucesso", "Salário configurado para o 5º DU", "success");
    processarSalarioAgendado();
};

// --- METAS: HIERARQUIA, EDIÇÃO E INCENTIVOS ---
window.abrirModalMeta = async () => {
    const { value: f } = await Swal.fire({
        title: 'Novo Grande Objetivo',
        html: `<input id="mn" class="swal2-input" placeholder="O que você quer conquistar?">
               <input id="mv" class="swal2-input" type="number" placeholder="Valor Estimado">
               <input id="mi" class="swal2-input" placeholder="Incentivo: 'Pelo meu conforto'">`,
        preConfirm: () => [document.getElementById('mn').value, document.getElementById('mv').value, document.getElementById('mi').value]
    });
    if(f && f[0]) {
        await addDoc(collection(db, "metas"), { 
            nome: f[0], valorTotal: parseFloat(f[1]) || 0, pago: 0, 
            incentivo: f[2] || "Foco no objetivo!", submetas: [], 
            userId: userUID, ts: serverTimestamp() 
        });
    }
};

function initMetas() {
    onSnapshot(query(collection(db, "metas"), where("userId", "==", userUID)), snap => {
        const container = document.getElementById('listaMetas');
        container.innerHTML = '';
        snap.forEach(d => {
            const m = d.data(), pct = m.valorTotal > 0 ? (m.pago / m.valorTotal) * 100 : 0;
            container.innerHTML += `
                <div class="glass p-6 space-y-4 border-l-4 border-purple-500 card-anim">
                    <div class="flex justify-between items-start">
                        <div class="flex-1">
                            <h4 class="font-orbitron text-[12px] text-purple-400 uppercase tracking-widest">${m.nome}</h4>
                            <p class="text-[9px] opacity-60 italic mt-1">"${m.incentivo}"</p>
                        </div>
                        <div class="flex gap-3">
                            <button onclick="adicionarPeca('${d.id}')" class="text-xl">🧩</button>
                            <button onclick="deletarMeta('${d.id}')" class="text-xl text-rose-500/50">🗑️</button>
                        </div>
                    </div>
                    <div class="progress-bg"><div class="progress-fill" style="width: ${pct}%"></div></div>
                    <div class="flex justify-between text-[10px] font-bold">
                        <span>PAGO: ${fmt(m.pago)}</span>
                        <span class="opacity-40">ALVO: ${fmt(m.valorTotal)}</span>
                    </div>
                    <div class="grid grid-cols-1 gap-2 pt-2">
                        ${m.submetas.map((s, i) => `
                            <div class="flex justify-between items-center bg-white/5 p-3 rounded-xl text-[10px] border border-white/5">
                                <span class="opacity-70">${s.n}</span>
                                <div class="flex items-center gap-3">
                                    <span class="font-bold text-emerald-400">${fmt(s.v)}</span>
                                    <button onclick="removerPeca('${d.id}', ${i})" class="text-rose-500 opacity-40">✕</button>
                                </div>
                            </div>`).join('')}
                    </div>
                </div>`;
        });
    });
}

window.adicionarPeca = async (id) => {
    const { value: f } = await Swal.fire({
        title: 'Adicionar Item/Peça',
        html: '<input id="sn" class="swal2-input" placeholder="Ex: Monitor 144hz"><input id="sv" class="swal2-input" type="number" placeholder="Valor">',
        preConfirm: () => ({ n: document.getElementById('sn').value, v: parseFloat(document.getElementById('sv').value) })
    });
    if(f && f.n) {
        const docRef = doc(db, "metas", id), m = (await getDoc(docRef)).data();
        const novas = [...(m.submetas || []), f];
        await updateDoc(docRef, { submetas: novas, pago: (m.pago || 0) + f.v });
        confetti({ particleCount: 100, spread: 70, colors: ['#a855f7'] });
    }
};

window.removerPeca = async (id, idx) => {
    const docRef = doc(db, "metas", id), m = (await getDoc(docRef)).data();
    const vRem = m.submetas[idx].v, novas = m.submetas.filter((_, i) => i !== idx);
    await updateDoc(docRef, { submetas: novas, pago: m.pago - vRem });
};

window.deletarMeta = async (id) => { if(confirm("Deseja apagar esta meta permanentemente?")) await deleteDoc(doc(db, "metas", id)); };

// --- ENGINE DE REGISTROS (RAIO-X E PARCELAS) ---
document.getElementById('checkFixo').onchange = (e) => document.getElementById('qtdParcelas').classList.toggle('hidden', !e.target.checked);

window.salvar = async () => {
    const n = document.getElementById('masterInput').value, v = parseFloat(document.getElementById('valManual').value), 
          data = document.getElementById('dateManual').value || new Date().toISOString().split('T')[0];
    if(!n || isNaN(v)) return Swal.fire("Campos Vazios", "Preencha a descrição e o valor.", "warning");

    if(document.getElementById('checkFixo').checked) {
        const parcelas = parseInt(document.getElementById('qtdParcelas').value) || 12;
        for(let i=0; i<parcelas; i++) {
            let d = new Date(data); d.setMonth(d.getMonth() + i);
            await addDoc(collection(db, "fluxo"), { nome: `${n} (${i+1}/${parcelas})`, valor: v, data: d.toISOString().split('T')[0], tipo: tAtual, userId: userUID, ts: serverTimestamp() });
        }
    } else {
        await addDoc(collection(db, "fluxo"), { nome: n, valor: v, data, tipo: tAtual, userId: userUID, ts: serverTimestamp() });
    }
    
    document.getElementById('masterInput').value = ''; document.getElementById('valManual').value = '';
    confetti({ particleCount: 80, spread: 50, origin: { y: 0.8 } });
};

function initData() {
    onSnapshot(query(collection(db, "fluxo"), where("userId", "==", userUID)), snap => {
        let r=0, d=0, gastosMes = 0;
        const items = [], mesAtual = new Date().getMonth();
        
        snap.forEach(doc => {
            const item = doc.data();
            const dataItem = new Date(item.data);
            if(item.tipo === 'ganho') r += item.valor; 
            else {
                d += item.valor;
                if(dataItem.getMonth() === mesAtual) gastosMes += item.valor;
            }
            items.push({...item, id: doc.id});
        });
        updateUI(r, d, gastosMes, items);
    });
}

function updateUI(r, d, gastosMes, items) {
    const saldo = r - d;
    document.getElementById('saldoReal').innerText = fmt(saldo);
    document.getElementById('totalGastosMes').innerText = fmt(gastosMes);
    document.getElementById('totalLivre').innerText = fmt(saldo > 0 ? saldo : 0);
    document.getElementById('hpFill').style.width = Math.min(100, (saldo/r)*100) + '%';
    
    const feed = document.getElementById('feed');
    feed.innerHTML = '';
    items.sort((a,b) => new Date(b.data) - new Date(a.data)).slice(0,8).forEach(i => {
        feed.innerHTML += `
            <div class="glass p-5 flex justify-between items-center border-l-2 ${i.tipo==='ganho'?'border-emerald-500':'border-rose-500'} card-anim">
                <div><p class="text-[10px] font-black uppercase tracking-widest">${i.nome}</p><p class="text-[8px] opacity-30">${i.data}</p></div>
                <div class="text-right">
                    <p class="money font-bold ${i.tipo==='ganho'?'text-emerald-400':'text-rose-400'}">${fmt(i.valor)}</p>
                    <button onclick="deletarItem('${i.id}')" class="text-[8px] text-rose-500 opacity-20 hover:opacity-100">REMOVER</button>
                </div>
            </div>`;
    });

    const m = document.getElementById('textoMentor');
    if(saldo < 0) m.innerHTML = "STATUS CRÍTICO. Você está operando no negativo. O Mentor sugere pausar todos os gastos variáveis imediatamente para proteger seu patrimônio.";
    else if(gastosMes > r * 0.7) m.innerHTML = "CUIDADO. Seus gastos este mês já consumiram 70% da sua renda. Evite novas parcelas até o próximo ciclo.";
    else m.innerHTML = "SITUAÇÃO SAUDÁVEL. Seu balanço está positivo. Este é o momento ideal para injetar capital em suas metas de hardware ou investimentos fixos.";
}

window.deletarItem = async (id) => await deleteDoc(doc(db, "fluxo", id));

function initChart() {
    const ctx = document.getElementById('meuGrafico').getContext('2d');
    if(chart) chart.destroy();
    chart = new Chart(ctx, {
        type: 'line',
        data: { labels: ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'], datasets: [{ data: [1200, 2100, 1800, 2900], borderColor: '#a855f7', tension: 0.4, fill: true, backgroundColor: 'rgba(168, 85, 247, 0.05)' }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { display: false }, x: { grid: { display: false }, ticks: { color: '#ffffff20', font: { size: 9 } } } } }
    });
}

window.mudarTipo = (t) => {
    tAtual = t;
    document.getElementById('t-div').className = t === 'divida' ? 'text-[10px] px-6 py-2.5 rounded-xl bg-purple-600 font-black' : 'text-[10px] px-6 py-2.5 rounded-xl opacity-20 font-black';
    document.getElementById('t-gan').className = t === 'ganho' ? 'text-[10px] px-6 py-2.5 rounded-xl bg-purple-600 font-black' : 'text-[10px] px-6 py-2.5 rounded-xl opacity-20 font-black';
};
