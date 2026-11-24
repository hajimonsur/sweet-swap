/* Sweet Swap: release-scoped offline assets. Increment RELEASE for each deployment. */
const RELEASE = '2026-11-24-layered-board-1';
const CACHE = 'sweet-swap-' + RELEASE;
const root = self.registration.scope;
const asset = name => new URL(name, root).href;
const files = ['index.html','style.css','main.js','manifest.json','icon-192.png','icon-512.png','sweet-swap-theme.mp3','sweet-swap-theme-2.mp3'];
const urls = new Set(files.map(asset));
self.addEventListener('install', event => {
  // Install the complete release or keep the previous working release.
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(files.map(name => new Request(asset(name), {cache:'reload'})))));
  // No skipWaiting: never replace a worker in the middle of an active game.
});
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('sweet-swap-') && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});
async function audioRange(response, range) {
  const bytes = await response.arrayBuffer(), size = bytes.byteLength;
  const m = /^bytes=(\d*)-(\d*)$/.exec(range || '');
  const invalid = () => new Response(null,{status:416,headers:{'Content-Range':`bytes */${size}`,'Accept-Ranges':'bytes'}});
  if (!m || (!m[1] && !m[2]) || !size) return invalid();
  const start = m[1] ? Number(m[1]) : Math.max(0,size-Number(m[2]));
  const end = m[1] && m[2] ? Math.min(size-1,Number(m[2])) : size-1;
  if (!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=size||end<start) return invalid();
  return new Response(bytes.slice(start,end+1),{status:206,headers:{'Content-Type':response.headers.get('Content-Type')||'audio/mpeg','Content-Range':`bytes ${start}-${end}/${size}`,'Content-Length':String(end-start+1),'Accept-Ranges':'bytes'}});
}
self.addEventListener('fetch', event => {
  const req=event.request, url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(root))return;
  const navigation=req.mode==='navigate' && (url.pathname===new URL(root).pathname||url.pathname===new URL(asset('index.html')).pathname);
  if(!navigation&&!urls.has(url.href))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE), key=navigation?asset('index.html'):url.href;
    const hit=await cache.match(key);
    if(hit){ if(req.headers.has('range')&&url.pathname.endsWith('.mp3'))return audioRange(hit,req.headers.get('range'));return hit; }
    try{return await fetch(req);}catch{return new Response('Sweet Swap is offline. Connect once to install the game.',{status:503,headers:{'Content-Type':'text/plain'}});}
  })());
});
