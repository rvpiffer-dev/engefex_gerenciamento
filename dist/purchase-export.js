/* Relatórios de Pedidos e Compras: exportações filtradas por obra e período de emissão. */
(function(root){'use strict';
const P=()=>root.EngefexPurchases,D=root.Obras;
const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const fmt=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0);
const br=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')?d.slice(8)+'/'+d.slice(5,7)+'/'+d.slice(0,4):String(d||'—');
const cents=n=>Math.round(Number(n||0)*100);
const slug=s=>String(s||'obras').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'-').slice(0,75);
const xml=s=>String(s??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&apos;'}[c]));
let api,getFilters,working=false;
function validDate(value){return !value||/^\d{4}-\d{2}-\d{2}$/.test(value)&&D.date(value)?.toLocaleDateString('sv-SE')===value}
function exportToolbar(s,project,filters={}){
 const label=project==='all'?'Todas as obras':s.projects.find(p=>p.id===project)?.name||'Obra selecionada';
 return '<section class="panel purchase-export-panel" style="margin:12px 0;padding:14px" aria-label="Exportação de compras e pedidos">'+
 '<div style="display:flex;flex-wrap:wrap;gap:12px;align-items:end;justify-content:space-between"><div><strong>Exportar compras e pedidos</strong><p class="section-note" style="margin:3px 0">Obra: '+h(label)+' · Período por data de emissão · Respeita os demais filtros aplicados.</p></div>'+
 '<div class="actions" style="flex-wrap:wrap;align-items:end;gap:8px"><label style="font-size:13px">De<input type="date" id="purchaseExportFrom" value="'+h(filters.dateFrom||'')+'" aria-label="Data inicial das compras"></label>'+
 '<label style="font-size:13px">Até<input type="date" id="purchaseExportTo" value="'+h(filters.dateTo||'')+'" aria-label="Data final das compras"></label>'+
 '<button type="button" class="button secondary" data-action="purchase-export-xlsx">Exportar Excel (XLSX)</button>'+
 '<button type="button" class="button secondary" data-action="purchase-export-pdf">Exportar PDF</button></div></div>'+
 '<p class="section-note" style="margin:8px 0 0">Em obras com rateio entre projetos, o relatório mostra o valor total da nota e o valor atribuído à obra, sem duplicar valores. Rascunhos pendentes de rateio são identificados.</p>'+
 '<p class="red-text" id="purchaseExportError" role="alert" style="margin:4px 0 0"></p></section>';
}
function bindList(){for(const key of ['From','To']){let el=document.getElementById('purchaseExport'+key);if(!el)continue;el.onchange=()=>{try{let from=document.getElementById('purchaseExportFrom')?.value||'',to=document.getElementById('purchaseExportTo')?.value||'';if(!validDate(from)||!validDate(to))throw Error('Data de emissão inválida.');if(from&&to&&from>to)throw Error('A data inicial não pode ser posterior à final.');const filters=getFilters();filters.dateFrom=from;filters.dateTo=to;api.render()}catch(e){let err=document.getElementById('purchaseExportError');if(err)err.textContent=e.message}}}}
function attributed(state,p,project){
 if(project==='all')return cents(P().totals(p));
 const costs=p.status==='Confirmada'?(state.costs||[]).filter(c=>c.purchase===p.id):[];
 if(costs.length)return costs.filter(c=>c.project===project).reduce((sum,c)=>sum+cents(c.amount),0);
 try{const dist=P().distribution(state,p),amounts=P().allocate(cents(P().totals(p)),dist.map(r=>r.weight));return dist.reduce((sum,r,i)=>sum+(r.project===project?amounts[i]:0),0)}
 catch{return null}
}
function records(state,project,filters={}){
 if(filters.dateFrom&&!validDate(filters.dateFrom)||filters.dateTo&&!validDate(filters.dateTo)||filters.dateFrom&&filters.dateTo&&filters.dateFrom>filters.dateTo)throw Error('Informe um período de emissão válido.');
 const list=(state.purchases||[]).filter(p=>(project==='all'||P().purchaseProjects(state,p).includes(project))&&P().filterMatch(state,p,filters)).slice().sort((a,b)=>(a.date||'').localeCompare(b.date||'')||String(a.number||'').localeCompare(String(b.number||''),'pt-BR'));
 return list.map(p=>{let value=null;try{value=cents(P().totals(p))}catch{}
 const allocated=value===null?null:attributed(state,p,project),parts=(p.installments||[]).map(x=>br(x.due)+(x.amount?' ('+fmt(x.amount)+')':'')).join('; ');
 return {id:p.id,date:p.date||'',kind:p.kind||'Compra',number:p.number||'',series:p.series||'',supplier:p.supplier||'',supplierDocument:p.supplierDocument||'',status:p.status||'',destination:P().destinationLabel(p,state),full:value===null?null:value/100,attributed:allocated===null?null:allocated/100,group:p.paymentGroupMeta?.code||'',due:parts,note:p.note||'',items:(p.items||[]).length,source:p,rateio:project==='all'?'Todas as obras':allocated===null?'A conferir':P().projectSummary(state,p,project)}});
}
function detailRows(state,project,rows){
 const out=[];for(const r of rows){let p=r.source;for(let item of p.items||[]){let matches=[];
 try{matches=P().itemDestinations(state,p,item).filter(x=>project==='all'||x.project===project)}catch{}
 if(!matches.length&&project!=='all'&&p.project===project)matches=[{project,stage:'',share:0,pending:true}];
 if(!matches.length&&project==='all')matches=[{project:p.project||'',stage:'',share:0,pending:true}];
 for(let dest of matches){let name=state.projects.find(x=>x.id===dest.project)?.name||(dest.project==='Geral'?'Geral':'—'),stage=state.budgetStages?.find(x=>x.id===dest.stage)?.name||'',val=dest.pending?null:Math.round(cents(item.total)*Number(dest.share||0)/100)/100;
 out.push({date:r.date,document:r.kind+' '+r.number,supplier:r.supplier,item:item.description||'',unit:item.unit||'',quantity:Number(item.quantity||0),unitPrice:Number(item.unitPrice||0),itemTotal:Number(item.total||0),work:name,stage,share:dest.pending?null:Number(dest.share||0),allocated:val,status:r.status});
 }}}return out}
function snapshot(state,project,filters={}){
 const rows=records(state,project,filters);if(!rows.length)throw Error('Nenhuma compra ou pedido encontrado para essa obra e período.');
 const works=project==='all'?'Todas as obras':state.projects.find(x=>x.id===project)?.name||'Obra não identificada';
 const sum=key=>Math.round(rows.reduce((a,r)=>a+cents(r[key]||0),0))/100;
 return {rows,details:detailRows(state,project,rows),project:works,period:(filters.dateFrom?br(filters.dateFrom):'Início')+' a '+(filters.dateTo?br(filters.dateTo):'Sem limite'),total:sum('full'),allocated:sum('attributed'),pending:rows.filter(r=>r.attributed===null).length,filtered:filters};
}
function saveBlob(blob,name){let link=document.createElement('a'),url=URL.createObjectURL(blob);link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000)}
function excelColumns(n){let s='';do{s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26)-1}while(n>=0);return s}
function sheetData(rows,widths){
 const stringify=(v,r,col)=>{let ref=excelColumns(col)+(r+1),num=typeof v==='number'&&Number.isFinite(v);return num?'<c r="'+ref+'" s="2"><v>'+v+'</v></c>':'<c r="'+ref+'" t="inlineStr"><is><t xml:space="preserve">'+xml(v)+'</t></is></c>'};
 const out=rows.map((cells,i)=>'<row r="'+(i+1)+'">'+cells.map((c,j)=>stringify(c,i,j)).join('')+'</row>').join('');
 return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>'+widths.map((w,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+w+'" customWidth="1"/>').join('')+'</cols><sheetData>'+out+'</sheetData></worksheet>';
}
async function generateExcel(report){
 if(!root.JSZip)throw Error('Gerador de Excel não disponível neste navegador.');
 let zip=new root.JSZip(),types=['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>','<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'].join('');
 zip.file('[Content_Types].xml',types);
 zip.file('_rels/.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
 zip.file('xl/workbook.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Compras e Notas" sheetId="1" r:id="rId1"/><sheet name="Itens e Rateios" sheetId="2" r:id="rId2"/></sheets></workbook>');
 zip.file('xl/_rels/workbook.xml.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
 zip.file('xl/styles.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>');
 const docs=[['ENGEFEX - RELATÓRIO DE PEDIDOS E COMPRAS'],['Obra',report.project],['Data de emissão',report.period],['Documentos',report.rows.length,'Total integral das notas',report.total,'Total atribuído à obra',report.allocated],['Valores pendentes de rateio',report.pending],[],['Emissão','Tipo','Número','Série','Fornecedor','CNPJ/CPF','Status','Destinação','Valor integral (R$)','Valor na obra (R$)','Fechamento','Parcelas e vencimentos','Itens','Rateio por obra','Observações'],
 ...report.rows.map(r=>[br(r.date),r.kind,r.number,r.series,r.supplier,r.supplierDocument,r.status,r.destination,r.full,r.attributed,r.group,r.due,r.items,r.rateio,r.note])];
 const items=[['ENGEFEX - ITENS DAS COMPRAS'],['Obra',report.project],['Data de emissão',report.period],[],['Emissão','Documento','Fornecedor','Descrição','Unidade','Quantidade','Valor unitário (R$)','Total item (R$)','Obra de destino','Etapa','Rateio (%)','Valor item rateado (R$)','Status'],
 ...report.details.map(r=>[br(r.date),r.document,r.supplier,r.item,r.unit,r.quantity,r.unitPrice,r.itemTotal,r.work,r.stage,r.share,r.allocated,r.status])];
 zip.file('xl/worksheets/sheet1.xml',sheetData(docs,[15,18,17,12,35,23,17,22,23,23,17,39,12,39,44]));
 zip.file('xl/worksheets/sheet2.xml',sheetData(items,[15,20,35,46,13,16,23,22,30,30,14,25,18]));
 return zip.generateAsync({type:'blob',compression:'DEFLATE'});
}
async function generatePDF(report){
 if(!root.PDFLib)throw Error('Gerador de PDF indisponível. Atualize o aplicativo.');
 const {PDFDocument,StandardFonts,rgb}=root.PDFLib,pdf=await PDFDocument.create(),normal=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const W=841.89,H=595.28,L=29,R=W-29,blue=rgb(.07,.24,.52),ink=rgb(.14,.19,.24),muted=rgb(.42,.46,.52),edge=rgb(.83,.86,.9),pale=rgb(.94,.96,.98),white=rgb(1,1,1);
 let page,y,pages=0;
 const safe=v=>String(v??'—').replace(/[\r\n\t]/g,' ').replace(/[\u2010-\u2027]/g,'-').replace(/[\u20ac\u2190-\u21ff]/g,'').replace(/[^\x20-\x7e\xa0-\xff]/g,'?');
 function line(v,x,at,size=8,isBold=false,color=ink,maxWidth){const font=isBold?bold:normal;let s=safe(v);if(maxWidth){while(s.length>3&&font.widthOfTextAtSize(s,size)>maxWidth)s=s.slice(0,-2).trimEnd()+'.'}page.drawText(s,{x,y:at,size,font,color})}
 const cols=[['Emissão',64],['Documento',85],['Fornecedor',154],['Situação',72],['Destinação',99],['Nota (R$)',84],['Na obra (R$)',93],['Fechamento',72],['Vencimentos',60]];
 const colWidthSum=cols.reduce((n,c)=>n+c[1],0),factor=(R-L)/colWidthSum,widths=cols.map(c=>c[1]*factor);
 function rowHeader(){page.drawRectangle({x:L,y:y-19,width:R-L,height:25,color:blue});let x=L+5;cols.forEach((c,i)=>{line(c[0],x,y-11,7,true,white,widths[i]-8);x+=widths[i]});y-=27}
 function open(){page=pdf.addPage([W,H]);pages++;page.drawRectangle({x:0,y:H-9,width:W,height:9,color:blue});
 line('ENGEFEX  |  PEDIDOS E COMPRAS',L,H-35,16,true,blue);
 line('Obra: '+report.project,L,H-58,10,true,ink,550);
 line('Data de emissão: '+report.period,L,H-75,9,false,muted);
 line(report.rows.length+' documentos  |  Total das notas: '+fmt(report.total)+'  |  Valor nesta obra: '+fmt(report.allocated),L,H-92,9,true,ink,775);
 if(report.pending)line('Atenção: '+report.pending+' nota(s) com valor de rateio pendente; não incluídas no total atribuído à obra.',L,H-107,8,false,blue);
 y=H-(report.pending?130:117);rowHeader()}
 open();for(let i=0;i<report.rows.length;i++){if(y<65)open();const r=report.rows[i],values=[br(r.date),r.kind+' '+r.number,r.supplier,r.status,r.destination,r.full===null?'A conferir':fmt(r.full),r.attributed===null?'A conferir':fmt(r.attributed),r.group||'—',(r.source.installments||[]).map(p=>br(p.due)).join(', ')||'—'];
 if(i%2===0)page.drawRectangle({x:L,y:y-18,width:R-L,height:25,color:pale});let x=L+5;values.forEach((v,j)=>{line(v,x,y-8,7,false,ink,widths[j]-8);x+=widths[j]});page.drawLine({start:{x:L,y:y-19},end:{x:R,y:y-19},color:edge,thickness:.35});y-=27}
 for(let i=0;i<pdf.getPages().length;i++){const pg=pdf.getPages()[i];pg.drawLine({start:{x:L,y:35},end:{x:R,y:35},color:edge,thickness:.6});pg.drawText('ENGEFEX  •  Relatório gerado em '+br(D.today()).replace(/[^\x20-\xff]/g,'-'),{x:L,y:21,size:7,font:normal,color:muted});pg.drawText('Página '+(i+1)+' de '+pdf.getPages().length,{x:R-78,y:21,size:7,font:normal,color:muted})}
 return pdf.save();
}
function filename(report,ext){return 'Compras-Pedidos-'+slug(report.project)+'-'+String(report.filtered.dateFrom||'inicio')+'-'+String(report.filtered.dateTo||'sem-limite')+'.'+ext}
async function exportFile(kind){if(working)return;const err=document.getElementById('purchaseExportError');if(err)err.textContent='';try{
 const from=document.getElementById('purchaseExportFrom')?.value||'',to=document.getElementById('purchaseExportTo')?.value||'',filters={...getFilters(),dateFrom:from,dateTo:to},state=api.getState(),project=api.getProject();
 const report=snapshot(state,project,filters);working=true;for(const btn of document.querySelectorAll('[data-action^="purchase-export-"]'))btn.disabled=true;
 if(kind==='xlsx')saveBlob(await generateExcel(report),filename(report,'xlsx'));
 else saveBlob(new Blob([await generatePDF(report)],{type:'application/pdf'}),filename(report,'pdf'));
 api.toast(report.rows.length+' documentos exportados em '+kind.toUpperCase()+'.');
 }catch(e){if(err)err.textContent=e.message;api.toast(e.message)}finally{working=false;for(const btn of document.querySelectorAll('[data-action^="purchase-export-"]'))btn.disabled=false}}
root.EngefexPurchaseExport={exportToolbar,bindList,records,detailRows,snapshot,generateExcel,generatePDF,handle(action){if(action==='purchase-export-xlsx'||action==='purchase-export-pdf'){exportFile(action.endsWith('xlsx')?'xlsx':'pdf');return true}return false},busy:()=>working,init(bridge,filters){api=bridge;getFilters=filters}};
})(typeof window==='undefined'?globalThis:window);
