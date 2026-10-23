/* Engefex — apontamento diário de funcionários por obra, com custo/hora da folha. */
(function(root){'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
 const format=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
 const num=v=>typeof v==='number'?v:Number(String(v??'').replace(',','.'))||0;
 const round=v=>Math.round((v+Number.EPSILON)*100)/100;
 const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\([^)]*\)/g,'').replace(/\s+/g,' ').trim().toLocaleLowerCase('pt-BR');
 const dateBR=v=>v&&/^\d{4}-\d{2}-\d{2}$/.test(v)?v.slice(8,10)+'/'+v.slice(5,7)+'/'+v.slice(0,4):v;
 const moveDate=(iso,delta)=>{const [y,m,d]=iso.split('-').map(Number),v=new Date(y,m-1,d+delta);return v.getFullYear()+'-'+String(v.getMonth()+1).padStart(2,'0')+'-'+String(v.getDate()).padStart(2,'0')};
 let pickedProject='',seenGlobalProject=null,day='',draftKey='',draft=new Map(),busy=false,keyword='';
 // A lista operacional segue a folha de pagamento, NÃO o cadastro de RH.
 // Uma pessoa aparece uma vez, usando a competência mais recente até a data escolhida.
 function employees(s){
  const payroll=Array.isArray(s.crewHourlyRates)?s.crewHourlyRates:(s.hrPayroll||[]);
  const nameOf=r=>String(r.employeeName||r.values?.A||'').trim();
  const valid=payroll.filter(r=>/^\d{4}-\d{2}$/.test(String(r.period||''))&&nameOf(r)&&!/^totais?\s*:?\s*$/i.test(nameOf(r)));
  const dated=valid.filter(r=>String(r.period)<=day.slice(0,7));
  const latest=dated.reduce((a,r)=>String(r.period)>a?String(r.period):a,'');
  if(!latest)return [];
  const idsByName=new Map();
  for(const r of valid)if(r.employeeId&&!idsByName.has(norm(nameOf(r))))idsByName.set(norm(nameOf(r)),String(r.employeeId));
  const people=new Map();
  for(const r of dated)if(r.period===latest){
   const name=nameOf(r),key=norm(name);
   if(!people.has(key))people.set(key,{
    id:idsByName.get(key)||'payroll:'+key,
    name,
    role:''
   });
  }
  return [...people.values()].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 }
 function payrollCandidates(s,employee,date){
  const arr=Array.isArray(s.crewHourlyRates)?s.crewHourlyRates:s.hrPayroll||[];
  return arr.filter(r=>String(r.period||'')<=date.slice(0,7)&&/^\d{4}-\d{2}$/.test(String(r.period||''))&&
    (String(r.employeeId||'')===employee.id&&!!r.employeeId||norm(r.employeeName||r.values?.A)===norm(employee.name)));
 }
 function rateOf(s,e,date){
  const candidates=payrollCandidates(s,e,date).sort((a,b)=>String(b.period).localeCompare(String(a.period)));
  const r=candidates[0];if(!r)return null;
  if(Object.prototype.hasOwnProperty.call(r,'hourlyRate')){
   const rate=Number(r.hourlyRate);return Number.isFinite(rate)&&rate>0?{rate,period:r.period,chargesMissing:!!r.chargesMissing}:null;
  }
  const salary=num(r.values?.B),charges=num(r.employerCosts),hours=num(r.monthlyHours)>0?num(r.monthlyHours):220;
  const rate=(salary+charges)/hours;
  return Number.isFinite(rate)&&rate>0?{rate:Math.round(rate*1000000)/1000000,period:r.period,chargesMissing:!(charges>0)}:null;
 }
 function forDay(s,project,date){return (s.crewAllocations||[]).filter(a=>a.project===project&&a.date===date)}
 function ensureDraft(s){const key=pickedProject+'|'+day;if(draftKey!==key){draftKey=key;draft=new Map(forDay(s,pickedProject,day).map(a=>[String(a.employeeId),{checked:true,hours:Number(a.hours)||8}]))}}
 function selectedRows(s){
  return employees(s).filter(e=>draft.get(e.id)?.checked).map(e=>{
   const old=forDay(s,pickedProject,day).find(a=>String(a.employeeId)===e.id);
   const info=old?.hourlyRate>0?{rate:Number(old.hourlyRate),period:old.payrollPeriod||'',chargesMissing:false}:rateOf(s,e,day);
   const hours=Number(draft.get(e.id)?.hours||0);
   return {employee:e,hours,rate:info,old,total:info?round(info.rate*hours):0};
  });
 }
 function summary(s,project){const entries=(s.crewAllocations||[]).filter(x=>!project||x.project===project);return {entries,count:entries.length,hours:entries.reduce((a,x)=>a+num(x.hours),0),cost:round(entries.reduce((a,x)=>a+num(x.total),0))}}
 function page(s,globalProject){
  const options=s.projects||[];if(!options.some(p=>p.id===pickedProject))pickedProject=options[0]?.id||'';
  if(globalProject!==seenGlobalProject){seenGlobalProject=globalProject;if(globalProject!=='all'&&options.some(p=>p.id===globalProject))pickedProject=globalProject;}
  if(!day)day=new Date().toLocaleDateString('sv-SE');
  ensureDraft(s);
  const people=employees(s),selected=selectedRows(s);
  const missing=selected.filter(x=>!x.rate);
  const historical=forDay(s,pickedProject,day);
  const earlier=[...new Set((s.crewAllocations||[]).filter(a=>a.project===pickedProject&&a.date<day).map(a=>a.date))].sort().at(-1)||'';
  const month=day.slice(0,7);
  const monthRows=(s.crewAllocations||[]).filter(x=>x.project===pickedProject&&x.date?.slice(0,7)===month);
  const monthCost=0;
  const total=summary(s,pickedProject);
  const optionsHtml=options.map(p=>'<option value="'+esc(p.id)+'" '+(p.id===pickedProject?'selected':'')+'>'+esc([p.code,p.name].filter(Boolean).join(' · '))+'</option>').join('');
  const peopleHtml=people.filter(e=>norm(e.name+' '+e.role).includes(norm(keyword))).map(e=>{
   const item=draft.get(e.id)||{},checked=!!item.checked,prior=historical.find(a=>String(a.employeeId)===e.id);
   const info=prior?.hourlyRate>0?{rate:Number(prior.hourlyRate),period:prior.payrollPeriod||'',chargesMissing:false}:rateOf(s,e,day);
   return '<tr class="'+(checked?'crew-marked':'')+'"><td class="crew-check-cell"><input id="crew-employee-'+esc(e.id)+'" type="checkbox" data-crew-select="'+esc(e.id)+'" '+(checked?'checked':'')+' '+(!info&&!checked?'disabled title="Funcionário sem custo/hora disponível na folha"':'')+' aria-label="Incluir '+esc(e.name)+'"></td>'+
    '<td class="crew-name-cell"><label for="crew-employee-'+esc(e.id)+'"><strong>'+esc(e.name)+'</strong></label></td>'+
    
    '<td class="crew-hours-cell"><div class="crew-hour-controls"><button type="button" class="crew-step" data-crew-step="-1" data-crew-employee="'+esc(e.id)+'" aria-label="Diminuir uma hora de '+esc(e.name)+'" '+(checked?'':'disabled')+'>−</button><input class="crew-hours" type="number" inputmode="decimal" data-crew-hours="'+esc(e.id)+'" min="0.25" max="24" step="0.25" value="'+esc(item.hours??prior?.hours??8)+'" '+(checked?'':'disabled')+' aria-label="Horas de '+esc(e.name)+'"><button type="button" class="crew-step" data-crew-step="1" data-crew-employee="'+esc(e.id)+'" aria-label="Adicionar uma hora para '+esc(e.name)+'" '+(checked?'':'disabled')+'>+</button></div></td>'+
    '</tr>';
  }).join('');
  const history=[...new Map((s.crewAllocations||[]).filter(a=>a.project===pickedProject).map(a=>[a.date,a.date])).values()].sort().reverse().slice(0,35)
   .map(date=>{const rows=forDay(s,pickedProject,date),amount=round(rows.reduce((a,x)=>a+num(x.total),0));return '<tr><td><button type="button" class="text-btn" data-crew-day="'+esc(date)+'">'+esc(dateBR(date))+'</button></td><td>'+rows.length+'</td><td class="num">'+rows.reduce((a,x)=>a+num(x.hours),0).toLocaleString('pt-BR')+' h</td></tr>'}).join('');
  return '<div class="crew-screen"><section class="crew-hero"><div><p class="crew-overline">OBRAS · CENTRO DE CUSTOS</p><h2>Alocação diária de equipes</h2><p>Lista vinculada à folha de pagamento. Escolha a obra, marque as pessoas e ajuste as horas.</p></div><span class="crew-symbol">👷</span></section>'+
   (!options.length?'<div class="notice">Cadastre uma obra para iniciar os apontamentos.</div>':
   '<section class="panel crew-panel"><div class="crew-fields"><label>Obra<select id="crewProject">'+optionsHtml+'</select></label><div class="crew-date-field"><label for="crewDate">Data da alocação</label><div class="crew-date-buttons"><button type="button" id="crewPrevDate" class="button secondary" aria-label="Dia anterior">‹</button><input type="date" id="crewDate" value="'+esc(day)+'"><button type="button" id="crewNextDate" class="button secondary" aria-label="Dia seguinte">›</button></div></div><label>Jornada padrão (horas)<input type="number" id="crewDefaultHours" inputmode="decimal" min="0.25" max="24" step="0.25" value="8"></label><div class="crew-actions"><button type="button" class="button secondary" id="crewApplyHours">Aplicar horas aos selecionados</button></div></div>'+
   '<div class="crew-metrics"><div><span>Funcionários selecionados</span><strong id="crewPeople">'+selected.length+'</strong></div><div><span>Horas previstas</span><strong id="crewHours">'+selected.reduce((a,x)=>a+x.hours,0).toLocaleString('pt-BR')+' h</strong></div></div><div class="crew-toolbar"><input id="crewSearch" type="search" placeholder="Buscar funcionário..." value="'+esc(keyword)+'" aria-label="Buscar funcionários"><div class="crew-quick-actions"><button type="button" class="button secondary" id="crewCopyPrevious" '+(earlier?'':'disabled')+'>↻ Copiar última equipe</button><button type="button" class="button secondary" id="crewAll">✓ Selecionar todos</button><button type="button" class="button secondary" id="crewClear">Limpar</button></div></div>'+
   '<div class="crew-table-scroll"><table class="crew-table"><thead><tr><th>Selecionar</th><th>Funcionário</th><th>Tempo na obra</th></tr></thead><tbody>'+peopleHtml+'</tbody></table></div>'+
   '<div class="crew-footer"><div class="crew-save-metrics"><strong id="crewSaveCount">'+selected.length+' funcionário(s)</strong><strong id="crewSaveHours">'+selected.reduce((a,x)=>a+x.hours,0).toLocaleString('pt-BR')+' h</strong></div><p id="crewHint">'+(missing.length?'Atenção: '+missing.length+' funcionário(s) sem custo/hora; confira a folha.':selected.some(x=>x.rate?.chargesMissing)?'Confira os encargos lançados na folha: há custos com encargos zerados.':'Valor gerencial: não cria contas a pagar nem pagamentos duplicados.')+'</p><button type="button" class="button primary" id="crewSave" '+(busy?'disabled':'')+'>'+(busy?'Salvando…':'Salvar alocação do dia')+'</button></div></section>'+
   '<div class="crew-split"><section class="panel"><div class="panel-head"><h2>Horas acumuladas</h2></div><div class="crew-totals"><p>Competência '+esc(month.split('-').reverse().join('/'))+'</p><strong>'+monthRows.length+' registros</strong><p>Total da obra</p><strong>'+total.hours.toLocaleString('pt-BR')+' h</strong></div></section>'+ '<section class="panel"><div class="panel-head"><h2>Histórico de alocações</h2></div><div class="crew-table-scroll"><table><thead><tr><th>Data</th><th>Pessoas</th><th>Horas</th></tr></thead><tbody>'+ (history||'<tr><td colspan="4" class="empty">Ainda não há equipes alocadas nesta obra.</td></tr>')+'</tbody></table></div></section></div>')+'</div>';
 }
 function attach(s,persist,render,notify){
  const $=id=>document.getElementById(id),refresh=()=>render();
  if(!$('crewProject'))return;
  $('crewProject').onchange=e=>{pickedProject=e.target.value;draftKey='';keyword='';refresh()};
  $('crewDate').onchange=e=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(e.target.value))return;day=e.target.value;draftKey='';refresh()};
  for(const [id,delta] of [['crewPrevDate',-1],['crewNextDate',1]])$(id).onclick=()=>{day=moveDate(day,delta);draftKey='';keyword='';refresh()};
  $('crewSearch').oninput=e=>{keyword=e.target.value;const cursor=e.target.selectionStart;refresh();const input=$('crewSearch');input?.focus();input?.setSelectionRange(cursor,cursor)};
  const draw=()=>{
   const rows=selectedRows(s),sum=round(rows.reduce((a,r)=>a+r.total,0));
   $('crewPeople').textContent=String(rows.length);
   $('crewHours').textContent=rows.reduce((a,r)=>a+r.hours,0).toLocaleString('pt-BR')+' h';
   $('crewSaveCount').textContent=rows.length+' funcionário(s)';
   $('crewSaveHours').textContent=rows.reduce((a,r)=>a+r.hours,0).toLocaleString('pt-BR')+' h';
   
   $('crewHint').textContent=rows.some(x=>!x.rate)?'Há funcionário sem custo/hora na folha. Não será possível salvar até corrigir.':rows.some(x=>x.rate?.chargesMissing)?'Atenção: existem custos calculados com encargos zerados na folha.':'Valores gerenciais. Não criam lançamento de pagamento.';
   for(const e of employees(s)){
    const checked=!!draft.get(e.id)?.checked;
    const input=document.querySelector('[data-crew-hours="'+CSS.escape(e.id)+'"]');if(input)input.disabled=!checked;
    document.querySelectorAll('[data-crew-employee="'+CSS.escape(e.id)+'"]').forEach(button=>button.disabled=!checked);
    const inputRow=input?.closest('tr');if(inputRow)inputRow.classList.toggle('crew-marked',checked);
   }
  };
  document.querySelectorAll('[data-crew-select]').forEach(el=>el.onchange=e=>{const id=e.target.dataset.crewSelect,old=draft.get(id)||{hours:8};draft.set(id,{...old,checked:e.target.checked});draw()});
  document.querySelectorAll('[data-crew-hours]').forEach(el=>el.oninput=e=>{const id=e.target.dataset.crewHours,old=draft.get(id)||{checked:false};draft.set(id,{...old,hours:Number(e.target.value)});draw()});
  document.querySelectorAll('[data-crew-step]').forEach(button=>button.onclick=()=>{
   const id=button.dataset.crewEmployee,old=draft.get(id);if(!old?.checked)return;
   const next=Math.round(((Number(old.hours)||0)+Number(button.dataset.crewStep))*4)/4;
   if(next<0.25||next>24)return;
   draft.set(id,{...old,hours:next});
   const input=document.querySelector('[data-crew-hours="'+CSS.escape(id)+'"]');if(input)input.value=String(next);
   draw();
  });
  $('crewCopyPrevious').onclick=()=>{
   const previous=[...new Set((s.crewAllocations||[]).filter(a=>a.project===pickedProject&&a.date<day).map(a=>a.date))].sort().at(-1);
   if(!previous)return notify('Ainda não existe equipe anterior para esta obra.');
   if(selectedRows(s).length&&!root.confirm('Substituir a seleção atual pela equipe salva em '+dateBR(previous)+'?'))return;
   const eligible=new Set(employees(s).filter(e=>e.role!=='Inativo / histórico'&&rateOf(s,e,day)).map(e=>e.id));
   const entries=forDay(s,pickedProject,previous).filter(a=>eligible.has(String(a.employeeId)));
   if(!entries.length)return notify('A equipe anterior não possui funcionários ativos com custo/hora disponível.');
   draft=new Map(entries.map(a=>[String(a.employeeId),{checked:true,hours:Number(a.hours)||8}]));
   keyword='';refresh();notify('Equipe de '+dateBR(previous)+' copiada. Confira as horas e salve.');
  };
  $('crewAll').onclick=()=>{for(const e of employees(s))if(rateOf(s,e,day)||forDay(s,pickedProject,day).some(x=>String(x.employeeId)===e.id)){draft.set(e.id,{checked:true,hours:draft.get(e.id)?.hours||8})}document.querySelectorAll('[data-crew-select]').forEach(el=>el.checked=!!draft.get(el.dataset.crewSelect)?.checked);draw()};
  $('crewClear').onclick=()=>{for(const x of draft.values())x.checked=false;document.querySelectorAll('[data-crew-select]').forEach(el=>el.checked=false);draw()};
  $('crewApplyHours').onclick=()=>{const hours=Number($('crewDefaultHours').value);if(!Number.isFinite(hours)||hours<=0||hours>24)return notify('Informe uma jornada entre 0,25 e 24 horas.');for(const x of draft.values())if(x.checked)x.hours=hours;document.querySelectorAll('[data-crew-hours]').forEach(el=>{if(draft.get(el.dataset.crewHours)?.checked)el.value=String(hours)});draw()};
  document.querySelectorAll('[data-crew-day]').forEach(el=>el.onclick=()=>{day=el.dataset.crewDay;draftKey='';refresh()});
  $('crewSave').onclick=async()=>{
   if(busy)return;if(root.EngefexAccess&&!root.EngefexAccess.canWrite('teams'))return notify('Sem permissão para editar equipes.');
   if(!s.projects?.some(p=>p.id===pickedProject))return notify('Selecione uma obra válida.');
   const rows=selectedRows(s),missing=rows.filter(x=>!x.rate);if(missing.length)return notify('Custo/hora não encontrado para: '+missing.map(x=>x.employee.name).join(', ')+'. Preencha a folha antes de salvar.');
   if(rows.some(x=>!Number.isFinite(x.hours)||x.hours<=0||x.hours>24||Math.abs(x.hours*4-Math.round(x.hours*4))>0.001))return notify('As horas devem ser múltiplos de 0,25, entre 0,25 e 24.');
   const selectedIds=new Set(rows.map(x=>x.employee.id));
   const other=(s.crewAllocations||[]).filter(x=>x.date===day&&x.project!==pickedProject);
   const overs=rows.filter(x=>x.hours+other.filter(y=>String(y.employeeId)===x.employee.id).reduce((a,y)=>a+num(y.hours),0)>24);
   if(overs.length)return notify('Há funcionário com mais de 24 horas no mesmo dia entre obras: '+overs.map(x=>x.employee.name).join(', '));
   const overtime=rows.filter(x=>x.hours+other.filter(y=>String(y.employeeId)===x.employee.id).reduce((a,y)=>a+num(y.hours),0)>8);
   if(overtime.length&&!root.confirm('Alguns funcionários ultrapassam 8 horas somando as obras neste dia. Deseja confirmar mesmo assim?'))return;
   const previous=forDay(s,pickedProject,day);
   if(previous.some(x=>!selectedIds.has(String(x.employeeId)))&&!root.confirm('Remover do apontamento os funcionários desmarcados? O histórico da alteração será mantido.'))return;
   const updated=rows.map(x=>({
    id:x.old?.id||'crew-'+(root.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2)),
    project:pickedProject,date:day,employeeId:x.employee.id,employeeName:x.employee.name,
    hours:x.hours,hourlyRate:x.rate.rate,payrollPeriod:x.rate.period,total:x.total,
    updatedAt:new Date().toISOString()
   }));
   const same=previous.length===updated.length&&updated.every(x=>previous.some(y=>y.employeeId===x.employeeId&&Number(y.hours)===x.hours&&Number(y.hourlyRate)===x.hourlyRate&&Number(y.total)===x.total));
   if(same)return notify('Nenhuma alteração para salvar nesta data.');
   const next=structuredClone(s);
   next.crewAllocations=(next.crewAllocations||[]).filter(x=>!(x.project===pickedProject&&x.date===day)).concat(updated);
   next.history=next.history||[];next.history.unshift({id:'H-crew-'+Date.now(),time:new Date().toISOString(),kind:'crewAllocations',record:pickedProject+'|'+day,action:'Apontamento de equipe atualizado',before:previous,after:updated});
   busy=true;const btn=$('crewSave');if(btn){btn.disabled=true;btn.textContent='Salvando…'}
   try{const ok=await persist(next,'Equipe alocada e custo gerencial atualizado.');if(ok===false)throw Error('O Supabase não confirmou o salvamento.');draftKey='';refresh();}
   catch(e){notify(e?.message||'Erro ao salvar a alocação.');if(btn){btn.disabled=false;btn.textContent='Salvar alocação do dia'}}finally{busy=false}
  };
 }
 root.EngefexCrew={page,attach,rateOf,summary,forDay};
})(window);
