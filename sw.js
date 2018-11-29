"use strict";

let CACHE_NAME = 'static-cache';
let urlsToCache = [
  'index.html',
  'favicon.ico',
  'css/sequencerA.css',
  'js/sequencerA.indexedDB.js',
  'js/sequencerA.events.js'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
    .then(function(cache) {
      cache.add("https://cdn.jsdelivr.net/npm/howler@2.0.15/dist/howler.min.js");
      cache.add("https://cdn.jsdelivr.net/npm/sweetalert2@7.28.5/dist/sweetalert2.all.min.js");
      cache.add("https://cdn.jsdelivr.net/npm/jszip@3.1.5/dist/jszip.min.js");
      cache.add("https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js");
      cache.add("https://use.fontawesome.com/releases/v5.4.1/css/all.css");
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request).then(function(response) {
      return response || fetch(event.request);
    })
    .catch((error) => console.log(event.request,error)
    )
  );
});

self.addEventListener('activate', event => {
  console.log('Activating new service worker...');
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});