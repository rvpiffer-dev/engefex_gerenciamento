const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('cliente cloud carrega sem depender de bibliotecas externas',()=>{
 const sandbox={window:{}};
 vm.createContext(sandbox);
 vm.runInContext(read('dist/cloud.js'),sandbox);
 const api=sandbox.window.EngefexCloud;
 assert.equal(typeof api.boot,'function');
 assert.equal(typeof api.send,'function');
 assert.equal(api.ready,false);
 assert.throws(()=>api.requireWrite(),/Aguarde a sincronização/);
});
test('cliente expõe apenas a chave publicável e a URL raiz do projeto',()=>{
 const source=read('dist/cloud.js');
 assert.match(source,/https:\/\/kxekeeysonrppechegsq\.supabase\.co/);
 assert.match(source,/sb_publishable_/);
 assert.doesNotMatch(source,/sb_secret_[A-Za-z0-9_-]{8,}/);
 assert.doesNotMatch(source,/service_role\s*[:=]\s*['"][^'"]+/);
 assert.doesNotMatch(source,/const URL_BASE=['"][^'"]+\/rest\/v1/);
});
test('a interface bloqueia gravações enquanto não houver conexão confirmada',()=>{
 const app=read('dist/app.js'),index=read('dist/index.html');
 assert.match(index,/<script src="cloud\.js(?:\?v=[^"]+)?"><\/script><script src="app\.js(?:\?v=[^"]+)?"><\/script>/);
 assert.match(app,/if\(cloud\)cloud\.requireWrite\(next\)/);
 assert.match(app,/cloud\.send\(next\)/);
 assert.match(app,/cloud\.boot\(/);
});
test('a política do banco exige vínculo e impede sobrescrever revisões antigas',()=>{
 const sql=read('supabase/migrations/202610170001_shared_workspace.sql');
 assert.match(sql,/enable row level security/);
 assert.match(sql,/engefex_members/);
 assert.match(sql,/auth\.uid\(\)/);
 assert.match(sql,/s\.revision=p_revision/);
 assert.match(sql,/storage\.objects for select to authenticated/);
});


async function onlineBoot(payload,updateGate=null){const elements=new Map(),panels=['login','loading','error'].map(cloudPanel=>({dataset:{cloudPanel},hidden:false})),requests=[],accepted=[],local=new Map([['engefex-cloud-auth-v1',JSON.stringify({access_token:'test-token',refresh_token:'test-refresh',expires_at:Date.now()+3600000,user:{id:'u',email:'user@example.com'}})],['engefex-gerenciamento-v2',JSON.stringify({projects:[{id:'local'}]})]]);const element=()=>({innerHTML:'',textContent:'',hidden:false,style:{},dataset:{},setAttribute(){},append(){},addEventListener(name,fn){this[name]=fn},querySelectorAll(){return panels}}),el=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id)},document={createElement:element,getElementById:el,querySelector:()=>null,documentElement:{classList:{toggle(){}}},head:{append(){}},body:{append(){}}},root={...(updateGate?{EngefexUpdateGate:updateGate}:{}),Obras:{backupValid:s=>{if(!s||!Array.isArray(s.projects))throw Error('Base inválida')}},LocalFiles:{load:async()=>[],put:async()=>{},refs:()=>[]},addEventListener(){}};const sandbox={window:root,document,navigator:{onLine:true},localStorage:{getItem:k=>local.get(k)||null,setItem(){let e=new Error('quota exceeded');e.name='QuotaExceededError';throw e},removeItem:k=>local.delete(k)},AbortController,setTimeout:()=>1,clearTimeout(){},setInterval(){},fetch:async(url,options)=>{requests.push({url,method:options.method});let response=url.includes('engefex_members')?[{workspace_id:'work'}]:[{payload,revision:5}];return {ok:true,text:async()=>JSON.stringify(response)}}};vm.createContext(sandbox);vm.runInContext(read('dist/cloud.js'),sandbox);root.EngefexCloud.boot({getState:()=>({projects:[{id:'local'}]}),acceptState:s=>accepted.push(s),isDirty:()=>false,identityChanged(){}});await new Promise(resolve=>setImmediate(resolve));return {api:root.EngefexCloud,accepted,requests,el,local}}
test('login carrega diretamente a base online mesmo com dados locais diferentes e quota cheia',async()=>{let payload={projects:[{id:'online'}]},h=await onlineBoot(payload);assert.equal(h.api.ready,true);assert.equal(h.accepted.length,1);assert.equal(h.accepted[0].projects[0].id,'online');assert.equal(h.requests.length,2);assert.ok(h.requests.every(r=>r.method==='GET'));assert.doesNotMatch(h.el('engefex-cloud-cover').innerHTML,/Usar meus registros locais|Começar base online vazia|Abrir base online existente|data-cloud-panel="setup"/)});
test('banco online vazio bloqueia acesso sem importar dados locais nem criar outra base',async()=>{let h=await onlineBoot(null);assert.equal(h.api.ready,false);assert.equal(h.accepted.length,0);assert.match(h.el('engefex-cloud-message').textContent,/base online ainda não foi inicializada/);assert.ok(h.requests.every(r=>r.method==='GET'))});
test('login aguarda checagem automática da versão antes de buscar a base',async()=>{let release,gate=new Promise(resolve=>release=resolve),h=await onlineBoot({projects:[]},gate);assert.equal(h.requests.length,0);release(true);await new Promise(resolve=>setImmediate(resolve));assert.equal(h.api.ready,true);assert.equal(h.accepted.length,1)});
test('login não carrega a base quando a atualização vai redirecionar a interface',async()=>{let h=await onlineBoot({projects:[]},Promise.resolve(false));assert.equal(h.requests.length,0);assert.equal(h.api.ready,false)});
