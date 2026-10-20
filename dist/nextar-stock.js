
(function(root){'use strict';
const VERSION=1,KEY=root.EngefexEnvironment?.storageKey('engefex-nextar-snapshot-v1')||'engefex-nextar-snapshot-v1',decoder=new TextDecoder('utf-16le');
const units=new Set(['Lata','Metro','Peça','Kg','Unidade','Un','M','m','KG','Pacote','Caixa','Rolo','Barra','Pç','Litro','Par','Jogo','Saco','Tubo','Chapa','Galão']);
let snapshot=null,loaded=false,busy=false,find='',onlyStock=false,showDuplicates=false,fetching=false,error='',lastFetch=0,progressValue=0,progressLabel='';
function escape(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function strings(bytes){let out=[];for(let i=0;i<bytes.length-3;){if(bytes[i]>=32&&bytes[i+1]===0){let p=i;do{i+=2}while(i+1<bytes.length&&bytes[i]>=32&&bytes[i+1]===0);if(i-p>=4)out.push({pos:p,end:i,value:decoder.decode(bytes.subarray(p,i))});}else i++;}return out;}
function rawAt(view,p){return p>=0&&p+8<=view.byteLength?view.getFloat64(p,true):NaN;}
function floatAt(view,p){let n=rawAt(view,p);return Math.abs(n)<1e-25?0:n;}
function proper(n){return Number.isFinite(n)&&n>=0&&n<1e8&&(n===0||n>1e-25)&&Math.abs(n-Math.round(n*100)/100)<1e-5;}
function quartet(view,at){let a=[0,8,16,24].map(k=>floatAt(view,at+k));return a.every(proper)&&Math.abs(a[2]-a[0]-a[1])<=.0001?Math.round(a[0]*100)/100:null;}
function fallbackQuartet(view,at){let a=[0,8,16,24].map(k=>rawAt(view,at+k));return a.every(proper)&&!a.every(n=>n===0)&&Math.abs(a[2]-a[0]-a[1])<=.0001?Math.round(a[0]*100)/100:null;}
function catalogue(bytes){return strings(bytes).map(x=>x.value).filter(x=>x.length>=3&&x.length<48&&/^[\p{L}\p{N} \-`'./]+$/u.test(x));}

/* NexusDB heap: o campo Obs contém uma referência (posição do item, página NXHD).
   Não associar memos pela proximidade física no arquivo, pois fotos e outros blobs
   de produtos diferentes podem ocupar a mesma página. */
function memoReader(bytes){
 const pageSize=4096,totalPages=Math.floor(bytes.length/pageSize),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const cache=new Map(),memoDecoder=new TextDecoder('utf-16le',{fatal:true});
 const pageContents=page=>{
  if(cache.has(page))return cache.get(page);
  const items=[];cache.set(page,items);
  if(page<0||page>=totalPages)return items;
  const base=page*pageSize;
  if(bytes[base]!==78||bytes[base+1]!==88||bytes[base+2]!==72||bytes[base+3]!==68)return items;
  const count=view.getUint32(base+16,true);
  if(count<1||count>120)return items;
  let offset=20;
  for(let index=1;index<=count;index++){
   let best=null;
   for(let delta=-4;delta<64;delta++){
    const cursor=offset+delta;
    if(cursor<20||cursor+3>=pageSize)continue;
    const size=view.getUint16(base+cursor,true),type=bytes[base+cursor+2];
    if(size<1||!(type===4||type===5)||cursor+3+size>pageSize)continue;
    if(delta>=40){let hasContent=false;for(let k=offset;k<cursor;k++)if(bytes[base+k]!==0){hasContent=true;break}if(hasContent)continue}
    const start=base+cursor+3;
    let score=Math.abs(delta)*3;
    if(type===4){
     const a=bytes[start],b=bytes[start+1];
     if((a===255&&b===216)||(a===77&&b===227)||(b===0&&[80,49,73,32].includes(a)))score-=2;
    }
    if(!best||score<best.score)best={score,cursor,size,type,start};
   }
   if(!best)break;
   items.push(best);offset=best.cursor+3+best.size;
  }
  return items;
 };
 const decode=blob=>{
  if(!blob||blob.type!==4||blob.size<7)return '';
  const byteLength=blob.size-(blob.size%2);
  let t;
  try{t=memoDecoder.decode(bytes.subarray(blob.start,blob.start+byteLength)).replace(/^\uFEFF/,'').replace(/[\x00\s]+$/g,'').trim()}catch{return ''}
  if(!t||t.length>2048)return '';
  let printable=0,meaningful=0,hasLetter=false;
  for(const ch of t){
   if(ch==='\r'||ch==='\n'||ch==='\t'||ch.codePointAt(0)>=32)printable++;
   if(/[\p{L}\p{N}\s,.;:/%+\-$()°"']/u.test(ch))meaningful++;
   if(/\p{L}/u.test(ch))hasLetter=true;
  }
  return hasLetter&&printable>=t.length*.96&&meaningful>=t.length*.8?t:'';
 };
 return (begin,end)=>{
  const until=Math.min(end,begin+300,(Math.floor(begin/pageSize)+1)*pageSize-8,bytes.length-8);
  let text='',foundRef=false,unreadable=false;
  for(let at=begin+35;at<until;at++){
   const slot=view.getUint32(at,true),page=view.getUint32(at+4,true);
   if(slot<1||slot>40||page<14||page>=totalPages)continue;
   const entries=pageContents(page);
   if(slot>entries.length){if(slot<=view.getUint32(page*pageSize+16,true))unreadable=true;continue}
   foundRef=true;
   const value=decode(entries[slot-1]);
   if(!value)continue;
   if(text&&text!==value)return {observation:'',observationStatus:'unreadable'};
   text=value;
  }
  return {observation:text,observationStatus:text?'found':unreadable?'unreadable':'empty'};
 };
}

async function parseProduto(bytes,categories,onProgress=()=>{}){
 const lines=strings(bytes),cats=new Set(categories),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),codes=[],readMemo=memoReader(bytes);
 for(let i=0;i<lines.length;i++)if(/^0{2,3}[0-9]{3,4}$/.test(lines[i].value))codes.push(i);
 const rows=[],unresolved=[];
 for(let j=0;j<codes.length;j++){
  if(j%30===0){onProgress(codes.length?j/codes.length:0);await new Promise(done=>setTimeout(done,0));}
  const i=codes[j],tag=lines[i],end=j+1<codes.length?lines[codes[j+1]].pos:bytes.length,w=[];
  for(let n=i+1;n<lines.length&&lines[n].pos<Math.min(end,tag.end+260)&&w.length<15;n++)w.push(lines[n]);
  const cut=w.findIndex(x=>units.has(x.value));
  let unit=cut>=0?w[cut].value:'';
  // Algumas unidades precedem o código do registro no backup do Nextar.
  if(!unit)for(let k=i-1;k>=Math.max(0,i-8);k--){if(tag.pos-lines[k].pos>=70)break;if(units.has(lines[k].value)){unit=lines[k].value;break;}}
  const candidates=(cut<0?w:w.slice(0,cut)).filter(x=>x.value.length>=6&&!cats.has(x.value)&&! /^\d{5,15}$/.test(x.value)&&!x.value.startsWith('@'));
  if(!candidates.length)continue;
  const name=candidates.reduce((best,x)=>!best||x.value.length>best.value.length||x.value.length===best.value.length&&x.pos>best.pos?x:best,null).value;
  const options=[];
  for(let n=i+1;n<lines.length&&lines[n].pos<Math.min(end,tag.pos+1600);n++){const x=lines[n];if(x.end<tag.pos+98||!cats.has(x.value))continue;let q=quartet(view,x.end+3);if(q!==null)options.push(q);}
  let stock=null,reason='';
  if(options.length===1)stock=options[0];else if(options.length>1)reason='Saldo ambíguo';else{
   const hits=[];
   for(let at=tag.pos+110;at<Math.min(end-35,tag.pos+700);at++){let q=fallbackQuartet(view,at);if(q!==null)hits.push(q);}
   if(hits.length===1)stock=hits[0];else reason='Saldo não identificado com segurança';
  }
  const memo=readMemo(tag.pos,end);
  rows.push({code:tag.value,description:name,unit,stock,...memo});
  if(reason)unresolved.push({code:tag.value,description:name,reason});
 }
 if(!rows.length)throw Error('Nenhum produto reconhecido em Produto.nx1. O formato deste backup pode ser diferente.');
 const counts=new Map();for(const r of rows)counts.set(r.code,(counts.get(r.code)||0)+1);
 rows.sort((a,b)=>a.code.localeCompare(b.code)||a.description.localeCompare(b.description));
 return {rows,unresolved,duplicates:[...counts].filter(([,n])=>n>1).map(([code,count])=>({code,count}))};
}
async function parse(input,onProgress=()=>{}){
 const report=(n,label)=>onProgress(Math.min(100,Math.max(0,Math.round(n))),label);
 if(!root.JSZip)throw Error('Leitor ZIP indisponível. Atualize a página.');
 if(input?.size>250*1024*1024)throw Error('O ZIP ultrapassa 250 MB.');
 report(2,'Lendo o arquivo ZIP…');
 const inputBytes=await new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onprogress=e=>{if(e.lengthComputable)report(2+e.loaded/e.total*16,'Lendo o arquivo ZIP…')};
  reader.onload=()=>resolve(reader.result);
  reader.onerror=()=>reject(new Error('Não foi possível abrir o arquivo selecionado.'));
  reader.readAsArrayBuffer(input);
 });
 report(20,'Identificando tabelas do Nextar…');
 const zip=await root.JSZip.loadAsync(inputBytes,{checkCRC32:false});
 const product=zip.file(/(^|\/)Produto\.nx1$/i)[0],category=zip.file(/(^|\/)Categoria\.nx1$/i)[0];
 if(!product)throw Error('Produto.nx1 não encontrado no ZIP.');
 if(!category)throw Error('Categoria.nx1 não encontrado no ZIP.');
 if(product._data?.uncompressedSize>35*1024*1024||category._data?.uncompressedSize>2*1024*1024)throw Error('Uma das tabelas excede o limite de leitura.');
 const bytes=await product.async('uint8array',meta=>report(24+meta.percent*.30,'Extraindo cadastro de produtos…'));
 const catBytes=await category.async('uint8array',meta=>report(56+meta.percent*.10,'Extraindo categorias…'));
 if(bytes.length>35*1024*1024||catBytes.length>2*1024*1024)throw Error('Backup excede o limite de leitura.');
 report(68,'Reconhecendo categorias e campos…');
 await new Promise(done=>setTimeout(done,0));
 const cats=catalogue(catBytes);if(!cats.length)throw Error('Categorias não reconhecidas. Leitura interrompida para evitar dados incorretos.');
 report(74,'Interpretando quantidades dos produtos…');
 const result=await parseProduto(bytes,cats,ratio=>report(74+ratio*18,'Interpretando quantidades dos produtos…'));
 report(93,'Conferindo dados recuperados…');
 return result;
}
function retrieve(){return snapshot;}

async function refresh(force=false){
 if(!root.EngefexCloud?.ready)return;
 if(fetching||busy||(!force&&Date.now()-lastFetch<30000))return;
 fetching=true;
 try{
  snapshot=await root.EngefexCloud.loadNextar();
  loaded=true;error='';lastFetch=Date.now();
 }catch(e){loaded=true;error=e.message;}
 finally{
  fetching=false;
  if(location.hash==='#nextarstock'){
   const old=document.querySelector('#main .nextar-page');
   if(old){
    const originalY=root.scrollY||0,scroller=old.querySelector('.nextar-table-wrap'),x=scroller?.scrollLeft||0,y=scroller?.scrollTop||0;
    const container=document.createElement('div');container.innerHTML=render();
    const replacement=container.firstElementChild;
    if(replacement){old.replaceWith(replacement);bind();const updated=replacement.querySelector('.nextar-table-wrap');if(updated){updated.scrollLeft=x;updated.scrollTop=y;}root.scrollTo({top:originalY,behavior:'instant'});}
   }
  }
 }
}
function cleanText(x){return String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
function filterRows(){let s=retrieve();if(!s)return [];const q=cleanText(find),dup=new Set((s.duplicates||[]).map(x=>x.code));return s.rows.filter(r=>(!onlyStock||r.stock!==null&&r.stock>0)&&(!showDuplicates||dup.has(r.code))&&(!q||cleanText(r.code+' '+r.description).includes(q)));}
function number(v){return v===null?'<span class="tag amber">Não identificado</span>':new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(v);}

function summary(){
 const s=retrieve();
 if(!s)return {products:0,available:0,empty:0,unknown:0};
 return {products:s.rows.length,available:s.rows.filter(r=>typeof r.stock==='number'&&r.stock>0).length,empty:s.rows.filter(r=>r.stock===0).length,unknown:s.rows.filter(r=>r.stock===null).length};
}
function observationText(row){
 const value=row?.observation??row?.obs;
 return typeof value==='string'?value.trim():'';
}
function tableRows(rows){
 const data=retrieve()?.rows||[],indices=new Map(data.map((r,i)=>[r,i]));
 return rows.length?rows.map(r=>{
  const observation=observationText(r),idx=indices.get(r);
  return `<tr><td><span class="nextar-code">${escape(r.code)}</span></td><td class="nextar-description">${escape(r.description)}</td><td class="nextar-unit">${r.unit?escape(r.unit):'<span title="Unidade não identificada no backup">—</span>'}</td><td class="nextar-qty">${number(r.stock)}</td><td class="nextar-obs-cell"><button class="nextar-obs-open ${observation?'nextar-obs-available':''}" data-nextar-obs="${idx}" type="button" aria-label="Ver observação do produto ${escape(r.code)}">${observation?'Ver mais':'Ver mais'}</button></td></tr>`;
 }).join(''):'<tr><td colspan="5" class="nextar-empty-table">Nenhum produto corresponde aos filtros selecionados.</td></tr>';
}
function render(){
 const s=retrieve(),rows=filterRows(),canUpload=!!root.EngefexAccess?.canWrite('nextarstock'),stats=summary();
 const lastUpdate=s?.imported&&Number.isFinite(new Date(s.imported).getTime())?new Date(s.imported).toLocaleString('pt-BR'):'Sem atualização';
 const formatInt=n=>new Intl.NumberFormat('pt-BR').format(n);
 const stat=(name,value,subtitle,klass='')=>`<div class="nextar-stat ${klass}"><span class="nextar-stat-label">${name}</span><strong>${formatInt(value)}</strong><small>${subtitle}</small></div>`;
 return `<section class="nextar-page">
  <div class="nextar-hero">
   <div class="nextar-hero-main"><span class="nextar-eyebrow"><span class="nextar-live-dot"></span> ENGEFEX · CONSULTA COMPARTILHADA</span>
   <h1>Estoque Nextar</h1>
   <p>Produtos e saldos do último backup, disponíveis para a equipe. Nenhuma alteração é feita no Nextar.</p></div>
   <div class="nextar-hero-side"><span class="nextar-updated-label">ÚLTIMA ATUALIZAÇÃO</span><strong>${escape(lastUpdate)}</strong><small>${s?'Base compartilhada no Supabase':'Nenhum backup publicado'}</small></div>
  </div>
  <div class="nextar-stats" aria-label="Resumo do estoque">
   ${stat('Produtos cadastrados',stats.products,'Registros do último backup')}
   ${stat('Com saldo disponível',stats.available,'Saldo maior que zero','nextar-stat-positive')}
   ${stat('Sem saldo',stats.empty,'Estoque igual a zero')}
   ${stat('Saldo não identificado',stats.unknown,'Requer conferência no Nextar',stats.unknown?'nextar-stat-warning':'')}
  </div>
  <section class="nextar-panel" aria-label="Consulta do estoque Nextar">
   <div class="nextar-panel-header">
    <div><h2>Inventário de produtos</h2><p>${s?`Arquivo de origem: <strong>${escape(s.file)}</strong>`:'Envie o primeiro backup ZIP para começar a consulta.'}</p></div>
    <div class="nextar-main-actions">
     <button type="button" class="button secondary nextar-refresh" id="nextarRefresh" ${busy?'disabled':''} title="Buscar dados atualizados do Supabase">↻ Atualizar consulta</button>
     <button type="button" class="button secondary nextar-download" id="nextarDownloadAll" ${s?'':'disabled'} title="Exportar todos os produtos, independentemente dos filtros">↓ Baixar estoque completo</button>
     ${canUpload?`<label id="nextarUploadLabel" class="button primary nextar-upload" for="nextarZip">${busy?'Importando…':'+ Importar backup ZIP'}</label><input id="nextarZip" type="file" accept=".zip,application/zip,application/x-zip-compressed" hidden ${busy?'disabled':''}>`:''}
    </div>
   </div>
   ${canUpload?'<p class="nextar-permission-note">Usuários com permissão <strong>Editar</strong> podem publicar um novo backup semanal. A importação substitui o retrato anterior apenas após confirmação do Supabase.</p>':''}
   ${s?.rows?.length&&s.rows.every(r=>r.unit===undefined)?'<p class="nextar-permission-note">A base atual foi importada antes da inclusão das unidades. Importe novamente o ZIP para preencher essa coluna.</p>':''}
   ${s?.rows?.length&&s.rows.every(r=>r.observationStatus===undefined)?'<p class="nextar-permission-note">Esta base foi importada antes da leitura das observações. Envie novamente o ZIP para preencher o campo OBS.</p>':''}
   <div id="nextarProgressPanel" class="nextar-progress-panel" ${busy?'':'hidden'} role="status" aria-live="polite">
    <div class="nextar-progress-copy"><strong id="nextarProgressLabel">${escape(progressLabel||'Preparando importação…')}</strong><span id="nextarProgressPercent">${progressValue}%</span></div>
    <progress id="nextarProgress" max="100" value="${progressValue}"></progress>
    <small>O estoque anterior permanece disponível até a nova importação ser concluída.</small>
   </div>
   <div id="nextarMessage" class="nextar-feedback" role="status" ${error?'data-error="true"':''}>${error?escape(error):busy?'Lendo arquivo e preparando envio…':fetching?'Consultando dados compartilhados…':s?'Consulta atualizada pelo Supabase.':'Nenhum backup disponível. Solicite a importação a um usuário com permissão Editar.'}</div>
   ${s?`<div class="nextar-searchbar">
      <label class="nextar-search-field" for="nextarSearch"><span aria-hidden="true">⌕</span><input id="nextarSearch" type="search" placeholder="Buscar código ou descrição do produto" autocomplete="off" value="${escape(find)}"></label>
      <label class="nextar-check"><input id="nextarOnlyStock" type="checkbox" ${onlyStock?'checked':''}> Somente com saldo</label>
      <label class="nextar-check"><input id="nextarDuplicates" type="checkbox" ${showDuplicates?'checked':''}> Códigos repetidos</label>
      <button type="button" class="button secondary nextar-filter-download" id="nextarCsv">Exportar resultados CSV</button>
    </div>
    <div class="nextar-list-caption"><span id="nextarCount">${formatInt(rows.length)} resultado(s)</span><span>${(s.duplicates||[]).length} código(s) repetido(s) no backup · A exportação completa ignora os filtros</span></div>
    <div class="nextar-table-wrap"><table class="nextar-stock-table">
     <thead><tr><th scope="col">Código</th><th scope="col">Descrição do produto</th><th scope="col" class="nextar-unit">Unidade</th><th scope="col" class="nextar-qty">Estoque atual</th><th scope="col" class="nextar-obs-head">OBS</th></tr></thead>
     <tbody id="nextarTableBody">${tableRows(rows)}</tbody>
    </table></div>`:'<div class="nextar-empty-state"><span aria-hidden="true">▤</span><strong>Nenhum estoque compartilhado ainda</strong><p>Depois que o primeiro ZIP for importado, os produtos aparecerão aqui para todos os usuários autorizados.</p></div>'}
  </section>
  <dialog id="nextarObservation" class="nextar-observation-modal" aria-labelledby="nextarObsTitle" aria-describedby="nextarObsText">
   <div class="nextar-obs-dialog-head"><div><small>OBSERVAÇÃO DO PRODUTO</small><h2 id="nextarObsTitle">Observação</h2></div><button type="button" id="nextarObsClose" class="nextar-obs-close" aria-label="Fechar observação">×</button></div>
   <div class="nextar-obs-dialog-body"><div class="nextar-obs-product"><strong id="nextarObsCode"></strong><span id="nextarObsDescription"></span></div><p id="nextarObsText" class="nextar-obs-text"></p></div>
   <div class="nextar-obs-dialog-actions"><button id="nextarObsDone" type="button" class="button secondary">Fechar</button></div>
  </dialog>
  <p class="nextar-disclaimer">Consulta somente leitura · Os saldos refletem a data do backup, não a posição em tempo real. Quantidades não reconhecidas são identificadas como “Não identificado”; unidades ausentes aparecem como —.</p>
 </section>`;
}

function exportCsv(){
 if(!retrieve())return;
 const data=[['Código','Descrição','Unidade','Estoque atual'],...filterRows().map(r=>[r.code,r.description,r.unit||'',r.stock===null?'':String(r.stock).replace('.',',')])];
 const csv='\ufeff'+data.map(a=>a.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(';')).join('\r\n');
 const a=document.createElement('a'),url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
 a.href=url;a.download='estoque-nextar-filtrado-'+new Date().toISOString().slice(0,10)+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
const excelXml=x=>String(x??'').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,' ').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
async function downloadAll(){
 const s=retrieve();if(!s||!root.JSZip)return;
 const button=document.getElementById('nextarDownloadAll');
 if(button){button.disabled=true;button.textContent='Preparando Excel…';}
 try{
  const xmlRows=[['Código','Descrição','Unidade','Estoque atual'],...s.rows.map(r=>[r.code,r.description,r.unit||'',r.stock])];
  const cells=xmlRows.map((r,i)=>{
   const n=i+1;
   return `<row r="${n}" ${i===0?'ht="31" customHeight="1"':''}>`+r.map((v,j)=>{
    const col='ABCD'[j],head=i===0,style=head?' s="1"':j===3?' s="2"':'';
    if(!head&&j===3&&typeof v==='number'&&Number.isFinite(v))return `<c r="${col}${n}"${style}><v>${v}</v></c>`;
    return `<c r="${col}${n}"${style} t="inlineStr"><is><t xml:space="preserve">${excelXml(v??'')}</t></is></c>`;
   }).join('')+'</row>';
  }).join('');
  const zip=new root.JSZip();
  zip.file('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>');
  zip.file('_rels/.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  zip.file('xl/workbook.xml','<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Estoque Nextar" sheetId="1" r:id="rId1"/></sheets></workbook>');
  zip.file('xl/_rels/workbook.xml.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
  zip.file('xl/styles.xml','<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="0.##"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF182B49"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>');
  zip.file('xl/worksheets/sheet1.xml',`<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:D${xmlRows.length}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="17"/><cols><col min="1" max="1" width="16" customWidth="1"/><col min="2" max="2" width="65" customWidth="1"/><col min="3" max="3" width="15" customWidth="1"/><col min="4" max="4" width="19" customWidth="1"/></cols><sheetData>${cells}</sheetData><autoFilter ref="A1:D${xmlRows.length}"/></worksheet>`);
  const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='estoque-nextar-completo-'+new Date().toISOString().slice(0,10)+'.xlsx';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
 }catch(e){showFeedback('Não foi possível exportar a planilha: '+e.message,true);}
 finally{if(button){button.disabled=false;button.textContent='↓ Baixar estoque completo';}}
}
function showFeedback(message,isError=false){
 const el=document.getElementById('nextarMessage');
 if(el){el.textContent=message;el.dataset.error=isError?'true':'false';}
}
function showProgress(percent,label){
 progressValue=percent;progressLabel=label;
 const panel=document.getElementById('nextarProgressPanel'),bar=document.getElementById('nextarProgress');
 if(panel)panel.hidden=false;
 if(bar)bar.value=percent;
 const p=document.getElementById('nextarProgressPercent');if(p)p.textContent=percent+'%';
 const title=document.getElementById('nextarProgressLabel');if(title)title.textContent=label;
}
function updateTable(){
 const table=document.getElementById('nextarTableBody');
 if(!table)return;
 // Só o conteúdo da lista muda: não recriar a página nem perder a rolagem.
 const data=filterRows();
 table.innerHTML=tableRows(data);
 const label=document.getElementById('nextarCount');
 if(label)label.textContent=new Intl.NumberFormat('pt-BR').format(data.length)+' resultado(s)';
}
function openObservation(index){
 const row=retrieve()?.rows?.[index];
 if(!row||!Number.isInteger(index)||index<0)return;
 const dialog=document.getElementById('nextarObservation');
 if(!dialog)return;
 const note=observationText(row);
 document.getElementById('nextarObsTitle').textContent='Observação do produto';
 document.getElementById('nextarObsCode').textContent=row.code||'';
 document.getElementById('nextarObsDescription').textContent=row.description||'';
 const body=document.getElementById('nextarObsText');
 body.textContent=note||(row.observationStatus==='unreadable'?'A observação deste produto não pôde ser interpretada com segurança a partir do backup. Nenhum texto foi atribuído por aproximação.':row.observationStatus==='empty'?'Nenhuma observação cadastrada para este produto no backup do NEX.':'Este backup foi importado antes da implementação da leitura das observações. Importe o ZIP novamente para consultar os textos.');
 body.classList.toggle('nextar-obs-missing',!note);
 if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
}
function bind(){
 const rows=document.getElementById('nextarTableBody');
 if(rows)rows.onclick=event=>{
  const button=event.target.closest?.('[data-nextar-obs]');
  if(!button||!rows.contains(button))return;
  const index=Number(button.dataset.nextarObs);
  if(Number.isSafeInteger(index))openObservation(index);
 };
 const dialog=document.getElementById('nextarObservation');
 const close=()=>{if(dialog?.open){if(typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open')}};
 const closeButton=document.getElementById('nextarObsClose');
 if(closeButton)closeButton.onclick=close;
 const doneButton=document.getElementById('nextarObsDone');
 if(doneButton)doneButton.onclick=close;
 if(dialog)dialog.onclick=e=>{if(e.target===dialog)close()};
 const refreshButton=document.getElementById('nextarRefresh');
 if(refreshButton)refreshButton.onclick=()=>refresh(true);
 if(!loaded&&!fetching&&!busy)refresh(true);
 const all=document.getElementById('nextarDownloadAll');if(all)all.onclick=downloadAll;
 const filtered=document.getElementById('nextarCsv');if(filtered)filtered.onclick=exportCsv;
 const search=document.getElementById('nextarSearch');
 if(search)search.oninput=e=>{find=e.target.value;updateTable();};
 const only=document.getElementById('nextarOnlyStock');
 if(only)only.onchange=e=>{onlyStock=e.target.checked;updateTable();};
 const duplicates=document.getElementById('nextarDuplicates');
 if(duplicates)duplicates.onchange=e=>{showDuplicates=e.target.checked;updateTable();};
 const file=document.getElementById('nextarZip');
 if(file)file.onchange=async e=>{
  const input=e.target,f=e.target.files?.[0];
  if(!f||busy)return;
  if(!root.EngefexAccess?.canWrite('nextarstock')){showFeedback('Você não tem permissão para atualizar este estoque.',true);return;}
  busy=true;input.disabled=true;
  const upload=document.getElementById('nextarUploadLabel');if(upload)upload.textContent='Importando…';
  if(refreshButton)refreshButton.disabled=true;
  error='';showFeedback('Importando o backup do Nextar…');
  showProgress(0,'Preparando leitura do arquivo…');
  try{
   const result=await parse(f,showProgress);
   if(result.rows.length<1)throw Error('Importação sem produtos. O estoque anterior foi preservado.');
   if(result.rows.some(x=>x.stock!==null&&(!Number.isFinite(x.stock)||x.stock<0)))throw Error('Saldo inválido. O estoque anterior foi preservado.');
   const incoming={v:VERSION,file:f.name,imported:new Date().toISOString(),...result};
   showProgress(95,'Enviando o estoque compartilhado ao Supabase…');
   await root.EngefexCloud.publishNextar(incoming);
   showProgress(100,'Importação concluída e salva no Supabase.');
   snapshot=incoming;lastFetch=Date.now();loaded=true;error='';
   showFeedback('Importação concluída: '+result.rows.length+' produtos compartilhados.');
  }catch(err){error='Falha na importação: '+err.message;showFeedback(error,true);}
  finally{
   busy=false;input.value='';input.disabled=false;
   if(refreshButton)refreshButton.disabled=false;
   const beforeY=root.scrollY||0,old=document.querySelector('#main .nextar-page');
   if(old){const next=document.createElement('div');next.innerHTML=render();old.replaceWith(next.firstElementChild);bind();root.scrollTo({top:beforeY,behavior:'instant'});}
  }
 };
}
root.EngefexNextarStock={parse,render,bind,refresh,downloadAll,updateTable,openObservation};
})(window);
