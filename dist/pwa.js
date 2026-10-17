(()=>{
 'use strict';
 const label=document.getElementById('connectionStatus'),install=document.getElementById('installApp');
 let prompt=null;
 function status(){if(!label)return;label.textContent=navigator.onLine?'Aplicativo online':'Offline · registros neste aparelho';label.className=navigator.onLine?'tag':'tag amber'}
 function showHelp(){alert('Android: abra o menu do Chrome e procure “Instalar aplicativo” ou “Adicionar à tela inicial”.\n\niPhone/iPad: no Safari, use Compartilhar → Adicionar à Tela de Início.\n\nAbra o link com internet uma primeira vez. Depois que a preparação offline terminar, o aplicativo poderá abrir sem conexão. PDFs originais vinculados e links externos dependem dos arquivos ou da rede. Os dados não sincronizam entre aparelhos.');}
 if(install)install.addEventListener('click',async()=>{if(prompt){await prompt.prompt();await prompt.userChoice;prompt=null}else showHelp()});
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();prompt=e;});
 window.addEventListener('online',status);window.addEventListener('offline',status);status();
 if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1')){
  navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'}).then(registration=>{registration.update().catch(()=>{});let offered=false;const offer=()=>{if(offered||!navigator.serviceWorker.controller)return;offered=true;let notice=document.createElement('aside');notice.style.cssText='position:fixed;bottom:16px;left:16px;right:16px;z-index:9999;background:#203345;color:white;padding:16px;border-radius:12px';notice.setAttribute('role','status');notice.innerHTML='Atualização disponível. Salve o formulário aberto. <button type="button" style="margin-left:12px;padding:10px;cursor:pointer">Atualizar agora</button>';notice.querySelector('button').onclick=()=>location.href='./atualizar.html';document.body.appendChild(notice)};navigator.serviceWorker.addEventListener('controllerchange',offer);if(registration.waiting)offer();return navigator.serviceWorker.ready}).then(()=>{if(label){label.title='Arquivos do aplicativo preparados para uso offline. Exporte backups dos registros.';label.textContent=navigator.onLine?'Pronto para uso offline':'Offline · registros neste aparelho'}}).catch(()=>{if(label)label.textContent='Offline ainda não preparado. Abra novamente com internet.'});
 }else if(label)label.title='Instalação e modo offline exigem HTTPS ou o inicializador local. Ao abrir index.html diretamente, os arquivos já estão no computador.';
})();
