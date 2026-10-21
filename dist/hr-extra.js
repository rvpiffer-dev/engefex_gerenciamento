/* Cadastros administrativos de férias e folha, persistidos na base compartilhada. */
(function(root){'use strict';
const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
const config={
 'hr-vacations':{title:'Férias',key:'hrVacations',fields:[['employeeId','Funcionário','employee'],['periodStart','Início aquisitivo','date'],['periodEnd','Fim aquisitivo','date'],['start','Início das férias','date'],['end','Fim das férias','date'],['status','Situação','select'],['notes','Observações','text']]},
 'hr-payroll':{title:'Folha de pagamento',key:'hrPayroll',fields:[['employeeId','Funcionário','employee'],['period','Competência (AAAA-MM)','month'],['base','Valor base (R$)','number'],['additions','Proventos adicionais (R$)','number'],['deductions','Descontos (R$)','number'],['status','Situação','select'],['notes','Observações','text']]}
};
const active=s=>(s.hrEmployees||[]).filter(x=>x.active!==false&&x.employmentStatus!=='inativo');
function page(s,view){const c=config[view],rows=s[c.key]||[],people=s.hrEmployees||[];
return '<section class="page-head hr-hero"><div><p class="hr-eyebrow">ENGEFEX · RECURSOS HUMANOS</p><h1>'+c.title+'</h1><p>Registros compartilhados e atualizados no Supabase.</p></div></section>'+
'<section class="panel hr-panel"><div class="panel-head"><h2>'+c.title+' ('+rows.length+')</h2><button class="button primary" data-hr-extra-new>+ Novo lançamento</button></div><div style="overflow:auto"><table><thead><tr><th>Funcionário</th><th>'+(view==='hr-vacations'?'Período de férias':'Competência')+'</th><th>'+(view==='hr-vacations'?'Período aquisitivo':'Total informado')+'</th><th>Situação</th><th>Ação</th></tr></thead><tbody>'+
rows.map(r=>'<tr><td>'+escape(people.find(p=>p.id===r.employeeId)?.name||'Funcionário não encontrado')+'</td><td>'+escape(view==='hr-vacations'?((r.start||'—')+' a '+(r.end||'—')):r.period)+'</td><td>'+escape(view==='hr-vacations'?((r.periodStart||'—')+' a '+(r.periodEnd||'—')):money((Number(r.base)||0)+(Number(r.additions)||0)-(Number(r.deductions)||0)))+'</td><td>'+escape(r.status||'Planejado')+'</td><td><button class="button secondary" data-hr-extra-edit="'+escape(r.id)+'">Editar</button></td></tr>').join('')+
'</tbody></table></div></section><dialog id="hrExtraDialog" class="hr-editor"><header class="hr-editor-header"><div><h2 id="hrExtraTitle">Novo lançamento</h2><p>Os dados serão salvos na nuvem.</p></div></header><form id="hrExtraForm"><div id="hrExtraFields" class="hr-editor-fields"></div><footer class="hr-editor-footer"><button type="button" class="button secondary" id="hrExtraCancel">Cancelar</button><button type="submit" class="button primary">Salvar</button></footer></form></dialog>'+
(view==='hr-payroll'?'<p class="notice">Valores informados manualmente. Não substitui cálculo de folha, encargos, eSocial ou conferência contábil.</p>':'');
}
function attach(s,persist,render,notify,view){const c=config[view],dialog=document.getElementById('hrExtraDialog'),form=document.getElementById('hrExtraForm');if(!dialog)return;
const show=id=>{const existing=(s[c.key]||[]).find(x=>x.id===id)||{};dialog.dataset.id=id||'';document.getElementById('hrExtraTitle').textContent=id?'Editar lançamento':'Novo lançamento';
document.getElementById('hrExtraFields').innerHTML=c.fields.map(([key,label,type])=>'<label class="hr-edit-field"><span>'+label+'</span>'+(type==='employee'?'<select name="'+key+'" required>'+((s.hrEmployees||[]).filter(x=>active(s).some(y=>y.id===x.id)||x.id===existing.employeeId)).map(e=>'<option value="'+escape(e.id)+'" '+(e.id===existing.employeeId?'selected':'')+'>'+escape(e.name)+'</option>').join('')+'</select>':type==='select'?'<select name="'+key+'">'+(view==='hr-vacations'?['Planejado','Programado','Em andamento','Concluído','Cancelado']:['Rascunho','Conferido','Pago']).map(t=>'<option '+(t===existing[key]?'selected':'')+'>'+t+'</option>').join('')+'</select>':'<input name="'+key+'" type="'+(type==='number'?'number':type)+'" '+(type==='number'?'step="0.01" min="0"':'')+' value="'+escape(existing[key]??'')+'" '+(['employeeId','period','start','end'].includes(key)?'required':'')+'>')+'</label>').join('');
dialog.showModal();};
document.querySelector('[data-hr-extra-new]')?.addEventListener('click',()=>show(''));
document.querySelectorAll('[data-hr-extra-edit]').forEach(b=>b.onclick=()=>show(b.dataset.hrExtraEdit));
document.getElementById('hrExtraCancel').onclick=()=>dialog.close();
form.onsubmit=async e=>{e.preventDefault();if(!root.EngefexAccess?.canWrite(view))return notify('Sem permissão para editar.');const fields=Object.fromEntries(new FormData(form));const id=dialog.dataset.id||crypto.randomUUID();const next=structuredClone(s);next[c.key]=next[c.key]||[];const record={id,...fields};if(view==='hr-payroll'){for(const k of ['base','additions','deductions'])record[k]=Number(record[k]||0)}
if(view==='hr-vacations'&&record.start&&record.end&&record.end<record.start)return notify('A data final não pode ser anterior à inicial.');
const idx=next[c.key].findIndex(x=>x.id===id);if(idx<0)next[c.key].push(record);else next[c.key][idx]={...next[c.key][idx],...record};
try{const saved=await persist(next,'Registro salvo no Supabase.');if(saved===false)throw Error('O banco não confirmou o salvamento.');dialog.close();render()}catch(err){notify(err.message||'Não foi possível salvar.')}};
}
root.EngefexHRExtra={page,attach};
})(window);
