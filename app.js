let receita = 0;
let despesa = 0;

function atualizarTela() {
  document.getElementById("receitaTotal").innerText = "R$ " + receita;
  document.getElementById("despesaTotal").innerText = "R$ " + despesa;
  document.getElementById("saldoTotal").innerText = "R$ " + (receita - despesa);
}

function adicionarReceita() {
  const valor = parseFloat(document.getElementById("valor").value);
  if (!valor) return;

  receita += valor;
  atualizarTela();
}

function adicionarDespesa() {
  const valor = parseFloat(document.getElementById("valor").value);
  if (!valor) return;

  despesa += valor;
  atualizarTela();
}
