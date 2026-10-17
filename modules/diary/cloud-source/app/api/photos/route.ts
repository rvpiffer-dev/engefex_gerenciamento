import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
export async function POST(req:Request){
const u=await getChatGPTUser();if(!u)return Response.json({error:'Entre na sua conta.'},{status:401});
if(new URL(req.url).origin!==req.headers.get('origin'))return new Response(null,{status:403});
if(Number(req.headers.get('content-length')||0)>6*1024*1024)return Response.json({error:'A foto deve ter até 5 MB.'},{status:413});
try{const f=(await req.formData()).get('file');if(!(f instanceof File)||!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>5*1024*1024||!f.size)return Response.json({error:'Use uma imagem JPG, PNG ou WebP de até 5 MB.'},{status:400});
const bytes=new Uint8Array(await f.arrayBuffer());const jpeg=bytes[0]===255&&bytes[1]===216;const png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78;const webp=String.fromCharCode(...bytes.slice(8,12))==='WEBP';if(!((f.type==='image/jpeg'&&jpeg)||(f.type==='image/png'&&png)||(f.type==='image/webp'&&webp)))return Response.json({error:'Arquivo de imagem inválido.'},{status:400});
const id=crypto.randomUUID(),key=`${u.userId}/${id}`;await env.BUCKET!.put(key,bytes,{httpMetadata:{contentType:f.type}});try{await env.DB!.prepare('INSERT INTO photos (id,owner,mime,size) VALUES (?,?,?,?)').bind(id,u.userId,f.type,f.size).run();}catch(e){await env.BUCKET!.delete(key);throw e;}return Response.json({id});}catch{return Response.json({error:'Falha ao enviar a foto. Tente novamente.'},{status:500});}}
