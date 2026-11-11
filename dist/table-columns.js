/* Preferências de largura, ordem e visibilidade guardadas somente neste navegador. */
(()=>{'use strict';
const storageKey=key=>window.EngefexEnvironment?.storageKey(key)||key;
const KEY=storageKey('engefex-table-widths-v1'),LAYOUT_KEY=storageKey('engefex-table-layout-v1');
function read(key){try{const value=JSON.parse(localStorage.getItem(key)||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}catch{return {}}}
function store(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch{}}
let widths=read(KEY),layouts=read(LAYOUT_KEY);
const escape=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function normalizeLayout(saved,count){
 const original=Array.from({length:count},(_,i)=>i),valid=id=>Number.isInteger(id)&&id>=0&&id<count;
 const order=[...new Set((Array.isArray(saved?.order)?saved.order:[]).filter(valid))];
 order.push(...original.filter(id=>!order.includes(id)));
 const hidden=[...new Set((Array.isArray(saved?.hidden)?saved.hidden:[]).filter(valid))];
 return {order,hidden:hidden.length<count?hidden:[]};
}
function bind(){for(let [index,table]of [...document.querySelectorAll('table')].entries()){
 if(table.dataset.columnsReady)continue;
 const headers=[...table.querySelectorAll('thead tr:first-child th')];if(!headers.length)continue;
 table.dataset.columnsReady='1';
 const names=headers.map(h=>h.textContent.trim()),key=location.hash+'|'+index+'|'+names.join('|');
 const layoutId=table.dataset.columnLayout;
 const defaults=normalizeLayout({order:(table.dataset.columnOrder||'').split(',').filter(Boolean).map(Number),hidden:(table.dataset.columnHidden||'').split(',').filter(Boolean).map(Number)},headers.length);
 let layout=normalizeLayout(layouts[layoutId]||defaults,headers.length),cols=null,values=null,panel=null;
 const rows=layoutId?[...table.querySelectorAll('tr')].map(row=>({row,cells:[...row.children],spanning:row.children.length===1&&row.children[0].colSpan>1})):[];
 function size(){
  if(!cols)return;
  cols.forEach((col,i)=>{col.style.width=values[i]+'px';col.hidden=layout.hidden.includes(i)});
  table.style.width=values.reduce((sum,value,i)=>sum+(layout.hidden.includes(i)?0:value),0)+'px';
 }
 function applyLayout(){
  for(const {row,cells,spanning} of rows){
   if(spanning){cells[0].colSpan=headers.length-layout.hidden.length;continue}
   if(cells.length!==headers.length||cells.some(cell=>cell.colSpan>1)){
    continue;
   }
   for(const id of layout.order){cells[id].hidden=layout.hidden.includes(id);row.appendChild(cells[id])}
  }
  if(cols)for(const id of layout.order)cols[id].parentNode.appendChild(cols[id]);
  size();
 }
 function freeze(saved){
  if(cols)return;
  values=saved?.length===headers.length?saved.slice():headers.map(header=>Math.max(48,header.getBoundingClientRect().width));
  const group=document.createElement('colgroup');
  cols=values.map(value=>{const col=document.createElement('col');col.style.width=value+'px';group.appendChild(col);return col});
  table.prepend(group);table.style.tableLayout='fixed';table.classList.add('column-sized');
  if(layoutId)applyLayout();else size();
 }
 function saveWidths(){widths[key]=values;store(KEY,widths)}
 function saveLayout(){layouts[layoutId]=layout;store(LAYOUT_KEY,layouts);applyLayout();drawPanel()}
 function drawPanel(){
  const body=panel.querySelector('.table-column-options');
  body.innerHTML='<p>Escolha as colunas e use as setas para mudar a ordem.</p><div class="table-column-list">'+layout.order.map((id,position)=>{
   const name=names[id]||'Ações',visible=!layout.hidden.includes(id),onlyVisible=visible&&layout.hidden.length===headers.length-1;
   return '<div class="table-column-option"><label><input type="checkbox" data-column-visible="'+id+'" '+(visible?'checked ':'')+(onlyVisible?'disabled ':'')+'>'+escape(name)+'</label><div><button type="button" class="text-btn" data-column-move="'+id+'" data-direction="-1" aria-label="Mover '+escape(name)+' para a esquerda" '+(position===0?'disabled':'')+'>↑</button><button type="button" class="text-btn" data-column-move="'+id+'" data-direction="1" aria-label="Mover '+escape(name)+' para a direita" '+(position===headers.length-1?'disabled':'')+'>↓</button></div></div>';
  }).join('')+'</div><button type="button" class="button secondary" data-column-reset>Restaurar padrão</button><small>Preferências salvas neste navegador.</small>';
 }
 if(layoutId){
  panel=document.createElement('details');panel.className='table-column-panel';
  panel.innerHTML='<summary>Organizar colunas</summary><div class="table-column-options"></div>';
  const slot=table.closest('.payable-workspace')?.querySelector('.payable-column-slot');
  if(slot)slot.appendChild(panel);else table.closest('.table-wrap').before(panel);
  panel.addEventListener('change',event=>{
   const control=event.target.closest('[data-column-visible]');if(!control)return;
   const id=Number(control.dataset.columnVisible);
   layout.hidden=control.checked?layout.hidden.filter(value=>value!==id):[...new Set([...layout.hidden,id])];
   if(layout.hidden.length===headers.length)layout.hidden=layout.hidden.filter(value=>value!==id);
   saveLayout();panel.querySelector('[data-column-visible="'+id+'"]').focus();
  });
  panel.addEventListener('click',event=>{
   const move=event.target.closest('[data-column-move]');
   if(move){
    const id=Number(move.dataset.columnMove),from=layout.order.indexOf(id),to=from+Number(move.dataset.direction);
    if(from<0||to<0||to>=layout.order.length)return;
    [layout.order[from],layout.order[to]]=[layout.order[to],layout.order[from]];
    saveLayout();panel.querySelector('[data-column-move="'+id+'"][data-direction="'+move.dataset.direction+'"]').focus();
   }else if(event.target.closest('[data-column-reset]')){
    layout=normalizeLayout(defaults,headers.length);delete widths[key];store(KEY,widths);
    if(cols)cols[0].parentNode.remove();cols=null;values=null;
    table.style.width='';table.style.tableLayout='';table.classList.remove('column-sized');saveLayout();
    panel.querySelector('[data-column-reset]').focus();
   }
  });
  drawPanel();applyLayout();
 }
 if(Array.isArray(widths[key])&&widths[key].every(n=>Number.isFinite(n)&&n>=48&&n<=1200))freeze(widths[key]);
 headers.forEach((header,i)=>{
  const handle=document.createElement('span');handle.className='column-resizer';handle.tabIndex=0;
  handle.setAttribute('role','separator');handle.setAttribute('aria-orientation','vertical');handle.setAttribute('aria-label','Ajustar largura de '+(names[i]||'ações'));
  handle.title='Arraste para ajustar a largura; use ← e → pelo teclado';header.appendChild(handle);
  handle.addEventListener('keydown',event=>{
   if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();freeze();
   values[i]=Math.max(48,Math.min(1200,values[i]+(event.key==='ArrowLeft'?-16:16)));size();saveWidths();
  });
  handle.addEventListener('pointerdown',event=>{
   if(event.button!==undefined&&event.button!==0)return;event.preventDefault();event.stopPropagation();freeze();
   const start=event.clientX,initial=values[i];handle.setPointerCapture(event.pointerId);
   const move=e=>{values[i]=Math.max(48,Math.min(1200,initial+e.clientX-start));size()},end=()=>{
    handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',end);handle.removeEventListener('pointercancel',end);saveWidths();
   };
   handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end);
  });
 });
}}
window.EngefexTableColumns={bind,normalizeLayout};
if(window.MutationObserver)new MutationObserver(bind).observe(document.body,{childList:true,subtree:true});bind();
})();
