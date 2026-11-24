const { getSettings } = require('../database/config');
const moderation = require('./moderation');

const { ACTIONS } = moderation;

const LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i', '|': 'i' };
const SUFFIX = '(?:s|es|ed|er|ers|ing|in|y)?';
const SEPARATOR = '[._\\-*+~\'`"]*';

let cachedKey = null;
let cachedRegex = null;

function normalise(text) {
  return String(text || '')
    .normalize('NFKC')
    .replace(/[​-‏‪-‮⁠﻿]/g, '')
    .toLowerCase();
}

function leetspeak(text) {
  return text.replace(/[013457@$!|]/g, (char) => LEET[char]);
}

function parseWords(value) {
  return [...new Set(
    String(value || '')
      .split(',')
      .map((word) => normalise(word).replace(/[^a-z0-9]/g, ''))
      .filter((word) => word.length >= 2)
  )];
}

function patternFor(word) {
  const letters = word.split('');
  const joiner = word.length >= 4 ? SEPARATOR : '';
  return letters.map((letter) => `${letter}+`).join(joiner);
}

function compile(words) {
  const key = words.join(',');
  if (key === cachedKey) return cachedRegex;
  cachedKey = key;
  cachedRegex = words.length
    ? new RegExp(`(?<![a-z0-9])(?:${words.map(patternFor).join('|')})${SUFFIX}(?![a-z0-9])`, 'i')
    : null;
  return cachedRegex;
}

function findBadWord(text, words) {
  const regex = compile(words);
  if (!regex) return null;
  const plain = normalise(text);
  if (!plain) return null;
  const hit = plain.match(regex) || leetspeak(plain).match(regex);
  return hit ? hit[0] : null;
}

async function check(client, m, ctx) {
  try {
    if (!m.isGroup || m.fromMe) return false;
    const { text, Owner, isAdmin, isBotAdmin } = ctx;
    if (Owner || isAdmin || !isBotAdmin || !text) return false;

    const settings = await getSettings();
    if (settings.badword !== 'on') return false;

    if (!findBadWord(text, parseWords(settings.badwords))) return false;

    return await moderation.enforce(client, m, {
      bucket: 'badword',
      title: '🤬 *BAD WORD FILTER*',
      noun: 'bad words',
      action: settings.badwordaction,
      limit: settings.badwordwarns,
    });
  } catch (error) {
    console.error('[badword]', error.message || error);
    return false;
  }
}

module.exports = { check, findBadWord, parseWords, ACTIONS };
