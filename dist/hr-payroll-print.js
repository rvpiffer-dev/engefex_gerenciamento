/* Relatórios de RH e custo-hora: camada de apresentação sem modificar cálculo da folha. */
(function(w){'use strict';
const original=w.EngefexHRExtra;
const h=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const format=x=>typeof x==='number'?new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(x):h(x??'');
const salaryLabels=['Nome','Valor do Salário','Hora extra','INSALUBRIDADE','Vale 40%','Uniodonto','Farmácia','Faltas','Pensão','Vales','INSS','I.R','CARTÃO','TOTAL','TOTAL COM O CARTÃO'];
const valeLabels=['Nome','SALÁRIO','VALE 40%'];
const name=r=>String(r.employeeName||r.values?.A||'');
const number=x=>typeof x==='number'?x:Number(String(x??'').replace(',','.'))||0;
const cost=r=>{const hours=Number(r.monthlyHours)>0?Number(r.monthlyHours):220;return (number(r.values?.B)+number(r.employerCosts))/hours};
const costText=r=>format(cost(r));
const monthRows=(s,month,k)=>(s[k]||[]).filter(r=>r.period===month);
function getMonth(){return document.getElementById('rhMonth')?.value||new Date().toISOString().slice(0,7)}
function getTab(){return document.querySelector('[data-rh-aba].primary')?.dataset.rhAba||'sal'}
function popup(title,html,landscape){
 const win=w.open('','_blank');if(!win){alert('Permita abrir uma janela para imprimir.');return}
 const css='@page{size:A4 '+(landscape?'landscape':'portrait')+';margin:13mm}body{font:11px Arial,sans-serif;color:#17202a}h1{font-size:19px;margin:0 0 5px}h2{font-size:14px;margin:16px 0 6px}.meta{color:#555;margin:7px 0 18px}.entry{break-inside:avoid;page-break-inside:avoid;margin-bottom:18px;border-bottom:1px solid #aaa;padding-bottom:13px}table{width:100%;border-collapse:collapse}td,th{padding:5px 6px;border:1px solid #ccd1d6;text-align:left}th{background:#edf1f5;font-size:10px}td.num{text-align:right;white-space:nowrap}.note{font-size:9px;color:#555;margin-top:14px}.print-actions{margin:0 0 16px}@media print{.print-actions{display:none}}';
 win.document.open();win.document.write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>'+h(title)+'</title><style>'+css+'</style></head><body><div class="print-actions"><button onclick="window.print()">Imprimir / Salvar PDF</button></div>'+html+'</body></html>');win.document.close();win.focus();
}
function detail(r,kind){
 const labels=kind==='vale'?valeLabels:salaryLabels;
 const table=labels.slice(1).map((label,i)=>{const key=String.fromCharCode(66+i);const val=r.values?.[key];return '<tr><td>'+h(label)+'</td><td class="num">'+(val==null||val===''?'—':format(val))+'</td></tr>'}).join('');
 return '<section class="entry"><h2>'+h(name(r))+'</h2><table><thead><tr><th>Descrição</th><th>Valor informado</th></tr></thead><tbody>'+table+
 (kind==='sal'?'<tr><th>Custo por hora estimado</th><th class="num">'+costText(r)+'</th></tr>':'')+'</tbody></table>'+
 '<p class="note">Status: '+h(r.status||'Rascunho')+(kind==='sal'?' · Horas mensais adotadas (44 h/semana por padrão): '+h(r.monthlyHours||220)+' h · Encargos extras informados: '+format(number(r.employerCosts)):'')+'</p></section>';
}
function individual(s,id,kind,month){
 const key=kind==='vale'?'hrPayrollVale':'hrPayroll',r=monthRows(s,month,key).find(x=>x.id===id);
 if(!r)return alert('Registro não encontrado nesta competência.');
 const t=(kind==='sal'?'Demonstrativo individual de salário':'Demonstrativo individual de vale');
 popup(t,'<h1>ENGEFEX · '+h(t)+'</h1><p class="meta">Competência: '+h(month)+' · Pagamento previsto: dia '+(kind==='sal'?'05':'20')+'</p>'+detail(r,kind)+'<p class="note">Demonstrativo interno dos valores informados na folha. Não substitui holerite oficial da contabilidade.</p>',false);
}
function general(s,month){
 const salary=monthRows(s,month,'hrPayroll'),vale=monthRows(s,month,'hrPayrollVale');
 const table=(rows,kind)=>{
  const labels=kind==='vale'?valeLabels:salaryLabels;
  return '<h2>'+(kind==='sal'?'Salário · dia 05':'Vale · dia 20')+' — '+rows.length+' registros</h2><table><thead><tr>'+labels.map(x=>'<th>'+h(x)+'</th>').join('')+(kind==='sal'?'<th>Custo/h estimado</th>':'')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+labels.map((_,i)=>{const k=String.fromCharCode(65+i),v=k==='A'?name(r):r.values?.[k];return '<td>'+((v==null||v==='')?'—':format(v))+'</td>'}).join('')+(kind==='sal'?'<td>'+costText(r)+'</td>':'')+'</tr>').join('')+'</tbody></table>';
 };
 if(!salary.length&&!vale.length)return alert('Não há registros para esta competência.');
 popup('Relatório geral da folha '+month,'<h1>ENGEFEX · Relatório geral da folha</h1><p class="meta">Competência: '+h(month)+' · Valores discriminados exatamente conforme os lançamentos.</p>'+table(salary,'sal')+table(vale,'vale')+'<p class="note">Custo por hora estimado = (salário-base + encargos extras informados) ÷ horas mensais. Não representa automaticamente o custo empregador completo.</p>',true);
}
function page(s,view){
 const html=original.page(s,view);if(view!=='hr-payroll')return html;
 const start='<button class="button primary" id="rhAdd"';
 const end='<button class="button secondary" id="rhPrintAll" type="button">Imprimir geral (Salário + Vale)</button> ';
 let modified=html.replace(start,end+start);
 // Impressão individual em cada registro e coluna extra de custo hora, somente no salário
 const kind=(html.includes('Salário · dia 05</h2>')?'sal':'vale');
 modified=modified.replaceAll(/(<button type="button" class="button secondary" data-rh-edit="([^"]+)">Editar<\/button>)/g,'<button type="button" class="button secondary" data-rh-print="$2">Holerite</button> $1');
 if(kind==='sal'){
  modified=modified.replace('<th>Situação</th><th>Ações</th>','<th>Custo/h estimado</th><th>Situação</th><th>Ações</th>');
  const salRows=monthRows(s,getMonth(),'hrPayroll');
  modified=modified.replace(/(<td>)(Rascunho|Conferido|Pago)(<\/td><td><button type="button" class="button secondary" data-rh-print="([^"]+)")/g,(all,prefix,status,middle,id)=>{
   const r=salRows.find(x=>x.id===id);return '<td>'+(r?costText(r):'—')+'</td>'+prefix+status+middle;
  });
  modified=modified.replace('<div class="hr-editor-fields" id="rhPayFields"></div>','<div class="hr-editor-fields" id="rhPayFields"></div><div id="rhCostFields"></div>');
 }
 return modified;
}
function attach(s,persist,render,notify,view){
 original.attach(s,persist,render,notify,view);if(view!=='hr-payroll')return;
 document.getElementById('rhPrintAll')?.addEventListener('click',()=>general(s,getMonth()));
 document.querySelectorAll('[data-rh-print]').forEach(b=>b.addEventListener('click',()=>individual(s,b.dataset.rhPrint,getTab(),getMonth())));
 // Complementa o formulário já existente sem alterar os valores importados.
 if(getTab()==='sal'){
  const buttons=document.querySelectorAll('[data-rh-edit]'),add=document.getElementById('rhAdd');
  function extras(){
   const box=document.getElementById('rhCostFields');if(!box)return;
   const id=document.getElementById('rhPayDialog')?.dataset.id||'',r=monthRows(s,getMonth(),'hrPayroll').find(x=>x.id===id);
   box.innerHTML='<div class="form-grid"><label>Horas mensais (padrão 220 h · 44 h/semana)<input type="number" min="1" step="0.5" name="monthlyHours" form="rhPayForm" value="'+h(r?.monthlyHours||220)+'"></label><label>Encargos adicionais mensais (R$)<input type="number" min="0" step="0.01" name="employerCosts" form="rhPayForm" value="'+h(r?.employerCosts||0)+'"></label></div><p class="note">Jornada padrão: 44 h por semana (divisor de 220 h mensais). Estimativa: (salário-base + encargos adicionais) ÷ horas mensais.</p>';
  }
  [add,...buttons].forEach(b=>b?.addEventListener('click',extras));
  const form=document.getElementById('rhPayForm');
  form?.addEventListener('submit',()=>{
   // O editor principal salva o estado; os parâmetros adicionais são tratados pelo editor estendido.
  });
 }
}
w.EngefexHRExtra={page,attach};
})(window);
