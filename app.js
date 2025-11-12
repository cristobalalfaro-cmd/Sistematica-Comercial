// ===================== CONFIG =====================
// Reemplaza por tu URL de Apps Script /exec
const GAS_BASE = 'https://script.google.com/macros/s/AKfycbwImP77VSh5iXP3vPTOoPW2U62aUkoOSfeCyf4uYwBUNIHwCRKEgcpE99bVh6sNbdxWPA/exec';

// ===================== STATE =====================
const state = {
  roles: [],
  stages: [],
  introHTML: '',
  user: { email: localStorage.getItem('email')||'', role_id: localStorage.getItem('role_id')||'' },
  currentStage: localStorage.getItem('selected_stage') || ''
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

// ===================== INIT =====================
window.addEventListener('DOMContentLoaded', async() => {
  bindTabs();
  bindProfile();
  await loadConfig();
  renderIntro();
  await renderAgenda();
  buildStageSelects();           // para selects internos (si los usas)
  await renderMacro();           // engancha clicks del SVG si existe
  // checklist inicial (si hay etapa guardada)
  if(state.currentStage){ await renderChecklistByStage(state.currentStage); }
  await renderToolkit();
  if(state.user.email) await renderHistory();

  // botón dificultades
  const diffBtn = document.getElementById('btnSubmitDiff');
  if(diffBtn){
    diffBtn.onclick = onSubmitDifficulty;
  }
});

// ===================== NAV TABS =====================
function bindTabs(){
  $$('.tabs button').forEach(btn=>{
    btn.addEventListener('click', () => {
      // activar pestaña
      $$('.tabs button').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      $$('.tab').forEach(s=> s.classList.remove('active'));
      $('#'+tab).classList.add('active');

      // si es un tab de etapa -> checklist por etapa
      const stage = btn.dataset.stage;
      if (tab === 'checklist') {
        if (stage) {
          state.currentStage = stage;
          localStorage.setItem('selected_stage', stage);
          renderChecklistByStage(stage);
        } else {
          const s = localStorage.getItem('selected_stage') || (state.stages[0] && state.stages[0].stage_id) || '';
          state.currentStage = s;
          renderChecklistByStage(s);
        }
      }
    });
  });
}

// ===================== PROFILE =====================
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

// ===================== LOAD CONFIG =====================
async function loadConfig(){
  const cfg = await httpGet({ action:'config' });
  state.roles = cfg.roles || [];
  state.stages = cfg.stages || [];
  const intro = (cfg.intro && cfg.intro[0] && cfg.intro[0].html_content) || '';
  state.introHTML = intro;

  const sel = $('#role');
  if(sel){
    sel.innerHTML = state.roles.map(r=>`<option value="${r.role_id}">${r.role_name}</option>`).join('');
    if(state.user.role_id){ sel.value = state.user.role_id; }
  }
}

function renderIntro(){
  const tpl = document.querySelector('#introTemplate');
  if (state.introHTML && state.introHTML.trim().length > 0) {
    $('#introContent').innerHTML = state.introHTML;
  } else if (tpl) {
    $('#introContent').innerHTML = tpl.innerHTML;
  } else {
    $('#introContent').innerHTML = '<p>Bienvenido</p>';
  }
}

// ===================== AGENDA (tabla + acordeón) =====================
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

  const PERIOD_LABEL = {
    daily: 'Diario',
    weekly: 'Semanal',
    monthly: 'Mensual',
    semiannual: 'Semestral',
    annual: 'Anual'
  };
  const PERIOD_ORDER = ['daily','weekly','monthly','semiannual','annual'];

  function paintTable(){
    if(!tbody) return;
    const filter = periodFilter ? periodFilter.value : '';
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
    if(!acc) return;
    const filter = periodFilter ? periodFilter.value : '';
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

  if (btnToggle) {
    btnToggle.onclick = () => {
      useAccordion = !useAccordion;
      if(useAccordion){
        const tbl = $('#agendaTable');
        if(tbl) tbl.style.display = 'none';
        if(acc) acc.style.display = 'block';
        btnToggle.textContent = 'Ver como Tabla';
        paintAccordion();
      } else {
        const tbl = $('#agendaTable');
        if(tbl) tbl.style.display = 'table';
        if(acc) acc.style.display = 'none';
        btnToggle.textContent = 'Ver como Acordeón';
        paintTable();
      }
    };
  }

  if (periodFilter) {
    periodFilter.onchange = () => {
      if(useAccordion) paintAccordion();
      else paintTable();
    };
  }
}

// ===================== SELECTS de etapa (si los usas en otras vistas) =====================
function buildStageSelects(){
  // si tienes selects en Checklist o Dificultades, puedes llenarlos aquí
  const opts = state.stages.map(s=>`<option value="${s.stage_id}">${s.stage_name}</option>`).join('');
  const s1 = $('#stageSelect');
  if(s1) s1.innerHTML = opts;
  const s2 = $('#stageSelectChecklist');
  if(s2) s2.innerHTML = opts;
  const s3 = $('#diffStage');
  if(s3) s3.innerHTML = `<option value="">(sin etapa)</option>`+opts;
}

// ===================== MACRO (enganche de SVG -> checklist) =====================
async function renderMacro(){
  const svg = document.getElementById('macroSVG');
  if (!svg) return;
  svg.querySelectorAll('.stage').forEach(node=>{
    node.addEventListener('click', ()=>{
      const stageKey = node.getAttribute('data-stage');
      state.currentStage = stageKey;
      localStorage.setItem('selected_stage', stageKey);

      // activar tab checklist y, si existe, su botón específico
      $$('.tabs button').forEach(b=>b.classList.remove('active'));
      const stageBtn = document.querySelector(`.tabs button[data-tab="checklist"][data-stage="${stageKey}"]`);
      const genericBtn = document.querySelector(`.tabs button[data-tab="checklist"]`);
      (stageBtn || genericBtn)?.classList.add('active');

      $$('.tab').forEach(s=>s.classList.remove('active'));
      $('#checklist').classList.add('active');

      renderChecklistByStage(stageKey);
    });
  });
}

// ===================== CHECKLIST (por etapa) =====================
async function renderChecklistByStage(stageKey){
  if(!stageKey) stageKey = localStorage.getItem('selected_stage') || '';
  state.currentStage = stageKey;

  const role_id = state.user.role_id || '';
  const data = await httpGet({ action:'checklist_def', role_id, stage_id: stageKey });
  const items = data.items || [];

  const form = $('#checklistForm');
  if (!form) return;

  if (!items.length) {
    form.innerHTML = `<div class="card"><p>No hay ítems configurados para esta etapa.</p></div>`;
  } else {
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

  // engancha Guardar para usar la etapa actual
  const saveBtn = document.getElementById('btnSubmitChecklist');
  if(saveBtn){
    saveBtn.onclick = async(e) => {
      e.preventDefault();
      if(!state.user.email){ alert('Ingresa tu email en el encabezado'); return; }

      const payloads = Array.from(document.querySelectorAll('.chk')).map(box=>{
        const active = box.querySelector('.yn button.active');
        const value = active ? active.dataset.v : '';
        return {
          type:'checklist',
          user_email: state.user.email,
          role_id: state.user.role_id,
          stage_id: state.currentStage,
          item_id: box.dataset.id,
          value,
          notes: document.getElementById('notes').value.trim(),
          client_org: document.getElementById('clientOrg').value.trim(),
        };
      }).filter(p=>p.value); // solo envía los marcados

      for(const p of payloads){ await httpPost(p); }
      document.getElementById('notes').value = '';
      if(state.user.email) renderHistory();
      alert('Checklist guardado');
    };
  }
}

// ===================== TOOLKIT =====================
async function renderToolkit(){
  const role_id = state.user.role_id || '';
  const data = await httpGet({ action:'toolkit', role_id });
  const list = data.toolkit || [];
  const cont = document.getElementById('toolkitList');
  if(!cont) return;
  cont.innerHTML = list.map(t=>`
    <div class="card">
      <h4>${t.label}</h4>
      <p>${t.type||''}</p>
      <p><a href="${t.url}" target="_blank">Abrir</a></p>
    </div>`).join('');
}

// ===================== DIFICULTADES =====================
async function onSubmitDifficulty(e){
  e.preventDefault();
  if(!state.user.email){ alert('Ingresa tu email en el encabezado'); return; }
  const payload = {
    type:'difficulty',
    user_email: state.user.email,
    role_id: state.user.role_id,
    stage_id: document.getElementById('diffStage')?.value || '',
    topic: document.getElementById('diffTopic')?.value.trim() || '',
    description: document.getElementById('diffDescription')?.value.trim() || '',
    severity: document.getElementById('diffSeverity')?.value || '1',
    tags: (document.getElementById('diffTags')?.value || '').split(',').map(s=>s.trim()).filter(Boolean)
  };
  const res = await httpPost(payload);
  if(res.ok){
    const fields = ['diffTopic','diffDescription','diffTags'];
    fields.forEach(id=>{ const el = document.getElementById(id); if(el) el.value=''; });
    if(state.user.email) renderHistory();
    alert('Dificultad registrada');
  }
}

// ===================== HISTORIAL =====================
async function renderHistory(){
  const email = state.user.email;
  if(!email) return;
  const hc = await httpGet({ action:'history', type:'checklist', email });
  const hd = await httpGet({ action:'history', type:'difficulty', email });

  const stageMap = Object.fromEntries(state.stages.map(s=>[String(s.stage_id), s.stage_name]));

  const tbodyC = document.querySelector('#histChecklist tbody');
  if(tbodyC){
    tbodyC.innerHTML = (hc.history||[]).slice(-100).reverse().map(r=>{
      const d = new Date(r.timestamp);
      return `<tr>
        <td>${d.toLocaleString()}</td>
        <td>${stageMap[String(r.stage_id)]||r.stage_id}</td>
        <td>${r.item_id}</td>
        <td>${r.value}</td>
        <td>${r.notes||''}</td>
      </tr>`;
    }).join('');
  }

  const tbodyD = document.querySelector('#histDiff tbody');
  if(tbodyD){
    tbodyD.innerHTML = (hd.history||[]).slice(-100).reverse().map(r=>{
      const d = new Date(r.timestamp);
      return `<tr>
        <td>${d.toLocaleString()}</td>
        <td>${stageMap[String(r.stage_id)]||r.stage_id}</td>
        <td>${r.topic||''}</td>
        <td>${r.severity||''}</td>
        <td>${r.status||''}</td>
      </tr>`;
    }).join('');
  }
}
