import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
apiKey:"AIzaSyC4wyouZuCsLZGpmTr5SdXTb7UixdetHoQ",
authDomain:"metasboard.firebaseapp.com",
projectId:"metasboard"
};

const app=initializeApp(firebaseConfig);
const auth=getAuth(app);
const db=getFirestore(app);

let uid=null;

const BRL=v=>v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});

window.login=()=>{

let e=email.value
let s=senha.value

signInWithEmailAndPassword(auth,e,s)

}

onAuthStateChanged(auth,u=>{

if(u){

uid=u.uid
loginTela.style.display="none"
app.style.display="block"

escutarFluxo()

}

})

function escutarFluxo(){

onSnapshot(collection(db,"fluxo"),snap=>{

let ganhos=0
let dividas=0

listaFluxo.innerHTML=""

snap.forEach(d=>{

let f=d.data()

if(f.tipo=="ganho")ganhos+=f.valor
else dividas+=f.valor

listaFluxo.innerHTML+=`

<div class="flex justify-between bg-black/30 p-2 rounded">

<span>${f.nome} - ${BRL(f.valor)}</span>

<div>

<button onclick="editar('${d.id}',${f.valor})">✏</button>
<button onclick="apagar('${d.id}')">🗑</button>

</div>

</div>

`

})

receitaTotal.innerText=BRL(ganhos)
despesaTotal.innerText=BRL(dividas)
saldoTotal.innerText=BRL(ganhos-dividas)

})

}

window.salvarFluxo=async()=>{

await addDoc(collection(db,"fluxo"),{

nome:nomeFluxo.value,
valor:Number(valorFluxo.value),
data:dataFluxo.value,
tipo:tipoFluxo.value,
uid

})

}

window.apagar=id=>deleteDoc(doc(db,"fluxo",id))

window.editar=async(id,valor)=>{

const {value:v}=await Swal.fire({
input:"number",
inputValue:valor
})

if(v){

updateDoc(doc(db,"fluxo",id),{valor:Number(v)})

}

}

window.trocar=(id,btn)=>{

document.querySelectorAll("section").forEach(s=>s.classList.add("hidden"))

document.getElementById(id).classList.remove("hidden")

document.querySelectorAll(".nav").forEach(b=>b.classList.remove("active"))

btn.classList.add("active")

}

window.novaMeta=async()=>{

const{value:f}=await Swal.fire({

title:"Nova Meta",
html:`
<input id="m1" class="swal2-input" placeholder="Nome">
<input id="m2" class="swal2-input" placeholder="Valor">
`

})

}
