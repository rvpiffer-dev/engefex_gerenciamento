(function(root){'use strict';
let layout='status',project='all',assigned='all',hideDone=false;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const statuses=['A fazer','Em andamento','Concluída'];
const tone={'A fazer':'#f59e0b','Em andamento':'#3b82f6','Concluída':'#16a34a'};
const prio={'Urgente':'#ef4444','Alta':'#f97316','Normal':'#6366f1','Baixa':'#64748b'};
let cssAdded=false;
function css(){if(cssAdded)return;cssAdded=true;const e=document.createElement('style');e.textContent=`
body.activity-focus .shell{margin-left:0!important;max-width:none!important;width:100%!important}
body.activity-focus #main{max-width:none!important;padding:0!important}
body.activity-focus #mainSidebar,body.activity-focus header,body.activity-focus .install-bar,body.activity-focus #saveStatus{display:none!important}
body.activity-focus .shell{padding:0!important}
.at-wrap{min-height:100vh;background:#edf2fa;color:#18243a;padding:25px 24px;font-family:inherit}
.at-hero{background:linear-gradient(125deg,#132a50,#215f9d 55%,#4279e0);border-radius:21px;padding:25px 28px;color:white;box-shadow:0 12px 28px #18315c26}
.at-hero h1{color:white;font-size:clamp(25px,3vw,40px);margin:5px 0}
.at-hero p{color:#dceaff}
.at-top,.at-line{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.at-controls{display:flex;gap:9px;flex-wrap:wrap;margin:20px 0}
.at-controls select,.at-controls button,.at-hero button{border:1px solid #d4dff0;border-radius:10px;padding:10px 13px;background:white;color:#253b57;cursor:pointer;font-weight:600}
.at-controls button.selected{background:#204a89;color:#fff}
.at-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:13px;margin:18px 0}
.at-stat{background:white;border-radius:15px;padding:17px 18px;border-left:5px solid var(--accent);box-shadow:0 5px 16px #30466b12}
.at-stat strong{display:block;font-size:30px;color:#162f56}
.at-board{display:grid;grid-template-columns:repeat(3,minmax(270px,1fr));gap:14px;align-items:start}
.at-column,.at-project{background:#dae5f5;border-radius:17px;padding:13px;min-height:190px}
.at-column h2,.at-project h2{font-size:16px;color:#1e3859;display:flex;justify-content:space-between;align-items:center;margin:2px 0 14px}
.at-card{background:white;border-radius:14px;padding:15px;margin:0 0 11px;box-shadow:0 3px 10px #1a376020;border-top:4px solid var(--accent)}
.at-card h3{font-size:15px;color:#1c2b42;margin:8px 0}
.at-card p{font-size:12px;color:#64748b;margin:4px 0}
.at-tag{font-size:11px;font-weight:700;display:inline-block;padding:5px 8px;border-radius:30px;background:#edf1fb;color:#355077}
.at-card input[type=checkbox]{width:18px;height:18px;accent-color:#16a34a;cursor:pointer}
.at-card select{font-size:12px;border:1px solid #d7e0ec;border-radius:8px;padding:5px;background:white;color:#1f334d}
.at-card button{border:0;background:#ecf2f9;color:#235186;padding:6px 9px;border-radius:8px;cursor:pointer}
.at-project{margin:0 0 15px;background:#e0e9f8}
.at-project-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:15px}
@media(max-width:900px){.at-board{grid-template-columns:1fr}.at-stats{grid-template-columns:repeat(2,1fr)}.at-wrap{padding:12px}}
`;document.head.appendChild(e)}
const model=s=>Array.isArray(s.boardTasks)?s.boardTasks:[];
const projectName=(s,id)=>id==='Geral'?'Administrativo / Geral':s.projects?.find(p=>p.id===id)?.name||'Obra sem cadastro';
const canEdit=()=>root.EngefexAccess?.canWrite('board');
function card(t,s){const pc=prio[t.priority]||prio.Normal,done=t.status==='Concluída';return '<article class="at-card" style="--accent:'+pc+'"><div class="at-line"><span class="at-tag" style="color:'+pc+'">'+esc(t.priority||'Normal')+'</span><label title="Concluir tarefa"><input type="checkbox" data-board-check="'+esc(t.id)+'" '+(done?'checked':'')+'></label></div><h3>'+esc(t.title)+'</h3><p>🏗 '+esc(projectName(s,t.project))+'</p><p>👤 '+esc(t.assignee||'Sem responsável')+(t.due?' · 📅 '+esc(t.due):'')+'</p><div class="at-line" style="margin-top:11px"><select data-board-status="'+esc(t.id)+'">'+statuses.map(st=>'<option '+(t.status===st?'selected':'')+'>'+st+'</option>').join('')+'</select><button data-board-edit="'+esc(t.id)+'">Editar</button></div></article>'}
function page(s){css();const list=model(s).filter(t=>(project==='all'||t.project===project)&&(assigned==='all'||t.assignee===assigned)&&(!hideDone||t.status!=='Concluída'));const opts=[...new Set(model(s).map(t=>t.assignee).filter(Boolean))].sort();return '<div class="at-wrap"><div class="at-hero"><div class="at-top"><div><div style="letter-spacing:2px;font-size:11px">ENGEFEX • PAINEL DE CONTROLE</div><h1>🎨 Lousa de Atividades</h1><p>Uma visão completa das tarefas e entregas de todas as obras.</p></div><div><button id="atBack">← Voltar ao gerenciador</button> <button id="atFull">⛶ Tela cheia</button></div></div></div>'+
'<div class="at-stats">'+[['Total',model(s).length,'#6366f1'],['A fazer',model(s).filter(t=>t.status==='A fazer').length,'#f59e0b'],['Em andamento',model(s).filter(t=>t.status==='Em andamento').length,'#3b82f6'],['Concluídas',model(s).filter(t=>t.status==='Concluída').length,'#16a34a']].map(x=>'<div class="at-stat" style="--accent:'+x[2]+'"><small>'+x[0]+'</small><strong>'+x[1]+'</strong></div>').join('')+'</div>'+
'<div class="at-controls"><button id="atAdd">＋ Nova atividade</button><button data-at-layout="status" class="'+(layout==='status'?'selected':'')+'">▤ Por situação</button><button data-at-layout="obra" class="'+(layout==='obra'?'selected':'')+'">▦ Por obra</button><select id="atProject"><option value="all">Todas as obras</option><option value="Geral">Administrativo / Geral</option>'+ (s.projects||[]).map(p=>'<option value="'+esc(p.id)+'" '+(project===p.id?'selected':'')+'>'+esc(p.name)+'</option>').join('')+'</select><select id="atPerson"><option value="all">Todos os responsáveis</option>'+opts.map(a=>'<option '+(assigned===a?'selected':'')+'>'+esc(a)+'</option>').join('')+'</select><label style="display:flex;align-items:center;gap:5px"><input type="checkbox" id="atHide" '+(hideDone?'checked':'')+'>Ocultar concluídas</label></div>'+
(layout==='status'?'<div class="at-board">'+statuses.map(st=>'<section class="at-column"><h2><span style="color:'+tone[st]+'">●</span> '+st+' <span>'+list.filter(t=>t.status===st).length+'</span></h2>'+list.filter(t=>t.status===st).map(t=>card(t,s)).join('')+'</section>').join('')+'</div>':'<div class="at-project-grid">'+[...new Set(list.map(t=>t.project))].map(id=>'<section class="at-project"><h2>🏗 '+esc(projectName(s,id))+' <span>'+list.filter(t=>t.project===id).length+'</span></h2>'+list.filter(t=>t.project===id).map(t=>card(t,s)).join('')+'</section>').join('')+'</div>')+'</div>'}
function attach(s,persist,render,toast){document.getElementById('atBack')?.addEventListener('click',()=>{location.hash='#dashboard'});document.getElementById('atFull')?.addEventListener('click',()=>{if(document.fullscreenElement)document.exitFullscreen?.();else document.documentElement.requestFullscreen?.()});document.querySelectorAll('[data-at-layout]').forEach(b=>b.onclick=()=>{layout=b.dataset.atLayout;render()});for(const [id,set] of [['atProject',v=>project=v],['atPerson',v=>assigned=v],['atHide',v=>hideDone=v]]){let e=document.getElementById(id);if(e)e.onchange=()=>{set(e.type==='checkbox'?e.checked:e.value);render()}};async function save(task){if(!canEdit())return toast('Sem permissão para editar atividades.');let next=structuredClone(s);next.boardTasks=[...(next.boardTasks||[])];const ix=next.boardTasks.findIndex(t=>t.id===task.id);if(ix>=0)next.boardTasks[ix]=task;else next.boardTasks.push(task);await persist(next,'Atividade atualizada.');render()}
function edit(old){if(!canEdit())return toast('Sem permissão.');let title=prompt('Título da atividade:',old?.title||'');if(!title?.trim())return;let target=prompt('ID da obra (ou Geral):\n'+(s.projects||[]).map(p=>p.id+' — '+p.name).join('\n'),old?.project||project==='all'?'Geral':project);if(target===null)return;if(target!=='Geral'&&!s.projects.some(p=>p.id===target))return toast('Obra não encontrada.');let who=prompt('Responsável (nome):',old?.assignee||'');if(who===null)return;let due=prompt('Prazo (AAAA-MM-DD), se houver:',old?.due||'');if(due===null)return;let priority=prompt('Prioridade: Baixa, Normal, Alta ou Urgente',old?.priority||'Normal');if(priority===null)return;save({...old,id:old?.id||crypto.randomUUID(),title:title.trim(),project:target,assignee:who.trim(),due,status:old?.status||'A fazer',priority:prio[priority]?priority:'Normal',createdAt:old?.createdAt||new Date().toISOString()})}
document.getElementById('atAdd')?.addEventListener('click',()=>edit(null));document.querySelectorAll('[data-board-edit]').forEach(el=>el.onclick=()=>edit(model(s).find(t=>t.id===el.dataset.boardEdit)));document.querySelectorAll('[data-board-check],[data-board-status]').forEach(el=>el.onchange=()=>{let id=el.dataset.boardCheck||el.dataset.boardStatus,t=model(s).find(x=>x.id===id);if(!t)return;save({...t,status:el.dataset.boardCheck?(el.checked?'Concluída':'A fazer'):el.value,completedAt:el.dataset.boardCheck&&el.checked?new Date().toISOString():null})})}
root.EngefexBoard={page,attach};
})(window);
