const CACHE="kostroma-evening-v2";
const CASE_ASSETS=[
  "portrait-kirill","portrait-marina","portrait-denis","portrait-alina","portrait-pavel","portrait-artem",
  "scene-studio","scene-restaurant","scene-bus","scene-train","scene-studio2",
  "scene-trophy","scene-coffee","scene-dog","scene-home"
].map(name=>"./assets/case/"+name+".webp");
const CORE=["./","./index.html","./manifest.webmanifest",...CASE_ASSETS];

self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()));
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())
  );
});

self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET")return;

  if(request.mode==="navigate"){
    event.respondWith(
      fetch(request).then(response=>{
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put("./index.html",copy)).catch(()=>{});
        return response;
      }).catch(()=>caches.match("./index.html"))
    );
    return;
  }

  if(request.destination==="image"){
    event.respondWith(
      caches.match(request).then(cached=>cached||fetch(request).then(response=>{
        if(response && (response.ok || response.type==="opaque")){
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put(request,copy)).catch(()=>{});
        }
        return response;
      }))
    );
    return;
  }

  if(new URL(request.url).origin===self.location.origin){
    event.respondWith(
      caches.match(request).then(cached=>cached||fetch(request).then(response=>{
        if(response&&response.ok){
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put(request,copy)).catch(()=>{});
        }
        return response;
      }))
    );
  }
});
