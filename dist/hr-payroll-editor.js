/* Editor mensal simplificado de Folha e Vale. */
(function(w){'use strict';
const prior=w.EngefexHRExtra;
const E=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const F=x=>typeof x==='number'?new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(x):E(x);
const colsSal=['Nome','Valor do Salário','Hora extra','INSALUBRIDADE','Vale 40%','Uniodonto','Farmácia','Faltas','Pensão','Vales','INSS','I.R','CARTÃO','TOTAL','TOTAL COM O CARTÃO'];
const colsVale=['Nome','SALÁRIO','VALE 40% DIA 20/10'];
let month=new Date().toISOString().slice(0,7),aba='sal',name='',order='az',only='todos';
const key=()=>aba==='sal'?'hrPayroll':'hrPayrollVale';
const cols=()=>aba==='sal'?colsSal:colsVale;
const rows=s=>(s[key()]||[]).filter(r=>r.period===month);
const nam=r=>r.employeeName||r.values?.A||'';
function page(s,v){
 if(v!=='hr-payroll')return prior.page(s,v);
 const all=rows(s);
 const filtered=all.filter(r=>(!name||nam(r).toLocaleLowerCase('pt-BR').includes(name.toLocaleLowerCase('pt-BR')))).sort((a,b)=>(order==='za'?-1:1)*nam(a).localeCompare(nam(b),'pt-BR'));
 const c=cols(),editable=!!w.EngefexAccess?.canWrite(v);
 const tr=filtered.map(r=>'<tr>'+c.map((_,i)=>{const k=String.fromCharCode(65+i);return '<td>'+F(k==='A'?nam(r):r.values?.[k]??'')+'</td>'}).join('')+'<td>'+E(r.status||'Rascunho')+'</td><td><button type="button" class="button secondary" data-rh-edit="'+E(r.id)+'">Editar</button> <button type="button" class="button secondary" data-rh-del="'+E(r.id)+'">Excluir</button></td></tr>').join('');
 return '<section class="page-head hr-hero"><div><h1>Folha de pagamento</h1><p>Salário dia 05 · Vale dia 20. Valores conforme planilha.</p></div></section>'+
 '<section class="panel hr-panel"><div class="form-grid"><label>Competência<input type="month" id="rhMonth" value="'+E(month)+'"></label><label>Importar Excel<input type="file" accept=".xlsx" id="payFile"></label></div><button class="button primary" id="payImport" type="button">Importar folha</button><p id="payFeedback" class="notice">Importe as duas abas para o mês selecionado.</p></section>'+
 '<section class="panel hr-panel"><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:15px"><button class="button '+(aba==='sal'?'primary':'secondary')+'" data-rh-aba="sal">Salário</button><button class="button '+(aba==='vale'?'primary':'secondary')+'" data-rh-aba="vale">Vale</button></div>'+
 '<div class="panel-head"><h2>'+E(aba==='sal'?'Salário · dia 05':'Vale · dia 20')+'</h2><button type="button" class="button primary" id="rhAdd" '+(editable?'':'disabled')+'>+ Adicionar</button></div>'+
 '<div class="form-grid"><label>Funcionário<input id="rhSearch" value="'+E(name)+'" placeholder="Pesquisar"></label><label>Situação<select id="rhStatus">'+['todos','Rascunho','Conferido','Pago'].map(t=>'<option value="'+t+'" '+(only===t?'selected':'')+'>'+E(t==='todos'?'Todos':t)+'</option>').join('')+'</select></label><label>Ordem<select id="rhSort"><option value="az" '+(order==='az'?'selected':'')+'>A–Z</option><option value="za" '+(order==='za'?'selected':'')+'>Z–A</option></select></label></div>'+
 '<p>'+filtered.length+' registros exibidos de '+all.length+'</p>'+
 '<div class="hr-table-wrap" style="overflow:auto"><table class="hr-data-table" style="min-width:'+(aba==='sal'?'1600':'720')+'px"><thead><tr>'+c.map(t=>'<th>'+E(t)+'</th>').join('')+'<th>Situação</th><th>Ações</th></tr></thead><tbody>'+ (tr||'<tr><td colspan="'+(c.length+2)+'">Nenhum lançamento</td></tr>')+'</tbody></table></div></section>'+
 '<dialog id="rhPayDialog" class="hr-editor"><h2 id="rhPayTitle">Lançamento</h2><form id="rhPayForm"><div class="hr-editor-fields" id="rhPayFields"></div><footer class="hr-editor-footer"><button type="button" class="button secondary" id="rhPayCancel">Cancelar</button><button class="button primary" type="submit">Salvar</button></footer></form></dialog>';
}
function attach(s,persist,render,notify,v){
 if(v!=='hr-payroll')return prior.attach(s,persist,render,notify,v);
 const writable=()=>!!w.EngefexAccess?.canWrite('hr-payroll');
 const save=async(state,msg)=>{const ok=await persist(state,msg);if(ok===false)throw Error('Supabase não confirmou salvamento.');render()};
 const bind=(id,cb)=>{const el=document.getElementById(id);if(el)el.onchange=()=>{cb(el.value);render()}};
 bind('rhMonth',x=>{if(/^\d{4}-\d{2}$/.test(x))month=x});
 bind('rhSearch',x=>name=x);bind('rhStatus',x=>only=x);bind('rhSort',x=>order=x);
 document.querySelectorAll('[data-rh-aba]').forEach(b=>b.onclick=()=>{aba=b.dataset.rhAba;render()});
 const dlg=document.getElementById('rhPayDialog'),form=document.getElementById('rhPayForm');
 const edit=id=>{
  if(!writable())return notify('Sem permissão para editar.');
  const r=rows(s).find(x=>x.id===id);dlg.dataset.id=id||'';
  document.getElementById('rhPayTitle').textContent=id?'Editar lançamento':'Adicionar lançamento';
  document.getElementById('rhPayFields').innerHTML=cols().map((label,i)=>{const k=String.fromCharCode(65+i),value=r?.values?.[k]??'';return '<label class="hr-edit-field"><span>'+E(label)+'</span><input name="'+k+'" type="'+(k==='A'?'text':'number')+'" '+(k==='A'?'required':'step="0.01"')+' value="'+E(value)+'"></label>'}).join('');
  dlg.showModal();
 };
 document.getElementById('rhAdd').onclick=()=>edit('');
 document.querySelectorAll('[data-rh-edit]').forEach(b=>b.onclick=()=>edit(b.dataset.rhEdit));
 document.getElementById('rhPayCancel').onclick=()=>dlg.close();
 form.onsubmit=async event=>{
  event.preventDefault();if(!writable())return notify('Sem permissão.');
  const fields=new FormData(form),id=dlg.dataset.id||crypto.randomUUID(),state=structuredClone(s),k=key();
  state[k]=state[k]||[];
  const index=state[k].findIndex(r=>r.id===id&&r.period===month),old=index<0?{}:state[k][index];
  const values={...(old.values||{})};
  cols().forEach((_,i)=>{const col=String.fromCharCode(65+i),v=String(fields.get(col)??'').trim();values[col]=col==='A'?v:v===''?'':Number(v)});
  const record={...old,id,period:month,employeeName:values.A,values,status:old.status||'Rascunho'};
  if(k==='hrPayroll'){record.monthlyHours=Number(fields.get('monthlyHours'))>0?Number(fields.get('monthlyHours')):220;record.employerCosts=Math.max(0,Number(fields.get('employerCosts'))||0)}
  if(index<0)state[k].push(record);else state[k][index]=record;
  try{await save(state,'Lançamento salvo na folha.');dlg.close()}catch(err){notify(err.message)}
 };
 document.querySelectorAll('[data-rh-del]').forEach(b=>b.onclick=async()=>{
  if(!writable())return notify('Sem permissão.');
  if(!confirm('Excluir este lançamento de '+month+'?'))return;
  const state=structuredClone(s),k=key();state[k]=(state[k]||[]).filter(r=>!(r.id===b.dataset.rhDel&&r.period===month));
  try{await save(state,'Lançamento excluído da folha.')}catch(err){notify(err.message)}
 });
 const upload=document.getElementById('payImport');
 upload.onclick=async()=>{
  if(!writable())return notify('Sem permissão.');
  const file=document.getElementById('payFile').files[0],feedback=document.getElementById('payFeedback');
  if(!file)return notify('Selecione o arquivo XLSX.');
  try{
   const parsed=await w.EngefexPayrollParse(file);
   const salaries=parsed.entries.map(e=>({id:crypto.randomUUID(),period:month,employeeName:e.name,values:e.values,status:'Rascunho'}));
   const vales=parsed.advances.map(e=>({id:crypto.randomUUID(),period:month,employeeName:e.name,values:e.values,status:'Rascunho'}));
   feedback.textContent=salaries.length+' salários e '+vales.length+' vales.';
   if(!confirm('Importar '+month+'? Os lançamentos deste mês serão substituídos nas duas abas, preservando os outros meses.'))return;
   const state=structuredClone(s);
   state.hrPayroll=(state.hrPayroll||[]).filter(r=>r.period!==month).concat(salaries);
   state.hrPayrollVale=(state.hrPayrollVale||[]).filter(r=>r.period!==month).concat(vales);
   await save(state,'Folha importada.');
  }catch(err){feedback.textContent=err.message;notify(err.message)}
 };

}
w.EngefexHRExtra={page,attach};
})(window);
