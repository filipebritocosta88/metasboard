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

let userUID = null, modoRegistro = false, tipoAtual = 'ganho', chart = null;
let fin = { ganhos: 0, dividas: 0, lista: [], previsto: 0 };
let metas = [];

const BRL = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// --- LÓGICA DO 5º DIA ÚTIL ---
function getQuintoDiaUtil() {
    let data = new Date();
    data.setDate(1);
    let diasUteis = 0;
    while (diasUteis < 5) {
        let diaSemana = data.getDay();
        if (diaSemana !== 0 && diaSemana !== 6) diasUteis++;
        if (diasUteis < 5) data.setDate(data.getDate() + 1);
    }
    return data;
}

// --- AUTH ---
window.alternarModoAuth = () => {
    modoRegistro = !modoRegistro;
    document.getElementById('btnAuth').innerText = modoRegistro ? 'Criar Conta' : 'Acessar';
    document.getElementById('containerConfirmar').classList.toggle('hidden', !modoRegistro);
    document.getElementById('btnTrocar').innerText = modoRegistro ? 'Já tenho conta' : 'Criar Conta';
};

window.executarAuth = () => {
    const e = document.getElementById('email').value, s = document.getElementById('senha').value;
    if (modoRegistro) {
        if(s !== document.getElementById('senhaConfirm').value) return alert('Senhas não coincidem');
        createUserWithEmailAndPassword(auth, e, s).catch(err => alert(err.message));
    } else {
        signInWithEmailAndPassword(auth, e, s).catch(() => alert('Falha no login'));
    }
};

window.sairDoSistema = () => signOut(auth).then(() => location.reload());

onAuthStateChanged(auth, user => {
    if (user) { 
        userUID = user.uid; 
        document.getElementById('loginTela').classList.add('hidden'); 
        document.getElementById('dashboard').classList.remove('hidden'); 
        iniciarRealtime(); 
    } else { 
        document.getElementById('loginTela').classList.remove('hidden'); 
    }
});

// --- ENGINE PRINCIPAL ---
function iniciarRealtime() {
    onSnapshot(query(collection(db, "fluxo"), where("userId", "==", userUID)), snap => {
        let g = 0, d = 0, p = 0; fin.lista = [];
        const hoje = new Date(); hoje.setHours(0,0,0,0);

        snap.forEach(ds => {
            const item = { ...ds.data(), id: ds.id };
            const dataItem = new Date(item.data + 'T00:00:00');

            if (item.status !== 'paga') {
                if (item.tipo === 'ganho') {
                    if (dataItem <= hoje) g += item.valor; else p += item.valor;
                } else {
                    d += item.valor;
                }
            }
            fin.lista.push(item);
        });
        fin.ganhos = g; fin.dividas = d; fin.previsto = p;
        atualizarUI();
    });

    onSnapshot(query(collection(db, "metas"), where("userId", "==", userUID)), snap => {
        const grid = document.getElementById('rankingGrid'); grid.innerHTML = "";
        snap.forEach(ds => {
            const m = { ...ds.data(), id: ds.id };
            if (m.status !== 'concluida') {
                const perc = Math.min(100, (m.atual / m.alvo) * 100);
                grid.innerHTML += `
                <div class="glass-card p-6 border-l-4 border-purple-500">
                    <div class="flex justify-between items-start mb-2"><h4 class="text-xs font-black uppercase italic">${m.nome}</h4><b>${perc.toFixed(0)}%</b></div>
                    <div class="hp-bar mb-4"><div class="hp-fill bg-purple-600" style="width: ${perc}%"></div></div>
                    <button onclick="aportarMeta('${m.id}', ${m.atual}, ${m.alvo})" class="w-full bg-white/5 py-3 rounded-xl text-[9px] font-black uppercase">Aportar Valor</button>
                </div>`;
            }
        });
    });
}

// --- UI E MENTOR INTELIGENTE ---
function atualizarUI() {
    document.getElementById('receitaTotal').innerText = BRL(fin.ganhos);
    document.getElementById('despesaTotal').innerText = BRL(fin.dividas);
    const saldoFinal = fin.ganhos - fin.dividas;
    document.getElementById('saldoTotal').innerText = BRL(saldoFinal);
    
    // Mentor Estratégico Avançado
    const hoje = new Date();
    const quintoDia = getQuintoDiaUtil();
    const diasFaltam = Math.ceil((quintoDia - hoje) / (1000 * 60 * 60 * 24));
    const mentorEl = document.getElementById('mentorTexto');
    
    let conselho = "";
    if (diasFaltam > 0 && fin.previsto > 0) {
        const reservaMeta = fin.previsto * 0.2;
        conselho = `Seu salário de ${BRL(fin.previsto)} cai em ${diasFaltam} dias úteis. Minha dica: reserve ${BRL(reservaMeta)} para suas metas assim que receber!`;
        const vencemAntes = fin.lista.filter(i => i.tipo === 'divida' && new Date(i.data) < quintoDia);
        if(vencemAntes.length > 0) conselho += ` ⚠️ Atenção: ${vencemAntes.length} contas vencem antes do salário.`;
    } else if (fin.ganhos > fin.dividas) {
        conselho = "Saldo positivo! É o momento ideal para turbinar uma de suas metas.";
    } else {
        conselho = "Fluxo apertado. Evite gastos extras até o próximo registro de renda.";
    }
    mentorEl.innerText = conselho;

    const hpPerc = Math.max(0, 100 - (fin.dividas / (fin.ganhos + fin.previsto || 1) * 100));
    document.getElementById('hpFill').style.width = hpPerc + "%";
    document.getElementById('hpStatus').innerText = hpPerc > 50 ? "Estável" : "Alerta";

    // Timeline
    const t = document.getElementById('listaTimeline'); t.innerHTML = "";
    fin.lista.sort((a,b) => new Date(a.data) - new Date(b.data)).forEach(i => {
        const itemData = new Date(i.data + 'T00:00:00');
        const isPrevisto = i.tipo === 'ganho' && itemData > hoje;
        t.innerHTML += `
        <div onclick="abrirAcao('${i.id}', '${i.nome}')" class="glass-card p-5 flex justify-between border-l-4 ${i.tipo === 'ganho' ? 'border-emerald-500' : 'border-rose-500'} ${isPrevisto ? 'opacity-40' : ''}">
            <div><h4 class="text-xs font-black uppercase italic">${i.nome} ${isPrevisto ? '⏳' : ''}</h4><p class="text-[9px] opacity-40">${i.data}</p></div>
            <b class="text-xs ${i.tipo === 'ganho' ? 'text-emerald-400' : 'text-rose-500'}">${BRL(i.valor)}</b>
        </div>`;
    });
}

// --- FUNÇÕES DE REGISTRO ---
window.salvarLancamento = async () => {
    const n = document.getElementById('fNome').value, v = Number(document.getElementById('fValor').value);
    let d = document.getElementById('fData').value;
    if (document.getElementById('checkQuintoDia').checked) d = getQuintoDiaUtil().toISOString().split('T')[0];

    if (n && v && d) {
        await addDoc(collection(db, "fluxo"), { nome: n, valor: v, data: d, tipo: tipoAtual, status: 'pendente', userId: userUID });
        document.getElementById('fNome').value = ""; document.getElementById('fValor').value = "";
    }
};

window.abrirAcao = async (id, nome) => {
    const { value: a } = await Swal.fire({ title: nome, input: 'select', inputOptions: { paga: '✅ Confirmar', del: '🗑️ Deletar' }, background: '#0a0c14', color: '#fff' });
    if(a === 'paga') await updateDoc(doc(db, "fluxo", id), { status: 'paga' });
    else if(a === 'del') await deleteDoc(doc(db, "fluxo", id));
};

// --- NAVEGAÇÃO E METAS ---
window.navegar = (id, btn) => {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-btn-m').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if(id === 'secGestao') renderGestao();
};

window.aportarMeta = async (id, atual, alvo) => {
    const { value: v } = await Swal.fire({ title: 'Aportar quanto?', input: 'number', background: '#0a0c14', color: '#fff' });
    if(v) {
        const novo = atual + Number(v);
        await updateDoc(doc(db, "metas", id), { atual: novo });
        if(novo >= alvo) {
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
            await updateDoc(doc(db, "metas", id), { status: 'concluida' });
        }
    }
};

window.verMetasConcluidas = () => {
    onSnapshot(query(collection(db, "metas"), where("userId", "==", userUID), where("status", "==", "concluida")), snap => {
        let h = `<div class="space-y-2">`;
        snap.forEach(d => { h += `<div class="p-4 glass-card text-emerald-400 text-[10px] font-black uppercase">🏆 ${d.data().nome}</div>`; });
        Swal.fire({ title: 'BATIDAS', html: h || 'Nenhuma meta concluída.', background: '#0a0c14', color: '#fff' });
    });
};

// --- HISTÓRICO MULTIPLO ---
window.abrirHistorico = () => {
    let html = `<div class="text-left"><div class="flex justify-between mb-4 border-b border-white/10 pb-2"><button onclick="marcarTodos()" class="text-[9px] font-black text-purple-400 uppercase">Todos</button><button onclick="apagarM()" class="text-[9px] font-black text-rose-500 uppercase">Apagar</button></div><div id="listaH" class="space-y-2 max-h-72 overflow-y-auto">`;
    fin.lista.forEach(i => {
        html += `<label class="flex items-center gap-3 p-4 bg-white/5 rounded-2xl"><input type="checkbox" value="${i.id}" class="h-chk"><div><p class="text-[10px] font-black uppercase">${i.nome}</p><p class="text-[8px] opacity-40">${BRL(i.valor)}</p></div></label>`;
    });
    Swal.fire({ title: 'HISTÓRICO', html: html + '</div></div>', showConfirmButton: false, background: '#0a0c14', color: '#fff' });
};

window.marcarTodos = () => document.querySelectorAll('.h-chk').forEach(c => c.checked = !c.checked);
window.apagarM = async () => {
    const ids = Array.from(document.querySelectorAll('.h-chk:checked')).map(c => c.value);
    for(const id of ids) await deleteDoc(doc(db, "fluxo", id));
    Swal.close();
};

// --- CHAT IA ---
window.toggleChat = () => {
    const w = document.getElementById('chatWindow');
    w.style.display = w.style.display === 'flex' ? 'none' : 'flex';
};

window.aiMenu = (op) => {
    const c = document.getElementById('chatContent');
    let r = "";
    if(op === 'tutorial') r = "Use a Home para agendar dívidas e rendas. O Mentor avisará quando o dinheiro estiver disponível.";
    if(op === 'conversao') r = `R$ 100 hoje valem aprox. $ 19.50 USD.`;
    if(op === 'dicas') r = "Dica: Tente manter suas dívidas fixas abaixo de 50% do seu salário total.";
    if(op === 'analise') r = `Dívidas: ${BRL(fin.dividas)}. Renda prevista: ${BRL(fin.previsto)}.`;
    c.innerHTML += `<p class="bg-purple-600/40 p-3 rounded-2xl self-end text-white">${r}</p>`;
    c.scrollTop = c.scrollHeight;
};

function renderGestao() {
    const ctx = document.getElementById('chartGestao');
    if(chart) chart.destroy();
    const divs = fin.lista.filter(f => f.tipo === 'divida');
    document.getElementById('totalGestao').innerText = BRL(fin.dividas);
    chart = new Chart(ctx, { type: 'doughnut', data: { datasets: [{ data: divs.map(d => d.valor), backgroundColor: ['#a855f7','#7c3aed','#6366f1','#ef4444'], borderWidth: 0 }] }, options: { cutout: '85%', plugins: { legend: { display: false } } } });
    const list = document.getElementById('listaDetalhada'); list.innerHTML = "";
    divs.forEach(d => { list.innerHTML += `<div class="flex justify-between p-4 bg-white/[0.02] border-b border-white/5"><span class="text-[10px] font-black uppercase opacity-70 italic">${d.nome}</span><span class="text-[10px] font-black text-rose-500">${BRL(d.valor)}</span></div>`; });
}

window.setTipo = (t) => {
    tipoAtual = t;
    document.getElementById('tabGanho').className = t === 'ganho' ? "text-[10px] font-black uppercase text-purple-400 border-b-2 border-purple-500 pb-1" : "text-[10px] opacity-40 pb-1";
    document.getElementById('tabDivida').className = t === 'divida' ? "text-[10px] font-black uppercase text-purple-400 border-b-2 border-purple-500 pb-1" : "text-[10px] opacity-40 pb-1";
    document.getElementById('opcoesSalario').classList.toggle('hidden', t !== 'ganho');
};

window.modalNovaMeta = async () => {
    const { value: f } = await Swal.fire({ title: 'Nova Meta', html: '<input id="mn" placeholder="Nome" class="swal2-input"><input id="ma" type="number" placeholder="Alvo R$" class="swal2-input">', background: '#0a0c14', color: '#fff', preConfirm: () => [document.getElementById('mn').value, document.getElementById('ma').value] });
    if(f && f[0]) await addDoc(collection(db, "metas"), { nome: f[0], alvo: Number(f[1]), atual: 0, status: 'ativa', userId: userUID });
};
