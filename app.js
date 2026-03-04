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
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Config Firebase
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

// ----- LOGIN / REGISTRO -----
window.registrar = () => {
  const email = emailInput();
  const senha = senhaInput();
  createUserWithEmailAndPassword(auth,email,senha)
    .catch(error => alert(error.message));
};

window.login = () => {
  const email = emailInput();
  const senha = senhaInput();
  signInWithEmailAndPassword(auth,email,senha)
    .catch(error => alert(error.message));
};

window.logout = () => signOut(auth);

function emailInput(){ return document.getElementById("email").value }
function senhaInput(){ return document.getElementById("senha").value }

// ----- MOVIMENTOS -----
window.adicionarReceita = async () => salvarMovimento("receita");
window.adicionarDespesa = async () => salvarMovimento("despesa");

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

// ----- CONTAS -----
window.adicionarConta = async () => {
  const nome = prompt("Nome da conta (Ex: Nubank):");
  const saldo = Number(prompt("Saldo inicial:"));
  if(!nome || isNaN(saldo)) return alert("Dados inválidos");

  await addDoc(collection(db,"contas"),{
    nome,
    saldo,
    userId: usuarioAtual.uid,
    criadoEm: Date.now()
  });
};

// ----- DÍVIDAS -----
window.adicionarDivida = async () => {
  const banco = prompt("Banco/credor da dívida:");
  const valor = Number(prompt("Valor da dívida:"));
  if(!banco || isNaN(valor)) return alert("Dados inválidos");

  await addDoc(collection(db,"dividas"),{
    banco,
    valor,
    status: "pendente",
    userId: usuarioAtual.uid,
    criadoEm: Date.now()
  });
};

// ----- CARREGAR DADOS -----
onAuthStateChanged(auth, (user) => {
  if(user){
    usuarioAtual = user;
    document.getElementById("loginTela").classList.add("hidden");
    document.getElementById("dashboard").classList.remove("hidden");
    carregarMovimentos();
    carregarContas();
    carregarDividas();
  } else {
    document.getElementById("loginTela").classList.remove("hidden");
    document.getElementById("dashboard").classList.add("hidden");
  }
});

// ----- FUNÇÕES DE CARREGAMENTO -----
function carregarMovimentos(){
  const q = query(collection(db,"movimentos"), where("userId","==",usuarioAtual.uid));
  onSnapshot(q, (snapshot) => {
    let receita=0;
    let despesa=0;
    const lista=document.getElementById("listaMovimentos");
    lista.innerHTML="";

    snapshot.forEach(docSnap=>{
      const data = docSnap.data();
      const id = docSnap.id;

      if(data.tipo==="receita") receita+=data.valor;
      if(data.tipo==="despesa") despesa+=data.valor;

      const li = document.createElement("li");
      li.className="flex justify-between bg-slate-700 p-3 rounded items-center";

      const span = document.createElement("span");
      span.innerText = `${data.tipo==="receita"?"🟢":"🔴"} R$ ${data.valor}`;
      li.appendChild(span);

      // Botão excluir
      const botaoExcluir = document.createElement("button");
      botaoExcluir.innerText="Excluir";
      botaoExcluir.className="text-red-400";
      botaoExcluir.addEventListener("click", async ()=>{
        if(confirm("Deseja realmente excluir este movimento?")){
          await deleteDoc(doc(db,"movimentos",id));
        }
      });
      li.appendChild(botaoExcluir);

      lista.appendChild(li);
    });

    document.getElementById("receitaTotal").innerText="R$ "+receita;
    document.getElementById("despesaTotal").innerText="R$ "+despesa;
    document.getElementById("saldoTotal").innerText="R$ "+(receita-despesa);
  });
}

function carregarContas(){
  const q = query(collection(db,"contas"), where("userId","==",usuarioAtual.uid));
  onSnapshot(q, (snapshot)=>{
    // Aqui você pode renderizar uma tabela ou cards de contas
    console.log("Contas:", snapshot.docs.map(d=>d.data()));
  });
}

function carregarDividas(){
  const q = query(collection(db,"dividas"), where("userId","==",usuarioAtual.uid));
  onSnapshot(q, (snapshot)=>{
    // Aqui você pode renderizar tabela ou lista de dívidas
    console.log("Dívidas:", snapshot.docs.map(d=>d.data()));
  });
}

// ----- FUNÇÃO DE EDIÇÃO (EXEMPLO) -----
window.editarConta = async (id) => {
  const novoSaldo = Number(prompt("Novo saldo:"));
  if(isNaN(novoSaldo)) return alert("Saldo inválido");
  await updateDoc(doc(db,"contas",id), { saldo: novoSaldo });
};

// ----- FUNÇÃO DE EXCLUSÃO -----
window.excluirConta = async (id) => {
  if(confirm("Deseja realmente excluir esta conta?")){
    await deleteDoc(doc(db,"contas",id));
  }
};

window.excluirDivida = async (id) => {
  if(confirm("Deseja realmente excluir esta dívida?")){
    await deleteDoc(doc(db,"dividas",id));
  }
};
