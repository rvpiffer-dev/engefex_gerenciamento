import {Document,Packer,Paragraph,TextRun,Table,TableRow,TableCell,WidthType,AlignmentType,ImageRun,PageBreak,BorderStyle,HeightRule} from 'docx';
const blue='5084C3';
const p=(text='',options={})=>new Paragraph({children:[new TextRun({text,font:'Arial',size:20})],spacing:{after:100},...options});
const heading=(text)=>new Paragraph({children:[new TextRun({text,font:'Arial',size:22,bold:true,color:blue})],spacing:{before:170,after:150},keepNext:true});
const br=()=>new Paragraph({children:[new PageBreak()]});
function cell(content,width){return new TableCell({children:typeof content==='string'?[p(content,{spacing:{after:40}})]:content,width:{size:width,type:WidthType.DXA},margins:{top:60,bottom:60,left:80,right:80}})}
function table(rows,widths){return new Table({width:{size:100,type:WidthType.PERCENTAGE},columnWidths:widths,rows:rows.map(row=>new TableRow({cantSplit:true,children:row.map((x,i)=>cell(x,widths[i]))})),borders:Object.fromEntries(['top','bottom','left','right','insideHorizontal','insideVertical'].map(x=>[x,{style:BorderStyle.SINGLE,size:4,color:'000000'}]))})}
function photoCell(photo,width){const scale=Math.min(width/photo.width,390/photo.height);return new TableCell({children:[new Paragraph({children:[new ImageRun({data:photo.bytes,type:photo.bytes[0]===137?'png':'jpg',transformation:{width:Math.round(photo.width*scale),height:Math.round(photo.height*scale)},altText:{title:'Registro fotográfico',description:photo.caption||'Foto da obra',name:'Foto'}})],alignment:AlignmentType.CENTER,spacing:{after:70}}),...(photo.caption?[p(photo.caption,{spacing:{after:90}})]:[])],margins:{top:0,bottom:30,left:0,right:60}})}
export async function buildDocx(r,w,logo,photos){
 const children=[new Paragraph({alignment:AlignmentType.CENTER,children:[new ImageRun({data:logo,type:'png',transformation:{width:150,height:111},altText:{title:'Engefex',description:'Engefex Engenharia e Estruturas Metálicas',name:'Logo'}})],spacing:{before:280,after:200}}),new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:'DIÁRIO DE OBRA',font:'Arial',size:26,bold:true,color:'315D98'})],spacing:{after:350}}),table([['Obra',w.name,'Cliente',w.client],['Data',r.date.split('-').reverse().join('/'),'DO nº',r.number],['Responsável Técnico',w.technical,'CREA',w.crea]],[2100,4200,1400,2500]),heading('1. Condições Climáticas')];
 const checks=v=>['Sol','Chuva','Nublado'].map(x=>`( ${v===x?'X':' '} ) ${x}`).join('    ');
 const climate=new Table({width:{size:100,type:WidthType.PERCENTAGE},columnWidths:[5100,5100],borders:Object.fromEntries(['top','bottom','left','right','insideHorizontal','insideVertical'].map(x=>[x,{style:BorderStyle.NONE,size:0,color:'FFFFFF'}])),rows:[new TableRow({children:[cell([p('Manhã'),p(checks(r.morning))],5100),cell([p('Tarde'),p(checks(r.afternoon))],5100)]})]});
 children.push(climate,heading('2. Efetivo da Obra'),table([['Função','Qtd.','Empresa','Horas'],...r.crew.map(x=>[x.role,x.qty,x.company,x.hours])],[3000,1300,3500,2400]),br(),heading('3. Atividades Executadas'));
 for(const a of r.activities.split('\n').filter(x=>x.trim()))children.push(p(a.replace(/^[•\-]\s*/,''),{bullet:{level:0},spacing:{after:70}}));
 children.push(new Paragraph({text:'',spacing:{before:1400,after:0}}),heading('4. Equipamentos Utilizados'),p(['Munck','Caminhão','Máquina de Solda','Betoneira','Rompedor'].map(x=>`( ${r.equipment.includes(x)?'X':' '} ) ${x}`).join('  ')),p(`( ${r.other?'X':' '} ) Outros: ${r.other}`),new Paragraph({text:'',spacing:{before:1700,after:0}}),heading('5. Observações Relevantes'));
 for(const line of r.observations.split('\n'))children.push(p(line));
 children.push(br(),heading('6. Registro Fotográfico'));
 let used=0;
 if(!photos.length)children.push(p('Nenhuma foto anexada.'));
 for(let i=0;i<photos.length;){let group=[photos[i++]];if(group[0].height>group[0].width&&photos[i]&&photos[i].height>photos[i].width)group.push(photos[i++]);
 const width=group.length===2?330:680;
 const h=Math.max(...group.map(ph=>Math.min(390,ph.height*width/ph.width)))+20+(group.some(x=>x.caption)?25:0);
 if(used+h>890){children.push(br());used=0}
 const none={style:BorderStyle.NONE,size:0,color:'FFFFFF'};
 children.push(new Table({width:{size:100,type:WidthType.PERCENTAGE},borders:{top:none,bottom:none,left:none,right:none,insideHorizontal:none,insideVertical:none},rows:[new TableRow({cantSplit:true,children:group.map(ph=>photoCell(ph,width))})]}));used+=h;
 }
 if(used>650)children.push(br());
 children.push(heading('7. Assinaturas'),table([['Execução do Diário de Obra','Eng. Responsável de Obras','Fiscal/Cliente'],['\n\n','\n\n','\n\n'],[r.author,r.engineer,r.inspector]],[3400,3400,3400]));
 const doc=new Document({creator:'Diário de Obras',title:`Diário de Obra ${r.number}`,description:w.name,styles:{default:{document:{run:{font:'Arial',size:20},paragraph:{spacing:{line:250}}}}},sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:850,bottom:850,left:720,right:720}}},children}]});
 return new Uint8Array(await Packer.toArrayBuffer(doc));
}
