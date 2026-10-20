
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
async function parseProduto(bytes,categories,onProgress=()=>{}){
 const lines=strings(bytes),cats=new Set(categories),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),codes=[];
 for(let i=0;i<lines.length;i++)if(/^0{2,3}[0-9]{3,4}$/.test(lines[i].value))codes.push(i);
 const rows=[],unresolved=[];
 for(let j=0;j<codes.length;j++){
  if(j%30===0){onProgress(codes.length?j/codes.length:0);await new Promise(done=>setTimeout(done,0));}
  const i=codes[j],tag=lines[i],end=j+1<codes.length?lines[codes[j+1]].pos:bytes.length,w=[];
  for(let n=i+1;n<lines.length&&lines[n].pos<Math.min(end,tag.end+260)&&w.length<15;n++)w.push(lines[n]);
  const cut=w.findIndex(x=>units.has(x.value));
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
  rows.push({code:tag.value,description:name,stock});
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
async function refresh(force=false){if(!root.EngefexCloud?.ready)return;if(fetching||!force&&Date.now()-lastFetch<30000)return;fetching=true;try{snapshot=await root.EngefexCloud.loadNextar();loaded=true;error='';lastFetch=Date.now();}catch(e){error=e.message;}finally{fetching=false;const main=document.getElementById('main');if(location.hash==='#nextarstock'&&main){main.innerHTML=render();bind();}}}
function cleanText(x){return String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
function filterRows(){let s=retrieve();if(!s)return [];const q=cleanText(find),dup=new Set((s.duplicates||[]).map(x=>x.code));return s.rows.filter(r=>(!onlyStock||r.stock!==null&&r.stock>0)&&(!showDuplicates||dup.has(r.code))&&(!q||cleanText(r.code+' '+r.description).includes(q)));}
function number(v){return v===null?'<span class="tag amber">Não identificado</span>':new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(v);}
function render(){
 const s=retrieve(),rows=filterRows(),canUpload=!!root.EngefexAccess?.canWrite('nextarstock');
 const notes=s?`<p class="section-note">Origem: <strong>${escape(s.file)}</strong> · Atualizado em ${escape(new Date(s.imported).toLocaleString('pt-BR'))} · ${s.rows.length} registros · ${s.duplicates.length} códigos repetidos · ${s.unresolved.length} saldos não identificados. A quantidade corresponde ao backup, não ao estoque em tempo real.</p>`:'';
 return `<section class="page-head"><div><div class="eyebrow">CONSULTA · SOMENTE LEITURA</div><h1>Estoque Nextar</h1><p class="subtitle">Leia o ZIP do Nextar e consulte código, descrição e estoque atual, sem modificar o sistema de origem.</p></div></section>
 <section class="card nextar-stock-panel" aria-label="Estoque do Nextar">
 <div class="nextar-stock-controls">${canUpload?`<label class="button primary" for="nextarZip" style="display:inline-flex;align-items:center;cursor:pointer">${busy?'Importando…':'Atualizar pelo backup ZIP'}</label><input id="nextarZip" type="file" accept=".zip,application/zip,application/x-zip-compressed" hidden ${busy?'disabled':''}>`:'<span class="tag">Somente consulta · atualização disponível para usuários com permissão Editar</span>'}<span id="nextarMessage" role="status">${error?escape(error):busy?'Lendo e publicando…':fetching?'Consultando o banco…':s?'Estoque compartilhado no Supabase':'Nenhum backup publicado ainda.'}</span><button class="button secondary" type="button" id="nextarRefresh">Atualizar consulta</button></div>
 ${notes}
 ${s?`<div class="nextar-stock-controls nextar-stock-search"><input id="nextarSearch" type="search" placeholder="Buscar código ou descrição" value="${escape(find)}" aria-label="Buscar estoque"><label><input id="nextarOnlyStock" type="checkbox" ${onlyStock?'checked':''}> Somente com saldo</label><label><input id="nextarDuplicates" type="checkbox" ${showDuplicates?'checked':''}> Códigos repetidos</label><button class="button secondary" id="nextarCsv" type="button">Exportar CSV</button></div><p class="section-note">${rows.length} resultado(s). Códigos repetidos são exibidos separadamente e nunca somados.</p><div class="table-wrap nextar-table"><table><thead><tr><th>Código</th><th>Descrição</th><th>Estoque atual (backup)</th></tr></thead><tbody>${rows.length?rows.map(r=>`<tr><td><strong>${escape(r.code)}</strong></td><td>${escape(r.description)}</td><td style="text-align:right">${number(r.stock)}</td></tr>`).join(''):'<tr><td colspan="3">Nenhum produto encontrado.</td></tr>'}</tbody></table></div>`:''}
 <p class="section-note"><strong>Atenção:</strong> compatibilidade validada com o backup de 20/10/2026. Compare alguns saldos com o Nextar antes de utilizar os dados em decisões. A consulta é compartilhada no Supabase; usuários com permissão Editar podem publicar um novo backup.</p>
 </section>`;
}
function exportCsv(){if(!retrieve())return;const data=[['Código','Descrição','Estoque atual'],...filterRows().map(r=>[r.code,r.description,r.stock===null?'':String(r.stock).replace('.',',')])];const csv='\ufeff'+data.map(a=>a.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(';')).join('\r\n');const a=document.createElement('a'),url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.href=url;a.download='estoque-nextar-'+new Date().toISOString().slice(0,10)+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function bind(){
 const refreshButton=document.getElementById('nextarRefresh');if(refreshButton)refreshButton.onclick=()=>refresh(true);if(!loaded&&!fetching)refresh(true);
 const file=document.getElementById('nextarZip');
 if(file)file.onchange=async e=>{
  let f=e.target.files?.[0];if(!f)return;busy=true;file.disabled=true;const msg=document.getElementById('nextarMessage');if(msg)msg.textContent='Interpretando o arquivo Produto.nx1…';
  try{const result=await parse(f);if(result.rows.length<1)throw Error('Importação sem produtos. O estoque anterior foi preservado.');if(result.rows.some(x=>x.stock!==null&&(!Number.isFinite(x.stock)||x.stock<0)))throw Error('Saldo inválido detectado. O estoque anterior foi preservado.');const incoming={v:VERSION,file:f.name,imported:new Date().toISOString(),...result};await root.EngefexCloud.publishNextar(incoming);snapshot=incoming;lastFetch=Date.now();error='';busy=false;const main=document.getElementById('main');if(main){main.innerHTML=render();bind();}}
  catch(error){busy=false;file.disabled=false;if(msg)msg.textContent='Falha na leitura: '+error.message;}
  finally{file.value='';}
 };
 const search=document.getElementById('nextarSearch');if(search)search.oninput=e=>{find=e.target.value;updateTable();};
 const only=document.getElementById('nextarOnlyStock');if(only)only.onchange=e=>{onlyStock=e.target.checked;updateTable();};
 const duplicates=document.getElementById('nextarDuplicates');if(duplicates)duplicates.onchange=e=>{showDuplicates=e.target.checked;updateTable();};
 const csv=document.getElementById('nextarCsv');if(csv)csv.onclick=exportCsv;
}
function updateTable(){const main=document.getElementById('main');if(!main)return;const holder=document.createElement('div');holder.innerHTML=render();const current=main.querySelector('.nextar-stock-panel'),fresh=holder.querySelector('.nextar-stock-panel');if(current&&fresh)current.replaceWith(fresh);bind();}
root.EngefexNextarStock={parse,render,bind,refresh};
})(window);
