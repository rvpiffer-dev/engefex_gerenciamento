/* RH: importação recorrente de planilhas e ficha individual. */
(function(root){'use strict';
const RH=root.EngefexRH;if(!RH)return;
const clean=x=>String(x??'').trim();
const escape=x=>clean(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const digits=x=>clean(x).replace(/\D/g,'');
const norm=x=>clean(x).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ');
const fields=[['name','Nome'],['address','Endereço'],['phone','Telefone'],['birthDate','Data de nascimento'],['age','Idade na planilha'],['role','Função'],['cpf','CPF'],['rg','RG'],['admissionDate','Admissão'],['companyStatus','Vínculo'],['spreadsheetNote','Observação da planilha']];
const iso=x=>{if(!x)return '';if(/^\d{4}-\d\d-\d\d$/.test(clean(x)))return clean(x);const v=Number(x);if(Number.isFinite(v)&&v>1&&v<100000){const d=new Date(Date.UTC(1899,11,30)+Math.round(v)*86400000);return d.toISOString().slice(0,10)}return clean(x)};
const fmt=x=>/^\d{4}-\d\d-\d\d$/.test(clean(x))?clean(x).split('-').reverse().join('/'):clean(x);
const statusLabel=e=>e.companyStatus==='afastado'?'Afastado':e.companyStatus==='outro_cnpj'?'Outro CNPJ':'Engefex';
async function parseXlsx(file){
 const zip=await root.JSZip.loadAsync(file);const xml=async p=>new DOMParser().parseFromString(await zip.file(p).async('string'),'application/xml');
 const sst=zip.file('xl/sharedStrings.xml')?Array.from((await xml('xl/sharedStrings.xml')).getElementsByTagName('si')).map(si=>Array.from(si.getElementsByTagName('t')).map(t=>t.textContent).join('')):[];
 const style=await xml('xl/styles.xml'), xfs=Array.from(style.getElementsByTagName('cellXfs')[0]?.children||[]),fills=Array.from(style.getElementsByTagName('fills')[0]?.children||[]);
 const sheets=Object.keys(zip.files).filter(x=>/^xl\/worksheets\/sheet\d+\.xml$/.test(x));if(!sheets.length)throw Error('Planilha sem abas.');
 const doc=await xml(sheets[0]);const list=[];
 for(const row of Array.from(doc.getElementsByTagName('sheetData')[0]?.getElementsByTagName('row')||[])){
  const r={};for(const c of Array.from(row.getElementsByTagName('c'))){const key=(c.getAttribute('r')||'').replace(/\d/g,'');const v=c.getElementsByTagName('v')[0]?.textContent||'';r[key]=c.getAttribute('t')==='s'?sst[Number(v)]||'':c.getAttribute('t')==='inlineStr'?(c.getElementsByTagName('t')[0]?.textContent||''):v;
   if(key==='D'){const idx=Number(c.getAttribute('s')||0);const fill=fills[Number(xfs[idx]?.getAttribute('fillId')||0)];const rgb=fill?.getElementsByTagName('fgColor')[0]?.getAttribute('rgb')?.slice(-6)?.toUpperCase()||'';r._color=rgb;}
  }
  const name=clean(r.D);if(!name||norm(name)==='NOME'||!r.C||!(/^\d+$/.test(clean(r.C))))continue;
  const note=norm(r.B);const color=r._color;const companyStatus=note.includes('AFAST')||color==='FF0000'?'afastado':note.includes('OUTRO CNPJ')||color==='FFFF00'?'outro_cnpj':'engefex';
  list.push({name,address:clean(r.E),phone:clean(r.F),birthDate:iso(r.G),age:clean(r.H),role:clean(r.I),cpf:clean(r.J),rg:clean(r.L),admissionDate:iso(r.M),companyStatus,spreadsheetNote:clean(r.B)});
 }
 if(!list.length)throw Error('Nenhum funcionário reconhecido. Confira as colunas D a M.');
 return list;
}
function decorate(s){let page=RH.page(s,'employees');
 const extra='<section class="panel hr-panel"><div class="panel-head"><h2>Importar planilha de funcionários</h2></div><p>Atualize os cadastros a qualquer momento com o mesmo arquivo XLSX. O sistema identifica pelo CPF (ou nome quando não houver CPF), preserva documentos e permite revisar antes de salvar.</p><label class="button secondary">Selecionar planilha XLSX<input id="hrSpreadsheet" type="file" accept=".xlsx" hidden></label><p id="hrImportMessage" role="status"></p></section>';
 page=page.replace('<section class="panel hr-panel"><div class="panel-head"><h2>Equipe e cadastros</h2>',extra+'<section class="panel hr-panel"><div class="panel-head"><h2>Equipe e cadastros</h2>');
 page=page.replace(/(<button type="button" class="button secondary" data-hr-person="[^"]+">Editar<\/button>)/g,'<button type="button" class="button secondary" data-hr-profile="$&">Ficha</button> $1'.replace('data-hr-profile="$&"','data-hr-profile="__FIX__"')); 
 page=page.replace(/data-hr-profile="__FIX__"/g,(m,offset)=>{const rest=page.slice(offset);return 'data-hr-profile="'+(rest.match(/data-hr-person="([^"]+)"/)||[])[1]+'"';});
 // Ficha e impressão funcionam inclusive para os funcionários importados anteriormente.
 page=page.replace('</tbody></table></div></section></div>','</tbody></table></div></section></div>',1);
 return page;
}
const originalPage=RH.page;RH.page=function(s,screen){return screen==='employees'?decorate(s):originalPage(s,screen)};
const originalAttach=RH.attach;RH.attach=function(s,persist,render,notify){
 originalAttach(s,persist,render,notify);
 if(!document.getElementById('hrSpreadsheet'))return;
 document.getElementById('hrSpreadsheet').onchange=async event=>{
  if(!root.EngefexAccess?.canWrite('hr-employees'))return notify('Sem permissão para editar funcionários.');
  const file=event.target.files?.[0];if(!file)return;
  try{const rows=await parseXlsx(file);const employees=s.hrEmployees||[];let updates=0,news=0,ambiguous=0;
   const matches=rows.map(row=>{const byCpf=digits(row.cpf)?employees.filter(e=>digits(e.cpf)===digits(row.cpf)):[];const found=byCpf.length?byCpf:employees.filter(e=>norm(e.name)===norm(row.name));if(found.length>1)ambiguous++;else if(found.length===1)updates++;else news++;return {row,existing:found.length===1?found[0]:null,ambiguous:found.length>1}});
   if(ambiguous)throw Error(ambiguous+' funcionários têm correspondência ambígua. Ajuste CPF ou nome antes de importar.');
   if(!confirm('Planilha lida: '+rows.length+' funcionários. Atualizar '+updates+' e incluir '+news+'? Os demais cadastros permanecerão intactos.'))return;
   const next=structuredClone(s);next.hrEmployees=next.hrEmployees||[];
   for(const {row,existing} of matches){if(existing){const target=next.hrEmployees.find(x=>x.id===existing.id);for(const [k,v] of Object.entries(row))if(v!==''&&v!==null)target[k]=v;}else next.hrEmployees.push({id:crypto.randomUUID(),active:true,employmentStatus:'ativo',category:'outros',...row});}
   const ok=await persist(next,'Planilha de funcionários salva no Supabase.');if(ok===false)throw Error('O servidor não confirmou a importação.');
   notify('Importados '+rows.length+' registros.');render();
  }catch(error){document.getElementById('hrImportMessage').textContent=error.message||'Falha ao importar';notify(error.message||'Falha ao importar');}
 };
 document.querySelectorAll('[data-hr-person]').forEach(button=>{const id=button.dataset.hrPerson;const e=(s.hrEmployees||[]).find(x=>x.id===id);if(!e)return;
 const b=document.createElement('button');b.type='button';b.className='button secondary';b.textContent='Ficha';b.onclick=()=>profile(e);button.parentNode.insertBefore(b,button);
 });
 function profile(e){
  document.getElementById('hrProfileDialog')?.remove();const dialog=document.createElement('dialog');dialog.className='hr-editor';dialog.id='hrProfileDialog';
  dialog.innerHTML='<header class="hr-editor-header"><div><small>ENGEFEX · FICHA DO FUNCIONÁRIO</small><h2>'+escape(e.name)+'</h2><p>'+escape(statusLabel(e))+'</p></div><button type="button" class="hr-editor-close" id="hrProfileClose">×</button></header><div style="padding:18px;max-height:65vh;overflow:auto">'+fields.map(([key,label])=>'<div class="hr-profile-row" style="display:flex;gap:12px;align-items:center;justify-content:space-between;border-bottom:1px solid #e2e8f0;padding:10px 0"><div><small>'+label+'</small><div style="font-weight:700">'+escape(key==='birthDate'||key==='admissionDate'?fmt(e[key]):key==='companyStatus'?statusLabel(e):e[key]||'—')+'</div></div><button class="button secondary" type="button" data-copy-field="'+key+'">Copiar</button></div>').join('')+'</div><footer class="hr-editor-footer"><button type="button" class="button secondary" id="hrProfilePdf">Gerar PDF</button><button type="button" class="button primary" id="hrProfileDone">Fechar</button></footer>';
  document.body.appendChild(dialog);dialog.querySelector('#hrProfileClose').onclick=dialog.querySelector('#hrProfileDone').onclick=()=>{dialog.close();dialog.remove()};
  dialog.querySelectorAll('[data-copy-field]').forEach(b=>b.onclick=async()=>{await navigator.clipboard.writeText(clean(b.dataset.copyField==='companyStatus'?statusLabel(e):e[b.dataset.copyField]));notify('Campo copiado.');});
  dialog.querySelector('#hrProfilePdf').onclick=()=>pdf(e);dialog.showModal();
 }
 async function pdf(e){try{if(!root.PDFLib)throw Error('Biblioteca PDF indisponível');const doc=await root.PDFLib.PDFDocument.create();const page=doc.addPage([595,842]);const font=await doc.embedFont(root.PDFLib.StandardFonts.Helvetica);const bold=await doc.embedFont(root.PDFLib.StandardFonts.HelveticaBold);const line=(x,y,t,f=font,size=10)=>page.drawText(String(t).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7e]/g,' '),{x,y,font:f,size,color:root.PDFLib.rgb(.13,.22,.35),maxWidth:500});line(45,788,'ENGEFEX | FICHA INDIVIDUAL',bold,17);line(45,751,e.name,bold,13);let y=711;for(const [key,label] of fields){line(45,y,label+':',bold,9);y-=15;line(48,y,key==='companyStatus'?statusLabel(e):key==='birthDate'||key==='admissionDate'?fmt(e[key]):e[key]||'Nao informado');y-=30;}const bytes=await doc.save(),blob=new Blob([bytes],{type:'application/pdf'}),url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='ficha-funcionario-'+norm(e.name).toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}catch(err){notify(err.message)}}
};
})(window);
