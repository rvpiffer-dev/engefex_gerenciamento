(function(root){'use strict';
const lowerWords=new Set(['da','das','de','do','dos','e']);
function nameCase(value){return String(value??'').trim().replace(/\s+/g,' ').toLocaleLowerCase('pt-BR').replace(/(^|[\s\-'])([\p{L}])/gu,(_,sep,ch)=>sep+ch.toLocaleUpperCase('pt-BR')).split(' ').map((part,i)=>i&&lowerWords.has(part.toLocaleLowerCase('pt-BR'))?part.toLocaleLowerCase('pt-BR'):part).join(' ');}
root.EngefexNameCase=nameCase;
})(window);
