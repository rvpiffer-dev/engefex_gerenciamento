(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const screen=$('screen'), frame=$('connection'), status=$('status');
 const sessionKey=EngefexEnvironment.storageKey('engefex-cloud-auth-v1');
 const dbName=EngefexEnvironment.storageKey('engefex-visitas-v1');
 const checks=Obras.visitChecks;
 const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 let catalog, draft, connectionStarted=false, synchronizing=false, photoBusy=false, savedVersion=0;
 let writes=Promise.resolve(), lastError='', prepared=false;
 const database=new Promise((resolve,reject)=>{
  const request=indexedDB.open(dbName,1);
  request.onupgradeneeded=()=>request.result.createObjectStore('entries',{keyPath:'key'});
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(Error('Armazenamento do aparelho indisponível.'));
 });
 async function store(mode,action){
  const db=await database;
  return new Promise((resolve,reject)=>{
   const transaction=db.transaction('entries',mode), request=action(transaction.objectStore('entries'));
   transaction.oncomplete=()=>resolve(request.result);
   transaction.onerror=transaction.onabort=()=>reject(Error('Não foi possível acessar as visitas no aparelho.'));
  });
 }
 const get=key=>store('readonly',entries=>entries.get(key));
 const put=value=>store('readwrite',entries=>entries.put(value));
 const entries=()=>store('readonly',entries=>entries.getAll());
 const user=()=>{
  try{return JSON.parse(localStorage.getItem(sessionKey)||'null')?.user?.id}catch{return null}
 };
 const scope=()=>catalog.user+':'+catalog.workspace;
 const owns=row=>catalog&&row.scope===scope();
 const available=()=>catalog&&catalog.user===user();
 const fail=error=>{status.textContent=error.message||String(error)};
 function bridge(){try{return frame.contentWindow?.EngefexVisitBridge}catch{return null}}
 function connect(){
  if(!navigator.onLine||connectionStarted)return;
  connectionStarted=true;
  frame.hidden=!!available();
  frame.src='../index.html?visitas-app=1#visitreports';
 }
 function option(id,name,selected){return '<option value="'+escape(id)+'" '+(id===selected?'selected':'')+'>'+escape(name)+'</option>'}
 function updateStatus(message){status.textContent=message}
 function saveDraft(){
  if(!available()||!draft)return Promise.reject(Error('Entre com a mesma conta para acessar esta visita.'));
  const snapshot=structuredClone(draft), version=++savedVersion;
  writes=writes.catch(()=>{}).then(()=>put(snapshot));
  writes.then(()=>{
   if(version===savedVersion&&draft?.key===snapshot.key)updateStatus('Salvo no aparelho');
  },fail);
  return writes;
 }
 async function list(){
  const version=++savedVersion;
  draft=null;
  if(!available()){
   screen.innerHTML='<section><h1>Prepare seu app de visitas</h1><p>Entre com sua conta Engefex com internet para carregar as obras e os responsáveis.</p><button id="connect" class="primary">Entrar no Engefex</button></section>';
   $('connect').onclick=()=>{
    if(!navigator.onLine)return updateStatus('Conecte-se à internet para preparar o app.');
    connect();frame.hidden=false;
   };
   return;
  }
  const rows=(await entries()).filter(owns).sort((a,b)=>b.created-a.created);
  if(version!==savedVersion||!available())return;
  screen.innerHTML='<section><h1>Visitas de obra</h1><button id="new" class="primary">Nova visita</button> <button id="account">Conta e conexão</button></section>'+
   rows.map(row=>{
    const name=catalog.projects.find(project=>project.id===row.record.project)?.name||'Visita de obra';
    const text={draft:'Em andamento',queued:'Aguardando sincronização',sent:'Sincronizada'}[row.phase];
    return '<article><strong>'+escape(name)+'</strong><p>'+escape(row.record.date)+' · '+text+'</p>'+
     (row.phase==='draft'?'<button data-resume="'+escape(row.key)+'">Retomar visita</button>':'')+'</article>';
   }).join('');
  updateStatus(lastError||(prepared?'Pronto para usar sem internet':'Dados carregados neste aparelho')+(navigator.onLine?'':' · Sem conexão'));
  $('account').onclick=()=>{connect();frame.hidden=!frame.hidden};
  $('new').onclick=async()=>{
   if($('new').disabled)return;
   $('new').disabled=true;
   try{
    const id='visit-offline-'+crypto.randomUUID();
    draft={key:scope()+':'+id,scope:scope(),created:Date.now(),phase:'draft',step:0,
     record:{id,project:'',date:Obras.today(),itemPhotos:{},...Object.fromEntries(checks.flatMap(([key])=>[[key,false],[key+'Note','']]))}};
    await saveDraft();renderCard();
   }catch(error){fail(error);if($('new'))$('new').disabled=false}
  };
  for(const button of screen.querySelectorAll('[data-resume]'))button.onclick=async()=>{
   const row=await get(button.dataset.resume);
   if(row?.phase==='draft'&&owns(row)&&available()){draft=row;renderCard()}
  };
 }
 function renderCard(){
  if(!available()||!draft)return;
  const {record,step}=draft, check=checks[step-1];
  const end=step===checks.length+1;
  const field=(key,label,markup)=>'<label for="visit-'+key+'">'+label+'</label>'+markup.replace('data-field=','id="visit-'+key+'" data-field=');
  const input=(key,type='text')=>'<input data-field="'+key+'" type="'+type+'" value="'+escape(record[key])+'">';
  const area=key=>'<textarea data-field="'+key+'">'+escape(record[key])+'</textarea>';
  let content;
  if(step===0){
   content='<h1>Dados da visita</h1>'+
    field('project','Obra','<select data-field="project">'+option('','Selecionar obra',record.project)+catalog.projects.map(p=>option(p.id,[p.code,p.name].filter(Boolean).join(' · '),record.project)).join('')+'</select>')+
    field('date','Data da visita',input('date','date'))+field('visitor','Responsável pela visita',input('visitor'))+field('subject','Etapa / local',input('subject'));
  }else if(end){
   content='<h1>Revisão da visita</h1><p>'+checks.filter(([key])=>record[key]).length+' de '+checks.length+' itens conferidos</p>'+
    field('observations','Observações gerais',area('observations'))+field('actions','Encaminhamentos gerais',area('actions'));
  }else{
   const [key,label,group]=check, photos=record.itemPhotos[key]?.photos||[];
   content='<div class="hero"><small>'+escape(group)+' · '+step+' de '+checks.length+'</small><h2>'+escape(label)+'</h2>'+
    '<label><input type="checkbox" data-field="'+key+'" '+(record[key]?'checked':'')+'>Conferido</label></div>'+
    '<details><summary>Comentário'+(record[key+'Note']?' · Registrado':'')+'</summary>'+field(key+'Note','Observação',area(key+'Note'))+'</details>'+
    '<details '+(photos.length?'open':'')+'><summary>Fotos'+(photos.length?' · '+photos.length:'')+'</summary><label>Adicionar fotos<input id="photo" type="file" accept="image/*" multiple></label><div id="photos"></div></details>'+
    (catalog.canAssign?'<details><summary>Responsável</summary>'+field(key+'Action','O que falta fazer',area(key+'Action'))+
     field(key+'Owner','Responsável','<select data-field="'+key+'Owner">'+option('','Selecionar',record[key+'Owner'])+
      catalog.responsibles.map(person=>option(person.id,person.name,record[key+'Owner'])).join('')+'</select>')+'</details>':'');
  }
  screen.innerHTML='<section>'+content+'<nav><button id="back" '+(step?'':'disabled')+'>Voltar</button><button id="leave">Sair da visita</button><button class="primary" id="next">'+(end?'Concluir visita':'Avançar')+'</button></nav></section>';
  for(const el of screen.querySelectorAll('[data-field]'))el.oninput=()=>{
   if(!available())return;
   record[el.dataset.field]=el.type==='checkbox'?el.checked:el.value;
   saveDraft().catch(()=>{});
  };
  async function navigate(next){
   if(photoBusy)return;
   draft.step=next;await saveDraft();renderCard();
  }
  $('back').onclick=()=>navigate(step-1).catch(fail);
  $('leave').onclick=async()=>{if(!photoBusy)try{await saveDraft();await list()}catch(error){fail(error)}};
  $('next').onclick=async()=>{
   if(photoBusy||$('next').disabled||!available())return;
   $('next').disabled=true;
   try{
    if(step===0&&(!catalog.projects.some(p=>p.id===record.project)||!record.date||!record.visitor?.trim()))
     throw Error('Informe obra, data e responsável pela visita.');
    if(check){
     const [key]=check;
     if(!!record[key+'Action']?.trim()!==!!record[key+'Owner']){
      screen.querySelector('details:last-of-type').open=true;
      throw Error('Informe o que falta fazer e o responsável.');
     }
    }
    if(!end)return await navigate(step+1);
    for(const [key] of checks){
     if(record[key+'Action']!==undefined)record[key+'Action']=record[key+'Action'].trim();
     if(!!record[key+'Action']!==!!record[key+'Owner'])throw Error('Revise as providências antes de concluir.');
    }
    Obras.validateRecord({projects:catalog.projects},'visitReports',record);
    draft.phase='queued';
    try{await saveDraft()}catch(error){draft.phase='draft';throw error}
    await list();updateStatus('Visita salva no aparelho. O envio será automático.');
    synchronize();
   }catch(error){fail(error);if($('next'))$('next').disabled=false}
  };
  if(check)attachPhotos(check[0],record);
 }
 async function attachPhotos(key,record){
  const input=$('photo'), container=$('photos'), photos=record.itemPhotos[key]?.photos||[];
  input.onchange=async()=>{
   if(photoBusy||!available())return;
   photoBusy=true;input.disabled=true;
   updateStatus('Preparando fotos…');
   try{
    const files=[];
    for(const file of input.files){
     if(!file.type.startsWith('image/'))throw Error('Escolha um arquivo de imagem.');
     files.push(await LocalFiles.prepare(file,{optimizeImage:true}));
    }
    await LocalFiles.put(files);
    record.itemPhotos[key]={photos:photos.concat(files.map(({dataURL,...metadata})=>metadata))};
    await saveDraft();renderCard();
   }catch(error){fail(error)}finally{photoBusy=false;input.disabled=false}
  };
  for(const photo of photos){
   const figure=document.createElement('figure');
   try{
    const [file]=await LocalFiles.load([photo.id]);
    const image=document.createElement('img');
    image.src=file.dataURL;image.alt=photo.name;figure.append(image);
   }catch(error){figure.textContent=error.message}
   const remove=document.createElement('button');
   remove.textContent='Retirar foto';remove.onclick=async()=>{
    if(photoBusy||!available())return;
    record.itemPhotos[key]={photos:photos.filter(item=>item.id!==photo.id)};
    try{await saveDraft();renderCard()}catch(error){fail(error)}
   };
   figure.append(remove);container.append(figure);
  }
 }
 async function synchronize(){
  if(synchronizing||!navigator.onLine||!available())return;
  const online=bridge(), current=online?.catalog();
  if(!current||current.user!==catalog.user||current.workspace!==catalog.workspace)return;
  synchronizing=true;
  try{
   const rows=(await entries()).filter(row=>owns(row)&&row.phase==='queued');
   if(!rows.length)return;
   for(const row of rows){
    updateStatus('Enviando visita ao gerenciador…');
    await online.send({user:current.user,workspace:current.workspace},row.record);
    await put({...row,phase:'sent'});
   }
   lastError='';
   if(!draft)await list();
   updateStatus('Visitas sincronizadas');
  }catch(error){
   lastError='Visita guardada. Envio pendente: '+error.message;
   fail(lastError);
  }finally{synchronizing=false}
 }
 async function refresh(){
  const remote=bridge()?.catalog();
  if(remote&&remote.user===user()&&remote.workspace){
   const changed=JSON.stringify(catalog)!==JSON.stringify(remote);
   if(changed){
    const sameAccount=available()&&catalog.workspace===remote.workspace;
    await put({key:'catalog:'+remote.user,data:remote});
    catalog=remote;frame.hidden=true;
    if(!draft||!sameAccount)await list();
   }
  }
  if(!available()&&(draft||$('new')))await list();
  await synchronize();
 }
 window.addEventListener('online',()=>{connectionStarted=false;connect()});
 window.addEventListener('offline',()=>{frame.hidden=true;if(!draft)list().catch(fail)});
 window.addEventListener('storage',event=>{if(event.key===sessionKey&&!available())list().catch(fail)});
 let installPrompt;
 const install=$('install');
 install.hidden=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
 install.onclick=async()=>{
  if(!installPrompt){
   updateStatus('No iPhone, use Safari → Compartilhar → Adicionar à Tela de Início. No Android, use o menu do Chrome → Instalar aplicativo.');
   return;
  }
  await installPrompt.prompt();
  installPrompt=null;
 };
 window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();installPrompt=event;
 });
 window.addEventListener('appinstalled',()=>{install.hidden=true});
 async function start(){
  catalog=(await get('catalog:'+user()))?.data;
  await list();connect();
  if('serviceWorker' in navigator){
   await navigator.serviceWorker.register('./sw.js');
   prepared=!!(await navigator.serviceWorker.ready).active;
   if(!draft&&available())await list();
  }
 }
 setInterval(()=>refresh().catch(fail),4000);
 start().catch(fail);
})();
