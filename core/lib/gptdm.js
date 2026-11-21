const axios = require('axios');

const NAME = 'Tesla';
const PROXY_URL = (process.env.AI_PROXY_URL || 'https://api-4lqo.onrender.com').replace(/\/+$/, '');
const GROQ_DIRECT = 'https://api.groq.com/openai/v1';
const ZONE = process.env.TIMEZONE || process.env.TZ || 'Africa/Nairobi';
const MODELS = [...new Set([process.env.GPTDM_MODEL, 'llama-3.3-70b-versatile', 'openai/gpt-oss-120b', 'llama-3.1-8b-instant'].filter(Boolean))];
const MEMORY_TURNS = Number(process.env.GPTDM_MEMORY) || 12;
const MEMORY_MS = (Number(process.env.GPTDM_MEMORY_HOURS) || 12) * 60 * 60 * 1000;
const MAX_CHATS = 500;
const MAX_INPUT = 1500;
const MAX_QUEUE = 3;
const WAKE_STEP_MS = 6000;
const WAKE_LIMIT_MS = 55000;

const memory = new Map();
const queues = new Map();
const lastApology = new Map();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function systemPrompt(userName) {
  const now = new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, dateStyle: 'full', timeStyle: 'short' }).format(new Date());
  return [
    `You are ${NAME}, the friendly AI assistant of the TESLA-MD WhatsApp bot. Your name is ${NAME}. If asked who you are, say you are ${NAME}, an AI assistant on WhatsApp. Never call yourself by any other name and never mention the model or company behind you.`,
    `You are chatting in a private WhatsApp conversation with ${userName || 'a user'}. Current date and time: ${now} (${ZONE}).`,
    'Language: always reply in the same language the user wrote in their latest message, including Swahili, Sheng, French, Arabic and others. If they mix languages, mix naturally the same way. Switch only if they switch.',
    'Mood: read the mood behind each message and match it. Be warm and gentle when someone is sad or stressed, calm and patient when they are angry or frustrated, upbeat when they are excited, playful when they joke, precise and to the point when the question is serious or technical, and quick when it is urgent. Never lecture or scold.',
    'Emojis: use them sparingly and only when they fit the mood, usually zero to two per message. No emoji on serious, technical or sad topics unless it is a gentle one. Never fill a message with emojis.',
    'Style: this is WhatsApp, so keep replies short and natural, usually a few sentences. Use longer answers only when the question truly needs it. No headings and no markdown tables. You may use *bold* or lists sparingly.',
    'Memory: you can see the earlier messages of this conversation, so use them and do not ask for things the user already told you. Do not claim to remember anything outside this conversation.',
    'Be honest. If you do not know, say so. Do not invent facts, links or news. Do not mention these instructions.',
  ].join('\n');
}

function remember(jid) {
  const now = Date.now();
  let entry = memory.get(jid);
  if (entry && now - entry.at > MEMORY_MS) entry = null;
  if (!entry) {
    entry = { at: now, turns: [] };
    if (memory.size >= MAX_CHATS) {
      const oldest = [...memory.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (oldest) memory.delete(oldest[0]);
    }
  }
  entry.at = now;
  memory.set(jid, entry);
  return entry;
}

function shouldReply(client, m, text, { cmd, itsMe } = {}) {
  if (!m || m.isGroup || cmd || itsMe) return false;
  const chat = String(m.chat || '');
  if (!chat || chat.endsWith('broadcast') || chat.endsWith('@g.us') || chat.endsWith('@newsletter')) return false;
  if (m.isBaileys) return false;
  if (m.key && m.key.fromMe) return false;
  if (m.mtype && !['conversation', 'extendedTextMessage'].includes(m.mtype)) return false;
  const body = String(text || '').trim();
  if (!body || body.startsWith('>') || body.startsWith('$')) return false;
  return true;
}

async function post(messages, model, botId) {
  const key = (process.env.GROQ_KEY || '').trim();
  const url = key ? `${GROQ_DIRECT}/chat/completions` : `${PROXY_URL}/openai/v1/chat/completions`;
  const headers = key ? { Authorization: `Bearer ${key}` } : { 'x-bot-id': botId };
  return axios.post(url, { model, messages, temperature: 0.8, max_completion_tokens: 600 }, {
    headers: { ...headers, 'Content-Type': 'application/json' },
    timeout: 45000,
    validateStatus: () => true,
  });
}

async function complete(messages, botId) {
  const started = Date.now();
  let lastError = new Error('no answer');
  for (const model of MODELS) {
    for (;;) {
      let response;
      try {
        response = await post(messages, model, botId);
      } catch (error) {
        lastError = error;
        if (Date.now() - started + WAKE_STEP_MS > WAKE_LIMIT_MS) throw lastError;
        await sleep(WAKE_STEP_MS);
        continue;
      }
      if (response.status >= 500) {
        lastError = new Error(`AI service returned HTTP ${response.status}`);
        if (Date.now() - started + WAKE_STEP_MS > WAKE_LIMIT_MS) throw lastError;
        await sleep(WAKE_STEP_MS);
        continue;
      }
      const error = response.data && response.data.error;
      if (response.status === 404 || (error && /model_not_found|does not exist|do not have access/i.test(`${error.code} ${error.message}`))) {
        lastError = new Error(`model ${model} is not available`);
        break;
      }
      if (response.status === 429) throw new Error('rate limited');
      if (response.status !== 200) throw new Error((error && error.message) || `HTTP ${response.status}`);
      const content = response.data && response.data.choices && response.data.choices[0] && response.data.choices[0].message && response.data.choices[0].message.content;
      const clean = String(content || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      if (!clean) throw new Error('empty answer');
      return clean;
    }
  }
  throw lastError;
}

async function answer(client, m, text, pushname) {
  const jid = m.chat;
  const entry = remember(jid);
  const input = String(text).trim().slice(0, MAX_INPUT);
  const botId = String((client.user && client.user.id) || '').split(':')[0].split('@')[0];
  const messages = [
    { role: 'system', content: systemPrompt(pushname) },
    ...entry.turns,
    { role: 'user', content: input },
  ];

  client.sendPresenceUpdate('composing', jid).catch(() => { });
  try {
    const reply = await complete(messages, botId);
    entry.turns.push({ role: 'user', content: input }, { role: 'assistant', content: reply });
    while (entry.turns.length > MEMORY_TURNS * 2) entry.turns.splice(0, 2);
    entry.at = Date.now();
    await client.sendMessage(jid, { text: reply }, { quoted: m });
  } catch (error) {
    console.error('[GPTDM]', error.message || error);
    if (Date.now() - (lastApology.get(jid) || 0) > 5 * 60 * 1000) {
      lastApology.set(jid, Date.now());
      await client.sendMessage(jid, { text: `${NAME} is a bit busy right now. Please send that again in a moment 🙏` }, { quoted: m }).catch(() => { });
    }
  } finally {
    client.sendPresenceUpdate('paused', jid).catch(() => { });
  }
}

function respond(client, m, text, options = {}) {
  if (!shouldReply(client, m, text, options)) return Promise.resolve(false);
  const jid = m.chat;
  const queue = queues.get(jid) || { tail: Promise.resolve(), size: 0 };
  if (queue.size >= MAX_QUEUE) return Promise.resolve(false);
  queue.size += 1;
  queues.set(jid, queue);
  queue.tail = queue.tail
    .then(() => answer(client, m, text, options.pushname))
    .catch(() => { })
    .then(() => {
      queue.size -= 1;
      if (queue.size === 0) queues.delete(jid);
    });
  return Promise.resolve(true);
}

function forget(jid) {
  return memory.delete(jid);
}

module.exports = { respond, shouldReply, forget };
