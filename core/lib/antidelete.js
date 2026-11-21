'use strict';

const fs = require('fs');
const path = require('path');
const identity = require('./Identity');

const BASE_DIR = path.resolve(process.env.ANTIDELETE_DIR || 'message_data');
const KEEP_MS = (Number(process.env.ANTIDELETE_KEEP_HOURS) || 48) * 60 * 60 * 1000;
const PRUNE_EVERY_MS = 60 * 60 * 1000;
let lastPrune = 0;

let baileys;
async function loadBaileys() {
  if (!baileys) {
    try {
      baileys = await import('@whiskeysockets/baileys');
    } catch (error) {
      baileys = {}; 
    }
  }
  return baileys;
}

const safe = (name) => String(name).replace(/[^a-zA-Z0-9@._-]/g, '_');
const fileFor = (chat, id) => path.join(BASE_DIR, safe(chat), `${safe(id)}.json`);

async function save(message) {
  try {
    const key = message && message.key;
    if (!key || !message.message) return;
    if (key.remoteJid === 'status@broadcast' || key.fromMe) return;
    const { BufferJSON } = await loadBaileys();
    const file = fileFor(key.remoteJid, key.id);
    await fs.promises.mkdir(path.dirname(file), { recursive: true });
    await fs.promises.writeFile(file, JSON.stringify(message, BufferJSON ? BufferJSON.replacer : undefined));
    prune();
  } catch (error) {
    console.error('Antidelete: could not save a message:', error.message || error);
  }
}

async function load(chat, id) {
  try {
    const { BufferJSON } = await loadBaileys();
    const text = await fs.promises.readFile(fileFor(chat, id), 'utf8');
    return JSON.parse(text, BufferJSON ? BufferJSON.reviver : undefined);
  } catch (error) {
    return null;
  }
}

// removes saved messages older than ANTIDELETE_KEEP_HOURS (default 48), at most once an hour
function prune() {
  if (Date.now() - lastPrune < PRUNE_EVERY_MS) return;
  lastPrune = Date.now();
  (async () => {
    try {
      for (const chat of await fs.promises.readdir(BASE_DIR)) {
        const dir = path.join(BASE_DIR, chat);
        for (const name of await fs.promises.readdir(dir).catch(() => [])) {
          const file = path.join(dir, name);
          const stat = await fs.promises.stat(file).catch(() => null);
          if (stat && Date.now() - stat.mtimeMs > KEEP_MS) await fs.promises.unlink(file).catch(() => { });
        }
        const left = await fs.promises.readdir(dir).catch(() => ['x']);
        if (left.length === 0) await fs.promises.rmdir(dir).catch(() => { });
      }
    } catch (error) { /* nothing saved yet */ }
  })();
}

const ZONE = process.env.TIMEZONE || process.env.TZ || 'Africa/Nairobi';

// a phone number is preferred over a LID so the tag shows a name or number
const tagJid = (jid, alt) => (alt && String(alt).endsWith('@s.whatsapp.net') ? alt : jid);
const tagText = (jid) => '@' + String(jid).split('@')[0].split(':')[0];

function toSeconds(value) {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'object') {
    if (typeof value.toNumber === 'function') return value.toNumber();
    if (value.low !== undefined) return Number(value.low);
  }
  return Number(value) || 0;
}

function formatTime(ms) {
  if (!ms) return 'unknown';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: ZONE, weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).format(new Date(ms));
  } catch (error) {
    return new Date(ms).toISOString();
  }
}

async function locationOf(client, chat) {
  if (!String(chat).endsWith('@g.us')) return 'Private chat';
  try {
    const meta = await client.groupMetadata(chat);
    return `Group: ${meta.subject}`;
  } catch (error) {
    return 'Group';
  }
}

async function download(message, type) {
  const { downloadContentFromMessage } = await loadBaileys();
  const stream = await downloadContentFromMessage(message, type);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function isRevocation(mek) {
  const protocol = mek.message && mek.message.protocolMessage;
  if (!protocol || !protocol.key) return false;
  return protocol.type === undefined || protocol.type === 0 || protocol.type === 'REVOKE';
}

async function handleRevocation(client, mek, sendTo) {
  const deletedId = mek.message.protocolMessage.key.id;
  const original = await load(mek.key.remoteJid, deletedId);
  if (!original) return;

  const deletedBy = mek.participant || mek.key.participant || mek.key.remoteJid;
  const deletedByAlt = mek.key.participantAlt || mek.key.remoteJidAlt;
  const sentBy = original.key.participant || original.key.remoteJid;
  const sentByAlt = original.key.participantAlt || original.key.remoteJidAlt;

  // a message the bot's own account deleted is not reported
  const bot = identity.botIds(client);
  if ([deletedBy, deletedByAlt].filter(Boolean).some((id) => bot.has(identity.bare(id)))) return;

  const to = sendTo || client.decodeJid(client.user.id);
  const senderTag = tagJid(sentBy, sentByAlt);
  const deleterTag = tagJid(deletedBy, deletedByAlt);
  const mentions = [...new Set([senderTag, deleterTag])];
  const send = (content) => client.sendMessage(to, { ...content, mentions });

  const location = await locationOf(client, mek.key.remoteJid);
  const sentAt = toSeconds(original.messageTimestamp) * 1000;
  const name = original.pushName || 'Unknown';
  const header = [
    '🗑️ 𝗔𝗡𝗧𝗜𝗗𝗘𝗟𝗘𝗧𝗘 𝗥𝗘𝗣𝗢𝗥𝗧 🗑️',
    '',
    `📍 𝗟𝗼𝗰𝗮𝘁𝗶𝗼𝗻: ${location}`,
    `👤 𝗦𝗲𝗻𝗱𝗲𝗿: ${name}`,
    `🏷️ 𝗜𝗗: ${tagText(senderTag)}`,
    ...(deleterTag !== senderTag ? [`🚮 𝗗𝗲𝗹𝗲𝘁𝗲𝗱 𝗯𝘆: ${tagText(deleterTag)}`] : []),
    `🕒 𝗦𝗲𝗻𝘁: ${formatTime(sentAt)}`,
    `⏰ 𝗗𝗲𝗹𝗲𝘁𝗲𝗱: ${formatTime(Date.now())}`,
    `🌍 ${ZONE}`,
    '',
    '',
  ].join('\n');

  const msg = original.message;
  const preview = {
    externalAdReply: {
      title: '🗑️ Antidelete',
      body: `Deleted message from ${name}`,
      thumbnailUrl: 'https://files.catbox.moe/jb8g61.jpg',
      sourceUrl: '',
      mediaType: 1,
      renderLargerThumbnail: true,
    },
  };

  try {
    if (msg.conversation) {
      await send({ text: `${header}🗑️ 𝗗𝗲𝗹𝗲𝘁𝗲𝗱 𝗠𝗲𝘀𝘀𝗮𝗴𝗲: ${msg.conversation}` });
    } else if (msg.extendedTextMessage) {
      await send({ text: `${header}🚮 𝗗𝗲𝗹𝗲𝘁𝗲𝗱 𝗖𝗼𝗻𝘁𝗲𝗻𝘁: ${msg.extendedTextMessage.text}` });
    } else if (msg.imageMessage) {
      const caption = msg.imageMessage.caption ? `\n\nImage caption: ${msg.imageMessage.caption}` : '';
      await sendMedia(send, header, '[Image]', caption, async () => ({ image: await download(msg.imageMessage, 'image') }));
    } else if (msg.videoMessage) {
      const caption = msg.videoMessage.caption ? `\n\nVideo caption: ${msg.videoMessage.caption}` : '';
      await sendMedia(send, header, '[Video]', caption, async () => ({ video: await download(msg.videoMessage, 'video') }));
    } else if (msg.stickerMessage) {
      await sendMedia(send, header, '[Sticker]', '', async () => ({ sticker: await download(msg.stickerMessage, 'sticker'), contextInfo: preview }));
    } else if (msg.documentMessage) {
      const doc = msg.documentMessage;
      await sendMedia(send, header, '[Document]', '', async () => ({
        document: await download(doc, 'document'),
        fileName: doc.fileName || `document_${Date.now()}.dat`,
        mimetype: doc.mimetype || 'application/octet-stream',
        contextInfo: preview,
      }));
    } else if (msg.audioMessage) {
      await sendMedia(send, header, '[Audio]', '', async () => ({
        audio: await download(msg.audioMessage, 'audio'),
        ptt: msg.audioMessage.ptt === true,
        mimetype: msg.audioMessage.mimetype || 'audio/mpeg',
        contextInfo: preview,
      }));
    } else {
      await send({ text: `${header}(this kind of message cannot be shown)` });
    }
  } catch (error) {
    console.error('Antidelete: error handling a deleted message:', error.message || error);
    try {
      await send({ text: `${header}⚠️ Error recovering deleted content 😓` });
    } catch (e) { /* nothing more to do */ }
  }
}

// downloads the media and sends it; if that fails (the media has expired) a text report is sent instead.
// Stickers, audio and documents cannot carry a caption, so their report goes out as text first.
async function sendMedia(send, header, label, caption, build) {
  let content;
  try {
    content = await build();
  } catch (error) {
    console.error(`Antidelete: could not download the ${label}:`, error.message || error);
    await send({ text: `${header}🚮 𝗗𝗲𝗹𝗲𝘁𝗲𝗱 𝗠𝗲𝗱𝗶𝗮: ${label}\n\n⚠️ Could not recover it (the media has expired)` });
    return;
  }
  if (content.image || content.video) {
    content.caption = `${header}🚮 𝗗𝗲𝗹𝗲𝘁𝗲𝗱 𝗠𝗲𝗱𝗶𝗮: ${label}${caption}`;
  } else {
    await send({ text: `${header}🚮 𝗗𝗲𝗹𝗲𝘁𝗲𝗱 𝗠𝗲𝗱𝗶𝗮: ${label}` });
  }
  await send(content);
}

// The one entry point. Returns nothing; it never throws, so it cannot break message handling.
async function handle(client, m, mek, mode) {
  try {
    if (!mode || mode === 'off' || !mek || !mek.message) return;
    const self = client.decodeJid(client.user.id);
    const here = mek.key.remoteJid;

    if (isRevocation(mek)) {
      if (mode === 'chat' && !m.isGroup) await handleRevocation(client, mek, here);
      else if (mode === 'group' && m.isGroup) await handleRevocation(client, mek, here);
      else if (mode === 'private' || mode === 'on') await handleRevocation(client, mek, self);
      else if (mode === 'both') {
        await handleRevocation(client, mek, here);
        await handleRevocation(client, mek, self);
      }
      return;
    }

    if (mode === 'chat' && m.isGroup) return;
    if (mode === 'group' && !m.isGroup) return;
    if (['chat', 'group', 'private', 'both', 'on'].includes(mode)) await save(mek);
  } catch (error) {
    console.error('Antidelete failed:', error.message || error);
  }
}

module.exports = { handle, save, handleRevocation, isRevocation, BASE_DIR };
