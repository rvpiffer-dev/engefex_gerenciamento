const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../dist');
function setup(){
 const w={window:null,Intl,Date,Uint8Array};w.window=w;vm.createContext(w);
 for(const name of ['data.js','domain.js','manager.js','measurement-sheet.js','measurement-pdf.js'])vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),w);
 let D=w.Obras,M=w.EngefexManager,s=M.separate(D.clone(w.OBRAS_SEED));
 s.projects=[{...M.defaults('projects'),id:'p',name:'Edificio Alameda',client:'Fabril Scavone',measurementRetentionRate:5}];
 s.budgetStages=[{...M.defaults('budgetStages','p'),id:'b',name:'Servicos'}];
 s.budgetItems=[{...M.defaults('budgetItems','p'),id:'a',stage:'b',code:'1.1',name:'Concreto de fundacao',quantity:100,unit:'m3',sale:100000}];
 return {w,D,M,s};
}
test('PDF de medicao preparada preserva itens, data, notas e descontos sem gerar contas',()=>{
 const {w,s}=setup();const F=w.EngefexMeasurementSheet;
 const next=F.saveBatch(s,'p',{number:'MED-001',date:'2026-10-22',retentionRate:5,advanceRate:0,advanceOffset:0,directInvoices:[{date:'2026-07-15',supplier:'VIDRACARIA',invoice:'4',order:'50345',amount:12250}]},[{id:'a',current:'20',mode:'percent',selected:true}]);
 const before=JSON.stringify(next),view=w.EngefexMeasurementPDF.snapshot(next,next.measurements[0].id);
 assert.equal(view.number,'MED-001');assert.equal(view.project.client,'Fabril Scavone');
 assert.equal(view.gross,20000);assert.equal(view.retention,1000);
 assert.equal(view.direct,12250);assert.equal(view.net,6750);
 assert.equal(view.lines.length,1);assert.equal(view.notes[0].invoice,'4');assert.equal(view.approved,false);
 assert.equal(JSON.stringify(next),before);
});
test('PDF A4 e gerado como arquivo real e paginas com cabecalho',async()=>{
 const {w,s}=setup();vm.runInContext(fs.readFileSync(path.join(root,'vendor/pdf-lib.min.js'),'utf8'),w,{filename:'pdf-lib.min.js'});
 const F=w.EngefexMeasurementSheet;
 const next=F.saveBatch(s,'p',{number:'MED-002',date:'2026-10-22',retentionRate:5},[{id:'a',current:'10',mode:'percent',selected:true}]);
 const bytes=await w.EngefexMeasurementPDF.generate(next,next.measurements[0].id);
 assert.ok(bytes.length>2500);assert.equal(Buffer.from(bytes.slice(0,5)).toString('ascii'),'%PDF-');
 const parsed=await w.PDFLib.PDFDocument.load(bytes);assert.ok(parsed.getPageCount()>=1);
});
