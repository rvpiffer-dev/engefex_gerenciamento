/* Regressão da importação múltipla de XML NF-e. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function setup(){
 const w={crypto:require('node:crypto').webcrypto};w.window=w;vm.createContext(w);
 for(const file of ['data.js','domain.js','manager.js','purchases.js','batch-xml.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist',file),'utf8'),w,{filename:file});
 let D=w.Obras,P=w.EngefexPurchases,B=w.EngefexBatchXML,M=w.EngefexManager,s=M.separate(D.clone(w.OBRAS_SEED));
 s.projects=[{id:'obra-a',name:'Obra A'},{id:'obra-b',name:'Obra B'}];s.budgetStages=[];s.budgetItems=[];
 return {w,D,P,B,M,s};
}
function xml(number='123',key='1'){
 return '<?xml version="1.0"?><nfeProc><NFe><infNFe Id="NFe'+key.repeat(44)+'"><ide><nNF>'+number+'</nNF><serie>1</serie><dhEmi>2026-10-26T09:00:00-03:00</dhEmi></ide><emit><CNPJ>12345678000199</CNPJ><xNome>Fornecedor XML</xNome></emit><det nItem="1"><prod><xProd>Vergalhão</xProd><uCom>UN</uCom><qCom>2</qCom><vUnCom>125.00</vUnCom><vProd>250.00</vProd></prod></det><total><ICMSTot><vNF>250.00</vNF></ICMSTot></total></infNFe></NFe></nfeProc>';
}
const file=(name,text)=>({name,size:text.length,text:async()=>text});
test('Seleciona vários XMLs válidos, ignora repetidos e erros sem bloquear o lote',async()=>{
 const {B,s}=setup(),files=[file('001.xml',xml('101','1')),file('002.xml',xml('102','2')),file('duplicada.xml',xml('101','1')),file('incorreto.xml','<x/>'),file('resumo.txt','texto')];
 const rows=await B.loadFiles(files,s);
 assert.equal(rows.length,5);
 assert.equal(rows.filter(x=>x.checked).length,2);
 assert.equal(rows.filter(x=>x.duplicate).length,1);
 assert.equal(rows.filter(x=>x.reason&&!x.duplicate).length,2);
 assert.equal(rows[0].purchase.status,'Rascunho');
 assert.equal(rows[1].purchase.number,'102');
});
test('Plano importa as notas em Rascunho vinculadas à obra sem criar despesa ou confirmar automaticamente',async()=>{
 const {B,s}=setup(),files=[file('001.xml',xml('101','1')),file('002.xml',xml('102','2'))];
 const rows=await B.loadFiles(files,s),before=JSON.stringify(s);
 rows[0].attachments=[{id:'xml-original-101',name:'001.xml',type:'text/xml'}];
 const next=B.plan(s,rows,'obra-a');
 assert.equal(next.purchases.length,2);
 assert.equal(next.costs.length,0);
 assert.equal(next.purchases.every(x=>x.status==='Rascunho'&&x.project==='obra-a'),true);
 assert.equal(next.purchases.find(x=>x.number==='101').attachments[0].name,'001.xml');
 assert.equal(next.purchases.every(x=>x.items.length===1),true);
 assert.equal(JSON.stringify(s),before,'não modifica o estado original antes de salvar');
});
test('Valida duplicações já existentes no banco mesmo com chaves diferentes',async()=>{
 const {B,s}=setup(),[first]=await B.loadFiles([file('001.xml',xml('101','1'))],s);
 let saved=B.plan(s,[first],'obra-a');
 const other=await B.loadFiles([file('outra-chave.xml',xml('101','9')),file('outra-nota.xml',xml('103','3'))],saved);
 assert.equal(other[0].duplicate,true,'mesmo emitente, série e número não pode duplicar');
 assert.equal(other[1].checked,true);
 assert.throws(()=>B.plan(saved,[first],'obra-a'),/já existe|repetida/);
});
test('Não cadastra arquivo com estrutura maliciosa nem confirma NF-e inválida',async()=>{
 const {B,s}=setup();
 const rows=await B.loadFiles([file('externo.xml','<!DOCTYPE a [<!ENTITY x SYSTEM "file:///etc/passwd">]><NFe>&x;</NFe>'),file('evento.xml','<evento><infEvento/></evento>')],s);
 assert.equal(rows.every(r=>r.checked===false),true);
 assert.throws(()=>B.plan(s,rows,'obra-a'),/Selecione/);
 assert.equal(s.purchases.length,0);
});
test('Destino Estoque e Geral podem ser usados sem obra e permanecem como Rascunho',async()=>{
 const {B,s}=setup(),[draft]=await B.loadFiles([file('nf.xml',xml('103','3'))],s);
 for(const target of ['__stock__','__general__','']){
  const next=B.plan(s,[draft],target);
  assert.equal(next.purchases[0].project,target?'Geral':'');
  assert.equal(next.purchases[0].destination,target==='__stock__'?'stock':target==='__general__'?'general':'work');
  assert.equal(next.purchases[0].status,'Rascunho');
 }
});
test('Lotes com mais de 100 arquivos ou acima do limite são bloqueados',async()=>{
 const {B,s}=setup(),files=Array.from({length:101},(_,i)=>file('n'+i+'.xml',xml(String(i),'1')));
 await assert.rejects(()=>B.loadFiles(files,s),/Limite de 100/);
 await assert.rejects(()=>B.loadFiles([{name:'grande.xml',size:50000001,text:async()=>''}],s),/50 MB/);
});
