import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {
getAuth,
signInWithEmailAndPassword,
createUserWithEmailAndPassword,
signOut,
onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
getFirestore,
collection,
query,
where,
onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";


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

let totalReceitas = 0;

let totalDividas = 0;


const BRL = (v)=>
new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v||0);



window.alternarTela=(cadastrar)=>{

document.getElementById("botoesLogin").classList.toggle("hidden",cadastrar);

document.getElementById("botoesCadastro").classList.toggle("hidden",!cadastrar);

};



window.login=()=>{

const email=document.getElementById("email").value;

const senha=document.getElementById("senha").value;

signInWithEmailAndPassword(auth,email,senha)

.catch(err=>alert(err.message));

};



window.registrar=()=>{

const email=document.getElementById("email").value;

const senha=document.getElementById("senha").value;

createUserWithEmailAndPassword(auth,email,senha)

.then(()=>{

document.getElementById("modalBoasVindas").style.display="flex";

})

.catch(err=>alert(err.message));

};



window.fecharBoasVindas=()=>{

document.getElementById("modalBoasVindas").style.display="none";

};



window.logout=()=>signOut(auth);



function carregarDados(){

onSnapshot(query(collection(db,"recorrencias"),where("userId","==",userUID)),snap=>{

totalReceitas=0;

snap.forEach(d=>{

totalReceitas+=d.data().valor;

});

atualizarUI();

});


onSnapshot(query(collection(db,"dividas"),where("userId","==",userUID)),snap=>{

totalDividas=0;

snap.forEach(d=>{

totalDividas+=d.data().valor;

});

atualizarUI();

});

}



function atualizarUI(){

const saldo=totalReceitas-totalDividas;

document.getElementById("resumoReceita").innerText=BRL(totalReceitas);

document.getElementById("resumoDividas").innerText=BRL(totalDividas);

document.getElementById("resumoSaldo").innerText=BRL(saldo);

}



function gerarDica(){

const dicas=[

"Evite comprometer mais de 30% da renda com dívidas.",

"Guarde pelo menos 10% do que ganha.",

"Ter uma reserva de emergência reduz estresse financeiro.",

"Registrar gastos ajuda a controlar impulsos.",

"Pequenos gastos frequentes impactam muito no mês."

];

const d=dicas[Math.floor(Math.random()*dicas.length)];

document.getElementById("dicaFinanceira").innerText=d;

}

setInterval(gerarDica,8000);

gerarDica();



onAuthStateChanged(auth,user=>{

if(user){

userUID=user.uid;

document.getElementById("loginTela").classList.add("hidden");

document.getElementById("dashboard").classList.remove("hidden");

carregarDados();

}

else{

document.getElementById("loginTela").classList.remove("hidden");

document.getElementById("dashboard").classList.add("hidden");

}

});
