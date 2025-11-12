/**
 * Sistemática Comercial API — Google Apps Script
 * Desplegar como Web App (Nueva implementación) con ejecución como tú y acceso "Cualquiera con el enlace".
 */

const SHEETS = {
  USERS: 'Users',
  ROLES: 'Roles',
  STAGES: 'Stages',
  AGENDA: 'Agenda',
  MACRO: 'Macro',
  CHECK_DEF: 'Checklist_Def',
  TOOLKIT: 'Toolkit',
  INTRO: 'Static_Intro',
  SUBMIT: 'Submissions_Checklist',
  DIFF: 'Difficulties',
};

const ALLOWED_ORIGINS = [
  '*', // Cambia a ['https://tudominio.com', 'https://usuario.github.io'] en producción
];

function _sheet(name){ return SpreadsheetApp.getActive().getSheetByName(name); }

function _toJSON_(sheet){
  const values = sheet.getDataRange().getValues();
  const header = values.shift();
  return values.filter(r => r.join('').length > 0).map(r => Object.fromEntries(header.map((h,i)=>[String(h).trim(), r[i]])));
}

function _jsonResponse(payload, code) {
  const response = ContentService.createTextOutput(JSON.stringify(payload));
  response.setMimeType(ContentService.MimeType.JSON);
  return response;
}

function doOptions(e){
  return HtmlService.createHtmlOutput('OK')
    .setContent('')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doGet(e){
  const action = (e && e.parameter && e.parameter.action) || 'ping';
  const email = (e && e.parameter && e.parameter.email) || '';
  switch(action){
    case 'ping':
      return _jsonResponse({ok:true, now: new Date(), version:'v0.1'}, 200);

    case 'config': {
      const roles = _toJSON_(_sheet(SHEETS.ROLES));
      const stages = _toJSON_(_sheet(SHEETS.STAGES)).sort((a,b)=>Number(a.stage_order||0)-Number(b.stage_order||0));
      const intro = _toJSON_(_sheet(SHEETS.INTRO));
      return _jsonResponse({roles, stages, intro}, 200);
    }

    case 'agenda': {
      const role_id = (e.parameter.role_id||'').toString();
      let rows = _toJSON_(_sheet(SHEETS.AGENDA));
      if(role_id) rows = rows.filter(r=> String(r.role_id)===role_id);
      return _jsonResponse({agenda: rows}, 200);
    }

    case 'macro': {
      const stage_id = (e.parameter.stage_id||'').toString();
      let rows = _toJSON_(_sheet(SHEETS.MACRO));
      if(stage_id) rows = rows.filter(r=> String(r.stage_id)===stage_id);
      return _jsonResponse({macro: rows}, 200);
    }

    case 'checklist_def': {
      const role_id = (e.parameter.role_id||'').toString();
      const stage_id = (e.parameter.stage_id||'').toString();
      let rows = _toJSON_(_sheet(SHEETS.CHECK_DEF));
      if(role_id) rows = rows.filter(r=> String(r.role_id)===role_id);
      if(stage_id) rows = rows.filter(r=> String(r.stage_id)===stage_id);
      return _jsonResponse({items: rows}, 200);
    }

    case 'toolkit': {
      const role_id = (e.parameter.role_id||'').toString();
      let rows = _toJSON_(_sheet(SHEETS.TOOLKIT));
      if(role_id) rows = rows.filter(r=> String(r.role_id)===role_id);
      return _jsonResponse({toolkit: rows}, 200);
    }

    case 'history': {
      const type = (e.parameter.type||'checklist'); // 'checklist'|'difficulty'
      const sheet = type==='difficulty' ? SHEETS.DIFF : SHEETS.SUBMIT;
      let rows = _toJSON_(_sheet(sheet));
      if(email) rows = rows.filter(r=> String(r.user_email||'').toLowerCase()===String(email).toLowerCase());
      return _jsonResponse({history: rows.slice(-500)}, 200); // últimos 500
    }

    default:
      return _jsonResponse({ok:false, error:'Unknown action'}, 400);
  }
}

function doPost(e){
  try{
    const body = JSON.parse(e.postData.contents||'{}');
    const type = body.type; // 'checklist' | 'difficulty'
    if(type==='checklist'){
      const sh = _sheet(SHEETS.SUBMIT);
      sh.appendRow([
        new Date(),
        body.user_email||'',
        body.role_id||'',
        body.stage_id||'',
        body.item_id||'',
        body.value||'', // YES|NO
        body.notes||'',
        body.client_org||''
      ]);
      return _jsonResponse({ok:true}, 200);
    }
    if(type==='difficulty'){
      const sh = _sheet(SHEETS.DIFF);
      sh.appendRow([
        new Date(),
        body.user_email||'',
        body.role_id||'',
        body.stage_id||'',
        body.topic||'',
        body.description||'',
        body.severity||'1',
        'open',
        (body.tags||[]).join(',')
      ]);
      return _jsonResponse({ok:true}, 200);
    }
    return _jsonResponse({ok:false, error:'Invalid type'}, 400);
  }catch(err){
    return _jsonResponse({ok:false, error:String(err)}, 500);
  }
}
