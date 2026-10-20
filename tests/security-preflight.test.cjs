'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=filename=>fs.readFileSync(path.join(root,filename),'utf8');
test('arquivos principais de acesso devem ser JavaScript válido',()=>{
 for(const file of ['dist/access.js','dist/cloud.js','dist/nextar-stock.js'])
   assert.doesNotThrow(()=>new Function(read(file)),file);
});
test('versões do Gerenciador devem coincidir para evitar telas desatualizadas',()=>{
 const version=JSON.parse(read('dist/version.json')).version;
 const page=read('dist/index.html'),autoupdate=read('dist/auto-update.js');
 for(const filename of ['cloud.js','app.js','nextar-stock.js'])
   assert.ok(page.includes(filename+'?v='+version),filename+' com versão divergente');
 assert.ok(autoupdate.includes("BUILD_VERSION='"+version+"'"),'auto-update desatualizado');
});
test('produção e testes devem manter Supabase isolado',()=>{
 const json=JSON.parse(read('deployment/environments.json'));
 assert.notEqual(json.production.url,json.test.url);
 assert.notEqual(json.production.key,json.test.key);
 assert.ok(json.production.key.startsWith('sb_publishable_'));
 assert.ok(json.test.key.startsWith('sb_publishable_'));
 assert.match(read('scripts/build-environments.cjs'),/config\.production\.url===config\.test\.url/);
});
test('código público não pode conter segredos Supabase ou chaves privadas',()=>{
 const rootDir=path.join(root,'dist');
 const pending=[rootDir],violations=[];
 while(pending.length){
  const current=pending.pop();
  for(const dirent of fs.readdirSync(current,{withFileTypes:true})){
   const item=path.join(current,dirent.name);
   if(dirent.isDirectory()){pending.push(item);continue;}
   if(!dirent.isFile())continue;
   const rel=path.relative(rootDir,item);
   if(/\.(?:env|pem|p12|pfx|key|sqlite|db|bak|zip)$/i.test(dirent.name))violations.push('Arquivo potencialmente sensível: '+rel);
   if(!/\.(?:js|json|html|css|txt)$/i.test(dirent.name))continue;
   const source=fs.readFileSync(item,'utf8');
   if(/sb_secret_[A-Za-z0-9_-]{10,}/.test(source))violations.push('Supabase secret key: '+rel);
   if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(source))violations.push('Chave privada: '+rel);
  }
 }
 assert.deepEqual(violations,[]);
});
test('interface exige permissão de edição e conexão para alterações',()=>{
 const cloud=read('dist/cloud.js'),access=read('dist/access.js');
 assert.match(cloud,/function requireWrite\(/);
 assert.match(cloud,/navigator\.onLine/);
 assert.match(cloud,/EngefexAccess\.canWrite/);
 assert.match(access,/function level\(/);
 assert.match(access,/function allowRead\(/);
 assert.match(access,/function apply\(/);
});
test('estoque Nextar não publica dados fora da API autenticada',()=>{
 const source=read('dist/cloud.js');
 assert.match(source,/async publishNextar\(snapshot\)/);
 assert.match(source,/rpc\/engefex_nextar_publish/);
 assert.match(source,/async loadNextar\(\)/);
});
