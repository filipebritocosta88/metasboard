import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
getAuth,
signInWithEmailAndPassword,
createUserWithEmailAndPassword,
onAuthStateChanged
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


// LOGIN

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

// REDIRECIONAMENTO
window.location.href = "dashboard.html";

})

.catch(err=>{

alert(err.message);

});

};


// REGISTRO

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


// FECHAR MODAL

window.fecharBoasVindas = ()=>{

document.getElementById("modalBoasVindas").style.display="none";

};


// DICAS FINANCEIRAS

function gerarDica(){

const dicas = [

"Evite comprometer mais de 30% da sua renda com dívidas.",

"Ter uma reserva de emergência traz segurança financeira.",

"Registrar todos os gastos aumenta o controle do dinheiro.",

"Guardar pelo menos 10% da renda mensal ajuda a criar patrimônio.",

"Pequenos gastos recorrentes podem impactar muito no final do mês."

];

const aleatoria = dicas[Math.floor(Math.random()*dicas.length)];

const el = document.getElementById("dicaFinanceira");

if(el){
el.innerText = aleatoria;
}

}

setInterval(gerarDica,8000);

gerarDica();


// VERIFICA SE USUÁRIO ESTÁ LOGADO

onAuthStateChanged(auth,(user)=>{

if(user){
console.log("Usuário logado:",user.email);
}

});
