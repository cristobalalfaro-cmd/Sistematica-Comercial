// =============== CONFIG ===============
const GAS_BASE = 'https://script.google.com/macros/s/AKfycbwImP77VSh5iXP3vPTOoPW2U62aUkoOSfeCyf4uYwBUNIHwCRKEgcpE99bVh6sNbdxWPA/exec';

// =============== STATE ===============
const state = {
  roles: [],
  stages: [],
  introHTML: '',
  user: { email: localStorage.getItem('email')||'', role_id: localStorage.getItem('role_id')||'' },
  currentStage: localStorage.getItem('selected_stage') || ''
};

// =============== HELPERS ===============
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

function httpGet(params){
  const url = new URL(GAS_BASE);
  Object.entries(params||{}).forEach(([k,v])=> url.searchParams.set(k,v));
  return fetch(url.toString()).then(r=>r.json());
}
function httpPost(payload){
  return fetch(GAS_BASE, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) }).then(r=>r.json());
}

// =============== INIT ===============
window.addEventListener('DOMContentLoaded', async() => {
  bindTabs();
  bindProfile();

  await loadConfig();
  renderIntro();
  await renderAgenda();
  await renderMacro();            // engancha clicks del SVG
  await renderToolkit();

  // Observaciones
  const btnObs = $('#btnEnviarObs');
  if(btnObs) btnObs.onclick = onSubmitObservation;

  if(state.user.email) await renderHistory();
});

// =============== NAV ==================
function bindTabs(){
  $$('.tabs.vertical button').forEach(btn=>{
    btn.addEventListener('click', () => {
      $$('.tabs.vertical button').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      $$('.tab').forEach(s=> s.classList.remove('active'));
      $('#'+tab).classList.add('active');
    });
  });
}

// =============== PROFILE ==============
function bindProfile(){
  $('#email').value = state.user.email;
  $('#btnSaveProfile').addEventListener('click', () => {
    state.user.email = $('#email').value.trim();
    state.user.role_id = $('#role').value;
    localStorage.setItem('email', state.user.email);
    localStorage.setItem('role_id', state.user.role_id);
    alert('Perfil guardado');
  });
}

// =============== CONFIG ===============
async function loadConfig(){
  const cfg = await httpGet({ action:'config' });
  state.roles = cfg.roles || [];
  state.stages = cfg.stages || [];
  state.introHTML = (cfg.intro && cfg.intro[0] && cfg.intro[0].html_content) || '';

  const sel = $('#role');
  if(sel){
    sel.innerHTML = state.roles.map(r=>`<option value="${r.role_id}">${r.role_name}</option>`).join('');
    if(state.user.role_id){ sel.value = state.user.role_id; }
  }
}

function renderIntro(){
  const tpl = $('#introTemplate');
  if (state.introHTML && state.introHTML.trim()) $('#introContent').innerHTML = state.introHTML;
  else if (tpl) $('#introContent').innerHTML = tpl.innerHTML;
  else $('#introContent').innerHTML = '<p>Bienvenido</p>';
}

// =============== AGENDA ===============
async function renderAgenda(){
  const role_id = state.user.role_id || '';
  const data = await httpGet({ action:'agenda', role_id });
  const rows = (data.agenda || []).map(r => ({
    period: String(r.period||''),
    day_or_week: r.day_or_week || '',
    description: r.description || '',
    objective: r.objective || ''
  }));

  const periodFilter = $('#agendaPeriod');
  const tbody = $('#agendaTable tbody');
  const acc = $('#agendaAccordion');
  const btnToggle = $('#btnToggleAgendaView');
  let useAccordion = false;

  const PERIOD_LABEL = { daily:'Diario', weekly:'Semanal', monthly:'Mensual', semiannual:'Semestral', annual:'Anual' };
  const PERIOD_ORDER = ['daily','weekly','monthly','semiannual','annual'];

  function paintTable(){
    const filter = periodFilter.value;
    const filtered = rows.filter(r=> !filter || r.period===filter);
    tbody.innerHTML = filtered.map(r =>
      `<tr><td>${PERIOD_LABEL[r.period]||r.period}</td><td>${r.day_or_week}</td><td>${r.description}</td><td>${r.objective}</td></tr>`
    ).join('');
  }

  function paintAccordion(){
    const filter = periodFilter.value;
    const groups = new Map();
    rows.forEach(r=>{
      if(filter && r.period!==filter) return;
      const key = r.period;
      if(!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    });

    const ordered = Array.from(groups.keys()).sort((a,b)=> PERIOD_ORDER.indexOf(a)-PERIOD_ORDER.indexOf(b));
    acc.innerHTML = ordered.map(p=>{
      const items = groups.get(p)||[];
      const list = items.map(r=> `<li><strong>${r.day_or_week}:</strong> ${r.description}<br><em>Objetivo:</em> ${r.objective}</li>`).join('');
      const id = `acc_${p}`;
      return `
        <div class="acc-panel">
          <button class="acc-head" data-target="${id}">${PERIOD_LABEL[p]||p} (${items.length})</button>
          <div id="${id}" class="acc-body" style="display:none;"><ul class="acc-list">${list}</ul></div>
        </div>`;
    }).join('');

    acc.querySelectorAll('.acc-head').forEach(b=>{
      b.onclick = () => {
        const body = document.getElementById(b.dataset.target);
        body.style.display = (body.style.display==='none'||body.style.display==='') ? 'block' : 'none';
      };
    });
  }

  paintTable();
  btnToggle.onclick = () => {
    useAccordion = !useAccordion;
    if(useAccordion){ $('#agendaTable').style.display='none'; acc.style.display='block'; btnToggle.textContent='Ver como Tabla'; paintAccordion(); }
    else { $('#agendaTable').style.display='table'; acc.style.display='none'; btnToggle.textContent='Ver como Acordeón'; paintTable(); }
  };
  periodFilter.onchange = () => { useAccordion ? paintAccordion() : paintTable(); };
}

// =============== CICLO COMERCIAL ===============
async function renderMacro(){
  const svg = $('#macroSVG');
  if(!svg) return;
  svg.querySelectorAll('.stage').forEach(node=>{
    node.addEventListener('click', ()=>{
      const stageKey = node.getAttribute('data-stage');
      state.currentStage = stageKey;
      localStorage.setItem('selected_stage', stageKey);
      renderStageChecklistInMacro(stageKey);
    });
  });

  // Si había etapa seleccionada antes, mostrar checklist
  if(state.currentStage) renderStageChecklistInMacro(state.currentStage);
}

async function renderStageChecklistInMacro(stageKey){
  const role_id = state.user.role_id || '';
  const data = await httpGet({ action:'checklist_def', role_id, stage_id: stageKey });
  const items = data.items || [];
  const cont = $('#macroChecklist');

  const labels = {
    planificacion: 'Planificación Comercial',
    cartera: 'Gestión de Cartera',
    contacto: 'Contacto Clientes',
    deteccion: 'Detección de Necesidades',
    asesoria: 'Asesoría y Propuesta',
    cierre: 'Cierre y Seguimiento'
  };

  if (!items.length){
    cont.innerHTML = `<h3>Checklist: ${labels[stageKey]||stageKey}</h3>
      <div class="card"><p>No hay ítems configurados para esta etapa.</p></div>`;
    return;
  }

  cont.innerHTML = `<h3>Checklist: ${labels[stageKey]||stageKey}</h3>` +
    items.map(it => `
      <div class="chk" data-id="${it.item_id}">
        <label>${it.checklist_text}</label>
        <div class="yn">
          <button type="button" class="yes" data-v="YES">Sí</button>
          <button type="button" class="no" data-v="NO">No</button>
        </div>
      </div>`).join('') +
    `<div class="actions"><button id="btnSaveStageChecklist">Guardar</button></div>`;

  // toggle sí/no
  cont.querySelectorAll('.yn button').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      const box=e.target.closest('.chk');
      box.querySelectorAll('.yn button').forEach(b=>b.classList.remove('active'));
      e.target.classList.add('active'); 
      if(e.target.classList.contains('yes')) e.target.classList.add('yes');
      if(e.target.classList.contains('no')) e.target.classList.add('no');
    });
  });

  // Guardar
  $('#btnSaveStageChecklist').onclick = async () => {
    if(!state.user.email){ alert('Ingresa tu email en el encabezado'); return; }
    const rows = Array.from(cont.querySelectorAll('.chk'));
    const payloads = rows.map(box=>{
      const active = box.querySelector('.yn button.active');
      const value = active ? active.dataset.v : '';
      return {
        type:'checklist',
        user_email: state.user.email,
        role_id: state.user.role_id,
        stage_id: state.currentStage,
        item_id: box.dataset.id,
        value
      };
    }).filter(p=>p.value);

    for(const p of payloads){ await httpPost(p); }
    if(state.user.email) renderHistory();
    alert('Checklist guardado');
  };
}

// =============== TOOLKIT ===============
async function renderToolkit(){
  const role_id = state.user.role_id || '';
  const data = await httpGet({ action:'toolkit', role_id });
  const list = data.toolkit || [
    { label:'Guion de Contacto', url:'#', type:'PDF' },
    { label:'Plantilla de Propuesta', url:'#', type:'DOCX' },
    { label:'Diagnóstico de Necesidades', url:'#', type:'XLSX' }
  ];
  const cont = $('#toolkitList');
  cont.innerHTML = list.map(t=>`
    <div class="card">
      <h4>${t.label}</h4>
      <p>Formato: ${t.type||'Archivo'}</p>
      <p><a href="${t.url}" download>Descargar</a></p>
    </div>`).join('');
}

// =============== OBSERVACIONES ===============
async function onSubmitObservation(e){
  e.preventDefault?.();
  if(!state.user.email){ alert('Ingresa tu email en el encabezado'); return; }

  const payload = {
    type:'observation',
    user_email: state.user.email,
    role_id: state.user.role_id,
    empresa: $('#obsEmpresa').value.trim(),
    cliente: $('#obsCliente').value.trim(),
    motivo: $('#obsMotivo').value.trim(),
    fecha: $('#obsFecha').value || '',
    comentario: $('#obsTexto').value.trim()
  };

  const res = await httpPost(payload);
  if(res.ok){
    ['obsEmpresa','obsCliente','obsMotivo','obsFecha','obsTexto'].forEach(id=>{ const el = $('#'+id); if(el) el.value=''; });
    if(state.user.email) renderHistory();
    alert('Observación guardada');
  }
}

// =============== HISTORIAL ===============
async function renderHistory(){
  const email = state.user.email;
  if(!email) return;

  const hc = await httpGet({ action:'history', type:'checklist', email });
  const ho = await httpGet({ action:'history', type:'observation', email });

  const stageMap = {
    planificacion:'Planificación',
    cartera:'Cartera',
    contacto:'Contacto',
    deteccion:'Detección',
    asesoria:'Asesoría',
    cierre:'Cierre'
  };

  const tbodyC = $('#histChecklist tbody');
  tbodyC.innerHTML = (hc.history||[]).slice(-100).reverse().map(r=>{
    const d = new Date(r.timestamp);
    return `<tr>
      <td>${d.toLocaleString()}</td>
      <td>${stageMap[String(r.stage_id)]||r.stage_id}</td>
      <td>${r.item_id}</td>
      <td>${r.value}</td>
    </tr>`;
  }).join('');

  const tbodyO = $('#histObs tbody');
  tbodyO.innerHTML = (ho.history||[]).slice(-100).reverse().map(r=>{
    const d = new Date(r.timestamp);
    return `<tr>
      <td>${(r.fecha || d.toLocaleDateString())}</td>
      <td>${r.empresa||''}</td>
      <td>${r.cliente||''}</td>
      <td>${r.motivo||''}</td>
      <td>${r.comentario||''}</td>
    </tr>`;
  }).join('');
}
