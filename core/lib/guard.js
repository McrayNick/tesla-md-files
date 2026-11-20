const { getSettings } = require('../database/config');
const identity = require('./Identity');
const sudo = require('./sudo');

const SETTING = { demote: 'antidemote', promote: 'antipromote' };
const seen = new Map();

const idOf = (participant) => (typeof participant === 'string' ? participant : participant && participant.id) || '';

function duplicate(key) {
  const now = Date.now();
  for (const [k, at] of seen) if (now - at > 15000) seen.delete(k);
  if (seen.has(key)) return true;
  seen.set(key, now);
  return false;
}

async function Guard(client, update) {
  try {
    if (!update || !update.id || !Array.isArray(update.participants)) return;
    const setting = SETTING[update.action];
    if (!setting) return;

    const author = [update.author, update.authorPn].filter(Boolean);
    if (!author.length) return;

    const settings = await getSettings();
    if (settings[setting] !== 'on') return;

    const trusted = await sudo.trustedIds(client);
    const authorIds = await identity.expand(client, author);
    if (identity.overlaps(authorIds, trusted)) return;

    const victims = update.participants.map(idOf).filter(Boolean);
    if (!victims.length || duplicate(`${update.id}:${update.action}:${victims.join(',')}`)) return;

    const metadata = await client.groupMetadata(update.id);
    const admins = identity.adminIdSet(metadata.participants);
    if (!identity.overlaps(identity.botIds(client), admins) && !identity.overlaps(await identity.expand(client, identity.botIds(client)), admins)) return;

    let targets = victims;
    let action = update.action === 'demote' ? 'promote' : 'demote';
    if (update.action === 'promote') {
      targets = [];
      for (const id of victims) {
        const known = await identity.expand(client, [id]);
        if (!identity.overlaps(known, trusted)) targets.push(id);
      }
    }
    if (!targets.length) return;

    await client.groupParticipantsUpdate(update.id, targets, action);

    const by = update.authorPn || update.author;
    const names = targets.map((id) => `@${sudo.digits(id)}`).join(' ');
    const text = update.action === 'demote'
      ? `Antidemote is on. @${sudo.digits(by)} tried to demote ${names}, so they are an admin again.`
      : `Antipromote is on. @${sudo.digits(by)} tried to promote ${names}, so they are a normal member again.`;
    await client.sendMessage(update.id, { text, mentions: [by, ...targets] }).catch(() => { });
  } catch (error) {
    console.error('Anti-demote/promote failed:', error.message || error);
  }
}

module.exports = Guard;
