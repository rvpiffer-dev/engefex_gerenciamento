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
 assert.match(index,/<script src="cloud\.js"><\/script><script src="app\.js"><\/script>/);
 assert.match(app,/if\(cloud\)cloud\.requireWrite\(\)/);
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
