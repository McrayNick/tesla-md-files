const { getSettings } = require('../database/config');

const moderation = require('./moderation');

const { ACTIONS } = moderation;

const TLDS = 'com|net|org|io|co|ke|me|xyz|info|biz|app|dev|link|site|online|store|top|club|live|shop|vip|ly|gl|gg|tv|cc|ru|in|uk|us|ng|za|tz|ug|ai|to|ws|tk|ml|ga|cf|gq|pw|click|fun|world|space|website|tech|cloud|page|bio';

const INVITE = /(?:chat\.whatsapp\.com\/[a-z0-9]+|whatsapp\.com\/channel\/[a-z0-9]+|whatsapp\.com\/(?:invite|join)[^\s]*)/i;
const ANY = new RegExp(
  [
    '(?:https?|ftp):\\/\\/[^\\s]+',
    'www\\.[a-z0-9-]+\\.[a-z]{2,}[^\\s]*',
    `(?<![@\\w.-])[a-z0-9-]+(?:\\.[a-z0-9-]+)*\\.(?:${TLDS})(?![a-z0-9-])(?:[/?#][^\\s]*)?`,
  ].join('|'),
  'gi'
);

function normalise(text) {
  return String(text || '')
    .normalize('NFKC')
    .replace(/[​-‏‪-‮⁠﻿]/g, '')
    .replace(/\s*[(\[{]\s*(?:dot|\.)\s*[)\]}]\s*/gi, '.')
    .toLowerCase();
}

function hostOf(link) {
  return link
    .replace(/^[a-z]+:\/\//, '')
    .split(/[/?#]/)[0]
    .replace(/^www\./, '')
    .replace(/:\d+$/, '');
}

function parseList(value) {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, ''))
    .filter(Boolean);
}

function allowed(host, allowList) {
  return allowList.some((entry) => host === entry || host.endsWith(`.${entry}`));
}

function findLinks(text, { scope, allowList }) {
  const clean = normalise(text);
  if (!clean) return [];
  const found = [];
  if (INVITE.test(clean)) {
    const invite = clean.match(INVITE)[0];
    if (!allowed(hostOf(invite), allowList)) found.push(invite);
  }
  if (scope === 'all') {
    for (const match of clean.match(ANY) || []) {
      const host = hostOf(match);
      if (host && !allowed(host, allowList) && !found.includes(match)) found.push(match);
    }
  }
  return found;
}

async function check(client, m, ctx) {
  try {
    if (!m.isGroup || m.fromMe) return false;
    const { text, Owner, isAdmin, isBotAdmin } = ctx;
    if (Owner || isAdmin || !isBotAdmin) return false;

    const settings = await getSettings();
    const scope = settings.antilinkall === 'on' ? 'all' : settings.antilink === 'on' ? 'invite' : null;
    if (!scope) return false;

    const links = findLinks(text, { scope, allowList: parseList(settings.antilinkallow) });
    if (!links.length) return false;

    const what = scope === 'all' ? 'links' : 'group links';
    return await moderation.enforce(client, m, {
      bucket: 'antilink',
      title: '🔗 *ANTILINK*',
      noun: what,
      action: settings.antilinkaction,
      limit: settings.antilinkwarns,
    });
  } catch (error) {
    console.error('[antilink]', error.message || error);
    return false;
  }
}

module.exports = { check, findLinks, normalise, parseList, ACTIONS };
