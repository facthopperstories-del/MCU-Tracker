/* Sacred Timeline — offline support.
   Put this file next to index.html. Bump VERSION if you change this file. */
var VERSION = "st-v6-1";
var SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];

self.addEventListener("install", function(e){
  e.waitUntil(caches.open(VERSION).then(function(c){ return c.addAll(SHELL); }).then(function(){ return self.skipWaiting(); }));
});
self.addEventListener("activate", function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){ return k !== VERSION && k.indexOf("st-img") !== 0; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

function trim(cacheName, max){
  caches.open(cacheName).then(function(c){ c.keys().then(function(keys){ if(keys.length > max) keys.slice(0, keys.length - max).forEach(function(k){ c.delete(k); }); }); });
}

self.addEventListener("fetch", function(e){
  var req = e.request, url = new URL(req.url);
  if(req.method !== "GET") return;
  // Never cache API calls (TMDB search, GitHub sync)
  if(url.hostname === "api.themoviedb.org" || url.hostname === "api.github.com") return;

  // The app itself: network first (so updates arrive), cache when offline
  if(req.mode === "navigate" || (url.origin === location.origin && /\/(index\.html)?$/.test(url.pathname))){
    e.respondWith(
      fetch(req).then(function(res){ var copy = res.clone(); caches.open(VERSION).then(function(c){ c.put("./index.html", copy); }); return res; })
        .catch(function(){ return caches.match("./index.html"); })
    );
    return;
  }
  // Posters, backdrops, comic covers: cache first
  if(url.hostname === "image.tmdb.org" || url.hostname === "cdn.marvel.com"){
    e.respondWith(caches.open("st-img").then(function(c){
      return c.match(req).then(function(hit){
        return hit || fetch(req).then(function(res){ if(res.ok || res.type === "opaque"){ c.put(req, res.clone()); trim("st-img", 400); } return res; });
      });
    }));
    return;
  }
  // Fonts + same-origin files: cache, refresh in the background
  if(url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com" || url.origin === location.origin){
    e.respondWith(caches.open(VERSION).then(function(c){
      return c.match(req).then(function(hit){
        var net = fetch(req).then(function(res){ if(res.ok || res.type === "opaque") c.put(req, res.clone()); return res; }).catch(function(){ return hit; });
        return hit || net;
      });
    }));
  }
});
