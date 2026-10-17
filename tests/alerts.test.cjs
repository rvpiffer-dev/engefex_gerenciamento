const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const alerts=require('../dist/alerts.js');
const actor={id:'U1',email:'engenheiro@engefex.com.br'};
const buyer={id:'U2',email:'compras@engefex.com.br'};
const outsider={id:'U3',email:'outro@engefex.com.br'};
const base=()=>({
 issues:[],notifications:[],responsibles:[{id:'C1',name:'Compras',email:'COMPRAS@engefex.com.br',phone:'(19) 99999-1111'}]
});
test('criar pendência atribui autoria e notifica apenas o destinatário da atribuição',()=>{
 let old=base(),next=JSON.parse(JSON.stringify(old));
 next.issues.push({id:'I1',title:'Comprar telhas',project:'OB1',responsibleId:'C1',status:'Aberta',priority:'Alta',due:'2026-10-22'});
 alerts.prepare(old,next,actor);
 assert.equal(next.issues[0].createdByEmail,actor.email);
 assert.equal(next.issues[0].responsible,'Compras');
 assert.equal(next.notifications.length,1);
 assert.equal(alerts.inbox(next,buyer).length,1);
 assert.equal(alerts.inbox(next,outsider).length,0);
 assert.equal(alerts.personal(next,actor).length,1);
 assert.equal(alerts.personal(next,buyer).length,1);
 assert.equal(alerts.personal(next,outsider).length,0);
});
test('o sininho mantém as notificações após leitura, com controle por login',()=>{
 let old=base(),next=JSON.parse(JSON.stringify(old));
 next.issues.push({id:'I1',title:'Comprar telhas',project:'OB1',responsibleId:'C1',status:'Aberta'});
 alerts.prepare(old,next,actor);
 const id=next.notifications[0].id;
 assert.equal(alerts.unread(next,buyer).length,1);
 const read=alerts.read(next,id,buyer);
 assert.equal(alerts.unread(read,buyer).length,0);
 assert.equal(alerts.inbox(read,buyer).length,1);
 assert.throws(()=>alerts.read(next,id,outsider),/não encontrada/);
});
test('editar sem trocar responsável não dispara avisos duplicados',()=>{
 let old=base(),next=JSON.parse(JSON.stringify(old));
 next.issues=[{id:'I1',title:'Comprar telhas',project:'OB1',responsibleId:'C1',status:'Aberta',createdByEmail:actor.email}];
 const after=JSON.parse(JSON.stringify(next));
 after.issues[0].title='Comprar telhas azuis';
 alerts.prepare(next,after,actor);
 assert.equal(after.notifications.length,0);
});
test('atualização da situação avisa o engenheiro lançador e o comprador',()=>{
 let old=base();old.issues=[{id:'I1',title:'Comprar telhas',project:'OB1',responsibleId:'C1',status:'Aberta',createdByEmail:actor.email}];
 const next=JSON.parse(JSON.stringify(old));next.issues[0].status='Em tratamento';
 alerts.prepare(old,next,buyer);
 assert.equal(alerts.inbox(next,actor).length,1);
 assert.equal(alerts.inbox(next,buyer).length,1);
 assert.equal(alerts.inbox(next,outsider).length,0);
});
test('o filtro pessoal mantém autor e designado, mas não pendências de terceiros',()=>{
 const s=base();s.issues=[
  {id:'I1',title:'Comprar telhas',project:'OB1',responsibleId:'C1',createdByEmail:actor.email},
  {id:'I2',title:'Obra alheia',project:'OB2',responsibleId:'C2',createdByEmail:'outro@engefex.com.br'}];
 assert.deepEqual(alerts.personal(s,actor).map(x=>x.id),['I1']);
 assert.deepEqual(alerts.personal(s,buyer).map(x=>x.id),['I1']);
 assert.deepEqual(alerts.personal(s,outsider).map(x=>x.id),['I2']);
 assert.deepEqual(alerts.personal(s,actor,'OB2'),[]);
});
test('o aplicativo oferece o sininho, cadastro e escopo pessoal no dashboard',()=>{
 const app=fs.readFileSync(path.join(__dirname,'../dist/app.js'),'utf8');
 const html=fs.readFileSync(path.join(__dirname,'../dist/index.html'),'utf8');
 assert.match(html,/id="alertsBell"/);
 assert.match(html,/id="alertsPanel"/);
 assert.match(html,/alerts\.js/);
 assert.match(app,/personalIssues\(\)\.filter\(x=>x.status!=='Resolvida'\)/);
 assert.match(app,/function responsibles\(\)/);
 assert.match(app,/E\.prepare\(state,E\.ensure\(next\),cloud\?\.currentUser\)/);
});
