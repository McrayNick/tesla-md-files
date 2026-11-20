const { getSettings, updateSetting } = require('../database/config');
const identity = require('./Identity');

const digits = (jid) => String(jid || '').split('@')[0].split(':')[0].replace(/\D/g, '');

function mainOwners() {
  return String(process.env.DEV || '254781346242').split(',');
}

async function list() {
  const settings = await getSettings();
  return String(settings.sudo || '').split(',').map((entry) => entry.trim()).filter(Boolean);
}

async function save(entries) {
  return updateSetting('sudo', [...new Set(entries)].join(','));
}

async function normalize(client, jid) {
  const id = identity.bare(jid);
  if (id.endsWith('@lid')) return (await identity.counterpart(client, id)) || id;
  return id;
}

async function resolveTarget(client, m, text) {
  const mentioned = (m.mentionedJid || [])[0];
  const quoted = m.quoted && m.quoted.sender;
  const picked = mentioned || quoted;
  if (picked) return normalize(client, picked);
  const number = (String(text || '').replace(/[\s+\-()]/g, '').match(/\d{7,15}/) || [])[0];
  return number ? `${number}@s.whatsapp.net` : null;
}

async function idSet(client, entries) {
  return identity.expand(client, entries);
}

async function isSudo(client, senderIds) {
  const entries = await list();
  if (!entries.length) return false;
  return identity.overlaps(senderIds, await idSet(client, entries));
}

async function trustedIds(client) {
  const entries = await list();
  const base = [...identity.botIds(client), ...identity.ownerJids(mainOwners()), ...entries];
  return identity.expand(client, base);
}

async function add(client, jid) {
  const entries = await list();
  const known = await identity.expand(client, [jid]);
  for (const entry of entries) {
    if (identity.overlaps(await idSet(client, [entry]), known)) return false;
  }
  return save([...entries, jid]);
}

async function remove(client, jid) {
  const entries = await list();
  const known = await identity.expand(client, [jid]);
  const kept = [];
  for (const entry of entries) {
    if (!identity.overlaps(await idSet(client, [entry]), known)) kept.push(entry);
  }
  if (kept.length === entries.length) return false;
  return save(kept);
}

async function clear() {
  const count = (await list()).length;
  if (!count) return 0;
  await save([]);
  return count;
}

module.exports = { digits, mainOwners, list, normalize, resolveTarget, isSudo, trustedIds, add, remove, clear };
