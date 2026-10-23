/* Engefex: resultado parcial por obra, somente leitura. */
(function moduleEntry(root){
 'use strict';
 const fmt=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:2,maximumFractionDigits:2});
 const money=v=>fmt.format(v/100);
 const pct=v=>new Intl.NumberFormat('pt-BR',{style:'percent',maximumFractionDigits:1}).format(v||0);
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const cents=v=>{const n=Number(v||0);return Number.isFinite(n)?Math.round(n*100):0;};
 const colors={'Materiais':'#3b82f6','Mão de obra':'#8b5cf6','Despesas gerais':'#f59e0b','Outros custos':'#06b6d4'};
 const color=k=>colors[k]||colors['Outros custos'];
 const groupOf=c=>{
   if(c.laborContract||/m[aã]o\s*de\s*obra|soldador|montag/i.test(c.category||''))return 'Mão de obra';
   if(c.purchase||/materia(is|l)|insumo|telha|a[cç]o/i.test(c.category||''))return 'Materiais';
   if(c.fixedExpense||/indiret|administr|despesa\s*geral|aluguel/i.test(c.category||''))return 'Despesas gerais';
   return 'Outros custos';
 };
 const ym=x=>/^\d{4}-\d{2}/.test(String(x||''))?String(x).slice(0,7):'';
 function calculate(state,selected='all'){
   const projects=(state.projects||[]).filter(p=>selected==='all'||p.id===selected);
   const ids=new Set(projects.map(p=>p.id));
   const purchaseMap=new Map((state.purchases||[]).map(p=>[p.id,p]));
   const originalContract=projects.reduce((a,p)=>a+cents(p.value),0);
   const approvedAmendments=(state.budgetStages||[]).filter(st=>st.amendment?.kind==='contract_addendum'&&st.amendment.status==='Aprovado'&&ids.has(st.project)).reduce((sum,st)=>sum+cents(st.amendment.amount),0);
   const contract=originalContract+approvedAmendments;
   // Cada medição contém várias linhas que repetem a mesma nota fiscal.
   // Somente faturamentos diretos de medições aprovadas são abatidos.
   const batches=new Map();
   for(const m of state.measurements||[]){
     if(!ids.has(m.project)||m.number===undefined||m.number===null)continue;
     const key=JSON.stringify([m.project,String(m.number)]);
     if(!batches.has(key))batches.set(key,[]);
     batches.get(key).push(m);
   }
   const directInvoices=[],seenNotes=new Set();let duplicateDirectInvoices=0;
   for(const records of batches.values()){
     if(!records.some(m=>m.status==='Aprovada'))continue;
     const measured=records.find(m=>Array.isArray(m.directInvoices)&&m.directInvoices.length);
     if(!measured)continue;
     for(const x of measured.directInvoices){
       const amount=Math.max(0,cents(x.amount));if(!amount)continue;
       const supplier=String(x.supplier||'').trim(),invoice=String(x.invoice||'').trim();
       const date=String(x.date||'').trim(),order=String(x.order||'').trim();
       const key=JSON.stringify([measured.project,supplier.toLocaleLowerCase('pt-BR'),
         invoice.toLocaleLowerCase('pt-BR'),date,order.toLocaleLowerCase('pt-BR'),amount]);
       if(seenNotes.has(key)){duplicateDirectInvoices++;continue;}
       seenNotes.add(key);
       directInvoices.push({project:measured.project,number:measured.number,supplier,invoice,date,order,amount});
     }
   }
   const directBilling=directInvoices.reduce((sum,n)=>sum+n.amount,0);
   const netContract=contract-directBilling;
   const items=(state.costs||[]).filter(c=>ids.has(c.project)&&c.destination!=='stock'&&c.destination!=='general')
     .map(c=>{
       const total=Math.max(0,cents(c.amount)+cents(c.paymentAddition)-cents(c.paymentDiscount));
       const paid=Math.max(0,cents(c.paid));
       const when=c.purchase?(purchaseMap.get(c.purchase)?.date||c.date||c.due):c.date||c.due||c.paidDate;
       return {id:c.id,project:c.project,group:groupOf(c),amount:total,paid,when:ym(when),date:when,
         description:c.description||'Despesa cadastrada',supplier:c.supplier||'',source:c.purchase?'Nota / compra':c.laborContract?'Medição de mão de obra':c.fixedExpense?'Despesa geral':'Lançamento'};
     });
   // Apontamentos internos são custos de produção, mas não geram duplicatas em Contas a Pagar.
   const payableExpenses=items.reduce((a,x)=>a+x.amount,0),paid=items.reduce((a,x)=>a+x.paid,0);
   const crew=(state.crewAllocations||[]).filter(a=>ids.has(a.project)&&Number(a.hours)>0&&Number(a.hourlyRate)>0).map(a=>({
     id:a.id,project:a.project,group:'Mão de obra',amount:cents(a.total),paid:0,when:ym(a.date),date:a.date,
     description:'Equipe própria · '+String(a.employeeName||'Funcionário')+' · '+Number(a.hours)+' h',
     supplier:'Folha de pagamento',source:'Apontamento interno'
   }));
   const crewCost=crew.reduce((a,x)=>a+x.amount,0);
   items.push(...crew);
   const expenses=payableExpenses+crewCost;
   const receipts=(state.receipts||[]).filter(r=>ids.has(r.project))
     .map(r=>({project:r.project,amount:Math.max(0,cents(r.amount)),month:ym(r.date)}));
   const received=receipts.reduce((a,x)=>a+x.amount,0);
   const grouped=Object.keys(colors).map(key=>({name:key,color:color(key),amount:items.filter(x=>x.group===key).reduce((a,x)=>a+x.amount,0)}))
     .filter(x=>x.amount>0).sort((a,b)=>b.amount-a.amount);
   const futureLabor=(state.laborContracts||[]).filter(c=>ids.has(c.project)).reduce((a,c)=>{
     const measured=(c.measurements||[]).filter(m=>m.status==='Liberada').reduce((b,m)=>b+cents(m.amount),0);
     return a+Math.max(0,cents(c.amount)-measured);
   },0);
   const months=new Set([...items.map(x=>x.when),...receipts.map(x=>x.month)].filter(Boolean));
   const date=new Date(),fallback=Array.from({length:6},(_,i)=>{
     const dt=new Date(date.getFullYear(),date.getMonth()-5+i,1);
     return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0');
   });
   let ordered=[...months].sort().slice(-6);
   if(!ordered.length)ordered=fallback;
   const monthly=ordered.map(month=>({
     month,expense:items.filter(x=>x.when===month).reduce((a,x)=>a+x.amount,0),
     received:receipts.filter(x=>x.month===month).reduce((a,x)=>a+x.amount,0)
   }));
   const undated=items.filter(x=>!x.when).reduce((a,x)=>a+x.amount,0);
   const perProject=projects.map(p=>{
     const amount=items.filter(x=>x.project===p.id).reduce((a,x)=>a+x.amount,0);
     const value=cents(p.value)+(state.budgetStages||[]).filter(st=>st.project===p.id&&st.amendment?.status==='Aprovado'&&st.amendment?.kind==='contract_addendum').reduce((sum,st)=>sum+cents(st.amendment.amount),0);
     const direct=directInvoices.filter(x=>x.project===p.id).reduce((a,x)=>a+x.amount,0);
     return {id:p.id,name:p.name,code:p.code,contract:value,directBilling:direct,netContract:value-direct,expenses:amount,balance:value-direct-amount};
   });
   return {projects,items,contract,netContract,directBilling,directInvoices,duplicateDirectInvoices,originalContract,approvedAmendments,expenses,paid,received,result:netContract-expenses,
     margin:netContract>0?((netContract-expenses)/netContract):null,remainingToReceive:Math.max(0,netContract-received),
     outstanding:Math.max(0,payableExpenses-paid),crewCost,grouped,monthly,undated,futureLabor,perProject};
 }
 function render(state,selected='all'){
   const r=calculate(state,selected);
   if(!r.projects.length)return `<section class="profit-empty"><div class="profit-empty-icon">▥</div><h2>Nenhuma obra cadastrada</h2><p>Cadastre uma obra e informe o valor contratado para começar a acompanhar os resultados.</p><a href="#projects">Abrir obras →</a></section>`;
   const safeTotal=r.netContract>0, positive=r.result>=0;
   const status=!r.items.length?'Aguardando lançamentos':r.result<0?'Saldo contratual negativo':'Saldo contratual positivo';
   const badge=!r.items.length?'neutral':positive?'positive':'negative';
   const expRatio=r.netContract>0?Math.max(0,r.expenses/r.netContract):0;
   const barWidth=r.netContract>0?Math.min(100,expRatio*100):0;
   const circle=r.expenses?(()=>{
     let at=0;
     return 'conic-gradient('+r.grouped.map(g=>{const from=at;at+=g.amount/r.expenses*100;return `${g.color} ${from.toFixed(3)}% ${at.toFixed(3)}%`;}).join(',')+')';
   })():'conic-gradient(#e6ebf2 0 100%)';
   const maxMonthly=Math.max(1,...r.monthly.flatMap(m=>[m.expense,m.received]));
   const moneyCards=[
     ['Contrato atualizado',r.contract,r.approvedAmendments?money(r.originalContract)+' original + '+money(r.approvedAmendments)+' em aditivos':'Contrato original, sem aditivos aprovados','contract'],
     ['Faturamento direto',r.directBilling,r.directInvoices.length+' notas de medições aprovadas','direct'],
     ['Contrato líquido',r.netContract,'Contrato atualizado menos faturamento direto','net'],
     ['Custos registrados',r.expenses,r.items.length+' lançamentos (inclusive equipes)','expense'],
     ['Resultado parcial',r.result,r.items.length?'Contrato líquido menos custos lançados':'Sem despesas registradas','result '+(r.result<0?'bad':'good')],
     ['Margem parcial',null,r.margin!==null?pct(r.margin)+' do contrato líquido':'Contrato líquido não positivo','margin']
   ];
   const cards=moneyCards.map(([label,val,note,cls])=>`<div class="profit-kpi ${cls}"><div class="profit-kpi-label">${label}</div><strong>${val===null?(r.margin===null?'—':pct(r.margin)):money(val)}</strong><small>${esc(note)}</small></div>`).join('');
   const maxGroup=Math.max(1,...r.grouped.map(g=>g.amount));
   const groups=r.grouped.length?r.grouped.map(g=>`<div class="profit-group-row"><div class="profit-group-meta"><span><i style="background:${g.color}"></i>${esc(g.name)}</span><strong>${money(g.amount)}</strong></div><div class="profit-group-track"><div style="background:${g.color};width:${(g.amount/maxGroup*100).toFixed(1)}%"></div></div><small>${pct(g.amount/r.expenses)} dos custos</small></div>`).join(''):'<p class="profit-no-data">As despesas aparecem aqui quando notas ou medições forem lançadas.</p>';
   const mLabel=x=>{const [y,m]=x.split('-').map(Number);return new Date(y,m-1,1).toLocaleDateString('pt-BR',{month:'short',year:'2-digit'});};
   const months=r.monthly.map(m=>`<div class="profit-month"><div class="profit-month-bars"><span class="outgoing" title="Despesas: ${money(m.expense)}" style="height:${m.expense?Math.max(4,m.expense/maxMonthly*100):0}%"></span><span class="incoming" title="Recebido: ${money(m.received)}" style="height:${m.received?Math.max(4,m.received/maxMonthly*100):0}%"></span></div><strong>${esc(mLabel(m.month))}</strong></div>`).join('');
   const recent=r.items.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,10)
     .map(c=>`<tr><td><span class="profit-small">${esc(c.source)}</span><strong>${esc(c.description)}</strong><small>${esc(c.supplier)}</small></td><td>${esc(r.projects.find(p=>p.id===c.project)?.name||'Obra')}</td><td>${esc(c.group)}</td><td class="profit-money-cell">${money(c.amount)}</td></tr>`).join('');

   const directRows=r.directInvoices.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(n=>
     '<tr><td><strong>'+esc(r.projects.find(p=>p.id===n.project)?.name||'Obra')+'</strong><small>Medição '+esc(n.number)+'</small></td>'+
     '<td>'+esc(n.invoice)+'</td><td>'+esc(n.supplier)+'</td><td>'+esc(n.order||'—')+'</td>'+
     '<td>'+esc(n.date?n.date.slice(8,10)+'/'+n.date.slice(5,7)+'/'+n.date.slice(0,4):'—')+'</td>'+
     '<td class="profit-money-cell">'+money(n.amount)+'</td></tr>').join('');
   const directPanel='<section class="profit-panel profit-direct">'+
     '<div class="profit-panel-heading"><div><span class="profit-label">FATURAMENTOS DIRETOS</span><h3>Notas abatidas do empreendimento</h3></div><strong>'+money(r.directBilling)+'</strong></div>'+
     '<div class="profit-direct-summary"><span>Contrato atualizado <strong>'+money(r.contract)+'</strong></span>'+
       '<span>Faturamento direto <strong>− '+money(r.directBilling)+'</strong></span>'+
       '<span>Contrato líquido <strong>'+money(r.netContract)+'</strong></span></div>'+
     '<p class="profit-foot">Somente notas de medições aprovadas. Não são entradas de caixa nem despesas da Engefex.</p>'+
     '<div class="profit-table-wrap"><table class="profit-table"><thead><tr><th>Obra / medição</th><th>NF</th><th>Fornecedor</th><th>Pedido</th><th>Data</th><th>Valor direto</th></tr></thead>'+
       '<tbody>'+(directRows||'<tr><td colspan="6" class="profit-no-data">Nenhum faturamento direto aprovado nesta seleção.</td></tr>')+'</tbody></table></div>'+
     (r.duplicateDirectInvoices?'<p class="profit-warn">'+r.duplicateDirectInvoices+' nota(s) repetida(s) entre medições, contada(s) uma única vez.</p>':'')+
   '</section>';
   const projects=r.perProject.map(p=>`<div class="profit-project-line"><div><strong>${esc([p.code,p.name].filter(Boolean).join(' · '))}</strong><small>Contrato ${money(p.contract)} · Faturamento direto ${money(p.directBilling)} · Líquido ${money(p.netContract)} · Custos ${money(p.expenses)}</small></div><strong class="${p.balance<0?'negative':'positive'}">${money(p.balance)}</strong></div>`).join('');
   return `<div class="profit-screen">
    <section class="profit-hero">
      <div><span class="profit-eyebrow">DESEMPENHO ECONÔMICO ${selected==='all'?'· TODAS AS OBRAS':'· POR OBRA'}</span>
        <h2>Receita <em>versus</em> despesa</h2>
        <p>Resultado do contrato atualizado, abatendo faturamentos diretos e custos registrados na obra.</p>
        <span class="profit-status ${badge}">● ${status}</span></div>
      <div class="profit-hero-result"><small>RESULTADO BRUTO PARCIAL</small><strong>${money(r.result)}</strong><span>${r.margin!==null?pct(r.margin)+' de margem parcial':'Contrato líquido não positivo'}</span></div>
    </section>
    <div class="profit-kpis">${cards}</div>
    ${directPanel}
    <section class="profit-panel profit-contract">
       <div class="profit-panel-heading"><div><span class="profit-label">CONSUMO DO CONTRATO</span><h3>Contrato líquido x despesas</h3></div><strong>${safeTotal?pct(r.expenses/r.netContract):'—'}</strong></div>
       <div class="profit-contract-track" role="img" aria-label="Despesas representam ${safeTotal?pct(r.expenses/r.netContract):'percentual indisponível'} do contrato líquido"><div style="width:${barWidth.toFixed(1)}%;background:${r.result<0?'#ee5b65':'#3b82f6'}"></div></div>
       <div class="profit-contract-legend"><span>Despesas reconhecidas ${money(r.expenses)}</span><span>Saldo parcial ${money(r.result)}</span></div>
       ${r.expenses>r.netContract&&r.netContract>0?'<p class="profit-warn">As despesas ultrapassaram o contrato líquido após faturamento direto.</p>':''}
       ${!r.items.length?'<p class="profit-warn">Nenhuma despesa cadastrada ainda. O saldo mostrado não representa lucro realizado.</p>':''}
    </section>
    <div class="profit-columns">
      <section class="profit-panel"><div class="profit-panel-heading"><div><span class="profit-label">COMPOSIÇÃO DOS CUSTOS</span><h3>Para onde vai o dinheiro?</h3></div></div>
        <div class="profit-donut-layout"><div class="profit-donut" style="background:${circle}"><div><strong>${money(r.expenses)}</strong><small>custos registrados</small></div></div>
        <div class="profit-donut-legend">${r.grouped.length?r.grouped.map(g=>`<div><i style="background:${g.color}"></i><span>${esc(g.name)}</span><strong>${pct(g.amount/r.expenses)}</strong></div>`).join(''):'<span class="profit-no-data">Sem custos lançados</span>'}</div></div>
      </section>
      <section class="profit-panel"><div class="profit-panel-heading"><div><span class="profit-label">CATEGORIAS</span><h3>Despesas detalhadas</h3></div></div><div class="profit-groups">${groups}</div></section>
    </div>
    <div class="profit-columns">
      <section class="profit-panel"><div class="profit-panel-heading"><div><span class="profit-label">FLUXO MENSAL</span><h3>Entradas e despesas lançadas</h3></div><div class="profit-legend"><span><i class="outgoing"></i>Despesas</span><span><i class="incoming"></i>Recebido</span></div></div>
       <div class="profit-monthly">${months}</div><p class="profit-foot">Datas das notas, lançamentos e recebimentos. ${r.undated?'Há custos sem data no total: '+money(r.undated)+'.':''}</p>
      </section>
      <section class="profit-panel"><div class="profit-panel-heading"><div><span class="profit-label">CONTROLE FINANCEIRO</span><h3>Caixa e compromissos</h3></div></div>
        <div class="profit-mini"><span>Recebido de clientes</span><strong>${money(r.received)}</strong></div>
        <div class="profit-mini"><span>Despesas pagas</span><strong>${money(r.paid)}</strong></div><div class="profit-mini"><span>Custo de equipes alocadas</span><strong>${money(r.crewCost)}</strong></div>
        <div class="profit-mini emphasis"><span>Fluxo líquido registrado</span><strong>${money(r.received-r.paid)}</strong></div>
        <div class="profit-mini"><span>Custos lançados ainda não pagos</span><strong>${money(r.outstanding)}</strong></div>
        <div class="profit-mini"><span>Saldo líquido ainda não recebido*</span><strong>${money(r.remainingToReceive)}</strong></div>
        <div class="profit-mini"><span>Mão de obra contratada ainda não liberada</span><strong>${money(r.futureLabor)}</strong></div>
        <p class="profit-foot">*Estimativa baseada no contrato líquido, não em medições aprovadas. Compromissos futuros não entram nas despesas lançadas.</p>
      </section>
    </div>
    ${selected==='all'&&r.projects.length>1?`<section class="profit-panel"><div class="profit-panel-heading"><div><span class="profit-label">COMPARAÇÃO</span><h3>Resultado por obra</h3></div></div><div class="profit-projects">${projects}</div></section>`:''}
    <section class="profit-panel"><div class="profit-panel-heading"><div><span class="profit-label">RASTREABILIDADE</span><h3>Últimos lançamentos de despesas</h3></div><span class="profit-counter">${r.items.length} lançamentos</span></div>
      <div class="profit-table-wrap"><table class="profit-table"><thead><tr><th>Origem / descrição</th><th>Obra</th><th>Categoria</th><th>Valor</th></tr></thead><tbody>${recent||'<tr><td colspan="4" class="profit-no-data">Nenhuma nota, medição de mão de obra ou despesa vinculada ainda.</td></tr>'}</tbody></table></div>
    </section>
    <p class="profit-disclaimer"><strong>Critério de cálculo:</strong> resultado parcial = contratos originais + aditivos aprovados − faturamentos diretos de medições aprovadas − despesas vinculadas à obra − custo de equipes próprias apontadas. Equipes integram o resultado gerencial, mas não são despesas pagas nem contas a pagar. Notas confirmadas com rateio e medições de mão de obra liberadas já geram contas em <em>Contas a Pagar</em>; por isso, não são somadas novamente. Faturamento direto não é entrada de caixa nem despesa da Engefex. Se uma nota direta também estiver cadastrada como custo próprio, revise-a para evitar desconto duplicado. Descontos e acréscimos de pagamento são considerados. Compras do estoque e despesas gerais ainda não atribuídas a uma obra ficam fora. Não é lucro líquido contábil: impostos, retenções, custos futuros e despesas não lançadas podem mudar o resultado.</p>
   </div>`;
 }
 const api={calculate,render};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.EngefexProjectProfit=api;
})(typeof window==="undefined"?globalThis:window);
