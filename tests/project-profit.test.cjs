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
console.log('Project profit: 12 verificações aprovadas.');
