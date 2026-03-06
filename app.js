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

const BRL = (v) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v||0);


window.navegar = (id)=>{
  document.querySelectorAll('.secao').forEach(s=>s.classList.remove('ativa'));
  document.getElementById(id).classList.add('ativa');

  document.querySelectorAll('.menuBtn').forEach(b=>b.classList.remove('active'));
  document.getElementById('btn-'+id).classList.add('active');
};



window.alternarTela = (cadastrar)=>{

document.getElementById("botoesLogin").classList.toggle("hidden",cadastrar);
document.getElementById("botoesCadastro").classList.toggle("hidden",!cadastrar);

};



window.login = ()=>{

const e=document.getElementById("email").value;
const s=document.getElementById("senha").value;

signInWithEmailAndPassword(auth,e,s)
.then(()=>{})
.catch(err=>alert("Erro ao entrar: "+err.message));

};



window.registrar = ()=>{

const e=document.getElementById("email").value;
const s=document.getElementById("senha").value;

if(!e || !s){
alert("Preencha todos os campos");
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



window.logout = ()=>signOut(auth);



// RECEITAS

window.addRecorrencia = async()=>{

const desc=document.getElementById("rec_desc").value;
const valor=Number(document.getElementById("rec_valor").value);

if(valor>0){

await addDoc(collection(db,"recorrencias"),{

descrição:desc,
valor,
userId:userUID

});

}

};



window.excluirReceita = async(id)=>{

if(confirm("Excluir receita?")){

await deleteDoc(doc(db,"recorrencias",id));

}

};



// DIVIDAS

window.addDivida = async()=>{

const nome=document.getElementById("div_nome").value;
const valor=Number(document.getElementById("div_valor").value);
const data=document.getElementById("div_data").value;

if(valor>0 && data){

await addDoc(collection(db,"dividas"),{

nome,
valor,
vencimento:data,
userId:userUID

});

}

};



window.darBaixa = async(id)=>{

if(confirm("Confirmar pagamento?")){

await deleteDoc(doc(db,"dividas",id));

}

};



// METAS

window.addMeta = async()=>{

const nome=document.getElementById("meta_nome").value;
const alvo=Number(document.getElementById("meta_alvo").value);

if(alvo>0){

await addDoc(collection(db,"metas"),{

nome,
alvo,
atual:0,
userId:userUID

});

}

};



window.ajustarMeta = async(id,tipo)=>{

const v=Number(prompt("Valor:"));

if(!v)return;

const ref=doc(db,"metas",id);

const snap=await getDoc(ref);

const novo = tipo==='add'
? snap.data().atual+v
: Math.max(0,snap.data().atual-v);

await updateDoc(ref,{atual:novo});

};



// RESERVA

window.sugerirReserva = async()=>{

const v=((totalReceitas-totalDividas)*0.1);

if(v>0 && confirm(`Guardar ${BRL(v)} na reserva?`)){

await addDoc(collection(db,"reserva"),{valor:v,userId:userUID});

}

};



window.retirarReserva = async()=>{

const v=Number(prompt("Valor para retirar"));

if(v>0){

await addDoc(collection(db,"reserva"),{valor:-v,userId:userUID});

}

};



// CHAT IA MELHORADO

window.toggleChat = ()=>{

document.getElementById("boxChat").classList.toggle('hidden');

};



window.perguntarIA = ()=>{

const input=document.getElementById("inputIA");

const msg=input.value.toLowerCase();

const box=document.getElementById("chatMensagens");

if(!msg)return;

box.innerHTML+=`<div class="bg-slate-700/50 p-3 rounded-2xl rounded-tr-none text-right ml-10">${input.value}</div>`;

let resp="Não entendi. Pergunte sobre metas, saúde financeira ou reserva.";

const saldo = totalReceitas-totalDividas;



if(msg.includes("saude") || msg.includes("situacao")){

const p=(totalDividas/totalReceitas)*100;

resp=`Sua saúde financeira está ${(p<40)?'ÓTIMA':'EM ALERTA'}.
Suas dívidas representam ${p.toFixed(1)}% da sua renda.`;


}else if(msg.includes("guardar") || msg.includes("economizar")){

resp=`Com seu saldo de ${BRL(saldo)}, recomendo guardar cerca de ${BRL(saldo*0.15)} este mês.`;


}else if(msg.includes("meta")){

resp=`Suas metas atuais são: ${listaMetasNomes.join(", ")}`;


}else if(msg.includes("divida")){

resp=`Você possui ${BRL(totalDividas)} em dívidas atualmente.`;


}else if(msg.includes("saldo")){

resp=`Seu saldo livre é ${BRL(saldo)}.`;


}



setTimeout(()=>{

box.innerHTML+=`<div class="bg-purple-600/20 p-3 rounded-2xl rounded-tl-none border border-purple-500/30 mr-10"><b>IA:</b><br>${resp}</div>`;

box.scrollTop=box.scrollHeight;

},500);

input.value="";

};



// DICAS AUTOMATICAS

function gerarDica(){

const dicas=[

"Evite comprometer mais de 30% da renda com dívidas.",

"Tenha reserva de emergência de pelo menos 6 meses.",

"Registrar todos os gastos aumenta o controle financeiro.",

"Guardar 10% da renda mensal ajuda a construir patrimônio.",

"Pequenos gastos recorrentes podem virar grandes despesas."

];

const aleatoria=dicas[Math.floor(Math.random()*dicas.length)];

const el=document.getElementById("dicaFinanceira");

if(el) el.innerText=aleatoria;

}

setInterval(gerarDica,8000);

gerarDica();



// AUTENTICAÇÃO

onAuthStateChanged(auth,user=>{

if(user){

userUID=user.uid;

document.getElementById("loginTela").classList.add("hidden");

document.getElementById("dashboard").style.display="flex";

}else{

document.getElementById("loginTela").classList.remove("hidden");

document.getElementById("dashboard").style.display="none";

}

});
