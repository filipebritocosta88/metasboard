import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import { 
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  deleteDoc,
  doc
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

let usuarioAtual = null;

window.registrar = ( ) => {
  const email = emailInput();
  const senha = senhaInput();
  createUserWithEmailAndPassword(auth, email, senha)
    .catch(error => alert(error.message));
};

window.login = ( ) => {
  const email = emailInput();
  const senha = senhaInput();
  signInWithEmailAndPassword(auth, email, senha)
    .catch(error => alert(error.message));
};

window.logout = ( ) => signOut(auth);

window.adicionarReceita = async () => salvarMovimento("receita");
window.adicionarDespesa = async () => salvarMovimento("despesa");

function emailInput(){ return document.getElementById("email").value }
function senhaInput(){ return document.getElementById("senha").value }

async function salvarMovimento(tipo){
  const valor = Number(document.getElementById("valor").value);
  if(!valor) return alert("Digite um valor válido");

  await addDoc(collection(db,"movimentos"),{
    tipo,
    valor,
    userId: usuarioAtual.uid,
    criadoEm: Date.now()
  });

  document.getElementById("valor").value="";
}

onAuthStateChanged(auth,(user)=>{
  if(user){
    usuarioAtual=user;
    document.getElementById("loginTela").classList.add("hidden");
    document.getElementById("dashboard").classList.remove("hidden");
    carregarDados();
  }else{
    document.getElementById("loginTela").classList.remove("hidden");
    document.getElementById("dashboard").classList.add("hidden");
  }
});

function carregarDados(){
  const q=query(
    collection(db,"movimentos"),
    where("userId","==",usuarioAtual.uid)
  );

  onSnapshot(q,(snapshot)=>{
    let receita=0;
    let despesa=0;
    const lista=document.getElementById("listaMovimentos");
    lista.innerHTML="";

    snapshot.forEach(docSnap=>{
      const data=docSnap.data();
      const id=docSnap.id;

      if(data.tipo==="receita") receita+=data.valor;
      if(data.tipo==="despesa") despesa+=data.valor;

      const li=document.createElement("li");
      li.className="flex justify-between bg-slate-700 p-3 rounded";

      li.innerHTML=`
        <span>${data.tipo==="receita"?"🟢":"🔴"} R$ ${data.valor}</span>
        <button onclick="excluirMovimento('${id}')" class="text-red-400">Excluir</button>
      `;

      lista.appendChild(li);
    });

    document.getElementById("receitaTotal").innerText="R$ "+receita;
    document.getElementById("despesaTotal").innerText="R$ "+despesa;
    document.getElementById("saldoTotal").innerText="R$ "+(receita-despesa);
  });
}

window.excluirMovimento=async(id)=>{
  await deleteDoc(doc(db,"movimentos",id));
};
