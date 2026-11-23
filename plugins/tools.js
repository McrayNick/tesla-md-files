const acrcloud = require('acrcloud');
const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');
const yts = require('yt-search');
const { getAudio } = require('../lib/ytaudio');

module.exports = [
  {
    command: ['calculate'],
    aliases: ['calc'],
    description: 'Calculate a math expression',
    category: 'tools',
    handler: async (client, m, { text }) => {
      if (!text) return m.reply('*Example usage:* .calculate 5+72');
      if (!/^[0-9+\-*/().\s]+$/.test(text)) {
        return m.reply('Invalid format. Only numbers and +, -, *, /, ( ) are allowed.');
      }
      try {
        const result = Function(`"use strict"; return (${text});`)();
        if (typeof result !== 'number' || !Number.isFinite(result)) throw new Error('not a number');
        m.reply(`${result}`);
      } catch (error) {
        m.reply('Error in calculation. Please check your expression.');
      }
    },
  },

  {
    command: ['define'],
    aliases: [],
    description: 'Look up the meaning of a word',
    category: 'tools',
    handler: async (client, m, { text }) => {
      if (!text) return m.reply('Please provide a word.');
      try {
        const { data } = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(text)}`, { timeout: 10000 });
        const meanings = data && data[0] && data[0].meanings;
        if (!meanings || !meanings.length) return m.reply('No definitions found for the provided word.');
        await client.sendMessage(m.chat, { text: meanings[0].definitions[0].definition }, { quoted: m });
      } catch (error) {
        if (error.response && error.response.status === 404) return m.reply('No definitions found for the provided word.');
        m.reply('An error occurred while fetching the data. Please try again later.');
      }
    },
  },

  {
    command: ['github'],
    aliases: [],
    description: 'Show a GitHub user profile',
    category: 'tools',
    handler: async (client, m, { text }) => {
      if (!text) return m.reply('Provide a github username to stalk');
      try {
        const { data } = await axios.get(`https://api.github.com/users/${encodeURIComponent(text)}`, {
          timeout: 10000,
          headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'tesla-md' },
        });
        const message = `Username:- ${data.login}\n\nName:- ${data.name || 'n/a'}\n\nBio:- ${data.bio || 'n/a'}\n\nLink:- ${data.html_url}\n\nLocation:- ${data.location || 'n/a'}\n\nFollowers:- ${data.followers}\n\nFollowing:- ${data.following}\n\nRepos:- ${data.public_repos}\n\nCreated:- ${data.created_at}`;
        await client.sendMessage(m.chat, { image: { url: data.avatar_url }, caption: message }, { quoted: m });
      } catch (error) {
        if (error.response && error.response.status === 404) return m.reply('No GitHub user with that username.');
        m.reply('Unable to fetch data right now.');
      }
    },
  },

  {
    command: ['google'],
    aliases: [],
    description: 'Search Google',
    category: 'tools',
    handler: async (client, m, { text }) => {
      if (!text) return m.reply('Provide a search term!\nEg: .google What is treason');
      const key = process.env.GOOGLE_API_KEY;
      const cx = process.env.GOOGLE_CX;
      if (!key || !cx) return m.reply('This command needs GOOGLE_API_KEY and GOOGLE_CX to be set by the bot owner.');
      try {
        const { data } = await axios.get('https://www.googleapis.com/customsearch/v1', {
          params: { q: text, key, cx },
          timeout: 10000,
        });
        if (!data.items || !data.items.length) return m.reply('❌ Unable to find a result');
        let message = `GOOGLE SEARCH\n🔍 Term:- ${text}\n\n`;
        for (const item of data.items.slice(0, 5)) {
          message += `🪧 Title:- ${item.title}\n🖥 Description:- ${item.snippet}\n🌐 Link:- ${item.link}\n\n`;
        }
        m.reply(message);
      } catch (error) {
        m.reply('An error occurred while searching.');
      }
    },
  },

  {
    command: ['gpass'],
    aliases: ['genpassword'],
    description: 'Generate a strong password',
    category: 'tools',
    handler: async (client, m, { args, from, reply }) => {
      const length = args[0] ? parseInt(args[0], 10) : 12;
      if (Number.isNaN(length) || length < 8) {
        return reply('Please provide a valid length for the password (minimum 8 characters).');
      }
      const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+[]{}|;:,.<>?';
      let password = '';
      for (let i = 0; i < length; i++) password += charset[crypto.randomInt(0, charset.length)];
      await client.sendMessage(from, { text: 'Below is your password 🔥:' }, { quoted: m });
      await client.sendMessage(from, { text: password }, { quoted: m });
    },
  },

  {
    command: ['img'],
    aliases: ['ai-img', 'image', 'images'],
    description: 'Search for images',
    category: 'tools',
    handler: async (client, m, { botname, text }) => {
      if (!text) return m.reply('Provide a text');
      try {
        const { data } = await axios.get('https://api.openverse.org/v1/images/', {
          params: { q: text, page_size: 5 },
          timeout: 15000,
          headers: { 'User-Agent': 'tesla-md' },
        });
        const results = (data.results || []).filter((item) => item.url).slice(0, 5);
        if (!results.length) return m.reply('No images found.');
        for (const item of results) {
          const credit = item.creator ? ` — by ${item.creator}` : '';
          await client.sendMessage(m.chat, { image: { url: item.url }, caption: `${item.title || 'Untitled'}${credit}\nvia ${botname}` }, { quoted: m });
        }
      } catch (error) {
        m.reply('An error occurred while searching for images.');
      }
    },
  },

  {
    command: ['inspect'],
    aliases: [],
    description: "Fetch a website's HTML, CSS and JavaScript",
    category: 'tools',
    handler: async (client, m, { text }) => {
      if (!text) return m.reply('Provide a valid web link to fetch! The bot will crawl the website and fetch its HTML, CSS, JavaScript, and any media embedded in it.');
      if (!/^https?:\/\//i.test(text)) return m.reply('Please provide a URL starting with http:// or https://');

      const clip = (value, limit = 3500) => (value.length > limit ? `${value.slice(0, limit)}\n…(truncated)` : value);

      try {
        const { data: html } = await axios.get(text, { timeout: 15000, responseType: 'text' });
        const $ = cheerio.load(html);

        const mediaFiles = [];
        $('img[src], video[src], audio[src]').each((i, el) => {
          const src = $(el).attr('src');
          if (src) mediaFiles.push(src);
        });
        const cssFiles = [];
        $('link[rel="stylesheet"]').each((i, el) => {
          const href = $(el).attr('href');
          if (href) cssFiles.push(href);
        });
        const jsFiles = [];
        $('script[src]').each((i, el) => {
          const src = $(el).attr('src');
          if (src) jsFiles.push(src);
        });

        await m.reply(`**HTML Content**:\n\n${clip(html)}`);

        if (cssFiles.length) {
          for (const cssFile of cssFiles.slice(0, 3)) {
            try {
              const { data: css } = await axios.get(new URL(cssFile, text).toString(), { timeout: 10000, responseType: 'text' });
              await m.reply(`**CSS File (${cssFile})**:\n\n${clip(css)}`);
            } catch (error) {
              await m.reply(`Could not fetch CSS file: ${cssFile}`);
            }
          }
        } else {
          await m.reply('No external CSS files found.');
        }

        if (jsFiles.length) {
          for (const jsFile of jsFiles.slice(0, 3)) {
            try {
              const { data: js } = await axios.get(new URL(jsFile, text).toString(), { timeout: 10000, responseType: 'text' });
              await m.reply(`**JavaScript File (${jsFile})**:\n\n${clip(js)}`);
            } catch (error) {
              await m.reply(`Could not fetch JS file: ${jsFile}`);
            }
          }
        } else {
          await m.reply('No external JavaScript files found.');
        }

        await m.reply(mediaFiles.length ? `**Media Files Found**:\n${mediaFiles.slice(0, 20).join('\n')}` : 'No media files (images, videos, audios) found.');
      } catch (error) {
        m.reply('An error occurred while fetching the website content.');
      }
    },
  },

  {
    command: ['lyrics'],
    aliases: [],
    description: 'Get song lyrics',
    category: 'tools',
    handler: async (client, m, { text }) => {
      if (!text) return m.reply('Provide a song name!');
      try {
        const { data } = await axios.get('https://lrclib.net/api/search', { params: { q: text }, timeout: 10000 });
        const result = Array.isArray(data) ? data.find((track) => track.plainLyrics) : null;
        if (!result) return m.reply(`Sorry, I couldn't find any lyrics for "${text}".`);
        const caption = `**Title**: ${result.trackName}\n**Artist**: ${result.artistName}\n\n${result.plainLyrics}`;
        await client.sendMessage(m.chat, { text: caption }, { quoted: m });
      } catch (error) {
        m.reply(`An error occurred while fetching the lyrics for "${text}".`);
      }
    },
  },

  {
    command: ['movie'],
    aliases: [],
    description: 'Get movie or series info',
    category: 'tools',
    handler: async (client, m, { from, reply, text }) => {
      if (!text) return reply('Provide a series or movie name.');
      const key = process.env.OMDB_KEY;
      if (!key) return reply('This command needs OMDB_KEY to be set by the bot owner.');
      try {
        const { data } = await axios.get('http://www.omdbapi.com/', { params: { apikey: key, t: text, plot: 'full' }, timeout: 10000 });
        if (data.Response === 'False') return reply(data.Error || 'No result found for that title.');
        const info = [
          `🎬Title      : ${data.Title}`,
          `📅Year       : ${data.Year}`,
          `⭐Rated      : ${data.Rated}`,
          `📆Released   : ${data.Released}`,
          `⏳Runtime    : ${data.Runtime}`,
          `🌀Genre      : ${data.Genre}`,
          `👨🏻‍💻Director   : ${data.Director}`,
          `✍Writer     : ${data.Writer}`,
          `👨Actors     : ${data.Actors}`,
          `📃Plot       : ${data.Plot}`,
          `🌐Language   : ${data.Language}`,
          `🌍Country    : ${data.Country}`,
          `🎖️Awards     : ${data.Awards}`,
          `📦BoxOffice  : ${data.BoxOffice}`,
          `🏙️Production : ${data.Production}`,
          `🌟imdbRating : ${data.imdbRating}`,
          `❎imdbVotes  : ${data.imdbVotes}`,
        ].join('\n');
        await client.sendMessage(from, { image: { url: data.Poster }, caption: info }, { quoted: m });
      } catch (error) {
        reply('Could not fetch movie info right now.');
      }
    },
  },

  {
    command: ['screenshot'],
    aliases: ['ss'],
    description: 'Take a screenshot of a website',
    category: 'tools',
    handler: async (client, m, { botname, text }) => {
      if (!text) return m.reply('Provide a website link to screenshot.');
      if (!/^https?:\/\//i.test(text)) return m.reply('Please provide a URL starting with http:// or https://');
      try {
        const image = `https://image.thum.io/get/fullpage/${encodeURIComponent(text)}`;
        await client.sendMessage(m.chat, { image: { url: image }, caption: `Screenshot by ${botname}` }, { quoted: m });
      } catch (error) {
        m.reply('An error occurred.');
      }
    },
  },

  {
    command: ['trt'],
    aliases: ['translate'],
    description: 'Translate text',
    category: 'tools',
    handler: async (client, m, { text }) => {
      if (!text) return m.reply('Please provide a language code and text to translate!');
      const parts = text.split(' ');
      if (parts.length < 2) return m.reply('Please provide a language code and text to translate!');
      const targetLang = parts[0];
      const textToTranslate = parts.slice(1).join(' ');
      try {
        const { data } = await axios.get('https://api.mymemory.translated.net/get', {
          params: { q: textToTranslate, langpair: `en|${targetLang}` },
          timeout: 10000,
        });
        const translated = data.responseData && data.responseData.translatedText;
        if (!translated) return m.reply('No translation found for the provided text.');
        await client.sendMessage(m.chat, { text: translated }, { quoted: m });
      } catch (error) {
        m.reply('An error occurred while fetching the data. Please try again later.');
      }
    },
  },

  {
    command: ['tts'],
    aliases: ['say'],
    description: 'Convert text to speech',
    category: 'tools',
    handler: async (client, m, { args, text }) => {
      const googleTTS = require('google-tts-api');
      if (!text) return m.reply('Provide a text for conversion! Optionally start with a language code, like .tts fr Bonjour');

      const langs = ['af', 'ar', 'bn', 'de', 'en', 'es', 'fr', 'hi', 'id', 'it', 'ja', 'ko', 'nl', 'pt', 'ru', 'sw', 'tr', 'vi', 'zh'];
      let lang = 'en';
      let spoken = text;
      if (args.length > 1 && langs.includes(args[0].toLowerCase())) {
        lang = args[0].toLowerCase();
        spoken = args.slice(1).join(' ');
      }

      try {
        const url = googleTTS.getAudioUrl(spoken, { lang, slow: false, host: 'https://translate.google.com' });
        await client.sendMessage(m.chat, { audio: { url }, mimetype: 'audio/mp4', ptt: true }, { quoted: m });
      } catch (error) {
        m.reply('Could not convert that to speech.');
      }
    },
  },

  {
    command: ['weather'],
    aliases: [],
    description: 'Get the weather for a city',
    category: 'tools',
    handler: async (client, m, { text }) => {
      if (!text) return m.reply('Provide a city/town name');
      const key = process.env.OPENWEATHER_KEY;
      if (!key) return m.reply('This command needs OPENWEATHER_KEY to be set by the bot owner.');
      try {
        const { data } = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
          params: { q: text, units: 'metric', appid: key },
          timeout: 10000,
        });
        const sunrise = new Date(data.sys.sunrise * 1000);
        const sunset = new Date(data.sys.sunset * 1000);
        await m.reply(`❄️ Weather in ${data.name}\n\n🌡️ Temperature: ${data.main.temp}°C\n📝 Description: ${data.weather[0].description}\n❄️ Humidity: ${data.main.humidity}%\n🌀 Wind Speed: ${data.wind.speed} m/s\n🌧️ Rain Volume (last hour): ${data.rain ? data.rain['1h'] || 0 : 0} mm\n☁️ Cloudiness: ${data.clouds.all}%\n🌄 Sunrise: ${sunrise.toLocaleTimeString()}\n🌅 Sunset: ${sunset.toLocaleTimeString()}`);
      } catch (error) {
        m.reply('Unable to find that location.');
      }
    },
  },

  {
    command: ['whatsong'],
    aliases: ['shazam'],
    description: 'Identify a song from audio or video',
    category: 'tools',
    handler: async (client, m, { args, from, reply }) => {
      const accessKey = process.env.ACR_ACCESS_KEY || '2631ab98e77b49509e3edcf493757300';
      const accessSecret = process.env.ACR_ACCESS_SECRET || 'KKbVWlTNCL3JjxjrWnywMdvQGanyhKRN0fpQxyUo';

      if (!m.quoted) throw 'Tag a short video or audio';
      const quoted = m.quoted;
      const mime = (quoted.msg || quoted).mimetype || quoted.mediaType || '';
      if (!/video|audio/.test(mime)) throw 'Tag a short video or audio';

      const acr = new acrcloud({
        host: process.env.ACR_HOST || 'identify-eu-west-1.acrcloud.com',
        access_key: accessKey,
        access_secret: accessSecret,
      });

      try {
        const buffer = await quoted.download();
        await reply('Analyzing the media...');

        const { status, metadata } = await acr.identify(buffer);
        if (status.code !== 0) throw new Error(status.msg);

        const { title, artists, album, genres, release_date } = metadata.music[0];
        let caption = `*• Title:* ${title}`;
        if (artists) caption += `\n*• Artists:* ${artists.map((a) => a.name).join(', ')}`;
        if (album) caption += `\n*• Album:* ${album.name}`;
        if (genres) caption += `\n*• Genres:* ${genres.map((g) => g.name).join(', ')}`;
        caption += `\n*• Release Date:* ${release_date}`;
        await client.sendMessage(m.chat, { text: caption.trim() }, { quoted: m });

        const { videos } = await yts(artists && artists.length ? `${title} ${artists[0].name}` : title);
        if (!videos || !videos.length) {
          reply(`No matching videos found for: *${title}*`);
          return;
        }

        const video = videos[0];
        if (video.seconds && video.seconds >= 1800) {
          reply('Too big!');
          return;
        }

        let audio;
        try {
          audio = await getAudio(video.url);
        } catch (error) {
          reply(`Song identified, but the download failed: ${error.message || error}`);
          return;
        }
        try {
          const safeTitle = video.title.replace(/[\\/:*?"<>|]/g, '');
          await client.sendMessage(from, {
            document: { url: audio.url },
            mimetype: audio.source === 'yt-dlp' ? 'audio/mp4' : 'audio/mpeg',
            fileName: audio.source === 'yt-dlp' ? `${safeTitle}.m4a` : `${safeTitle}.mp3`,
          }, { quoted: m });
        } finally {
          await audio.cleanup();
        }
      } catch (error) {
        reply(`Could not identify that: ${error.message || error}`);
      }
    },
  },

  {
    command: ['wikipedia'],
    aliases: ['wiki'],
    description: 'Search Wikipedia',
    category: 'tools',
    handler: async (client, m, { text }) => {
      if (!text) return m.reply('❗ Enter what you want to search for on Wikipedia');
      try {
        const { data } = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(text)}`, {
          timeout: 10000,
          headers: { 'User-Agent': 'tesla-md' },
        });
        const message = `▢ *Wikipedia Search Result* 🧐\n\n‣ *Title*: ${data.title} 📚\n\n${data.extract} 📖`;
        await m.reply(message);
      } catch (error) {
        if (error.response && error.response.status === 404) return m.reply('⚠️ No results found for that term.');
        await m.reply('⚠️ No results found or failed to fetch data. Try again later!');
      }
    },
  },
];
