
const STATE_KEY = 'fisica_avance_v1';

// Cargar materias
let materias = [];
fetch('materias.json')
  .then(r => r.json())
  .then(data => {
    materias = data.materias.sort((a,b)=>a.id-b.id);
    init();
  });

// Estado en localStorage: { aprobadas: {id: {nota:number}} }
function loadState(){
  try{
    return JSON.parse(localStorage.getItem(STATE_KEY)) || {aprobadas:{}};
  }catch(e){
    return {aprobadas:{}};
  }
}
function saveState(st){ localStorage.setItem(STATE_KEY, JSON.stringify(st)); }

function init(){
  renderChecklist();
  renderMatriz();
  setupBuscador();
  setupModal();
}

function setupModal(){
  const dlg = document.getElementById('modal');
  document.getElementById('modal-close').onclick = ()=> dlg.close();
}

function setupBuscador(){
  const input = document.getElementById('search');
  const ul = document.getElementById('search-results');
  input.addEventListener('input', ()=>{
    const q = input.value.trim().toLowerCase();
    ul.innerHTML='';
    if(!q) return;
    const hits = materias.filter(m => m.nombre.toLowerCase().includes(q)).slice(0,10);
    for(const m of hits){
      const li = document.createElement('li');
      li.textContent = `${m.id}. ${m.nombre}`;
      li.onclick = ()=>{
        // scroll to card in checklist
        const el = document.querySelector(`[data-card-id="${m.id}"]`);
        if(el){ el.scrollIntoView({behavior:'smooth',block:'center'}); el.classList.add('pulse'); setTimeout(()=>el.classList.remove('pulse'), 800); }
      };
      ul.appendChild(li);
    }
  });
}

// Evaluar si una materia está habilitada según prerrequisitos y estado
function isHabilitada(m, state){
  // Regla: requisitos de 'requiresAcreditar' deben estar aprobados con nota
  const haveApproved = (id) => !!state.aprobadas[id];
  const all = (arr) => arr.every(x => {
    if(typeof x === 'number') return haveApproved(x);
    if(x && x.anyOf) return x.anyOf.some(id => haveApproved(id));
    return true;
  });
  const reqC = m.prerrequisitos.requiresCursada || [];
  const reqA = m.prerrequisitos.requiresAcreditar || [];
  // Para el prototipo, consideramos que "cursada" también se satisface si está aprobada
  return all(reqC) && all(reqA);
}

function statusDeMateria(m, state){
  if (state.aprobadas[m.id]) return {tipo:'APROBADA', clase:'aprobada'};
  return isHabilitada(m, state) ? {tipo:'HABILITADA', clase:'habilitada'} : {tipo:'BLOQUEADA', clase:'bloqueada'};
}

function renderChecklist(){
  const cont = document.getElementById('checklist');
  const state = loadState();
  cont.innerHTML = '';
  materias.forEach(m => {
    const st = statusDeMateria(m, state);
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.cardId = m.id;

    const head = document.createElement('div');
    head.className = 'card-header';
    head.innerHTML = `<div class="card-title">${m.id}. ${m.nombre}</div>
      <span class="badge ${st.clase}">${st.tipo}</span>`;

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `Año: ${m.anio} • Régimen: ${m.regimen} • Formato: ${m.formato}`;

    const row = document.createElement('div');
    row.className = 'row';
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0'; input.max = '10'; input.step='0.1';
    input.placeholder = 'Nota';
    input.className = 'input-nota';
    input.value = state.aprobadas[m.id]?.nota ?? '';
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = 'Guardar nota';
    btn.onclick = ()=>{
      const nota = parseFloat(input.value);
      const s = loadState();
      if(!isNaN(nota)){
        s.aprobadas[m.id] = {nota};
      }else{
        delete s.aprobadas[m.id];
      }
      saveState(s);
      renderChecklist();
      renderMatriz();
    };
    row.appendChild(input);
    row.appendChild(btn);

    card.appendChild(head);
    card.appendChild(meta);
    card.appendChild(row);
    cont.appendChild(card);
  });
}

function renderMatriz(){
  const grid = document.getElementById('matriz');
  const state = loadState();
  grid.innerHTML = '';
  materias.forEach(m => {
    const st = statusDeMateria(m, state);
    const box = document.createElement('div');
    box.className = `materia-box ${st.clase}`;
    box.innerHTML = `<div class="nombre">${m.id}. ${m.nombre}</div>
      <div class="detalle">Año ${m.anio} • ${m.regimen} • ${m.formato}</div>`;
    box.onclick = () => {
      if(st.clase === 'bloqueada'){
        mostrarBloqueo(m, state);
      }else{
        // Toggle aprobado rápido: si ya está aprobada, quitar; si está habilitada, marcar aprobada con "6"
        const s = loadState();
        if (st.clase === 'aprobada'){
          delete s.aprobadas[m.id];
        } else {
          s.aprobadas[m.id] = {nota: 6};
        }
        saveState(s);
        renderChecklist();
        renderMatriz();
      }
    };
    grid.appendChild(box);
  });
}

function mostrarBloqueo(m, state){
  const faltan = requisitosFaltantes(m, state);
  const partes = faltan.map(fr => {
    if (Array.isArray(fr)) {
      return `al menos una de: ${fr.join(', ')}`;
    }
    return `${fr}`;
  });
  const texto = partes.length ? `Para cursar “${m.nombre}”, necesitás aprobar ${partes.join(' y ')}.` : 'No pudimos determinar los requisitos.';
  document.getElementById('modal-title').textContent = 'Materia bloqueada';
  document.getElementById('modal-body').textContent = texto;
  document.getElementById('modal').showModal();
}

// Devuelve lista de requisitos faltantes en formato: [8, [5,6]]  => significa "8 y (5 o 6)"
function requisitosFaltantes(m, state){
  const have = (id)=> !!state.aprobadas[id];
  const falt = [];
  const pushIfMissing = (token)=>{
    if (typeof token === 'number'){
      if (!have(token)) falt.push(token);
    } else if (token && token.anyOf){
      const ok = token.anyOf.some(id => have(id));
      if (!ok) falt.push(token.anyOf.slice());
    }
  };
  [...(m.prerrequisitos.requiresCursada||[]), ...(m.prerrequisitos.requiresAcreditar||[])].forEach(pushIfMissing);
  return falt;
}
