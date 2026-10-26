/* Testes de regressão do fechamento de fornecedores. */
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const ROOT=path.join(__dirname,'..','dist');
let sequence=0;
const copy=x=>JSON.parse(JSON.stringify(x));
const window={
 crypto:{randomUUID:()=>String(++sequence)},
 Obras:{
  clone:copy,
  date:s=>new Date(s+'T12:00:00'),
  today:()=> '2026-10-26',
  validateRecord:()=>{},
  costTotal:c=>Math.round((c.amount+(c.paymentAddition||0)-(c.paymentDiscount||0))*100)/100,
  costBalance:c=>Math.max(0,Math.round((c.amount+(c.paymentAddition||0)-(c.paymentDiscount||0)-(c.paid||0))*100)/100),
  registerCostPayment:(s,id,input)=>{
   const result=copy(s),c=result.costs.find(x=>x.id===id),remaining=window.Obras.costBalance(c);
   const delta=Math.round((input.amount-remaining)*100)/100;
   if(input.mode==='settle'){
    c.paymentDiscount=Math.round(((c.paymentDiscount||0)+Math.max(0,-delta))*100)/100;
    c.paymentAddition=Math.round(((c.paymentAddition||0)+Math.max(0,delta))*100)/100;
   }
   c.paid=Math.round(((c.paid||0)+input.amount)*100)/100;c.paidDate=input.date;return result;
  }
 }
};
const context={window,document:{querySelector:()=>null},crypto:window.crypto,console};
for(const file of ['purchases.js','purchase-groups.js','payables.js']){
 const script=fs.readFileSync(path.join(ROOT,file),'utf8');
 vm.runInNewContext(script,context,{filename:file});
}
const P=window.EngefexPurchases,G=window.EngefexPurchaseGroups,F=window.EngefexPayables;
function note(id,project,stage,amount,supplier='Marson'){
 return {id,project,destination:'work',kind:'Nota fiscal',number:id,series:'1',supplier,supplierDocument:supplier==='Marson'?'12345678000199':'98765432100000',date:'2026-10-01',status:'Rascunho',accessKey:'',adjustment:0,items:[{id:'item-'+id,description:'Ferro',unit:'un',quantity:1,unitPrice:amount,total:amount,allocations:[{project,stage,share:100}]}],installments:[{id:'original-'+id,number:'1',due:'2026-11-15',amount}],attachments:[]};
}
function seed(){
 let state={projects:[{id:'o1',name:'Obra 1'},{id:'o2',name:'Obra 2'}],budgetStages:[{id:'e1',project:'o1'},{id:'e2',project:'o2'}],budgetItems:[],costs:[],purchases:[],history:[],suppliers:[]};
 for(const n of [note('N1','o1','e1',1250),note('N2','o2','e2',875),note('N3','o1','e1',2150),note('OUTRO','o1','e1',100,'Outro Fornecedor'),{...note('CONFIRMADA','o1','e1',200,'Fornecedor já confirmado'),status:'Confirmada'}])state=P.save(state,n);
 return state;
}
const boletos=[{due:'2026-11-15',amount:1400},{due:'2026-12-15',amount:1500},{due:'2027-01-15',amount:1375}];
const ids=['N1','N2','N3'];
test('Agrupar notas gera boletos únicos e preserva custos por obra',()=>{
 const state=seed();
 assert.equal(state.purchases.filter(p=>p.status==='Rascunho').length,4);
 assert.equal(state.costs.length,1,'rascunhos ainda não geraram contas a pagar');
 const grouped=G.create(state,ids,boletos);
 const meta=G.findGroup(grouped,grouped.purchases.find(p=>p.id==='N1').paymentGroupId);
 assert.ok(meta&&meta.code.startsWith('FEC-'));
 assert.equal(grouped.purchasePaymentGroups,undefined,'não criar chave nova fora da área autorizada pelo Supabase');
 assert.equal(grouped.purchases.filter(p=>p.paymentGroupId===meta.id).length,3);
 assert.equal(grouped.purchases.filter(p=>p.paymentGroupId===meta.id&&p.status==='Confirmada').length,3,'confirmação ocorre na criação dos boletos');
 assert.equal(state.purchases.filter(p=>p.status==='Rascunho').length,4,'não altera o estado original até confirmar');
 assert.equal(grouped.purchases.find(p=>p.id==='OUTRO').status,'Rascunho');
 assert.equal(grouped.purchases.find(p=>p.id==='CONFIRMADA').paymentGroupId,undefined);
 const groupedRows=F.groups(grouped).filter(p=>p.paymentGroupId===meta.id);
 assert.equal(groupedRows.length,3);
 assert.deepEqual(Array.from(groupedRows,p=>Math.round(p.amount*100)),boletos.map(p=>Math.round(p.amount*100)));
 assert.equal(F.groups(grouped).length,4,'nota já confirmada fica individual; o outro rascunho segue sem contas');
 for(const [id,amt] of [['N1',1250],['N2',875],['N3',2150]]){
  const sum=grouped.costs.filter(c=>c.purchase===id).reduce((n,c)=>n+c.amount,0);
  assert.equal(Math.round(sum*100),amt*100);
 }
});
test('Desfazer restaura as parcelas originais sem cancelar as notas',()=>{
 const state=seed(),grouped=G.create(state,ids,boletos);
 const id=grouped.purchases.find(p=>p.id==='N1').paymentGroupId,restored=G.undo(grouped,id);
 assert.equal(F.groups(restored).length,1,'boletos gerados ao agrupar são removidos do financeiro');
 for(const original of state.purchases){
  const row=restored.purchases.find(p=>p.id===original.id);
  assert.equal(row.paymentGroupId,undefined);
  assert.equal(row.paymentGroupMeta,undefined);
  assert.equal(row.paymentGroupOriginalStatus,undefined);
  assert.equal(row.status,original.status,'desfazer retorna a cada estado original');
  assert.equal(JSON.stringify(row.installments),JSON.stringify(original.installments));
 }
});
test('Bloquear notas de outro fornecedor, edição, exclusão e desagrupamento pago',()=>{
 const state=seed();
 assert.throws(()=>G.create(state,['N1','OUTRO'],[{due:'2026-11-15',amount:1350}]),/fornecedor|CNPJ/i);
 assert.throws(()=>G.create(state,['N1','CONFIRMADA'],[{due:'2026-11-15',amount:1450}]),/Rascunho/i);
 const grouped=G.create(state,ids,boletos),p=grouped.purchases.find(x=>x.id==='N1');
 assert.throws(()=>P.save(grouped,p),/fechamento/i);
 assert.throws(()=>P.remove(grouped,p.id),/fechamento/i);
 const first=F.groups(grouped).find(x=>x.paymentGroupId),paid=F.togglePaid(grouped,first.id);
 assert.equal(Math.round(F.groups(paid).find(x=>x.id===first.id).paid*100),140000);
 assert.throws(()=>G.undo(paid,p.paymentGroupId),/pagamento|incorrido/i);
});

test('Rascunhos só geram dívida quando todas as informações do fechamento são válidas',()=>{
 const state=seed();
 assert.throws(()=>G.create(state,ids,[{due:'',amount:4275}]),/vencimentos/i);
 assert.throws(()=>G.create(state,ids,[{due:'2026-11-15',amount:4000}]),/soma/i);
 const invalid=copy(state),n=invalid.purchases.find(p=>p.id==='N2');
 delete n.items[0].allocations;
 assert.throws(()=>G.create(invalid,ids,boletos),/N2.*rateio|N2.*orçamento|N2.*etapa/i);
 assert.equal(invalid.purchases.find(p=>p.id==='N2').status,'Rascunho');
 assert.equal(invalid.costs.length,1,'fechamento inválido não mexe no financeiro existente');
});
test('Seleção na interface habilita apenas rascunhos não agrupados',()=>{
 const s=seed();
 assert.match(G.selectCell(s.purchases.find(p=>p.id==='N1')),/data-purchase-group-select/);
 assert.doesNotMatch(G.selectCell(s.purchases.find(p=>p.id==='N1')),/\sdisabled/);
 assert.match(G.selectCell(s.purchases.find(p=>p.id==='CONFIRMADA')),/disabled/);
 const grouped=G.create(s,ids,boletos);
 assert.match(G.selectCell(grouped.purchases.find(p=>p.id==='N1')),/disabled/);
});
