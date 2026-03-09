// CONFIG FIREBASE
const firebaseConfig = {
apiKey: "SUA_API_KEY",
authDomain: "SEU_DOMINIO",
projectId: "SEU_PROJETO"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

let usuarioAtual = null;
let grafico = null;



// LOGIN
function login(){

const email = document.getElementById("email").value;
const senha = document.getElementById("senha").value;

auth.signInWithEmailAndPassword(email, senha)
.catch(e=>alert(e.message));

}



// LOGOUT
function logout(){
auth.signOut();
}



// DETECTAR USUÁRIO
auth.onAuthStateChanged(user=>{

if(user){

usuarioAtual = user;

inicializarListeners();
definirDesafioSemanal();

}

});



// NAVEGAÇÃO
function mostrarSecao(sec){

document.querySelectorAll("main section").forEach(s=>{
s.style.display="none";
});

document.getElementById(sec).style.display="block";

}



// ADICIONAR FLUXO
function adicionarFluxo(){

const nome = document.getElementById("nomeFluxo").value;
const valor = Number(document.getElementById("valorFluxo").value);
const dia = Number(document.getElementById("diaFluxo").value);
const tipo = document.getElementById("tipoFluxo").value;

if(!nome || !valor) return alert("Preencha os campos");

db.collection("fluxo").add({

nome,
valor,
dia,
tipo,
userId: usuarioAtual.uid,
data: new Date()

});

document.getElementById("nomeFluxo").value="";
document.getElementById("valorFluxo").value="";
document.getElementById("diaFluxo").value="";

}



// LISTENERS FIREBASE
function inicializarListeners(){

db.collection("fluxo")
.where("userId","==",usuarioAtual.uid)
.onSnapshot(snapshot=>{

let ganhos = 0;
let dividas = 0;
let listaDividas = [];

snapshot.forEach(doc=>{

const d = doc.data();

if(d.tipo==="ganho"){
ganhos += d.valor;
}

if(d.tipo==="divida"){
dividas += d.valor;
listaDividas.push(d);
}

});

document.getElementById("ganhosTotal").innerText = "R$ "+ganhos.toFixed(2);
document.getElementById("dividasTotal").innerText = "R$ "+dividas.toFixed(2);

const saldo = ganhos - dividas;

document.getElementById("saldoLivre").innerText = "R$ "+saldo.toFixed(2);

atualizarMentor(ganhos, dividas, saldo);

renderizarGraficoDividas(listaDividas);

atualizarVencimentos(listaDividas);

});

}



// MENTOR FINANCEIRO
function atualizarMentor(ganhos, dividas, saldo){

let texto = "";

if(saldo < 0){

texto = "⚠️ Você está gastando mais do que ganha.";

}
else if(saldo < 500){

texto = "💡 Tente guardar pelo menos 20% da renda.";

}
else{

texto = "🚀 Você está indo muito bem financeiramente.";

}

document.getElementById("mentorTexto").innerText = texto;

}



// DESAFIO DA SEMANA
function definirDesafioSemanal(){

const desafios = [

"Fique 3 dias sem comprar nada não essencial.",
"Venda algo parado no Marketplace.",
"Corte um gasto pequeno esta semana.",
"Evite pedir delivery por 5 dias.",
"Tente economizar R$50 esta semana."

];

const desafio = desafios[Math.floor(Math.random()*desafios.length)];

document.getElementById("desafioTexto").innerText = desafio;

}



// PRÓXIMO VENCIMENTO
function atualizarVencimentos(dividas){

if(dividas.length === 0){

document.getElementById("vencimentoTexto").innerText = "Nenhum";

return;

}

dividas.sort((a,b)=>a.dia-b.dia);

const prox = dividas[0];

document.getElementById("vencimentoTexto").innerText =
prox.nome + " vence dia " + prox.dia;

}



// GRÁFICO DE DÍVIDAS
function renderizarGraficoDividas(lista){

if(grafico){
grafico.destroy();
}

const ctx = document.getElementById("graficoDividas");

if(!ctx) return;

grafico = new Chart(ctx,{

type: "doughnut",

data:{

labels: lista.map(d=>d.nome),

datasets:[{

data: lista.map(d=>d.valor)

}]

}

});

}



// IA DE INVESTIMENTO
function analisarInvestimentoIA(){

const saldo = Number(
document.getElementById("saldoLivre")
.innerText
.replace("R$","")
);

let resposta = "";

if(saldo < 100){

resposta = "Comece fazendo renda extra ou vendendo algo.";

}
else if(saldo < 1000){

resposta = "Considere revenda de produtos ou freelances.";

}
else{

resposta = "Você pode começar a investir ou abrir um pequeno negócio.";

}

document.getElementById("resultadoInvestimento").innerText = resposta;

}
