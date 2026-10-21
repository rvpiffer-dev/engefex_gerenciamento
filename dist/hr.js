/* RH Engefex — registros sincronizados pelo estado compartilhado do Gerenciador. */
(function(root){'use strict';
const h=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const types=['ASO','NR-35','PTA','MUNK','SOLDA','EPI / NR-06','NR-18','NR-12','USO DE IMAGEM'];
const days=[30,15,7,0];
let category='todos',query='',employment='ativos',rhTab='employees';
let pendingFilters={name:'',type:'todos',phase:'todos'};
let documentFilters={name:'',type:'todos',phase:'todos'};
const filterOptions=(values,current)=>values.map(v=>'<option value="'+h(v)+'" '+(v===current?'selected':'')+'>'+h(v==='todos'?'Todos':v)+'</option>').join('');
const filterRow=(prefix,filters)=>'<div class="form-grid" style="margin-bottom:14px">'+
'<label>Funcionário<input id="'+prefix+'Name" placeholder="Buscar pelo nome" value="'+h(filters.name)+'"></label>'+
'<label>Documento<select id="'+prefix+'Type">'+filterOptions(['todos',...types],filters.type)+'</select></label>'+
'<label>Situação<select id="'+prefix+'Phase">'+filterOptions(['todos','Vencido','A vencer','Em dia','Não informado'],filters.phase)+'</select></label>'+
'</div>';
const isActive=e=>e.active!==false&&e.employmentStatus!=='inativo';
const startOfDay=()=>{let d=new Date();return new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime()};
function offset(date){if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return null;const [y,m,d]=date.split('-').map(Number);return Math.round((new Date(y,m-1,d).getTime()-startOfDay())/86400000)}
function phase(date){let diff=offset(date);return diff===null?'Não informado':diff<0?'Vencido':diff<=30?'A vencer':'Em dia'}
const badge=(date)=>{const p=phase(date);return '<span class="tag">'+h(p)+(offset(date)!==null?' · '+offset(date)+' dias':'')+'</span>'};
const model=s=>({employees:s.hrEmployees||[],docs:s.hrDocuments||[],settings:s.hrSettings||{recipients:[],days}});
function issues(s){const m=model(s);return m.docs.filter(d=>d.due&&offset(d.due)<=30&&m.employees.some(e=>e.id===d.employeeId&&isActive(e))).map(d=>({doc:d,employee:m.employees.find(e=>e.id===d.employeeId),remaining:offset(d.due)})).sort((a,b)=>a.remaining-b.remaining)}
function page(s){const m=model(s),a=m.employees.filter(e=>(employment==='ativos'?isActive(e):!isActive(e))&&(category==='todos'||e.category===category)&&(!query||e.name.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))));let ds=m.docs.filter(d=>{const employee=a.find(e=>e.id===d.employeeId);return employee&&(!documentFilters.name||employee.name.toLocaleLowerCase('pt-BR').includes(documentFilters.name.toLocaleLowerCase('pt-BR')))&&(documentFilters.type==='todos'||d.type===documentFilters.type)&&(documentFilters.phase==='todos'||phase(d.due)===documentFilters.phase)});const pending=employment==='ativos'?issues(s).filter(x=>(category==='todos'||x.employee.category===category)&&(!pendingFilters.name||x.employee.name.toLocaleLowerCase('pt-BR').includes(pendingFilters.name.toLocaleLowerCase('pt-BR')))&&(pendingFilters.type==='todos'||x.doc.type===pendingFilters.type)&&(pendingFilters.phase==='todos'||phase(x.doc.due)===pendingFilters.phase)):[];
return '<section class="page-head hr-hero"><div><p class="hr-eyebrow">ENGEFEX · GESTÃO DE PESSOAS</p><h1>Recursos Humanos</h1><p>Equipe, certificados e prazos em um único lugar.</p></div></section>'+
'<nav aria-label="Abas do RH" class="hr-tabs">'+[['employees','Funcionários',m.employees.filter(e=>employment==='ativos'?isActive(e):!isActive(e)).length],['pending','Pendências RH',pending.length],['documents','Documentos',ds.length]].map(([key,label,count])=>'<button type="button" data-hr-tab="'+key+'" aria-selected="'+(rhTab===key)+'" class="hr-tab-button '+(rhTab===key?'selected':'')+'">'+label+' ('+count+')</button>').join('')+'</nav>'+
'<div '+(rhTab==='employees'?'':'hidden')+'>'+
'<section class="panel hr-panel"><div class="panel-head"><h2>Equipe e cadastros</h2></div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px"><button type="button" class="button '+(employment==='ativos'?'primary':'secondary')+'" data-hr-employment="ativos">Ativos ('+m.employees.filter(isActive).length+')</button><button type="button" class="button '+(employment==='inativos'?'primary':'secondary')+'" data-hr-employment="inativos">Inativos ('+m.employees.filter(e=>!isActive(e)).length+')</button></div><div class="form-grid">'+
'<label>Categoria<select id="hrCategory"><option value="todos">Todos</option><option value="pedreiros" '+(category==='pedreiros'?'selected':'')+'>Pedreiros</option><option value="outros" '+(category==='outros'?'selected':'')+'>Demais funcionários</option></select></label>'+

'<label>Buscar funcionário<input id="hrQuery" value="'+h(query)+'" placeholder="Nome"></label></div>'+
'<p><button class="button primary" id="hrNew">+ Funcionário</button> <button class="button secondary" id="hrExport">Exportar JSON</button> <label class="button secondary" style="cursor:pointer">Importar JSON<input type="file" id="hrImport" accept=".json,application/json" hidden></label></p></section>'+
'<section class="panel hr-panel"><div class="panel-head"><h2>Funcionários '+(employment==='ativos'?'ativos':'inativos')+' ('+a.length+')</h2></div><div style="overflow:auto"><table><thead><tr><th>Nome</th><th>Categoria</th><th>Situação</th><th>Ação</th></tr></thead><tbody>'+a.map(e=>'<tr><td>'+h(e.name)+'</td><td>'+h(e.category)+'</td><td>'+(isActive(e)?'Ativo':'Inativo')+'</td><td><button type="button" class="button secondary" data-hr-person="'+h(e.id)+'">Editar</button> <button type="button" class="button secondary" data-hr-toggle="'+h(e.id)+'">'+(isActive(e)?'Inativar':'Reativar')+'</button></td></tr>').join('')+'</tbody></table></div></section></div>'+ 
'<div '+(rhTab==='pending'?'':'hidden')+'><section class="panel"><div class="panel-head"><h2>Pendências RH ('+pending.length+')</h2></div>'+filterRow('hrPending',pendingFilters)+
(pending.length?'<div style="overflow:auto"><table><thead><tr><th>Funcionário</th><th>Categoria</th><th>Documento</th><th>Vencimento</th><th>Situação</th></tr></thead><tbody>'+
pending.map(x=>'<tr><td>'+h(x.employee.name)+'</td><td>'+h(x.employee.category)+'</td><td>'+h(x.doc.type)+'</td><td>'+h(x.doc.due)+'</td><td>'+badge(x.doc.due)+'</td></tr>').join('')+'</tbody></table></div>':'<p>Nenhuma pendência dentro de 30 dias.</p>')+'</section></div>'+
'<div '+(rhTab==='documents'?'':'hidden')+'><section class="panel"><div class="panel-head"><h2>Documentos ('+ds.length+')</h2></div>'+filterRow('hrDocs',documentFilters)+'<div style="overflow:auto"><table><thead><tr><th>Funcionário</th><th>Documento</th><th>Emissão</th><th>Vencimento</th><th>Situação</th><th></th></tr></thead><tbody>'+
ds.map(d=>'<tr><td>'+h(m.employees.find(e=>e.id===d.employeeId)?.name||'')+'</td><td>'+h(d.type)+'</td><td>'+h(d.issued||'—')+'</td><td>'+h(d.due||'—')+'</td><td>'+badge(d.due)+'</td><td><button class="button secondary" data-hr-edit="'+h(d.id)+'">Editar</button></td></tr>').join('')+'</tbody></table></div></section>'+
'<section class="panel hr-panel"><div class="panel-head"><h2>Cadastro de documentos</h2></div><form id="hrDocForm" class="form-grid"><label>Funcionário<select name="employeeId" required>'+m.employees.filter(isActive).map(e=>'<option value="'+h(e.id)+'">'+h(e.name)+'</option>').join('')+'</select></label><label>Tipo<select name="type">'+types.map(t=>'<option>'+h(t)+'</option>').join('')+'</select></label><label>Emissão<input type="date" name="issued"></label><label>Validade em meses<input name="months" type="number" min="1" max="120" placeholder="Opcional"></label><label>Vencimento<input type="date" name="due" required></label><button class="button primary" type="submit">Salvar documento</button></form></section>'+
'</div>'+ 
'<section class="panel hr-panel"><div class="panel-head"><h2>Responsáveis por alertas</h2></div><p>Notificações internas: 30, 15 e 7 dias antes e no vencimento. E-mails desativados. Para receber alertas é necessário informar o e-mail do usuário cadastrado, respeitando as permissões do módulo.</p><form id="hrRecipientForm"><label>E-mails dos destinatários (separados por vírgula)<input name="recipients" type="text" value="'+h((m.settings.recipients||[]).join(', '))+'" placeholder="rh@empresa.com"></label><button class="button primary" type="submit">Salvar destinatários</button></form></section>';
}
function attach(s,persist,render,notify){
 document.querySelectorAll('[data-hr-tab]').forEach(b=>b.onclick=()=>{rhTab=b.dataset.hrTab;render()});
 document.querySelectorAll('[data-hr-employment]').forEach(b=>b.onclick=()=>{employment=b.dataset.hrEmployment;render()});
 document.querySelectorAll('[data-hr-toggle]').forEach(b=>b.onclick=async()=>{if(!root.EngefexAccess?.canWrite('hr'))return notify('Sem permissão para editar RH.');const current=(s.hrEmployees||[]).find(e=>e.id===b.dataset.hrToggle);if(!current)return;const activate=!isActive(current);if(!confirm(activate?'Reativar '+current.name+'?':'Inativar '+current.name+'? O histórico será preservado e os alertas deixarão de ser exibidos.'))return;const n=structuredClone(s);const e=n.hrEmployees.find(x=>x.id===current.id);e.active=activate;e.employmentStatus=activate?'ativo':'inativo';e.employmentChangedAt=new Date().toISOString();await persist(n,activate?'Funcionário reativado.':'Funcionário inativado.');render()});
 const change=()=>{category=document.getElementById('hrCategory')?.value||'todos';query=document.getElementById('hrQuery')?.value||'';render()};
 ['hrCategory'].forEach(id=>{let e=document.getElementById(id);if(e)e.onchange=change});
 const q=document.getElementById('hrQuery');if(q)q.onchange=change;
 [['hrPending',pendingFilters],['hrDocs',documentFilters]].forEach(([prefix,filters])=>{const update=()=>{filters.name=document.getElementById(prefix+'Name')?.value||'';filters.type=document.getElementById(prefix+'Type')?.value||'todos';filters.phase=document.getElementById(prefix+'Phase')?.value||'todos';render()};['Type','Phase'].forEach(key=>{const el=document.getElementById(prefix+key);if(el)el.onchange=update});const name=document.getElementById(prefix+'Name');if(name)name.onchange=update});

 const months=t=>['NR-18','EPI / NR-06'].includes(t)?24:12;
 const calcDue=(date,n)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return '';const [y,m,d]=date.split('-').map(Number),t=new Date(y,m-1+Number(n),1,12);return [t.getFullYear(),String(t.getMonth()+1).padStart(2,'0'),String(Math.min(d,new Date(t.getFullYear(),t.getMonth()+1,0).getDate())).padStart(2,'0')].join('-')};
 const choice=(value,label,selected)=>'<option value="'+h(value)+'" '+(value===selected?'selected':'')+'>'+h(label)+'</option>';
 const field=(label,control,note='')=>'<label class="hr-edit-field"><span>'+label+'</span>'+control+(note?'<small>'+note+'</small>':'')+'</label>';
 document.getElementById('hrEditor')?.remove();
 const editModal=document.createElement('dialog');editModal.className='hr-editor';editModal.id='hrEditor';
 editModal.innerHTML='<header class="hr-editor-header"><div><small>ENGEFEX / RECURSOS HUMANOS</small><h2 id="hrEditorTitle">Editar</h2><p id="hrEditorHint">Preencha as informações.</p></div><button type="button" class="hr-editor-close" id="hrEditorClose" aria-label="Fechar">×</button></header><form id="hrEditorForm"><div class="hr-editor-fields" id="hrEditorFields"></div><footer class="hr-editor-footer"><button class="button secondary" type="button" id="hrEditorCancel">Cancelar</button><button class="button primary" type="submit" id="hrEditorSave">Salvar alterações</button></footer></form>';
 document.body.appendChild(editModal);
 let editorMode='',editorId='';
 const closeEditor=()=>{editModal.close();editModal.remove()};
 document.getElementById('hrEditorClose').onclick=closeEditor;document.getElementById('hrEditorCancel').onclick=closeEditor;
 const launch=(kind,id='')=>{
  if(!root.EngefexAccess?.canWrite('hr'))return notify('Sem permissão para editar RH.');
  editorMode=kind;editorId=id;
  const docKind=kind==='document'||kind==='newDocument',item=docKind?(s.hrDocuments||[]).find(x=>x.id===id):(s.hrEmployees||[]).find(x=>x.id===id);
  document.getElementById('hrEditorTitle').textContent=({document:'Editar documento',newDocument:'Novo documento',employee:'Editar funcionário',newEmployee:'Novo funcionário'})[kind];
  document.getElementById('hrEditorHint').textContent=docKind?'A validade é calculada a partir da realização.':'Gerencie o cadastro sem perder o histórico.';
  const fields=document.getElementById('hrEditorFields');
  if(docKind){
   const currentEmp=item?.employeeId||(s.hrEmployees||[]).find(isActive)?.id||'',type=item?.type||'ASO';
   fields.innerHTML=field('Funcionário','<select name="employeeId" required>'+((s.hrEmployees||[]).filter(e=>isActive(e)||e.id===currentEmp).map(e=>choice(e.id,e.name,currentEmp)).join(''))+'</select>')+
   field('Documento','<select name="type" id="hrType">'+types.map(t=>choice(t,t,type)).join('')+'</select>')+
   field('Data de realização','<input type="date" name="issued" id="hrIssued" value="'+h(item?.issued||'')+'" required>')+
   field('Validade em meses','<input type="number" name="months" id="hrMonths" min="1" max="120" value="'+months(type)+'" required>','12 meses; NR-06 e NR-18: 24 meses.')+
   field('Data de vencimento','<input type="date" name="due" id="hrDue" value="'+h(item?.due||'')+'" required>','Calculada automaticamente; você pode corrigir manualmente.');
   const issued=document.getElementById('hrIssued'),duration=document.getElementById('hrMonths'),due=document.getElementById('hrDue'),typeEl=document.getElementById('hrType');
   const refresh=()=>{if(issued.value)due.value=calcDue(issued.value,duration.value)};
   typeEl.onchange=()=>{duration.value=months(typeEl.value);refresh()};issued.onchange=refresh;duration.oninput=refresh;
  }else{
   fields.innerHTML=field('Nome completo','<input name="name" required maxlength="150" value="'+h(item?.name||'')+'" placeholder="Nome do colaborador">')+
   field('Categoria','<select name="category">'+choice('outros','Demais funcionários',item?.category||'outros')+choice('pedreiros','Pedreiros',item?.category||'outros')+'</select>')+
   (kind==='employee'?field('Situação','<select name="active">'+choice('true','Ativo',isActive(item)?'true':'false')+choice('false','Inativo',isActive(item)?'true':'false')+'</select>'):'');
  }
  document.getElementById('hrEditorSave').textContent=kind.startsWith('new')?'Cadastrar':'Salvar alterações';editModal.showModal();
 };
 document.querySelectorAll('[data-hr-edit]').forEach(b=>b.onclick=()=>launch('document',b.dataset.hrEdit));
 document.querySelectorAll('[data-hr-person]').forEach(b=>b.onclick=()=>launch('employee',b.dataset.hrPerson));
 const newBtn=document.getElementById('hrNew');if(newBtn)newBtn.onclick=()=>launch('newEmployee');
 const oldDoc=document.getElementById('hrDocForm');if(oldDoc){oldDoc.remove();const card=document.createElement('div');card.className='hr-new-document';card.innerHTML='<p>Cadastre ou renove um exame com vencimento calculado automaticamente.</p><button class="button primary" type="button" id="hrNewDocument">+ Novo documento</button>';document.querySelector('h2')?.closest('section');const docsTab=document.querySelector('[data-hr-tab="documents"]');const host=Array.from(document.querySelectorAll('.panel')).find(p=>p.querySelector('h2')?.textContent==='Cadastro de documentos');if(host)host.appendChild(card);document.getElementById('hrNewDocument').onclick=()=>launch('newDocument')}
 document.getElementById('hrEditorForm').onsubmit=async ev=>{
  ev.preventDefault();const data=new FormData(ev.currentTarget),next=structuredClone(s);
  if(editorMode==='document'||editorMode==='newDocument'){
   const values={employeeId:String(data.get('employeeId')),type:String(data.get('type')),issued:String(data.get('issued')),due:String(data.get('due'))};
   if(editorMode==='document'){const target=next.hrDocuments.find(x=>x.id===editorId);if(!target)return notify('Documento não encontrado.');target.history=[...(target.history||[]),{issued:target.issued,due:target.due,recordedAt:new Date().toISOString()}];Object.assign(target,values)}
   else next.hrDocuments.push({id:crypto.randomUUID(),...values,history:[]});
  }else{
   const name=String(data.get('name')||'').trim();if(!name)return notify('Informe o nome.');
   const category=String(data.get('category'));
   if(editorMode==='employee'){const target=next.hrEmployees.find(x=>x.id===editorId);if(!target)return notify('Funcionário não encontrado.');const active=data.get('active')==='true';if(isActive(target)!==active)target.employmentChangedAt=new Date().toISOString();Object.assign(target,{name,category,active,employmentStatus:active?'ativo':'inativo'})}
   else next.hrEmployees.push({id:crypto.randomUUID(),name,category,active:true,employmentStatus:'ativo'});
  }
  const save=document.getElementById('hrEditorSave');save.disabled=true;save.textContent='Salvando…';
  try{await persist(next,'Dados de RH salvos.');closeEditor();render()}catch(err){notify(err.message||'Erro ao salvar.');save.disabled=false;save.textContent='Salvar alterações'}
 };
 const rec=document.getElementById('hrRecipientForm');if(rec)rec.onsubmit=async ev=>{ev.preventDefault();if(!root.EngefexAccess?.isAdmin)return notify('Somente administradores alteram destinatários.');let n=structuredClone(s);n.hrSettings={days,recipients:String(new FormData(rec).get('recipients')||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean),email:false};await persist(n,'Destinatários salvos.');render()};
 const exp=document.getElementById('hrExport');if(exp)exp.onclick=()=>{const data=JSON.stringify(model(s),null,2);const url=URL.createObjectURL(new Blob([data],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='engefex-rh.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
 const imp=document.getElementById('hrImport');if(imp)imp.onchange=async()=>{if(!root.EngefexAccess?.canWrite('hr'))return notify('Sem permissão.');try{const v=JSON.parse(await imp.files[0].text());if(!Array.isArray(v.employees)||!Array.isArray(v.docs))throw Error('Arquivo incompatível');const n=structuredClone(s);n.hrEmployees=[...(n.hrEmployees||[]),...v.employees.filter(e=>!n.hrEmployees?.some(x=>x.id===e.id)).map(e=>({...e,active:e.active!==false&&e.employmentStatus!=='inativo',employmentStatus:e.active===false||e.employmentStatus==='inativo'?'inativo':'ativo'}))];n.hrDocuments=[...(n.hrDocuments||[]),...v.docs.filter(d=>!n.hrDocuments?.some(x=>x.id===d.id))];await persist(n,'Dados de RH importados.');render()}catch(e){notify(e.message)}};
}
function myAlerts(s,email){let m=model(s);if(!(m.settings.recipients||[]).includes(String(email||'').toLowerCase()))return [];if(!root.EngefexAccess?.canRead('hr'))return [];return issues(s).filter(x=>days.includes(x.remaining)).map(x=>({id:'rh-'+x.doc.id+'-'+x.doc.due+'-'+x.remaining,title:'RH: '+x.employee.name+' — '+x.doc.type,detail:x.remaining===0?'Vence hoje':'Vence em '+x.remaining+' dias',href:'#hr'}))}
function myPending(s,email){let m=model(s);if(!(m.settings.recipients||[]).includes(String(email||'').toLowerCase())||!root.EngefexAccess?.canRead('hr'))return [];return issues(s).map(x=>({id:'rh-'+x.doc.id,title:'RH: '+x.employee.name+' — '+x.doc.type,detail:x.remaining<0?'Vencido há '+(-x.remaining)+' dias':x.remaining===0?'Vence hoje':'Vence em '+x.remaining+' dias'}))}
root.EngefexRH={page,attach,issues,myAlerts,myPending};
})(window);
