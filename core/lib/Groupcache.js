'use strict';

const TTL_MS = 5 * 60 * 1000;
const FAIL_MS = 30 * 1000;
const cache = new Map();
const pending = new Map();
const failed = new Map();

function get(jid) {
  const hit = cache.get(jid);
  if (!hit) return undefined;
  if (hit.expires < Date.now()) { cache.delete(jid); return undefined; }
  return hit.data;
}

function set(jid, data) {
  if (jid && data) cache.set(jid, { data, expires: Date.now() + TTL_MS });
}

function drop(jid) {
  cache.delete(jid);
}

async function fetchMetadata(client, jid) {
  const cached = get(jid);
  if (cached) return cached;

  const stale = cache.get(jid);
  const recentFailure = failed.get(jid);
  if (recentFailure && recentFailure.until > Date.now()) {
    if (stale) return stale.data;
    throw recentFailure.error;
  }

  if (pending.has(jid)) return pending.get(jid);

  const request = client.groupMetadata(jid)
    .then((data) => {
      failed.delete(jid);
      set(jid, data);
      return data;
    })
    .catch((error) => {
      failed.set(jid, { error, until: Date.now() + FAIL_MS });
      if (stale) return stale.data;
      throw error;
    })
    .finally(() => pending.delete(jid));

  pending.set(jid, request);
  return request;
}

function bind(client) {
  client.ev.on('groups.update', (updates) => {
    for (const update of updates || []) drop(update.id);
  });
  client.ev.on('group-participants.update', (update) => {
    if (update && update.id) drop(update.id);
  });
}

module.exports = { get, set, drop, fetchMetadata, bind };
