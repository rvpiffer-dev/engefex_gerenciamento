const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

function fixture(){
 const w={crypto:require('node:crypto').webcrypto};
 w.window=w;
 vm.createContext(w);
 for(const name of ['data','domain','factory-template','factory-model','factory-flow','factory-revit']){
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist',name+'.js'),'utf8'),w);
 }
 const table=(name,rows)=>({name,rows:rows.map(row=>Object.fromEntries(row.map((value,i)=>[String.fromCharCode(65+i),{value}])) )});
 const project={id:'work',code:'WORK',name:'Obra de teste'};
 const state={projects:[project],history:[]};
 const draft=w.EngefexFactoryFlow.fresh(project);
 const sheets=[
  table('Ordem Engefex',[['Campo','Valor'],...Object.entries({schemaVersion:1,projectId:'rvt',catalogSync:18,
   buildingCode:'01',number:'001',revision:'R01',owner:'Equipe',structureType:'Galpão',scope:'Estrutura',
   drawing:'EST',steel:'Aço',coating:'painted'})]),
  table('Peças Engefex',[['Marca','Nome','Grupo','Unidade','Quantidade','Perfil','Tamanho / comprimento','Observações'],
   ['TC001','Terça','TC','un',2,'U100','5000 mm','Conferir']]),
  table('Operações Engefex',[['ID individual','Marca VERTIX','Operação','Sequência'],
   ['VTX-1','TC001','cut',1],['VTX-2','TC001','cut',1],['VTX-2','TC001','drill',2]]),
  table('Rastreabilidade',[['','','ID peça','Marca','','','','','','','Situação','UniqueId Revit'],
   ['','','VTX-1','TC001','','','','','','','PRELIMINAR','uid1'],
   ['','','VTX-2','TC001','','','','','','','PRELIMINAR','uid2']]),
  table('Pranchas Engefex',[['UniqueId Revit','Número','Título'],['uid3','EST01','Cobertura']])
 ];
 return {w,state,draft,sheets,prepare:w.EngefexFactoryRevit.prepare};
}
test('ordem do Revit preserva IDs, operação por peça e separa roteiros diferentes da mesma marca',()=>{
 const {w,state,draft,sheets,prepare}=fixture();
 const {order,quantity,split}=prepare(state,draft,sheets,'revit.xlsx');
 assert.equal(quantity,2);
 assert.equal(split,1);
 assert.equal(order.number,'001');
 assert.equal(order.revision,'R01');
 assert.equal(order.parts.length,2);
 assert.notEqual(order.parts[0].code,order.parts[1].code);
 assert.equal(order.parts[1].revit.originalMark,'TC001');
 assert.equal(order.parts[1].revit.pieceIds[0],'VTX-2');
 assert.equal(order.workflow.routes[order.parts[1].id].join(),'cut,drill');
 assert.equal(order.workflow.revitImport.documents[0].number,'EST01');
 assert.equal(order.workflow.events.length,0);
 assert.equal(draft.parts.length,0);
 assert.doesNotThrow(()=>w.EngefexFactoryModel.save(state,order));
 assert.throws(()=>prepare(state,order,sheets,'revit.xlsx'),/ordem sem peças/);
});
test('ordem com operações divergentes ou quantidades inconsistentes não altera a ficha',()=>{
 const {state,draft,sheets,prepare}=fixture();
 const initial=JSON.stringify(draft);
 sheets[1].rows[1].E.value=3;
 assert.throws(()=>prepare(state,draft,sheets,'revit.xlsx'),/diverge/);
 assert.equal(JSON.stringify(draft),initial);
 sheets[1].rows[1].E.value=2;
 sheets[2].rows[3].D.value=3;
 assert.throws(()=>prepare(state,draft,sheets,'revit.xlsx'),/Sequência inválida/);
 assert.equal(JSON.stringify(draft),initial);
});
