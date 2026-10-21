/* FinWay offline shell. Change VERSION when changing the offline asset set. */
'use strict';
const VERSION='finway-pwa-v1';
const BASE=self.registration.scope;
const CACHE=VERSION+'-'+new URL(BASE).pathname;
const HOME=new URL('./index.html',BASE).href;
const ASSETS=['./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./apple-touch-icon.png'].map(p=>new URL(p,BASE).href);
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
 // Keep the current session intact; new workers activate once old clients close.
});
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const key of await caches.keys())if(key.startsWith('finway-pwa-')&&key.endsWith('-'+new URL(BASE).pathname)&&key!==CACHE)await caches.delete(key);
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url),base=new URL(BASE);
 if(req.method!=='GET'||url.origin!==base.origin)return;
 const home=req.mode==='navigate'&&(url.pathname===base.pathname||url.pathname===new URL(HOME).pathname);
 if(home){
  const network=fetch(req).then(async response=>{
   if(!response.ok||!response.headers.get('content-type')?.includes('text/html'))throw Error('Unavailable');
   try{await (await caches.open(CACHE)).put(HOME,response.clone());}catch(e){}
   return response;
  });
  event.waitUntil(network.then(()=>{},()=>{}));
  event.respondWith((async()=>{
   let timer;try{return await Promise.race([network,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Timeout')),5000);})]);}
   catch(e){const cached=await caches.match(HOME,{cacheName:CACHE});if(cached)return cached;return new Response('FinWay: connect to the internet and reopen. / Подключись к интернету и открой FinWay снова.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});}
   finally{clearTimeout(timer);}
  })());return;
 }
 if(ASSETS.includes(url.href)&&url.href!==HOME)event.respondWith(caches.match(req,{cacheName:CACHE}).then(hit=>hit||fetch(req)));
 // Never intercept the AI endpoint, analytics, external links or other projects.
});
