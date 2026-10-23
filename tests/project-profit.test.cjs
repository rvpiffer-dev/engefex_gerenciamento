'use strict';
/* Execute com: node tests/project-profit.test.cjs */
const assert=require('node:assert/strict');
const {calculate,render}=require('../dist/project-profit.js');
const state={
 projects:[{id:'A',name:'Obra A',value:100000},{id:'B',name:'Obra B',value:200000}],
 purchases:[{id:'NF1',date:'2026-10-10'}],
 laborContracts:[{id:'L1',project:'A',amount:8000,measurements:[{id:'M1',status:'Liberada',amount:2000},{id:'M2',status:'Pendente',amount:6000}]}],
 costs:[
  {id:'NF1-1',project:'A',purchase:'NF1',purchaseInstallment:'P1',amount:7000,paid:2000,category:'Materiais'},
  {id:'NF1-2',project:'B',purchase:'NF1',purchaseInstallment:'P1',amount:3000,paid:1000,category:'Materiais'},
  {id:'L1-M1',project:'A',laborContract:'L1',laborMeasurement:'M1',amount:2000,paid:300},
  {id:'c4',project:'A',amount:1000,paymentDiscount:100,paid:1000,category:'Equipamento'},
  {id:'geral',project:'Geral',amount:90000},
  {id:'estoque',project:'A',destination:'stock',amount:90000}
 ],
 receipts:[{project:'A',amount:45000,date:'2026-10-12'},{project:'B',amount:100000,date:'2026-09-12'}]
};
const a=calculate(state,'A'),b=calculate(state,'B'),all=calculate(state,'all');
assert.equal(a.contract,10000000);
assert.equal(a.expenses,990000);
assert.equal(a.result,9010000);
assert.equal(a.paid,330000);
assert.equal(a.received,4500000);
assert.equal(a.futureLabor,600000);
assert.equal(b.expenses,300000);
assert.equal(all.expenses,1290000);
assert.equal(all.result,28710000);
assert.ok(render(state,'A').includes('profit-donut'));
assert.ok(render(state,'A').includes('profit-monthly'));
assert.ok(render({projects:[{id:'A',name:'Obra A',value:100000}],costs:[]},'A').includes('não representa lucro realizado'));

const withBilling=JSON.parse(JSON.stringify(state));
const n1={date:'2026-10-13',supplier:'Fornecedor A',invoice:'123',order:'PC1',amount:2000};
const n2={date:'2026-10-14',supplier:'Fornecedor B',invoice:'124',order:'PC2',amount:3000};
withBilling.measurements=[
 {project:'A',number:'MED001',status:'Aprovada',directInvoices:[n1]},
 {project:'A',number:'MED001',status:'Aprovada',directInvoices:[n1]},
 {project:'A',number:'MED002',status:'Aprovada',directInvoices:[n1,n2]},
 {project:'B',number:'MED003',status:'Aprovada',directInvoices:[{...n1,amount:4000}]},
 {project:'A',number:'MED004',status:'Preparada',plannedDirectInvoices:[{...n1,invoice:'PENDENTE',amount:5000}]}
];
const billA=calculate(withBilling,'A'),billB=calculate(withBilling,'B'),billAll=calculate(withBilling,'all');
assert.equal(billA.contract,10000000);
assert.equal(billA.directBilling,500000);
assert.equal(billA.netContract,9500000);
assert.equal(billA.result,8510000);
assert.equal(billA.expenses,a.expenses);
assert.equal(billA.received,a.received);
assert.equal(billA.remainingToReceive,5000000);
assert.equal(billA.margin,billA.result/billA.netContract);
assert.equal(billA.directInvoices.length,2);
assert.equal(billA.duplicateDirectInvoices,1);
assert.equal(billB.directBilling,400000);
assert.equal(billAll.directBilling,900000);
assert.equal(billAll.netContract,29100000);
assert.equal(billAll.perProject[0].directBilling,500000);
assert.ok(render(withBilling,'A').includes('Notas abatidas do empreendimento'));
assert.ok(render(withBilling,'A').includes('MED001'));
assert.ok(render(withBilling,'A').includes('Contrato líquido'));
assert.equal(calculate({...withBilling,measurements:[]},'A').directBilling,0);
console.log('Project profit: verificações do faturamento direto aprovadas.');
