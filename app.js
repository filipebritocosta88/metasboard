const firebaseConfig = {

apiKey: "SUA_API_KEY",
authDomain: "SEU_DOMINIO",
projectId: "SEU_PROJETO"

};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

let usuarioAtual = null;


function login(){

const email = document.getElementById("email").value;
const senha = document.getElementById("senha").value;

auth.signInWithEmailAndPassword(email, senha)
.catch(e=>alert(e.message));

}


function logout(){

auth.signOut();

}


auth.onAuthStateChanged(user=>{

if(user){

usuarioAtual = user;

document.getElementById("login").style.display="none";
document.getElementById("app").style.display="flex";

inicializarListeners();

}else{

document.getElementById("login").style.display="block";
document.getElementById("app").style.display="none";

}

});


function mostrarSecao(sec){

document.querySelectorAll("main section").forEach(s=>s.style.display="none");

document.getElementById(sec).style.display="block";

}


function adicionarFluxo(){

const nome = document.getElementById("nomeFluxo").value;
const valor = Number(document.getElementById("valorFluxo").value);
const dia = Number(document.getElementById("diaFluxo").value);
const tipo = document.getElementById("tipoFluxo").value;

db.collection("fluxo").add({

nome,
valor,
dia,
tipo,
userId: usuarioAtual.uid

});

}


function inicializarListeners(){

db.collection("fluxo")
.where("userId","==",usuarioAtual.uid)
.onSnapshot(snapshot=>{

let ganhos=0;
let dividas=0;

let listaDividas=[];

snapshot.forEach(doc=>{

const d=doc.data();

if(d.tipo==="ganho") ganhos+=d.valor;
if(d.tipo==="divida"){
dividas+=d.valor;
listaDividas.push(d);
}

});

document.getElementById("ganhosTotal").innerText="R$ "+ganhos;
document.getElementById("dividasTotal").innerText="R$ "+dividas;

const saldo = ganhos-dividas;

document.getElementById("saldoLivre").innerText="R$ "+saldo;

atualizarMentor(ganhos,dividas,saldo);
renderizarGraficoDividas(listaDividas);
atualizarVencimentos(listaDividas);

});

}


function atualizarMentor(ganhos,dividas,saldo){

let msg="";

if(saldo<0){

msg="⚠️ Você está gastando mais do que ganha.";

}else if(saldo<500){

msg="💡 Tente guardar pelo menos 20% da renda.";

}else{

msg="🚀 Você está indo muito bem financeiramente.";

}

document.getElementById("mentorTexto").innerText=msg;

}


function atualizarVencimentos(dividas){

if(dividas.length===0) return;

dividas.sort((a,b)=>a.dia-b.dia);

document.getElementById("vencimentoTexto").innerText=
dividas[0].nome+" vence dia "+dividas[0].dia;

}


let grafico=null;

function renderizarGraficoDividas(lista){

if(grafico) grafico.destroy();

const ctx=document.getElementById("graficoDividas");

grafico=new Chart(ctx,{
type:"doughnut",
data:{
labels:lista.map(d=>d.nome),
datasets:[{
data:lista.map(d=>d.valor)
}]
}
});

}


function analisarInvestimentoIA(){

const saldo = Number(
document.getElementById("saldoLivre")
.innerText.replace("R$","")
);

let sugestao="";

if(saldo<100){

sugestao="Comece vendendo algo ou fazendo renda extra.";

}else if(saldo<1000){

sugestao="Considere revenda de produtos ou freelances.";

}else{

sugestao="Você pode começar a investir ou abrir um pequeno negócio.";

}

document.getElementById("resultadoInvestimento").innerText=sugestao;

}
