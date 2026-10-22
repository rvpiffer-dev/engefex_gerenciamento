/* Engefex: aditivos contratuais vinculados a grupos exclusivos do orçamento.
   Aditivos em elaboração não geram itens de medição nem alteram receita contratada. */
(function(root){'use strict';
const D=()=>root.Obras;
const M=()=>root.EngefexManager;
const clone=x=>JSON.parse(JSON.stringify(x));
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);
const h=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'});
const makeId=p=>p+'-'+(root.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2));
const cents=x=>{const n=Number(x);if(!Number.isFinite(n))throw Error('Informe um valor numérico válido.');return Math.round(n*100)};
const lineCents=l=>Math.round(Number(l.quantity)*Number(l.unitPrice)*100);
const value=lines=>lines.reduce((acc,l)=>acc+lineCents(l),0)/100;
const statuses=['Rascunho','Em aprovação','Aprovado','Recusado'];
function listing(s,project='all'){return (s.budgetStages||[]).filter(st=>st.amendment?.kind==='contract_addendum'&&(project==='all'||st.project===project)).sort((a,b)=>String(b.amendment.requestedAt||'').localeCompare(String(a.amendment.requestedAt||'')));}
function totals(s,project='all'){
 const rows=listing(s,project);
 const original=(s.projects||[]).filter(p=>project==='all'||p.id===project).reduce((a,p)=>a+Number(p.value||0),0);
 const approved=rows.filter(x=>x.amendment.status==='Aprovado').reduce((a,x)=>a+Number(x.amendment.amount||0),0);
 const pending=rows.filter(x=>['Rascunho','Em aprovação'].includes(x.amendment.status)).reduce((a,x)=>a+Number(x.amendment.amount||0),0);
 return {original,approved,pending,updated:original+approved,count:rows.length};
}
function blank(s,p){
 const id=makeId('AD');
 const number=String(listing(s,p).length+1).padStart(3,'0');
 return {id,project:p,amendment:{kind:'contract_addendum',number,title:'',status:'Rascunho',requestedAt:today(),approvedAt:'',justification:'',lines:[{id:makeId('L'),name:'',unit:'un',quantity:1,unitPrice:0}],amount:0}};
}
function validate(s,record,status){
 if(!statuses.includes(status)||status==='Aprovado'&&!(record.amendment?.lines?.length))throw Error('Situação ou itens inválidos.');
 if(!s.projects.some(p=>p.id===record.project))throw Error('Selecione uma obra existente.');
 const a=record.amendment||{},number=String(a.number||'').trim(),title=String(a.title||'').trim(),lines=a.lines||[];
 if(!number||number.length>30||!title||title.length>180)throw Error('Informe número e descrição do aditivo.');
 if((s.budgetStages||[]).some(x=>x.id!==record.id&&x.project===record.project&&x.amendment?.kind==='contract_addendum'&&String(x.amendment.number).trim().toLowerCase()===number.toLowerCase()))throw Error('Já existe um aditivo com este número na obra.');
 if(!Array.isArray(lines)||lines.length>150)throw Error('Limite de 150 serviços por aditivo.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(a.requestedAt||''))throw Error('Informe a data de solicitação.');
 const seen=new Set();for(const l of lines){
  if(!l.id||seen.has(l.id)||!String(l.name||'').trim()||!String(l.unit||'').trim()||!Number.isFinite(Number(l.quantity))||Number(l.quantity)<=0||!Number.isFinite(Number(l.unitPrice))||Number(l.unitPrice)<0)throw Error('Complete descrição, unidade, quantidade positiva e preço unitário dos serviços.');
  if(String(l.name).length>300||String(l.unit).length>25)throw Error('Descrição ou unidade muito longa.');
  seen.add(l.id);
 }
 const total=value(lines);
 if(status==='Aprovado'&&total<=0)throw Error('Um aditivo aprovado deve ter valor positivo.');
 return total;
}
function commit(s,record,status){
 const next=clone(s),prior=(next.budgetStages||[]).find(x=>x.id===record.id),am=clone(record.amendment);
 if(prior?.amendment?.status==='Aprovado'||prior?.amendment?.status==='Recusado')throw Error('Aditivo finalizado não pode ser alterado. Registre novo aditivo para uma revisão.');
 if(prior&&prior.project!==record.project)throw Error('Não é permitido mudar a obra de um aditivo existente.');
 const total=validate(next,record,status);
 const approved=status==='Aprovado';
 am.number=String(am.number).trim();am.title=String(am.title).trim();
 am.status=status;am.amount=total;am.kind='contract_addendum';
 am.lines=am.lines.map(l=>({...l,name:String(l.name).trim(),unit:String(l.unit).trim(),quantity:Number(l.quantity),unitPrice:Number(l.unitPrice)}));
 am.approvedAt=approved?today():'';
 const code='AD-'+am.number;
 let stage=prior?{...prior}:{...M().defaults('budgetStages',record.project),id:record.id,project:record.project};
 stage.name='ADITIVO '+am.number+' · '+am.title;stage.code=code;
 stage.source='Aditivo contratual';stage.parent='';stage.amendment=am;
 stage.sale=approved?total:0;
 next.budgetStages=(next.budgetStages||[]).filter(x=>x.id!==stage.id).concat(stage);
 if(approved){
  next.budgetItems=next.budgetItems||[];
  am.lines.forEach((l,i)=>{
   const item={...M().defaults('budgetItems',record.project),
    id:stage.id+'-item-'+l.id,project:record.project,stage:stage.id,
    code:code+'.'+String(i+1).padStart(2,'0'),name:l.name,unit:l.unit,
    quantity:l.quantity,unitPrice:l.unitPrice,sale:lineCents(l)/100,
    executed:0,amendmentStageId:stage.id,source:'Aditivo contratual aprovado'};
   D().validateBudgetItem(next,item);
   next.budgetItems.push(item);
  });
 }
 next.history.unshift({id:makeId('H'),time:new Date().toISOString(),kind:'budgetStages',record:stage.id,
  action:approved?'Aditivo aprovado':status==='Recusado'?'Aditivo recusado':prior?'Aditivo atualizado':'Aditivo cadastrado',
  before:prior||null,after:clone(stage)});
 D().onlineValid(next);
 return next;
}
function statusClass(status){return status==='Aprovado'?'approved':status==='Recusado'?'rejected':status==='Em aprovação'?'pending':'draft'}
function render(s,project){
 const rows=listing(s,project),t=totals(s,project),all=project==='all';
 const kpi=(l,v,extra)=>'<div class="additive-kpi"><small>'+h(l)+'</small><strong>'+money(v)+'</strong><span>'+h(extra)+'</span></div>';
 return '<section class="additive-shell"><div class="additive-hero"><div><small>GESTÃO CONTRATUAL · ORÇAMENTO</small><h2>Aditivos da obra</h2><p>Organize solicitações, aprovações e serviços adicionais sem modificar o valor do contrato original.</p></div><button class="button primary" type="button" data-action="additive-new">+ Novo aditivo</button></div>'+
 '<div class="additive-kpis">'+kpi('Contrato original',t.original,'Valor cadastrado da obra')+kpi('Aditivos aprovados',t.approved,'Adicionais ao contrato')+kpi('Contrato atualizado',t.updated,'Original + aprovados')+kpi('Aditivos em análise',t.pending,'Não somam à receita')+'</div>'+
 '<div class="panel"><div class="panel-head"><div><h2>Registro de aditivos</h2><small>'+rows.length+' documento(s) · '+(all?'Todas as obras':'Obra selecionada')+'</small></div></div>'+
 (rows.length?'<div class="additive-list">'+rows.map(st=>{const a=st.amendment;return '<article class="additive-card"><div class="additive-card-head"><div><strong>'+h('AD '+a.number+' · '+a.title)+'</strong><small>'+h(s.projects.find(p=>p.id===st.project)?.name||'')+' · Solicitado em '+h(a.requestedAt)+'</small></div><span class="additive-pill '+statusClass(a.status)+'">'+h(a.status)+'</span></div><div class="additive-card-foot"><strong>'+money(a.amount)+'</strong><span>'+a.lines.length+' serviço(s)</span><button class="button secondary" data-action="additive-open:'+h(st.id)+'">'+(a.status==='Aprovado'||a.status==='Recusado'?'Consultar':'Abrir / editar')+'</button></div></article>'}).join('')+'</div>':'<div class="empty">Nenhum aditivo cadastrado. Use “+ Novo aditivo” para registrar uma solicitação.</div>')+
 '</div><p class="section-note">Somente aditivos aprovados aumentam o valor contratual para o dashboard de resultado. Na aprovação, os serviços são incorporados ao orçamento como grupo separado, disponíveis para medição. Aditivos em análise não geram itens a medir nem atualizam o contrato.</p></section>';
}
let bridge=null,form=null,readOnly=false,pending=false;
const $=s=>root.document.querySelector(s),$$=s=>[...root.document.querySelectorAll(s)];
function getRecord(){
 if(!form)return null;
 const a=form.amendment;
 const input=(name)=>String($('[data-ad-field="'+name+'"]')?.value||'');
 a.number=input('number').trim();a.title=input('title').trim();a.requestedAt=input('requestedAt');a.justification=input('justification');
 form.project=input('project');
 a.lines=$$('[data-additive-line]').map(tr=>({id:tr.dataset.additiveLine,
  name:String(tr.querySelector('[data-field="name"]')?.value||'').trim(),
  unit:String(tr.querySelector('[data-field="unit"]')?.value||'').trim(),
  quantity:Number(tr.querySelector('[data-field="quantity"]')?.value||0),
  unitPrice:Number(tr.querySelector('[data-field="unitPrice"]')?.value||0)}));
 return form;
}
function importServices(result){
 if(result.errors?.length)throw Error('Planilha inválida: '+result.errors.slice(0,3).join(' | '));
 const lines=(result.services||[]).map(l=>({id:makeId('L'),name:(l.code?l.code+' · ':'')+l.name,unit:String(l.unit||'un'),quantity:Number(l.quantity),unitPrice:Math.round(Number(l.total)/Number(l.quantity)*1000000)/1000000}));
 if(!lines.length||lines.length>150)throw Error('O aditivo deve ter entre 1 e 150 serviços.');
 if(lines.some(l=>!Number.isFinite(l.unitPrice)||l.unitPrice<0||!Number.isFinite(l.quantity)||l.quantity<=0))throw Error('Quantidade ou preço inválido na planilha.');
 return lines;
}
async function importFile(file){
 if(pending||readOnly||!file)return;
 try{
  if(!/\.xlsx$/i.test(file.name))throw Error('Selecione uma planilha .xlsx.');
  const wb=await root.BudgetImport.readWorkbook(await file.arrayBuffer());
  const candidates=wb.map(s=>root.BudgetImport.analyze(s));
  const parsed=candidates.sort((a,b)=>b.services.length-a.services.length)[0];
  const lines=importServices(parsed);
  const total=lines.reduce((sum,l)=>sum+l.quantity*l.unitPrice,0);
  const warning=parsed.warnings.length?'\n\nAtenção: '+parsed.warnings.slice(0,4).join(' | '):'';
  if(!root.confirm('Importar '+lines.length+' serviços da aba '+parsed.sheet+' ('+money(total)+')? Os serviços atuais deste aditivo serão substituídos. Confira os valores antes de salvar.'+warning))return;
  getRecord();form.amendment.lines=lines;
  if(!form.amendment.title)form.amendment.title=parsed.metadata?.OBRA||file.name.replace(/\.xlsx$/i,'');
  draw();bridge.toast(lines.length+' serviços importados. Confira e salve o rascunho.');
 }catch(e){const el=$('#additiveError');if(el)el.textContent=e.message;bridge.toast(e.message)}
}
function draw(){
 if(!form)return;
 const a=form.amendment,disabled=readOnly?'disabled':'';
 const field=(key,label,type='text',other='')=>'<label>'+h(label)+'<input '+other+' type="'+type+'" data-ad-field="'+key+'" value="'+h(key==='project'?form.project:a[key]||'')+'" '+disabled+'></label>';
 $('#readerTitle').textContent='Aditivo contratual · '+(a.number||'Novo');
 const projects=bridge.getState().projects||[];
 const choices=projects.map(p=>'<option value="'+h(p.id)+'" '+(p.id===form.project?'selected':'')+'>'+h([p.code,p.name].filter(Boolean).join(' · '))+'</option>').join('');
 $('#readerContent').innerHTML='<div class="additive-editor"><div class="additive-form">'+
 '<label>Obra<select data-ad-field="project" '+(readOnly||!!bridge.getState().budgetStages.find(x=>x.id===form.id)?'disabled':'')+'>'+choices+'</select></label>'+
 field('number','Número do aditivo')+field('title','Descrição do aditivo')+field('requestedAt','Data de solicitação','date')+
 '</div><label class="additive-notes">Justificativa / escopo<textarea data-ad-field="justification" '+disabled+'>'+h(a.justification||'')+'</textarea></label>'+
 '<div class="additive-line-heading"><div><strong>Serviços adicionais</strong><small>Valores unitários, quantidades e totais</small></div>'+(!readOnly?'<div class="actions"><label class="button secondary additive-import-label">Importar Excel<input id="additiveFile" type="file" accept=".xlsx" hidden></label><button type="button" class="button secondary" data-action="additive-add-line">+ Linha</button></div>':'')+'</div>'+
 '<div class="additive-grid"><table><thead><tr><th>Descrição</th><th>Un.</th><th>Qtd.</th><th>Preço unitário (R$)</th><th>Total (R$)</th><th></th></tr></thead><tbody>'+a.lines.map((l,i)=>'<tr data-additive-line="'+h(l.id)+'"><td><input aria-label="Descrição linha '+(i+1)+'" data-field="name" value="'+h(l.name)+'" '+disabled+'></td><td><input aria-label="Unidade linha '+(i+1)+'" data-field="unit" value="'+h(l.unit)+'" '+disabled+'></td><td><input aria-label="Quantidade linha '+(i+1)+'" type="number" min="0.0001" step="any" data-field="quantity" value="'+h(l.quantity)+'" '+disabled+'></td><td><input aria-label="Preço unitário linha '+(i+1)+'" type="number" min="0" step="0.01" data-field="unitPrice" value="'+h(l.unitPrice)+'" '+disabled+'></td><td class="additive-line-total">'+money(Number(l.quantity||0)*Number(l.unitPrice||0))+'</td><td>'+(!readOnly?'<button type="button" class="text-btn red-text" data-action="additive-remove-line:'+i+'">Remover</button>':'')+'</td></tr>').join('')+'</tbody></table></div>'+
 '<div class="additive-bottom"><div><small>VALOR TOTAL DO ADITIVO</small><strong id="additiveTotal">'+money(a.amount)+'</strong></div><div class="actions">'+(readOnly?'<span class="notice neutral">Aditivo finalizado. Os dados ficam preservados para consulta.</span>':'<button type="button" class="button secondary" data-action="additive-save">Salvar rascunho</button><button type="button" class="button secondary" data-action="additive-submit">Em aprovação</button><button type="button" class="button primary" data-action="additive-approve">Aprovar aditivo</button><button type="button" class="button secondary" data-action="additive-reject">Recusar</button>')+'</div></div>'+
 '<div id="additiveError" class="form-error" role="alert"></div></div>';
 const fileInput=$('#additiveFile');if(fileInput)fileInput.addEventListener('change',e=>importFile(e.target.files?.[0]));
 for(const el of $$('[data-additive-line] input'))el.addEventListener('input',()=>{
  const rows=$$('[data-additive-line]');let total=0;for(const row of rows){const n=Number(row.querySelector('[data-field="quantity"]').value||0)*Number(row.querySelector('[data-field="unitPrice"]').value||0);row.querySelector('.additive-line-total').textContent=money(n);total+=n}$('#additiveTotal').textContent=money(total);
 });
}
function open(id){
 const s=bridge.getState();if(!s.projects.length)throw Error('Cadastre uma obra antes de criar aditivos.');
 const p=bridge.getProject(),chosen=p==='all'?(s.projects[0]?.id||''):p;
 form=id?clone(listing(s).find(x=>x.id===id)):blank(s,chosen);
 if(!form)throw Error('Aditivo não encontrado.');
 readOnly=['Aprovado','Recusado'].includes(form.amendment.status);
 draw();$('#reader').showModal();
}
async function save(status){
 if(pending||readOnly)return;
 const data=getRecord();if(!data)return;
 if(status==='Recusado'&&!root.confirm('Recusar este aditivo? Ele ficará bloqueado para edição.'))return;
 if(status==='Aprovado'&&!root.confirm('Aprovar este aditivo? O contrato atualizado aumentará e os serviços serão incorporados ao orçamento para medição. A aprovação será definitiva.'))return;
 pending=true;for(const el of $$('.additive-editor button'))el.disabled=true;
 try{const next=commit(bridge.getState(),data,status);const saved=await bridge.save(next,'Aditivo '+(status==='Aprovado'?'aprovado':status==='Em aprovação'?'enviado para aprovação':'salvo')+'.');if(saved===false)throw Error('Alteração não confirmada pelo Supabase.');$('#reader').close();form=null;bridge.render();}
 catch(e){const error=$('#additiveError');if(error)error.textContent=e.message;bridge.toast(e.message)}
 finally{pending=false;for(const el of $$('.additive-editor button'))el.disabled=false}
}
function handle(action){
 if(!action?.startsWith('additive-'))return false;
 if(pending)return true;
 try{
  if(action==='additive-new')open();
  else if(action.startsWith('additive-open:'))open(action.slice(14));
  else if(action==='additive-add-line'){getRecord();form.amendment.lines.push({id:makeId('L'),name:'',unit:'un',quantity:1,unitPrice:0});draw();}
  else if(action.startsWith('additive-remove-line:')){getRecord();form.amendment.lines.splice(Number(action.slice('additive-remove-line:'.length)),1);draw();}
  else if(action==='additive-save')save('Rascunho');
  else if(action==='additive-submit')save('Em aprovação');
  else if(action==='additive-approve')save('Aprovado');
  else if(action==='additive-reject')save('Recusado');
 }catch(e){bridge.toast(e.message)}
 return true;
}
const api={listing,totals,blank,validate,commit,render,handle,importServices,init:x=>{bridge=x},busy:()=>pending};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.EngefexAdditives=api;
})(typeof window==='undefined'?globalThis:window);
