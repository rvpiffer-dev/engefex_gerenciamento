/* Importação mensal da folha Engefex a partir das duas abas XLSX. */
(function(root){'use strict';
const original=root.EngefexHRExtra;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=x=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(x)||0);
const norm=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\([^)]*\)/g,'').replace(/\s+/g,' ').trim().toLowerCase();
let selectedPeriod=new Date().toISOString().slice(0,7),tab='salary',search='',statusFilter='all',checkFilter='all',matchFilter='all',sort='name',onlyPositive=false;
const columnNames=['Nome','Valor do Salário','Hora extra','INSALUBRIDADE','Vale 40%','Uniodonto','Farmácia','Faltas','Pensão','Vales','INSS','I.R','CARTÃO','TOTAL','TOTAL COM O CARTÃO'];
const val=(row,col)=>row[col]===undefined?'':row[col];
const num=x=>typeof x==='number'&&Number.isFinite(x)?x:Number(String(x??'').replace(',','.'))||0;
async function parse(file){
 const zip=await root.JSZip.loadAsync(file);
 const xml=async path=>{const f=zip.file(path);if(!f)throw Error('Arquivo XLSX sem '+path);return new DOMParser().parseFromString(await f.async('string'),'application/xml')};
 const texts=[];if(zip.file('xl/sharedStrings.xml')){const doc=await xml('xl/sharedStrings.xml');for(const si of doc.getElementsByTagName('si'))texts.push([...si.getElementsByTagName('t')].map(t=>t.textContent).join(''))}
 const book=await xml('xl/workbook.xml'),rels=await xml('xl/_rels/workbook.xml.rels');
 const targets=new Map([...rels.getElementsByTagName('Relationship')].map(x=>[x.getAttribute('Id'),x.getAttribute('Target')]));
 const out={};
 for(const sh of [...book.getElementsByTagName('sheet')]){
  const name=sh.getAttribute('name'),relationship=sh.getAttribute('r:id')||sh.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');
  if(!name||!targets.has(relationship))continue;
  const target=targets.get(relationship).replace(/^\//,'').replace(/^xl\//,'');
  const doc=await xml('xl/'+target),rows=[];
  for(const r of doc.getElementsByTagName('row')){
   const result={};
   for(const c of r.getElementsByTagName('c')){
    const col=(c.getAttribute('r')||'').match(/^[A-Z]+/)?.[0];if(!col)continue;
    const kind=c.getAttribute('t'),value=c.getElementsByTagName('v')[0]?.textContent;
    const inline=c.getElementsByTagName('is')[0];
    if(kind==='s')result[col]=texts[Number(value)]||'';
    else if(kind==='inlineStr')result[col]=inline?.textContent||'';
    else if(value!==undefined)result[col]=kind==='str'?value:Number(value);
   }
   rows.push(result);
  }
  out[name]=rows;
 }
 const salary=out['Salario - Set']||Object.entries(out).find(([k])=>/^sal[aá]rio|^salario/i.test(k))?.[1];
 const advances=out['Vale']||Object.entries(out).find(([k])=>/^vale/i.test(k))?.[1];
 if(!salary||!advances)throw Error('A planilha precisa conter as abas Salario - Set (ou Salário) e Vale.');
 const entries=salary.filter(r=>typeof r.A==='string'&&r.A.trim()&&!/^nome|total/i.test(r.A)).map(r=>({name:r.A,values:Object.fromEntries('ABCDEFGHIJKLMNO'.split('').map(k=>[k,val(r,k)]))}));
 const vs=advances.filter(r=>typeof r.A==='string'&&r.A.trim()).map(r=>({name:r.A,amount:num(r.C)}));
 for(const e of entries){let matches=vs.filter(v=>norm(v.name)===norm(e.name));if(matches.length===1)e.valeSheet=matches[0].amount;else e.valeSheet=null;}
 return {entries,advances:vs};
}
function page(s,view){
 if(view!=='hr-payroll')return original.page(s,view);
 const all=(s.hrPayroll||[]).filter(r=>r.period===selectedPeriod),nameOf=r=>r.employeeName||r.values?.A||'';
 const check=r=>r.valeSheet!=null&&r.values?.E!==''&&Math.abs(num(r.values?.E)-num(r.valeSheet))>0.01?'divergent':!r.employeeId?'unmatched':'ok';
 let rows=all.filter(r=>(!search||norm(nameOf(r)).includes(norm(search)))&&(statusFilter==='all'||(r.status||'Rascunho')===statusFilter)&&(checkFilter==='all'||check(r)===checkFilter)&&(matchFilter==='all'||(matchFilter==='matched'?!!r.employeeId:!r.employeeId)));
 rows.sort((a,b)=>sort==='name'?nameOf(a).localeCompare(nameOf(b),'pt-BR'):sort==='name-desc'?nameOf(b).localeCompare(nameOf(a),'pt-BR'):sort==='value-desc'?num(b.values?.N)-num(a.values?.N):num(a.values?.N)-num(b.values?.N));
 if(onlyPositive)rows=rows.filter(r=>tab==='salary'?num(r.values?.N)>0:num(r.valeSheet??r.values?.E)>0);
 const sumSalary=rows.reduce((a,r)=>a+num(r.values?.N),0),sumVale=rows.reduce((a,r)=>a+num(r.valeSheet??r.values?.E),0);
 const select=(id,opts,current)=>'<select id="'+id+'">'+opts.map(([value,label])=>'<option value="'+esc(value)+'" '+(value===current?'selected':'')+'>'+esc(label)+'</option>').join('')+'</select>';
 const salaryCols=columnNames.map((name,i)=>({label:name,key:String.fromCharCode(65+i)}));
 const cols=tab==='salary'?salaryCols:[{label:'Funcionário',key:'A'},{label:'Vale 40% (aba Salário)',key:'E'},{label:'Vale (aba Vale)',key:'valeSheet'},{label:'Diferença',key:'diff'}];
 const showCell=(r,key)=>{
  if(key==='A')return esc(nameOf(r));
  if(key==='valeSheet')return r.valeSheet==null?'—':money(r.valeSheet);
  if(key==='diff')return r.valeSheet==null?'—':money(num(r.valeSheet)-num(r.values?.E));
  return r.values?.[key]===''||r.values?.[key]==null?'—':money(r.values[key]);
 };
 return '<section class="page-head hr-hero"><div><p class="hr-eyebrow">ENGEFEX · RECURSOS HUMANOS</p><h1>Folha de pagamento</h1><p>Salário dia 05 (60%) e vale dia 20 (40%). Abas e competências independentes, conforme o modelo Excel.</p></div></section>'+
 '<section class="panel hr-panel"><div class="panel-head"><h2>Competência e importação</h2></div><div class="form-grid"><label>Competência<input type="month" id="payPeriod" value="'+esc(selectedPeriod)+'"></label><label>Importar XLSX com as duas abas<input id="payFile" type="file" accept=".xlsx"></label></div><p id="payFeedback" class="notice">Nova importação da mesma competência solicita confirmação. Outros meses não são alterados.</p><button class="button primary" id="payImport" type="button">Importar folha desta competência</button></section>'+
 '<section class="panel hr-panel"><div class="panel-head"><h2>Consulta de pagamentos</h2><p>'+all.length+' funcionários na competência</p></div>'+
 '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px" role="tablist" aria-label="Tipo de folha"><button class="button '+(tab==='salary'?'primary':'secondary')+'" type="button" data-pay-tab="salary" role="tab" aria-selected="'+(tab==='salary')+'">Salário · dia 05 (60%)</button><button class="button '+(tab==='vale'?'primary':'secondary')+'" type="button" data-pay-tab="vale" role="tab" aria-selected="'+(tab==='vale')+'">Vale · dia 20 (40%)</button></div>'+
 '<div class="form-grid" style="margin-bottom:14px"><label>Buscar funcionário<input id="paySearch" placeholder="Nome do funcionário" value="'+esc(search)+'"></label>'+
 '<label>Situação'+select('payStatus',[['all','Todas'],['Rascunho','Rascunho'],['Conferido','Conferido'],['Pago','Pago']],statusFilter)+'</label>'+
 '<label>Conferência'+select('payCheck',[['all','Todas'],['ok','Sem divergência'],['divergent','Divergência entre abas'],['unmatched','Sem vínculo com cadastro']],checkFilter)+'</label>'+
 '<label>Vínculo RH'+select('payMatch',[['all','Todos'],['matched','Vinculados'],['unmatched','Não vinculados']],matchFilter)+'</label>'+
 '<label>Ordenar'+select('paySort',[['name','Nome A–Z'],['name-desc','Nome Z–A'],['value-desc','Total maior primeiro'],['value-asc','Total menor primeiro']],sort)+'</label>'+
 '<label style="display:flex;align-items:center;gap:8px"><input id="payPositive" type="checkbox" '+(onlyPositive?'checked':'')+'>Somente valores positivos</label></div>'+
 '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:14px"><span class="tag">'+rows.length+' exibidos de '+all.length+'</span><span class="tag">Total salário: '+money(sumSalary)+'</span><span class="tag">Total vale: '+money(sumVale)+'</span><button class="button secondary" type="button" id="payClear">Limpar filtros</button></div>'+
 '<div class="hr-table-wrap" style="overflow:auto"><table class="hr-data-table" style="min-width:'+(tab==='salary'?'1700':'800')+'px"><thead><tr>'+cols.map(col=>'<th>'+esc(col.label)+'</th>').join('')+'<th>Situação</th><th>Conferência</th></tr></thead><tbody>'+
 (rows.length?rows.map(r=>'<tr>'+cols.map(col=>'<td>'+showCell(r,col.key)+'</td>').join('')+'<td>'+esc(r.status||'Rascunho')+'</td><td>'+esc(check(r)==='divergent'?'Divergência':check(r)==='unmatched'?'Cadastro não vinculado':'OK')+'</td></tr>').join(''):'<tr><td colspan="'+(cols.length+2)+'">Nenhum resultado para os filtros selecionados.</td></tr>')+
 '</tbody></table></div></section><p class="notice">Os filtros são apenas de visualização. Totais são calculados sobre as linhas filtradas. Os valores da planilha são mantidos sem ajuste automático.</p>';
}
function attach(s,persist,render,notify,view){
 if(view!=='hr-payroll')return original.attach(s,persist,render,notify,view);
 const period=document.getElementById('payPeriod'),file=document.getElementById('payFile'),feedback=document.getElementById('payFeedback'); 
 document.querySelectorAll('[data-pay-tab]').forEach(btn=>btn.onclick=()=>{tab=btn.dataset.payTab;render()});
 const rebind=(id,key)=>{const el=document.getElementById(id);if(!el)return;el.onchange=()=>{const value=el.type==='checkbox'?el.checked:el.value;if(key==='search')search=value;else if(key==='status')statusFilter=value;else if(key==='check')checkFilter=value;else if(key==='match')matchFilter=value;else if(key==='sort')sort=value;else if(key==='positive')onlyPositive=value;render()};};
 rebind('paySearch','search');rebind('payStatus','status');rebind('payCheck','check');rebind('payMatch','match');rebind('paySort','sort');rebind('payPositive','positive');
 document.getElementById('payClear').onclick=()=>{search='';statusFilter='all';checkFilter='all';matchFilter='all';sort='name';onlyPositive=false;render()};

 period.onchange=()=>{if(/^\d{4}-\d{2}$/.test(period.value)){selectedPeriod=period.value;render()}};
 document.getElementById('payImport').onclick=async()=>{
  if(!root.EngefexAccess?.canWrite('hr-payroll'))return notify('Sem permissão para editar a folha.');
  if(!file.files[0])return notify('Selecione a planilha Excel.');
  try{
   feedback.textContent='Lendo a folha e os vales...';
   const {entries,advances}=await parse(file.files[0]);
   const people=s.hrEmployees||[];
   const records=entries.map(e=>{
    let match=people.filter(p=>norm(p.name)===norm(e.name));
    return {id:crypto.randomUUID(),period:selectedPeriod,employeeName:e.name,employeeId:match.length===1?match[0].id:'',values:e.values,valeSheet:e.valeSheet,salaryPaymentDay:5,valePaymentDay:20,salaryShare:60,valeShare:40,status:'Rascunho',source:file.files[0].name,importedAt:new Date().toISOString()};
   });
   const unmatched=records.filter(r=>!r.employeeId).length;
   const unmatchedVale=advances.filter(v=>!entries.some(e=>norm(e.name)===norm(v.name)));
   const divergent=records.filter(r=>r.valeSheet!==null&&Math.abs(num(r.valeSheet)-num(r.values.E))>.01).length;
   const previous=(s.hrPayroll||[]).filter(r=>r.period===selectedPeriod);
   const summary=records.length+' linhas de salário; '+advances.length+' linhas de vale; '+unmatched+' nomes sem cadastro exato; '+divergent+' diferenças entre abas; '+unmatchedVale.length+' vales sem folha correspondente.';
   feedback.textContent=summary;
   if(!confirm('Importar competência '+selectedPeriod+'?\n'+summary+'\nAs linhas existentes deste mês serão substituídas, mantendo todos os outros meses.'))return;
   const next=structuredClone(s);
   next.hrPayroll=(next.hrPayroll||[]).filter(r=>r.period!==selectedPeriod).concat(records);
   const result=await persist(next,'Folha '+selectedPeriod+' salva no Supabase.');
   if(result===false)throw Error('O Supabase não confirmou o salvamento.');
   notify('Importação salva: '+summary);render();
  }catch(err){feedback.textContent='Erro: '+err.message;notify(err.message)}
 };
}
root.EngefexHRExtra={page,attach};
})(window);
