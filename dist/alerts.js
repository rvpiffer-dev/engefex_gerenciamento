/* Engefex: personal issue inbox on top of the shared workspace.
 * UI scoping is not database isolation. Current engefex_state access remains workspace-wide.
 */
(function(root){'use strict';
 const lower=x=>String(x||'').trim().toLowerCase();
 function ensure(s){if(!Array.isArray(s.responsibles))s.responsibles=[];if(!Array.isArray(s.notifications))s.notifications=[];return s}
 function member(s,id){return(s.responsibles||[]).find(r=>r.id===id)}
 function actorEmail(user){return lower(user?.email)}
 function mine(issue,s,user){
  const email=actorEmail(user);if(!email)return true; // Preserve legacy local-only tests.
  if(lower(issue.createdByEmail)===email)return true;
  const responsible=member(s,issue.responsibleId);
  return lower(responsible?.email)===email;
 }
 function personal(s,user,project='all'){
  return (s.issues||[]).filter(x=>(project==='all'||x.project===project||x.project==='Geral')&&mine(x,s,user));
 }
 function unassigned(s){return(s.issues||[]).filter(x=>!x.createdByEmail&&!x.responsibleId)}
 function inbox(s,user){
  const email=actorEmail(user);if(!email)return [];
  return(s.notifications||[]).filter(n=>lower(n.recipientEmail)===email)
   .slice().sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
 }
 function unread(s,user){const email=actorEmail(user);return inbox(s,user).filter(n=>!(n.readBy||[]).some(x=>lower(x)===email))}
 function prepare(previous,next,user){
  ensure(next);const email=actorEmail(user);
  if(!email)return next;
  const before=new Map((previous?.issues||[]).map(x=>[x.id,x]));
  for(const issue of next.issues||[]){
   const old=before.get(issue.id);
   if(!old&&!issue.createdByEmail){issue.createdByEmail=email;issue.createdById=user.id||''}
   if(issue.responsibleId){
    const r=member(next,issue.responsibleId);
    if(!r)throw Error('Responsável não cadastrado. Atualize a seleção.');
    issue.responsible=r.name;
   }else if(old?.responsibleId){issue.responsible=''}
   const recipients=new Map();
   const assigned=member(next,issue.responsibleId);
   if(assigned?.email&&(!old||old.responsibleId!==issue.responsibleId)){
    recipients.set(lower(assigned.email),'assign');
   }
   if(old&&old.status!==issue.status){
    if(issue.createdByEmail)recipients.set(lower(issue.createdByEmail),'status');
    if(assigned?.email&&!recipients.has(lower(assigned.email)))recipients.set(lower(assigned.email),'status');
   }
   for(const [recipientEmail,type] of recipients){
    if(!recipientEmail)continue;
    const id='NOT-'+(root.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
    next.notifications.unshift({id,issueId:issue.id,project:issue.project,recipientEmail,type,
      title:type==='assign'?'Nova pendência atribuída':'Pendência atualizada',
      detail:issue.title,priority:issue.priority||'Normal',due:issue.due||'',
      createdAt:new Date().toISOString(),readBy:[],by:email});
   }
  }
  return next;
 }
 function read(s,id,user){
  const email=actorEmail(user),next=ensure(JSON.parse(JSON.stringify(s)));
  const item=next.notifications.find(n=>n.id===id&&lower(n.recipientEmail)===email);
  if(!item)throw Error('Notificação não encontrada para esta conta.');
  item.readBy=Array.from(new Set([...(item.readBy||[]).map(lower),email]));
  return next;
 }
 function readAll(s,user){
  const email=actorEmail(user),next=ensure(JSON.parse(JSON.stringify(s)));
  for(const n of next.notifications)if(lower(n.recipientEmail)===email)
   n.readBy=Array.from(new Set([...(n.readBy||[]).map(lower),email]));
  return next;
 }
 const api={ensure,member,mine,personal,unassigned,inbox,unread,prepare,read,readAll};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.EngefexAlerts=api;
})(typeof window==='undefined'?globalThis:window);
