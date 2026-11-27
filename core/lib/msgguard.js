const { getSettings } = require('../database/config');
const moderation = require('./moderation');

const { ACTIONS } = moderation;

const STATUS_TYPES = ['groupStatusMessageV2', 'groupStatusMessage'];
const MENTION_TYPES = ['groupMentionedMessage', 'groupStatusMentionMessage'];

function contextsOf(m) {
  const found = [];
  const seen = new Set();
  const walk = (node, depth) => {
    if (!node || typeof node !== 'object' || depth > 5 || seen.has(node)) return;
    seen.add(node);
    if (node.contextInfo && typeof node.contextInfo === 'object') found.push(node.contextInfo);
    for (const key of Object.keys(node)) {
      if (key === 'contextInfo') continue;
      const child = node[key];
      if (child && typeof child === 'object') walk(child, depth + 1);
    }
  };
  walk(m.message, 0);
  return found;
}

function mentionCount(m) {
  const ids = new Set();
  for (const ctx of contextsOf(m)) {
    for (const jid of ctx.mentionedJid || []) ids.add(String(jid));
  }
  return ids.size;
}

function tagLimit(groupMetadata) {
  const size = groupMetadata && Array.isArray(groupMetadata.participants) ? groupMetadata.participants.length : 0;
  return Math.max(5, Math.ceil(size * 0.6));
}

function hasType(m, types) {
  if (types.includes(m.mtype)) return true;
  return !!m.message && types.some((type) => m.message[type]);
}

async function check(client, m, ctx) {
  try {
    if (!m.isGroup || m.fromMe) return false;
    const { Owner, isAdmin, isBotAdmin, groupMetadata } = ctx;
    if (Owner || isAdmin || !isBotAdmin) return false;

    const settings = await getSettings();

    if (settings.antigroupstatus === 'on' && hasType(m, STATUS_TYPES)) {
      return await moderation.enforce(client, m, {
        bucket: 'groupstatus',
        title: '🚫 *ANTI GROUP STATUS*',
        noun: 'group status posts',
        rule: 'group status posts are not allowed here.',
        offence: 'posting a group status',
        action: settings.antigroupstatusaction,
        limit: settings.antigroupstatuswarns,
      });
    }

    if (settings.antigroupmention === 'on' && hasType(m, MENTION_TYPES)) {
      return await moderation.enforce(client, m, {
        bucket: 'groupmention',
        title: '🚫 *ANTI GROUP MENTION*',
        noun: 'group mentions',
        rule: 'mentioning this group in a status is not allowed.',
        offence: 'mentioning the group in a status',
        action: settings.antigroupmentionaction,
        limit: settings.antigroupmentionwarns,
      });
    }

    if (settings.antitagall === 'on') {
      const count = mentionCount(m);
      if (count >= tagLimit(groupMetadata)) {
        return await moderation.enforce(client, m, {
          bucket: 'tagall',
          title: '🚫 *ANTI TAG ALL*',
          noun: 'mass tagging',
          rule: 'tagging everyone is not allowed here.',
          offence: 'tagging everyone',
          action: settings.antitagallaction,
          limit: settings.antitagallwarns,
        });
      }
    }
    return false;
  } catch (error) {
    console.error('[guard]', error.message || error);
    return false;
  }
}

module.exports = { check, mentionCount, tagLimit, contextsOf, ACTIONS };
