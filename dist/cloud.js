/* Engefex Cloud: acesso autenticado ao workspace privado no Supabase.
 * A publishable key identifica o projeto; acesso aos dados depende das políticas RLS.
 * Não incluir aqui service_role, sb_secret ou senha do banco.
 */
(function(root){
 'use strict';
 if(root.location?.pathname?.split('/').includes('testes')&&root.EngefexEnvironment?.name!=='test'){root.EngefexCloud={boot(){document.body.textContent='Ambiente de testes bloqueado: a configuração isolada não carregou. Atualize a página.';},requireWrite(){throw Error('Ambiente de testes sem configuração.');}};return;}
 const URL_BASE=root.EngefexEnvironment?.url||'https://kxekeeysonrppechegsq.supabase.co';
 const API_KEY=root.EngefexEnvironment?.key||'sb_publishable_wFz7tUNhE1QjyIh315bGVA_ZKi61KjS';
 const SESSION_KEY=root.EngefexEnvironment?.storageKey('engefex-cloud-auth-v1')||'engefex-cloud-auth-v1';
 let session=null, workspace=null, revision=null, client=null, phase='login', pending=false, failed='', knownFiles=new Set(), remoteSnapshot=null, authGeneration=0;
 let accessVersion='',sessionFiles=new Set();
 let confirmedState=null,patchSupported=null,compactReadSupported=null,refreshing=false,tokenRefresh=null,lastSync=null,lastAccessCheck=0;
 let cover, messageEl, statusEl, loadingNote=null, originalLoad=null, originalPut=null;
 const $=id=>document.getElementById(id);
 const current=()=>client?.getState();
 const ownDirty=()=>!!client?.isDirty?.();
 const setMessage=value=>{if(messageEl)messageEl.textContent=value||''};
 function saveSession(s){session=s;try{if(s)localStorage.setItem(SESSION_KEY,JSON.stringify(s));else localStorage.removeItem(SESSION_KEY)}catch(e){if(!(/quota/i.test(e?.name+' '+e?.message)||e?.code===22||e?.code===1014))throw e}}
 function expiring(){return !session||!session.access_token||Date.now()>=Number(session.expires_at||0)-60000}
 async function raw(path,options={}){
  const headers={apikey:API_KEY,...options.headers};
  if(options.auth!==false){
   if(expiring()&&!options.skipRefresh)await refreshToken();
   if(!session?.access_token)throw Error('Sessão expirada. Entre novamente.');
   headers.Authorization='Bearer '+session.access_token;
  }
  if(options.json)headers['Content-Type']='application/json';
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),20000);
  let res,txt,blob;
  try{
   res=await fetch(URL_BASE+path,{method:options.method||'GET',headers,body:options.json?JSON.stringify(options.body):options.body,cache:'no-store',signal:controller.signal});
   if(options.binary&&res.ok)blob=await res.blob();
   else txt=await res.text();
  }catch(e){
   if(controller.signal.aborted)throw Error('O Supabase não respondeu em 20 segundos. Confira sua internet e tente novamente.');
   throw Error('Não foi possível comunicar com o Supabase. Confira sua conexão.');
  }finally{clearTimeout(timeout)}
  if(blob)return blob;
  let parsed=null;
  try{parsed=txt?JSON.parse(txt):null}catch{parsed=txt}
  if(!res.ok){let error=new Error((parsed?.message||parsed?.msg||parsed?.error_description||parsed?.error||('HTTP '+res.status)));error.status=res.status;error.code=parsed?.code;throw error}
  return parsed;
 }
 async function refreshToken(){if(tokenRefresh)return tokenRefresh;tokenRefresh=performTokenRefresh();try{return await tokenRefresh}finally{tokenRefresh=null}}
 async function performTokenRefresh(){
  const generation=authGeneration;
  if(!session?.refresh_token)throw Error('Sessão expirada. Faça login novamente.');
  const s=await raw('/auth/v1/token?grant_type=refresh_token',{method:'POST',json:true,body:{refresh_token:session.refresh_token},auth:false,skipRefresh:true});
  if(generation!==authGeneration)throw Error('A sessão mudou. Entre novamente.');
  saveSession({...s,user:s.user||session.user,expires_at:Date.now()+Number(s.expires_in||3600)*1000});
 }
 async function login(email,password){
  const generation=++authGeneration;
  const s=await raw('/auth/v1/token?grant_type=password',{method:'POST',json:true,body:{email,password},auth:false});
  if(generation!==authGeneration)return;
  saveSession({...s,expires_at:Date.now()+Number(s.expires_in||3600)*1000});
  await connect();
 }
 function paintStatus(value){
  if(statusEl)statusEl.textContent=value;
  const footer=$('saveStatus');
  if(footer&&phase==='ready')footer.textContent=value;
 }
 function setPhase(next,note){
  phase=next;
  const connecting=next==='loading';
  cover.hidden=connecting||next==='ready';
  document.documentElement.classList.toggle('engefex-cloud-locked',next==='login'||next==='error');
  document.documentElement.classList.toggle('engefex-cloud-loading',connecting);
  // Bloqueia teclado e cliques nas áreas sem validação, sem exigir uma tela modal.
  for(const node of document.querySelectorAll?.('.shell,.sidebar')||[])node.inert=next!=='ready';
  if(loadingNote)loadingNote.hidden=!connecting;
  if(statusEl&&connecting)statusEl.textContent='Conectando ao Supabase…';
  const view=$('engefex-cloud-view');
  if(!view)return;
  for(const panel of cover.querySelectorAll('[data-cloud-panel]'))panel.hidden=panel.dataset.cloudPanel!==next;
  setMessage(note||'');
 }
 function setupVisual(){
  const style=document.createElement('style');
  style.textContent=String.raw`
    .engefex-cloud-locked body{overflow:hidden}
    #engefex-cloud-cover{position:fixed;inset:0;z-index:2147483640;background:#111111;color:#f6f9fc;overflow:auto;display:flex;align-items:center;justify-content:center;padding:18px;font-family:system-ui,-apple-system,Segoe UI,sans-serif}
    #engefex-cloud-cover[hidden]{display:none}
    .engefex-cloud-panel{background:#fff;color:#26384a;max-width:560px;width:100%;border-radius:18px;padding:30px;box-shadow:0 20px 60px #0018}
    .engefex-cloud-logo{display:block;width:220px;max-width:80%;height:auto;margin:0 auto 22px}.engefex-cloud-panel h1{font-size:1.45rem;margin:0 0 6px}.engefex-cloud-panel p{line-height:1.55}
    .engefex-cloud-panel label{display:block;margin:12px 0 5px;font-weight:600}
    .engefex-cloud-panel input{width:100%;box-sizing:border-box;padding:13px;border:1px solid #b9c6d2;border-radius:8px;font-size:16px}
    .engefex-cloud-panel button{border:0;border-radius:9px;background:#1557ff;color:white;padding:12px 16px;margin:8px 8px 0 0;cursor:pointer;font-weight:650}
    .engefex-cloud-panel button:disabled{opacity:.5;cursor:wait}
    .engefex-cloud-panel button.secondary{color:#174bd2;background:#edf2ff}
    #engefex-cloud-message{white-space:pre-wrap;color:#9f2b21;font-weight:650;margin-top:14px}
    #engefex-cloud-status{display:inline-block;font-size:.82rem;opacity:.9;margin-right:10px}
    #engefex-cloud-header{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:4px 12px}
    #engefex-cloud-header button{font-size:.78rem;border:1px solid #748ba4;background:none;color:inherit;border-radius:6px;padding:5px 9px;cursor:pointer}
    #engefex-cloud-connecting{position:fixed;right:22px;bottom:22px;z-index:100;padding:11px 16px;display:flex;gap:11px;align-items:center;border-radius:11px;background:#163e68;color:#fff;box-shadow:0 6px 24px #15273c35;font-size:12px;font-weight:600;pointer-events:none;max-width:calc(100vw - 44px)}
    #engefex-cloud-connecting[hidden]{display:none}
    #engefex-cloud-connecting:before{content:"";width:14px;height:14px;flex:0 0 auto;border:2px solid #ffffff60;border-top-color:#fff;border-radius:50%;animation:engefex-sync-spin .8s linear infinite}
    @keyframes engefex-sync-spin{to{transform:rotate(360deg)}}
    .engefex-cloud-loading #main,.engefex-cloud-loading #nav{visibility:hidden;pointer-events:none}
    .engefex-cloud-loading .top-actions,.engefex-cloud-loading .sidebar a{pointer-events:none}
    @media(max-width:560px){#engefex-cloud-connecting{right:12px;bottom:14px;left:12px;max-width:none}}
    @media(prefers-reduced-motion:reduce){#engefex-cloud-connecting:before{animation:none}}
  `;
  document.head.append(style);
  cover=document.createElement('div');cover.id='engefex-cloud-cover';cover.setAttribute('role','dialog');cover.setAttribute('aria-modal','true');cover.setAttribute('aria-label','Acesso ao Gerenciador Engefex');
  cover.innerHTML=String.raw`
  <div class="engefex-cloud-panel">
    <img class="engefex-cloud-logo" src="engefex-logo.png" alt="Engefex Engenharia e Estruturas Metálicas" width="469" height="364"><h1>Gerenciamento Engefex</h1>
    <p>Base compartilhada de obras, orçamento, cronograma e diário.</p>
    <div id="engefex-cloud-view">
     <div data-cloud-panel="login">
      <form id="engefex-cloud-login"><label for="engefex-cloud-email">E-mail</label><input id="engefex-cloud-email" type="email" autocomplete="username" required>
      <label for="engefex-cloud-password">Senha</label><input id="engefex-cloud-password" type="password" autocomplete="current-password" required>
      <button type="submit">Entrar</button></form>
      <p><small>O administrador precisa cadastrar sua conta e vinculá-la à área de trabalho da Engefex no Supabase.</small></p>
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
  loadingNote=document.createElement('div');loadingNote.id='engefex-cloud-connecting';loadingNote.hidden=true;loadingNote.setAttribute('role','status');loadingNote.textContent='Conectando à base compartilhada…';document.body.append(loadingNote);
  messageEl=$('engefex-cloud-message');
  const top=document.createElement('div');top.id='engefex-cloud-header';
  top.innerHTML='<span id="engefex-cloud-status">Aguardando login</span><button id="engefex-cloud-refresh" type="button">Atualizar dados</button><button id="engefex-cloud-logout" type="button">Sair</button>';
  const nav=document.querySelector('.top-actions');
  if(nav)nav.append(top);else document.body.append(top);
  statusEl=$('engefex-cloud-status');
  $('engefex-cloud-login').addEventListener('submit',async event=>{
   event.preventDefault();const button=event.submitter;button.disabled=true;
   const label=button.textContent;button.textContent='Entrando…';
   try{setMessage('Entrando na sua conta…');await login($('engefex-cloud-email').value.trim(),$('engefex-cloud-password').value);$('engefex-cloud-password').value=''}
   catch(e){saveSession(null);setPhase('login',e.message)}finally{button.disabled=false;button.textContent=label}
  });
  $('engefex-cloud-export').onclick=()=>client?.exportBackup();
  $('engefex-cloud-retry').onclick=()=>connect().catch(e=>setPhase('error',e.message));
  $('engefex-cloud-out').onclick=()=>logout();
  $('engefex-cloud-logout').onclick=()=>logout();
  $('engefex-cloud-refresh').onclick=()=>refreshRemote(true).catch(e=>{paintStatus('Erro de sincronização: '+e.message);setPhase('error',e.message)});
 }
 function acceptRemote(snapshot){
  try{
   (root.Obras.onlineValid||root.Obras.backupValid)(snapshot);
   client.acceptState(snapshot);
   for(const id of root.LocalFiles.refs(snapshot))knownFiles.add(id);
   remoteSnapshot=null;confirmedState=structuredClone(snapshot);
   pending=false;failed='';setPhase('ready');paintStatus('Conectado ao Supabase · revisão '+revision);client?.identityChanged?.();
  }catch(e){setPhase('error',e.message)}
 }
 async function loadAccess(){if(!root.EngefexAccess)return false;let next=await raw('/rest/v1/rpc/engefex_access_context',{method:'POST',json:true,body:{p_workspace:workspace}}),fingerprint=JSON.stringify(next),changed=!!accessVersion&&fingerprint!==accessVersion;accessVersion=fingerprint;lastAccessCheck=Date.now();root.EngefexAccess.setContext(next);return changed}
 async function readState(head=false){
  // Leitura resumida: mantém todo o histórico no banco, transferindo só os 50 mais recentes.
  if(!head&&!root.EngefexAccess?.context?.restricted&&compactReadSupported!==false){
   try{
    const rows=await raw('/rest/v1/rpc/engefex_read_state_compact',{method:'POST',json:true,body:{p_workspace:workspace}});
    compactReadSupported=true;
    return rows;
   }catch(e){
    if(e.status===404&&e.code==='PGRST202')compactReadSupported=false;
    else throw e;
   }
  }
  return raw('/rest/v1/rpc/engefex_read_state',{method:'POST',json:true,body:{p_workspace:workspace,p_head:head}});
 }
 async function fullSnapshot(){
  if(phase!=='ready'||pending||ownDirty())throw Error('Conclua ou descarte edições antes de consultar o histórico ou exportar o backup.');
  const rows=await raw('/rest/v1/rpc/engefex_read_state',{method:'POST',json:true,body:{p_workspace:workspace,p_head:false}});
  const row=rows?.[0];
  if(!row?.payload||Number(row.revision)!==revision)throw Error('A base mudou durante a consulta. Atualize a página antes de exportar.');
  return row.payload;
 }
 async function connect(){
  const generation=authGeneration;
  setPhase('loading');
  const memberships=await raw('/rest/v1/engefex_members?select=workspace_id&limit=2');
  if(generation!==authGeneration)return;
  if(!Array.isArray(memberships)||memberships.length!==1)throw Error('A conta precisa estar vinculada a exatamente uma área de trabalho. Peça ao administrador para executar o SQL de autorização dos usuários.');
  workspace=memberships[0].workspace_id;patchSupported=null;compactReadSupported=null;lastAccessCheck=0;await loadAccess();
  const rows=await readState();
  if(generation!==authGeneration)return;
  if(!Array.isArray(rows)||rows.length!==1)throw Error('Banco não inicializado. Execute a migração SQL da pasta supabase/migrations.');
  revision=Number(rows[0].revision);
  remoteSnapshot=rows[0].payload||null;
  if(!remoteSnapshot)throw Error('A base online ainda não foi inicializada. Solicite a configuração ao administrador.');
  acceptRemote(remoteSnapshot);
 }
 function buildPatch(before,next){
  const changes=[],same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  for(const key of new Set([...Object.keys(before||{}),...Object.keys(next)])){
   if(!Object.prototype.hasOwnProperty.call(next,key)||next[key]===undefined){changes.push({key,remove:true});continue}
   const old=before?.[key],value=next[key];if(same(old,value))continue;
   if(Array.isArray(old)&&Array.isArray(value)){
    const a=old.map(x=>JSON.stringify(x)),b=value.map(x=>JSON.stringify(x));let start=0,end=0;
    while(start<a.length&&start<b.length&&a[start]===b[start])start++;
    while(end<a.length-start&&end<b.length-start&&a[a.length-1-end]===b[b.length-1-end])end++;
    let edits=[];
    if(a.length===b.length){for(let i=start;i<a.length-end;i++)if(a[i]!==b[i])edits.push({key,start:i,deleteCount:1,items:[value[i]]})}
    else edits=[{key,start,deleteCount:a.length-start-end,items:value.slice(start,b.length-end)}];
    const replace={key,value};
    changes.push(...(edits.length<=32&&JSON.stringify(edits).length<JSON.stringify(replace).length?edits:[replace]));
   }else changes.push({key,value});
  }return changes;
 }
 async function writeState(payload){
  const changes=confirmedState?buildPatch(confirmedState,payload):null,full={p_workspace:workspace,p_revision:revision,p_payload:payload},patch={p_workspace:workspace,p_revision:revision,p_changes:changes};
  const compact=compactReadSupported===true&&!root.EngefexAccess?.context?.restricted;
  if(compact){
   // Histórico compacto é apenas uma janela da sequência real. Nunca substituí-la.
   // Permitimos somente inserções no início; exclusões ou alterações antigas falham sem salvar.
   const oldHistory=confirmedState?.history||[],newHistory=payload.history||[],added=newHistory.length-oldHistory.length;
   if(!Array.isArray(newHistory)||added<0||JSON.stringify(newHistory.slice(added))!==JSON.stringify(oldHistory))
    throw Error('Alteração incompatível no histórico. Atualize os dados antes de salvar.');
   for(let i=changes.length-1;i>=0;i--)if(changes[i].key==='history')changes.splice(i,1);
   if(added)changes.unshift({key:'history',start:0,deleteCount:0,items:newHistory.slice(0,added)});
  }
  const fullText=JSON.stringify(full),canPatch=!root.EngefexAccess?.context?.restricted&&patchSupported!==false&&changes&&changes.length<=1000,patchText=canPatch?JSON.stringify(patch):'',usePatch=canPatch&&(compact||patchText.length<fullText.length*.9);
  if(compact&&!usePatch)throw Error('Leitura compacta exige salvamento por alterações. Nenhum histórico foi substituído.');
  let result,mode='full',bytes=fullText.length;
  if(usePatch){try{result=await raw('/rest/v1/rpc/engefex_patch_state',{method:'POST',json:true,body:patch});patchSupported=true;mode='patch';bytes=patchText.length}catch(e){if(e.status===404&&e.code==='PGRST202'){patchSupported=false;if(compact)throw Error('Servidor sem suporte a patches: salvamento compacto bloqueado para preservar o histórico.')}else throw e}}
  if(!result){if(compact)throw Error('Salvamento compacto sem patch confirmado; histórico preservado.');result=await raw('/rest/v1/rpc/engefex_save_state',{method:'POST',json:true,body:full});}
  const row=Array.isArray(result)?result[0]:result;
  if(!row||!Number.isFinite(Number(row.revision))||Number(row.revision)<=revision)throw Error('Supabase não confirmou a revisão salva.');
  lastSync={mode,characters:bytes,fullCharacters:fullText.length};
  confirmedState=structuredClone(payload);return row;
 }

 function requireWrite(next){
  if(phase!=='ready'||pending||failed)throw Error(failed||'Aguarde a sincronização e o carregamento da base online antes de editar.');
  if(!navigator.onLine)throw Error('Sem conexão: a edição compartilhada está bloqueada.');
  if(root.EngefexAccess&&!root.EngefexAccess.canWrite(root.EngefexAccess.currentView())&&!(next&&root.EngefexAccess.personalOnly(confirmedState,next,session?.user)))throw Error('Seu usuário não tem permissão para editar esta tela.');
 }
 function send(next){
  requireWrite(next);
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
  if(phase!=='ready'||pending||document.hidden||refreshing||!navigator.onLine)return;
  refreshing=true;const generation=authGeneration,startRevision=revision,startWorkspace=workspace;
  const stillCurrent=()=>generation===authGeneration&&phase==='ready'&&!pending&&!ownDirty()&&revision===startRevision&&workspace===startWorkspace;
  try{
   if(root.EngefexAccess&&(force||Date.now()-lastAccessCheck>=60000)&&await loadAccess()){sessionFiles.clear();knownFiles.clear();client.accessChanged?.();setPhase('loading');try{const rows=await readState();revision=Number(rows?.[0]?.revision);if(!rows?.[0]?.payload)throw Error('A base autorizada não foi encontrada.');acceptRemote(rows[0].payload)}catch(e){setPhase('error',e.message)}return}if(ownDirty())return;
   const heads=await readState(true);
   if(!stillCurrent())return;
   if(!heads?.[0])throw Error('Área de trabalho não encontrada.');
   if(Number(heads[0].revision)===revision){if(force)paintStatus('Dados atualizados · revisão '+revision);return}
   const rows=root.EngefexAccess?await readState():await raw('/rest/v1/engefex_state?select=payload,revision&workspace_id=eq.'+encodeURIComponent(startWorkspace)+'&limit=1');
   if(!stillCurrent())return;const row=rows?.[0];
   if(!row||!Number.isFinite(Number(row.revision))||Number(row.revision)<=revision)throw Error('Não foi possível confirmar a revisão atual da área de trabalho.');
   (root.Obras.onlineValid||root.Obras.backupValid)(row.payload);client.acceptState(row.payload);
   confirmedState=structuredClone(row.payload);for(const id of root.LocalFiles.refs(row.payload))knownFiles.add(id);revision=Number(row.revision);
   paintStatus('Atualizado com alterações da equipe · revisão '+revision);
  }finally{refreshing=false}
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
  root.LocalFiles.put=async files=>{requireWrite();await originalPut(files);for(let f of files)sessionFiles.add(f.id)};
  root.LocalFiles.load=async ids=>{
   if(!Array.isArray(ids)||!ids.length)return [];
   if(root.EngefexAccess?.context?.restricted){const allowed=new Set(root.LocalFiles.refs(current()));if(ids.some(id=>!allowed.has(id)&&!sessionFiles.has(id)))throw Error('Você não tem acesso a este anexo.');}
   const result=[];
   for(const id of ids){
    try{result.push((await originalLoad([id]))[0]);continue}catch(e){if(phase!=='ready'||!workspace)throw e}
    const blob=await raw(storagePath(id).replace('/storage/v1/object/','/storage/v1/object/authenticated/'),{binary:true});
    const dataURL=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('Falha ao ler anexo.'));r.readAsDataURL(blob)});
    let meta=root.LocalFiles.metadata?.(current(),id)||{};
    const item={id,type:blob.type||meta.type||'application/octet-stream',name:meta.name||id,width:meta.width,height:meta.height,dataURL};
    try{await originalPut([item])}catch{/* O arquivo da nuvem continua disponível mesmo sem espaço para cache local. */}result.push(item);
   }
   return result;
  };
 }
 async function logout(){
  if(pending){alert('Aguarde o servidor confirmar o salvamento antes de sair.');return}
  const token=session?.access_token;
  const wasConnected=phase==='ready';
  authGeneration++;
  saveSession(null);accessVersion='';sessionFiles.clear();root.EngefexAccess?.setContext({is_admin:false,permissions:{modules:{},views:{}},restricted:true});workspace=null;revision=null;remoteSnapshot=null;confirmedState=null;patchSupported=null;compactReadSupported=null;lastAccessCheck=0;lastSync=null;knownFiles.clear();failed='';
  setPhase('login');if(wasConnected)client?.clearState?.();paintStatus('Desconectado');
  if(token)fetch(URL_BASE+'/auth/v1/logout',{method:'POST',headers:{apikey:API_KEY,Authorization:'Bearer '+token}}).catch(()=>{});
 }
 function boot(app){if(root.EngefexUpdateGate){root.EngefexUpdateGate.then(ready=>{if(ready!==false)start(app)}).catch(()=>start(app));return}start(app)}
 function start(app){
  client=app;setupVisual();patchFileLoading();setPhase('login');
  try{const cached=JSON.parse(localStorage.getItem(SESSION_KEY)||'null');if(cached?.refresh_token)session=cached}catch{}
  if(session)connect().catch(e=>{if(e.status===401||e.status===403){saveSession(null);setPhase('login','Sua sessão expirou. Entre novamente.')}else setPhase('error',e.message)});
  setInterval(()=>{if(phase==='ready')refreshRemote().catch(e=>paintStatus('Falha ao atualizar: '+e.message))},20000);
  root.addEventListener('focus',()=>{if(phase==='ready')refreshRemote().catch(()=>{})});
 }
 root.EngefexCloud={fullSnapshot,loadFullHistory:async()=>{const full=await fullSnapshot();return full.history||[]},get compact(){return compactReadSupported===true&&!root.EngefexAccess?.context?.restricted},async birthdaysToday(){if(phase!=='ready')return [];const result=await raw('/rest/v1/rpc/engefex_birthdays_today',{method:'POST',json:true,body:{}});return Array.isArray(result)?result.map(x=>String(x.employee_name||'').trim()).filter(Boolean):[];},async resetUserPassword(userId,password){if(phase!=='ready'||!workspace||!root.EngefexAccess?.isAdmin)throw Error('Somente o administrador pode redefinir senhas.');const generation=authGeneration;const result=await raw('/functions/v1/admin-create-user',{method:'POST',json:true,body:{action:'reset_password',workspace,userId,password}});if(generation!==authGeneration)throw Error('A sessão mudou. Entre novamente.');return result;},async createUser(details){if(phase!=='ready'||!workspace||!root.EngefexAccess?.isAdmin)throw Error('Somente o administrador pode cadastrar usuários.');const generation=authGeneration;const result=await raw('/functions/v1/admin-create-user',{method:'POST',json:true,body:{workspace,name:details.name,email:details.email,password:details.password}});if(generation!==authGeneration)throw Error('A sessão mudou. Atualize a lista de usuários.');return result;},async loadNextar(){if(phase!=='ready'||!workspace)throw Error('Entre no sistema.');const list=await raw('/rest/v1/engefex_nextar_inventory?select=snapshot&workspace_id=eq.'+encodeURIComponent(workspace)+'&limit=1');return list?.[0]?.snapshot||null;},async publishNextar(snapshot){if(phase!=='ready'||!workspace)throw Error('Entre no sistema.');return raw('/rest/v1/rpc/engefex_nextar_publish',{method:'POST',json:true,body:{p_workspace:workspace,p_snapshot:snapshot}});},async listAccess(){if(!root.EngefexAccess?.isAdmin)throw Error('Somente o administrador pode gerenciar acessos.');return raw('/rest/v1/rpc/engefex_list_access',{method:'POST',json:true,body:{p_workspace:workspace}})},async setAccess(user,version,permissions){if(!root.EngefexAccess?.isAdmin)throw Error('Somente o administrador pode gerenciar acessos.');return raw('/rest/v1/rpc/engefex_set_access',{method:'POST',json:true,body:{p_workspace:workspace,p_user:user,p_revision:version,p_permissions:permissions}})},boot,requireWrite,send,buildPatch,get lastSync(){return lastSync?{...lastSync}:null},get currentUser(){return phase==='ready'?{id:session?.user?.id||'',email:session?.user?.email||''}:null},get ready(){return phase==='ready'},get pending(){return pending},get dirty(){return ownDirty()||pending}};
})(window);



