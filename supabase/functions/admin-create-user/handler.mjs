/* Credenciais administrativas existem somente no ambiente da Edge Function. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function makeHandler({url,serviceKey,fetcher=fetch,newId=()=>crypto.randomUUID()}){
 return async function handler(req){
  const origin=req.headers.get('origin')||'';
  const allowed=!origin||origin==='https://rvpiffer-dev.github.io'||/^http:\/\/localhost(?::\d+)?$/.test(origin);
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',...(allowed&&origin?{'Access-Control-Allow-Origin':origin}:{}),'Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
  const reply=(status,message,extra={})=>new Response(JSON.stringify({message,...extra}),{status,headers});
  if(!allowed)return reply(403,'Origem não autorizada.');
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return reply(405,'Método não permitido.');
  const authorization=req.headers.get('authorization')||'';
  if(!/^Bearer [^\s]+$/i.test(authorization))return reply(401,'Entre novamente como administrador.');
  if(!url||!serviceKey)return reply(503,'Cadastro de usuários indisponível.');
  let body;try{const text=await req.text();if(text.length>8192)return reply(413,'Cadastro muito grande.');body=JSON.parse(text)}catch{return reply(400,'Cadastro inválido.')}
  if(!body||typeof body!=='object'||Array.isArray(body))return reply(400,'Cadastro inválido.');
  const {workspace,name,email,password,userId}=body;const reset=body.action==='reset_password';
  if(body.action&&body.action!=='create'&&!reset)return reply(400,'Operação inválida.');
  if(!UUID.test(workspace||'')||typeof password!=='string'||password.length<6||password.length>128)return reply(400,'Informe uma senha de 6 a 128 caracteres.');
  if(reset){if(!UUID.test(userId||''))return reply(400,'Usuário inválido.')}else if(typeof name!=='string'||!name.trim()||name.trim().length>120||typeof email!=='string'||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))return reply(400,'Informe nome e e-mail válido.');
  const adminHeaders={apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/json'};
  const call=async(path,options={})=>{const response=await fetcher(url+path,{...options,headers:options.headers||adminHeaders,signal:AbortSignal.timeout(12000)});let data;try{data=await response.json()}catch{data=null}return{ok:response.ok,status:response.status,data}};
  let created=null;
  try{
   // Auth valida a assinatura e a identidade. A claim de sessão só é lida depois dessa validação.
   const user=await call('/auth/v1/user',{headers:{apikey:serviceKey,Authorization:authorization}});
   if(!user.ok||!UUID.test(user.data?.id||''))return reply(401,'Sessão expirada. Entre novamente.');
   let session;try{session=JSON.parse(atob(authorization.split(' ')[1].split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).session_id}catch{return reply(401,'Sessão inválida.')}
   if(!UUID.test(session||''))return reply(401,'Entre novamente como administrador.');
   const requestId=newId(),args={p_workspace:workspace,p_actor:user.data.id,p_session:session,p_request:requestId};
   const guard=await call('/rest/v1/rpc/'+(reset?'engefex_admin_password_guard':'engefex_admin_user_guard'),{method:'POST',body:JSON.stringify(reset?{...args,p_user:userId}:args)});
   if(!guard.ok)return reply(guard.data?.code==='P0001'?429:403,guard.data?.code==='P0001'?'Muitas operações em sequência. Aguarde um minuto e tente novamente.':'Somente um administrador com sessão ativa pode gerenciar usuários.');
   if(reset){
    const updated=await call('/auth/v1/admin/users/'+userId,{method:'PUT',body:JSON.stringify({password})});
    if(!updated.ok)return reply(400,'Não foi possível redefinir a senha. Use uma senha mais forte ou diferente da atual.');
    // A senha já foi alterada; nunca reportar falha genérica que provoque repetição da operação.
    try{await call('/rest/v1/rpc/engefex_admin_password_complete',{method:'POST',body:JSON.stringify({...args,p_user:userId})})}catch{}
    return reply(200,'Senha redefinida com sucesso.');
   }
   const result=await call('/auth/v1/admin/users',{method:'POST',body:JSON.stringify({email:email.trim().toLowerCase(),password,email_confirm:true,user_metadata:{nome:name.trim()}})});
   if(!result.ok){if(result.data?.code==='email_exists'||result.data?.error_code==='email_exists'||/already.*registered|already.*exist/i.test(result.data?.msg||result.data?.message||''))return reply(409,'Este e-mail já está cadastrado. Nenhuma senha ou permissão foi alterada.');return reply(400,'Não foi possível criar o usuário. Confira o e-mail e use uma senha mais forte.');}
   created=result.data?.id;if(!UUID.test(created||''))throw Error('Invalid Auth response');
   const linked=await call('/rest/v1/rpc/engefex_admin_register_user',{method:'POST',body:JSON.stringify({...args,p_user:created,p_name:name.trim()})});
   if(!linked.ok)throw Error('Registration failed');
   return reply(201,'Usuário criado. Defina e salve as permissões de acesso.',{user:{id:created,email:email.trim().toLowerCase(),name:name.trim()}});
  }catch{
   // Só desfaz a conta que esta requisição acabou de criar; nunca altera uma conta existente.
   if(created){try{const removed=await call('/auth/v1/admin/users/'+created,{method:'DELETE'});if(!removed.ok)return reply(500,'A conta foi criada, mas o vínculo não foi concluído. Peça suporte antes de repetir o cadastro.')}catch{return reply(500,'Confira a conta no Supabase antes de repetir o cadastro.')}}
   return reply(503,'Não foi possível concluir o cadastro. Atualize a lista e tente novamente.');
  }
 };
}
