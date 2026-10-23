/* Visão resumida da folha. Mantém formulário e persistência existentes. */
(function(w){'use strict';
const original=w.EngefexHRExtra;
const esc=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const n=v=>typeof v==='number'?v:Number(String(v??'').replace(',','.'))||0;
const money=v=>v==null||v===''?'—':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n(v));
const labels=['Nome','Valor do Salário','Hora extra','INSALUBRIDADE','Vale 40%','Uniodonto','Farmácia','Faltas','Pensão','Vales','INSS','I.R','CARTÃO','TOTAL','TOTAL COM O CARTÃO'];
const name=r=>String(r.employeeName||r.values?.A||'').trim();
const normalized=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\([^)]*\)/g,'').replace(/\s+/g,' ').trim().toLocaleLowerCase('pt-BR');
const hours=r=>n(r.monthlyHours)>0?n(r.monthlyHours):220;
const cost=r=>(n(r.values?.B)+n(r.employerCosts))/hours(r);
function page(s,v){
 if(v!=='hr-payroll')return original.page(s,v);
 return original.page(s,v).replace('<h1>Folha de pagamento</h1>','<h1>Folha de pagamento</h1>');
}
function attach(s,persist,render,notify,v){
 original.attach(s,persist,render,notify,v);
 if(v!=='hr-payroll')return;
 const tabs=document.querySelectorAll('[data-rh-aba]');tabs.forEach(b=>b.remove());
 const table=document.querySelector('.hr-table-wrap table');
 if(!table)return;
 const month=document.getElementById('rhMonth')?.value||new Date().toISOString().slice(0,7);
 const activeTab=document.querySelector('[data-rh-aba].primary')?.dataset.rhAba||'sal';
 const current=(s[activeTab==='vale'?'hrPayrollVale':'hrPayroll']||[]).filter(r=>r.period===month);
 const salary=(s.hrPayroll||[]).filter(r=>r.period===month);
 const vales=(s.hrPayrollVale||[]).filter(r=>r.period===month);
 const originalRows=[...table.querySelectorAll('tbody tr')];
 // Preserve as ações originalmente registradas, inclusive listeners do holerite.
 const byId=new Map(current.map(r=>[String(r.id),r]));
 const originalButtons=new Map(originalRows.map(tr=>{
  const edit=tr.querySelector('[data-rh-edit]');
  return edit?[edit.dataset.rhEdit,{edit,del:tr.querySelector('[data-rh-del]'),print:tr.querySelector('[data-rh-print]')}]:null;
 }).filter(Boolean));
 const tableHead=table.querySelector('thead');const tableBody=table.querySelector('tbody');
 tableHead.innerHTML='<tr><th>NOME</th><th>SALÁRIO CHEIO</th><th>DESCONTO</th><th>RECEBIMENTO DIA 5</th><th>RECEBIMENTO DIA 20</th><th>CUSTO/HORA</th><th>AÇÕES</th></tr>';
 table.style.minWidth='1100px';tableBody.innerHTML='';
 const details=document.createElement('dialog');
 details.className='hr-editor';details.id='payDetails';
 details.innerHTML='<div class="hr-editor-header"><h2 id="payDetailsTitle">Informações completas</h2><button class="button secondary" type="button" id="payDetailsClose">Fechar</button></div><div class="hr-table-wrap" id="payDetailsContent" style="max-height:72vh;overflow:auto"></div>';
 document.body.appendChild(details);
 details.querySelector('#payDetailsClose').onclick=()=>details.close();
 for(const tr of originalRows){
  const id=tr.querySelector('[data-rh-edit]')?.dataset.rhEdit;
  const row=byId.get(id);if(!row)continue;
  const rname=name(row),sal=activeTab==='sal'?row:salary.find(x=>normalized(name(x))===normalized(rname));
  const vale=activeTab==='vale'?row:vales.find(x=>normalized(name(x))===normalized(rname));
  const discount=sal?['F','G','H','I','J','K','L'].reduce((sum,k)=>sum+n(sal.values?.[k]),0):null;
  const day5=sal?.values?.N;
  const day20=vale?.values?.C??sal?.values?.E;
  const cells=[rname,sal?.values?.B,discount,day5,day20,sal?cost(sal):null];
  const rendered=document.createElement('tr');
  rendered.innerHTML=cells.map((x,i)=>'<td>'+ (i===0?esc(x):money(x))+'</td>').join('')+
   '<td style="white-space:nowrap"><button class="button secondary" type="button" data-action="view">Visualizar</button> <button class="button secondary" type="button" data-action="print">Holerite</button> <button class="button secondary" type="button" data-action="edit">Editar</button> <button class="button secondary" type="button" data-action="del">Excluir</button></td>';
  tableBody.appendChild(rendered);
  const actions=originalButtons.get(id)||{};
  rendered.querySelector('[data-action="edit"]').onclick=()=>actions.edit?.click();
  rendered.querySelector('[data-action="del"]').onclick=()=>actions.del?.click();
  rendered.querySelector('[data-action="print"]').onclick=()=>actions.print?.click();
  rendered.querySelector('[data-action="view"]').onclick=()=>{
   const records=[['Salário',sal,labels],['Vale',vale,['Nome','SALÁRIO','VALE 40%']]];
   const sections=records.map(([title,item,fields])=>{
    if(!item)return '<h3>'+title+'</h3><p>Sem lançamento nessa aba para a competência.</p>';
    const tableRows=fields.map((label,i)=>{const k=String.fromCharCode(65+i),value=k==='A'?name(item):item.values?.[k];return '<tr><th>'+esc(label)+'</th><td>'+ (k==='A'?esc(value):money(value))+'</td></tr>'}).join('');
    return '<h3>'+title+'</h3><table class="hr-data-table"><tbody>'+tableRows+'</tbody></table>';
   }).join('');
   const extra=sal?'<h3>Custo por hora</h3><table class="hr-data-table"><tbody><tr><th>Jornada padrão</th><td>44 horas semanais</td></tr><tr><th>Horas mensais adotadas</th><td>'+hours(sal)+' h</td></tr><tr><th>Encargos extras informados</th><td>'+money(n(sal.employerCosts))+'</td></tr><tr><th>Custo/hora estimado</th><td>'+money(cost(sal))+'</td></tr></tbody></table>':'';
   details.querySelector('#payDetailsTitle').textContent=rname+' · '+month;
   const card=(label,value)=>'<div style="display:flex;justify-content:space-between;align-items:baseline;gap:14px;padding:10px 12px;border-bottom:1px solid #e2e8f0"><span style="color:#475569;font-weight:600;flex:1;min-width:0;overflow-wrap:anywhere">'+esc(label)+'</span><strong style="text-align:right;white-space:normal;overflow-wrap:anywhere">'+value+'</strong></div>';
   const group=(title,item,fields)=>'<section style="background:#fff;border:1px solid #dbe3ee;border-radius:12px;overflow:hidden;margin:0 0 14px"><h3 style="margin:0;padding:12px 14px;background:#eaf1fa;color:#173b64">'+esc(title)+'</h3>'+(item?fields.map((label,i)=>{const k=String.fromCharCode(65+i),val=k==='A'?esc(name(item)):money(item.values?.[k]);return card(label,val)}).join(''):'<p style="padding:12px">Sem lançamento registrado.</p>')+'</section>';
   details.querySelector('#payDetailsContent').innerHTML=group('Salário · todos os campos',sal,labels)+group('Vale · todos os campos',vale,['Nome','Salário','Vale 40%'])+(sal?'<section style="background:#fff;border:1px solid #dbe3ee;border-radius:12px;overflow:hidden"><h3 style="margin:0;padding:12px 14px;background:#eaf1fa;color:#173b64">Custo por hora</h3>'+card('Jornada semanal','44 h')+card('Horas mensais',hours(sal)+' h')+card('Encargos adicionais',money(n(sal.employerCosts)))+card('Custo/hora estimado',money(cost(sal)))+'</section>':'');
   details.style.width='min(760px, calc(100vw - 24px))';details.style.maxWidth='none';details.style.maxHeight='92vh';details.style.boxSizing='border-box';details.style.overflow='hidden';
   details.querySelector('#payDetailsContent').style.cssText='max-height:calc(90vh - 115px);overflow-y:auto;overflow-x:hidden;padding:12px;background:#f7f9fc;box-sizing:border-box;width:100%';
   const header=details.querySelector('.hr-editor-header');if(header){header.style.cssText='display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding:18px';header.querySelector('h2').style.cssText='font-size:clamp(16px,2.5vw,22px);margin:0;overflow-wrap:anywhere;flex:1;min-width:0'}

   details.showModal();
  };
 }
 // "Situação" não é um campo útil nesta planilha: removê-la de toda a interface.
 const status=document.getElementById('rhStatus');
 status?.closest('label')?.remove();
 const editor=document.getElementById('rhPayDialog');
 // O campo antigo fica oculto para não interferir no formulário e preservar o dado interno.
 const hideEditorStatus=()=>{const field=editor?.querySelector('select[name="status"]');field?.closest('label')?.setAttribute('hidden','')};
 document.querySelectorAll('[data-action="edit"]').forEach(b=>b.addEventListener('click',hideEditorStatus));
 document.getElementById('rhAdd')?.addEventListener('click',hideEditorStatus);
 // Descarta o diálogo anterior ao redesenhar para evitar modais duplicados.
 const oldCleanup=details.close.bind(details);
 details.addEventListener('close',()=>{oldCleanup();details.remove()},{once:true});
}
w.EngefexHRExtra={page,attach};
})(window);
