import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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
let userUID = null;
let financeiro = { ganhos: 0, dividas: 0, saldo: 0, metas: [], listaDividas: [] };
let chartInstance = null;

const BRL = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// --- AUTH CONTROL ---
onAuthStateChanged(auth, user => {
    if (user) {
        userUID = user.uid;
        document.getElementById("loginTela").classList.add("hidden");
        document.getElementById("dashboard").classList.remove("hidden");
        inicializarListeners();
    } else {
        document.getElementById("loginTela").classList.remove("hidden");
        document.getElementById("dashboard").classList.add("hidden");
    }
});

window.login = () => signInWithEmailAndPassword(auth, document.getElementById("email").value, document.getElementById("senha").value).catch(e => Swal.fire('Erro', 'Verifique seus dados', 'error'));
window.registrar = () => createUserWithEmailAndPassword(auth, document.getElementById("email").value, document.getElementById("senha").value).then(() => Swal.fire('Sucesso!', 'Conta criada.', 'success'));
window.logout = () => signOut(auth);

// --- NAVIGATION ---
window.mostrarSecao = (id, btn) => {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active', 'text-purple-500'));
    btn.classList.add('active', 'text-purple-500');
    if(id === 'secDividas') renderizarGraficoDividas();
};

window.togglePrivacidade = () => document.body.classList.toggle('privacy-mode');

// --- DATA LISTENERS ---
function inicializarListeners() {
    // Fluxo de Caixa (Dashboard)
    onSnapshot(query(collection(db, "fluxo"), where("userId", "==", userUID)), snap => {
        let g = 0; let d = 0;
        const lista = document.getElementById("listaFluxo"); lista.innerHTML = "";
        financeiro.listaDividas = [];
        
        snap.forEach(docSnap => {
            const item = docSnap.data();
            if(item.tipo === 'ganho') g += item.valor; 
            else { d += item.valor; financeiro.listaDividas.push({ ...item, id: docSnap.id }); }
            
            lista.innerHTML += `
                <div class="flex justify-between items-center p-4 bg-white/5 rounded-2xl border border-white/5 text-xs mb-2">
                    <span class="font-bold uppercase tracking-tighter">${item.nome}</span>
                    <div class="flex gap-4 items-center">
                        <b class="${item.tipo === 'ganho' ? 'text-emerald-400' : 'text-rose-500'}">${BRL(item.valor)}</b>
                        <button onclick="excluirItem('fluxo','${docSnap.id}')" class="text-red-500 font-black px-2">✕</button>
                    </div>
                </div>`;
        });
        financeiro.ganhos = g; financeiro.dividas = d; financeiro.saldo = g - d;
        atualizarDashboard();
        atualizarPainelDividas();
    });

    // Metas & Ranking
    onSnapshot(query(collection(db, "metas"), where("userId", "==", userUID)), snap => {
        const grid = document.getElementById("rankingGrid"); grid.innerHTML = "";
        let metasArr = [];
        snap.forEach(d => metasArr.push({ ...d.data(), id: d.id }));
        
        // ORDENAR RANKING: Quem tem maior porcentagem de conclusão
        metasArr.sort((a,b) => (b.atual/b.alvo) - (a.atual/a.alvo));
        financeiro.metas = metasArr;

        metasArr.forEach((m, idx) => {
            const perc = Math.min(100, (m.atual / m.alvo) * 100).toFixed(1);
            const medalha = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '';
            
            grid.innerHTML += `
                <div class="glass-card p-8 rounded-[40px] relative border-2 ${idx === 0 ? 'border-yellow-500 shadow-yellow-500/20' : 'border-white/5'}">
                    ${medalha ? `<span class="ranking-medal">${medalha}</span>` : ''}
                    <div class="mb-6">
                        <h4 class="text-xl font-black italic uppercase tracking-tighter">${m.nome}</h4>
                        <p class="text-[10px] text-slate-500 font-bold">POSIÇÃO NO RANKING: #${idx + 1}</p>
                    </div>
                    <div class="h-4 bg-black/50 rounded-full overflow-hidden mb-4 border border-white/5">
                        <div class="meta-bar h-full bg-gradient-to-r from-yellow-600 to-yellow-400" style="width: ${perc}%"></div>
                    </div>
                    <div class="flex justify-between items-center mb-6">
                        <span class="text-2xl font-black italic money-val">${BRL(m.atual)}</span>
                        <span class="text-yellow-500 font-black">${perc}%</span>
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                        <button onclick="ajustarMeta('${m.id}', ${m.atual}, 'add')" class="bg-emerald-600 p-3 rounded-xl font-black text-xs hover:bg-emerald-500">+ DEPÓSITO</button>
                        <button onclick="ajustarMeta('${m.id}', ${m.atual}, 'sub')" class="bg-white/5 p-3 rounded-xl font-black text-xs hover:bg-rose-900">- RETIRAR</button>
                    </div>
                    <div class="flex justify-between mt-4">
                        <button onclick="editarMeta('${m.id}', '${m.nome}', ${m.alvo})" class="text-[9px] text-slate-500 font-black hover:text-white uppercase">Editar Alvo</button>
                        <button onclick="excluirItem('metas','${m.id}')" class="text-[9px] text-slate-500 font-black hover:text-red-500 uppercase">Apagar Meta</button>
                    </div>
                </div>`;
        });
    });
}

// --- ACTIONS: FLUXO ---
window.adicionarFluxo = async () => {
    const nome = document.getElementById("fluxoNome").value;
    const valor = Number(document.getElementById("fluxoValor").value);
    const tipo = document.getElementById("fluxoTipo").value;
    if(!nome || valor <= 0) return Swal.fire('Atenção', 'Preencha os campos corretamente.', 'warning');
    await addDoc(collection(db, "fluxo"), { nome, valor, tipo, userId: userUID, data: Date.now() });
    document.getElementById("fluxoNome").value = ""; document.getElementById("fluxoValor").value = "";
    Swal.fire({ icon: 'success', title: 'Registrado!', toast: true, position: 'top-end', timer: 2000, showConfirmButton: false });
};

// --- ACTIONS: METAS ---
window.abrirModalMeta = async () => {
    const { value: formValues } = await Swal.fire({
        title: 'QUAL É O SEU SONHO?',
        html: '<input id="sw-n" class="swal2-input" placeholder="Nome da Meta"><input id="sw-v" type="number" class="swal2-input" placeholder="Valor Alvo R$">',
        focusConfirm: false,
        preConfirm: () => [document.getElementById('sw-n').value, document.getElementById('sw-v').value]
    });
    if(formValues && formValues[0] && formValues[1]) {
        await addDoc(collection(db, "metas"), { nome: formValues[0], alvo: Number(formValues[1]), atual: 0, userId: userUID });
        Swal.fire('META LANÇADA!', 'Ela já está no seu ranking.', 'success');
    }
};

window.ajustarMeta = async (id, atual, acao) => {
    const { value: valor } = await Swal.fire({ title: 'Valor da operação:', input: 'number', showCancelButton: true });
    if(!valor) return;
    const novo = acao === 'add' ? atual + Number(valor) : atual - Number(valor);
    await updateDoc(doc(db, "metas", id), { atual: Math.max(0, novo) });
    if(acao === 'add') Swal.fire({ icon: 'success', title: 'Grande passo!', text: 'Seu sonho está mais próximo.', toast: true, position: 'top-end', timer: 3000, showConfirmButton: false });
};

window.editarMeta = async (id, nome, alvo) => {
    const { value: novoAlvo } = await Swal.fire({ title: `Novo alvo para ${nome}:`, input: 'number', inputValue: alvo });
    if(novoAlvo) await updateDoc(doc(db, "metas", id), { alvo: Number(novoAlvo) });
};

// --- DASHBOARD IA ---
function atualizarDashboard() {
    document.getElementById("receitaTotal").innerText = BRL(financeiro.ganhos);
    document.getElementById("despesaTotal").innerText = BRL(financeiro.dividas);
    document.getElementById("saldoTotal").innerText = BRL(financeiro.saldo);

    const box = document.getElementById("iaStatusBox");
    const msg = document.getElementById("iaTexto");
    const emoji = document.getElementById("iaEmoji");
    
    if(financeiro.saldo < 0) {
        box.className = "p-10 rounded-[40px] border-2 border-rose-500 bg-rose-500/10 border-alert";
        emoji.innerText = "🚨";
        msg.innerText = `ALERTA CRÍTICO: Suas dívidas estão vencendo sua renda por ${BRL(Math.abs(financeiro.saldo))}. É hora de "vender o almoço para comprar a janta" estrategicamente. Use a aba "Onde Investir" para ver planos de emergência!`;
    } else {
        box.className = "p-10 rounded-[40px] border-2 border-purple-500 bg-purple-500/10";
        emoji.innerText = "📈";
        msg.innerText = `SAÚDE POSITIVA: Você tem ${BRL(financeiro.saldo)} livres. Se você aplicar isso hoje, está comprando tempo de liberdade no futuro. Sua meta "${financeiro.metas[0]?.nome || 'Principal'}" está esperando por esse aporte.`;
    }
}

// --- DÍVIDAS & CHART ---
function atualizarPainelDividas() {
    const list = document.getElementById("listaDividasDetalhada");
    const txt = document.getElementById("txtIncentivoDivida");
    list.innerHTML = "";
    
    if(financeiro.listaDividas.length === 0) {
        list.innerHTML = "<div class='text-center p-10 font-black text-emerald-500 uppercase'>Você está livre de dívidas! Parabéns, mestre!</div>";
        txt.innerText = "";
        return;
    }

    financeiro.listaDividas.forEach(d => {
        list.innerHTML += `
            <div class="flex justify-between items-center p-5 glass-card rounded-3xl border-l-4 border-rose-500 mb-2">
                <div><b class="uppercase text-xs tracking-tighter">${d.nome}</b></div>
                <div class="flex items-center gap-4"><b class="money-val">${BRL(d.valor)}</b></div>
            </div>`;
    });
    txt.innerText = `"Pague a si mesmo primeiro, mas nunca deixe o juro trabalhar contra você."`;
}

function renderizarGraficoDividas() {
    const ctx = document.getElementById('chartDividas');
    if(chartInstance) chartInstance.destroy();
    
    const labels = financeiro.listaDividas.map(d => d.nome);
    const valores = financeiro.listaDividas.map(d => d.valor);

    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: valores,
                backgroundColor: ['#e11d48', '#fb7185', '#9f1239', '#4c0519', '#f43f5e'],
                borderWidth: 0
            }]
        },
        options: { plugins: { legend: { display: false } }, cutout: '80%' }
    });
}

// --- ANALISE DE INVESTIMENTO PROFUNDA ---
window.analisarInvestimentoIA = () => {
    const box = document.getElementById("boxResultadoInvest");
    const texto = document.getElementById("textoInvestIA");
    const titulo = document.getElementById("tituloInvestIA");
    const saldo = financeiro.saldo;
    
    box.classList.remove("hidden");
    box.classList.add("animate-pulse");
    
    let sugestao = "";
    
    if(saldo > 0) {
        titulo.innerText = `PLANO PARA SEUS ${BRL(saldo)} LINDOS REAIS`;
        if(saldo <= 100) {
            sugestao = `
                <p><b>Opção 1: O "Giro Rápido" (Venda de Doces)</b><br>Com R$ ${saldo}, compre 1 leite condensado, 1 chocolate em pó e granulado. Faça 30 brigadeiros gourmet. Venda cada um a R$ 4,00. Seu saldo vira R$ 120,00 em um dia. Repita e em uma semana você terá R$ 500,00.</p>
                <p><b>Opção 2: Revenda de Acessórios</b><br>Compre cabos USB e películas de vidro no atacado (centro da cidade). Com R$ 100 você compra 10 unidades. Venda a R$ 25 cada no Marketplace. Retorno de 150%.</p>`;
        } else if(saldo <= 500) {
            sugestao = `
                <p><b>Opção 1: "Cachorro-Quente Express"</b><br>Esse valor compra pães, salsicha e molho para um final de semana. Venda na frente de uma faculdade ou praça. O lucro de alimentos gira em torno de 200%. Seus R$ 500 podem virar R$ 1.500 em 3 dias.</p>
                <p><b>Opção 2: Freelancer Digital</b><br>Use esse saldo para pagar um curso rápido de edição de vídeo ou tráfego pago. Uma única arte/vídeo para uma empresa local custa R$ 150. Em 4 trabalhos você recuperou o investimento e agora tem uma profissão.</p>`;
        } else {
            sugestao = `
                <p><b>Estratégia "Snowball"</b><br>Divida esse saldo: 50% em Fundos Imobiliários (HGLG11 ou MXRF11) para pingar aluguel todo mês na sua conta, e 50% em um negócio próprio como revenda de eletrônicos (importação rápida). Você está construindo riqueza de verdade.</p>`;
        }
    } else {
        titulo.innerText = "PLANO DE RESGATE (SALDO NEGATIVO)";
        sugestao = `
            <p class="text-rose-400 font-bold">⚠️ Atenção: Estamos em modo de guerra financeira.</p>
            <p><b>1. Desapego Estratégico:</b> Olhe ao seu redor. Aquele videogame, tênis ou móvel parado pode virar dinheiro agora no OLX. Estimativa de levantamento rápido: R$ 200 a R$ 800.</p>
            <p><b>2. Diárias de Emergência:</b> Procure restaurantes ou buffets para trabalhar como ajudante ou garçom de final de semana. A diária média é de R$ 80 a R$ 150 + janta. Em dois dias você zera esse saldo negativo de ${BRL(Math.abs(saldo))}.</p>
            <p><b>3. Panfletagem e Serviços:</b> Ofereça-se para lavar carros na sua rua ou distribuir panfletos para lojas locais. O importante é o fluxo entrar agora.</p>`;
    }

    setTimeout(() => {
        box.classList.remove("animate-pulse");
        texto.innerHTML = sugestao;
    }, 1500);
};

window.excluirItem = async (col, id) => {
    if(confirm("Deseja apagar este registro?")) await deleteDoc(doc(db, col, id));
};
