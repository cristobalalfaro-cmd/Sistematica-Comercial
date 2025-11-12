// ===================== CONFIG =====================
const GAS_BASE = 'https://script.google.com/macros/s/AKfycbwImP77VSh5iXP3vPTOoPW2U62aUkoOSfeCyf4uYwBUNIHwCRKEgcpE99bVh6sNbdxWPA/exec'; // p.ej. https://script.google.com/macros/s/AKfycbx.../exec

// ===================== STATE =====================
const state = {
  roles: [],
  stages: [],
  introHTML: '',
  user: { email: localStorage.getItem('email')||'', role_id: localStorage.getItem('role_id')||'' }
};

// ===================== HELPERS =====================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function httpGet(params){
  const url = new URL(GAS_BASE);
  Object.entries(params||{}).forEach(([k,v])=> url.searchParams.set(k,v));
  return fetch(url.toString()).then(r=>r.json());
}
function httpPost(payload){
  return fetch(GAS_BASE, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) }).then(r=>r.json());
}

function toast(msg){
  console.log(msg);
}

// ===================== INIT =====================
window.addEventListener('DOMContentLoaded', async() => {
  bindTabs();
  bindProfile();
  await loadConfig();
  renderIntro();
  await renderAgenda();
  buildStageSelects();
  await renderMacro();
  await renderChecklist();
  await renderToolkit();
  if(state.user.email) await renderHistory();
});

function bindTabs(){
  $$('.tabs button').forEach(btn=>{
    btn.addEventListener('click', () => {
      $$('.tabs button').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      $$('.tab').forEach(s=> s.classList.remove('active'));
      $('#'+tab).classList.add('active');
    });
  });
}

async function renderChecklistByStage(stageKey){
  const role_id = state.user.role_id || '';
  const data = await httpGet({ action:'checklist_def', role_id, stage_id: stageKey });
  const items = data.items || [];
  const form = $('#checklistForm');
  form.innerHTML = items.map(it => `
    <div class="chk" data-id="${it.item_id}">
      <label>${it.checklist_text}</label>
      <div class="yn">
        <button type="button" class="yes" data-v="YES">Sí</button>
        <button type="button" class="no" data-v="NO">No</button>
      </div>
    </div>
  `).join('');
  form.querySelectorAll('.yn button').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      const box=e.target.closest('.chk');
      box.querySelectorAll('.yn button').forEach(b=>b.classList.remove('active'));
      e.target.classList.add('active'); 
      if(e.target.classList.contains('yes')) e.target.classList.add('yes');
      if(e.target.classList.contains('no')) e.target.classList.add('no');
    });
  });
}

function bindProfile(){
  $('#email').value = state.user.email;
  $('#btnSaveProfile').addEventListener('click', () => {
    state.user.email = $('#email').value.trim();
    state.user.role_id = $('#role').value;
    localStorage.setItem('email', state.user.email);
    localStorage.setItem('role_id', state.user.role_id);
    toast('Perfil guardado');
  });
}

async function loadConfig(){
  const cfg = await httpGet({ action:'config' });
  state.roles = cfg.roles || [];
  state.stages = cfg.stages || [];
  const intro = (cfg.intro && cfg.intro[0] && cfg.intro[0].html_content) || '<p>Bienvenido</p>';
  state.introHTML = intro;
  // roles select
  const sel = $('#role');
  sel.innerHTML = state.roles.map(r=>`<option value="${r.role_id}">${r.role_name}</option>`).join('');
  if(state.user.role_id){ sel.value = state.user.role_id; }
}

function renderIntro(){
  $('#introContent').innerHTML = state.introHTML;
}

async function renderAgenda(){
  const role_id = state.user.role_id || '';
  const data = await httpGet({ action:'agenda', role_id });
  const rows = (data.agenda || []).map(r => ({
    period: String(r.period||''),
    day_or_week: r.day_or_week || '',
    description: r.description || '',
    objective: r.objective || '' // NUEVO
  }));

  const periodFilter = $('#agendaPeriod');
  const tbody = $('#agendaTable tbody');
  const acc = $('#agendaAccordion');
  const btnToggle = $('#btnToggleAgendaView');
  let useAccordion = false;

  // ---- helpers ----
  const PERIOD_LABEL = {
    daily: 'Diario',
    weekly: 'Semanal',
    monthly: 'Mensual',
    semiannual: 'Semestral',
    annual: 'Anual'
  };
  const PERIOD_ORDER = ['daily','weekly','monthly','semiannual','annual'];

  function paintTable(){
    const filter = periodFilter.value;
    const filtered = rows.filter(r=> !filter || r.period===filter);
    tbody.innerHTML = filtered.map(r =>
      `<tr>
        <td>${PERIOD_LABEL[r.period]||r.period}</td>
        <td>${r.day_or_week}</td>
        <td>${r.description}</td>
        <td>${r.objective}</td>
      </tr>`
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

    const orderedKeys = Array.from(groups.keys()).sort(
      (a,b)=> PERIOD_ORDER.indexOf(a)-PERIOD_ORDER.indexOf(b)
    );

    acc.innerHTML = orderedKeys.map(p=>{
      const items = groups.get(p) || [];
      const list = items.map(r =>
        `<li><strong>${r.day_or_week}:</strong> ${r.description}
          <br><em>Objetivo:</em> ${r.objective}</li>`
      ).join('');
      const id = `acc_${p}`;
      return `
        <div class="acc-panel">
          <button class="acc-head" data-target="${id}">
            ${PERIOD_LABEL[p]||p} (${items.length})
          </button>
          <div id="${id}" class="acc-body" style="display:none;">
            <ul class="acc-list">${list}</ul>
          </div>
        </div>`;
    }).join('');

    // listeners
    acc.querySelectorAll('.acc-head').forEach(btn=>{
      btn.onclick = () => {
        const target = btn.dataset.target;
        const body = document.getElementById(target);
        body.style.display = (body.style.display==='none' || body.style.display==='') ? 'block' : 'none';
      };
    });
  }

  // primer pintado
  paintTable();

  // toggle vista
  btnToggle.onclick = () => {
    useAccordion = !useAccordion;
    if(useAccordion){
      $('#agendaTable').style.display = 'none';
      acc.style.display = 'block';
      btnToggle.textContent = 'Ver como Tabla';
      paintAccordion();
    } else {
      $('#agendaTable').style.display = 'table';
      acc.style.display = 'none';
      btnToggle.textContent = 'Ver como Acordeón';
      paintTable();
    }
  };

  periodFilter.onchange = () => {
    if(useAccordion) paintAccordion();
    else paintTable();
  };
}

// ============= Macro Proceso =============
function buildStageSelects(){
  const opts = state.stages.map(s=>`<option value="${s.stage_id}">${s.stage_name}</option>`).join('');
  $('#stageSelect').innerHTML = opts;
  $('#stageSelectChecklist').innerHTML = opts;
  $('#diffStage').innerHTML = `<option value="">(sin etapa)</option>`+opts;
}

async function renderMacro(){
  const container = document.querySelector('#macro');
  container.querySelectorAll('.etapa').forEach(btn=>{
    btn.onclick = () => {
      const stageKey = btn.dataset.stage;
      // Guarda el stage seleccionado en el localStorage para usar en checklist
      localStorage.setItem('selected_stage', stageKey);
      // Cambia a la pestaña "Checklist"
      $$('.tabs button').forEach(b=>b.classList.remove('active'));
      document.querySelector('.tabs button[data-tab="checklist"]').classList.add('active');
      $$('.tab').forEach(s=>s.classList.remove('active'));
      $('#checklist').classList.add('active');
      // Cargar checklist correspondiente
      renderChecklistByStage(stageKey);
    };
  });
}

// Nueva función específica para cargar checklist por etapa
async function renderChecklistByStage(stageKey){
  const role_id = state.user.role_id || '';
  const data = await httpGet({ action:'checklist_def', role_id, stage_id: stageKey });
  const items = data.items || [];
  const form = $('#checklistForm');
  form.innerHTML = items.map(it => `
    <div class="chk" data-id="${it.item_id}">
      <label>${it.checklist_text}</label>
      <div class="yn">
        <button type="button" class="yes" data-v="YES">Sí</button>
        <button type="button" class="no" data-v="NO">No</button>
      </div>
    </div>
  `).join('');
}


// ============= Checklist =============
async function renderChecklist(){
  const stage_id = $('#stageSelectChecklist').value || (state.stages[0] && state.stages[0].stage_id) || '';
  const role_id = state.user.role_id || '';
  const data = await httpGet({ action:'checklist_def', stage_id, role_id });
  const items = data.items || [];
  const form = $('#checklistForm');
  form.innerHTML = items.map(it=>{
    const id = `item_${it.item_id}`;
    return `<div class="chk" data-id="${it.item_id}">
      <label for="${id}">${it.checklist_text}</label>
      <div class="yn">
        <button type="button" class="yes" data-v="YES">Sí</button>
        <button type="button" class="no" data-v="NO">No</button>
      </div>
    </div>`;
  }).join('');
  form.querySelectorAll('.yn button').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      const box = e.target.closest('.chk');
      box.querySelectorAll('.yn button').forEach(b=>b.classList.remove('active'));
      e.target.classList.add('active');
      if(e.target.classList.contains('yes')) e.target.classList.add('yes');
      if(e.target.classList.contains('no')) e.target.classList.add('no');
    });
  });
  $('#btnSubmitChecklist').onclick = async(e) => {
    e.preventDefault();
    if(!state.user.email){ alert('Ingresa tu email en el encabezado'); return; }
    const payloads = Array.from(document.querySelectorAll('.chk')).map(box=>{
      const active = box.querySelector('.yn button.active');
      const value = active ? active.dataset.v : '';
      return {
        type:'checklist',
        user_email: state.user.email,
        role_id: state.user.role_id,
        stage_id,
        item_id: box.dataset.id,
        value,
        notes: $('#notes').value.trim(),
        client_org: $('#clientOrg').value.trim(),
      };
    }).filter(p=>p.value);
    for(const p of payloads){ await httpPost(p); }
    $('#notes').value = '';
    toast('Checklist guardado');
    if(state.user.email) renderHistory();
  };
  $('#stageSelectChecklist').onchange = renderChecklist;
}

// ============= Toolkit =============
async function renderToolkit(){
  const role_id = state.user.role_id || '';
  const data = await httpGet({ action:'toolkit', role_id });
  const list = data.toolkit || [];
  $('#toolkitList').innerHTML = list.map(t=>`<div class="card"><h4>${t.label}</h4><p>${t.type||''}</p><p><a href="${t.url}" target="_blank">Abrir</a></p></div>`).join('');
}

// ============= Difficulties =============
$('#btnSubmitDiff') && ($('#btnSubmitDiff').onclick = async(e)=>{
  e.preventDefault();
  if(!state.user.email){ alert('Ingresa tu email en el encabezado'); return; }
  const payload = {
    type:'difficulty',
    user_email: state.user.email,
    role_id: state.user.role_id,
    stage_id: $('#diffStage').value,
    topic: $('#diffTopic').value.trim(),
    description: $('#diffDescription').value.trim(),
    severity: $('#diffSeverity').value,
    tags: $('#diffTags').value.split(',').map(s=>s.trim()).filter(Boolean)
  };
  const res = await httpPost(payload);
  if(res.ok){
    $('#diffTopic').value=''; $('#diffDescription').value=''; $('#diffTags').value='';
    toast('Dificultad registrada');
    if(state.user.email) renderHistory();
  }
});

// ============= History =============
async function renderHistory(){
  const email = state.user.email;
  const hc = await httpGet({ action:'history', type:'checklist', email });
  const hd = await httpGet({ action:'history', type:'difficulty', email });
  const stageMap = Object.fromEntries(state.stages.map(s=>[String(s.stage_id), s.stage_name]));
  const tbodyC = $('#histChecklist tbody');
  tbodyC.innerHTML = (hc.history||[]).slice(-100).reverse().map(r=>{
    const d = new Date(r.timestamp);
    return `<tr><td>${d.toLocaleString()}</td><td>${stageMap[String(r.stage_id)]||r.stage_id}</td><td>${r.item_id}</td><td>${r.value}</td><td>${r.notes||''}</td></tr>`;
  }).join('');
  const tbodyD = $('#histDiff tbody');
  tbodyD.innerHTML = (hd.history||[]).slice(-100).reverse().map(r=>{
    const d = new Date(r.timestamp);
    return `<tr><td>${d.toLocaleString()}</td><td>${stageMap[String(r.stage_id)]||r.stage_id}</td><td>${r.topic||''}</td><td>${r.severity||''}</td><td>${r.status||''}</td></tr>`;
  }).join('');
}
