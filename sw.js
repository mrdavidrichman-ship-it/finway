/* FinWay PWA v5.6: offline shell + system Web Push. */
'use strict';
const VERSION='finway-pwa-v2';
const BASE=self.registration.scope;
const CACHE=VERSION+'-'+new URL(BASE).pathname;
const HOME=new URL('./index.html',BASE).href;
const ASSETS=['./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./apple-touch-icon.png'].map(p=>new URL(p,BASE).href);
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await cache.addAll(ASSETS);
    // New push listener must become active without requiring the user to restart the PWA.
    await self.skipWaiting();
  })());
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
      let timer;
      try{return await Promise.race([network,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Timeout')),5000);})]);}
      catch(e){const cached=await caches.match(HOME,{cacheName:CACHE});if(cached)return cached;return new Response('FinWay: connect to the internet and reopen. / Подключись к интернету и открой FinWay снова.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});}
      finally{clearTimeout(timer);}
    })());return;
  }
  if(ASSETS.includes(url.href)&&url.href!==HOME)event.respondWith(caches.match(req,{cacheName:CACHE}).then(hit=>hit||fetch(req)));
});

self.addEventListener('push',event=>{
  // iOS requires a visible notification for every received push event.
  event.waitUntil((async()=>{
    let data={};
    try{data=event.data?event.data.json():{};}catch(_){data={body:event.data?.text()||''};}
    const title=typeof data.title==='string'?data.title.slice(0,100):'FinWay 🔔';
    const body=typeof data.body==='string'?data.body.slice(0,240):'Открой FinWay и продолжай свой путь.';
    let destination=new URL('./',BASE);
    try{const candidate=new URL(data.url||'./',BASE);if(candidate.origin===destination.origin&&candidate.pathname.startsWith(new URL(BASE).pathname))destination=candidate;}catch(_){}
    await self.registration.showNotification(title,{
      body,icon:new URL('./icon-192.png',BASE).href,
      badge:new URL('./icon-192.png',BASE).href,
      tag:typeof data.tag==='string'?data.tag.slice(0,100):'finway-reminder',
      data:{url:destination.href},
    });
  })());
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    let url=new URL('./',BASE).href;
    try{const u=new URL(event.notification.data?.url||'./',BASE);if(u.origin===self.location.origin&&u.pathname.startsWith(new URL(BASE).pathname))url=u.href;}catch(_){}
    const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of clients){if(client.url.startsWith(new URL(BASE).origin+new URL(BASE).pathname)){await client.focus();if(client.navigate&&client.url!==url)await client.navigate(url);return;}}
    if(self.clients.openWindow)await self.clients.openWindow(url);
  })());
});
