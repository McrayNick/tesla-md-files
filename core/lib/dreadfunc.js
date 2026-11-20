const axios = require('axios');
const { Jimp } = require('jimp');

const BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36';

const getContentType = (message) => {
  if (!message) return undefined;
  const keys = Object.keys(message);
  return keys.find((key) => key !== 'messageContextInfo') || keys[0];
};

const isBotId = (id) => Boolean(id) && id.startsWith('BAE5') && id.length === 16;

exports.fetchJson = async (url, options = {}) => {
  try {
    const res = await axios({ method: 'GET', url, headers: { 'User-Agent': BROWSER }, ...options });
    return res.data;
  } catch (error) {
    return error;
  }
};

exports.sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

exports.jsonformat = (value) => JSON.stringify(value, null, 2);

exports.generateProfilePicture = async (buffer) => {
  const image = await Jimp.read(buffer);
  const img = await image.clone().scaleToFit({ w: 720, h: 720 }).getBuffer('image/jpeg');
  return { img, preview: img };
};

exports.smsg = (conn, m) => {
  if (!m) return m;

  if (m.key) {
    m.id = m.key.id;
    m.isBaileys = isBotId(m.id);
    m.chat = m.key.remoteJid;
    m.fromMe = m.key.fromMe;
    m.isGroup = m.chat.endsWith('@g.us');
    m.sender = conn.decodeJid((m.fromMe && conn.user.id) || m.participant || m.key.participant || m.chat || '');
    if (m.isGroup) m.participant = conn.decodeJid(m.key.participant) || '';
  }

  if (!m.message) return m;

  m.mtype = getContentType(m.message);
  m.msg = m.mtype === 'viewOnceMessage'
    ? m.message[m.mtype].message[getContentType(m.message[m.mtype].message)]
    : m.message[m.mtype];
  m.body = m.message.conversation
    || m.msg.caption
    || m.msg.text
    || (m.mtype === 'listResponseMessage' && m.msg.singleSelectReply.selectedRowId)
    || (m.mtype === 'buttonsResponseMessage' && m.msg.selectedButtonId)
    || (m.mtype === 'viewOnceMessage' && m.msg.caption)
    || m.text;

  const context = m.msg.contextInfo;
  const quoted = context ? context.quotedMessage : null;
  m.quoted = quoted;
  m.mentionedJid = context ? context.mentionedJid : [];

  if (quoted) {
    let type = getContentType(quoted);
    m.quoted = quoted[type];
    if (type === 'productMessage') {
      type = getContentType(m.quoted);
      m.quoted = m.quoted[type];
    }
    if (typeof m.quoted === 'string') m.quoted = { text: m.quoted };

    m.quoted.mtype = type;
    m.quoted.id = context.stanzaId;
    m.quoted.chat = context.remoteJid || m.chat;
    m.quoted.isBaileys = isBotId(m.quoted.id);
    m.quoted.sender = conn.decodeJid(context.participant);
    m.quoted.fromMe = m.quoted.sender === (conn.user && conn.user.id);
    m.quoted.text = m.quoted.text || m.quoted.caption || m.quoted.conversation || m.quoted.contentText
      || m.quoted.selectedDisplayText || m.quoted.title || '';
    m.quoted.mentionedJid = context.mentionedJid || [];

    const key = { remoteJid: m.quoted.chat, fromMe: m.quoted.fromMe, id: m.quoted.id };
    if (m.isGroup) key.participant = m.quoted.sender;
    m.quoted.fakeObj = { key, message: quoted };
    m.quoted.delete = () => conn.sendMessage(m.quoted.chat, { delete: key });
    m.quoted.download = () => conn.downloadMediaMessage(m.quoted);
  }

  if (m.msg.url) m.download = () => conn.downloadMediaMessage(m.msg);
  m.text = m.msg.text || m.msg.caption || m.message.conversation || m.msg.contentText
    || m.msg.selectedDisplayText || m.msg.title || '';
  m.reply = (text, chatId = m.chat, options = {}) => conn.sendText(chatId, text, m, options);

  return m;
};
