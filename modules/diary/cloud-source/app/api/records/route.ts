import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {workSchema,reportSchema} from '../../../lib/model';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){const u=await getChatGPTUser();if(!u)return json({error:'Entre na sua conta.'},401);const r=await env.DB!.prepare('SELECT id,kind,body,revision,updated FROM records WHERE owner=? ORDER BY updated DESC').bind(u.userId).all();return json(r.results.map((x:any)=>({id:x.id,kind:x.kind,data:JSON.parse(x.body),revision:x.revision,updated:x.updated})));}
export async function POST(req:Request){
 const u=await getChatGPTUser();if(!u)return json({error:'Entre na sua conta.'},401);
 if(new URL(req.url).origin!==req.headers.get('origin'))return json({error:'Origem inválida.'},403);
 try {
 const input=await req.json() as any;
 if(!['work','report'].includes(input.kind))return json({error:'Tipo inválido.'},400);
 const valid=(input.kind==='work'?workSchema:reportSchema).safeParse(input.data);if(!valid.success)return json({error:'Confira os campos obrigatórios e os limites de preenchimento.'},400);
 const data=valid.data as any;
 if(input.kind==='report'){
 const w=await env.DB!.prepare("SELECT id FROM records WHERE id=? AND owner=? AND kind='work'").bind(data.workId,u.userId).first();if(!w)return json({error:'Obra não encontrada.'},404);
 for(const photo of data.photos){if(!await env.DB!.prepare('SELECT id FROM photos WHERE id=? AND owner=?').bind(photo.id,u.userId).first())return json({error:'Foto não disponível para esta conta.'},400);}
 }
 const now=new Date().toISOString();
 if(input.id){
 const old=await env.DB!.prepare('SELECT kind FROM records WHERE id=? AND owner=?').bind(input.id,u.userId).first();if(!old||old.kind!==input.kind)return json({error:'Registro não encontrado.'},404);
 const result=await env.DB!.prepare('UPDATE records SET body=?,revision=revision+1,updated=? WHERE id=? AND owner=? AND revision=?').bind(JSON.stringify(data),now,input.id,u.userId,input.revision).run();
 if(!result.meta.changes)return json({error:'O registro foi alterado em outro aparelho. Recarregue a página antes de editar novamente.'},409);
 return json({id:input.id,kind:input.kind,data,revision:input.revision+1,updated:now});
 }
 const id=crypto.randomUUID();await env.DB!.prepare('INSERT INTO records (id,owner,kind,body,revision,updated) VALUES (?,?,?,?,1,?)').bind(id,u.userId,input.kind,JSON.stringify(data),now).run();return json({id,kind:input.kind,data,revision:1,updated:now});
 }catch{return json({error:'Não foi possível salvar. Tente novamente.'},400);}
}
