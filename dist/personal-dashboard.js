/* Modelo pessoal da Visão Geral: somente campos operacionais, sem dados financeiros. */
(function(root){'use strict';
const text=v=>String(v??'').trim(),email=v=>text(v).toLowerCase(),name=v=>text(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ');
const done=row=>['resolvida','resolvido','concluida','concluido','cancelada','cancelado','encerrada','encerrado','fechada','fechado'].includes(name(row.status));
function context(state,user){
 const id=text(user?.id),address=email(user?.email),authenticated=!!(id||address),people=state.responsibles||[];
 const contacts=authenticated?people.filter(p=>address&&email(p.email)===address||id&&[p.userId,p.authUserId].some(value=>text(value)===id)):[];
 const ids=new Set([id,...contacts.map(p=>text(p.id))].filter(Boolean));
 // Nomes livres só identificam alguém quando o nome completo cadastrado é único.
 const names=new Set(contacts.map(p=>name(p.name)).filter(value=>value&&people.filter(p=>name(p.name)===value).length===1));
 const assigned=row=>{
  if(!authenticated)return false;
  const references=[row.responsibleId,row.responsibleUserId,row.assigneeId,row.assignedToId,...(Array.isArray(row.responsibleIds)?row.responsibleIds:[]),...(Array.isArray(row.assigneeIds)?row.assigneeIds:[])].map(text).filter(Boolean);
  const addresses=[row.responsibleEmail,row.assigneeEmail,row.assignedToEmail].map(email).filter(Boolean);
  if(references.length||addresses.length)return references.some(value=>ids.has(value))||!!address&&addresses.includes(address);
  return [row.responsible,row.assignee,row.assignedTo].flatMap(value=>text(value).split(/[;,]/)).some(value=>{const raw=text(value);return !!raw&&(ids.has(raw)||!!address&&email(raw)===address||names.has(name(raw))) });
 };
 const created=row=>authenticated&&(!!id&&text(row.createdById)===id||!!address&&email(row.createdByEmail)===address);
 return {authenticated,ids,assigned,created,displayName:text(contacts[0]?.name),linked:contacts.length>0};
}
function build(state,user,project='all',options={}){
 const ctx=context(state,user),today=options.today||root.Obras?.today?.()||new Date().toLocaleDateString('sv-SE');
 const canRead=view=>options.canRead?options.canRead(view):true;
 const relevant=row=>project==='all'||!row.project||row.project==='Geral'||row.project===project;
 const work=id=>{const p=(state.projects||[]).find(p=>p.id===id);return p?[p.code,p.name].filter(Boolean).join(' · '):'Geral'};
 const rank=row=>({urgente:0,critica:0,alta:1,normal:2,media:2,baixa:3})[name(row.priority)]??2;
 const order=(a,b)=>Number(!!b.date&&b.date<today)-Number(!!a.date&&a.date<today)||rank(a)-rank(b)||(a.date||'9999').localeCompare(b.date||'9999')||a.title.localeCompare(b.title,'pt-BR');
 const item=(row,kind,date)=>({id:text(row.id),kind,title:text(row.title||row.name),project:work(row.project),date:text(date),priority:text(row.priority)||'Normal',status:text(row.status),action:text(row.action||row.nextAction||row.expected),relationship:ctx.assigned(row)?'Atribuída a você':'Criada por você'});
 const issues=ctx.authenticated&&canRead('issues')?(state.issues||[]).filter(row=>relevant(row)&&!done(row)&&(ctx.assigned(row)||ctx.created(row))).map(row=>item(row,'issues',row.due)).sort(order):[];
 const tasks=[];
 if(ctx.authenticated)for(const [key,view,dateKey] of [['tasks','agenda','date'],['boardTasks','board','due']])if(canRead(view))for(const row of state[key]||[])if(relevant(row)&&!done(row)&&(ctx.assigned(row)||ctx.created(row)))tasks.push(item(row,key,row[dateKey]));
 tasks.sort(order);
 const lastDay=new Date(today+'T12:00:00');lastDay.setDate(lastDay.getDate()+6);
 const end=root.Obras?.addDays?.(today,6)||lastDay.toLocaleDateString('sv-SE');
 const events=ctx.authenticated&&canRead('sharedcalendar')?(state.calendarEvents||[]).filter(row=>relevant(row)&&!done(row)&&row.startDate<=end&&(row.endDate||row.startDate)>=today&&(!(row.participants||[]).length||row.participants.some(id=>ctx.ids.has(text(id))))).map(row=>({id:text(row.id),title:text(row.title),project:work(row.project),date:row.startDate<today?today:row.startDate,startDate:row.startDate,endDate:row.endDate||row.startDate,time:row.allDay?'Dia inteiro':text(row.startTime),endTime:row.allDay?'':text(row.endTime),location:text(row.location),shared:!(row.participants||[]).length})).sort((a,b)=>a.date.localeCompare(b.date)||(a.time==='Dia inteiro'?'00:00':a.time).localeCompare(b.time==='Dia inteiro'?'00:00':b.time)||a.title.localeCompare(b.title,'pt-BR')):[];
 const operational=issues.concat(tasks);
 return {authenticated:ctx.authenticated,name:ctx.displayName,linked:ctx.linked,today,issues,tasks,events,summary:{issues:issues.length,tasks:tasks.length,today:operational.filter(row=>row.date===today).length,overdue:operational.filter(row=>row.date&&row.date<today).length,events:events.length}};
}
function prepare(before,next,user){
 if(!user?.id&&!user?.email)return next;
 // Novas tarefas sem responsável também continuam vinculadas a quem as criou.
 // Registros legados sem autoria não são atribuídos por suposição.
 for(const key of ['tasks','boardTasks']){
  const existing=new Set((before[key]||[]).map(row=>row.id));
  for(const row of next[key]||[])if(!existing.has(row.id)&&!row.createdById&&!row.createdByEmail){row.createdById=text(user.id);row.createdByEmail=email(user.email)}
 }
 return next;
}
const api={context,build,prepare};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.EngefexPersonalDashboard=api;
})(typeof window==='undefined'?globalThis:window);
