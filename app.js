<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>MetasBoard | Intelligence v5.5</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
  <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Inter:wght@300;400;600;800&display=swap" rel="stylesheet">
  <style>
    :root { --p: #a855f7; --bg: #050505; }
    body { background: var(--bg); color: #fff; font-family: 'Inter', sans-serif; margin: 0; -webkit-tap-highlight-color: transparent; }
    .font-orbitron { font-family: 'Orbitron', sans-serif; }
    .glass { background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 24px; backdrop-filter: blur(15px); }
    
    .nav-active { color: var(--p); opacity: 1 !important; transform: translateY(-5px); }
    .nav-active::after { content: ''; position: absolute; bottom: -12px; width: 14px; height: 4px; background: var(--p); left: 50%; transform: translateX(-50%); border-radius: 10px; box-shadow: 0 0 15px var(--p); }
    
    input, select { background: rgba(255,255,255,0.06) !important; border: 1px solid rgba(255,255,255,0.1) !important; color: white !important; border-radius: 16px !important; outline: none !important; padding: 14px !important; }
    .btn-main { background: linear-gradient(135deg, #a855f7, #7c3aed); font-weight: 800; border-radius: 16px; cursor: pointer; transition: 0.2s; border: none; }
    .btn-main:active { transform: scale(0.96); }

    .heatmap-day { width: 12%; aspect-ratio: 1; border-radius: 8px; margin: 1%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; cursor: pointer; border: 1px solid rgba(255,255,255,0.05); }
    .hidden { display: none !important; }
    .blur-mode .money { filter: blur(12px); opacity: 0.2; }

    /* Estilo de Ranking de Metas */
    .meta-rank-1 { border-left: 4px solid #fcd34d; } /* Ouro/Prioridade */
    .progress-fill { height: 100%; transition: width 0.5s ease-in-out; }
    
    /* Scroll customizado */
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-thumb { background: var(--p); border-radius: 10px; }
  </style>
</head>
<body>

<div id="loginTela" class="fixed inset-0 z-[1000] bg-black flex flex-col items-center justify-center p-8">
    <h1 class="font-orbitron text-4xl mb-2 tracking-widest">METAS<span class="text-purple-500">BOARD</span></h1>
    <div class="glass p-8 w-full max-w-sm space-y-4">
        <input id="email" type="email" placeholder="E-mail" class="w-full">
        <input id="senha" type="password" placeholder="Senha" class="w-full">
        <button onclick="executarAuth()" id="btnAuth" class="btn-main w-full py-4 text-[12px] uppercase tracking-widest">Entrar</button>
        <p onclick="alternarAuth()" class="text-center text-[10px] opacity-40 uppercase font-black cursor-pointer py-2">Criar Conta</p>
    </div>
</div>

<div id="app" class="hidden min-h-screen pb-32">
    <header class="p-8 flex justify-between items-center max-w-2xl mx-auto sticky top-0 z-50 bg-[#050505]/90 backdrop-blur-xl">
        <div class="flex flex-col">
            <h2 class="font-orbitron text-lg">METAS<span class="text-purple-500">BOARD</span></h2>
            <span id="dataRef" class="text-[9px] text-purple-400 font-black uppercase mt-1"></span>
        </div>
        <button onclick="document.body.classList.toggle('blur-mode')" class="glass p-3">👁️</button>
    </header>

    <main class="max-w-xl mx-auto px-6 space-y-6">
        
        <section id="secHome" class="space-y-6">
            <div class="glass p-6 border-b-2 border-purple-500/20 bg-gradient-to-br from-purple-900/10 via-transparent to-transparent">
                <div class="flex justify-between items-start mb-6">
                    <div>
                        <p class="text-[8px] opacity-40 uppercase font-black tracking-widest">Carteira (Hoje)</p>
                        <h3 id="saldoReal" class="money font-orbitron text-3xl">R$ 0</h3>
                    </div>
                    <div class="text-right">
                        <p class="text-[8px] opacity-40 uppercase font-black text-purple-400">Previsto Mês</p>
                        <h4 id="saldoPrevisto" class="money font-orbitron text-lg text-purple-300">R$ 0</h4>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div class="bg-emerald-500/5 p-4 rounded-2xl border border-emerald-500/10">
                        <p class="text-[7px] opacity-50 uppercase text-emerald-400">Entradas Mês</p>
                        <p id="rendaMes" class="text-[12px] font-black">R$ 0</p>
                    </div>
                    <div class="bg-rose-500/5 p-4 rounded-2xl border border-rose-500/10">
                        <p class="text-[7px] opacity-50 uppercase text-rose-400">Saídas Mês</p>
                        <p id="gastoMes" class="text-[12px] font-black">R$ 0</p>
                    </div>
                </div>

                <button onclick="abrirDetalheProximoMes()" class="w-full glass p-4 rounded-2xl flex justify-between items-center border border-white/5">
                    <div class="text-left">
                        <p class="text-[7px] opacity-40 uppercase">Projeção Próximo Mês</p>
                        <p id="resumoProxMes" class="text-[12px] font-bold text-orange-400">R$ 0</p>
                    </div>
                    <span class="text-[9px] font-black bg-white/10 px-3 py-1 rounded-full">DETALHES</span>
                </button>
            </div>

            <div class="glass p-6 space-y-4">
                <div class="flex justify-between items-center">
                    <div class="flex bg-black/40 p-1.5 rounded-2xl">
                        <button onclick="mudarTipo('divida')" id="t-div" class="text-[9px] px-6 py-2 rounded-xl bg-purple-600 font-black">DÉBITO</button>
                        <button onclick="mudarTipo('ganho')" id="t-gan" class="text-[9px] px-6 py-2 rounded-xl opacity-20 font-black">CRÉDITO</button>
                    </div>
                    <button id="audioBtn" onclick="toggleAudio()" class="glass w-14 h-14 flex items-center justify-center text-2xl border-none">🎤</button>
                </div>
                <input id="masterInput" type="text" placeholder="O que você comprou?" class="w-full">
                <div class="flex gap-2">
                    <input id="valManual" type="number" placeholder="Valor R$" class="w-1/2">
                    <input id="dateManual" type="date" class="w-1/2">
                </div>
                <div class="flex items-center gap-2 px-1">
                    <input type="checkbox" id="checkParcela" class="w-4 h-4 accent-purple-600">
                    <label class="text-[10px] opacity-40 uppercase font-black">Parcelar compra</label>
                    <input id="numParcelas" type="number" placeholder="Meses" class="hidden w-16 !p-2 text-center text-[10px]">
                </div>
                <button onclick="salvar()" class="btn-main w-full py-5 text-[11px] uppercase tracking-widest">Confirmar Lançamento</button>
            </div>
            
            <div id="feed" class="space-y-3"></div>
        </section>

        <section id="secMetas" class="hidden space-y-6">
            <div class="flex justify-between items-center px-2">
                <h3 class="font-orbitron text-[10px] uppercase tracking-widest">Ranking de Sonhos</h3>
                <button onclick="abrirModalMeta()" class="btn-main px-6 py-2 text-[9px]">+ Nova Meta</button>
            </div>
            <div id="listaMetas" class="space-y-4 pb-10"></div>
        </section>

        <section id="secGestao" class="hidden space-y-6">
            <div class="glass p-6 space-y-4">
                <div class="flex justify-between items-center">
                    <h4 class="text-[10px] font-black uppercase text-purple-400">Histórico de Movimentações</h4>
                    <input type="month" id="filtroMes" onchange="initData()" class="!p-2 text-[10px]">
                </div>
                <div id="listaDividasFull" class="space-y-2 max-h-96 overflow-y-auto pr-2"></div>
            </div>

            <div class="glass p-6 space-y-4">
                <h4 class="text-[10px] font-black uppercase text-emerald-500">Renda Fixa Mensal</h4>
                <div id="statusSalario" class="space-y-3"></div>
            </div>

            <div class="glass p-6 space-y-4">
                <h4 class="text-[10px] font-black uppercase text-rose-500">Dívidas Fixas (Recorrentes)</h4>
                <div id="statusDividaFixa" class="space-y-3"></div>
                <button onclick="abrirModalDividaFixa()" class="w-full py-3 border border-white/10 rounded-xl text-[9px] opacity-50">+ Add Conta Fixa</button>
            </div>
        </section>

        <section id="secSimulador" class="hidden space-y-6">
            <div class="glass p-6 bg-emerald-500/5">
                <h4 class="text-[10px] font-black uppercase mb-4 tracking-widest text-emerald-400">🔮 Simulador de Futuro</h4>
                <div class="space-y-4">
                    <p class="text-[8px] opacity-50 uppercase">Quanto você pode investir por mês?</p>
                    <input id="inputInvest" type="number" value="100" class="w-full" oninput="calcularSimulador()">
                    <div class="grid grid-cols-3 gap-2">
                        <div class="bg-black/40 p-3 rounded-xl text-center"><p class="text-[7px] opacity-40 uppercase">6 Meses</p><p id="sim6" class="text-[10px] font-black text-emerald-400">--</p></div>
                        <div class="bg-black/40 p-3 rounded-xl text-center"><p class="text-[7px] opacity-40 uppercase">1 Ano</p><p id="sim12" class="text-[10px] font-black text-emerald-400">--</p></div>
                        <div class="bg-black/40 p-3 rounded-xl text-center"><p class="text-[7px] opacity-40 uppercase">5 Anos</p><p id="sim60" class="text-[10px] font-black text-emerald-400">--</p></div>
                    </div>
                </div>
            </div>

            <div class="glass p-6">
                <div class="flex justify-between items-center mb-6">
                    <h4 class="text-[10px] font-black uppercase">🗺️ Mapa de Gastos</h4>
                    <div class="flex items-center gap-3">
                        <button onclick="mudarMesCalor(-1)" class="text-lg opacity-50">◀</button>
                        <span id="calorDataRef" class="text-[9px] font-black uppercase">Mar 2026</span>
                        <button onclick="mudarMesCalor(1)" class="text-lg opacity-50">▶</button>
                    </div>
                </div>
                <div id="heatmap" class="flex flex-wrap justify-center"></div>
            </div>

            <div class="glass p-6 space-y-4 border border-emerald-500/20">
                <h4 class="text-[10px] font-black uppercase text-center text-emerald-500">🌍 Conversor Global Real-Time</h4>
                <div class="flex gap-2">
                    <input id="convReal" type="number" placeholder="Valor em R$" class="w-1/2" oninput="converterMoeda()">
                    <select id="moedaDestino" onchange="converterMoeda()" class="w-1/2">
                        <option value="5.12">🇺🇸 Dólar (USD)</option>
                        <option value="5.58">🇪🇺 Euro (EUR)</option>
                        <option value="6.45">🇬🇧 Libra (GBP)</option>
                        <option value="0.034">🇯🇵 Iene (JPY)</option>
                        <option value="3.50">🇦🇪 Dirham (AED)</option>
                        <option value="0.005">🇦🇷 Peso (ARS)</option>
                    </select>
                </div>
                <div class="text-center p-6 bg-emerald-500/5 rounded-2xl">
                    <p id="resConversao" class="text-2xl font-orbitron text-emerald-400">0.00</p>
                    <p class="text-[8px] opacity-30 mt-2">Câmbio comercial atualizado</p>
                </div>
            </div>

            <div class="glass p-8 bg-purple-500/5">
                <h4 class="text-[10px] font-black uppercase mb-3 text-purple-400">🛰️ Análise GPS</h4>
                <div class="flex items-end gap-3 mb-4">
                    <p id="scoreGPS" class="text-3xl font-orbitron">--</p>
                    <p class="text-[10px] opacity-50 pb-1">/ 10</p>
                </div>
                <p id="textoGPS" class="text-[11px] opacity-70 italic leading-relaxed"></p>
            </div>
        </section>

    </main>

    <nav class="fixed bottom-0 left-0 right-0 glass rounded-none border-t border-white/10 p-6 flex justify-around items-center z-50">
        <button onclick="nav('secHome', this)" class="nav-active flex flex-col items-center gap-1 opacity-40 transition-all relative"><span class="text-xl">🏠</span><p class="text-[8px] font-black uppercase">Home</p></button>
        <button onclick="nav('secMetas', this)" class="flex flex-col items-center gap-1 opacity-40 transition-all relative"><span class="text-xl">🎯</span><p class="text-[8px] font-black uppercase">Metas</p></button>
        <button onclick="nav('secGestao', this)" class="flex flex-col items-center gap-1 opacity-40 transition-all relative"><span class="text-xl">📊</span><p class="text-[8px] font-black uppercase">Gestão</p></button>
        <button onclick="nav('secSimulador', this)" class="flex flex-col items-center gap-1 opacity-40 transition-all relative"><span class="text-xl">🔮</span><p class="text-[8px] font-black uppercase">Futuro</p></button>
    </nav>
</div>

<script type="module" src="app.js"></script>
</body>
</html>
