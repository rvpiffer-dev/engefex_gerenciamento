const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
function setup(){let w={crypto:require('node:crypto').webcrypto};w.window=w;vm.createContext(w);for(let f of ['currency.js','data.js','domain.js','manager.js','measurement-sheet.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist',f),'utf8'),w);let D=w.Obras,M=w.EngefexManager,F=w.EngefexMeasurementSheet,s=M.separate(D.clone(w.OBRAS_SEED));s.projects=[{id:'p',name:'Obra'},{id:'q',name:'Outra'}];s.budgetStages=[{...M.defaults('budgetStages','p'),id:'b',name:'Etapa orçada'},{...M.defaults('budgetStages','q'),id:'bq',name:'Outra etapa'}];s.budgetItems=[{...M.defaults('budgetItems','p'),id:'a',stage:'b',name:'Concreto',code:'1.1',quantity:100,unit:'m³',sale:1000},{...M.defaults('budgetItems','p'),id:'b',stage:'b',name:'Aço',code:'1.2',quantity:200,unit:'kg',sale:2000},{...M.defaults('budgetItems','q'),id:'qitem',stage:'bq',name:'Outra obra',quantity:10,sale:10}];s.activities=[{...M.defaults('activities','p'),id:'plan',stage:'none',name:'Só no cronograma',quantity:100,executed:100}];return {s,D,F,w}}
const meta=n=>({number:n,date:'2026-10-17',note:'Conferir'}),input=(id,current,mode='percent',selected=true)=>({id,current,mode,selected});
test('primeira e segunda medições acumuladas gravam apenas incrementos, sem alterar orçamento ou cronograma',()=>{let {s,D,F}=setup(),before=JSON.stringify(s);let next=F.saveBatch(s,'p',meta('01'),[input('a','10'),input('b','15')]);assert.equal(next.measurements.length,2);assert.equal(next.measurements.find(m=>m.activity==='a').quantity,10);assert.equal(next.measurements.find(m=>m.activity==='b').quantity,30);let rows=F.rows(next,'p');assert.equal(rows[0].previousPercent,10);assert.equal(rows[1].previousPercent,15);assert.equal(rows[0].current,'10');next=F.saveBatch(next,'p',meta('02'),[input('a','25'),input('b','20')]);assert.equal(next.measurements.find(m=>m.number==='02'&&m.activity==='a').quantity,15);assert.equal(next.measurements.find(m=>m.number==='02'&&m.activity==='b').quantity,10);assert.equal(next.measurements.every(m=>m.status==='Preparada'),true);assert.equal(D.sum(next.measurements.filter(m=>m.number==='02'),m=>D.measurementValue(next,m)),250);assert.equal(JSON.stringify(next.activities),JSON.stringify(s.activities));assert.equal(JSON.stringify(next.budgetItems),JSON.stringify(s.budgetItems));assert.equal(JSON.stringify(s),before);});
test('preenchimento por quantidade, linhas desmarcadas e acumulado sem aumento não duplicam valores',()=>{let {s,F}=setup();s=F.saveBatch(s,'p',meta('01'),[input('a','12,5','quantity'),input('b',20,'percent',false)]);assert.equal(s.measurements.length,1);assert.equal(s.measurements[0].quantity,12.5);assert.throws(()=>F.saveBatch(s,'p',meta('02'),[input('a','12,5','percent')]),/aumento/);s=F.saveBatch(s,'p',meta('02'),[input('a','20','quantity')]);assert.equal(s.measurements.at(-1).quantity,7.5);assert.equal(F.rows(s,'p')[0].previous,20)});
test('anterior inclui preparadas, apresentadas e aprovadas, exclui glosas e outras obras',()=>{let {s,F}=setup();s.measurements=[{id:'m1',project:'p',activity:'a',quantity:10,status:'Preparada'},{id:'m2',project:'p',activity:'a',quantity:5,status:'Apresentada'},{id:'m3',project:'p',activity:'a',quantity:3,status:'Aprovada'},{id:'m4',project:'p',activity:'a',quantity:20,status:'Glosada'},{id:'m5',project:'q',activity:'a',quantity:50,status:'Preparada'}];assert.equal(F.rows(s,'p')[0].previous,18);assert.equal(F.rows(s,'p').length,2);assert.equal(F.rows(s,'q').length,1);assert.equal(F.rows(s,'p').some(r=>r.id==='plan'),false);assert.throws(()=>F.rows(s,'all'),/Selecione uma obra/)});
test('lote inválido é atômico, com limite de 100%, proteção de anterior e orçamento correto',()=>{let {s,F}=setup();s=F.saveBatch(s,'p',meta('01'),[input('a',10)]);let before=JSON.stringify(s);for(let draft of [[input('a',9)],[input('a',101)],[input('a',20),input('a',30)],[input('qitem',10)],[input('plan',10)],[input('a',20),input('b','abc')]])assert.throws(()=>F.saveBatch(s,'p',meta('02'),draft));assert.equal(JSON.stringify(s),before);assert.throws(()=>F.saveBatch(s,'p',meta(' 01 '),[input('a',20)]),/já existe/);assert.throws(()=>F.saveBatch(s,'p',{...meta('02'),date:'2026-02-31'},[input('a',20)]),/data base/)});
test('modo inválido, item sem quantidade e centavos usam a mesma regra da lista de medições',()=>{let {s,D,F}=setup();assert.throws(()=>F.calculate({...F.rows(s,'p')[0],mode:'other'}),/percentual ou quantidade/);s.budgetItems[0].quantity=0;assert.throws(()=>F.saveBatch(s,'p',meta('01'),[input('a',10)]),/quantidade orçada/);s.budgetItems[0].quantity=3;s.budgetItems[0].sale=100;let row={...F.rows(s,'p')[0],current:'33,33333333333333'};let result=F.calculate(row);s=F.saveBatch(s,'p',meta('01'),[{...row,selected:true}]);assert.equal(result.value,D.measurementValue(s,s.measurements[0]));let unchanged=F.rows(s,'p')[0];assert.equal(F.calculate(unchanged).delta,0)});
test('MED001 reúne vários itens e MED002 mantém o item concluído visível e bloqueado',()=>{let {s,D,F}=setup();s=F.saveBatch(s,'p',meta('MED001'),[input('a','100'),input('b','15')]);let before=JSON.stringify(s),r=F.rows(s,'p');assert.equal(r.length,2);assert.equal(r[0].complete,true);assert.equal(r[0].current,'100');assert.equal(r[1].complete,false);assert.equal(r[1].current,'15');assert.throws(()=>F.saveBatch(s,'p',meta('MED002'),[input('a','90'),input('b','25')]),/100%/);assert.equal(JSON.stringify(s),before);let next=F.saveBatch(s,'p',meta('MED002'),[input('a','100'),input('b','25')]);assert.equal(next.measurements.filter(m=>m.number==='MED001').length,2);assert.equal(next.measurements.filter(m=>m.number==='MED002').length,1);assert.equal(next.measurements.at(-1).quantity,20);assert.equal(D.measurementValue(next,next.measurements.at(-1)),200);assert.equal(F.rows(next,'p')[0].complete,true);next.measurements.find(m=>m.activity==='a').status='Glosada';assert.equal(F.rows(next,'p')[0].complete,false)});
test('liberar medição aprova o grupo inteiro, aplica retenção e não registra recebimento',()=>{let {s,D,F}=setup();s.projects[0].measurementRetentionRate=5;s=F.saveBatch(s,'p',meta('MED001'),[input('a','10'),input('b','15')]);s=F.saveBatch(s,'p',meta('MED002'),[input('a','20')]);let before=JSON.stringify(s),details={submitted:'2026-10-18',approved:'2026-10-19',expected:'2026-11-10',evidence:'Aceite do cliente'};let next=F.releaseBatch(s,s.measurements[0].id,details);assert.equal(next.measurements.filter(m=>m.number==='MED001').every(m=>m.status==='Aprovada'&&m.expected==='2026-11-10'),true);assert.equal(next.measurements.find(m=>m.number==='MED002').status,'Preparada');let group=D.measurementGroups(next,'p').find(g=>g.number==='MED001');assert.equal(group.approved,400);assert.equal(group.retained,20);assert.equal(group.balance,380);assert.equal(next.receipts.length,0);assert.equal(JSON.stringify(s),before);assert.throws(()=>F.releaseBatch(s,s.measurements[0].id,{...details,evidence:''}),/evidência/);assert.throws(()=>F.releaseBatch(s,s.measurements[0].id,{...details,expected:'2026-02-30'}),/datas válidas/)});

test('notas fiscais: 12250, 2.917,00 e 8.997,00 são aceitos com soma de R$ 30.004,00',()=>{
 const {F,w}=setup();
 const fixtures=[
  ['2026-07-15','VIDRAÇARIA','4','50345','12250'],
  ['2026-07-21','C&S BLOCOS','1175','50372','2.917,00'],
  ['2026-07-24','JOFEGE','45546','50327','5840'],
  ['2026-07-27','C&S BLOCOS','1187','50372','8.997,00']
 ];
 w.document={querySelectorAll:selector=>selector==='#measurementSheetInvoiceRows tr'
   ?fixtures.map(values=>({querySelectorAll:()=>values.map(value=>({value}))})) :[]};
 const rows=F.readInvoiceGrid('measurementSheetInvoiceRows');
 assert.equal(rows.length,4);
 assert.equal(rows[0].amount,12250);
 assert.equal(rows[1].amount,2917);
 assert.equal(rows[2].amount,5840);
 assert.equal(rows[3].amount,8997);
 assert.equal(rows.reduce((total,entry)=>total+entry.amount,0),30004);
 assert.ok(rows.every(entry=>typeof entry.amount==='number'));
 fixtures[0][4]='invalido';
 assert.throws(()=>F.readInvoiceGrid('measurementSheetInvoiceRows'),/monetário inválido|valor inválido/);
});

test('modo geral muda todos os itens entre percentual e quantidade preservando acumulados e seleções',()=>{
 const {s,F}=setup();
 const draft=F.rows(s,'p');
 draft[0].current='25';draft[0].selected=true;
 draft[1].current='37,5';draft[1].selected=false;
 const previous=draft.map(row=>F.calculate(row).current);
 const changed=F.applyModeToAll(draft,'quantity');
 assert.equal(changed.length,2);
 assert.deepEqual(draft.map(row=>row.mode),['quantity','quantity']);
 assert.equal(Number(draft[0].current),25);
 assert.equal(Number(draft[1].current),75);
 assert.deepEqual(draft.map(row=>row.selected),[true,false]);
 for(let i=0;i<draft.length;i++)assert.ok(Math.abs(F.calculate(draft[i]).current-previous[i])<1e-10);
 F.applyModeToAll(draft,'percent');
 assert.deepEqual(draft.map(row=>row.mode),['percent','percent']);
 assert.equal(Number(draft[0].current),25);
 assert.equal(Number(draft[1].current),37.5);
 for(let i=0;i<draft.length;i++)assert.ok(Math.abs(F.calculate(draft[i]).current-previous[i])<1e-10);
});
test('modo geral não modifica itens concluídos nem aplica conversão parcial sobre erro',()=>{
 const {s,F}=setup();const draft=F.rows(s,'p');
 draft[0].current='100';draft[0].complete=true;
 draft[1].current='40';draft[1].selected=true;
 const changed=F.applyModeToAll(draft,'quantity');
 assert.equal(changed.length,1);
 assert.equal(draft[0].mode,'percent');
 assert.equal(draft[0].current,'100');
 assert.equal(draft[1].mode,'quantity');
 assert.equal(Number(draft[1].current),80);
 draft[1].current='300';
 assert.throws(()=>F.applyModeToAll(draft,'percent'),/100%|acumulado/i);
 assert.equal(draft[1].mode,'quantity');
 assert.equal(draft[1].current,'300');
});
