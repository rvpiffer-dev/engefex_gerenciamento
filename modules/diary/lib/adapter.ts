export const onlineURL='https://diario-de-obras-piffer.rapiffer.chatgpt.site';
export const bridge=(window.parent as any).EngefexDiaryBridge;
if(!bridge)throw Error('Abra o diário pela aba Diário de obra do gerenciador.');
export async function api(path:string,options?:RequestInit){if(path==='/api/records'){if(!options?.method)return bridge.list();const body=JSON.parse(String(options.body));if(options.method==='DELETE')return bridge.remove(body.kind,body.id,body.revision);return bridge.save(body)}if(path==='/api/photos'&&options?.body instanceof FormData)return bridge.upload(options.body.get('file'));throw Error('Operação indisponível.')}
export async function photoBytes(id:string){const f=await bridge.photo(id);return Uint8Array.from(atob(f.dataURL.split(',')[1]),c=>c.charCodeAt(0))}
export async function photoUrl(id:string){const f=await bridge.photo(id);const bytes=Uint8Array.from(atob(f.dataURL.split(',')[1]),c=>c.charCodeAt(0));return URL.createObjectURL(new Blob([bytes],{type:f.type||'image/jpeg'}))}
