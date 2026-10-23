'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const context={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist/crew-allocations.js'),'utf8'),context);
const crew=context.window.EngefexCrew;
const {calculate}=require('../dist/project-profit.js');
const state={
 projects:[{id:'a',name:'Obra A',value:100000},{id:'b',name:'Obra B',value:50000}],
 hrEmployees:[{id:'e1',name:'Ana Pereira',role:'Montadora',active:true},{id:'e2',name:'Bruno Lima',role:'Soldador',active:false}],
 hrPayroll:[{id:'rh1',period:'2026-09',employeeId:'e1',employeeName:'Ana Pereira',values:{B:2200},employerCosts:440,monthlyHours:220},
 {id:'rh2',period:'2026-11',employeeId:'e1',employeeName:'Ana Pereira',values:{B:10000},employerCosts:2000,monthlyHours:220}],
 crewAllocations:[{id:'x1',project:'a',date:'2026-10-22',employeeId:'e1',employeeName:'Ana Pereira',hours:8,hourlyRate:12,payrollPeriod:'2026-09',total:96}],
 costs:[{id:'pay1',project:'a',amount:2000,paid:1500}],
 purchases:[],receipts:[],budgetStages:[],laborContracts:[]
};
test('Custo por hora inclui encargos e ignora folha futura',()=>{
 assert.equal(crew.rateOf(state,{id:'e1',name:'Ana Pereira'},'2026-10-23').rate,12);
 assert.equal(crew.rateOf(state,{id:'e1',name:'Ana Pereira'},'2026-08-23'),null);
 assert.equal(crew.rateOf(state,{id:'e2',name:'Bruno Lima'},'2026-10-23'),null);
});
test('Apontamento conserva custo/hora histórico e separa por obra/data',()=>{
 assert.equal(crew.summary(state,'a').cost,96);
 assert.equal(crew.summary(state,'b').cost,0);
 assert.equal(crew.forDay(state,'a','2026-10-22').length,1);
 const html=crew.page(state,'a');
 assert.match(html,/Alocação diária de equipes/);
 assert.match(html,/Ana Pereira/);
 assert.doesNotMatch(html,/Bruno Lima/);
 assert.match(html,/8/);
});
test('Resultado por obra inclui equipe sem gerar pagamento duplicado',()=>{
 const a=calculate(state,'a'),b=calculate(state,'b');
 assert.equal(a.crewCost,9600);
 assert.equal(a.expenses,209600);
 assert.equal(a.paid,150000);
 assert.equal(a.outstanding,50000);
 assert.equal(b.crewCost,0);
});

test('Interação facilitada no celular possui seleção acessível, horas e atalhos',()=>{
 const html=crew.page(state,'a');
 assert.match(html,/id="crewPrevDate"/);
 assert.match(html,/id="crewNextDate"/);
 assert.match(html,/id="crewCopyPrevious"/);
 assert.match(html,/id="crewSaveCount"/);
 assert.match(html,/id="crewSaveTotal"/);
 assert.match(html,/data-crew-step="1"/);
 assert.match(html,/data-crew-step="-1"/);
 assert.match(html,/for="crew-employee-e1"/);
 assert.match(html,/inputmode="decimal"/);
});
