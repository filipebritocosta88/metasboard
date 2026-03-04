import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

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

// REGISTRAR
window.registrar = function () {
  const email = document.getElementById("email").value;
  const senha = document.getElementById("senha").value;

  createUserWithEmailAndPassword(auth, email, senha)
    .then(() => alert("Usuário criado com sucesso!"))
    .catch(error => alert(error.message));
};

// LOGIN
window.login = function () {
  const email = document.getElementById("email").value;
  const senha = document.getElementById("senha").value;

  signInWithEmailAndPassword(auth, email, senha)
    .then(() => alert("Login realizado!"))
    .catch(error => alert(error.message));
};

// LOGOUT
window.logout = function () {
  signOut(auth);
};

// CONTROLE DE TELA
onAuthStateChanged(auth, (user) => {
  if (user) {
    document.getElementById("loginTela").classList.add("hidden");
    document.getElementById("dashboard").classList.remove("hidden");
  } else {
    document.getElementById("loginTela").classList.remove("hidden");
    document.getElementById("dashboard").classList.add("hidden");
  }
});
