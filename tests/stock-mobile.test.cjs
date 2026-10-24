const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,'../dist',name),'utf8');
function moduleWindow(file,globals){
 const w={...globals};
 const ctx={window:w,document:{querySelector:()=>null,querySelectorAll:()=>[]}};
 vm.runInNewContext(read(file),ctx,{filename:file});
 return w;
}
test('os três módulos de estoque continuam válidos em JavaScript',()=>{
 for(const file of ['nextar-stock.js','paint-stock.js','civil-stock.js'])assert.doesNotThrow(()=>new vm.Script(read(file),{filename:file}));
});
test('Tintas gera um card compacto e mantém a tabela e os comandos de edição',()=>{
 const w=moduleWindow('paint-stock.js',{
  EngefexPaintState:()=>({projects:[],paintStock:[{id:'IN001',name:'Tinta azul',description:'Esmalte',price:32,quantity:4,minimum:2,works:['Obra A'],ral:'5010',discontinued:false}]}),
 });
 const html=w.EngefexPaints.page();
 assert.match(html,/class="paint-table"/);
 assert.match(html,/class="stock-mobile-cards paint-mobile-cards"/);
 assert.match(html,/Tinta azul/);
 assert.match(html,/RAL <strong>5010<\/strong>/);
 assert.match(html,/data-paint-edit="IN001"/);
 assert.match(html,/data-paint-works="IN001"/);
 assert.match(html,/<summary>Mais detalhes<\/summary>/);
});
test('Civil gera cards com os mesmos registros paginados e comandos originais',()=>{
 const w=moduleWindow('civil-stock.js',{
  EngefexCivilState:()=>({civilStock:[{id:'cid001',stockId:'C-1',name:'Tábua pinus',quantity:5,price:20,level:'Normal',description:'Madeira'}]})
 });
 const html=w.EngefexCivilStock.page();
 assert.match(html,/class="civil-stock"/);
 assert.match(html,/class="stock-mobile-cards civil-mobile-cards"/);
 assert.match(html,/class="hr-table-wrap"/);
 assert.match(html,/Tábua pinus/);
 assert.match(html,/data-civil-edit="cid001"/);
 assert.match(html,/data-civil-del="cid001"/);
 assert.match(html,/id="civilPrev"/);
 assert.match(html,/id="civilNext"/);
});
test('layout responsivo mantém tabela no desktop e transforma Nextar em cards no celular',()=>{
 const css=read('stock-mobile.css');
 const html=read('index.html');
 assert.match(css,/\.stock-mobile-cards\s*\{display:none\}/);
 assert.match(css,/@media screen and \(max-width:760px\)/);
 assert.match(css,/\.paint-table,\.civil-stock \.civil-table-panel \.hr-table-wrap\s*\{display:none!important\}/);
 assert.match(css,/\.nextar-stock-table tbody tr\s*\{display:grid/);
 assert.match(css,/\.nextar-stock-table tbody td\.nextar-qty/);
 assert.match(html,/stock-mobile\.css\?v=4\.18\.32/);
 assert.match(html,/paint-stock\.js\?v=4\.18\.32/);
 assert.match(html,/civil-stock\.js\?v=4\.18\.32/);
});
