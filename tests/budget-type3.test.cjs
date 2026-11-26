const assert=require('node:assert/strict');
const test=require('node:test');
const {parsePages}=require('../dist/budget-type3.js');

function sample(tax='13,00'){
  const items=[];
  function row(y,cells){
    for(const [x,str,width=12] of cells)items.push({x,y,str,width});
  }
  row(340,[[40,'Item',20],[69,'Quant.',30],[190,'Descrição do Pedido'],[393,'Und'],[435,'Valor unit'],[499,'Valor total']]);
  row(370,[[104,'Fabricação e montagem']]);
  row(377,[[49,'1'],[75,'2,00'],[395,'und'],[432,'R$'],[449,'50,00'],[492,'R$'],[519,'100,00']]);
  row(384,[[104,'com galvanização']]);
  row(405,[[492,'R$'],[539,'-']]);
  row(420,[[407,'Sub Total'],[492,'R$'],[519,'100,00']]);
  row(435,[[407,'Terceiros'],[492,'R$'],[519,'5,00']]);
  row(450,[[406,'Impostos%'],[492,'R$'],[519,tax]]);
  row(475,[[420,'Total'],[492,'R$'],[519,'118,00']]);
  return {width:595,height:842,items};
}

test('lê itens e descrições de várias linhas e confere impostos e terceiros no total geral',()=>{
  const budget=parsePages([sample()]);
  assert.deepEqual(budget.errors,[]);
  assert.deepEqual(budget.services.map(({name,quantity,unit,unitPrice,total})=>({name,quantity,unit,unitPrice,total})),[
    {name:'Fabricação e montagem com galvanização',quantity:2,unit:'und',unitPrice:50,total:100}
  ]);
  assert.deepEqual(budget.controls,{subtotal:100,thirdParty:5,tax:13,total:118});
  assert.equal(budget.sum,100);
});

test('bloqueia orçamento Engefex quando os valores do rodapé não fecham',()=>{
  const budget=parsePages([sample('14,00')]);
  assert.match(budget.errors.join(' '),/não fecham com o total geral/);
});
