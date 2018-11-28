"use strict";

let CACHE_NAME = 'static-cache';
let urlsToCache = [
  'index.html',
  'css/sequencerA.css',
  'js/sequencerA.indexedDB.js',
  'js/sequencerA.events.js'
];
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
    .then(function(cache) {
      return cache.addAll(urlsToCache);
    })
  );
});