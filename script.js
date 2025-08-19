
const STATE_KEY = 'fisica_avance_v2';

let materias = [];
fetch('materias.json')
  .then(r => r.json())
  .then(data => {
    materias = data.materias.sort((a,b)=>a.id-b.id);
    init();
  });

function loadState(){
  try{
    return JSON.parse(localStorage.getItem(STATE_KEY)) || {aprobadas:{}, cursadas:{}};
  }catch(e){
    return {aprobadas:{}, cursadas:{}};
  }
}
function saveState(st){ localStorage.setItem(STATE_KEY, JSON.stringify(st)); }

function init(){
  setupModal();
  setupBuscador();
  setupCollapsibles();
  renderProgreso();
  renderChecklist();
  renderMatriz();
}

function setupModal(){
  const dlg = document.getElementById('modal');
  document.getElementById('modal-close').onclick = ()=> dlg.close();
}

function passThreshold(m){
  const fmt = (m.formato || '').toLowerCase();
  return fmt.includes('asignatura') ? 4 : 7;
}
function isAprobada(m, state){
  const reg = state.aprobadas[m.id];
  if(!reg) return false;
  const nota = Number(reg.nota);
  return !Number.isNaN(nota) && nota >= passThreshold(m);
}
function hasCursada(m, state){
  return !!state.cursadas[m.id] || isAprobada(m, state);
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
        const el = document.querySelector(`[data-card-id="${m.id}"]`);
        if(el){ el.scrollIntoView({behavior:'smooth',block:'center'}); el.classList.add('pulse'); setTimeout(()=>el.classList.remove('pulse'), 800); }
      };
      ul.appendChild(li);
    }
  });
}

function isHabilitada(m, state){
  const haveApproved = (id) => {
    const mm = materias.find(x=>x.id===id);
    return mm ? isAprobada(mm, state) : false;
  };
  const haveCursada = (id) => {
    const mm = materias.find(x=>x.id===id);
    return mm ? hasCursada(mm, state) : false;
  };
  const allCursada = (arr) => arr.every(x => {
    if (typeof x === 'number') return haveCursada(x);
    if (x && x.anyOf) return x.anyOf.some(id => haveCursada(id));
    return true;
  });
  const allAcreditar = (arr) => arr.every(x => {
    if (typeof x === 'number') return haveApproved(x);
    if (x && x.anyOf) return x.anyOf.some(id => haveApproved(id));
    return true;
  });

  const reqC = m.prerrequisitos.requiresCursada || [];
  const reqA = m.prerrequisitos.requiresAcreditar || [];
  return allCursada(reqC) && allAcreditar(reqA);
}

function statusDeMateria(m, state){
  if (isAprobada(m, state)) return {tipo:'APROBADA', clase:'aprobada'};
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

    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = !!state.cursadas[m.id];
    chk.id = `cursada-${m.id}`;
    const lbl = document.createElement('label');
    lbl.htmlFor = chk.id;
    lbl.textContent = 'Cursada';
    chk.onchange = ()=>{
      const s = loadState();
      if(chk.checked){ s.cursadas[m.id] = true; } else { delete s.cursadas[m.id]; }
      saveState(s);
      renderChecklist();
      renderMatriz();
      renderProgreso();
    };

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
      if(!Number.isNaN(nota)){
        if(!s.aprobadas[m.id]) s.aprobadas[m.id] = {};
        s.aprobadas[m.id].nota = nota;
      }else{
        delete s.aprobadas[m.id];
      }
      saveState(s);
      renderChecklist();
      renderMatriz();
      renderProgreso();
    };

    row.appendChild(chk);
    row.appendChild(lbl);
    row.appendChild(input);
    row.appendChild(btn);

    const um = document.createElement('div');
    um.className = 'meta';
    um.textContent = `Aprueba con ≥ ${passThreshold(m)} (según formato)`;

    card.appendChild(head);
    card.appendChild(meta);
    card.appendChild(row);
    card.appendChild(um);
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

    const nota = state.aprobadas[m.id]?.nota;
    const notaTxt = (nota !== undefined && nota !== '') ? ` • Nota: ${nota}` : '';

    box.innerHTML = `<div class="nombre">${m.id}. ${m.nombre}</div>
      <div class="detalle">Año ${m.anio} • ${m.regimen} • ${m.formato}${notaTxt}</div>`;

    box.onclick = () => {
      if(st.clase === 'bloqueada'){
        mostrarBloqueo(m, state);
      }else if(st.clase === 'habilitada'){
        const val = prompt(`Ingresá la nota final para “${m.nombre}” (aprueba con ≥ ${passThreshold(m)}). Dejá vacío para no guardar.`);
        if (val === null) return;
        const nota = parseFloat(val);
        const s = loadState();
        if(!Number.isNaN(nota)){
          if(!s.aprobadas[m.id]) s.aprobadas[m.id] = {};
          s.aprobadas[m.id].nota = nota;
          saveState(s);
          renderChecklist();
          renderMatriz();
        }
      }else{
        const cur = state.aprobadas[m.id]?.nota ?? '';
        const val = prompt(`Editar nota para “${m.nombre}” (actual: ${cur}). Borrar para eliminar.`, cur);
        if (val === null) return;
        const s = loadState();
        if (val.trim()===''){
          delete s.aprobadas[m.id];
        } else {
          const nota = parseFloat(val);
          if(!Number.isNaN(nota)){
            if(!s.aprobadas[m.id]) s.aprobadas[m.id] = {};
            s.aprobadas[m.id].nota = nota;
          }
        }
        saveState(s);
        renderChecklist();
        renderMatriz();
        renderProgreso();
      }
    };
    grid.appendChild(box);
  });
}

function requisitosFaltantesNombres(m, state){
  const haveApproved = (id) => {
    const mm = materias.find(x=>x.id===id);
    return mm ? isAprobada(mm, state) : false;
  };
  const haveCursada = (id) => {
    const mm = materias.find(x=>x.id===id);
    return mm ? hasCursada(mm, state) : false;
  };
  const falt = [];
  const pushIfMissingC = (token)=>{
    if (typeof token === 'number'){
      if (!haveCursada(token)){
        const mm = materias.find(x=>x.id===token);
        if(mm) falt.push(mm.nombre);
      }
    } else if (token && token.anyOf){
      const ok = token.anyOf.some(id => haveCursada(id));
      if (!ok){
        const names = token.anyOf.map(id => (materias.find(x=>x.id===id)||{}).nombre).filter(Boolean);
        falt.push(names);
      }
    }
  };
  const pushIfMissingA = (token)=>{
    if (typeof token === 'number'){
      if (!haveApproved(token)){
        const mm = materias.find(x=>x.id===token);
        if(mm) falt.push(mm.nombre);
      }
    } else if (token && token.anyOf){
      const ok = token.anyOf.some(id => haveApproved(id));
      if (!ok){
        const names = token.anyOf.map(id => (materias.find(x=>x.id===id)||{}).nombre).filter(Boolean);
        falt.push(names);
      }
    }
  };
  (m.prerrequisitos.requiresCursada||[]).forEach(pushIfMissingC);
  (m.prerrequisitos.requiresAcreditar||[]).forEach(pushIfMissingA);
  return falt;
}

function mostrarBloqueo(m, state){
  const faltan = requisitosFaltantesNombres(m, state);
  const partes = faltan.map(fr => Array.isArray(fr) ? `al menos una de: ${fr.join(', ')}` : `${fr}`);
  const texto = partes.length ? `Para cursar “${m.nombre}”, necesitás: ${partes.join(' y ')}.` : 'No pudimos determinar los requisitos.';
  document.getElementById('modal-title').textContent = 'Materia bloqueada';
  document.getElementById('modal-body').textContent = texto;
  document.getElementById('modal').showModal();
}


// === Progreso ===
function renderProgreso(){
  const state = loadState();
  const total = materias.length;
  const aprobadasIds = Object.keys(state.aprobadas).map(k=>Number(k)).filter(id => {
    const m = materias.find(x=>x.id===id);
    return m && isAprobada(m, state);
  });
  const aprobadas = aprobadasIds.length;
  const porcentaje = total > 0 ? Math.round((aprobadas/total)*100) : 0;

  const topline = document.getElementById('progreso-topline');
  if(topline){
    const curs = Object.keys(state.cursadas||{}).length;
    topline.textContent = `Aprobadas: ${aprobadas}/${total} (${porcentaje}%) • Cursadas: ${curs}`;
  }
  const fill = document.getElementById('progress-fill');
  if(fill){ fill.style.width = porcentaje + '%'; }

  const nota = document.getElementById('progreso-nota');
  if(nota){
    let msg = '';
    if (porcentaje === 100){
      msg = 'Felicitaciones, podes anotarte en el 108 A';
    } else if (porcentaje >= 75){
      msg = 'Podes anotarte en el listado 108 b Item 4';
    } else if (porcentaje >= 50){
      msg = 'Podes anotarte en el listado 108 b Item 5';
    } else if (porcentaje > 25){
      msg = 'Podes anotarte en el listado de Emergencia';
    } else {
      msg = 'Seguí sumando materias para habilitar listados.';
    }
    nota.textContent = msg;
  }
}
// === /Progreso ===

// === Colapsables ===
function setupCollapsibles(){
  document.querySelectorAll('.collapse-toggle').forEach(btn => {
    const targetId = btn.getAttribute('data-target');
    const panel = document.getElementById(targetId);
    btn.addEventListener('click', ()=>{
      panel.classList.toggle('collapsed');
      btn.textContent = btn.textContent.includes('▾') ? btn.textContent.replace('▾','▸') : btn.textContent.replace('▸','▾');
    });
  });
}
// === /Colapsables ===
