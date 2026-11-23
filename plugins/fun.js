const advice = require('badadvice');
const axios = require('axios');
const { createSticker } = require('../lib/sticker');

module.exports = [
  {
    command: ['advice'],
    aliases: [],
    description: 'Get a random piece of advice',
    category: 'fun',
    handler: async (client, m, { reply }) => {
      reply(advice());
    },
  },

  {
    command: ['catfact'],
    aliases: [],
    description: 'Get a random cat fact',
    category: 'fun',
    handler: async (client, m) => {
      try {
        const { data } = await axios.get('https://catfact.ninja/fact', { timeout: 10000 });
        if (!data || !data.fact) throw new Error('empty response');
        await m.reply(data.fact);
      } catch (error) {
        m.reply('Could not fetch a cat fact right now.');
      }
    },
  },

  {
    command: ['fact'],
    aliases: [],
    description: 'Get a random fact',
    category: 'fun',
    handler: async (client, m) => {
      try {
        const { data } = await axios.get('https://uselessfacts.jsph.pl/api/v2/facts/random?language=en', { timeout: 10000 });
        if (!data || !data.text) throw new Error('empty response');
        await m.reply(data.text);
      } catch (error) {
        m.reply('Could not fetch a fact right now.');
      }
    },
  },

  {
    command: ['mix'],
    aliases: [],
    description: 'Combine two emojis',
    category: 'fun',
    handler: async (client, m, { botname, pushname, text }) => {
      if (!text) return m.reply("Give two emojis, separated by '+', like 😀+😂");

      const emojis = text.split('+').map((part) => part.trim()).filter(Boolean);
      if (emojis.length !== 2) return m.reply("Specify the emojis and separate with '+'");

      const [emoji1, emoji2] = emojis;
      try {
        const { data } = await axios.get(
          `https://emoji-kitchen-api.vercel.app/mix/${encodeURIComponent(emoji1)}/${encodeURIComponent(emoji2)}`,
          { responseType: 'arraybuffer', timeout: 15000 },
        );
        const sticker = await createSticker(Buffer.from(data), { mime: 'image/png', pack: botname, author: pushname });
        await client.sendMessage(m.chat, { sticker }, { quoted: m });
      } catch (error) {
        if (error.response && error.response.status === 404) {
          m.reply("Those two emojis don't have a mix.");
        } else {
          m.reply('The emoji mix service is unavailable right now.');
        }
      }
    },
  },

  {
    command: ['pickupline'],
    aliases: [],
    description: 'Get a random pickup line',
    category: 'fun',
    handler: async (client, m) => {
      try {
        const { data } = await axios.get('https://api.popcat.xyz/pickuplines', { timeout: 10000 });
        if (!data || !data.pickupline) throw new Error('empty response');
        await client.sendMessage(m.chat, { text: data.pickupline }, { quoted: m });
      } catch (error) {
        await client.sendMessage(m.chat, { text: 'Could not fetch a pickup line right now.' }, { quoted: m });
      }
    },
  },

  {
    command: ['quote'],
    aliases: [],
    description: 'Get a random quote',
    category: 'fun',
    handler: async (client, m) => {
      try {
        const { data } = await axios.get('https://favqs.com/api/qotd', { timeout: 10000 });
        if (!data || !data.quote) throw new Error('empty response');
        const text = `${data.quote.body}\n\n𝗤𝘂𝗼𝘁𝗲 𝗕𝘆 ${data.quote.author}`;
        await client.sendMessage(m.chat, { text }, { quoted: m });
      } catch (error) {
        await client.sendMessage(m.chat, { text: 'Could not fetch a quote right now.' }, { quoted: m });
      }
    },
  },
];
