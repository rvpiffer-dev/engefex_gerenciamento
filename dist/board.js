(function(root){'use strict';
let layout='status',project='all',assigned='all',hideDone=false;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const statuses=['A fazer','Em andamento','Concluída'];
const tone={'A fazer':'#f59e0b','Em andamento':'#3b82f6','Concluída':'#16a34a'};
const prio={'Urgente':'#ef4444','Alta':'#f97316','Normal':'#6366f1','Baixa':'#64748b'};
let cssAdded=false;
function css(){if(cssAdded)return;cssAdded=true;const e=document.createElement('style');e.textContent=`
.at-mural{position:relative;min-height:1600px;min-width:100%;border-radius:17px;background:#e9eef6;background-image:radial-gradient(#b8c7db 1px,transparent 1px);background-size:22px 22px;border:1px solid #d2ddea;overflow:auto}
.at-sticky{position:absolute;width:300px;min-height:175px;max-height:620px;display:flex;flex-direction:column;background:var(--paper);border-radius:13px;box-shadow:0 8px 25px #283e5940;overflow:hidden}
.at-sticky.dragging{z-index:20;box-shadow:0 20px 40px #283e5960}
.at-sticky-handle{padding:13px;display:flex;align-items:center;gap:9px;cursor:grab;touch-action:none;user-select:none;border-bottom:1px solid #0002}
.at-sticky-handle strong{flex:1;font-size:15px;color:#234;overflow-wrap:anywhere}.at-sticky-handle span{font-size:12px;color:#567}
.at-sticky-body{overflow-y:auto;padding:5px 14px;flex:1}
.at-sticky-task{border-bottom:1px solid #0002;padding:11px 0}.at-sticky-task-head{display:flex;justify-content:space-between;align-items:start;gap:8px}
.at-sticky-task-head label,.at-sticky-checklist label{display:flex;gap:8px;align-items:start;color:#234;line-height:1.4;font-size:13px}
.at-sticky-task-head button{border:0;border-radius:6px;background:#fff9;cursor:pointer}
.at-sticky-checklist{display:grid;gap:7px;padding:7px 0 0 21px}.at-sticky-checklist label{font-size:12px}
.at-sticky input[type=checkbox]{flex-shrink:0;accent-color:#16a34a;margin:2px 0 0}.at-sticky-checklist label:has(input:checked) span{text-decoration:line-through;opacity:.55}
.at-sticky-add{border:0;border-top:1px solid #0002;background:#fff6;padding:11px;color:#356;cursor:pointer}
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

.at-dialog .at-sheet-scroll{width:100%;overflow-x:auto;border:1px solid #cfdbed;border-radius:10px;background:white}.at-dialog .at-sheet{width:100%;border-collapse:collapse;table-layout:fixed;min-width:330px;color:#263b59}.at-dialog .at-sheet th{background:#e3ecfa;color:#26476b;text-align:left;font-size:12px;padding:10px;border-bottom:1px solid #cfdced}.at-dialog .at-sheet td{border-bottom:1px solid #e5ebf4;padding:4px 7px;vertical-align:middle;box-sizing:border-box}.at-dialog .at-sheet .at-check-row{display:table-row!important;width:auto!important}.at-dialog .at-sheet .at-row-number{text-align:center;font-size:12px;color:#73849b}.at-dialog .at-sheet .at-sheet-entry{display:block!important;width:100%!important;min-width:0!important;max-width:none!important;box-sizing:border-box!important;border:1px solid transparent!important;border-radius:5px!important;padding:10px!important;height:40px!important;background:white!important;color:#183152!important;opacity:1!important;pointer-events:auto!important;position:static!important;font-size:14px!important}.at-dialog .at-sheet .at-sheet-entry:focus{border-color:#3479e8!important;outline:2px solid #afcdfb!important}.at-dialog .at-sheet input[type=checkbox]{width:17px!important;height:17px!important;cursor:pointer}.at-dialog .at-sheet button{background:#fee6ea;border:0;color:#b32643;padding:7px 10px;border-radius:6px;cursor:pointer}.at-dialog .at-sheet tr:nth-child(even){background:#f5f8fe}
/* Isolar a planilha de subtarefas das regras globais de tabelas e formulários. */
.at-dialog .at-sheet{display:table!important;width:100%!important;min-width:330px!important;table-layout:fixed!important}
.at-dialog .at-sheet thead{display:table-header-group!important}
.at-dialog .at-sheet tbody{display:table-row-group!important;width:auto!important}
.at-dialog .at-sheet tr{display:table-row!important;width:auto!important}
.at-dialog .at-sheet th,.at-dialog .at-sheet td{display:table-cell!important;float:none!important;position:static!important;min-width:0!important;max-width:none!important}
.at-dialog .at-sheet th:nth-child(1),.at-dialog .at-sheet td:nth-child(1){width:45px!important;text-align:center}
.at-dialog .at-sheet th:nth-child(3),.at-dialog .at-sheet td:nth-child(3){width:83px!important;text-align:center}
.at-dialog .at-sheet th:nth-child(4),.at-dialog .at-sheet td:nth-child(4){width:54px!important;text-align:center}
.at-dialog .at-sheet th:nth-child(2),.at-dialog .at-sheet td:nth-child(2){width:auto!important}
.at-dialog .at-sheet td:nth-child(2) .at-sheet-entry{display:block!important;width:100%!important;min-width:0!important;box-sizing:border-box!important}

/* Grade estável: impede que estilos globais movam a célula de texto. */
.at-dialog .at-sheet{display:block!important;width:100%!important;min-width:0!important;table-layout:auto!important}
.at-dialog .at-sheet thead,.at-dialog .at-sheet tbody{display:block!important;width:100%!important}
.at-dialog .at-sheet thead tr,.at-dialog .at-sheet tbody tr.at-check-row{display:grid!important;grid-template-columns:40px minmax(0,1fr) 75px 52px!important;width:100%!important;min-width:0!important;align-items:stretch!important}
.at-dialog .at-sheet thead th,.at-dialog .at-sheet tbody td{display:flex!important;align-items:center!important;min-width:0!important;width:auto!important;max-width:none!important;padding:5px 8px!important;position:static!important;float:none!important;overflow:visible!important;box-sizing:border-box!important}
.at-dialog .at-sheet thead th:nth-child(2),.at-dialog .at-sheet tbody td:nth-child(2){min-width:0!important;width:auto!important;flex:1 1 auto!important}
.at-dialog .at-sheet tbody td:nth-child(2) input.at-sheet-entry{display:block!important;position:relative!important;width:100%!important;min-width:0!important;height:40px!important;padding:9px 12px!important;box-sizing:border-box!important;flex:1 1 auto!important;text-align:left!important;opacity:1!important;visibility:visible!important;pointer-events:auto!important;z-index:1!important;background:#fff!important;border:1px solid #d8e5f4!important;border-radius:8px!important;color:#1c3658!important}
.at-dialog .at-sheet tbody td:nth-child(2) input.at-sheet-entry:focus{border-color:#3479e8!important;outline:2px solid #bcd4ff!important}
.at-dialog .at-sheet tbody td:nth-child(3),.at-dialog .at-sheet tbody td:nth-child(4){justify-content:center!important}
.at-modal{position:fixed;inset:0;background:#0c1d39a9;z-index:99999;display:flex;align-items:center;justify-content:center;padding:14px}
.at-dialog{background:#f8fbff;color:#1c304e;width:min(780px,100%);max-height:94vh;overflow:auto;border-radius:20px;box-shadow:0 25px 80px #081d3d66}
.at-dialog-head{background:linear-gradient(120deg,#173d77,#366dd4);color:white;padding:20px 24px;display:flex;justify-content:space-between;align-items:center}
.at-dialog-head h2{color:white;margin:0;font-size:22px}.at-dialog-head button{color:#173d77;background:white;border:0;border-radius:8px;padding:8px 12px;cursor:pointer}
.at-dialog form{padding:22px}.at-fields{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.at-field{display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:700;color:#344e72}
.at-field.wide{grid-column:1/-1}.at-field input,.at-field select,.at-field textarea{border:1px solid #cbd8e8;border-radius:10px;background:white;padding:12px;font:inherit;color:#1d3152;width:100%;box-sizing:border-box}
.at-field textarea{min-height:85px;resize:vertical}.at-dialog-actions{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:10px;border-top:1px solid #dce5f2;padding-top:16px;margin-top:18px}
.at-dialog-actions button,.at-check-add{border:0;border-radius:9px;padding:11px 15px;cursor:pointer;background:#dce9fb;color:#16487f;font-weight:700}
.at-dialog-actions button.primary{background:#2162d0;color:white}.at-dialog #atCheckList{display:block!important;width:100%!important;min-width:0!important;grid-column:1/-1!important}.at-dialog #atCheckList .at-check-row{display:grid!important;grid-template-columns:22px minmax(0,1fr) 36px!important;align-items:center!important;width:100%!important;box-sizing:border-box!important}.at-dialog #atCheckList .at-check-row input[type="checkbox"]{width:18px!important;min-width:18px!important;margin:0!important}.at-dialog #atCheckList .at-check-row input[type="text"]{display:block!important;width:100%!important;min-width:0!important;max-width:none!important;box-sizing:border-box!important;flex:1 1 auto!important;padding:11px!important;font-size:15px!important;color:#172a45!important;background:#fff!important;opacity:1!important;pointer-events:auto!important;position:static!important}.at-dialog #atCheckList .at-check-row button{width:34px!important;height:34px!important}.at-check-row{display:flex;gap:9px;align-items:center;padding:6px 0}.at-check-row input[type=text]{flex:1;padding:9px;border:1px solid #d0dff0;border-radius:9px}.at-check-row button{border:0;color:#aa2540;background:#fee2e2;border-radius:7px;padding:8px;cursor:pointer}
.at-subtasks{border-top:1px solid #e5eaf2;margin-top:10px;padding-top:9px}.at-subtask{display:flex;align-items:center;gap:8px;padding:5px 0;font-size:13px;color:#334155;cursor:pointer}.at-subtask input{flex-shrink:0}.at-subtask:has(input:checked) span{text-decoration:line-through;color:#94a3b8}.at-new-column{width:100%;border:1px dashed #95a9c6;border-radius:10px;padding:9px;background:#ffffff9c;color:#2e5792;cursor:pointer}
@media(max-width:650px){.at-fields{grid-template-columns:1fr}.at-dialog{max-height:100vh;border-radius:12px}.at-dialog form{padding:14px}}
@media(max-width:900px){.at-board{grid-template-columns:1fr}.at-stats{grid-template-columns:repeat(2,1fr)}.at-wrap{padding:12px}}
.at-dialog #atCheckList .at-check-row{display:table-row!important;grid-template-columns:none!important;width:auto!important}.at-dialog #atCheckList .at-check-row .at-sheet-entry{width:100%!important;min-width:0!important;height:40px!important}.at-dialog #atCheckList .at-check-row td{display:table-cell!important}.at-dialog .at-sheet{table-layout:fixed!important}
`;document.head.appendChild(e)}
const model=s=>Array.isArray(s.boardTasks)?s.boardTasks:[];
const projectName=(s,id)=>id==='Geral'?'Administrativo / Geral':s.projects?.find(p=>p.id===id)?.name||'Obra sem cadastro';
const canEdit=()=>root.EngefexAccess?.canWrite('board');
function card(t,s){const pc=prio[t.priority]||prio.Normal,done=t.status==='Concluída';return '<article class="at-card" style="--accent:'+pc+'"><div class="at-line"><span class="at-tag" style="color:'+pc+'">'+esc(t.priority||'Normal')+'</span><label title="Concluir tarefa"><input type="checkbox" data-board-check="'+esc(t.id)+'" '+(done?'checked':'')+'></label></div><h3>'+esc(t.title)+'</h3><p>🏗 '+esc(projectName(s,t.project))+'</p><p>👤 '+esc(t.assignee||'Sem responsável')+(t.due?' · 📅 '+esc(t.due):'')+'</p><div class="at-line" style="margin-top:11px"><select data-board-status="'+esc(t.id)+'">'+statuses.map(st=>'<option '+(t.status===st?'selected':'')+'>'+st+'</option>').join('')+'</select><button data-board-edit="'+esc(t.id)+'">Editar</button></div></article>'}
function mural(s,list){const ids=[...new Set(list.map(t=>t.project||'Geral'))],pos=s.boardMuralPositions||{};return '<div class="at-mural" id="atMural">'+ids.map((id,i)=>{const tasks=list.filter(t=>(t.project||'Geral')===id),p=pos[id]||{x:20+(i%4)*330,y:20+Math.floor(i/4)*460},colors=['#fff0b3','#dceffd','#e7dfff','#ddf3e3','#ffe3d6'];return '<section class="at-sticky" data-mural-id="'+esc(id)+'" style="left:'+Math.max(0,Number(p.x)||0)+'px;top:'+Math.max(0,Number(p.y)||0)+'px;--paper:'+colors[i%colors.length]+'"><div class="at-sticky-handle" data-mural-drag="'+esc(id)+'"><span>⠿</span><strong>'+esc(projectName(s,id))+'</strong><span>'+tasks.length+'</span></div><div class="at-sticky-body">'+tasks.map(t=>'<div class="at-sticky-task"><div class="at-sticky-task-head"><label><input type="checkbox" data-board-check="'+esc(t.id)+'" '+(t.status==='Concluída'?'checked':'')+'><b>'+esc(t.title)+'</b></label><button data-board-edit="'+esc(t.id)+'">✎</button></div><div class="at-sticky-checklist">'+(t.checklist||[]).map((v,i)=>{const text=typeof v==='string'?v:v.text,done=typeof v==='string'?false:v.done;return text?'<label><input type="checkbox" data-board-sub="'+esc(t.id)+'" data-sub-index="'+i+'" '+(done?'checked':'')+'><span>'+esc(text)+'</span></label>':''}).join('')+'</div></div>').join('')+'</div><button type="button" class="at-sticky-add" data-mural-add="'+esc(id)+'">+ Atividade</button></section>'}).join('')+'</div>'}
function page(s){css();const list=model(s).filter(t=>(project==='all'||t.project===project)&&(assigned==='all'||t.assignee===assigned)&&(!hideDone||t.status!=='Concluída'));const opts=[...new Set(model(s).map(t=>t.assignee).filter(Boolean))].sort();return '<div class="at-wrap"><div class="at-hero"><div class="at-top"><div><div style="letter-spacing:2px;font-size:11px">ENGEFEX • PAINEL DE CONTROLE</div><h1>🎨 Lousa de Atividades</h1><p>Uma visão completa das tarefas e entregas de todas as obras.</p></div><div><button id="atBack">← Voltar ao gerenciador</button> <button id="atFull">⛶ Tela cheia</button></div></div></div>'+
'<div class="at-stats">'+[['Total',model(s).length,'#6366f1'],['A fazer',model(s).filter(t=>t.status==='A fazer').length,'#f59e0b'],['Em andamento',model(s).filter(t=>t.status==='Em andamento').length,'#3b82f6'],['Concluídas',model(s).filter(t=>t.status==='Concluída').length,'#16a34a']].map(x=>'<div class="at-stat" style="--accent:'+x[2]+'"><small>'+x[0]+'</small><strong>'+x[1]+'</strong></div>').join('')+'</div>'+
'<div class="at-controls"><button id="atAdd">＋ Nova atividade</button><button data-at-layout="status" class="'+(layout==='status'?'selected':'')+'">▤ Por situação</button><button data-at-layout="obra" class="'+(layout==='obra'?'selected':'')+'">▦ Por obra</button><button data-at-layout="mural" class="'+(layout==='mural'?'selected':'')+'">▧ Mural livre</button><select id="atProject"><option value="all">Todas as obras</option><option value="Geral">Administrativo / Geral</option>'+ (s.projects||[]).map(p=>'<option value="'+esc(p.id)+'" '+(project===p.id?'selected':'')+'>'+esc(p.name)+'</option>').join('')+'</select><select id="atPerson"><option value="all">Todos os responsáveis</option>'+opts.map(a=>'<option '+(assigned===a?'selected':'')+'>'+esc(a)+'</option>').join('')+'</select><label style="display:flex;align-items:center;gap:5px"><input type="checkbox" id="atHide" '+(hideDone?'checked':'')+'>Ocultar concluídas</label></div>'+
(layout==='mural'?mural(s,list):layout==='status'?'<div class="at-board">'+statuses.map(st=>'<section class="at-column"><h2><span style="color:'+tone[st]+'">●</span> '+st+' <span>'+list.filter(t=>t.status===st).length+'</span></h2>'+list.filter(t=>t.status===st).map(t=>card(t,s)).join('')+'<button class="at-new-column" data-board-new-status="'+esc(st)+'">＋ Adicionar aqui</button></section>').join('')+'</div>':'<div class="at-project-grid">'+[...new Set(list.map(t=>t.project))].map(id=>'<section class="at-project"><h2>🏗 '+esc(projectName(s,id))+' <span>'+list.filter(t=>t.project===id).length+'</span></h2>'+list.filter(t=>t.project===id).map(t=>card(t,s)).join('')+'</section>').join('')+'</div>')+'</div>'}
function attach(s,persist,render,toast){document.getElementById('atBack')?.addEventListener('click',()=>{location.hash='#dashboard'});document.getElementById('atFull')?.addEventListener('click',()=>{if(document.fullscreenElement)document.exitFullscreen?.();else document.documentElement.requestFullscreen?.()});document.querySelectorAll('[data-at-layout]').forEach(b=>b.onclick=()=>{layout=b.dataset.atLayout;render()});for(const [id,set] of [['atProject',v=>project=v],['atPerson',v=>assigned=v],['atHide',v=>hideDone=v]]){let e=document.getElementById(id);if(e)e.onchange=()=>{set(e.type==='checkbox'?e.checked:e.value);render()}};async function save(task){if(!canEdit())return toast('Sem permissão para editar atividades.');let next=structuredClone(s);next.boardTasks=[...(next.boardTasks||[])];const ix=next.boardTasks.findIndex(t=>t.id===task.id);if(ix>=0)next.boardTasks[ix]=task;else next.boardTasks.push(task);await persist(next,'Atividade atualizada.');render()}
function edit(old,initialStatus='A fazer',again=false){
 if(!canEdit())return toast('Sem permissão para editar atividades.');
 document.getElementById('atModal')?.remove();
 const modal=document.createElement('div');modal.className='at-modal';modal.id='atModal';
 const people=[];
 const choices=(items,current)=>items.map(v=>'<option value="'+esc(v)+'" '+(v===current?'selected':'')+'>'+esc(v)+'</option>').join('');
 const selectProject='<option value="Geral">Administrativo / Geral</option>'+(s.projects||[]).map(p=>'<option value="'+esc(p.id)+'" '+(p.id===(old?.project||(project==='all'?'Geral':project))?'selected':'')+'>'+esc(p.name)+'</option>').join('');
 const check=(old?.checklist||[]).map(x=>typeof x==='string'?{text:x,done:false}:x);
 modal.innerHTML='<div class="at-dialog" role="dialog" aria-modal="true" aria-label="Cadastro de atividade"><div class="at-dialog-head"><h2>'+(old?'Editar atividade':'＋ Nova atividade')+'</h2><button type="button" id="atClose">✕ Fechar</button></div><form id="atTaskForm"><div class="at-fields">'+
 '<label class="at-field wide">Título da atividade *<input name="title" required maxlength="200" placeholder="Ex.: Conferir projeto de fabricação" value="'+esc(old?.title||'')+'"></label>'+
 '<label class="at-field wide">Descrição<textarea name="description" placeholder="Detalhes do que precisa ser feito">'+esc(old?.description||'')+'</textarea></label>'+
 '<label class="at-field">Obra *<select name="project" required>'+selectProject+'</select></label>'+
 
 '<label class="at-field">Prazo<input type="date" name="due" value="'+esc(old?.due||'')+'"></label>'+
 '<label class="at-field">Prioridade<select name="priority">'+choices(['Baixa','Normal','Alta','Urgente'],old?.priority||'Normal')+'</select></label>'+
 '<label class="at-field">Situação<select name="status">'+choices(statuses,old?.status||initialStatus)+'</select></label>'+
 '<label class="at-field">Categoria / etiqueta<input name="tag" placeholder="Projeto, compra, montagem..." value="'+esc(old?.tag||'')+'"></label>'+
 '<label class="at-field wide">Observações<textarea name="notes" placeholder="Informações adicionais">'+esc(old?.notes||'')+'</textarea></label>'+
 '<div class="at-field wide"><strong>Planilha de subtarefas</strong><small>Cole uma coluna do Excel (Ctrl+V) para adicionar várias linhas. Enter cria uma nova linha.</small><div class="at-sheet-scroll"><table class="at-sheet"><colgroup><col style="width:45px"><col><col style="width:83px"><col style="width:54px"></colgroup><thead><tr><th>Nº</th><th>Subtarefa</th><th>Feita</th><th></th></tr></thead><tbody id="atCheckList"></tbody></table></div><button class="at-check-add" id="atCheckAdd" type="button">＋ Nova linha</button></div></div>'+
 '<div class="at-dialog-actions"><button id="atCancel" type="button">Cancelar</button>'+(old?'<button id="atDelete" type="button" style="background:#ffe0e0;color:#b42340;margin-right:auto">Excluir atividade</button>':'<button id="atSaveAnother" type="button">Salvar e criar outra</button>')+'<button class="primary" type="submit" id="atSave">Salvar atividade</button></div></form></div>';
 document.body.appendChild(modal);
 const form=modal.querySelector('#atTaskForm'),list=modal.querySelector('#atCheckList');
 function renumber(){[...list.rows].forEach((row,i)=>row.querySelector('.at-row-number').textContent=String(i+1))}
 function addCheck(t='',done=false,focus=true){
  const row=document.createElement('tr');row.className='at-check-row';
  const num=document.createElement('td');num.className='at-row-number';
  const cell=document.createElement('td');
  const entry=document.createElement('input');entry.type='text';entry.className='at-sheet-entry';entry.placeholder='Digite ou cole uma subtarefa';entry.value=t;entry.setAttribute('aria-label','Texto da subtarefa');
  cell.appendChild(entry);
  const completion=document.createElement('td');const checked=document.createElement('input');checked.type='checkbox';checked.checked=done;checked.setAttribute('aria-label','Concluída');completion.appendChild(checked);
  const actions=document.createElement('td');const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label','Remover linha');remove.onclick=()=>{row.remove();renumber();if(!list.rows.length)addCheck()};actions.appendChild(remove);
  row.append(num,cell,completion,actions);list.appendChild(row);renumber();if(focus)entry.focus();return row
 }
 check.forEach(x=>addCheck(x.text||'',!!x.done,false));
 if(!check.length)addCheck('',false,false);
 modal.querySelector('#atCheckAdd').onclick=e=>{e.preventDefault();addCheck()};
 list.addEventListener('paste',event=>{
  if(!event.target.classList.contains('at-sheet-entry'))return;
  const raw=event.clipboardData?.getData('text/plain')||'';
  if(!/[\r\n\t]/.test(raw))return;
  event.preventDefault();
  const lines=raw.replace(/\r\n?/g,'\n').split('\n').filter((line,i,arr)=>i<arr.length-1||line!=='');
  if(!lines.length)return;
  const entry=event.target;let row=entry.closest('tr');
  const first=lines[0].split('\t');entry.value=first.find(x=>x.trim())||'';
  if(first.length>1){const marker=first.map(x=>x.trim().toLowerCase());row.querySelector('input[type=checkbox]').checked=marker.some(x=>['sim','feito','concluída','concluido','true','1','x'].includes(x))}
  for(const line of lines.slice(1)){
   const cells=line.split('\t');const item=addCheck(cells.find(x=>x.trim())||'',cells.some(x=>['sim','feito','concluída','concluido','true','1','x'].includes(x.trim().toLowerCase())),false);
   row.after(item);row=item;
  }
  renumber();
 });
 list.addEventListener('keydown',event=>{
  if(event.key!=='Enter'||!event.target.classList.contains('at-sheet-entry'))return;
  event.preventDefault();const row=event.target.closest('tr');const newRow=addCheck('',false,false);row.after(newRow);renumber();newRow.querySelector('.at-sheet-entry').focus();
 });
 const close=()=>modal.remove();
 modal.querySelector('#atClose').onclick=close;modal.querySelector('#atCancel').onclick=close;
 modal.addEventListener('click',e=>{if(e.target===modal)close()});
 async function commit(repeat=false){if(!form.reportValidity())return;const fd=new FormData(form),newStatus=fd.get('status');const task={...old,id:old?.id||crypto.randomUUID(),title:String(fd.get('title')).trim(),description:String(fd.get('description')||''),project:fd.get('project'),assignee:'',due:fd.get('due'),priority:fd.get('priority'),status:newStatus,tag:fd.get('tag'),notes:fd.get('notes'),checklist:[...list.querySelectorAll('.at-check-row')].map(r=>({text:r.querySelector('.at-sheet-entry').value.trim(),done:r.querySelector('input[type=checkbox]').checked})).filter(x=>x.text),createdAt:old?.createdAt||new Date().toISOString(),completedAt:newStatus==='Concluída'?(old?.completedAt||new Date().toISOString()):null};if(!task.title)return;form.querySelectorAll('button').forEach(b=>b.disabled=true);try{await save(task);close();if(repeat){const fresh=(window.EngefexBoardState?.state)||null;setTimeout(()=>document.getElementById('atAdd')?.click(),0)}}catch(e){toast(e.message);form.querySelectorAll('button').forEach(b=>b.disabled=false)}}
 form.onsubmit=e=>{e.preventDefault();commit(false)};const another=modal.querySelector('#atSaveAnother');if(another)another.onclick=()=>commit(true);
 const del=modal.querySelector('#atDelete');if(del)del.onclick=async()=>{if(!confirm('Excluir esta atividade definitivamente?'))return;let next=structuredClone(s);next.boardTasks=model(next).filter(t=>t.id!==old.id);try{await persist(next,'Atividade excluída.');close();render()}catch(e){toast(e.message)}};
 form.elements.title.focus()
}
document.querySelectorAll('[data-mural-add]').forEach(b=>b.onclick=()=>{project=b.dataset.muralAdd;edit(null)});
const muralEl=document.getElementById('atMural');if(muralEl){let drag=null;
muralEl.querySelectorAll('[data-mural-drag]').forEach(handle=>handle.addEventListener('pointerdown',ev=>{if(ev.button!==0||!canEdit())return;ev.preventDefault();const card=handle.closest('.at-sticky');drag={card,id:card.dataset.muralId,x:parseFloat(card.style.left)||0,y:parseFloat(card.style.top)||0,startX:ev.clientX,startY:ev.clientY};handle.setPointerCapture(ev.pointerId);card.classList.add('dragging')}));
muralEl.addEventListener('pointermove',ev=>{if(!drag)return;drag.card.style.left=Math.max(0,drag.x+ev.clientX-drag.startX)+'px';drag.card.style.top=Math.max(0,drag.y+ev.clientY-drag.startY)+'px'});
const finish=async()=>{if(!drag)return;const d=drag;drag=null;d.card.classList.remove('dragging');const x=Math.round(parseFloat(d.card.style.left)||0),y=Math.round(parseFloat(d.card.style.top)||0);if(x===d.x&&y===d.y)return;const n=structuredClone(s);n.boardMuralPositions={...(n.boardMuralPositions||{}),[d.id]:{x,y}};try{await persist(n,'Posição salva.')}catch(e){toast(e.message);render()}};
muralEl.addEventListener('pointerup',finish);muralEl.addEventListener('pointercancel',finish)}
document.getElementById('atAdd')?.addEventListener('click',()=>edit(null));
document.querySelectorAll('[data-board-new-status]').forEach(el=>el.onclick=()=>edit(null,el.dataset.boardNewStatus));
document.querySelectorAll('[data-board-edit]').forEach(el=>el.onclick=()=>edit(model(s).find(t=>t.id===el.dataset.boardEdit)));
document.querySelectorAll('[data-board-sub]').forEach(el=>el.onchange=()=>{const t=model(s).find(x=>x.id===el.dataset.boardSub),index=Number(el.dataset.subIndex);if(!t||!Array.isArray(t.checklist)||!t.checklist[index])return;const checklist=t.checklist.map((x,i)=>i===index?{...x,done:el.checked}:x);save({...t,checklist})});document.querySelectorAll('[data-board-check],[data-board-status]').forEach(el=>el.onchange=()=>{let id=el.dataset.boardCheck||el.dataset.boardStatus,t=model(s).find(x=>x.id===id);if(!t)return;save({...t,status:el.dataset.boardCheck?(el.checked?'Concluída':'A fazer'):el.value,completedAt:el.dataset.boardCheck&&el.checked?new Date().toISOString():null})})}
root.EngefexBoard={page,attach};
})(window);
