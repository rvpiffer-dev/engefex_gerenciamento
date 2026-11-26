/* Read the fabrication order exported by VERTIX from Revit. */
(function(root){
'use strict';

function analyze(sheets){
 const tables=new Map();
 for(const sheet of sheets){
  if(tables.has(sheet.name))throw Error('Aba duplicada: '+sheet.name);
  tables.set(sheet.name,sheet.rows);
 }
 const value=(row,column)=>{
  const cell=row[column];
  if(cell?.formula!==undefined||cell?.error)throw Error('Use os valores originais da exportação VERTIX, sem fórmulas ou células com erro.');
  return cell?.value??'';
 };
 const read=(name,headers)=>{
  const rows=tables.get(name);
  if(!rows?.length||headers.some(([col,label])=>value(rows[0],col)!==label))throw Error('Aba ausente ou inválida: '+name+'.');
  return rows.slice(1);
 };
 const text=(row,col)=>String(value(row,col)).trim();
 const fields=new Map();
 for(const row of read('Ordem Engefex',[['A','Campo'],['B','Valor']])){
  const key=text(row,'A');
  if(!key||fields.has(key))throw Error('Campo da ordem ausente ou duplicado.');
  fields.set(key,text(row,'B'));
 }
 const metadata=key=>fields.get(key)||'';
 if(metadata('schemaVersion')!=='1'||!metadata('projectId')||!/^\d+$/.test(metadata('catalogSync'))||!metadata('buildingCode')){
  throw Error('Identificação ou versão da exportação VERTIX inválida.');
 }
 const header=[['A','Marca'],['B','Nome'],['C','Grupo'],['D','Unidade'],['E','Quantidade'],['F','Perfil'],['G','Tamanho / comprimento'],['H','Observações']];
 const parts=new Map();
 for(const row of read('Peças Engefex',header)){
  const code=text(row,'A'),name=text(row,'B'),unit=text(row,'D'),planned=value(row,'E');
  if(!code||parts.has(code.toLowerCase())||!name||unit!=='un'||!Number.isSafeInteger(planned)||planned<1)throw Error('Marca, descrição ou quantidade inválida: '+(code||'marca vazia')+'.');
  parts.set(code.toLowerCase(),{code,name,group:text(row,'C'),unit,planned,dimensions:text(row,'F'),size:text(row,'G'),note:text(row,'H')});
 }
 if(!parts.size||parts.size>5000)throw Error('A ordem precisa ter de 1 a 5.000 marcas.');
 const individuals=new Map();
 const stages=root.EngefexFactoryFlow.stages.map(([key])=>key);
 for(const row of read('Operações Engefex',[['A','ID individual'],['B','Marca VERTIX'],['C','Operação'],['D','Sequência']])){
  const id=text(row,'A'),mark=text(row,'B').toLowerCase(),stage=text(row,'C'),index=value(row,'D');
  if(!id||!parts.has(mark)||!stages.includes(stage)||!Number.isInteger(index)||index<1||index>stages.length)throw Error('Operação inválida para '+(id||'peça sem ID')+'.');
  if(!individuals.has(id))individuals.set(id,{mark,steps:new Map()});
  const piece=individuals.get(id);
  if(piece.mark!==mark||piece.steps.has(index))throw Error('Operações duplicadas ou marcas divergentes para '+id+'.');
  piece.steps.set(index,stage);
 }
 const traceIds=new Set();
 for(const row of read('Rastreabilidade',[['C','ID peça'],['D','Marca'],['K','Situação'],['L','UniqueId Revit']])){
  const id=text(row,'C'),piece=individuals.get(id);
  if(!id||traceIds.has(id)||!piece||piece.mark!==text(row,'D').toLowerCase()||text(row,'K')==='AUSENTE'){
   throw Error('Peça divergente entre rastreabilidade e operações: '+(id||'peça sem ID')+'.');
  }
  traceIds.add(id);
 }
 if(traceIds.size!==individuals.size)throw Error('Há operações sem peça correspondente na rastreabilidade.');
 const groups=new Map();
 for(const [id,{mark,steps}] of individuals){
  const route=Array.from({length:steps.size},(_,i)=>steps.get(i+1));
  if(route.some(key=>!key)||route.join()!==stages.filter(key=>route.includes(key)).join())throw Error('Sequência inválida para '+id+'.');
  if(!groups.has(mark))groups.set(mark,new Map());
  const variants=groups.get(mark),key=route.join();
  if(!variants.has(key))variants.set(key,{route,pieceIds:[]});
  variants.get(key).pieceIds.push(id);
 }
 let split=0;
 const imported=[];
 const reserved=new Set(parts.keys());
 for(const [mark,part] of parts){
  const variants=[...(groups.get(mark)?.entries()||[])].sort(([a],[b])=>a.localeCompare(b));
  if(variants.reduce((sum,[,v])=>sum+v.pieceIds.length,0)!==part.planned)throw Error('Quantidade da marca '+part.code+' diverge das operações individuais.');
  if(variants.length>1)split++;
  for(const [,variant] of variants){
   let code=part.code;
   if(variants.length>1){
    const base=code+'-'+variant.route.map(key=>key.slice(0,2).toUpperCase()).join('');
    code=base;
    for(let n=2;reserved.has(code.toLowerCase());n++)code=base+'-'+n;
    reserved.add(code.toLowerCase());
   }
   imported.push({...part,...variant,code,originalMark:part.code,planned:variant.pieceIds.length});
  }
 }
 if(imported.length>5000)throw Error('A ordem ultrapassa 5.000 itens após separar as sequências de fabricação.');
 const documents=[], sheetIds=new Set();
 for(const row of read('Pranchas Engefex',[['A','UniqueId Revit'],['B','Número'],['C','Título']])){
  const uid=text(row,'A'),number=text(row,'B'),title=text(row,'C');
  if(!uid||sheetIds.has(uid)||!number||!title)throw Error('Referência de prancha inválida ou duplicada.');
  sheetIds.add(uid);
  documents.push({uid,number,title});
 }
 return {fields,parts:imported,documents,split,quantity:individuals.size};
}

function hasPrevious(state,order){
 const flow=order.workflow||{};
 return (state.factoryOrders||[]).some(item=>item.project===order.project)||order.parts.length>0||
  order.lots.length>0||order.loads.length>0||!!flow.closedAt||!!flow.events?.length||!!flow.revitImport;
}

function prepare(state,order,sheets,filename,{replace=false}={}){
 const F=root.EngefexFactoryFlow,M=root.EngefexFactoryModel;
 const replacing=hasPrevious(state,order);
 if(replacing&&!replace)throw Error('Confirme a substituição da fabricação existente.');
 const project=state.projects.find(item=>item.id===order.project);
 if(!project)throw Error('Selecione uma obra para a fabricação.');
 const o=F.fresh(project);
 o.id=order.id;
 const data=analyze(sheets);
 const get=key=>data.fields.get(key)||'';
 for(const key of ['number','revision','owner','start','due'])o[key]=get(key);
 for(const key of Object.keys(o.workflow.profile))o.workflow.profile[key]=get(key);
 if(!o.revision)throw Error('Informe a revisão no Revit e exporte novamente.');
 const issues=F.profileIssues(o);
 if(issues.length)throw Error(issues.join(' '));
 o.sourceName=filename;
 o.workflow.revitImport={projectId:get('projectId'),catalogSync:Number(get('catalogSync')),buildingCode:get('buildingCode'),documents:data.documents};
 for(const {route,pieceIds,originalMark,...part} of data.parts){
  const item={...M.part(),...part,revit:{originalMark,pieceIds}};
  o.parts.push(item);
  o.workflow.routes[item.id]=route;
 }
 F.resetQuality(o);
 M.validate(replacing?withoutOtherOrders(state,o):state,o);
 return {order:o,quantity:data.quantity,split:data.split};
}

function withoutOtherOrders(state,order){
 return {...state,factoryOrders:(state.factoryOrders||[]).filter(item=>item.project!==order.project||item.id===order.id)};
}

function saveReplacement(state,order){
 const M=root.EngefexFactoryModel;
 let next=state;
 for(const previous of state.factoryOrders||[]){
  if(previous.project===order.project&&previous.id!==order.id)next=M.remove(next,previous.id);
 }
 return M.save(next,order);
}

root.EngefexFactoryRevit={prepare,hasPrevious,saveReplacement};
})(typeof window==='undefined'?globalThis:window);
