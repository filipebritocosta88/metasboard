import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
getAuth,
signInWithEmailAndPassword,
createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


const firebaseConfig = {

apiKey: "AIzaSyC4wyouZuCsLZGpmTr5SdXTb7UixdetHoQ",
authDomain: "metasboard.firebaseapp.com",
projectId: "metasboard",
storageBucket: "metasboard.appspot.com",
messagingSenderId: "123456789",
appId: "1:123456789:web:abc"

};


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);


window.login = () => {

const email = document.getElementById("email").value;
const senha = document.getElementById("senha").value;

if(!email || !senha){
alert("Preencha todos os campos");
return;
}

signInWithEmailAndPassword(auth,email,senha)

.then(()=>{

alert("Login realizado com sucesso");

})

.catch(err=>{

alert(err.message);

});

};



window.registrar = () => {

const email = document.getElementById("email").value;
const senha = document.getElementById("senha").value;

if(!email || !senha){
alert("Preencha todos os campos");
return;
}

createUserWithEmailAndPassword(auth,email,senha)

.then(()=>{

document.getElementById("modalBoasVindas").style.display="flex";

})

.catch(err=>{

alert(err.message);

});

};



window.fecharBoasVindas = ()=>{

document.getElementById("modalBoasVindas").style.display="none";

};



function gerarDica(){

const dicas = [

"Evite comprometer mais de 30% da sua renda com dívidas.",

"Ter uma reserva de emergência traz segurança financeira.",

"Registrar todos os gastos aumenta o controle do dinheiro.",

"Guardar pelo menos 10% da renda mensal ajuda a criar patrimônio.",

"Pequenos gastos recorrentes podem impactar muito no final do mês."

];

const aleatoria = dicas[Math.floor(Math.random()*dicas.length)];

document.getElementById("dicaFinanceira").innerText = aleatoria;

}

setInterval(gerarDica,8000);

gerarDica();
