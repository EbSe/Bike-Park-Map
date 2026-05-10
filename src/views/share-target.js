// Handles incoming shared files from iOS share sheet.
// The Service Worker accepts the POST and stores files in CacheStorage,
// then redirects to /?share=1 so this handler can pick them up.

import * as db from '../lib/db.js';
import * as store from '../lib/store.js';
import { parseTrackFile } from '../lib/gpx.js';
import { haversineKm } from '../lib/geo.js';
import { showToast } from './toast.js';

export async function handleShareTarget() {
  if (!('caches' in self)) {
    showToast('Share-Target nicht unterstützt', 'warn');
    return;
  }
  try {
    const cache = await caches.open('share-target');
    const tracks = await cache.match('shared-track');
    const media = await cache.match('shared-media');

    if (tracks) {
      const blob = await tracks.blob();
      const file = new File([blob], (await cache.match('shared-track-name'))?.text() || 'track.gpx', { type: blob.type });
      const track = await parseTrackFile(file);
      // Find nearest park within 5 km
      const start = track.points[0];
      let closest = null;
      let bestDist = Infinity;
      for (const p of store.getState().parks) {
        const d = haversineKm({ lat: start.lat, lon: start.lon }, p);
        if (d < bestDist) { bestDist = d; closest = p; }
      }
      if (closest && bestDist < 5) {
        track.parkId = closest.id;
        track.attachedToSession = true;
        const saved = await db.addTrack(track);
        await db.addSession(closest.id, {
          date: start.time ? new Date(start.time).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
          source: track.source,
          trackId: saved.id,
          stats: track.stats,
        });
        showToast(`Track ${closest.name} zugeordnet (${(track.stats.distance_m / 1000).toFixed(1)} km)`);
      } else {
        await db.addTrack(track);
        showToast('Track gespeichert (keinem Park zugeordnet)');
      }
      await cache.delete('shared-track');
      await cache.delete('shared-track-name');
      await store.refreshUserData();
    }

    if (media) {
      // No park context for shared media – attach to a "general" pseudo-park or instruct user.
      showToast('Geteiltes Medium: bitte einen Park öffnen und dort hochladen', 'warn');
      await cache.delete('shared-media');
    }
  } catch (err) {
    console.error(err);
    showToast(`Share-Import: ${err.message}`, 'error');
  }
}
