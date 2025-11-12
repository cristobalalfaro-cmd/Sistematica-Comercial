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

// ============= Agenda =============
async function renderAgenda(){
  const role_id = state.user.role_id || '';
  const data = await httpGet({ action:'agenda', role_id });
  const rows = data.agenda || [];
  const periodFilter = $('#agendaPeriod');
  function paint(){
    const tbody = $('#agendaTable tbody');
    const filter = periodFilter.value;
    const filtered = rows.filter(r=> !filter || String(r.period)===filter);
    tbody.innerHTML = filtered.map(r=>`<tr><td>${r.period}</td><td>${r.day_or_week||''}</td><td>${r.description||''}</td></tr>`).join('');
  }
  periodFilter.onchange = paint;
  paint();
}

// ============= Macro Proceso =============
function buildStageSelects(){
  const opts = state.stages.map(s=>`<option value="${s.stage_id}">${s.stage_name}</option>`).join('');
  $('#stageSelect').innerHTML = opts;
  $('#stageSelectChecklist').innerHTML = opts;
  $('#diffStage').innerHTML = `<option value="">(sin etapa)</option>`+opts;
}

async function renderMacro(){
  const stage_id = $('#stageSelect').value || (state.stages[0] && state.stages[0].stage_id) || '';
  const data = await httpGet({ action:'macro', stage_id });
  const list = data.macro || [];
  const cont = $('#macroList');
  cont.innerHTML = list.map(row=>`<div class="card"><h4>${row.activity_title||''}</h4><p>${row.activity_description||''}</p></div>`).join('');
  $('#stageSelect').onchange = renderMacro;
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
