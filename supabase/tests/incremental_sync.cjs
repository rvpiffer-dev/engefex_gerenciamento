// Executar com ENGEFEX_PGLITE_MODULE apontando para @electric-sql/pglite.
// PostgreSQL WASM local: não usa credenciais nem dados de produção.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const modulePath=process.env.ENGEFEX_PGLITE_MODULE;
test('PostgreSQL: patch transacional, revisão, autorização e compatibilidade com salvamento anterior',{skip:!modulePath},async()=>{
 const {PGlite}=require(modulePath),db=new PGlite(),w='11111111-1111-4111-8111-111111111111',u='22222222-2222-4222-8222-222222222222',other='33333333-3333-4333-8333-333333333333',folder=path.join(__dirname,'../migrations');
 try{
 await db.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated,anon;");
 let initial=fs.readFileSync(path.join(folder,'202610170001_shared_workspace.sql'),'utf8').split('-- Bucket privado:')[0]+'\ncommit;';
 await db.exec(initial);
 await db.exec(fs.readFileSync(path.join(folder,'202610190001_incremental_sync.sql'),'utf8'));
 // Reexecutar não remove a base.
 await db.exec(fs.readFileSync(path.join(folder,'202610190001_incremental_sync.sql'),'utf8'));
 let base={version:1,dataModel:2,projects:[{id:'p'}],activities:[{id:'a',executed:0},{id:'b',executed:2}],history:[{id:'h1'}]};
 await db.query('insert into auth.users values ($1),($2)',[u,other]);await db.query("insert into public.engefex_workspaces(id,name) values ($1,'Teste')",[w]);await db.query('insert into public.engefex_members values ($1,$2)',[w,u]);await db.query('insert into public.engefex_state(workspace_id,revision,payload) values ($1,1,$2::jsonb)',[w,JSON.stringify(base)]);
 await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[u]);
 const patch=(rev,ops)=>db.query('select * from public.engefex_patch_state($1,$2,$3::jsonb)',[w,rev,JSON.stringify(ops)]),read=async()=>(await db.query('select payload,revision from public.engefex_state')).rows[0];
 let out=await patch(1,[{key:'activities',start:0,deleteCount:1,items:[{id:'a',executed:5}]},{key:'history',start:0,deleteCount:0,items:[{id:'h2'}]}]);assert.equal(Number(out.rows[0].revision),2);
 let row=await read();assert.equal(row.payload.activities[0].executed,5);assert.deepEqual(row.payload.history,[{id:'h2'},{id:'h1'}]);assert.equal(row.payload.activities[1].executed,2);
 await assert.rejects(()=>patch(1,[{key:'activities',value:[]}]),/base mudou/);
 await assert.rejects(()=>patch(2,[{key:'extra',value:'início válido'},{key:'activities',start:99,deleteCount:1,items:[]}]),/Índices/);
 await assert.rejects(()=>patch(2,[{key:'dataModel',value:3}]),/Base de dados inválida/);assert.deepEqual(await read(),row);
 await assert.rejects(()=>patch(2,[{key:'activities',start:-1,deleteCount:0,items:[]}]),/lista inválida/);
 await assert.rejects(()=>patch(2,[{key:'__proto__',value:{}}]),/Campo/);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[other]);await assert.rejects(()=>patch(2,[]),/não autorizado/);
 await db.query("select set_config('request.jwt.claim.sub','',false)");await assert.rejects(()=>patch(2,[]),/não autorizado/);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[u]);
 await patch(2,[{key:'activities',start:1,deleteCount:1,items:[]},{key:'extra',value:{ok:true}}]);row=await read();assert.equal(row.payload.activities.length,1);
 row.payload.activities.push({id:'c'});out=await db.query('select * from public.engefex_save_state($1,$2,$3::jsonb)',[w,3,JSON.stringify(row.payload)]);assert.equal(Number(out.rows[0].revision),4);
 await patch(4,[{key:'extra',remove:true}]);assert.equal((await read()).payload.extra,undefined);
 await db.exec('set role anon');await assert.rejects(()=>patch(5,[]),/permission denied/);
 }finally{await db.close()}
});
