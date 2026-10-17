/* Engefex Cloud: acesso autenticado ao workspace privado no Supabase.
 * A publishable key identifica o projeto; acesso aos dados depende das políticas RLS.
 * Não incluir aqui service_role, sb_secret ou senha do banco.
 */
(function(root){
 'use strict';
 const URL_BASE='https://kxekeeysonrppechegsq.supabase.co';
 const API_KEY='sb_publishable_wFz7tUNhE1QjyIh315bGVA_ZKi61KjS';
 const SESSION_KEY='engefex-cloud-auth-v1';
 let session=null, workspace=null, revision=null, client=null, phase='login', pending=false, failed='', knownFiles=new Set(), remoteSnapshot=null;
 let cover, messageEl, statusEl, originalLoad=null, originalPut=null;
 const $=id=>document.getElementById(id);
 const current=()=>client?.getState();
 const ownDirty=()=>!!client?.isDirty?.();
 const setMessage=value=>{if(messageEl)messageEl.textContent=value||''};
 function saveSession(s){session=s;if(s)localStorage.setItem(SESSION_KEY,JSON.stringify(s));else localStorage.removeItem(SESSION_KEY)}
 function expiring(){return !session||!session.access_token||Date.now()>=Number(session.expires_at||0)-60000}
 async function raw(path,options={}){
  const headers={apikey:API_KEY,...options.headers};
  if(options.auth!==false){
   if(expiring()&&!options.skipRefresh)await refreshToken();
   if(!session?.access_token)throw Error('Sessão expirada. Entre novamente.');
   headers.Authorization='Bearer '+session.access_token;
  }
  if(options.json)headers['Content-Type']='application/json';
  let res;
  try{res=await fetch(URL_BASE+path,{method:options.method||'GET',headers,body:options.json?JSON.stringify(options.body):options.body,cache:'no-store'})}
  catch(e){throw Error('Sem comunicação com o Supabase. Verifique sua conexão.')}
  if(options.binary&&res.ok)return await res.blob();
  const txt=await res.text();let parsed=null;
  try{parsed=txt?JSON.parse(txt):null}catch{parsed=txt}
  if(!res.ok){let error=new Error((parsed?.message||parsed?.msg||parsed?.error_description||parsed?.error||('HTTP '+res.status)));error.status=res.status;error.code=parsed?.code;throw error}
  return parsed;
 }
 async function refreshToken(){
  if(!session?.refresh_token)throw Error('Sessão expirada. Faça login novamente.');
  const s=await raw('/auth/v1/token?grant_type=refresh_token',{method:'POST',json:true,body:{refresh_token:session.refresh_token},auth:false,skipRefresh:true});
  saveSession({...s,expires_at:Date.now()+Number(s.expires_in||3600)*1000});
 }
 async function login(email,password){
  const s=await raw('/auth/v1/token?grant_type=password',{method:'POST',json:true,body:{email,password},auth:false});
  saveSession({...s,expires_at:Date.now()+Number(s.expires_in||3600)*1000});
  await connect();
 }
 function paintStatus(value){
  if(statusEl)statusEl.textContent=value;
  const footer=$('saveStatus');
  if(footer&&phase==='ready')footer.textContent=value;
 }
 function setPhase(next,note){
  phase=next;cover.hidden=next==='ready';
  document.documentElement.classList.toggle('engefex-cloud-locked',next!=='ready');
  const view=$('engefex-cloud-view');
  if(!view)return;
  for(const panel of cover.querySelectorAll('[data-cloud-panel]'))panel.hidden=panel.dataset.cloudPanel!==next;
  if(note)setMessage(note);else setMessage('');
 }
 function setupVisual(){
  const style=document.createElement('style');
  style.textContent=String.raw`
    .engefex-cloud-locked body{overflow:hidden}
    #engefex-cloud-cover{position:fixed;inset:0;z-index:2147483640;background:#142637;color:#f6f9fc;overflow:auto;display:flex;align-items:center;justify-content:center;padding:18px;font-family:system-ui,-apple-system,Segoe UI,sans-serif}
    #engefex-cloud-cover[hidden]{display:none}
    .engefex-cloud-panel{background:#fff;color:#26384a;max-width:560px;width:100%;border-radius:18px;padding:30px;box-shadow:0 20px 60px #0018}
    .engefex-cloud-panel h1{font-size:1.45rem;margin:0 0 6px}.engefex-cloud-panel p{line-height:1.55}
    .engefex-cloud-panel label{display:block;margin:12px 0 5px;font-weight:600}
    .engefex-cloud-panel input{width:100%;box-sizing:border-box;padding:13px;border:1px solid #b9c6d2;border-radius:8px;font-size:16px}
    .engefex-cloud-panel button{border:0;border-radius:9px;background:#1362a3;color:white;padding:12px 16px;margin:8px 8px 0 0;cursor:pointer;font-weight:650}
    .engefex-cloud-panel button:disabled{opacity:.5;cursor:wait}
    .engefex-cloud-panel button.secondary{color:#173b57;background:#e9f0f8}
    #engefex-cloud-message{white-space:pre-wrap;color:#9f2b21;font-weight:650;margin-top:14px}
    #engefex-cloud-status{display:inline-block;font-size:.82rem;opacity:.9;margin-right:10px}
    #engefex-cloud-header{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:4px 12px}
    #engefex-cloud-header button{font-size:.78rem;border:1px solid #748ba4;background:none;color:inherit;border-radius:6px;padding:5px 9px;cursor:pointer}
  `;
  document.head.append(style);
  cover=document.createElement('div');cover.id='engefex-cloud-cover';cover.setAttribute('role','dialog');cover.setAttribute('aria-modal','true');cover.setAttribute('aria-label','Acesso ao Gerenciador Engefex');
  cover.innerHTML=String.raw`
  <div class="engefex-cloud-panel">
    <h1>ENGEFEX · Gerenciamento</h1>
    <p>Base compartilhada de obras, orçamento, cronograma e diário.</p>
    <div id="engefex-cloud-view">
     <div data-cloud-panel="login">
      <form id="engefex-cloud-login"><label for="engefex-cloud-email">E-mail</label><input id="engefex-cloud-email" type="email" autocomplete="username" required>
      <label for="engefex-cloud-password">Senha</label><input id="engefex-cloud-password" type="password" autocomplete="current-password" required>
      <button type="submit">Entrar</button></form>
      <p><small>O administrador precisa cadastrar sua conta e vinculá-la à área de trabalho da Engefex no Supabase.</small></p>
     </div>
     <div data-cloud-panel="loading" hidden><p>Validando conta e lendo dados compartilhados…</p></div>
     <div data-cloud-panel="setup" hidden>
      <p id="engefex-cloud-setup-info"></p>
      <button type="button" id="engefex-cloud-local-backup" class="secondary">Exportar backup local</button>
      <button type="button" id="engefex-cloud-migrate">Usar meus registros locais como base online</button>
      <button type="button" id="engefex-cloud-empty" class="secondary">Começar base online vazia</button>
      <button type="button" id="engefex-cloud-load" class="secondary">Abrir base online existente</button>
      <p><small>Um backup antes da migração protege seus registros. Nunca use dados de um navegador para substituir uma base online que já contém registros.</small></p>
     </div>
     <div data-cloud-panel="error" hidden>
      <p>A edição está bloqueada até resolver a comunicação com o banco. Dados ainda não confirmados continuam guardados neste aparelho.</p>
      <button type="button" id="engefex-cloud-export" class="secondary">Exportar backup deste aparelho</button>
      <button type="button" id="engefex-cloud-retry">Tentar novamente</button>
      <button type="button" id="engefex-cloud-out" class="secondary">Sair da conta</button>
     </div>
    </div><p id="engefex-cloud-message" role="alert"></p>
  </div>`;
  document.body.append(cover);
  messageEl=$('engefex-cloud-message');
  const top=document.createElement('div');top.id='engefex-cloud-header';
  top.innerHTML='<span id="engefex-cloud-status">Aguardando login</span><button id="engefex-cloud-refresh" type="button">Atualizar dados</button><button id="engefex-cloud-logout" type="button">Sair</button>';
  const nav=document.querySelector('.top-actions');
  if(nav)nav.append(top);else document.body.append(top);
  statusEl=$('engefex-cloud-status');
  $('engefex-cloud-login').addEventListener('submit',async event=>{
   event.preventDefault();const button=event.submitter;button.disabled=true;
   try{setPhase('loading');await login($('engefex-cloud-email').value.trim(),$('engefex-cloud-password').value);$('engefex-cloud-password').value=''}
   catch(e){saveSession(null);setPhase('login',e.message)}finally{button.disabled=false}
  });
  $('engefex-cloud-migrate').onclick=()=>initializeWith(current());
  $('engefex-cloud-empty').onclick=()=>initializeWith(root.EngefexManager.separate(root.Obras.clone(root.OBRAS_SEED)));
  $('engefex-cloud-load').onclick=()=>{if(remoteSnapshot)acceptRemote(remoteSnapshot)};
  $('engefex-cloud-local-backup').onclick=()=>client?.exportBackup();
  $('engefex-cloud-export').onclick=()=>client?.exportBackup();
  $('engefex-cloud-retry').onclick=()=>connect().catch(e=>setPhase('error',e.message));
  $('engefex-cloud-out').onclick=()=>logout();
  $('engefex-cloud-logout').onclick=()=>logout();
  $('engefex-cloud-refresh').onclick=()=>refreshRemote(true).catch(e=>{paintStatus('Erro de sincronização: '+e.message);setPhase('error',e.message)});
 }
 function localHasData(){const s=current();return !!(s?.projects?.length||s?.history?.length||s?.diary?.length||s?.budgetItems?.length)}
 function ensureBackupBeforeReplace(){
  const before=localStorage.getItem('engefex-gerenciamento-v2');
  if(!before)return;
  const key='engefex-cloud-pre-migration-backup-v1';
  if(localStorage.getItem(key))return;
  try{localStorage.setItem(key,before)}
  catch{throw Error('Sem espaço para guardar a cópia local. Exporte o backup antes de carregar a base online.')}
 }
 function acceptRemote(snapshot){
  try{
   root.Obras.backupValid(snapshot);
   ensureBackupBeforeReplace();
   client.acceptState(snapshot);
   remoteSnapshot=null;
   pending=false;failed='';setPhase('ready');paintStatus('Conectado ao Supabase · revisão '+revision);
  }catch(e){setPhase('setup',e.message)}
 }
 async function connect(){
  setPhase('loading');
  const memberships=await raw('/rest/v1/engefex_members?select=workspace_id&limit=2');
  if(!Array.isArray(memberships)||memberships.length!==1)throw Error('A conta precisa estar vinculada a exatamente uma área de trabalho. Peça ao administrador para executar o SQL de autorização dos usuários.');
  workspace=memberships[0].workspace_id;
  const rows=await raw('/rest/v1/engefex_state?select=payload,revision,updated_at&workspace_id=eq.'+encodeURIComponent(workspace)+'&limit=1');
  if(!Array.isArray(rows)||rows.length!==1)throw Error('Banco não inicializado. Execute a migração SQL da pasta supabase/migrations.');
  revision=Number(rows[0].revision);
  remoteSnapshot=rows[0].payload||null;
  if(!remoteSnapshot||(localHasData()&&JSON.stringify(remoteSnapshot)!==JSON.stringify(current()))){
   setPhase('setup');
   $('engefex-cloud-setup-info').textContent=remoteSnapshot?'A base online já contém registros. Faça um backup de qualquer trabalho local antes de abrir a base compartilhada.':'A base online está vazia. Escolha iniciar com os dados deste aparelho ou com uma base vazia.';
   $('engefex-cloud-migrate').hidden=!!remoteSnapshot||!localHasData();
   $('engefex-cloud-empty').hidden=!!remoteSnapshot;
   $('engefex-cloud-load').hidden=!remoteSnapshot;
  }else acceptRemote(remoteSnapshot);
 }
 async function initializeWith(snapshot){
  if(remoteSnapshot){setMessage('A base online já contém dados. Não será substituída.');return}
  if(!confirm('Criar agora a base compartilhada no Supabase? Confira antes se seus dados locais estão corretos e se o backup foi exportado.'))return;
  setPhase('loading');
  try{
   root.Obras.backupValid(snapshot);
   await uploadFiles(snapshot);
   const out=await writeState(snapshot);
   revision=Number(out.revision);
   acceptRemote(snapshot);
  }catch(e){setPhase('setup',e.message)}
 }
 async function writeState(payload){
  const result=await raw('/rest/v1/rpc/engefex_save_state',{method:'POST',json:true,body:{p_workspace:workspace,p_revision:revision,p_payload:payload}});
  const row=Array.isArray(result)?result[0]:result;
  if(!row||!Number.isFinite(Number(row.revision)))throw Error('Supabase não confirmou a revisão salva.');
  return row;
 }
 function requireWrite(){
  if(phase!=='ready'||pending||failed)throw Error(failed||'Aguarde a sincronização e o carregamento da base online antes de editar.');
  if(!navigator.onLine)throw Error('Sem conexão: a edição compartilhada está bloqueada.');
 }
 function send(next){
  requireWrite();
  pending=true;paintStatus('Enviando alterações ao Supabase…');
  return (async()=>{
   await uploadFiles(next);
   const out=await writeState(next);
   revision=Number(out.revision);
   pending=false;failed='';
   paintStatus('Salvo no Supabase · revisão '+revision+' · '+new Date().toLocaleTimeString('pt-BR'));
   client.saved?.();
   return true;
  })().catch(e=>{
   pending=false;
   failed=e.message||'Erro de sincronização';
   paintStatus('NÃO SALVO online · '+failed);
   setPhase('error','A alteração não foi confirmada pelo Supabase: '+failed+'\nExporte o backup antes de tentar recuperar.');
   client.saveError?.(failed);
   return false;
  });
 }
 async function refreshRemote(force=false){
  if(phase!=='ready'||pending||ownDirty()||document.hidden)return;
  if(!navigator.onLine)return;
  const rows=await raw('/rest/v1/engefex_state?select=payload,revision&workspace_id=eq.'+encodeURIComponent(workspace)+'&limit=1');
  const row=rows?.[0];
  if(!row)throw Error('Área de trabalho não encontrada.');
  if(phase!=='ready'||pending||ownDirty())return;
  if(Number(row.revision)!==revision){
   root.Obras.backupValid(row.payload);
   ensureBackupBeforeReplace();
   client.acceptState(row.payload);revision=Number(row.revision);
   paintStatus('Atualizado com alterações da equipe · revisão '+revision);
  }else if(force)paintStatus('Dados atualizados · revisão '+revision);
 }
 function decodeDataURL(file){
  if(!file?.dataURL||!/^data:[\w.+/-]+;base64,/.test(file.dataURL))throw Error('Anexo inválido: '+(file?.id||'?'));
  const text=file.dataURL.slice(file.dataURL.indexOf(',')+1),data=atob(text),bytes=new Uint8Array(data.length);
  for(let i=0;i<data.length;i++)bytes[i]=data.charCodeAt(i);
  return new Blob([bytes],{type:file.type||file.dataURL.split(';')[0].slice(5)});
 }
 function storagePath(id){
  if(!/^[A-Za-z0-9_-]+$/.test(id))throw Error('Identificador de anexo inválido: '+id);
  return '/storage/v1/object/engefex-files/'+encodeURIComponent(workspace)+'/'+encodeURIComponent(id);
 }
 async function uploadFiles(snapshot){
  const ids=root.LocalFiles.refs(snapshot);
  for(const id of ids){
   if(knownFiles.has(id))continue;
   const [file]=await originalLoad([id]);
   try{await raw(storagePath(id),{method:'POST',body:decodeDataURL(file),headers:{'Content-Type':file.type||'application/octet-stream','x-upsert':'false'}})}
   catch(e){if(e.status!==409)throw Error('Anexo '+id+': '+e.message)}
   knownFiles.add(id);
  }
 }
 function patchFileLoading(){
  if(!root.LocalFiles||originalLoad)return;
  originalLoad=root.LocalFiles.load.bind(root.LocalFiles);
  originalPut=root.LocalFiles.put.bind(root.LocalFiles);
  root.LocalFiles.load=async ids=>{
   if(!Array.isArray(ids)||!ids.length)return [];
   const result=[];
   for(const id of ids){
    try{result.push((await originalLoad([id]))[0]);continue}catch(e){if(phase!=='ready'||!workspace)throw e}
    const blob=await raw(storagePath(id).replace('/storage/v1/object/','/storage/v1/object/authenticated/'),{binary:true});
    const dataURL=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('Falha ao ler anexo.'));r.readAsDataURL(blob)});
    const item={id,type:blob.type||'application/octet-stream',name:id,dataURL};
    await originalPut([item]);result.push(item);
   }
   return result;
  };
 }
 async function logout(){
  if(pending){alert('Aguarde o servidor confirmar o salvamento antes de sair.');return}
  const token=session?.access_token;
  saveSession(null);workspace=null;revision=null;remoteSnapshot=null;knownFiles.clear();failed='';
  setPhase('login');paintStatus('Desconectado');
  if(token)fetch(URL_BASE+'/auth/v1/logout',{method:'POST',headers:{apikey:API_KEY,Authorization:'Bearer '+token}}).catch(()=>{});
 }
 function boot(app){
  client=app;setupVisual();patchFileLoading();setPhase('login');
  try{const cached=JSON.parse(localStorage.getItem(SESSION_KEY)||'null');if(cached?.refresh_token)session=cached}catch{}
  if(session)connect().catch(e=>{saveSession(null);setPhase('login',e.message)});
  setInterval(()=>{if(phase==='ready')refreshRemote().catch(e=>paintStatus('Falha ao atualizar: '+e.message))},20000);
  root.addEventListener('focus',()=>{if(phase==='ready')refreshRemote().catch(()=>{})});
 }
 root.EngefexCloud={boot,requireWrite,send,get ready(){return phase==='ready'},get pending(){return pending}};
})(window);
