const acrcloud = require('acrcloud');
const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');
const yts = require('yt-search');
const fs = require('fs');
const { getAudio } = require('../lib/ytaudio');
const { runFfmpeg, tempFile } = require('../lib/sticker');

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
    command: ['funfact'],
    aliases: ['fact'],
    description: 'Get a random pickup line',
    category: 'tools',
    handler: async (client, m) => {
  const url = 'https://uselessfacts.jsph.pl/random.json?language=en';
        const response = await global.axios.get(url);
        const fact = response.data.text;
  m.reply(fact)
   }
 },

    {
    command: ['joke'],
    description: 'Get a random joke',
    category: 'tools',
    handler: async (client, m, { reply }) => {
      try {
        const response = await global.axios.get('https://official-joke-api.appspot.com/random_joke');
        const joke = response.data;
        const jokeMessage = `*${joke.setup}*\n\n*${joke.punchline}* 😄`;
        return reply(jokeMessage);
      } catch (e) {
        return reply("Couldn't fetch a joke right now. Please try again later.");
      }
    }
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
    command: ['translate'],
    aliases: ['tl', 'trt', 'trans'],
    description: 'Translate text to any language',
    category: 'tools',
    handler: async (client, m, { reply, text }) => {
      const axios = require('axios');

      const langNames = {
        english: 'en', spanish: 'es', french: 'fr', german: 'de',
        italian: 'it', portuguese: 'pt', russian: 'ru', arabic: 'ar',
        chinese: 'zh', japanese: 'ja', korean: 'ko', hindi: 'hi',
        swahili: 'sw', yoruba: 'yo', zulu: 'zu', igbo: 'ig',
        hausa: 'ha', amharic: 'am', somali: 'so', turkish: 'tr',
        dutch: 'nl', polish: 'pl', swedish: 'sv', greek: 'el',
        hebrew: 'he', thai: 'th', vietnamese: 'vi', indonesian: 'id',
        afrikaans: 'af', romanian: 'ro', ukrainian: 'uk', bengali: 'bn',
        urdu: 'ur', persian: 'fa', malay: 'ms', danish: 'da',
      };

      const quotedText = m.quoted?.text
                      || m.quoted?.caption
                      || m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation
                      || m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage?.text
                      || '';

      let targetLang = 'en';
      let inputText  = '';

      if (!text && !quotedText) {
        return reply(
          '🌍 *Translate — Usage:*\n\n' +
          '• *.translate Hello world* → to English\n' +
          '• *.translate es Hello world* → to Spanish\n' +
          '• *.translate fr* (reply to a message) → to French\n' +
          '• *.translate arabic* (reply to a message) → to Arabic\n\n' +
          '_Codes: en es fr de ar zh ja ko hi sw yo zu ig ha am tr nl pl sv el he th vi id af ro uk bn ur fa_'
        );
      }

      if (text) {
        const parts     = text.trim().split(/\s+/);
        const firstWord = parts[0].toLowerCase();
        const isLangName = langNames[firstWord];
        const isLangCode = /^[a-z]{2,3}$/.test(firstWord) && parts.length > 1;

        if (isLangName) {
          targetLang = isLangName;
          inputText  = parts.slice(1).join(' ');
        } else if (isLangCode) {
          targetLang = firstWord;
          inputText  = parts.slice(1).join(' ');
        } else {
          inputText = text.trim();
        }
      }

      if (!inputText.trim() && quotedText) inputText = quotedText.trim();

      if (!inputText.trim()) return reply('❌ No text to translate. Type text or reply to a message.');

      try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&dt=ld&q=${encodeURIComponent(inputText)}`;
        const res = await axios.get(url, { timeout: 15000 });

        const translated = (res.data[0] || []).map(seg => seg?.[0] || '').join('').trim();
        if (!translated) return reply('❌ Translation failed. Try again.');

        const detectedLang = res.data?.[2] || 'auto';
        const toLang   = Object.entries(langNames).find(([, v]) => v === targetLang)?.[0]   || targetLang.toUpperCase();
        const fromLang = Object.entries(langNames).find(([, v]) => v === detectedLang)?.[0] || detectedLang.toUpperCase();

        await client.sendMessage(m.chat, {
          text: `🌍 *Translation*\n📥 *From:* ${fromLang}\n📤 *To:* ${toLang}\n\n${translated}`,
        }, { quoted: m });

      } catch (err) {
        console.error('translate error:', err.message);
        reply('❌ Translation failed. Try again in a moment.');
      }
    }
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
    command: ['bible'],
    aliases: ['bibble-verse'],
    description: 'Get a Bible verse',
    category: 'tools',
    handler: async (client, m, { reply, text, pushname }) => {
      if (!text) return reply('Please provide a Bible reference.\n\nExample: bible John 3:16');
      try {
        const response = await global.axios.get(`https://bible-api.com/${encodeURIComponent(text)}`);
        if (response.status === 200 && response.data.text) {
          const { reference: ref, text: verseText, translation_name } = response.data;
          reply(
            `*Hello there, below is what you requested*\n\n` +
            `📖 *Reference:* ${ref}\n` +
            ` ${verseText}\n\n` +
            `_Requested by ${pushname}_`
          );
        } else {
          reply('*Verse not found.* Please check the reference and try again.');
        }
      } catch (error) {
        reply('*An error occurred while fetching the Bible verse.* Please try again.');
      }
    }
  },

  {
    command: ['quran'],
    aliases: ['surah'],
    description: 'Get a Quran verse',
    category: 'tools',
    handler: async (client, m, { reply, text, pushname }) => {
      if (!text) return reply('Please provide Surah and Ayah\n*Example:* quran 2:255');
      const input = text.split(':');
      if (input.length !== 2) return reply('Incorrect format. Use: Surah:Ayah (e.g. 2:255)');
      const [surah, ayah] = input;
      try {
        const res = await global.axios.get(`https://api.alquran.cloud/v1/ayah/${surah}:${ayah}/editions/quran-uthmani,en.asad`);
        const arabic = res.data.data[0].text;
        const english = res.data.data[1].text;
        const surahInfo = res.data.data[0].surah;
        const msg =
          `*Holy Qur'an Verse*\n\n` +
          `*Surah:* ${surahInfo.englishName} (${surahInfo.name})\n` +
          `*Ayah:* ${ayah}\n\n` +
          `*Arabic:* ${arabic}\n\n` +
          `*English:* ${english}\n\n` +
          `_Requested by ${pushname}_`;
        client.sendMessage(m.chat, { text: msg }, { quoted: m });
      } catch (e) {
        reply('Could not find the verse. Please check the Surah and Ayah.');
      }
    }
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

      let mp3;
      try {
        const urls = googleTTS.getAllAudioUrls(spoken, { lang, slow: false, host: 'https://translate.google.com', splitPunct: ',.?!' }).map((part) => part.url);
        const parts = [];
        for (const url of urls.slice(0, 8)) {
          const { data } = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } });
          parts.push(Buffer.from(data));
        }
        mp3 = Buffer.concat(parts);
        if (!mp3.length) throw new Error('empty audio');
      } catch (error) {
        return m.reply('Could not convert that to speech.');
      }

      const input = tempFile('mp3');
      const output = tempFile('ogg');
      try {
        fs.writeFileSync(input, mp3);
        await runFfmpeg(['-y', '-i', input, '-vn', '-c:a', 'libopus', '-b:a', '48k', '-ar', '48000', '-ac', '1', '-f', 'ogg', output]);
        await client.sendMessage(m.chat, { audio: fs.readFileSync(output), mimetype: 'audio/ogg; codecs=opus', ptt: true }, { quoted: m });
      } catch (error) {
        try {
          await client.sendMessage(m.chat, { audio: mp3, mimetype: 'audio/mpeg', ptt: false }, { quoted: m });
        } catch (sendError) {
          m.reply('Could not convert that to speech.');
        }
      } finally {
        for (const file of [input, output]) fs.rmSync(file, { force: true });
      }
    },
  },

    {
    command: ['weather'],
    description: 'Get weather for a location',
    category: 'tools',
    handler: async (client, m, { reply, text }) => {
      if (!text) return reply('provide a city/town name');
      try {
        const response = await fetch(`http://api.openweathermap.org/data/2.5/weather?q=${text}&units=metric&appid=1ad47ec6172f19dfaf89eb3307f74785`);
        const data = await response.json();
        const cityName = data.name;
        const temperature = data.main.temp;
        const description = data.weather[0].description;
        const humidity = data.main.humidity;
        const windSpeed = data.wind.speed;
        const rainVolume = data.rain ? data.rain['1h'] : 0;
        const cloudiness = data.clouds.all;
        const sunrise = new Date(data.sys.sunrise * 1000);
        const sunset = new Date(data.sys.sunset * 1000);
        await m.reply(
          `❄️ Weather in ${cityName}\n\n` +
          `🌡️ Temperature: ${temperature}°C\n` +
          `📝 Description: ${description}\n` +
          `❄️ Humidity: ${humidity}%\n` +
          `🌀 Wind Speed: ${windSpeed} m/s\n` +
          `🌧️ Rain Volume (last hour): ${rainVolume} mm\n` +
          `☁️ Cloudiness: ${cloudiness}%\n` +
          `🌄 Sunrise: ${sunrise.toLocaleTimeString()}\n` +
          `🌅 Sunset: ${sunset.toLocaleTimeString()}`
        );
      } catch (e) {
        m.reply('Unable to find that location.');
      }
    }
  },

  {
    command: ['movie'],
    aliases: ['mv'],
    description: 'Search IMDB for a movie or series',
    category: 'tools',
    handler: async (client, m, { reply, text, from }) => {
      if (!text) return reply('Provide a series or movie name.');
      let fids = await global.axios.get(`http://www.omdbapi.com/?apikey=742b2d09&t=${encodeURIComponent(text)}&plot=full`);
      let imdbt =
        '⚍⚎⚎⚎⚎⚎⚎⚎⚎⚎⚎⚎⚎⚎⚎⚍\n ``` IMDB MOVIE SEARCH```\n⚎⚎⚎⚎⚎⚎⚎⚎⚎⚎⚎⚎⚎⚎⚎⚎\n' +
        `🎬Title      : ${fids.data.Title}\n` +
        `📅Year       : ${fids.data.Year}\n` +
        `⭐Rated      : ${fids.data.Rated}\n` +
        `📆Released   : ${fids.data.Released}\n` +
        `⏳Runtime    : ${fids.data.Runtime}\n` +
        `🌀Genre      : ${fids.data.Genre}\n` +
        `👨🏻‍💻Director   : ${fids.data.Director}\n` +
        `✍Writer     : ${fids.data.Writer}\n` +
        `👨Actors     : ${fids.data.Actors}\n` +
        `📃Plot       : ${fids.data.Plot}\n` +
        `🌐Language   : ${fids.data.Language}\n` +
        `🌍Country    : ${fids.data.Country}\n` +
        `🎖️Awards     : ${fids.data.Awards}\n` +
        `📦BoxOffice  : ${fids.data.BoxOffice}\n` +
        `🏙️Production : ${fids.data.Production}\n` +
        `🌟imdbRating : ${fids.data.imdbRating}\n` +
        `❎imdbVotes  : ${fids.data.imdbVotes}`;
      client.sendMessage(from, { image: { url: fids.data.Poster }, caption: imdbt }, { quoted: m });
    }
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
