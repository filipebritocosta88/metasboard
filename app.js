
let fluxo = JSON.parse(localStorage.getItem("fluxo")) || []
let metas = JSON.parse(localStorage.getItem("metas")) || []
let dividas = JSON.parse(localStorage.getItem("dividas")) || []

function openScreen(id){

document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"))
document.getElementById(id).classList.add("active")

}


function save(){

localStorage.setItem("fluxo",JSON.stringify(fluxo))
localStorage.setItem("metas",JSON.stringify(metas))
localStorage.setItem("dividas",JSON.stringify(dividas))

render()

}


function addFluxo(){

let desc = document.getElementById("desc").value
let valor = Number(document.getElementById("valor").value)

fluxo.push({
desc,
valor,
date:new Date().toISOString()
})

save()

}


function deleteFluxo(i){

fluxo.splice(i,1)

save()

}


function renderFluxo(){

let div = document.getElementById("listaFluxo")

div.innerHTML=""

fluxo.forEach((f,i)=>{

div.innerHTML+=`

<div class="card flex justify-between">

<span>${f.desc} - ${f.valor}</span>

<button onclick="deleteFluxo(${i})">❌</button>

</div>

`

})

}


function addMeta(){

let nome = document.getElementById("metaNome").value
let valor = Number(document.getElementById("metaValor").value)

metas.push({
nome,
valor,
atual:0
})

save()

}


function renderMetas(){

let div = document.getElementById("listaMetas")

div.innerHTML=""

metas.forEach((m,i)=>{

let progresso = (m.atual/m.valor)*100

div.innerHTML+=`

<div class="card">

<h3>${m.nome}</h3>

<div class="progress">

<div class="progress-bar" style="width:${progresso}%"></div>

</div>

<button onclick="deleteMeta(${i})">remover</button>

</div>

`

})

}


function deleteMeta(i){

metas.splice(i,1)

save()

}


function addDivida(){

let nome = document.getElementById("dividaNome").value
let valor = Number(document.getElementById("dividaValor").value)

dividas.push({nome,valor})

save()

}


function renderDividas(){

let div = document.getElementById("listaDividas")

div.innerHTML=""

dividas.forEach(d=>{

div.innerHTML+=`<div class="card">${d.nome} - ${d.valor}</div>`

})

}


function renderDashboard(){

let entradas = fluxo.reduce((a,b)=>a+b.valor,0)

let totalDividas = dividas.reduce((a,b)=>a+b.valor,0)

document.getElementById("totalEntradas").innerText = entradas

document.getElementById("totalDividas").innerText = totalDividas

document.getElementById("saldoLivre").innerText = entradas-totalDividas

}


function iaPergunta(tipo){

let chat = document.getElementById("chat")

let respostas = {

economizar:"Reduza gastos recorrentes e crie metas mensais",

investir:"Diversifique entre renda fixa e ações globais",

dividas:"Priorize dívidas com juros maiores"

}

chat.innerHTML += `<div class="card mt-2">${respostas[tipo]}</div>`

}


function render(){

renderFluxo()
renderMetas()
renderDividas()
renderDashboard()

}

render()
