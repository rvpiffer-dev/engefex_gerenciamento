const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const source=fs.readFileSync(path.join(__dirname,'../dist/cloud.js'),'utf8');
function harness(fetch,immediateTimeout=false){
  const elements=new Map(),panels=['login','loading','setup','error'].map(name=>({dataset:{cloudPanel:name},hidden:name!=='login'}));
  function el(id){if(!elements.has(id))elements.set(id,{id,hidden:false,textContent:'',value:'',disabled:false,style:{},setAttribute(){},addEventListener(name,fn){this['on'+name]=fn}});return elements.get(id)}
  const cover={hidden:false,querySelectorAll:()=>panels,setAttribute(){},innerHTML:''};
  const local=new Map();let locked=true,accepted=0;
  const document={
    body:{append(node){if(node.id==='engefex-cloud-cover')elements.set('engefex-cloud-cover',cover)}},
    head:{append(){}},
    documentElement:{classList:{toggle(name,value){locked=value}}},
    createElement(tag){if(tag==='div'&&!elements.has('engefex-cloud-cover'))return cover;return {id:'',textContent:'',innerHTML:'',append(){},setAttribute(){}}},
    querySelector(){return {append(){}}},
    getElementById:el,
    hidden:false
  };
  const seed={version:1,dataModel:2,projects:[],stages:[],activities:[]};
  const root={document,navigator:{onLine:true},localStorage:{getItem:key=>local.get(key)||null,setItem:(key,value)=>local.set(key,value),removeItem:key=>local.delete(key)},AbortController,
    setTimeout:immediateTimeout?(fn)=>{queueMicrotask(fn);return 1}:setTimeout,clearTimeout:immediateTimeout?()=>{}:clearTimeout,
    setInterval:()=>1,addEventListener(){},confirm:()=>true,fetch,
    EngefexManager:{separate:x=>x},Obras:{clone:x=>JSON.parse(JSON.stringify(x)),backupValid:()=>{}},OBRAS_SEED:seed,
    LocalFiles:{refs:()=>[],load:async()=>[],put:async()=>{}}
  };
  root.window=root;
  vm.createContext(root);
  vm.runInContext(source,root);
  root.EngefexCloud.boot({getState:()=>seed,acceptState(){accepted++},isDirty:()=>false,saved(){}});
  const form=el('engefex-cloud-login');
  el('engefex-cloud-email').value='teste@empresa.com';
  el('engefex-cloud-password').value='senha-de-teste';
  async function login(){const button={disabled:false};await form.onsubmit({preventDefault(){},submitter:button});return button}
  return {root,el,cover,panels,login,get locked(){return locked},get accepted(){return accepted}};
}
test('se Supabase não responder, o bloqueio termina com aviso claro e login recuperável',async()=>{
  const fetch=(url,options)=>new Promise((resolve,reject)=>{
    options.signal.addEventListener('abort',()=>reject(Object.assign(new Error('abortado'),{name:'AbortError'})),{once:true});
  });
  const h=harness(fetch,true);
  await h.login();
  assert.equal(h.root.EngefexCloud.ready,false);
  assert.equal(h.cover.hidden,false);
  assert.match(h.el('engefex-cloud-message').textContent,/20 segundos/);
  assert.equal(h.panels.find(p=>p.dataset.cloudPanel==='login').hidden,false);
});
test('login libera interface após carregar base online existente, sem inicialização pelo aparelho',async()=>{
  const seen=[];
  const fetch=async(url,options)=>{
    seen.push({url,method:options.method||'GET'});
    let data;
    if(url.includes('/auth/v1/token?'))data={access_token:'teste',refresh_token:'teste',expires_in:3600,user:{id:'u1',email:'teste@empresa.com'}};
    else if(url.includes('engefex_members?'))data=[{workspace_id:'e0cc3a76-0f33-4a07-8acf-c52a74e5de39'}];
    else if(url.includes('engefex_state?'))data=[{revision:1,payload:{version:1,projects:[{id:'online'}]}}];
    else if(url.includes('/rpc/engefex_save_state'))data=[{revision:1}];
    else throw Error('Rota inesperada: '+url);
    return {ok:true,text:async()=>JSON.stringify(data)};
  };
  const h=harness(fetch);
  await h.login();
  assert.equal(h.root.EngefexCloud.ready,true);
  assert.equal(h.cover.hidden,true);
  assert.equal(h.locked,false);
  assert.equal(h.accepted,1);
  assert.equal(seen.some(x=>x.url.includes('/rpc/engefex_save_state')),false);
});

