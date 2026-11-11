const {test}=require('node:test'),assert=require('node:assert/strict');
const dashboard=require('../dist/personal-dashboard.js');
const today='2026-11-11',user={id:'U1',email:'ramon@example.com'};
const build=(s,u=user,project='all',options={})=>dashboard.build(s,u,project,{today,...options});
const base=()=>({projects:[{id:'P1',code:'OB-01',name:'Casa Jardim'},{id:'P2',name:'Galpão'}],responsibles:[{id:'C1',name:'Ramon Piffer',email:'RAMON@example.com'},{id:'C2',name:'Valter Silva',email:'valter@example.com'}],issues:[],tasks:[],boardTasks:[],calendarEvents:[]});
test('painel pessoal inclui autor e responsáveis e exclui terceiros e itens encerrados',()=>{
 const s=base();s.issues=[
 {id:'own',title:'Minha providência',project:'P1',responsibleId:'C1',due:'2026-11-10',priority:'Alta'},
 {id:'created',title:'Criada por mim',project:'P2',responsibleId:'C2',createdByEmail:user.email,due:today},
 {id:'multi',title:'Vários responsáveis',responsibleIds:['C1','C2']},
 {id:'other',title:'De outra pessoa',responsibleId:'C2'},
 {id:'closed',title:'Encerrada',responsibleId:'C1',status:'Resolvida'},
 {id:'stale',title:'ID explícito de outra pessoa',responsibleId:'C2',responsible:'Ramon Piffer'}];
 s.tasks=[{id:'task',title:'Tarefa',responsible:'Ramon Piffer',date:today},{id:'closedTask',responsible:'Ramon Piffer',status:'Concluída'}];
 s.boardTasks=[{id:'board',title:'Lousa',createdById:'U1',due:'2026-11-12'}];
 const m=build(s);assert.deepEqual(m.issues.map(r=>r.id),['own','created','multi']);
 assert.deepEqual(m.tasks.map(r=>r.id),['task','board']);assert.equal(m.name,'Ramon Piffer');
 assert.equal(m.summary.today,2);assert.equal(m.summary.overdue,1);assert.equal(m.issues[1].relationship,'Criada por você');
});
test('identificação exige usuário e respeita IDs, e-mail e nomes completos únicos',()=>{
 const s=base();s.responsibles.push({id:'C3',name:'Ramon Piffer',email:'homonimo@example.com'});
 s.tasks=[{id:'name',title:'Nome ambíguo',responsible:'Ramon Piffer'},{id:'short',responsible:'Ramon'},{id:'mail',responsibleEmail:'RAMON@example.com'},{id:'id',assigneeId:'U1'}];
 assert.deepEqual(build(s).tasks.map(r=>r.id).sort(),['id','mail']);
 assert.equal(build(s,null).tasks.length,0);assert.equal(build(s,null).summary.issues,0);
 assert.equal(build(s,{id:'unknown',email:'unknown@example.com'}).tasks.length,0);
 assert.equal(build(s,user,'all',{canRead:()=>false}).tasks.length,0);
 assert.equal(build(s,user,'all',{canRead:()=>false}).issues.length,0);
});
test('agenda pessoal mostra os próximos sete dias, eventos da equipe e sobreposições, sem compromissos de terceiros',()=>{
 const s=base();s.calendarEvents=[
 {id:'today',title:'Reunião pessoal',startDate:today,startTime:'10:00',participants:['C1']},
 {id:'team',title:'Equipe',startDate:'2026-11-17',allDay:true,participants:[]},
 {id:'ongoing',title:'Vários dias',startDate:'2026-11-09',endDate:'2026-11-12',participants:['U1']},
 {id:'other',title:'Outra pessoa',startDate:today,participants:['C2']},
 {id:'past',startDate:'2026-11-10',participants:[]},
 {id:'late',startDate:'2026-11-18',participants:[]},
 {id:'cancelled',startDate:today,participants:[],status:'Cancelado'}];
 const m=build(s);assert.deepEqual(m.events.map(r=>r.id),['ongoing','today','team']);
 assert.equal(m.events[0].date,today);assert.equal(m.events[2].shared,true);assert.equal(m.events[2].time,'Dia inteiro');
 assert.equal(m.summary.events,3);assert.equal(build(s,null).events.length,0);
 assert.equal(build(s,user,'all',{canRead:key=>key!=='sharedcalendar'}).events.length,0);
});
test('filtro mantém obra selecionada e itens gerais sem ler nem retornar valores financeiros',()=>{
 const s=base();for(const key of ['value','sale','cost','paid','received','balance'])Object.defineProperty(s.projects[0],key,{get(){throw Error('Leitura financeira: '+key)}});
 for(const key of ['costs','receipts','budgetItems','measurements','fixedExpenses'])Object.defineProperty(s,key,{get(){throw Error('Coleção financeira: '+key)}});
 s.issues=[{id:'p1',project:'P1',title:'Casa',responsibleId:'C1',amount:999999,paid:99},{id:'p2',project:'P2',title:'Galpão',responsibleId:'C1'},{id:'general',project:'Geral',title:'Geral',createdById:'U1'}];
 const m=build(s,user,'P1');assert.deepEqual(m.issues.map(r=>r.id),['p1','general']);
 assert.equal(m.issues[0].project,'OB-01 · Casa Jardim');assert.equal('amount' in m.issues[0],false);assert.equal('paid' in m.issues[0],false);
 assert.doesNotMatch(JSON.stringify(m),/999999|budgetItems|fixedExpenses|received/);
});
test('somente novas tarefas registram autoria sem reatribuir itens antigos nem alterar a base anterior',()=>{
 const old=base();old.tasks=[{id:'old',title:'Legada sem autor'}];old.boardTasks=[{id:'oldBoard',title:'Lousa antiga'}];
 const next=structuredClone(old);next.tasks.push({id:'new',title:'Nova tarefa'});next.boardTasks.push({id:'newBoard',title:'Nova na lousa'},{id:'existingAuthor',createdById:'U2'});
 const serialized=JSON.stringify(old);assert.equal(dashboard.prepare(old,next,user),next);
 assert.equal(next.tasks[1].createdById,'U1');assert.equal(next.boardTasks[1].createdByEmail,user.email);
 assert.equal(next.tasks[0].createdById,undefined);assert.equal(next.boardTasks[0].createdById,undefined);
 assert.equal(next.boardTasks[2].createdById,'U2');assert.equal(JSON.stringify(old),serialized);
 assert.deepEqual(build(next).tasks.map(r=>r.id).sort(),['new','newBoard']);
 const anonymous=base();anonymous.tasks=[{id:'anon'}];dashboard.prepare(base(),anonymous,null);assert.equal(anonymous.tasks[0].createdById,undefined);
});
