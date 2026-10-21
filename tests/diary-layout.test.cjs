const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {orderPhotosForReport}=require('../dist/diary-docx.js');
const diary=require('../dist/diary-docx.js');
const photo=(id,portrait=true)=>({id,width:portrait?900:1900,height:portrait?1600:1300,caption:id});
test('relatório agrupa quatro retratos intercalados antes da paisagem sem modificar anexos',()=>{
 const photos=[photo('P1'),photo('L',false),photo('P2'),photo('P3'),photo('P4')],before=JSON.stringify(photos);
 assert.deepEqual(orderPhotosForReport(photos).map(p=>p.id),['P1','P2','P3','P4','L']);
 assert.equal(JSON.stringify(photos),before);
 assert.equal(orderPhotosForReport(photos)[4],photos[1]);
});
test('modelo 076 usa fotos de 13 cm e margens medidas no PDF de referência',()=>{
 const portrait=diary.dimensions(900,1600),landscape=diary.dimensions(1900,1300);
 assert.ok(Math.abs(portrait.width*2.54/96-9.35)<0.001);
 assert.ok(Math.abs(landscape.width*2.54/96-19)<0.001);
 assert.ok(Math.abs(portrait.height*2.54/96-13)<0.001);
 assert.equal(portrait.height,landscape.height);
 assert.deepEqual(diary.PHOTO_LAYOUT.margins,{top:822,bottom:567,left:709,right:425});
});
test('enquadramento recorta proporcionalmente só a cópia de exportação',async()=>{
 const oldImage=global.Image,oldDocument=global.document,draws=[];
 global.Image=class{set src(s){this.naturalWidth=s==='portrait'?960:1280;this.naturalHeight=s==='portrait'?1280:720;queueMicrotask(()=>this.onload())}};
 global.document={createElement:()=>({getContext:()=>({drawImage:(...args)=>draws.push(args)}),toDataURL:()=> 'formatted'})};
 try{
  const originals=[{id:'P',width:960,height:1280,dataURL:'portrait',caption:'Pilar'},{id:'L',width:1280,height:720,dataURL:'landscape',caption:'Cobertura'}];
  const before=JSON.stringify(originals),formatted=await diary.formatPhotos(originals);
  assert.equal(JSON.stringify(originals),before);
  assert.deepEqual(formatted.map(p=>[p.width,p.height]),[[935,1300],[1900,1300]]);
  assert.equal(formatted[0].caption,'Pilar');assert.equal(formatted[1].caption,'Cobertura');
  for(const draw of draws){const [,sx,sy,sw,sh,,,dw,dh]=draw;assert.ok(sx>=0&&sy>=0);assert.ok(Math.abs(sw/sh-dw/dh)<0.00001)}
 }finally{global.Image=oldImage;global.document=oldDocument}
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
