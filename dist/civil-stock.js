(function(w){'use strict';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels=['Sinalizado','ID de estoque','Nome','Descrição','Preço unitário','Quantidade em estoque','Valor de estoque','Nível de estoque','Repor em dias','Quantidade a encomendar','Descontinuado?'];
const fields=['highlight','stockId','name','description','price','quantity','stockValue','level','reorderDays','reorderQuantity','discontinued'];
let search='',sort='stockId',desc=false,limit=20,index=0,filters={};
const data=()=>w.EngefexCivilState().civilStock||[];
const money=v=>typeof v==='number'?new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v):esc(v);
const display=(k,v)=>{if(v==null||v==='')return '—';if(k==='price'||k==='stockValue')return typeof v==='number'?money(v):esc(v);if(k==='discontinued'){const no=/^(n[aã]o|false|0)$/i.test(String(v));return '<span class="civil-pill '+(no?'civil-pill-neutral':'civil-pill-alert')+'">'+esc(v)+'</span>'}if(k==='name')return '<strong class="civil-item-name">'+esc(v)+'</strong>';if(k==='stockId')return '<span class="civil-code">'+esc(v)+'</span>';return esc(v)};
const sorted=()=>data().filter(r=>fields.every(k=>!filters[k]||String(r[k]??'')===filters[k])).filter(r=>!search||fields.some(k=>String(r[k]??'').toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')))).sort((a,b)=>{const x=a[sort]??'',y=b[sort]??'';return (desc?-1:1)*(typeof x==='number'&&typeof y==='number'?x-y:String(x).localeCompare(String(y),'pt-BR',{numeric:true}))});
function mobileCards(items){
 const detail=(label,value)=>'<div><dt>'+esc(label)+'</dt><dd>'+esc(value??'—')+'</dd></div>';
 return '<div class="stock-mobile-cards civil-mobile-cards" aria-label="Materiais do estoque civil">'+items.map(r=>{
  const text=k=>String(r[k]??'').trim()||'—';
  const q=text('quantity');
  return '<article class="stock-mobile-card">'+
   '<div class="stock-mobile-heading"><div class="stock-mobile-title"><strong>'+esc(text('name'))+'</strong><small>'+esc(text('stockId'))+'</small></div>'+
   '<div class="stock-mobile-quantity"><small>Quantidade</small><strong>'+esc(q)+'</strong></div></div>'+
   '<div class="stock-mobile-summary"><span>Nível <strong>'+esc(text('level'))+'</strong></span><span>Preço <strong>'+display('price',r.price)+'</strong></span></div>'+
   '<details class="stock-mobile-details"><summary>Mais detalhes</summary><dl>'+
    detail('Descrição',text('description'))+detail('Valor em estoque',text('stockValue'))+
    detail('Repor em dias',text('reorderDays'))+detail('Encomendar',text('reorderQuantity'))+
    detail('Sinalizado',text('highlight'))+detail('Descontinuado',text('discontinued'))+
   '</dl></details><div class="stock-mobile-actions">'+
   '<button type="button" class="button secondary" data-civil-edit="'+esc(r.id)+'">Editar</button>'+
   '<button type="button" class="button secondary stock-mobile-danger" data-civil-del="'+esc(r.id)+'">Excluir</button>'+
   '</div></article>';
 }).join('')+(items.length?'':'<p class="stock-mobile-empty">Nenhum material corresponde aos filtros.</p>')+'</div>';
}
function page(){
 const all=sorted(),pages=Math.max(1,Math.ceil(all.length/limit));index=Math.min(index,pages-1);const shown=all.slice(index*limit,(index+1)*limit);
 const count=data().length,total=data().reduce((sum,r)=>{const value=r.stockValue;const n=typeof value==='number'?value:Number(String(value??'').replace(/[^0-9,.-]/g,'').replace(/\./g,'').replace(',','.'))||0;return sum+n},0);
 const totalBR=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(total);
 const selector=(k)=>'<label>'+esc(labels[fields.indexOf(k)])+'<select data-filter="'+k+'"><option value="">Todos</option>'+[...new Set(data().map(r=>String(r[k]??'')).filter(Boolean))].sort().map(t=>'<option '+(filters[k]===t?'selected':'')+'>'+esc(t)+'</option>').join('')+'</select></label>';
 return '<div class="civil-stock"><section class="civil-head"><div><h1>Estoque Civil</h1><p>Materiais de construção · dados compartilhados no Supabase</p></div><div class="civil-head-actions"><button class="button primary" type="button" id="civilAdd">+ Novo material</button></div></section><div class="civil-metrics"><div><small>Produtos</small><strong>'+count+'</strong></div><div><small>Valor em estoque</small><strong>'+totalBR+'</strong></div></div><section class="panel civil-filters"><div class="panel-head"><h2>Filtros e importação</h2></div><div class="form-grid"><label>Importar XLSX<input type="file" accept=".xlsx" id="civilXlsx"></label><label>Buscar<input id="civilSearch" value="'+esc(search)+'" placeholder="Nome, ID, descrição, quantidade"></label>'+['highlight','level','discontinued'].map(selector).join('')+'<label>Ordenar por<select id="civilSort">'+fields.map((f,i)=>'<option value="'+f+'" '+(sort===f?'selected':'')+'>'+esc(labels[i])+'</option>').join('')+'</select></label><label>Itens por página<select id="civilLimit">'+[10,20,50,100].map(n=>'<option '+(limit===n?'selected':'')+'>'+n+'</option>').join('')+'</select></label></div><div style="display:flex;gap:9px;margin:12px 0;flex-wrap:wrap"><button class="button primary" id="civilImport">Importar planilha e salvar no Supabase</button><button class="button secondary" id="civilReset">Limpar filtros</button><button class="button secondary" id="civilReverse">Inverter ordem</button></div><p class="notice" id="civilMessage">Os dados ficam disponíveis para todos os usuários autorizados após confirmação do salvamento online.</p></section>'+
 '<section class="panel civil-table-panel"><div class="panel-head"><h2>Materiais cadastrados</h2><span>'+shown.length+' exibidos de '+all.length+' itens · Página '+(index+1)+'/'+pages+'</span></div><div class="hr-table-wrap" style="overflow:auto"><table class="hr-data-table" style="min-width:1500px"><thead><tr>'+labels.map(x=>'<th>'+esc(x)+'</th>').join('')+'<th>Ações</th></tr></thead><tbody>'+shown.map(r=>'<tr>'+fields.map(k=>'<td>'+display(k,r[k])+'</td>').join('')+'<td class="civil-actions"><button class="button secondary" data-civil-edit="'+esc(r.id)+'">Editar</button> <button class="button secondary" data-civil-del="'+esc(r.id)+'">Excluir</button></td></tr>').join('')+'</tbody></table></div>'+mobileCards(shown)+'<div style="display:flex;justify-content:flex-end;gap:10px;margin-top:14px"><button class="button secondary" id="civilPrev" '+(index===0?'disabled':'')+'>Anterior</button><button class="button secondary" id="civilNext" '+(index>=pages-1?'disabled':'')+'>Próxima</button></div></section><dialog id="civilDialog" class="hr-editor"><h2 id="civilTitle">Material civil</h2><form id="civilForm"><div id="civilFields" class="hr-editor-fields"></div><footer class="hr-editor-footer"><button type="button" class="button secondary" id="civilCancel">Cancelar</button><button class="button primary" type="submit">Salvar</button></footer></form></dialog></div>';
}
async function parse(file){
 const z=await w.JSZip.loadAsync(file),read=async p=>new DOMParser().parseFromString(await z.file(p).async('text'),'application/xml');
 const texts=[];if(z.file('xl/sharedStrings.xml')){const x=await read('xl/sharedStrings.xml');for(const s of x.getElementsByTagName('si'))texts.push([...s.getElementsByTagName('t')].map(t=>t.textContent).join(''))}
 const xml=await read('xl/worksheets/sheet1.xml'),all=[];
 for(const row of xml.getElementsByTagName('row')){const r=Number(row.getAttribute('r'));if(r<4)continue;const obj={};for(const cell of row.getElementsByTagName('c')){const k=(cell.getAttribute('r')||'').match(/^[A-Z]+/)?.[0];if(!k)continue;const raw=cell.getElementsByTagName('v')[0]?.textContent;const type=cell.getAttribute('t');obj[k]=type==='s'?texts[Number(raw)]||'':type==='inlineStr'?cell.getElementsByTagName('is')[0]?.textContent||'':raw==null?'':type==='str'?raw:Number(raw)}if(!obj.C&&!obj.D)continue;all.push({id:crypto.randomUUID(),...Object.fromEntries(fields.map((key,i)=>[key,obj[String.fromCharCode(66+i)]??'']))})}
 return all;
}
function bind(){
 const can=()=>!!w.EngefexAccess?.canWrite('civilstock'),redraw=()=>w.EngefexCivilRefresh();
 const save=async next=>{if(!can())throw Error('Sem permissão para alterar Estoque Civil.');const ok=await w.EngefexCivilSave(next);if(ok===false)throw Error('O Supabase não confirmou o salvamento.');redraw()};
 const ctrl=(id,fn)=>{const x=document.getElementById(id);if(x)x.onchange=()=>{fn(x.value);index=0;redraw()}};
 ctrl('civilSearch',v=>search=v);ctrl('civilSort',v=>sort=v);ctrl('civilLimit',v=>limit=Number(v));
 document.querySelectorAll('[data-filter]').forEach(x=>x.onchange=()=>{filters[x.dataset.filter]=x.value;index=0;redraw()});
 document.getElementById('civilReset').onclick=()=>{search='';filters={};index=0;redraw()};
 document.getElementById('civilReverse').onclick=()=>{desc=!desc;redraw()};
 document.getElementById('civilPrev').onclick=()=>{index--;redraw()};document.getElementById('civilNext').onclick=()=>{index++;redraw()};
 const dlg=document.getElementById('civilDialog'),form=document.getElementById('civilForm');
 const edit=id=>{if(!can())return alert('Sem permissão.');const old=data().find(r=>r.id===id)||{};dlg.dataset.id=id||'';document.getElementById('civilTitle').textContent=id?'Editar item':'Adicionar item';document.getElementById('civilFields').innerHTML=fields.map((k,i)=>'<label class="hr-edit-field"><span>'+esc(labels[i])+'</span><input name="'+k+'" value="'+esc(old[k]??'')+'"></label>').join('');dlg.showModal()};
 document.getElementById('civilAdd').onclick=()=>edit('');
 document.querySelectorAll('[data-civil-edit]').forEach(x=>x.onclick=()=>edit(x.dataset.civilEdit));
 document.getElementById('civilCancel').onclick=()=>dlg.close();
 form.onsubmit=async event=>{event.preventDefault();const fd=new FormData(form),next=structuredClone(w.EngefexCivilState());next.civilStock=next.civilStock||[];const id=dlg.dataset.id||crypto.randomUUID();const fieldsValue=Object.fromEntries(fields.map(k=>[k,String(fd.get(k)||'')]));const idx=next.civilStock.findIndex(r=>r.id===id);const record={...(idx>=0?next.civilStock[idx]:{}),id,...fieldsValue};if(idx<0)next.civilStock.push(record);else next.civilStock[idx]=record;try{await save(next);dlg.close()}catch(e){alert(e.message)}};
 document.querySelectorAll('[data-civil-del]').forEach(x=>x.onclick=async()=>{if(!can())return;if(!confirm('Excluir item deste estoque?'))return;const next=structuredClone(w.EngefexCivilState());next.civilStock=(next.civilStock||[]).filter(r=>r.id!==x.dataset.civilDel);try{await save(next)}catch(e){alert(e.message)}});
 document.getElementById('civilImport').onclick=async()=>{if(!can())return alert('Sem permissão.');const file=document.getElementById('civilXlsx').files[0];if(!file)return alert('Selecione a planilha.');const message=document.getElementById('civilMessage');try{message.textContent='Lendo arquivo…';const items=await parse(file);if(!items.length)throw Error('Nenhum item reconhecido.');if(!confirm('Importar '+items.length+' materiais? Isso substituirá apenas o Estoque Civil atual, mantendo Tintas e Nextar.'))return;const next=structuredClone(w.EngefexCivilState());next.civilStock=items;message.textContent='Salvando no Supabase…';await save(next)}catch(err){message.textContent='Importação não confirmada: '+err.message;alert(err.message)}};
}
w.EngefexCivilStock={page,bind};
})(window);