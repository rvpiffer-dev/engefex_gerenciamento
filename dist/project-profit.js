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
   const contract=projects.reduce((a,p)=>a+cents(p.value),0);
   const items=(state.costs||[]).filter(c=>ids.has(c.project)&&c.destination!=='stock'&&c.destination!=='general')
     .map(c=>{
       const total=Math.max(0,cents(c.amount)+cents(c.paymentAddition)-cents(c.paymentDiscount));
       const paid=Math.max(0,cents(c.paid));
       const when=c.purchase?(purchaseMap.get(c.purchase)?.date||c.date||c.due):c.date||c.due||c.paidDate;
       return {id:c.id,project:c.project,group:groupOf(c),amount:total,paid,when:ym(when),date:when,
         description:c.description||'Despesa cadastrada',supplier:c.supplier||'',source:c.purchase?'Nota / compra':c.laborContract?'Medição de mão de obra':c.fixedExpense?'Despesa geral':'Lançamento'};
     });
   const expenses=items.reduce((a,x)=>a+x.amount,0),paid=items.reduce((a,x)=>a+x.paid,0);
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
     const value=cents(p.value);
     return {id:p.id,name:p.name,code:p.code,contract:value,expenses:amount,balance:value-amount};
   });
   return {projects,items,contract,expenses,paid,received,result:contract-expenses,
     margin:contract?((contract-expenses)/contract):null,remainingToReceive:Math.max(0,contract-received),
     outstanding:Math.max(0,expenses-paid),grouped,monthly,undated,futureLabor,perProject};
 }
 function render(state,selected='all'){
   const r=calculate(state,selected);
   if(!r.projects.length)return `<section class="profit-empty"><div class="profit-empty-icon">▥</div><h2>Nenhuma obra cadastrada</h2><p>Cadastre uma obra e informe o valor contratado para começar a acompanhar os resultados.</p><a href="#projects">Abrir obras →</a></section>`;
   const safeTotal=r.contract>0, positive=r.result>=0;
   const status=!r.items.length?'Aguardando lançamentos':r.result<0?'Custos acima do contrato':'Saldo contratual positivo';
   const badge=!r.items.length?'neutral':positive?'positive':'negative';
   const expRatio=r.contract>0?Math.max(0,r.expenses/r.contract):0;
   const barWidth=r.contract>0?Math.min(100,expRatio*100):0;
   const circle=r.expenses?(()=>{
     let at=0;
     return 'conic-gradient('+r.grouped.map(g=>{const from=at;at+=g.amount/r.expenses*100;return `${g.color} ${from.toFixed(3)}% ${at.toFixed(3)}%`;}).join(',')+')';
   })():'conic-gradient(#e6ebf2 0 100%)';
   const maxMonthly=Math.max(1,...r.monthly.flatMap(m=>[m.expense,m.received]));
   const moneyCards=[
     ['Valor do contrato',r.contract,'Base da receita prevista','contract'],
     ['Despesas lançadas',r.expenses,r.items.length+' lançamentos de custo','expense'],
     ['Resultado parcial',r.result,r.items.length?'Contrato menos custos lançados':'Sem despesas registradas','result '+(r.result<0?'bad':'good')],
     ['Margem parcial',null,r.contract?pct(r.margin)+' do contrato':'Contrato não informado','margin']
   ];
   const cards=moneyCards.map(([label,val,note,cls])=>`<div class="profit-kpi ${cls}"><div class="profit-kpi-label">${label}</div><strong>${val===null?(r.margin===null?'—':pct(r.margin)):money(val)}</strong><small>${esc(note)}</small></div>`).join('');
   const maxGroup=Math.max(1,...r.grouped.map(g=>g.amount));
   const groups=r.grouped.length?r.grouped.map(g=>`<div class="profit-group-row"><div class="profit-group-meta"><span><i style="background:${g.color}"></i>${esc(g.name)}</span><strong>${money(g.amount)}</strong></div><div class="profit-group-track"><div style="background:${g.color};width:${(g.amount/maxGroup*100).toFixed(1)}%"></div></div><small>${pct(g.amount/r.expenses)} dos custos</small></div>`).join(''):'<p class="profit-no-data">As despesas aparecem aqui quando notas ou medições forem lançadas.</p>';
   const mLabel=x=>{const [y,m]=x.split('-').map(Number);return new Date(y,m-1,1).toLocaleDateString('pt-BR',{month:'short',year:'2-digit'});};
   const months=r.monthly.map(m=>`<div class="profit-month"><div class="profit-month-bars"><span class="outgoing" title="Despesas: ${money(m.expense)}" style="height:${m.expense?Math.max(4,m.expense/maxMonthly*100):0}%"></span><span class="incoming" title="Recebido: ${money(m.received)}" style="height:${m.received?Math.max(4,m.received/maxMonthly*100):0}%"></span></div><strong>${esc(mLabel(m.month))}</strong></div>`).join('');
   const recent=r.items.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,10)
     .map(c=>`<tr><td><span class="profit-small">${esc(c.source)}</span><strong>${esc(c.description)}</strong><small>${esc(c.supplier)}</small></td><td>${esc(r.projects.find(p=>p.id===c.project)?.name||'Obra')}</td><td>${esc(c.group)}</td><td class="profit-money-cell">${money(c.amount)}</td></tr>`).join('');
   const projects=r.perProject.map(p=>`<div class="profit-project-line"><div><strong>${esc([p.code,p.name].filter(Boolean).join(' · '))}</strong><small>Contrato ${money(p.contract)} · Custos ${money(p.expenses)}</small></div><strong class="${p.balance<0?'negative':'positive'}">${money(p.balance)}</strong></div>`).join('');
   return `<div class="profit-screen">
    <section class="profit-hero">
      <div><span class="profit-eyebrow">DESEMPENHO ECONÔMICO ${selected==='all'?'· TODAS AS OBRAS':'· POR OBRA'}</span>
        <h2>Receita <em>versus</em> despesa</h2>
        <p>Quanto do valor contratado ainda resta depois dos custos lançados na obra.</p>
        <span class="profit-status ${badge}">● ${status}</span></div>
      <div class="profit-hero-result"><small>RESULTADO BRUTO PARCIAL</small><strong>${money(r.result)}</strong><span>${r.contract?pct(r.margin)+' de margem parcial':'Defina o valor do contrato'}</span></div>
    </section>
    <div class="profit-kpis">${cards}</div>
    <section class="profit-panel profit-contract">
       <div class="profit-panel-heading"><div><span class="profit-label">CONSUMO DO CONTRATO</span><h3>Contrato x despesas</h3></div><strong>${safeTotal?pct(r.expenses/r.contract):'—'}</strong></div>
       <div class="profit-contract-track" role="img" aria-label="Despesas representam ${safeTotal?pct(r.expenses/r.contract):'percentual indisponível'} do valor contratado"><div style="width:${barWidth.toFixed(1)}%;background:${r.result<0?'#ee5b65':'#3b82f6'}"></div></div>
       <div class="profit-contract-legend"><span>Despesas reconhecidas ${money(r.expenses)}</span><span>Saldo parcial ${money(r.result)}</span></div>
       ${r.expenses>r.contract&&r.contract>0?'<p class="profit-warn">As despesas ultrapassaram o valor do contrato.</p>':''}
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
        <div class="profit-mini"><span>Despesas pagas</span><strong>${money(r.paid)}</strong></div>
        <div class="profit-mini emphasis"><span>Fluxo líquido registrado</span><strong>${money(r.received-r.paid)}</strong></div>
        <div class="profit-mini"><span>Custos lançados ainda não pagos</span><strong>${money(r.outstanding)}</strong></div>
        <div class="profit-mini"><span>Saldo contratual ainda não recebido*</span><strong>${money(r.remainingToReceive)}</strong></div>
        <div class="profit-mini"><span>Mão de obra contratada ainda não liberada</span><strong>${money(r.futureLabor)}</strong></div>
        <p class="profit-foot">*Estimativa baseada no valor do contrato, não em medições aprovadas. Compromissos futuros não entram nas despesas lançadas.</p>
      </section>
    </div>
    ${selected==='all'&&r.projects.length>1?`<section class="profit-panel"><div class="profit-panel-heading"><div><span class="profit-label">COMPARAÇÃO</span><h3>Resultado por obra</h3></div></div><div class="profit-projects">${projects}</div></section>`:''}
    <section class="profit-panel"><div class="profit-panel-heading"><div><span class="profit-label">RASTREABILIDADE</span><h3>Últimos lançamentos de despesas</h3></div><span class="profit-counter">${r.items.length} lançamentos</span></div>
      <div class="profit-table-wrap"><table class="profit-table"><thead><tr><th>Origem / descrição</th><th>Obra</th><th>Categoria</th><th>Valor</th></tr></thead><tbody>${recent||'<tr><td colspan="4" class="profit-no-data">Nenhuma nota, medição de mão de obra ou despesa vinculada ainda.</td></tr>'}</tbody></table></div>
    </section>
    <p class="profit-disclaimer"><strong>Critério de cálculo:</strong> resultado parcial = soma dos valores contratuais − soma das contas de custo vinculadas à obra. Notas confirmadas com rateio e medições de mão de obra liberadas já geram contas em <em>Contas a Pagar</em>; por isso, não são somadas novamente. Descontos e acréscimos de pagamento são considerados. Compras do estoque e despesas gerais ainda não atribuídas a uma obra ficam fora. Não é lucro líquido contábil: impostos, retenções, custos futuros e despesas não lançadas podem mudar o resultado.</p>
   </div>`;
 }
 const api={calculate,render};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.EngefexProjectProfit=api;
})(typeof window==="undefined"?globalThis:window);
