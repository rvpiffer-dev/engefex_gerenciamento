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
 let confirmedState=null,patchSupported=null,compactReadSupported=null,refreshing=false,tokenRefresh=null,lastSync=null,lastAccessCheck=0,lastReadCheck=0,notificationReadIds=new Set(),stockAlerts=[],lastStockCheck=0;
 let cover, messageEl, statusEl, loadingNote=null, originalLoad=null, originalPut=null;
 let lastRefreshAttempt=0, refreshFailures=0, unsavedPayload=null, activeDraft=null, recovering=false, draftPersisted=false;
 const $=id=>document.getElementById(id);
 const current=()=>client?.getState();
 const ownDirty=()=>!!client?.isDirty?.();
 const setMessage=value=>{if(messageEl)messageEl.textContent=value||''};
 function saveSession(s){session=s;try{if(s)localStorage.setItem(SESSION_KEY,JSON.stringify(s));else localStorage.removeItem(SESSION_KEY)}catch(e){if(!(/quota/i.test(e?.name+' '+e?.message)||e?.code===22||e?.code===1014))throw e}}
 function expiring(){return !session||!session.access_token||Date.now()>=Number(session.expires_at||0)-60000}
 async function raw(path,options={}){
  // Retries are limited to read-only requests: never replay financial writes blindly.
  const safeRead=(options.method||'GET')==='GET'||/^\/rest\/v1\/rpc\/engefex_(?:read_state|read_state_compact|access_context|list_access|birthdays_today)/.test(path);
  const retry=async()=>{await new Promise(resolve=>setTimeout(resolve,300*Math.pow(2,options.retryAttempt||0)));return raw(path,{...options,retryAttempt:(options.retryAttempt||0)+1})};
  const headers={apikey:API_KEY,...options.headers};
  if(options.auth!==false){
   if(expiring()&&!options.skipRefresh)await refreshToken();
   if(!session?.access_token)throw Error('Sessão expirada. Entre novamente.');
   headers.Authorization='Bearer '+session.access_token;
  }
  if(options.json)headers['Content-Type']='application/json';
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),120000);
  let res,txt,blob;
  try{
   res=await fetch(URL_BASE+path,{method:options.method||'GET',headers,body:options.json?JSON.stringify(options.body):options.body,cache:'no-store',signal:controller.signal});
   if(options.binary&&res.ok)blob=await res.blob();
   else txt=await res.text();
  }catch(e){
   if(safeRead&&(options.retryAttempt||0)<2)return retry();
   if(controller.signal.aborted)throw Error('O Supabase não respondeu em 120 segundos. Confira sua internet e tente novamente.');
   throw Error('Não foi possível comunicar com o Supabase. Confira sua conexão.');
  }finally{clearTimeout(timeout)}
  if(blob)return blob;
  let parsed=null;
  try{parsed=txt?JSON.parse(txt):null}catch{parsed=txt}
  if(!res.ok){
   if(safeRead&&[429,502,503,504].includes(res.status)&&(options.retryAttempt||0)<2)return retry();
   let error=new Error((parsed?.message||parsed?.msg||parsed?.error_description||parsed?.error||('HTTP '+res.status)));
   error.status=res.status;error.code=parsed?.code;throw error
  }
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
 function draftKey(){return SESSION_KEY+':draft:'+String(session?.user?.id||'')+':'+String(workspace||'')}
 function loadDraft(){
  try{const d=JSON.parse(localStorage.getItem(draftKey())||'null');return d&&Number.isFinite(Number(d.revision))&&Array.isArray(d.changes)?d:null}
  catch{return null}
 }
 function updateRecoveryUI(){
  const show=phase==='ready'&&!pending&&!!activeDraft;
  const retry=$('engefex-cloud-retry-save'),exportButton=$('engefex-cloud-export-draft'),discard=$('engefex-cloud-discard-draft');
  if(retry)retry.hidden=!show;if(exportButton)exportButton.hidden=!show;if(discard)discard.hidden=!show;
 }
 function clearDraft(){
  try{if(session?.user?.id&&workspace)localStorage.removeItem(draftKey())}catch{}
  activeDraft=null;unsavedPayload=null;draftPersisted=false;updateRecoveryUI();
 }
 function stashDraft(next){
  if(!next||!confirmedState||!session?.user?.id||!workspace)return;
  const draft={revision,created_at:new Date().toISOString(),changes:buildPatch(confirmedState,next)};
  activeDraft=draft;
  try{localStorage.setItem(draftKey(),JSON.stringify(draft));draftPersisted=true}
  catch{draftPersisted=false}
  updateRecoveryUI();
 }
 function exportDraft(){
  const draft=activeDraft||loadDraft();
  if(!draft)return false;
  const body=JSON.stringify({format:'engefex-rascunho-v1',project:'Engefex',workspace,created_at:draft.created_at,revision:draft.revision,changes:draft.changes},null,2);
  const url=URL.createObjectURL(new Blob([body],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='engefex-rascunho-nao-confirmado.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
  return true;
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
  setMessage(note||'');updateRecoveryUI();
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
  top.innerHTML='<span id="engefex-cloud-status">Aguardando login</span><button id="engefex-cloud-retry-save" type="button" hidden>Recuperar salvamento</button><button id="engefex-cloud-export-draft" type="button" hidden>Baixar rascunho</button><button id="engefex-cloud-discard-draft" type="button" hidden>Descartar rascunho</button><button id="engefex-cloud-refresh" type="button">Atualizar dados</button><button id="engefex-cloud-logout" type="button">Sair</button>';
  const nav=document.querySelector('.top-actions');
  if(nav)nav.append(top);else document.body.append(top);
  statusEl=$('engefex-cloud-status');
  $('engefex-cloud-login').addEventListener('submit',async event=>{
   event.preventDefault();const button=event.submitter;button.disabled=true;
   const label=button.textContent;button.textContent='Entrando…';
   try{setMessage('Entrando na sua conta…');await login($('engefex-cloud-email').value.trim(),$('engefex-cloud-password').value);$('engefex-cloud-password').value=''}
   catch(e){saveSession(null);setPhase('login',e.message)}finally{button.disabled=false;button.textContent=label}
  });
  $('engefex-cloud-export').onclick=()=>{if(!exportDraft())client?.exportBackup()};
  $('engefex-cloud-retry').onclick=()=>activeDraft?retryPending():connect().catch(e=>setPhase('error',e.message));
  $('engefex-cloud-retry-save').onclick=()=>retryPending();
  $('engefex-cloud-export-draft').onclick=()=>exportDraft();
  $('engefex-cloud-discard-draft').onclick=()=>{
   if(!root.confirm?.('Descartar definitivamente o rascunho não confirmado deste aparelho?'))return;
   clearDraft();failed='';paintStatus('Rascunho descartado. Dados da equipe preservados no Supabase.');
   refreshRemote(true).catch(e=>paintStatus('Falha ao atualizar: '+e.message));
  };
  $('engefex-cloud-out').onclick=()=>logout();
  $('engefex-cloud-logout').onclick=()=>logout();
  $('engefex-cloud-refresh').onclick=()=>refreshRemote(true).catch(e=>paintStatus('Falha temporária ao atualizar: '+e.message));
 }
 function acceptRemote(snapshot){
  try{
   (root.Obras.onlineValid||root.Obras.backupValid)(snapshot);
   client.acceptState(snapshot);
   for(const id of root.LocalFiles.refs(snapshot))knownFiles.add(id);
   remoteSnapshot=null;confirmedState=structuredClone(snapshot);
   pending=false;failed='';setPhase('ready');paintStatus('Conectado ao Supabase · revisão '+revision);client?.identityChanged?.();
   activeDraft=loadDraft();if(activeDraft){failed='Rascunho não confirmado: recupere ou baixe antes de continuar.';paintStatus('RASCUNHO PENDENTE · Recupere ou baixe para sua segurança.');updateRecoveryUI()}
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
 async function loadNotificationReads(){
  if(!workspace||!session?.user?.id)return;
  const at=authGeneration,w=workspace,uid=session.user.id,found=new Set();
  // Busca todas as páginas para não ressuscitar avisos antigos após muitos recebimentos.
  for(let offset=0;;offset+=1000){
   const rows=await raw('/rest/v1/engefex_notification_reads?select=notification_id&workspace_id=eq.'+
     encodeURIComponent(w)+'&user_id=eq.'+encodeURIComponent(uid)+'&order=read_at.desc&limit=1000&offset='+offset);
   if(!Array.isArray(rows))throw Error('Não foi possível consultar as notificações lidas.');
   for(const item of rows)if(typeof item.notification_id==='string')found.add(item.notification_id);
   if(rows.length<1000)break;
  }
  if(at!==authGeneration||w!==workspace||uid!==session?.user?.id)return;
  notificationReadIds=found;lastReadCheck=Date.now();
  client?.notificationReadsChanged?.();
 }
 async function loadStockAlerts(){
  if(!workspace||!session?.user?.id)return;
  const generation=authGeneration,w=workspace,uid=session.user.id;
  // O banco aplica as permissões do usuário para cada um dos três estoques.
  const rows=await raw('/rest/v1/engefex_stock_updates?select=id,stock_kind,actor_name,created_at&workspace_id=eq.'+
    encodeURIComponent(w)+'&order=created_at.desc,id.desc&limit=100');
  if(!Array.isArray(rows))throw Error('Histórico de atualizações do estoque indisponível.');
  if(generation!==authGeneration||w!==workspace||uid!==session?.user?.id)return;
  const names={nextarstock:'Nexus (Nextar)',paintstock:'Tintas',civilstock:'Civil'};
  stockAlerts=rows.filter(row=>Object.hasOwn(names,row.stock_kind)).map(row=>({
    id:'stock-update-'+row.id,stockKind:row.stock_kind,
    title:'Estoque '+names[row.stock_kind]+' atualizado',
    detail:'Base atualizada por '+String(row.actor_name||'Usuário da equipe'),
    project:'Geral',priority:'Estoque',createdAt:row.created_at,
    href:'#'+row.stock_kind
  }));
  lastStockCheck=Date.now();
  client?.stockAlertsChanged?.();
 }
 async function markNotificationsRead(ids){
  if(phase!=='ready'||!workspace||!session?.user?.id)throw Error('Conecte-se para marcar notificações.');
  const unique=[...new Set((ids||[]).filter(x=>typeof x==='string'&&x.length>0&&x.length<=300))];
  if(!unique.length)return;
  const generation=authGeneration,w=workspace,uid=session.user.id;
  for(let i=0;i<unique.length;i+=100){
   const batch=unique.slice(i,i+100).filter(id=>!notificationReadIds.has(id));
   if(!batch.length)continue;
   await raw('/rest/v1/engefex_notification_reads?on_conflict=workspace_id,user_id,notification_id',{
    method:'POST',json:true,headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},
    body:batch.map(notification_id=>({workspace_id:w,user_id:uid,notification_id}))
   });
   if(generation!==authGeneration||w!==workspace||uid!==session?.user?.id)
    throw Error('Sessão alterada durante a confirmação.');
   for(const id of batch)notificationReadIds.add(id);
  }
  lastReadCheck=Date.now();client?.notificationReadsChanged?.();
 }
 async function connect(){
  const generation=authGeneration;
  setPhase('loading');
  const memberships=await raw('/rest/v1/engefex_members?select=workspace_id&limit=2');
  if(generation!==authGeneration)return;
  if(!Array.isArray(memberships)||memberships.length!==1)throw Error('A conta precisa estar vinculada a exatamente uma área de trabalho. Peça ao administrador para executar o SQL de autorização dos usuários.');
  workspace=memberships[0].workspace_id;patchSupported=null;compactReadSupported=null;lastAccessCheck=0;notificationReadIds.clear();lastReadCheck=0;await loadAccess();await loadNotificationReads();await loadStockAlerts();
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

 function applyDraft(base,changes){
  const next=structuredClone(base);
  for(const c of changes){
   if(typeof c.key!=='string')throw Error('Rascunho inválido.');
   if(c.remove)delete next[c.key];
   else if(Object.prototype.hasOwnProperty.call(c,'value'))next[c.key]=structuredClone(c.value);
   else if(Array.isArray(next[c.key])&&Number.isInteger(c.start)&&Number.isInteger(c.deleteCount)&&Array.isArray(c.items))
    next[c.key].splice(c.start,c.deleteCount,...structuredClone(c.items));
   else throw Error('Não foi possível aplicar o rascunho com segurança.');
  }
  return next;
 }
 function draftApplied(remote,changes){
  // Confirm lost acknowledgements conservatively; a mismatched deletion requires manual review.
  return changes.every(c=>{
   const value=remote?.[c.key];
   if(c.remove)return !Object.prototype.hasOwnProperty.call(remote,c.key);
   if(Object.prototype.hasOwnProperty.call(c,'value'))return JSON.stringify(value)===JSON.stringify(c.value);
   if(!Array.isArray(value)||!Array.isArray(c.items)||c.deleteCount>c.items.length)return false;
   return JSON.stringify(value.slice(c.start,c.start+c.items.length))===JSON.stringify(c.items);
  });
 }
 async function retryPending(){
  if(recovering||pending||phase!=='ready')return false;
  const draft=activeDraft||loadDraft();if(!draft)return false;
  recovering=true;paintStatus('Verificando a revisão do banco antes de recuperar…');
  try{
   const head=(await readState(true))?.[0];
   if(!head||!Number.isFinite(Number(head.revision)))throw Error('Não foi possível confirmar a revisão do banco.');
   if(Number(head.revision)!==Number(draft.revision)){
    const remote=(await readState())?.[0];
    if(remote?.payload&&draftApplied(remote.payload,draft.changes)){
     revision=Number(remote.revision);confirmedState=structuredClone(remote.payload);
     client.acceptState(remote.payload);clearDraft();failed='';paintStatus('Salvamento anterior confirmado no Supabase · revisão '+revision);client.saved?.();
     return true;
    }
    throw Error('A equipe alterou a base desde este rascunho. Baixe o rascunho para conferir; nenhuma alteração será sobrescrita.');
   }
   const next=unsavedPayload||applyDraft(confirmedState,draft.changes);
   (root.Obras.onlineValid||root.Obras.backupValid)(next);
   failed='';
   const ok=await send(next);
   if(ok)client.acceptState(next);
   return ok;
  }catch(e){
   failed=e.message||'Não foi possível recuperar o rascunho.';
   paintStatus('NÃO SALVO · '+failed);setMessage(failed);updateRecoveryUI();return false;
  }finally{recovering=false;updateRecoveryUI()}
 }

 function requireWrite(next){
  if(phase!=='ready'||pending||failed)throw Error(failed||'Aguarde a sincronização e o carregamento da base online antes de editar.');
  if(!navigator.onLine)throw Error('Sem conexão: a edição compartilhada está bloqueada.');
  if(root.EngefexAccess&&!root.EngefexAccess.canWrite(root.EngefexAccess.currentView())&&!(next&&root.EngefexAccess.personalOnly(confirmedState,next,session?.user)))throw Error('Seu usuário não tem permissão para editar esta tela.');
  if(next)stashDraft(next);
 }
 function send(next){
  requireWrite(next);
  pending=true;unsavedPayload=structuredClone(next);updateRecoveryUI();paintStatus('Enviando alterações ao Supabase…');
  return (async()=>{
   await uploadFiles(next);
   const out=await writeState(next);
   revision=Number(out.revision);
   pending=false;failed='';clearDraft();
   paintStatus('Salvo no Supabase · revisão '+revision+' · '+new Date().toLocaleTimeString('pt-BR'));
   client.saved?.();
   loadStockAlerts().catch(e=>console.warn('Avisos dos estoques indisponíveis',e));
   return true;
  })().catch(e=>{
   pending=false;
   failed=e.message||'Erro de sincronização';
   paintStatus('NÃO SALVO online · '+failed+(draftPersisted?' · Rascunho guardado neste aparelho.':' · Baixe o rascunho antes de fechar.'));
   setMessage('A alteração não foi confirmada pelo Supabase: '+failed);
   updateRecoveryUI();client.saveError?.(failed);
   return false;
  });
 }
 async function refreshRemote(force=false){
  if(phase!=='ready'||pending||failed||activeDraft||document.hidden||refreshing||!navigator.onLine)return;
  const now=Date.now(),minGap=refreshFailures?Math.min(300000,30000*Math.pow(2,Math.min(refreshFailures,4))):15000;
  if(!force&&now-lastRefreshAttempt<minGap)return;
  lastRefreshAttempt=now;
  refreshing=true;const generation=authGeneration,startRevision=revision,startWorkspace=workspace;
  const stillCurrent=()=>generation===authGeneration&&phase==='ready'&&!pending&&!ownDirty()&&revision===startRevision&&workspace===startWorkspace;
  try{
   if(force||Date.now()-lastReadCheck>=60000)await loadNotificationReads();
   if(force||Date.now()-lastStockCheck>=60000)try{await loadStockAlerts()}catch(e){lastStockCheck=Date.now();console.warn('Avisos dos estoques indisponíveis',e)}
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
  }catch(e){refreshFailures=Math.min(5,refreshFailures+1);throw e}finally{refreshing=false}
  refreshFailures=0;
 }

 async function prepareBackupImport(){
  if(!root.EngefexAccess?.isAdmin)throw Error('Somente o administrador pode importar o backup integral.');
  const full=await fullSnapshot();
  // Restaurar um backup é uma operação deliberada que pode substituir eventos antigos.
  // Para preservar essa função existente, validar o estado inteiro antes de permitir o salvamento.
  confirmedState=structuredClone(full);
  compactReadSupported=false;
  return true;
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
  if(activeDraft&&!root.confirm?.('Há um rascunho não confirmado. Baixe-o antes de sair. Continuar mesmo assim?'))return;
  const token=session?.access_token;
  const wasConnected=phase==='ready';
  authGeneration++;
  saveSession(null);accessVersion='';sessionFiles.clear();root.EngefexAccess?.setContext({is_admin:false,permissions:{modules:{},views:{}},restricted:true});workspace=null;revision=null;remoteSnapshot=null;confirmedState=null;patchSupported=null;compactReadSupported=null;lastAccessCheck=0;lastReadCheck=0;notificationReadIds.clear();stockAlerts=[];lastStockCheck=0;lastSync=null;knownFiles.clear();failed='';
  activeDraft=null;unsavedPayload=null;draftPersisted=false;setPhase('login');if(wasConnected)client?.clearState?.();paintStatus('Desconectado');
  if(token)fetch(URL_BASE+'/auth/v1/logout',{method:'POST',headers:{apikey:API_KEY,Authorization:'Bearer '+token}}).catch(()=>{});
 }
 function boot(app){if(root.EngefexUpdateGate){root.EngefexUpdateGate.then(ready=>{if(ready!==false)start(app)}).catch(()=>start(app));return}start(app)}
 function start(app){
  client=app;setupVisual();patchFileLoading();setPhase('login');
  try{const cached=JSON.parse(localStorage.getItem(SESSION_KEY)||'null');if(cached?.refresh_token)session=cached}catch{}
  if(session)connect().catch(e=>{if(e.status===401||e.status===403){saveSession(null);setPhase('login','Sua sessão expirou. Entre novamente.')}else setPhase('error',e.message)});
  setInterval(()=>{if(phase==='ready')refreshRemote().catch(e=>paintStatus('Falha ao atualizar: '+e.message))},60000);
  root.addEventListener('focus',()=>{if(phase==='ready')refreshRemote().catch(()=>{})});
 }
 root.EngefexCloud={fullSnapshot,prepareBackupImport,markNotificationsRead,hasNotificationBeenRead:id=>notificationReadIds.has(id),get stockAlerts(){return stockAlerts.slice()},loadFullHistory:async()=>{const full=await fullSnapshot();return full.history||[]},get compact(){return compactReadSupported===true&&!root.EngefexAccess?.context?.restricted},async birthdaysToday(){if(phase!=='ready')return [];const result=await raw('/rest/v1/rpc/engefex_birthdays_today',{method:'POST',json:true,body:{}});return Array.isArray(result)?result.map(x=>String(x.employee_name||'').trim()).filter(Boolean):[];},async resetUserPassword(userId,password){if(phase!=='ready'||!workspace||!root.EngefexAccess?.isAdmin)throw Error('Somente o administrador pode redefinir senhas.');const generation=authGeneration;const result=await raw('/functions/v1/admin-create-user',{method:'POST',json:true,body:{action:'reset_password',workspace,userId,password}});if(generation!==authGeneration)throw Error('A sessão mudou. Entre novamente.');return result;},async createUser(details){if(phase!=='ready'||!workspace||!root.EngefexAccess?.isAdmin)throw Error('Somente o administrador pode cadastrar usuários.');const generation=authGeneration;const result=await raw('/functions/v1/admin-create-user',{method:'POST',json:true,body:{workspace,name:details.name,email:details.email,password:details.password}});if(generation!==authGeneration)throw Error('A sessão mudou. Atualize a lista de usuários.');return result;},async loadNextar(){if(phase!=='ready'||!workspace)throw Error('Entre no sistema.');const list=await raw('/rest/v1/engefex_nextar_inventory?select=snapshot&workspace_id=eq.'+encodeURIComponent(workspace)+'&limit=1');return list?.[0]?.snapshot||null;},async publishNextar(snapshot){if(phase!=='ready'||!workspace)throw Error('Entre no sistema.');const published=await raw('/rest/v1/rpc/engefex_nextar_publish',{method:'POST',json:true,body:{p_workspace:workspace,p_snapshot:snapshot}});await loadStockAlerts().catch(e=>console.warn('Avisos dos estoques indisponíveis',e));return published;},async listAccess(){if(!root.EngefexAccess?.isAdmin)throw Error('Somente o administrador pode gerenciar acessos.');return raw('/rest/v1/rpc/engefex_list_access',{method:'POST',json:true,body:{p_workspace:workspace}})},async setAccess(user,version,permissions){if(!root.EngefexAccess?.isAdmin)throw Error('Somente o administrador pode gerenciar acessos.');return raw('/rest/v1/rpc/engefex_set_access',{method:'POST',json:true,body:{p_workspace:workspace,p_user:user,p_revision:version,p_permissions:permissions}})},boot,requireWrite,send,buildPatch,get lastSync(){return lastSync?{...lastSync}:null},get currentUser(){return phase==='ready'?{id:session?.user?.id||'',email:session?.user?.email||''}:null},get ready(){return phase==='ready'},get pending(){return pending},get dirty(){return ownDirty()||pending||!!activeDraft},get unsynced(){return !!activeDraft||pending||!!failed},retryPending};
})(window);



