/* Exporta uma medição existente para PDF A4, sem modificar o banco. */
(function(root){'use strict';
const D=root.Obras;
const brdate=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''))?v.slice(8,10)+'/'+v.slice(5,7)+'/'+v.slice(0,4):String(v||'—');
const format=(n,d=2)=>new Intl.NumberFormat('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d}).format(Number(n||0));
const currency=n=>'R$ '+format(n);
function snapshot(state,recordId){
 const row=state.measurements.find(m=>m.id===recordId);
 if(!row)throw Error('Medição não encontrada.');
 const group=state.measurements.filter(m=>m.project===row.project&&m.number===row.number);
 const project=state.projects.find(p=>p.id===row.project);
 if(!project)throw Error('A obra vinculada à medição não foi encontrada.');
 const lines=group.map(m=>{const item=state.budgetItems.find(x=>x.id===m.activity);
  return {code:item?D.planningCode(item):'—',name:item?.name||'Item não encontrado no orçamento',unit:item?.unit||'',quantity:Number(m.quantity||0),total:Number(item?.quantity||0),value:D.measurementValue(state,m)};
 });
 const gross=Math.round(lines.reduce((a,i)=>a+i.value,0)*100)/100;
 const rate=Number(row.retentionRate||0);
 const approved=group.every(m=>m.status==='Aprovada');
 const notes=approved?(row.directInvoices||[]):(row.plannedDirectInvoices||row.directInvoices||[]);
 const direct=Math.round(notes.reduce((a,i)=>a+Number(i.amount||0),0)*100)/100;
 const retention=Math.round(gross*rate)/100;
 const advance=Number(approved?(row.advanceOffset||0):(row.plannedAdvanceOffset??row.advanceOffset??0));
 const net=Math.round((gross-retention-direct-advance)*100)/100;
 return {project,number:row.number,date:row.date,status:[...new Set(group.map(m=>m.status))].join(' / '),approved,
  note:row.note||'',gross,retention,rate,advance,direct,net,
  issued:row.approved||row.submitted||'',lines,notes};
}
async function generate(state,recordId,options={}){
 if(!root.PDFLib)throw Error('Gerador PDF indisponível. Atualize o aplicativo.');
 const data=snapshot(state,recordId),{PDFDocument,StandardFonts,rgb}=root.PDFLib,pdf=await PDFDocument.create();
 const normal=await pdf.embedFont(StandardFonts.Helvetica),strong=await pdf.embedFont(StandardFonts.HelveticaBold);
 const blue=rgb(.07,.25,.60),ink=rgb(.12,.18,.25),muted=rgb(.39,.45,.54),edge=rgb(.80,.84,.89),pale=rgb(.93,.96,.99),white=rgb(1,1,1);
 const W=595.28,H=841.89,L=34,R=W-34,B=56;let page,y;
 const clean=s=>String(s??'').replace(/[\r\n\t]+/g,' ').replace(/[\u2000-\u206f\u2022]/g,'-').replace(/[\u2014\u2013]/g,'-').replace(/[\u20ac\u2190-\u21ff]/g,'').trim();
 const text=(str,x,pos,size=9,bold=false,color=ink)=>{const font=bold?strong:normal;let value=clean(str);
  try{font.encodeText(value)}catch{value=value.replace(/[^\x20-\x7e\xa0-\xff]/g,'?')}
  page.drawText(value,{x,y:pos,size,font,color});
 };
 const width=(str,size=9,bold=false)=>{try{return (bold?strong:normal).widthOfTextAtSize(clean(str),size)}catch{return clean(str).length*size*.55}};
 const wrap=(str,maxWidth,size=9,bold=false)=>{const words=clean(str).split(/\s+/),lines=[],current=[];for(const word of words){
  if(width([...current,word].join(' '),size,bold)>maxWidth&&current.length){lines.push(current.join(' '));current.length=0}
  if(width(word,size,bold)>maxWidth){let part='';for(const ch of word){if(width(part+ch,size,bold)>maxWidth&&part){lines.push(part);part=''}part+=ch}if(part)current.push(part)}
  else current.push(word);
 }if(current.length)lines.push(current.join(' '));return lines.length?lines:[''];};
 const logo=options.logoBytes?await pdf.embedPng(options.logoBytes).catch(()=>null):null;
 function begin(){
  page=pdf.addPage();page.setSize(W,H);y=H-41;
  if(logo){const image=logo.scale(.15);let factor=Math.min(125/image.width,47/image.height);page.drawImage(logo,{x:L,y:H-88,width:image.width*factor,height:image.height*factor})}
  text('ENGEFEX ENGENHARIA',logo?168:L,H-50,14,true,blue);
  text('MEDICAO DE SERVICOS - '+data.number,logo?168:L,H-68,11,true,ink);
  page.drawLine({start:{x:L,y:H-99},end:{x:R,y:H-99},color:blue,thickness:1.8});y=H-121;
  text('OBRA: '+data.project.name,L,y,10,true);y-=16;
  text('CLIENTE: '+(data.project.client||'Não informado'),L,y,9);y-=16;
  text('DATA BASE: '+brdate(data.date)+'  |  STATUS: '+data.status,L,y,9);y-=16;
  if(!data.approved){text('DOCUMENTO PARA CONFERENCIA - MEDICAO NAO APROVADA',L,y,8,true,blue);y-=16}
  else if(data.issued){text('APROVACAO/APRESENTACAO: '+brdate(data.issued),L,y,8);y-=16}
 }
 function space(min){if(y-min<B){begin();return true}return false}
 function band(title){space(36);y-=6;page.drawRectangle({x:L,y:y-18,width:R-L,height:21,color:pale});text(title,L+7,y-12,9,true,blue);y-=28}
 function tableHead(cols,positions){space(35);page.drawRectangle({x:L,y:y-22,width:R-L,height:23,color:blue});
  for(let i=0;i<cols.length;i++)text(cols[i],positions[i]+4,y-14,7.5,true,white);y-=25}
 function row(values,positions,widths,{sum=false}={}){const size=8,lines=values.map((value,i)=>wrap(value,widths[i]-8,size,sum));const lineCount=Math.max(...lines.map(x=>x.length)),rh=Math.max(24,lineCount*10+8);space(rh+8);
  if(sum)page.drawRectangle({x:L,y:y-rh,width:R-L,height:rh,color:pale});
  for(let i=0;i<values.length;i++)lines[i].forEach((t,j)=>text(t,positions[i]+4,y-11-j*10,size,sum));
  page.drawLine({start:{x:L,y:y-rh},end:{x:R,y:y-rh},thickness:.4,color:edge});y-=rh;}
 begin();band('1. SERVICOS MEDIDOS');
 const positions=[L,L+55,L+298,L+363,L+419],widths=[55,243,65,56,108];
 tableHead(['COD.','SERVICO DO ORCAMENTO','QUANT.','UNID.','VALOR (R$)'],positions);
 for(const x of data.lines)row([x.code,x.name,format(x.quantity,3),x.unit,format(x.value)],positions,widths);
 space(32);row(['','TOTAL BRUTO','','',format(data.gross)],positions,widths,{sum:true});
 band('2. DEMONSTRATIVO FINANCEIRO');
 const summary=[['Valor bruto medido',data.gross],['Retencao contratual ('+format(data.rate)+'%)',-data.retention],['Amortizacao da entrada contratual',-data.advance],['Faturamento direto',-data.direct],['LIQUIDO DA MEDICAO',data.net]];
 for(const [label,value] of summary){space(23);const highlight=label.startsWith('LIQUIDO');if(highlight)page.drawRectangle({x:L,y:y-22,width:R-L,height:24,color:pale});
  text(label,L+6,y-14,9,highlight,highlight?blue:ink);const valueLabel=(value<0?'- ':'')+currency(Math.abs(value));text(valueLabel,R-width(valueLabel,9,highlight)-7,y-14,9,highlight,highlight?blue:ink);y-=25}
 if(data.notes.length){band('3. NOTAS FISCAIS COM FATURAMENTO DIRETO');
  const pos=[L,L+83,L+264,L+327,L+404],wid=[83,181,63,77,123];tableHead(['DATA','FORNECEDOR','NF','PC','VALOR (R$)'],pos);
  for(const note of data.notes)row([brdate(note.date),note.supplier,note.invoice,note.order||'',format(note.amount)],pos,wid);
  row(['','TOTAL','','',format(data.direct)],pos,wid,{sum:true});
 }
 if(data.note){band('4. OBSERVACOES');for(const line of wrap(data.note,R-L-12,8)){space(15);text(line,L+6,y-12,8);y-=14}}
 for(let i=0;i<pdf.getPageCount();i++){const p=pdf.getPage(i);p.drawLine({start:{x:L,y:39},end:{x:R,y:39},thickness:.5,color:edge});
  p.drawText('ENGEFEX | '+clean(data.number)+' | '+(data.approved?'Medição aprovada':'Medição para conferência'),{x:L,y:24,font:normal,size:7,color:muted});
  const title='Pagina '+(i+1)+' de '+pdf.getPageCount();p.drawText(title,{x:R-normal.widthOfTextAtSize(title,7),y:24,font:normal,size:7,color:muted});
 }
 pdf.setTitle('Medição '+data.number+' - '+data.project.name);pdf.setAuthor('Engefex Engenharia');pdf.setSubject('Itens medidos, retenção contratual, amortização de entrada e notas de faturamento direto');
 return pdf.save();
}
async function download(state,recordId){
 let logoBytes=null;try{const response=await fetch('engefex-logo.png');if(response.ok)logoBytes=new Uint8Array(await response.arrayBuffer())}catch{}
 const pdf=await generate(state,recordId,{logoBytes}),row=state.measurements.find(m=>m.id===recordId);
 const name=('Medicao_'+(row?.number||'')+'_'+(state.projects.find(p=>p.id===row?.project)?.name||'Obra')).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_').slice(0,130)+'.pdf';
 const url=URL.createObjectURL(new Blob([pdf],{type:'application/pdf'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
root.EngefexMeasurementPDF={snapshot,generate,download};
})(typeof window==='undefined'?globalThis:window);
