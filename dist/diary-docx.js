(function(root){'use strict';
// Modelo Diário 076: A4, retratos 9,35 x 13 cm, paisagens 19 x 13 cm.
// O enquadramento acontece só na exportação, preservando os anexos originais.
const PHOTO_LAYOUT={portraitWidth:9.35,landscapeWidth:19,height:13,margins:{top:822,bottom:567,left:709,right:425}};
function dimensions(w,h){return {width:(w>=h?PHOTO_LAYOUT.landscapeWidth:PHOTO_LAYOUT.portraitWidth)*96/2.54,height:PHOTO_LAYOUT.height*96/2.54}}
async function formatPhotos(photos){
 return Promise.all(photos.map(async photo=>{
  const img=new Image();
  await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('Não foi possível preparar a foto do diário.'));img.src=photo.dataURL;});
  const landscape=photo.width>=photo.height,canvas=document.createElement('canvas');canvas.width=landscape?1900:935;canvas.height=1300;
  const context=canvas.getContext('2d');if(!context)throw Error('Não foi possível preparar a fotografia.');
  const ratio=canvas.width/canvas.height;let sw=img.naturalWidth,sh=img.naturalHeight;
  if(sw/sh>ratio)sw=sh*ratio;else sh=sw/ratio;
  context.drawImage(img,(img.naturalWidth-sw)/2,(img.naturalHeight-sh)/2,sw,sh,0,0,canvas.width,canvas.height);
  return {...photo,width:canvas.width,height:canvas.height,dataURL:canvas.toDataURL('image/jpeg',0.9)};
 }));
}
function orderPhotosForReport(photos){const portraits=[],landscapes=[];for(const photo of photos)(photo.height>photo.width?portraits:landscapes).push(photo);return [...portraits,...landscapes];}
function createDocument(lib,{project,record,photos=[],logo}){photos=orderPhotosForReport(photos);const {Document,Paragraph,TextRun,Table,TableRow,TableCell,WidthType,ImageRun,AlignmentType,BorderStyle,HeadingLevel,TableLayoutType}=lib;let children=[],text=x=>String(x??'').trim()||'—';
const p=(v,opt={})=>new Paragraph({children:String(v).split('\n').flatMap((s,i)=>[...(i?[new TextRun({break:1})]:[]),new TextRun({text:s})]),spacing:{after:130,line:260},...opt});
const heading=(s,pageBreakBefore=false)=>new Paragraph({text:s,heading:HeadingLevel.HEADING_1,pageBreakBefore,keepNext:true,spacing:{before:240,after:160}});
const border={style:BorderStyle.SINGLE,size:4,color:'333333'},borders={top:border,bottom:border,left:border,right:border,insideHorizontal:border,insideVertical:border};
function table(rows,widths,header=false){return new Table({width:{size:100,type:WidthType.PERCENTAGE},columnWidths:widths,borders,rows:rows.map((row,i)=>new TableRow({tableHeader:header&&i===0,cantSplit:true,children:row.map((v,j)=>new TableCell({width:{size:widths[j],type:WidthType.DXA},margins:{top:90,bottom:90,left:110,right:110},children:[p(text(v),{spacing:{after:0,line:250}})]}))}))})}
if(logo)children.push(new Paragraph({children:[new ImageRun({type:'png',data:logo,transformation:{width:160,height:124},altText:{title:'Engefex',description:'Engefex Engenharia e Estruturas Metálicas',name:'Engefex'}})],alignment:AlignmentType.CENTER,spacing:{after:160}}));
children.push(new Paragraph({text:'DIÁRIO DE OBRA',heading:HeadingLevel.TITLE,alignment:AlignmentType.CENTER,spacing:{after:300}}));
let date=record.date?record.date.split('-').reverse().join('/'):'—';children.push(table([['Obra',project.name,'Cliente',project.client],['Data',date,'DO nº',record.number],['Responsável Técnico',project.owner,'CREA',project.crea]],[1850,3750,1300,2700]));
const climate=value=>['Sol','Chuva','Nublado'].map(t=>'('+(value===t?' X ':'   ')+') '+t).join('    ');
children.push(heading('1. Condições Climáticas'),table([['Manhã','Tarde'],[climate(record.morning),climate(record.afternoon)]],[4800,4800]));if(record.conditions)children.push(p(record.conditions,{spacing:{before:120,after:120}}));
children.push(heading('2. Efetivo da Obra'),table([['Função','Qtd.','Empresa','Horas'],...(record.staff?.length?record.staff.map(r=>[r.role,r.quantity,r.company,r.hours]):[['','','','']])],[3300,1000,3300,2000],true));
children.push(heading('3. Atividades Executadas',true),p(text(record.description)),heading('4. Equipamentos Utilizados'),p(text(record.equipment)),heading('5. Observações Relevantes'));
let observations=[record.observations,record.materials?'Materiais: '+record.materials:'',record.inspections?'Inspeções e liberações: '+record.inspections:'',record.interference?'Interferências e pendências: '+record.interference:'',record.instructions?'Orientações recebidas: '+record.instructions:'',record.nextDay?'Planejamento do próximo dia: '+record.nextDay:''].filter(Boolean);children.push(p(observations.join('\n\n')||'—'));
children.push(new Paragraph({text:'6. Registro Fotográfico',heading:HeadingLevel.HEADING_1,pageBreakBefore:true,keepNext:true,spacing:{before:0,after:180,line:260}}));
if(!photos.length)children.push(p('Sem fotos anexadas a este registro.'));
const portrait=photo=>photo.width<photo.height;
const photoImage=(photo,i)=>new ImageRun({type:photo.dataURL.startsWith('data:image/png')?'png':'jpg',data:photo.dataURL,transformation:dimensions(photo.width,photo.height),altText:{title:'Foto '+(i+1),description:photo.caption||photo.name||'Foto da obra',name:photo.name||'Foto'}});
function photoContents(photo,i,newPage=false){return [new Paragraph({children:[photoImage(photo,i)],alignment:AlignmentType.LEFT,pageBreakBefore:newPage,keepNext:!!photo.caption,spacing:{before:0,after:0}}),...(photo.caption?[p(photo.caption,{spacing:{before:40,after:0,line:220}})]:[])];}
function photoRow(group,start,newPage){
 const gap=170,portraitWidth=5301,fullWidth=10772;
 const cell=(photo,i,width)=>new TableCell({width:{size:width,type:WidthType.DXA},margins:{top:0,bottom:0,left:0,right:0},children:photoContents(photo,start+i,newPage&&i===0)});
 const cells=group.length===2?[cell(group[0],0,portraitWidth),new TableCell({width:{size:gap,type:WidthType.DXA},margins:{top:0,bottom:0,left:0,right:0},children:[new Paragraph({text:'',spacing:{before:0,after:0,line:1}})]}),cell(group[1],1,portraitWidth)]:[cell(group[0],0,fullWidth)];
 const none={style:BorderStyle.NONE,size:0,color:'FFFFFF'};
 return new Table({width:{size:fullWidth,type:WidthType.DXA},columnWidths:group.length===2?[portraitWidth,gap,portraitWidth]:[fullWidth],layout:TableLayoutType.FIXED,borders:{top:none,bottom:none,left:none,right:none,insideVertical:none,insideHorizontal:none},rows:[new TableRow({cantSplit:true,children:cells})]});
}
for(let i=0,rowIndex=0;i<photos.length;rowIndex++){const start=i,group=[photos[i++]];if(portrait(group[0])&&photos[i]&&portrait(photos[i]))group.push(photos[i++]);children.push(photoRow(group,start,rowIndex>0&&rowIndex%2===0));if(i<photos.length&&rowIndex%2===0)children.push(new Paragraph({text:'',spacing:{before:0,after:0,line:182,lineRule:'exact'},run:{size:2}}));}
children.push(heading('7. Assinaturas'),table([['Execução do Diário de Obra','Eng. Responsável de Obras','Fiscal/Cliente'],['\n\n________________________\n'+text(record.author),'\n\n________________________\n'+text(record.engineer),'\n\n________________________\n'+text(record.inspector)]],[3200,3200,3200],true));
return new Document({creator:'Engefex Engenharia e Estruturas Metálicas',title:'Diário de Obra '+text(record.number),styles:{default:{document:{run:{font:'Arial',size:22,color:'000000'},paragraph:{spacing:{after:130,line:260}}}},paragraphStyles:[{id:'Title',name:'Title',basedOn:'Normal',next:'Normal',run:{font:'Arial',size:30,bold:true,color:'365F91'}},{id:'Heading1',name:'heading 1',basedOn:'Normal',next:'Normal',quickFormat:true,run:{font:'Arial',size:24,bold:true,color:'4F81BD'},paragraph:{keepNext:true}}]},sections:[{properties:{page:{size:{width:11906,height:16838},margin:PHOTO_LAYOUT.margins}},children}]});}
function filename(project,record){return ('Diario_'+(record.number||'sem_numero')+'_'+project.name+'_'+(record.date||'sem_data')).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9_-]/g,'_')+'.docx'}
let api={createDocument,dimensions,formatPhotos,filename,orderPhotosForReport,PHOTO_LAYOUT};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ObrasDiaryDocx=api;
})(typeof window==='undefined'?globalThis:window);

