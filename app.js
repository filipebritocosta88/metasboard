import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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
let totalReservaTotal = 0;
let listaMetasNomes = [];

const BRL = (v)=> new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v||0);


window.navegar = (id)=>{

document.querySelectorAll('.secao').forEach(s=>s.classList.remove('ativa'));

document.getElementById(id).classList.add('ativa');

document.querySelectorAll('.menuBtn').forEach(b=>b.classList.remove('active'));

document.getElementById('btn-'+id).classList.add('active');

};


window.alternarTela = (cadastrar)=>{

document.getElementById("botoesLogin").classList.toggle("hidden",cadastrar);

document.getElementById("botoesCadastro").classList.toggle("hidden",!cadastrar);

document.getElementById("subtituloLogin").innerText =
cadastrar ? "Crie sua conta gratuita agora" : "Seu controle financeiro inteligente";

};


window.login = ()=>{

const e=document.getElementById("email").value;

const s=document.getElementById("senha").value;

if(!e || !s){

alert("Preencha email e senha");

return;

}

signInWithEmailAndPassword(auth,e,s)

.catch(err=>alert("Erro ao entrar: "+err.message));

};



window.registrar = ()=>{

const e=document.getElementById("email").value;

const s=document.getElementById("senha").value;

if(!e || !s){

alert("Preencha todos os campos!");

return;

}

createUserWithEmailAndPassword(auth,e,s)

.then(()=>{

document.getElementById("modalBoasVindas").style.display="flex";

})

.catch(err=>alert(err.message));

};



window.fecharBoasVindas = ()=>{

document.getElementById("modalBoasVindas").style.display="none";

};



window.logout = ()=> signOut(auth);



window.addRecorrencia = async ()=>{

const desc=document.getElementById("rec_desc").value;

const valor=Number(document.getElementById("rec_valor").value);

if(valor>0)

await addDoc(collection(db,"recorrencias"),{

descrição:desc,

valor,

userId:userUID

});

};



window.excluirReceita = async (id)=>{

if(confirm("Excluir receita?"))

await deleteDoc(doc(db,"recorrencias",id));

};



window.addDivida = async ()=>{

const nome=document.getElementById("div_nome").value;

const valor=Number(document.getElementById("div_valor").value);

const data=document.getElementById("div_data").value;

if(valor>0 && data)

await addDoc(collection(db,"dividas"),{

nome,

valor,

vencimento:data,

userId:userUID

});

};



window.darBaixa = async (id)=>{

if(confirm("Confirmar pagamento?"))

await deleteDoc(doc(db,"dividas",id));

};



window.addMeta = async ()=>{

const nome=document.getElementById("meta_nome").value;

const alvo=Number(document.getElementById("meta_alvo").value);

if(alvo>0)

await addDoc(collection(db,"metas"),{

nome,

alvo,

atual:0,

userId:userUID

});

};



window.ajustarMeta = async (id,tipo)=>{

const v=Number(prompt("Valor:"));

if(!v) return;

const ref=doc(db,"metas",id);

const snap=await getDoc(ref);

const novo= tipo==="add"
? snap.data().atual+v
: Math.max(0,snap.data().atual-v);

await updateDoc(ref,{atual:novo});

};



window.toggleChat = ()=>{

document.getElementById("boxChat").classList.toggle("hidden");

};



window.perguntarIA = ()=>{

const input=document.getElementById("inputIA");

const msg=input.value.toLowerCase();

const box=document.getElementById("chatMensagens");

if(!msg) return;

box.innerHTML+=`<div class="bg-slate-700/50 p-3 rounded-2xl text-right">${input.value}</div>`;

let resp="Não entendi sua pergunta.";

const saldo=totalReceitas-totalDividas;

if(msg.includes("saude")){

const p=(totalDividas/totalReceitas)*100;

resp=`Sua saúde financeira está ${p<40?"ÓTIMA":"EM ALERTA"}`;

}

if(msg.includes("guardar")){

resp=`Você poderia guardar ${BRL(saldo*0.15)} hoje.`;

}

setTimeout(()=>{

box.innerHTML+=`<div class="bg-purple-600/20 p-3 rounded-2xl"><b>IA:</b><br>${resp}</div>`;

},500);

input.value="";

};



function gerarDica(){

const dicas=[

"Evite comprometer mais de 30% da sua renda com dívidas.",

"Ter uma reserva de emergência de 6 meses traz segurança.",

"Registrar todos os gastos aumenta o controle financeiro.",

"Guardar pelo menos 10% da renda mensal cria patrimônio.",

"Pequenos gastos recorrentes impactam muito no mês."

];

const aleatoria=dicas[Math.floor(Math.random()*dicas.length)];

const el=document.getElementById("dicaFinanceira");

if(el) el.innerText=aleatoria;

}

setInterval(gerarDica,8000);

gerarDica();



onAuthStateChanged(auth,user=>{

if(user){

userUID=user.uid;

document.getElementById("loginTela").classList.add("hidden");

document.getElementById("dashboard").classList.remove("hidden");

}

else{

document.getElementById("loginTela").classList.remove("hidden");

document.getElementById("dashboard").classList.add("hidden");

}

});
