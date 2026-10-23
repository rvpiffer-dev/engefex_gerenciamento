/* Importação em lote de documentos fiscais (Excel Engefex).
 * Seleção explícita, pré-visualização, preservação dos campos e integração segura com Compras e Notas.
 */
(function(root){
 'use strict';
 const D=root.Obras,P=root.EngefexPurchases,B=root.BudgetImport;
 const h=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const norm=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const $=x=>document.querySelector(x);
 const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0);
 const uid=()=>root.crypto?.randomUUID?.()||'batch-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
 let api,documents=[],selection=new Set(),busy=false,filename='',associatedFiles=new Map(),search='',active=false;
 const field=(r,k)=>r?.[k]??'';
 const financialCategories=s=>root.EngefexFinancialCategories?.list?.(s)||(Array.isArray(s?.costCategories)?s.costCategories.filter(c=>c&&c.active!==false&&c.code&&c.name).map(c=>c.code+'-'+c.name):D.CATEGORIES);
 const text=(r,k)=>String(field(r,k)).trim();
 function index(col){let n=0;for(const c of col)n=n*26+c.charCodeAt(0)-64;return n;}
 // Leitor independente para planilhas XLSX com ou sem prefixos XML (x:row, x:sheet etc.).
 async function readExcel(buffer){
  if(!root.JSZip||!root.DOMParser)throw Error('Leitor Excel não disponível neste navegador.');
  const zip=await root.JSZip.loadAsync(buffer);
  const parser=new root.DOMParser(),read=async path=>{
   const entry=zip.file(path);if(!entry)throw Error('Planilha incompleta: '+path);
   const raw=await entry.async('string');if(raw.length>30000000)throw Error('Parte da planilha é muito grande.');
   const xml=parser.parseFromString(raw,'application/xml');
   if(xml.getElementsByTagName('parsererror').length)throw Error('XML do Excel inválido em '+path);
   return xml;
  };
  const descendants=(node,tag)=>[...node.getElementsByTagNameNS('*',tag)];
  const first=(node,tag)=>descendants(node,tag)[0];
  const strings=[];
  if(zip.file('xl/sharedStrings.xml')){
   const table=await read('xl/sharedStrings.xml');
   for(const si of descendants(table,'si'))strings.push(descendants(si,'t').map(t=>t.textContent||'').join(''));
  }
  const rels=await read('xl/_rels/workbook.xml.rels'),targets={};
  for(const rel of descendants(rels,'Relationship'))targets[rel.getAttribute('Id')]=rel.getAttribute('Target');
  const book=await read('xl/workbook.xml'),result=[];
  for(const sh of descendants(book,'sheet')){
   const id=sh.getAttribute('r:id')||sh.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');
   let target=targets[id];if(!target)continue;
   let path=target.startsWith('/')?target.slice(1):target.startsWith('xl/')?target:'xl/'+target.replace(/^\.\//,'');
   if(path.includes('..'))throw Error('Caminho inseguro em aba Excel.');
   const xml=await read(path),rows=[];
   for(const r of descendants(xml,'row')){
    const obj={};
    for(const cell of descendants(r,'c')){
     const address=cell.getAttribute('r')||'',col=address.replace(/\d/g,'');
     if(!col)continue;
     const type=cell.getAttribute('t')||'';
     const node=first(cell,'v'),raw=node?node.textContent:null;
     let value='';
     if(type==='s')value=strings[Number(raw)]??'';
     else if(type==='inlineStr')value=descendants(cell,'t').map(n=>n.textContent||'').join('');
     else if(type==='str'||type==='e')value=raw||'';
     else if(raw!==null&&raw!==''){const n=Number(raw);value=Number.isFinite(n)?n:raw}
     obj[col]={value,address};
    }
    if(Object.keys(obj).length)rows.push(obj);
   }
   result.push({name:sh.getAttribute('name')||'',rows});
  }
  if(!result.length)throw Error('Nenhuma aba encontrada no Excel.');
  return result;
 }
 function parseSheet(sheet){
  if(!sheet?.rows?.length)return [];
  const keys=Object.entries(sheet.rows[0]).sort((a,b)=>index(a[0])-index(b[0])).map(([col,c])=>[col,String(c?.value??'').trim()]);
  return sheet.rows.slice(1).map(row=>{
   const result={};
   for(const [col,key]of keys)if(key)result[key]=row[col]?.value??'';
   return result;
  }).filter(row=>Object.values(row).some(v=>v!==''&&v!==null&&v!==undefined));
 }
 function number(value){
  if(value===''||value===null||value===undefined)return null;
  if(typeof value==='number')return Number.isFinite(value)?value:null;
  let s=String(value).replace(/R\$/gi,'').replace(/\s/g,'').replace(/%$/,'');
  if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');
  if(!/^-?\d+(?:\.\d+)?$/.test(s))return null;
  const n=Number(s);return Number.isFinite(n)?n:null;
 }
 function date(value){
  if(value===''||value===null||value===undefined)return '';
  if(typeof value==='number'&&value>20000&&value<100000){
   const d=new Date(Math.round((value-25569)*86400000));
   return Number.isFinite(d.getTime())?d.toISOString().slice(0,10):'';
  }
  let s=String(value).trim(),m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if(m)s=m[3]+'-'+m[2]+'-'+m[1];
  else s=s.slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return '';
  const d=new Date(s+'T12:00:00Z');
  return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s?s:'';
 }
 function signature(r){
  const key=text(r,'Chave de acesso NFC-e / NF-e / NFS-e').replace(/\D/g,'');
  if(key.length===44)return 'chave:'+key;
  const supplier=norm(text(r,'CNPJ fornecedor')||text(r,'Emitente / fornecedor / prestador'));
  const num=norm(text(r,'Número NF / fatura / nota'));
  const series=norm(text(r,'Série da NF'));
  const dt=date(field(r,'Data de emissão'));
  if(supplier&&num&&dt)return 'nota:'+supplier+'/'+series+'/'+num+'/'+dt;
  return 'origem:'+norm(text(r,'Arquivo de origem no RAR'))+'/'+norm(text(r,'ID da linha'))+'/'+norm(text(r,'Número NF / fatura / nota'));
 }
 function outgoing(r){const v=norm(text(r,'Destino financeiro sugerido'));return v.includes('contasapagar')&&!v.includes('receber');}
 function related(r){return !!text(r,'Tipo de duplicidade / conciliação')||!!text(r,'IDs documentos relacionados');}
 function lineName(doc){const r=doc.raw;return text(r,'Número NF / fatura / nota')||text(r,'ID da linha')||'Sem número';}
 function existing(s,doc){
  if((s.fiscalImports||[]).some(x=>x.signature===doc.signature))return 'Já importado no arquivo fiscal';
  const r=doc.raw,k=text(r,'Chave de acesso NFC-e / NF-e / NFS-e').replace(/\D/g,'');
  if(k.length===44&&(s.purchases||[]).some(p=>p.accessKey===k))return 'Nota já cadastrada';
  const supplied=norm(text(r,'CNPJ fornecedor')||text(r,'Emitente / fornecedor / prestador')),num=norm(text(r,'Número NF / fatura / nota')),series=norm(text(r,'Série da NF'));
  if(num&&(s.purchases||[]).some(p=>norm(p.number)===num&&norm(p.series)===series&&norm(p.supplierDocument||p.supplier)===supplied))return 'Nota já cadastrada';
  return '';
 }
 function selectedRows(){return documents.filter(d=>selection.has(d.id));}
 function stats(){
  const s=api.getState(),chosen=selectedRows(),duplicate=chosen.filter(d=>existing(s,d)||d.repeat).length;
  return '<strong>'+chosen.length+'</strong> selecionada(s) · '+duplicate+' possível(is) duplicidade(s) · '+documents.length+' documento(s) no Excel';
 }
 function show(){
  active=true;
  $('#readerTitle').textContent='Lançamento em lote — Notas e documentos';
  $('#readerContent').innerHTML='<div class="reader-page batch-notes">'+
   '<p class="notice neutral">Todas as notas da planilha são selecionadas inicialmente para serem cadastradas como <strong>Rascunho</strong> em Compras e Notas. Você pode desmarcar as que não deseja importar. Nenhuma delas gerará Contas a Pagar até ser conferida e confirmada individualmente.</p>'+
   '<div class="batch-upload"><label>Planilha Excel (.xlsx)<input type="file" id="batchNotesExcel" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></label>'+
   '<label>PDFs originais ou ZIP de PDFs (opcional)<input type="file" id="batchNotesPDFs" multiple accept=".pdf,.zip,application/pdf,application/zip"></label></div>'+
   '<p class="section-note" id="batchNotesFilename">'+h(filename?filename+' · '+documents.length+' registros reconhecidos':'Selecione a planilha para começar.')+'</p>'+
   '<div id="batchNotesTable"></div>'+
   '<p class="red-text" id="batchNotesError" role="alert"></p></div>';
  $('#reader').showModal();
  $('#batchNotesExcel').onchange=load;
  $('#batchNotesPDFs').onchange=loadAttachments;
  paint();
 }
 async function load(e){
  try{
   if(busy)return;
   const file=e.target.files?.[0];if(!file)return;
   if(file.size>25*1024*1024)throw Error('A planilha deve ter até 25 MB.');
   busy=true;const fileLabel=$('#batchNotesFilename');if(fileLabel)fileLabel.textContent='Lendo planilha…';
   const sheets=await readExcel(await file.arrayBuffer()),get=name=>parseSheet(sheets.find(s=>s.name.toLowerCase()===name.toLowerCase()));
   const list=get('Documentos');if(!list.length||!Object.hasOwn(list[0],'ID da linha'))throw Error('A aba Documentos não segue o modelo Engefex.');
   if(list.length>5000)throw Error('Limite de 5.000 documentos por lote.');
   const items=get('Itens'),due=get('Vencimentos'),texts=get('Textos extraídos');
   const byDoc=(arr,key)=>{const m=new Map();arr.forEach(row=>{const id=text(row,key);if(!m.has(id))m.set(id,[]);m.get(id).push(row)});return m};
   const im=byDoc(items,'ID documento'),dm=byDoc(due,'ID documento'),tm=byDoc(texts,'ID documento'),seen=new Set();
   documents=list.map((raw,i)=>{
    const id=text(raw,'ID da linha')||'linha-'+(i+2),sig=signature(raw),repeat=seen.has(sig);
    seen.add(sig);
    return {id:id+'-'+i,signature:sig,repeat,raw,items:im.get(id)||[],due:dm.get(id)||[],sourceText:tm.get(id)||[],project:api.getProject()==='all'?'':api.getProject(),stage:'',category:''};
   });
   filename=file.name;selection=new Set(documents.map(d=>d.id));search='';associatedFiles.clear();
   if($('#batchNotesFilename'))$('#batchNotesFilename').textContent=filename+' · '+documents.length+' documentos';
   paint();
  }catch(err){message(err.message)}finally{busy=false}
 }
 async function loadAttachments(e){
  try{
   if(busy)return;
   const files=[...(e.target.files||[])],cache=new Map();
   for(const file of files){
    if(file.name.toLowerCase().endsWith('.zip')){
     if(file.size>100*1024*1024)throw Error('ZIP excede 100 MB.');
     const zip=await root.JSZip.loadAsync(file);
     for(const entry of Object.values(zip.files)){
      if(entry.dir||!entry.name.toLowerCase().endsWith('.pdf'))continue;
      const bytes=await entry.async('uint8array');
      if(bytes.byteLength>20*1024*1024)continue;
      const base=entry.name.split('/').at(-1);
      cache.set(norm(base),new File([bytes],base,{type:'application/pdf'}));
     }
    }else if(file.name.toLowerCase().endsWith('.pdf'))cache.set(norm(file.name),file);
   }
   associatedFiles=cache;paint();
  }catch(err){message(err.message)}
 }
 function message(s){const el=$('#batchNotesError');if(el)el.textContent=s;else api?.toast(s)}
 function projectOptions(project,s){
  return '<option value="" '+(!project?'selected':'')+'>Não vincular ainda</option><option value="Geral" '+(project==='Geral'?'selected':'')+'>Geral — sem obra</option>'+s.projects.map(p=>'<option value="'+h(p.id)+'" '+(project===p.id?'selected':'')+'>'+h(p.name)+'</option>').join('');
 }
 function stageOptions(d,s){
  return '<option value="">Escolher etapa depois</option>'+s.budgetStages.filter(st=>st.project===d.project).map(st=>'<option value="'+h(st.id)+'" '+(d.stage===st.id?'selected':'')+'>'+h(st.name)+'</option>').join('');
 }
 function paint(){
  const container=$('#batchNotesTable');if(!container)return;
  if(!documents.length){container.innerHTML='<p class="empty">Nenhum documento carregado.</p>';return}
  const s=api.getState();
  const visible=documents.filter(d=>!search||norm(JSON.stringify([d.id,d.raw['Emitente / fornecedor / prestador'],d.raw['Número NF / fatura / nota'],d.raw['Arquivo de origem no RAR']])).includes(norm(search)));
  const dup=documents.filter(d=>!!existing(s,d)||d.repeat).length;
  container.innerHTML='<div class="batch-toolbar">'+
    '<div class="actions"><button type="button" class="button secondary" id="batchSelectAll">Marcar todas visíveis</button><button type="button" class="button secondary" id="batchClearAll">Desmarcar todas</button><button type="button" class="button secondary" id="batchSelectSafe">Marcar sem duplicidade</button></div>'+
    '<input type="search" id="batchSearch" placeholder="Filtrar fornecedor, nota ou arquivo..." value="'+h(search)+'">'+
    '<p id="batchNotesStats" class="section-note">'+stats()+' · '+dup+' documento(s) com duplicidade potencial.</p></div>'+
    '<div class="table-wrap batch-scroll"><table><thead><tr><th>Importar?</th><th>Documento</th><th>Fornecedor</th><th>Valor</th><th>Obra / destino</th><th>Etapa</th><th>Categoria</th><th>Conferência</th></tr></thead><tbody>'+
    visible.map(d=>{
     const r=d.raw,issue=existing(s,d)|| (d.repeat?'Repetida na planilha':related(r)?'Possível documento relacionado':'');
     const val=number(field(r,'Valor total do documento / a pagar'));
     return '<tr><td><input type="checkbox" aria-label="Importar documento '+h(lineName(d))+'" data-batch-check="'+h(d.id)+'" '+(selection.has(d.id)?'checked':'')+'></td>'+
     '<td><strong>'+h(text(r,'Tipo de documento'))+' '+h(lineName(d))+'</strong><small class="muted batch-sub">'+h(text(r,'Arquivo de origem no RAR'))+'</small></td>'+
     '<td>'+h(text(r,'Emitente / fornecedor / prestador')||'Não informado')+'</td>'+
     '<td class="num">'+(val===null?'—':money(val))+'</td>'+
     '<td><select data-batch-project="'+h(d.id)+'">'+projectOptions(d.project,s)+'</select></td>'+
     '<td><select data-batch-stage="'+h(d.id)+'" '+(!d.project||d.project==='Geral'?'disabled':'')+'>'+stageOptions(d,s)+'</select></td>'+ '<td><select data-batch-category="'+h(d.id)+'"><option value="">Conferir...</option>'+financialCategories(s).map(c=>'<option value="'+h(c)+'" '+(c===d.category?'selected':'')+'>'+h(c)+'</option>').join('')+'</select></td>'+ 
     '<td>'+ (issue?'<span class="tag amber">'+h(issue)+'</span>':(outgoing(r)?'<span class="tag">Rascunho · a pagar após confirmação</span>':'<span class="tag amber">Rascunho · conferir destino</span>'))+'</td></tr>';
    }).join('')+'</tbody></table></div>'+
    '<div class="batch-import-footer"><p class="muted small">Todas as selecionadas serão lançadas em Compras e Notas como rascunhos, inclusive com dados financeiros incompletos. Notas já cadastradas e documentos exatamente repetidos serão ignorados para evitar duplicação. Nenhuma despesa será gerada agora. PDFs serão enviados somente se você os selecionar.</p>'+
    '<button type="button" class="button primary" id="batchSaveSelected" '+(!selection.size?'disabled':'')+'>Cadastrar '+selection.size+' nota(s) como rascunho</button></div>';
  container.querySelectorAll('[data-batch-check]').forEach(el=>el.onchange=()=>{
   if(el.checked)selection.add(el.dataset.batchCheck);else selection.delete(el.dataset.batchCheck);
   paint();
  });
  container.querySelectorAll('[data-batch-project]').forEach(el=>el.onchange=()=>{
   const d=documents.find(d=>d.id===el.dataset.batchProject);
   if(d){d.project=el.value;d.stage='';paint()}
  });
  container.querySelectorAll('[data-batch-stage]').forEach(el=>el.onchange=()=>{
   const d=documents.find(d=>d.id===el.dataset.batchStage);if(d)d.stage=el.value;
  });
  container.querySelectorAll('[data-batch-category]').forEach(el=>el.onchange=()=>{
   const d=documents.find(d=>d.id===el.dataset.batchCategory);if(d)d.category=el.value;
  });
  $('#batchSelectAll').onclick=()=>{visible.forEach(d=>selection.add(d.id));paint()};
  $('#batchClearAll').onclick=()=>{selection.clear();paint()};
  $('#batchSelectSafe').onclick=()=>{selection.clear();documents.filter(d=>!existing(s,d)&&!d.repeat&&!related(d.raw)&&outgoing(d.raw)).forEach(d=>selection.add(d.id));paint()};
  $('#batchSearch').oninput=e=>{search=e.target.value;paint();$('#batchSearch')?.focus()};
  $('#batchSaveSelected').onclick=commit;
 }
 function schedule(doc,amount){
  const options=doc.due.filter(v=>date(field(v,'Data de vencimento'))).map((v,i)=>({
   due:date(field(v,'Data de vencimento')),amount:number(field(v,'Valor da parcela')),number:text(v,'Parcela nº')||String(i+1)
  }));
  if(options.length){
   if(options.length===1&&options[0].amount===null)options[0].amount=amount;
   if(options.some(p=>p.amount===null||p.amount<=0))return [];
   const sum=options.reduce((s,p)=>s+Math.round(p.amount*100),0);
   return sum===Math.round(amount*100)?options:[];
  }
  const due=date(field(doc.raw,'Primeiro vencimento'));
  return due?[{number:'1',due,amount}]:[];
 }
 function transactionDoc(s,doc){
  const raw=doc.raw, supplier=text(raw,'Emitente / fornecedor / prestador'),issued=date(field(raw,'Data de emissão')),
   total=number(field(raw,'Valor total do documento / a pagar')),numberDoc=text(raw,'Número NF / fatura / nota');
  if(!outgoing(raw))return {error:'Destino diferente de Contas a Pagar'};
  if(related(raw)||doc.repeat)return {error:'Possível duplicidade ou conciliação'};
  if(!supplier||!issued||total===null||total<=0)return {error:'Fornecedor, emissão ou valor ausente'};
  if(!doc.project||doc.project!=='Geral'&&!doc.stage)return {error:'Escolha Geral ou a obra e a etapa'};
  if(!financialCategories(s).includes(doc.category))return {error:'Selecione uma categoria cadastrada no Contas a Pagar'};
  if(doc.project!=='Geral'&&!s.projects.some(p=>p.id===doc.project))return {error:'Obra inexistente'};
  if(doc.stage&&!s.budgetStages.some(st=>st.id===doc.stage&&st.project===doc.project))return {error:'Etapa inválida'};
  const parts=schedule(doc,total);
  if(!parts.length)return {error:'Vencimentos / valores de parcelas incompletos'};
  const items=[];
  for(const r of doc.items){
   const desc=text(r,'Descrição item'),q=number(field(r,'Quantidade')),totalItem=number(field(r,'Valor total item'));
   if(!desc||q===null||q<=0||totalItem===null||totalItem<0)continue;
   items.push({id:uid(),description:desc,unit:text(r,'Unidade')||'un',quantity:q,unitPrice:totalItem/q,total:totalItem,budgetItem:''});
  }
  if(!items.length){
   const desc=text(raw,'Descrição do serviço')||text(raw,'Descrições produtos/serviços (resumo)');
   if(!desc)return {error:'Não há itens ou descrição para gerar a conta'};
   items.push({id:uid(),description:desc,unit:'un',quantity:1,unitPrice:total,total,budgetItem:''});
  }
  const adjustment=Math.round((total-items.reduce((n,i)=>n+i.total,0))*100)/100;
  if(!Number.isFinite(adjustment))return {error:'Total inválido'};
  const type=text(raw,'Tipo de documento');
  const k=text(raw,'Chave de acesso NFC-e / NF-e / NFS-e').replace(/\D/g,'');
  const p=P.fresh(doc.project==='Geral'?'Geral':doc.project);
  Object.assign(p,{
   id:uid(),project:doc.project,destination:doc.project==='Geral'?'general':'work',
   kind:(!numberDoc||!(/nf/i.test(type)))?'Compra':'Nota fiscal',number:numberDoc,
   series:text(raw,'Série da NF'),supplier,supplierDocument:text(raw,'CNPJ fornecedor'),
   date:issued,status:'Confirmada',accessKey:k.length===44?k:'',adjustment,items,
   installments:parts.map(part=>({id:uid(),number:part.number,due:part.due,amount:part.amount})),
   note:[text(raw,'Observações fiscais / do pedido'),text(raw,'Notas de conferência'),'Importação Engefex: '+doc.signature].filter(Boolean).join('\n')
  });
  if(doc.project!=='Geral')for(const item of p.items)item.allocations=[{destination:'work',project:doc.project,stage:doc.stage,share:100}];
  try{P.validate(s,p)}catch(error){return {error:'Não passou na validação financeira: '+error.message}}
  return {purchase:p};
 }
function draftFromDocument(doc,archive){
 const raw=doc.raw,total=number(field(raw,'Valor total do documento / a pagar'));
 const originalItems=doc.items||[],items=[];
 for(const line of originalItems){
  const desc=text(line,'Descrição item'),q=number(field(line,'Quantidade')),amount=number(field(line,'Valor total item'));
  if(!desc||q===null||q<=0||amount===null||amount<0)continue;
  items.push({id:uid(),description:desc,unit:text(line,'Unidade')||'un',quantity:q,unitPrice:amount/q,total:amount,budgetItem:''});
 }
 const allItemsValid=items.length>0&&items.length===originalItems.length;
 const sum=items.reduce((n,item)=>n+Math.round(item.total*100),0)/100;
 const adjustment=allItemsValid&&total!==null?Math.round((total-sum)*100)/100:0;
 const type=text(raw,'Tipo de documento'),numberDoc=text(raw,'Número NF / fatura / nota');
 const key=text(raw,'Chave de acesso NFC-e / NF-e / NFS-e').replace(/\D/g,'');
 const destination=text(raw,'Destino financeiro sugerido');
 const finance=outgoing(raw)?'payable':norm(destination).includes('receber')?'receivable':'unknown';
 const p=P.fresh(doc.project||'');
 Object.assign(p,{
  id:uid(),project:doc.project||'',destination:doc.project==='Geral'?'general':'work',
  kind:/nf/i.test(type)?'Nota fiscal':'Compra',number:numberDoc,
  series:text(raw,'Série da NF'),supplier:text(raw,'Emitente / fornecedor / prestador'),
  supplierDocument:text(raw,'CNPJ fornecedor'),date:date(field(raw,'Data de emissão')),
  status:'Rascunho',accessKey:key.length===44?key:'',items,adjustment,
  installments:[],attachments:(archive.attachments||[]).slice(),total,
  importedTotal:total,importedSourceId:archive.sourceId,importedFiscalId:archive.id,
  importedFinancialDirection:finance,importedCategory:doc.category||'',
  note:[text(raw,'Descrição do serviço'),text(raw,'Descrições produtos/serviços (resumo)'),
    text(raw,'Observações fiscais / do pedido'),text(raw,'Notas de conferência'),
    'Importação Engefex: '+doc.signature,
    originalItems.length!==items.length?'Itens incompletos: conferir dados originais no arquivo fiscal.':'',
    doc.due?.length?'Vencimentos originais disponíveis no arquivo fiscal para conferência.':''
  ].filter(Boolean).join('\n')
 });
 if(doc.project&&doc.project!=='Geral'&&doc.stage&&archive.stage){
  for(const item of p.items)item.allocations=[{destination:'work',project:doc.project,stage:doc.stage,share:100}];
 }
 return p;
}
async function commit(){
 if(busy)return;
 const chosen=selectedRows();
 if(!chosen.length)return message('Marque pelo menos uma nota.');
 const s=api.getState(),unique=[],duplicates=[],seen=new Set();
 for(const doc of chosen){
  const reason=existing(s,doc)||(doc.repeat||seen.has(doc.signature)?'Duplicada neste Excel':'');
  if(reason){duplicates.push(doc);continue}
  seen.add(doc.signature);unique.push(doc);
 }
 if(!unique.length)return message('Todas as notas escolhidas já estão cadastradas ou repetidas.');
 const confirmText='Cadastrar '+unique.length+' documento(s) como RASCUNHO em Compras e Notas?\n'+
  duplicates.length+' repetido(s) serão ignorados.\n'+
  'Nenhuma compra será confirmada e nenhuma conta a pagar será criada.\n'+
  'Você poderá conferir e confirmar cada nota depois.';
 if(!root.confirm(confirmText))return;
 busy=true;
 try{
  if(root.EngefexAccess&&!root.EngefexAccess.canWrite('supplies'))throw Error('Sem permissão para editar Compras e Notas.');
  root.EngefexCloud?.requireWrite();
  const next=D.clone(s);next.fiscalImports=next.fiscalImports||[];next.purchases=next.purchases||[];
  const pdfMap=new Map();
  for(const doc of unique){
   const source=norm(text(doc.raw,'Arquivo de origem no RAR'));
   const file=associatedFiles.get(source)||associatedFiles.get(norm(text(doc.raw,'Arquivo PDF extraído')));
   let attachment=null;
   if(file){
    const fileKey=norm(file.name);
    if(!pdfMap.has(fileKey)){
     const prepared=await root.LocalFiles.prepare(file);
     await root.LocalFiles.put([prepared]);
     pdfMap.set(fileKey,{id:prepared.id,name:prepared.name,type:prepared.type});
    }
    attachment=pdfMap.get(fileKey);
   }
   const archive={id:uid(),sourceId:text(doc.raw,'ID da linha'),signature:doc.signature,
    sourceExcel:filename,originalDocument:text(doc.raw,'Arquivo de origem no RAR'),
    importedAt:new Date().toISOString(),project:doc.project||'',stage:doc.stage||'',
    raw:doc.raw,items:doc.items,due:doc.due,status:'Rascunho em Compras e Notas',
    category:doc.category||'',purchaseId:'',attachments:attachment?[attachment]:[]};
   const purchase=draftFromDocument(doc,archive);
   P.validate(next,purchase);
   archive.purchaseId=purchase.id;
   next.purchases.push(purchase);
   next.fiscalImports.push(archive);
  }
  next.history.unshift({id:uid(),time:new Date().toISOString(),kind:'fiscalImport',record:filename,
   action:'Importação em lote: '+unique.length+' documentos cadastrados como rascunho em Compras e Notas',
   after:{source:filename,documents:unique.map(d=>d.signature),purchaseIds:next.purchases.slice(-unique.length).map(p=>p.id),skippedDuplicates:duplicates.length,createdPayables:0}});
  D.onlineValid(next);
  const saved=await api.save(next);
  if(saved===false)throw Error('O Supabase não confirmou o salvamento. Confira a conexão antes de tentar novamente.');
  busy=false;active=false;$('#reader').close();api.render();
  api.toast(unique.length+' nota(s) cadastrada(s) como rascunho. '+duplicates.length+' repetida(s) ignorada(s). Nenhuma conta a pagar foi criada.');
 }catch(err){message(err.message);busy=false}
}
 function reviewPending(id){
  const source=api.getState(),archive=(source.fiscalImports||[]).find(r=>r.id===id);
  if(!archive)return api.toast('Documento importado não encontrado.');
  if(archive.purchaseId)return api.toast('O documento já possui uma conta vinculada.');
  active=true;
  const raw=archive.raw,originalProject=archive.project||'',originalStage=archive.stage||'';
  $('#readerTitle').textContent='Conferir e lançar documento';
  $('#readerContent').innerHTML='<div class="reader-page batch-notes"><p class="notice neutral">Este formulário permite completar dados financeiros confirmados por você sem alterar os campos originais da nota. Nada será lançado sem confirmação.</p>'+
   '<form id="batchReviewForm"><div class="batch-upload">'+
   '<label>Fornecedor<input required id="reviewSupplier" value="'+h(text(raw,'Emitente / fornecedor / prestador'))+'"></label>'+
   '<label>Data da emissão<input required type="date" id="reviewDate" value="'+h(date(field(raw,'Data de emissão')))+'"></label>'+
   '<label>Valor total da nota (R$)<input required inputmode="decimal" id="reviewAmount" value="'+h(field(raw,'Valor total do documento / a pagar'))+'"></label>'+
   '<label>Obra / destino<select id="reviewProject" required>'+projectOptions(originalProject,source)+'</select></label>'+
   '<label>Etapa do orçamento<select id="reviewStage">'+stageOptions({project:originalProject,stage:originalStage},source)+'</select></label>'+
   '<label>Categoria<select id="reviewCategory" required><option value="">Selecionar...</option>'+financialCategories(source).map(x=>'<option value="'+h(x)+'" '+(x===archive.category?'selected':'')+'>'+h(x)+'</option>').join('')+'</select></label>'+
   '<label>Vencimento único revisado<input type="date" id="reviewDue"></label>'+
   '<label class="batch-check-finance"><input type="checkbox" id="reviewOneInstallment"> Substituir as parcelas incompletas por um único vencimento que conferi</label>'+
   '</div>'+(related(raw)?'<label class="batch-check-finance"><input type="checkbox" id="reviewRelated"> Conferi os documentos relacionados e confirmei que não é uma duplicidade</label>':'')+
   '<p class="section-note">Se houver parcelas corretamente identificadas na planilha, elas serão preservadas. Valores inexistentes precisam ser informados e confirmados por você.</p>'+
   '<p id="reviewError" class="red-text" role="alert"></p><button type="submit" class="button primary">Confirmar e gerar conta</button></form></div>';
  $('#reader').showModal();
  $('#reviewProject').onchange=()=>{
   const project=$('#reviewProject').value;
   $('#reviewStage').innerHTML=stageOptions({project,stage:''},source);
   $('#reviewStage').disabled=!project||project==='Geral';
  };
  $('#reviewStage').disabled=!originalProject||originalProject==='Geral';
  $('#batchReviewForm').onsubmit=async e=>{
   e.preventDefault();if(busy)return;
   const value=id=>$(id).value;
   if(related(raw)&&!$('#reviewRelated')?.checked){$('#reviewError').textContent='Confirme a revisão de possíveis duplicidades.';return;}
   const checkedRaw={...raw,
    'Emitente / fornecedor / prestador':value('#reviewSupplier').trim(),
    'Data de emissão':value('#reviewDate'),
    'Valor total do documento / a pagar':number(value('#reviewAmount'))};
   if($('#reviewRelated')?.checked){checkedRaw['Tipo de duplicidade / conciliação']='';checkedRaw['IDs documentos relacionados']='';}
   const dueRows=$('#reviewOneInstallment').checked?[{
    'Data de vencimento':value('#reviewDue'),'Valor da parcela':number(value('#reviewAmount')),'Parcela nº':'1'
   }]:archive.due;
   if($('#reviewOneInstallment').checked&&!date(value('#reviewDue'))){$('#reviewError').textContent='Informe o vencimento revisado.';return;}
   const doc={raw:checkedRaw,items:archive.items||[],due:dueRows||[],repeat:false,
    signature:archive.signature,project:value('#reviewProject'),stage:value('#reviewStage'),category:value('#reviewCategory')};
   const valid=transactionDoc(source,doc);
   if(valid.error){$('#reviewError').textContent=valid.error;return;}
   if(!root.confirm('Lançar esta nota em Contas a Pagar no valor de '+money(number(value('#reviewAmount')))+'?'))return;
   busy=true;
   try{
    root.EngefexCloud?.requireWrite();
    const purchase={...valid.purchase,attachments:(archive.attachments||[]).slice()};
    const next=P.save(source,purchase);
    const original=next.fiscalImports.find(x=>x.id===archive.id);
    if(!original)throw Error('Registro de origem desapareceu.');
    Object.assign(original,{
     status:'Lançado em Contas a Pagar',purchaseId:purchase.id,project:doc.project,stage:doc.stage,
     financialCorrections:{
      supplier:checkedRaw['Emitente / fornecedor / prestador'],date:checkedRaw['Data de emissão'],
      amount:checkedRaw['Valor total do documento / a pagar'],due:$('#reviewOneInstallment').checked?value('#reviewDue'):'',
      category:value('#reviewCategory'),relatedDocumentsReviewed:!!$('#reviewRelated')?.checked
     }
    });
    for(const c of next.costs.filter(c=>c.purchase===purchase.id)){
     c.category=value('#reviewCategory');D.validateRecord(next,'costs',c);
    }
    D.onlineValid(next);
    if(await api.save(next)===false)throw Error('O servidor não confirmou o lançamento.');
    busy=false;active=false;$('#reader').close();api.render();api.toast('Documento conferido e conta lançada.');
   }catch(err){busy=false;$('#reviewError').textContent=err.message}
  };
 }
 function archive(state){
  const rows=state.fiscalImports||[];
  if(!rows.length)return '';
  const confirmed=rows.filter(r=>(state.purchases||[]).some(p=>p.id===r.purchaseId&&p.status==='Confirmada')||r.status==='Lançado em Contas a Pagar').length;
  const drafts=rows.filter(r=>(state.purchases||[]).some(p=>p.id===r.purchaseId&&p.status==='Rascunho')).length;
  return '<details class="panel batch-archive"><summary>📁 Documentos fiscais importados: '+rows.length+' · '+drafts+' rascunhos · '+confirmed+' confirmados · '+(rows.length-drafts-confirmed)+' para conferir</summary>'+
   '<div class="table-wrap"><table><thead><tr><th>Documento</th><th>Fornecedor</th><th>Valor</th><th>Obra</th><th>Situação</th><th>Ações</th></tr></thead><tbody>'+
   rows.slice().reverse().slice(0,350).map(r=>{
    const purchase=(state.purchases||[]).find(p=>p.id===r.purchaseId),status=purchase?(purchase.status==='Confirmada'?'Confirmada / Contas a Pagar':purchase.status):r.status;
    return '<tr><td>'+h(text(r.raw,'Tipo de documento'))+' '+h(text(r.raw,'Número NF / fatura / nota')||r.sourceId)+'</td><td>'+h(text(r.raw,'Emitente / fornecedor / prestador'))+'</td><td>'+h(field(r.raw,'Valor total do documento / a pagar'))+'</td><td>'+h(state.projects.find(p=>p.id===r.project)?.name||r.project||'A definir')+'</td><td>'+h(status)+'</td><td><button class="text-btn" data-action="batch-view:'+h(r.id)+'">Ver dados fiscais</button> '+(purchase?'<button class="text-btn" data-action="purchase-edit:'+h(purchase.id)+'">Editar '+(purchase.status==='Rascunho'?'rascunho':'compra')+'</button>':'<button class="text-btn" data-action="batch-pending:'+h(r.id)+'">Conferir / lançar</button>')+'</td></tr>';
   }).join('')+'</tbody></table></div></details>';
 }
 function detail(id){
  const doc=(api.getState().fiscalImports||[]).find(x=>x.id===id);if(!doc)return api.toast('Documento não encontrado.');
  $('#readerTitle').textContent='Documento importado · '+(text(doc.raw,'Número NF / fatura / nota')||doc.sourceId);
  const tr=(a,b)=>'<tr><th style="width:35%;white-space:normal">'+h(a)+'</th><td style="white-space:pre-wrap">'+h(String(b??''))+'</td></tr>';
  $('#readerContent').innerHTML='<div class="reader-page batch-notes"><p class="notice neutral">'+h(doc.status)+' · '+h(doc.originalDocument)+'</p>'+
   '<h3>Todos os campos do documento</h3><div class="table-wrap"><table><tbody>'+Object.entries(doc.raw).filter(([,v])=>v!==''&&v!==null).map(([k,v])=>tr(k,v)).join('')+'</tbody></table></div>'+
   '<h3 style="margin-top:18px">Itens ('+doc.items.length+')</h3><div class="table-wrap"><table><tbody>'+doc.items.map(v=>'<tr><td>'+h(v['Descrição item'])+'</td><td>'+h(v.Quantidade)+'</td><td>'+h(v.Unidade)+'</td><td>'+h(v['Valor total item'])+'</td></tr>').join('')+'</tbody></table></div>'+
   '<h3 style="margin-top:18px">Vencimentos ('+doc.due.length+')</h3><div class="table-wrap"><table><tbody>'+doc.due.map(v=>'<tr><td>'+h(v['Data de vencimento'])+'</td><td>'+h(v['Valor da parcela'])+'</td></tr>').join('')+'</tbody></table></div>'+
   (doc.attachments||[]).map(a=>'<button class="button secondary" type="button" data-batch-download="'+h(a.id)+'">Baixar '+h(a.name)+'</button>').join('')+'</div>';
  $('#reader').showModal();
  $('#readerContent').querySelectorAll('[data-batch-download]').forEach(el=>el.onclick=async()=>{
   try{const m=doc.attachments.find(a=>a.id===el.dataset.batchDownload);await root.LocalFiles.download(m.id,m)}
   catch(e){api.toast(e.message)}
  });
 }
 root.EngefexBatchNotes={open:show,renderArchive:archive,isDirty:()=>active&&!!$('#reader')?.open,busy:()=>busy,
  handle(action){if(action==='batch-notes'){show();return true}if(action?.startsWith('batch-view:')){detail(action.slice(11));return true}if(action?.startsWith('batch-pending:')){reviewPending(action.slice(14));return true}return false},
  init(bridge){api=bridge}};
})(typeof window==='undefined'?globalThis:window);
