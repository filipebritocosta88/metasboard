// DADOS INICIAIS
let contas = [];
let dividas = [];
let metas = [];

// MOSTRAR SEÇÃO
function showSection(section) {
  const sections = ['dashboard','metas','contas','dividas','perfil'];
  sections.forEach(sec => {
    document.getElementById(sec).style.display = (sec === section) ? 'block' : 'none';
  });
  atualizarDashboard();
  atualizarTabelas();
}

// LOGOUT (simples)
function logout() {
  alert("Você saiu!");
}

// ADICIONAR CONTA
function adicionarConta() {
  const banco = prompt("Nome do banco:");
  const tipo = prompt("Tipo da conta:");
  const saldo = parseFloat(prompt("Saldo inicial:"));
  contas.push({banco,tipo,saldo});
  atualizarTabelas();
  atualizarDashboard();
}

// ADICIONAR DÍVIDA
function adicionarDivida() {
  const banco = prompt("Banco ou credor:");
  const tipo = prompt("Tipo de dívida:");
  const valor = parseFloat(prompt("Valor:"));
  const vencimento = prompt("Data de vencimento (dd/mm/yyyy):");
  const status = "Pendente";
  dividas.push({banco,tipo,valor,vencimento,status});
  atualizarTabelas();
  atualizarDashboard();
}

// ADICIONAR META
function adicionarMeta() {
  const descricao = prompt("Descrição da meta:");
  const valor = parseFloat(prompt("Valor da meta:"));
  const progresso = 0;
  metas.push({descricao,valor,progresso});
  atualizarMetas();
}

// ATUALIZAR DASHBOARD
function atualizarDashboard() {
  const totalContas = contas.reduce((acc,c)=> acc + c.saldo,0);
  const totalDividas = dividas.reduce((acc,d)=> acc + d.valor,0);
  const saldoLiquido = totalContas - totalDividas;
  document.getElementById('totalContas').innerText = `Total em contas: R$ ${totalContas}`;
  document.getElementById('totalDividas').innerText = `Total de dívidas: R$ ${totalDividas}`;
  document.getElementById('saldoLiquido').innerText = `Saldo líquido: R$ ${saldoLiquido}`;
}

// ATUALIZAR TABELAS
function atualizarTabelas() {
  // CONTAS
  const contasTable = document.getElementById('contasTable');
  contasTable.innerHTML = `<tr>
    <th>Banco / Conta</th>
    <th>Tipo</th>
    <th>Saldo</th>
    <th>Ações</th>
  </tr>`;
  contas.forEach((c,i)=>{
    contasTable.innerHTML += `<tr>
      <td>${c.banco}</td>
      <td>${c.tipo}</td>
      <td>${c.saldo}</td>
      <td><button onclick="editarConta(${i})">Editar</button></td>
    </tr>`;
  });

  // DÍVIDAS
  const dividasTable = document.getElementById('dividasTable');
  dividasTable.innerHTML = `<tr>
    <th>Banco / Credor</th>
    <th>Tipo</th>
    <th>Valor</th>
    <th>Vencimento</th>
    <th>Status</th>
    <th>Ações</th>
  </tr>`;
  dividas.forEach((d,i)=>{
    dividasTable.innerHTML += `<tr>
      <td>${d.banco}</td>
      <td>${d.tipo}</td>
      <td>${d.valor}</td>
      <td>${d.vencimento}</td>
      <td>${d.status}</td>
      <td><button onclick="pagarDivida(${i})">Pagar</button></td>
    </tr>`;
  });
}

// ATUALIZAR METAS
function atualizarMetas() {
  const metasList = document.getElementById('metasList');
  metasList.innerHTML = "";
  metas.forEach((m,i)=>{
    metasList.innerHTML += `<p>${m.descricao} - R$ ${m.valor} - Progresso: ${m.progresso}</p>`;
  });
}

// EDITAR CONTA
function editarConta(index) {
  const novoSaldo = parseFloat(prompt("Novo saldo:", contas[index].saldo));
  contas[index].saldo = novoSaldo;
  atualizarTabelas();
  atualizarDashboard();
}

// PAGAR DÍVIDA
function pagarDivida(index) {
  if(confirm(`Deseja pagar a dívida de R$ ${dividas[index].valor}?`)) {
    dividas[index].status = "Paga";
    atualizarTabelas();
    atualizarDashboard();
  }
}

// INÍCIO
showSection('dashboard');
