import type {Report,Work} from './model';
import {photoBytes} from './adapter';
export async function exportDocx(r:Report,w:Work){
 const {buildDocx}=await import('./export.mjs');
 const logo=await fetch('./engefex.png').then(x=>{if(!x.ok)throw Error('Logo não disponível.');return x.arrayBuffer()});
 const photos=[];for(const photo of r.photos)photos.push({...photo,bytes:await photoBytes(photo.id)});
 const bytes=await buildDocx(r,w,new Uint8Array(logo),photos);const blob=new Blob([new Uint8Array(bytes)],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
 const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`Diario_de_Obra_${r.number.replace(/[^a-zA-Z0-9_-]/g,'_')}_${r.date}.docx`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
