/* Importação mensal da folha Engefex a partir das duas abas XLSX. */
(function(root){'use strict';
const original=root.EngefexHRExtra;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=x=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(x)||0);
const norm=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\([^)]*\)/g,'').replace(/\s+/g,' ').trim().toLowerCase();
let selectedPeriod=new Date().toISOString().slice(0,7);
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
 const rows=(s.hrPayroll||[]).filter(r=>r.period===selectedPeriod);
 const total=rows.reduce((a,r)=>a+num(r.values?.N),0);
 const advances=rows.reduce((a,r)=>a+num(r.valeSheet??r.values?.E),0);
 return '<section class="page-head hr-hero"><div><p class="hr-eyebrow">ENGEFEX · RECURSOS HUMANOS</p><h1>Folha de pagamento</h1><p>Importação mensal no mesmo modelo da planilha original, com histórico por competência.</p></div></section>'+
 '<section class="panel hr-panel"><div class="panel-head"><h2>Competência e importação</h2></div><div class="form-grid"><label>Competência (mês e ano)<input type="month" id="payPeriod" value="'+esc(selectedPeriod)+'"></label><label>Importar XLSX (abas Salario e Vale)<input id="payFile" type="file" accept=".xlsx"></label></div><p id="payFeedback" class="notice">Confira os dados antes de importar. Cada mês fica separado; uma nova importação do mesmo mês substituirá somente os registros correspondentes após confirmação.</p><div class="actions"><button class="button primary" id="payImport" type="button">Importar folha desta competência</button></div></section>'+
 '<section class="panel hr-panel"><div class="panel-head"><h2>Folha de '+esc(selectedPeriod)+'</h2><p>'+rows.length+' registros · total da coluna TOTAL '+money(total)+' · vales '+money(advances)+'</p></div><div class="table-wrap" style="overflow:auto"><table class="hr-data-table" style="min-width:1600px"><thead><tr>'+columnNames.map(h=>'<th>'+esc(h)+'</th>').join('')+'<th>Vale (aba Vale)</th><th>Conferência</th></tr></thead><tbody>'+
 rows.map(r=>{const v=r.values||{};const diff=r.valeSheet!==null&&r.valeSheet!==undefined&&Math.abs(num(v.E)-num(r.valeSheet))>.01;return '<tr>'+columnNames.map((_,i)=>{const key=String.fromCharCode(65+i);return '<td>'+esc(key==='A'?r.employeeName||v.A:v[key]===''?'':money(v[key]))+'</td>'}).join('')+'<td>'+esc(r.valeSheet==null?'Não informado':money(r.valeSheet))+'</td><td>'+esc(diff?'Divergência entre abas':r.employeeId?'Conferido pelo nome':'Verificar cadastro')+'</td></tr>'}).join('')+
 '</tbody></table></div></section><p class="notice">Valores preservados conforme planilha, inclusive diferenças entre abas e fórmulas calculadas no arquivo. Não substitui conferência contábil, encargos ou eSocial.</p>';
}
function attach(s,persist,render,notify,view){
 if(view!=='hr-payroll')return original.attach(s,persist,render,notify,view);
 const period=document.getElementById('payPeriod'),file=document.getElementById('payFile'),feedback=document.getElementById('payFeedback');
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
    return {id:crypto.randomUUID(),period:selectedPeriod,employeeName:e.name,employeeId:match.length===1?match[0].id:'',values:e.values,valeSheet:e.valeSheet,status:'Rascunho',source:file.files[0].name,importedAt:new Date().toISOString()};
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
