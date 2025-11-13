// ===== CONFIG =====
const GAS_BASE = 'https://script.google.com/macros/s/AKfycbwImP77VSh5iXP3vPTOoPW2U62aUkoOSfeCyf4uYwBUNIHwCRKEgcpE99bVh6sNbdxWPA/exec';
const DEMO_EMAIL = 'demo@sistematicacomercial.cl';

// ===== STATE =====
const state = {
  roles: [],
  user: {
    email: localStorage.getItem('email') || DEMO_EMAIL,
    role_id: localStorage.getItem('role_id') || ''
  },
  stagesOrder: ['planificacion','cartera','contacto','deteccion','asesoria','cierre'],
  stagesNames: {
    planificacion: '1 / Preparación',
    cartera: '2 / Gestión de Cartera',
    contacto: '3 / Contacto',
    deteccion: '4 / Detección de Necesidades',
    asesoria: '5 / Asesoría y Propuesta de Valor',
    cierre: '6 / Cierre y Seguimiento'
  }
};

// ===== HELPERS =====
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function showToast(msg){
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 1800);
}

function httpGet(params){
  const url = new URL(GAS_BASE);
  Object.entries(params || {}).forEach(([k,v])=> url.searchParams.set(k,v));
  return fetch(url).then(r=>r.json());
}

function httpPost(payload){
  return fetch(GAS_BASE,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(payload)
  }).then(r=>r.json());
}

// ===== INIT =====
window.addEventListener('DOMContentLoaded', async () => {
  bindTabs();
  setupHeader();
  await loadConfig();
  renderIntro();
  renderToolkit();
  await renderFullChecklist();
  await renderHistory();
});

// ===== NAV TABS =====
function bindTabs(){
  $$('.tabs.vertical button').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      $$('.tabs.vertical button').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');

      const tabId = btn.dataset.tab;
      $$('.tab').forEach(sec=>sec.classList.remove('active'));
      $('#'+tabId).classList.add('active');
    });
  });
}

// ===== HEADER =====
function setupHeader(){
  // botón salir no hace nada por ahora (demo)
  const btnExit = $('#btnExit');
  if (btnExit) btnExit.onclick = () => {};

  if (!state.user.email){
    state.user.email = DEMO_EMAIL;
    localStorage.setItem('email', DEMO_EMAIL);
  }
}

// ===== CONFIG (ROLES) =====
async function loadConfig(){
  try{
    const cfg = await httpGet({action:'config'});
    state.roles = cfg.roles || [];
  }catch(e){
    // fallback demo
    state.roles = [{role_id:'ejec', role_name:'Ejecutivo Comercial'}];
  }

  const sel = $('#role');
  sel.innerHTML = state.roles
    .map(r=>`<option value="${r.role_id}">${r.role_name}</option>`)
    .join('');

  if (state.user.role_id) sel.value = state.user.role_id;

  sel.onchange = () => {
    state.user.role_id = sel.value;
    localStorage.setItem('role_id', state.user.role_id);
    renderFullChecklist();
    renderHistory();
  };
}

// ===== INTRO =====
function renderIntro(){
  const tpl = $('#introTemplate');
  $('#introContent').innerHTML = tpl ? tpl.innerHTML : '';
}

// ===== CHECKLIST COMPLETO (CICLO COMERCIAL) =====
async function fetchChecklistFull(){
  const role_id = state.user.role_id || '';

  // 1) intentar endpoint full
  try{
    const full = await httpGet({action:'checklist_def_full', role_id});
    if (full && full.items && full.items.length) return full.items;
  }catch(e){
    // sigue
  }

  // 2) fallback: pedir por etapa
  const items = [];
  for (const stage_id of state.stagesOrder){
    try{
      const res = await httpGet({action:'checklist_def', role_id, stage_id});
      (res.items || []).forEach(it => items.push({...it, stage_id}));
    }catch(e){}
  }
  return items;
}

async function renderFullChecklist(){
  const cont = $('#fullChecklist');
  cont.innerHTML = '<p>Cargando checklist…</p>';

  const items = await fetchChecklistFull();
  if (!items.length){
    cont.innerHTML = '<p>No hay ítems configurados en la sistemática.</p>';
    return;
  }

  // agrupar por etapa
  const byStage = new Map();
  items.forEach(it=>{
    const s = it.stage_id || 'otros';
    if (!byStage.has(s)) byStage.set(s, []);
    byStage.get(s).push(it);
  });

  const orderedStages = Array.from(byStage.keys())
    .sort((a,b)=> state.stagesOrder.indexOf(a) - state.stagesOrder.indexOf(b));

  let html = '';
  orderedStages.forEach(stage_id=>{
    const list = byStage.get(stage_id)
      .sort((a,b)=>(a.substage_order||0)-(b.substage_order||0) || (a.item_order||0)-(b.item_order||0));

    html += `<h3 class="checklist-stage">${state.stagesNames[stage_id] || stage_id}</h3>`;

    const groups = new Map();
    list.forEach(it=>{
      const key = it.substage_title || '';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(it);
    });

    groups.forEach((arr, subTitle)=>{
      if (subTitle) html += `<div class="checklist-sub">${subTitle}</div>`;
      html += arr.map(it=>`
        <div class="chk" data-stage="${stage_id}" data-id="${it.item_id}">
          <label>${it.checklist_text}</label>
          <div class="yn">
            <button type="button" class="yes" data-v="YES">Sí</button>
            <button type="button" class="no" data-v="NO">No</button>
          </div>
        </div>
      `).join('');
    });
  });

  cont.innerHTML = html;

  // toggle sí/no
  cont.querySelectorAll('.yn button').forEach(btn=>{
    btn.addEventListener('click', ev=>{
      const box = ev.target.closest('.chk');
      box.querySelectorAll('.yn button').forEach(b=>b.classList.remove('active','yes','no'));
      ev.target.classList.add('active');
      if (ev.target.classList.contains('yes')) ev.target.classList.add('yes');
      if (ev.target.classList.contains('no')) ev.target.classList.add('no');
    });
  });

  // Guardar
  $('#btnSaveFullChecklist').onclick = async () => {
    if (!confirm('¿Deseas guardar la evaluación completa del ciclo comercial?')) return;
    if (!state.user.email){
      alert('Falta email (en la demo se usa uno genérico).');
      return;
    }

    const clientes     = $('#clientesConsiderados').value.trim();
    const periodoDesde = $('#periodoDesde').value || '';
    const periodoHasta = $('#periodoHasta').value || '';
    const comentarios  = $('#comentarios').value.trim();

    const rows = Array.from(document.querySelectorAll('#fullChecklist .chk'));

    const payloads = rows.map(box=>{
      const active = box.querySelector('.yn button.active');
      if (!active) return null;
      return {
        type: 'checklist',
        user_email: state.user.email,
        role_id: state.user.role_id,
        stage_id: box.dataset.stage,
        item_id: box.dataset.id,
        value: active.dataset.v,
        clientes_considerados: clientes,
        periodo_desde: periodoDesde,
        periodo_hasta: periodoHasta,
        comentarios
      };
    }).filter(Boolean);

    for (const p of payloads){
      await httpPost(p);
    }

    showToast('Checklist guardado');
    renderHistory();
  };

  // Borrar datos (limpia solo front)
  $('#btnClearFullChecklist').onclick = () => {
    document.querySelectorAll('#fullChecklist .yn button')
      .forEach(b=>b.classList.remove('active','yes','no'));
    ['clientesConsiderados','periodoDesde','periodoHasta','comentarios']
      .forEach(id => { const el = document.getElementById(id); if (el) el.value=''; });
    showToast('Evaluación limpiada');
  };
}

// ===== TOOLKIT =====
function renderToolkit(){
  const items = [
    {label:'Script llamada',       icon:'📞', url:'#'},
    {label:'Redacción correo',     icon:'✉️', url:'#'},
    {label:'Negociación',          icon:'🤝', url:'#'},
    {label:'Manejo de objeciones', icon:'🔍', url:'#'},
    {label:'Propuesta de valor',   icon:'💡', url:'#'},
    {label:'Manual de productos',  icon:'📘', url:'#'}
  ];

  const cont = $('#toolkitList');
  cont.innerHTML = items.map(t=>`
    <a class="toolkit-item" href="${t.url}" download>
      <span class="tk-ico">${t.icon}</span>
      <span class="tk-txt">Descarga ${t.label}</span>
    </a>
  `).join('');
}

// ===== HISTORIAL =====
async function renderHistory(){
  const email = state.user.email;

  let res = {history:[]};
  try{
    res = await httpGet({action:'history', type:'checklist', email});
  }catch(e){}

  const rows = (res.history || []).slice(-100).reverse();
  const tbody = $('#histChecklist tbody');
  tbody.innerHTML = rows.map(r=>{
    const d = r.timestamp ? new Date(r.timestamp) : null;
    const fecha = d ? d.toLocaleString() : '';
    return `<tr>
      <td>${fecha}</td>
      <td>${r.stage_id || ''}</td>
      <td>${r.item_id || ''}</td>
      <td>${r.value || ''}</td>
    </tr>`;
  }).join('');

  // KPIs: intentar history_summary; si no existe, calculamos a partir de history
  try{
    const sum = await httpGet({action:'history_summary', email});
    paintKpis(sum);
  }catch(e){
    const byStage = {};
    rows.forEach(r=>{
      const st = r.stage_id || 'otros';
      if (!byStage[st]) byStage[st] = {yes:0,total:0};
      byStage[st].total++;
      if (String(r.value).toUpperCase() === 'YES') byStage[st].yes++;
    });

    const data = {
      byStage: Object.entries(byStage).map(([stage_id,v])=>({
        stage_id,
        pct: v.total ? Math.round(100*v.yes/v.total) : 0
      })),
      byMonth:[]
    };
    paintKpis(data);
  }
}

function paintKpis(data){
  const byStage = data.byStage || [];
  const byMonth = data.byMonth || [];

  // total promedio
  let total = 0, n = 0;
  byStage.forEach(s => { total += (s.pct || 0); n++; });
  $('#kpiTotal').textContent = n ? Math.round(total/n) + '%' : '—';

  // por etapa
  const ul = $('#kpiEtapas');
  ul.innerHTML = byStage.map(s=>{
    const pct = s.pct || 0;
    const name = (state.stagesNames[s.stage_id] || s.stage_id).replace(/^\d+ \\/ /,'');
    return `
      <li>
        <span class="kpi-badge">${pct}%</span>
        <span style="min-width:220px">${name}</span>
        <span class="kpi-bar"><i style="width:${pct}%"></i></span>
      </li>
    `;
  }).join('');

  // por mes
  const box = $('#kpiMeses');
  if (!byMonth.length){
    box.innerHTML = '<div class="mes"><span>Sin datos</span><span class="pct">—</span></div>';
  }else{
    box.innerHTML = byMonth.map(m=>`
      <div class="mes">
        <span>${m.month}</span>
        <span class="pct">${m.pct || 0}%</span>
      </div>
    `).join('');
  }
}
