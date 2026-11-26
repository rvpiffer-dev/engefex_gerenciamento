/* Leitura do orçamento padrão Engefex por posição das colunas. */
(function(root){
'use strict';
const pdf=typeof module!=='undefined'&&module.exports?require('./budget-type2.js'):root.EngefexBudgetType2;
const normalize=text=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const join=items=>items.map(item=>item.str.trim()).join(' ');
const cents=value=>Math.round(value*100);
const labels=['item','quant.','descricao do pedido','und','valor unit','valor total'];
const totals={'sub total':'subtotal','subtotal':'subtotal','terceiros':'thirdParty','impostos%':'tax','impostos %':'tax','total':'total'};
const stage={code:'1',name:'Serviços do orçamento Engefex',sourceRow:'PDF',parentCode:''};

function parsePages(pages,name='Orçamento Tipo 3'){
  const services=[],warnings=[],errors=[],controls={},codes=new Set();
  for(const [pageIndex,page] of pages.entries()){
    const fail=message=>errors.push('Página '+(pageIndex+1)+': '+message);
    const rows=pdf.lines(page.items);
    const header=rows.find(row=>normalize(row.text)===labels.join(' '));
    if(!header||header.items.length!==labels.length){
      fail('Cabeçalho do modelo Engefex não reconhecido. Use o PDF original com texto selecionável.');
      continue;
    }
    const [item,quantity,,unit,price,total]=header.items;
    const itemEnd=(item.x+item.width+quantity.x)/2;
    const quantityEnd=quantity.x+quantity.width+2;
    const unitStart=unit.x-13,priceStart=price.x-10,totalStart=total.x-10;
    const columns=[itemEnd,quantityEnd,unitStart,priceStart,totalStart];
    const table=rows.filter(row=>row.y>header.y+4).map(row=>{
      const cells=Array.from({length:6},()=>[]);
      for(const token of row.items){
        const index=columns.findIndex(boundary=>token.x<boundary);
        cells[index<0?5:index].push(token);
      }
      return {y:row.y,cells:cells.map(join)};
    });
    const footer=table.findIndex(row=>Object.hasOwn(totals,normalize(row.cells.slice(3,5).join(' '))));
    const body=footer<0?table:table.slice(0,footer);
    const summaries=footer<0?[]:table.slice(footer);
    for(const {cells} of summaries){
      const key=normalize(cells.slice(3,5).join(' '));
      if(!Object.hasOwn(totals,key))continue;
      try{
        const value=pdf.number(cells[5],true);
        const field=totals[key];
        if(controls[field]!==undefined)throw Error('Valor de conferência repetido.');
        controls[field]=value;
      }catch(error){fail(key+': '+error.message)}
    }

    const anchors=body.filter(row=>/^\d+$/.test(row.cells[0])).map(row=>({...row,description:[]}));
    for(const row of body){
      const [code,quantity,description,unit,price,total]=row.cells;
      const anchor=anchors.reduce((closest,item)=>
        !closest||Math.abs(item.y-row.y)<Math.abs(closest.y-row.y)?item:closest,null);
      if(description&&anchor)anchor.description.push(description);
      const hasValues=code||quantity||unit||price||(total&&!/^R\$\s*-$/.test(total));
      if(hasValues&&(!anchor||Math.abs(anchor.y-row.y)>2)){
        fail('Dados sem número de item na linha '+Math.round(row.y)+'.');
      }
    }
    for(const {y,cells,description} of anchors){
      const [item,quantity,,unit,price,total]=cells;
      try{
        const code=stage.code+'.'+Number(item);
        if(codes.has(code))throw Error('Número de item repetido.');
        if(!description.length||!unit)throw Error('Descrição ou unidade ausente.');
        const qty=pdf.number(quantity),unitPrice=pdf.number(price,true),amount=pdf.number(total,true);
        if(qty<=0)throw Error('Quantidade deve ser positiva.');
        if(Math.abs(cents(qty*unitPrice)-cents(amount))>1)throw Error('Quantidade × valor unitário difere do total.');
        codes.add(code);
        services.push({
          code,parentCode:stage.code,name:description.join(' '),unit,quantity:qty,unitPrice,total:amount,
          unitCosts:{labor:null,material:null,equipment:null},
          sourceRow:'PDF · página '+(pageIndex+1)+' · linha '+Math.round(y)
        });
      }catch(error){fail('Item '+item+': '+error.message)}
    }
  }
  const sumInCents=services.reduce((sum,item)=>sum+cents(item.total),0);
  if(!services.length)errors.push('Nenhum serviço reconhecido.');
  if(controls.subtotal===undefined||controls.total===undefined){
    errors.push('Subtotal ou total geral ausente no PDF.');
  }else{
    if(sumInCents!==cents(controls.subtotal))errors.push('A soma dos serviços difere do subtotal do PDF.');
    const expected=cents(controls.subtotal)+cents(controls.tax??0)+cents(controls.thirdParty??0);
    if(expected!==cents(controls.total))errors.push('Subtotal, impostos e terceiros não fecham com o total geral do PDF.');
  }
  if(controls.tax||controls.thirdParty)warnings.push('Impostos e terceiros entram no total geral do PDF. Os serviços conservam seus valores originais.');
  return {
    type:'3',sheet:name,stages:services.length?[stage]:[],services,warnings,errors,controls,
    sum:sumInCents/100,metadata:{},notes:[]
  };
}

const api={parsePages,readPDF:(buffer,name,onProgress)=>pdf.readPDF(buffer,name,onProgress,parsePages)};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
else root.EngefexBudgetType3=api;
})(typeof window==='undefined'?globalThis:window);
