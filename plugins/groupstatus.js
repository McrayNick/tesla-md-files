const crypto = require('crypto');
const {
  generateWAMessageContent,
  generateWAMessageFromContent,
} = require('@whiskeysockets/baileys');

async function bufferOf(source) {
  if (!source || typeof source.download !== 'function') return null;
  const data = await source.download();
  return Buffer.isBuffer(data) ? data : data ? Buffer.from(data) : null;
}

const MEDIA_KEYS = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'];

function withMediaHint(message, inner) {
  const hint = {};
  for (const key of MEDIA_KEYS) if (inner[key]) hint[key] = inner[key];
  if (!Object.keys(hint).length) return message;
  const out = Object.create(hint);
  Object.assign(out, message);
  return out;
}

async function postGroupStatus(client, jid, content) {
  const inner = await generateWAMessageContent(content, { upload: client.waUploadToServer });
  const messageSecret = crypto.randomBytes(32);
  const wrapped = generateWAMessageFromContent(
    jid,
    {
      messageContextInfo: { messageSecret },
      groupStatusMessageV2: {
        message: { ...inner, messageContextInfo: { messageSecret } },
      },
    },
    { userJid: client.user.id }
  );
  await client.relayMessage(jid, withMediaHint(wrapped.message, inner), { messageId: wrapped.key.id });
  return wrapped;
}

module.exports = [
  {
    command: ['groupstatus'],
    aliases: ['gstatus', 'gs', 'poststatus'],
    description: 'Post a group status: text, or reply to / caption an image, video or audio',
    category: 'group',
    handler: async (client, m, { Owner, isAdmin, reply, text, prefix, group, admin }) => {
      if (!m.isGroup) throw group;
      if (!Owner && !isAdmin) throw admin;

      const caption = String(text || '').trim();
      const source = [m.quoted, m].find((item) => item && /image|video|audio/i.test(item.mtype || ''));
      const kind = source ? (/image/i.test(source.mtype) ? 'image' : /video/i.test(source.mtype) ? 'video' : 'audio') : null;

      if (!kind && !caption) {
        return reply(`Usage:\n${prefix}groupstatus <text>\nor reply to / caption an image, video or audio with ${prefix}groupstatus [caption]`);
      }

      try {
        let content;
        if (kind) {
          const buffer = await bufferOf(source);
          if (!buffer) return reply('❌ Could not download that media.');
          if (kind === 'audio') content = { audio: buffer, mimetype: 'audio/mp4', ptt: false };
          else content = { [kind]: buffer, caption };
        } else {
          content = { text: caption };
        }
        await postGroupStatus(client, m.chat, content);
        await client.sendMessage(m.chat, { react: { text: '✅', key: m.key } });
      } catch (error) {
        console.error('[groupstatus]', error);
        reply(`❌ Could not post the group status: ${error.message || error}`);
      }
    },
  },
];
