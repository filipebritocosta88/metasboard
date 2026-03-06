// ADIÇÃO DE MENSAGEM AO CRIAR CONTA

window.registrar = () => {

const e = document.getElementById("email").value;
const s = document.getElementById("senha").value;

if(!e || !s){
alert("Preencha todos os campos!");
return;
}

createUserWithEmailAndPassword(auth, e, s)

.then(()=>{

document.getElementById("modalBoasVindas").style.display="flex";

})

.catch(err=>alert(err.message));

};


// FECHAR MODAL

window.fecharBoasVindas = ()=>{

document.getElementById("modalBoasVindas").style.display="none";

};


// DICAS FINANCEIRAS AUTOMATICAS

function gerarDica(){

const dicas = [

"Evite comprometer mais de 30% da sua renda com dívidas.",

"Ter uma reserva de emergência de 6 meses de renda traz segurança.",

"Registrar todos os gastos aumenta o controle financeiro.",

"Guardar pelo menos 10% da renda mensal ajuda a criar patrimônio.",

"Pequenos gastos recorrentes podem impactar muito no final do mês."

];

const aleatoria = dicas[Math.floor(Math.random()*dicas.length)];

const el = document.getElementById("dicaFinanceira");

if(el) el.innerText = aleatoria;

}

setInterval(gerarDica,8000);

gerarDica();
