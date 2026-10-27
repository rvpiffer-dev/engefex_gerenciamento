/* Importação de múltiplos XMLs NF-e para Compras e Notas, sem confirmação financeira automática. */
(function(root){'use strict';
const D=root.Obras,P=()=>root.EngefexPurchases,$=sel=>document.querySelector(sel);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
const norm=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const onlyDigits=x=>String(x||'').replace(/\D/g,'');
const MAX_FILES=100,MAX_FILE_BYTES=5000000,MAX_BATCH_BYTES=50000000;
let api,rows=[],snapshot=null,processing=false,reading=false,session=0,originalProject='';
function identifiers(p){
 const keys=[];if(/^\d{44}$/.test(p.accessKey||''))keys.push('chave:'+p.accessKey);
 const issuer=onlyDigits(p.supplierDocument)||norm(p.supplier);
 if(issuer&&p.number)keys.push('documento:'+issuer+'|'+norm(p.series)+'|'+norm(p.number)+'|'+norm(p.kind));
 return keys;
}
function signatures(state){let known=new Set();for(const p of state.purchases||[])for(const key of identifiers(p))known.add(key);return known}
function createPreview(state,files,content){
 const found=signatures(state),rows=[];
 for(let i=0;i<files.length;i++){
  const file=files[i],raw=content[i],row={id:'xml-'+i,name:file.name||'Documento '+(i+1),file,checked:false,purchase:null,reason:'',duplicate:false};
  try{
   if(!/\.xml$/i.test(row.name))throw Error('Arquivo não é XML.');
   if(file.size>MAX_FILE_BYTES||file.size<=0)throw Error('XML vazio ou acima do limite de 5 MB.');
   if(typeof raw!=='string'||!raw.trim())throw Error('Não foi possível ler o XML.');
   let p=P().parseXML(raw);
   if(p.status!=='Rascunho')throw Error('O XML não pode ser confirmado automaticamente.');
   P().validate(state,p);
   const keys=identifiers(p);
   if(keys.some(key=>found.has(key))){row.reason='Nota já cadastrada ou repetida neste lote';row.duplicate=true;}
   else{for(const key of keys)found.add(key);row.checked=true;}
   row.purchase=p;
  }catch(err){row.reason=err.message||String(err)}
  rows.push(row);
 }
 return rows;
}
function projectDestination(value){return value==='__stock__'?{destination:'stock',project:'Geral'}:value==='__general__'?{destination:'general',project:'Geral'}:{destination:'work',project:value||''}}
function plan(state,items,dest){
 const selected=items.filter(r=>r.checked&&!r.reason&&r.purchase);
 if(!selected.length)throw Error('Selecione ao menos um XML válido e não repetido.');
 const destination=projectDestination(dest),current=signatures(state),batchSeen=new Set();let next=D.clone(state);
 for(const row of selected){
  const p={...D.clone(row.purchase),...destination,status:'Rascunho'};
  p.attachments=(row.attachments||p.attachments||[]).slice();
  p.importedXMLFilename=row.name;
  p.supplierId=root.EngefexSuppliers?.match?.(next,p.supplier,p.supplierDocument)?.id||'';
  const keys=identifiers(p);
  if(keys.some(key=>current.has(key)||batchSeen.has(key)))throw Error('A nota '+(p.number||row.name)+' já existe ou está repetida. Atualize a lista.');
  for(const key of keys)batchSeen.add(key);
  try{
   P().validate(next,p);
   p.total=p.items.length?P().totals(p):null;
   p.updatedAt=new Date().toISOString();
   next.purchases.push(p);
  }catch(e){throw Error(row.name+': '+e.message)}
 }
 next.history.unshift({id:root.crypto?.randomUUID?.()||'XML-'+Date.now(),time:new Date().toISOString(),kind:'purchaseXMLBatch',record:'xml-batch',action:'Importação de '+selected.length+' XMLs como rascunho',before:null,after:{purchaseIds:selected.map(r=>r.purchase.id),files:selected.map(r=>r.name),createdPayables:0}});
 if(D.onlineValid)D.onlineValid(next);
 return next;
}
async function loadFiles(files,state){
 if(!files.length)return [];
 if(files.length>MAX_FILES)throw Error('Limite de '+MAX_FILES+' XMLs por importação. Divida em lotes menores.');
 if(files.reduce((sum,f)=>sum+Number(f.size||0),0)>MAX_BATCH_BYTES)throw Error('O lote excede 50 MB. Divida os XMLs em lotes menores.');
 const strings=[];
 for(const f of files){
  if(f.size>MAX_FILE_BYTES){strings.push('');continue}
  try{strings.push(await f.text())}catch{strings.push('')}
 }
 return createPreview(state,files,strings);
}
function currentRows(){return rows.filter(r=>r.checked&&!r.reason&&r.purchase)}
function summary(){const ok=rows.filter(r=>r.purchase&&!r.reason).length,duplicated=rows.filter(r=>r.duplicate).length,errors=rows.filter(r=>r.reason&&!r.duplicate).length,chosen=currentRows();let total=0;for(const row of chosen)total+=Math.round(P().totals(row.purchase)*100);
 return '<strong>'+rows.length+'</strong> arquivo(s) · '+ok+' válido(s) · '+duplicated+' repetido(s) · '+errors+' com erro · <strong>'+chosen.length+' selecionado(s)</strong> · '+money(total/100);
}
function drawTable(){
 const box=$('#batchXMLTable');if(!box)return;
 if(!rows.length){box.innerHTML='<p class="section-note">Selecione vários arquivos XML de NF-e no mesmo envio. NFS-e e eventos fiscais não são aceitos pelo leitor atual.</p>';return}
 box.innerHTML='<p class="section-note" id="batchXMLCount">'+summary()+'</p><div class="actions" style="margin:8px 0"><button type="button" class="button secondary" id="batchXMLSelectAll">Selecionar válidos</button><button type="button" class="button secondary" id="batchXMLSelectNone">Desmarcar todos</button></div><div class="table-wrap"><table><thead><tr><th>Importar</th><th>Arquivo</th><th>Nota / série</th><th>Fornecedor</th><th>Emissão</th><th>Total</th><th>Leitura</th></tr></thead><tbody>'+rows.map((r,i)=>'<tr><td><input type="checkbox" data-batch-xml-row="'+i+'" '+(r.checked?'checked':'')+' '+(r.reason?'disabled':'')+' aria-label="Importar '+esc(r.name)+'"></td><td class="wrap">'+esc(r.name)+'</td><td>'+esc(r.purchase?[r.purchase.number,r.purchase.series].filter(Boolean).join(' / '):'—')+'</td><td class="wrap">'+esc(r.purchase?.supplier||'—')+'</td><td>'+esc(r.purchase?.date||'—')+'</td><td>'+esc(r.purchase?money(P().totals(r.purchase)):'—')+'</td><td>'+(r.reason?'<span class="red-text">'+esc(r.reason)+'</span>':r.purchase?.accessKey?'Pronto · chave identificada':'Pronto · sem chave de acesso')+'</td></tr>').join('')+'</tbody></table></div>';
 for(const cb of document.querySelectorAll('[data-batch-xml-row]'))cb.onchange=()=>{let r=rows[Number(cb.dataset.batchXmlRow)];if(!r||r.reason)return;r.checked=cb.checked;refreshTotal()};
 $('#batchXMLSelectAll').onclick=()=>{rows.forEach(r=>r.checked=!r.reason);drawTable()};
 $('#batchXMLSelectNone').onclick=()=>{rows.forEach(r=>r.checked=false);drawTable()};
 refreshTotal();
}
function refreshTotal(){let c=$('#batchXMLCount');if(c)c.innerHTML=summary();let button=$('#batchXMLSave');if(button)button.disabled=processing||reading||!currentRows().length}
function renderDialog(){
 const s=snapshot||api.getState(),project=api.getProject();
 originalProject=project!=='all'&&s.projects.some(p=>p.id===project)?project:'';
 $('#readerTitle').textContent='Importar vários XMLs NF-e';
 $('#readerContent').innerHTML='<div class="reader-page batch-xml-editor">'+
 '<p class="notice neutral">Selecione vários XMLs de NF-e. Todos serão cadastrados individualmente como <strong>Rascunho</strong>, sem lançamento automático no Contas a Pagar. Confira os dados e o rateio antes do fechamento do fornecedor.</p>'+
 '<label>Selecionar XMLs de notas fiscais (até 100 por lote)<input type="file" id="batchXMLFiles" accept=".xml,application/xml,text/xml" multiple></label>'+
 '<label>Destinação inicial das notas<select id="batchXMLProject"><option value="">Definir obra individualmente depois</option>'+
 s.projects.map(p=>'<option value="'+esc(p.id)+'" '+(p.id===originalProject?'selected':'')+'>'+esc(p.name)+'</option>').join('')+
 '<option value="__stock__">Estoque</option><option value="__general__">Geral (sem obra)</option></select></label>'+
 '<p class="section-note">A destinação é aplicada às notas selecionadas. Os itens permanecem sem grupo do orçamento até serem conferidos e rateados.</p>'+
 '<p class="section-note" id="batchXMLStatus"></p><div id="batchXMLTable"></div>'+
 '<p class="red-text" id="batchXMLError" role="alert"></p>'+
 '<div class="actions"><button type="button" class="button primary" id="batchXMLSave" disabled>Cadastrar selecionados como Rascunho</button></div></div>';
 drawTable();
 $('#batchXMLFiles').onchange=async e=>{
  if(processing||reading)return;let files=Array.from(e.target.files||[]),turn=++session;
  rows=[];drawTable();let status=$('#batchXMLStatus'),err=$('#batchXMLError');if(err)err.textContent='';
  if(!files.length)return;
  reading=true;if(status)status.textContent='Lendo '+files.length+' arquivo(s) XML…';refreshTotal();
  try{const result=await loadFiles(files,snapshot);if(turn!==session||!$('#reader')?.open)return;rows=result;drawTable();if(status)status.textContent='Leitura concluída. Revise a lista e escolha quais notas deseja importar.'}
  catch(error){if(err)err.textContent=error.message}
  finally{if(turn===session){reading=false;refreshTotal()}}
 };
 $('#batchXMLSave').onclick=save;
}
function open(){if(processing||reading)throw Error('Uma importação está em andamento.');snapshot=D.clone(api.getState());rows=[];++session;renderDialog();$('#reader').showModal()}
async function save(){
 if(processing||reading)return;
 const error=$('#batchXMLError'),status=$('#batchXMLStatus');if(error)error.textContent='';
 try{
  const chosen=currentRows();if(!chosen.length)throw Error('Marque pelo menos uma nota válida.');
  if(JSON.stringify(api.getState())!==JSON.stringify(snapshot))throw Error('Os dados foram alterados por outro usuário. Feche e reabra a importação antes de salvar.');
  let dest=$('#batchXMLProject')?.value||'';
  plan(snapshot,chosen,dest); // valida tudo antes de preparar anexos
  processing=true;refreshTotal();if(status)status.textContent='Preparando XMLs originais e salvando os rascunhos…';
  const prepared=[];const preparedRows=[];
  for(const row of chosen){
   const stored=await root.LocalFiles.prepare(row.file);
   prepared.push(stored);
   preparedRows.push({...row,attachments:[{id:stored.id,name:stored.name,type:stored.type}]});
  }
  if(!root.LocalFiles?.put)throw Error('Armazenamento de XMLs não disponível.');
  await root.LocalFiles.put(prepared);
  const next=plan(snapshot,preparedRows,dest);
  const confirmed=await api.save(next);
  if(confirmed===false)throw Error('O Supabase não confirmou a importação. Confira a conexão e reabra a tela antes de repetir.');
  processing=false;rows=[];snapshot=null;++session;$('#reader').close();api.render();
  api.toast(chosen.length+' XML(s) importado(s) como Rascunho. Nenhuma conta a pagar foi gerada.');
 }catch(e){if(error)error.textContent=e.message||String(e);if(status)status.textContent='Revise os erros antes de tentar novamente.';processing=false;refreshTotal()}
}
root.EngefexBatchXML={identifiers,signatures,createPreview,projectDestination,plan,loadFiles,open,busy:()=>processing||reading,isDirty:()=>!!$('#reader')?.open&&!!$('.batch-xml-editor'),handle(action){if(action!=='purchase-xml-batch')return false;try{open()}catch(e){api.toast(e.message)}return true},init(bridge){api=bridge}};
})(typeof window==='undefined'?globalThis:window);
