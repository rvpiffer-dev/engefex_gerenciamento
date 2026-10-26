/* Relatórios de compras e notas: preservação do período, obra e valores rateados. */
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const dist=path.join(__dirname,'../dist');
function setup(){
 const w={Uint8Array,ArrayBuffer,Blob,Intl,Date,crypto:require('node:crypto').webcrypto,setTimeout,clearTimeout};w.window=w;
 vm.createContext(w);
 for(const name of ['data.js','domain.js','manager.js','purchases.js','purchase-export.js'])
  vm.runInContext(fs.readFileSync(path.join(dist,name),'utf8'),w,{filename:name});
 const D=w.Obras,M=w.EngefexManager,P=w.EngefexPurchases,R=w.EngefexPurchaseExport;
 let s=M.separate(D.clone(w.OBRAS_SEED));
 s.projects=[{id:'p',name:'Obra Principal',client:'Cliente Principal'},{id:'q',name:'Obra Secundária',client:'Outro Cliente'}];
 s.budgetStages=[{...M.defaults('budgetStages','p'),id:'sp',name:'Estrutura'},{...M.defaults('budgetStages','q'),id:'sq',name:'Estrutura Secundária'}];
 s.budgetItems=[];
 const mk=(id,date,status,amount,allocations,project='p')=>{
  const p=P.fresh(project);
  Object.assign(p,{id,kind:'Nota fiscal',supplier:'MARSON',supplierDocument:'12345678000199',number:id,date,status,items:[{...P.newItem(),description:'Material estrutural',unit:'kg',quantity:1,unitPrice:amount,total:amount,...(allocations?{allocations}:{})}],installments:status==='Confirmada'?[{id:'part-'+id,number:'1',due:'2026-11-15',amount}]:[]});return p;
 };
 s=P.save(s,mk('NF-100','2026-10-10','Confirmada',100,[{project:'p',stage:'sp',share:40},{project:'q',stage:'sq',share:60}]));
 s=P.save(s,mk('NF-200','2026-10-12','Rascunho',80,[{project:'p',stage:'sp',share:100}]));
 s=P.save(s,mk('NF-300','2026-08-12','Confirmada',30,[{project:'p',stage:'sp',share:100}]));
 s=P.save(s,mk('NF-400','2026-10-15','Confirmada',50,[{project:'q',stage:'sq',share:100}],'q'));
 s=P.save(s,mk('NF-500','2026-10-22','Rascunho',25,null));
 return {w,s,D,P,R};
}
test('Exportar somente o período selecionado e a obra, sem misturar outras compras',()=>{
 const {s,R}=setup(),original=JSON.stringify(s);
 const filter={dateFrom:'2026-10-01',dateTo:'2026-10-20'};
 const data=R.snapshot(s,'p',filter);
 assert.deepEqual(Array.from(data.rows,r=>r.number),['NF-100','NF-200']);
 assert.equal(data.total,180);
 assert.equal(data.allocated,120,'somente 40 da nota compartilhada e 80 da exclusiva');
 assert.equal(data.pending,0);
 assert.equal(data.details.filter(x=>x.document.includes('NF-100')).length,1,'exportação do item usa somente o rateio da obra');
 assert.equal(data.details.find(x=>x.document.includes('NF-100')).allocated,40);
 assert.equal(JSON.stringify(s),original,'a exportação é somente leitura');
});
test('Exportação de todas as obras inclui todas as notas e total integral sem duplicações',()=>{
 const {s,R}=setup(),data=R.snapshot(s,'all',{dateFrom:'2026-10-01',dateTo:'2026-10-31'});
 assert.equal(data.rows.length,4);
 assert.equal(data.total,255);
 assert.equal(data.allocated,255);
 assert.equal(data.rows.find(x=>x.number==='NF-500').attributed,25,'na visão geral mantém o valor total do rascunho');
});
test('Rascunho com rateio incompleto permanece visível e não inventa custo da obra',()=>{
 const {s,R}=setup(),report=R.snapshot(s,'p',{dateFrom:'2026-10-21',dateTo:'2026-10-31'});
 assert.equal(report.rows.length,1);
 assert.equal(report.rows[0].number,'NF-500');
 assert.equal(report.rows[0].attributed,null);
 assert.equal(report.pending,1);
 assert.equal(report.allocated,0);
 assert.equal(report.details[0].allocated,null);
});
test('Filtros adicionais e datas inválidas são respeitados',()=>{
 const {s,R}=setup();
 assert.deepEqual(Array.from(R.snapshot(s,'p',{dateFrom:'2026-10-01',dateTo:'2026-10-31',status:'Rascunho'}).rows,r=>r.number),['NF-200','NF-500']);
 assert.throws(()=>R.snapshot(s,'p',{dateFrom:'2026-10-31',dateTo:'2026-10-01'}),/período/);
 assert.throws(()=>R.snapshot(s,'p',{dateFrom:'2026-09-10',dateTo:'2026-09-20'}),/Nenhuma compra/);
});
test('Excel possui planilha de documentos e itens com valores numéricos, período e obra',async()=>{
 const {w,s,R}=setup();let generated;
 class FakeZip{constructor(){this.files={}}file(name,contents){this.files[name]=contents;return this}async generateAsync(options){generated={files:this.files,options};return new Blob(['xlsx-test'])}}
 w.JSZip=FakeZip;
 const report=R.snapshot(s,'p',{dateFrom:'2026-10-01',dateTo:'2026-10-20'});
 await R.generateExcel(report);
 assert.equal(generated.options.type,'blob');
 assert.match(generated.files['xl/workbook.xml'],/Compras e Notas/);
 assert.match(generated.files['xl/workbook.xml'],/Itens e Rateios/);
 assert.match(generated.files['xl/worksheets/sheet1.xml'],/NF-100/);
 assert.match(generated.files['xl/worksheets/sheet1.xml'],/Obra Principal/);
 assert.match(generated.files['xl/worksheets/sheet1.xml'],/<v>40<\/v>/);
 assert.match(generated.files['xl/worksheets/sheet2.xml'],/Material estrutural/);
 assert.match(generated.files['xl/worksheets/sheet2.xml'],/rateio|Rateio/);
 assert.ok(generated.files['[Content_Types].xml']);
});
test('PDF é arquivo real, com múltiplas páginas para muitas notas',async()=>{
 const {w,s,P,R}=setup();
 vm.runInContext(fs.readFileSync(path.join(dist,'vendor/pdf-lib.min.js'),'utf8'),w,{filename:'pdf-lib'});
 for(let i=0;i<34;i++){let p=P.fresh('p');Object.assign(p,{id:'bulk-'+i,kind:'Compra',number:'PED-'+i,supplier:'MARSON',date:'2026-10-17',status:'Rascunho',items:[{...P.newItem(),description:'Material',quantity:1,unitPrice:2,total:2,allocations:[{project:'p',stage:'sp',share:100}]}]});s=P.save(s,p)}
 const report=R.snapshot(s,'p',{dateFrom:'2026-10-01',dateTo:'2026-10-31'});
 const pdf=await R.generatePDF(report);
 assert.equal(Buffer.from(pdf.slice(0,5)).toString('ascii'),'%PDF-');
 const document=await w.PDFLib.PDFDocument.load(pdf);
 assert.ok(document.getPageCount()>1);
 assert.equal(Math.round(document.getPages()[0].getWidth()),842);
});
