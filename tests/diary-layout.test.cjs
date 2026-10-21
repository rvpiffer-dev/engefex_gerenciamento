const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {orderPhotosForReport}=require('../dist/diary-docx.js');
const photo=(id,portrait=true)=>({id,width:portrait?900:1900,height:portrait?1600:1300,caption:id});
test('relatório agrupa quatro retratos intercalados antes da paisagem sem modificar anexos',()=>{
 const photos=[photo('P1'),photo('L',false),photo('P2'),photo('P3'),photo('P4')],before=JSON.stringify(photos);
 assert.deepEqual(orderPhotosForReport(photos).map(p=>p.id),['P1','P2','P3','P4','L']);
 assert.equal(JSON.stringify(photos),before);
 assert.equal(orderPhotosForReport(photos)[4],photos[1]);
});
test('ordenação mantém retrato ímpar, paisagens, quadradas e lista vazia sem perdas',()=>{
 for(const photos of [[],[photo('L',false)],[photo('L',false),photo('P')],[photo('Q',false),photo('P1'),photo('P2'),photo('L',false),photo('P3')]]){
  const result=orderPhotosForReport(photos);assert.equal(result.length,photos.length);assert.equal(new Set(result).size,photos.length);
 }
 assert.deepEqual(orderPhotosForReport([{id:'Q',width:100,height:100},photo('P')]).map(p=>p.id),['P','Q']);
});
test('prévia, impressão e exportador compilado usam a mesma ordenação',()=>{
 for(const file of ['dist/diary/assets/index-MaLyc2Pl.js','dist/diary/assets/export-DMSeutoN.js','modules/diary/lib/export.mjs']){
  const source=fs.readFileSync(require('node:path').join(__dirname,'..',file),'utf8');
  const fn=source.match(/function orderPhotosForReport\(photos\)\{.*?return \[\.\.\.portraits,\.\.\.landscapes\];\}/)[0];
  const context=vm.createContext({});vm.runInContext(fn,context);
  const photos=[photo('L',false),photo('P1'),photo('P2'),photo('P3'),photo('P4')];
  assert.equal(JSON.stringify(context.orderPhotosForReport(photos)),JSON.stringify(orderPhotosForReport(photos)));
  assert.ok(source.split('orderPhotosForReport(').length>=3,'função precisa ser chamada');
 }
});
