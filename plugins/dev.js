const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const LIMIT = 3500;
const SECRET_PATH = /(^|[\\/])(\.env[^\\/]*|creds\.json|session[^\\/]*|auth_info[^\\/]*|\.git[\\/]config)$|[\\/](session|auth_info)[^\\/]*[\\/]/i;

const isMainOwner = (ctx) => Boolean(ctx.Owner && !ctx.isSudo);

const clip = (text, limit = LIMIT) => (text.length > limit ? `${text.slice(0, limit)}\n…(${text.length - limit} more characters)` : text);

function resolveInside(input) {
  const target = path.resolve(ROOT, String(input || '').trim().replace(/^["']|["']$/g, ''));
  if (target !== ROOT && !target.startsWith(ROOT + path.sep)) return { error: '❌ That path is outside the bot folder.' };
  if (SECRET_PATH.test(target)) return { error: '❌ Session and secret files are blocked.' };
  return { target };
}

function sendText(client, m, text, name) {
  if (text.length <= LIMIT) return client.sendMessage(m.chat, { text }, { quoted: m });
  return client.sendMessage(m.chat, { document: Buffer.from(text), mimetype: 'text/plain', fileName: name }, { quoted: m });
}

module.exports = [
  {
    command: ['shell'],
    aliases: ['sh', 'exec', 'terminal'],
    description: 'Run a shell command on the bot server (main owner only)',
    category: 'developer',
    handler: async (client, m, ctx) => {
      const { NotOwner, reply, text, prefix } = ctx;
      if (!isMainOwner(ctx)) throw NotOwner;
      if (!text) return reply(`Usage: ${prefix}shell <command>\nExample: ${prefix}shell ls -la`);
      const started = Date.now();
      exec(text, { cwd: ROOT, timeout: 60000, maxBuffer: 5 * 1024 * 1024, shell: '/bin/bash' }, async (error, stdout, stderr) => {
        const seconds = ((Date.now() - started) / 1000).toFixed(1);
        let output = '';
        if (stdout) output += stdout;
        if (stderr) output += `${output ? '\n' : ''}${stderr}`;
        if (error && error.killed) output += `\n⏱️ Stopped after 60s.`;
        else if (error && !stderr) output += `\n${error.message}`;
        const code = error ? (error.killed ? 'timeout' : error.code) : 0;
        const header = `💻 *shell* (exit ${code}, ${seconds}s)\n\n`;
        const body = output.trim() || '(no output)';
        try {
          if (header.length + body.length <= LIMIT) await client.sendMessage(m.chat, { text: `${header}\`\`\`${body}\`\`\`` }, { quoted: m });
          else await client.sendMessage(m.chat, { document: Buffer.from(body), mimetype: 'text/plain', fileName: 'output.txt', caption: header.trim() }, { quoted: m });
        } catch (sendError) {
          console.error('[shell]', sendError.message);
        }
      });
    },
  },

  {
    command: ['cat'],
    aliases: ['readfile'],
    description: 'Show a file or list a folder (main owner only)',
    category: 'developer',
    handler: async (client, m, ctx) => {
      const { NotOwner, reply, text, prefix } = ctx;
      if (!isMainOwner(ctx)) throw NotOwner;
      if (!text) return reply(`Usage: ${prefix}cat <path>\nExample: ${prefix}cat plugins/menu.js`);
      const { target, error } = resolveInside(text);
      if (error) return reply(error);
      if (!fs.existsSync(target)) return reply('❌ File or folder not found.');
      const stat = fs.statSync(target);
      if (stat.isDirectory()) {
        const entries = fs.readdirSync(target, { withFileTypes: true })
          .map((e) => (e.isDirectory() ? `📁 ${e.name}/` : `📄 ${e.name}`));
        return sendText(client, m, `📂 *${path.relative(ROOT, target) || '.'}*\n\n${entries.join('\n') || '(empty)'}`, 'listing.txt');
      }
      if (stat.size > 2 * 1024 * 1024) return reply(`❌ File is ${(stat.size / 1048576).toFixed(1)} MB. Use *${prefix}getfile* to download it.`);
      const content = fs.readFileSync(target, 'utf8');
      if (content.includes('\u0000')) return reply(`❌ That looks like a binary file. Use *${prefix}getfile*.`);
      return sendText(client, m, content, path.basename(target));
    },
  },

  {
    command: ['getcmd'],
    aliases: ['cmdcode', 'getplugin'],
    description: 'Show the source code of a command (main owner only)',
    category: 'developer',
    handler: async (client, m, ctx) => {
      const { NotOwner, reply, text, prefix } = ctx;
      if (!isMainOwner(ctx)) throw NotOwner;
      const name = String(text || '').trim().toLowerCase().replace(new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), '');
      if (!name) return reply(`Usage: ${prefix}getcmd <command>\nExample: ${prefix}getcmd ping`);
      const plugin = require('../lib/handler').getPlugin(name);
      if (!plugin) return reply(`❌ No command named *${name}*.`);
      const names = [].concat(plugin.command, plugin.aliases || []).join(', ');
      const header = `🧩 *${name}*\nFile: plugins/${plugin._file}\nNames: ${names}\n\n`;
      return sendText(client, m, header + String(plugin.handler), `${name}.js`);
    },
  },

  {
    command: ['getfile'],
    aliases: ['sendfile', 'download-file'],
    description: 'Send a file from the bot folder (main owner only)',
    category: 'developer',
    handler: async (client, m, ctx) => {
      const { NotOwner, reply, text, prefix } = ctx;
      if (!isMainOwner(ctx)) throw NotOwner;
      if (!text) return reply(`Usage: ${prefix}getfile <path>\nExample: ${prefix}getfile package.json`);
      const { target, error } = resolveInside(text);
      if (error) return reply(error);
      if (!fs.existsSync(target) || !fs.statSync(target).isFile()) return reply('❌ File not found.');
      const stat = fs.statSync(target);
      if (stat.size > 90 * 1024 * 1024) return reply('❌ File is too large to send.');
      const ext = path.extname(target).toLowerCase();
      const mimes = { '.json': 'application/json', '.js': 'text/javascript', '.txt': 'text/plain', '.md': 'text/markdown', '.html': 'text/html', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.pdf': 'application/pdf', '.zip': 'application/zip' };
      return client.sendMessage(m.chat, {
        document: fs.readFileSync(target),
        mimetype: mimes[ext] || 'application/octet-stream',
        fileName: path.basename(target),
      }, { quoted: m });
    },
  },

  {
    command: ['fetch'],
    aliases: ['get', 'curl'],
    description: 'Fetch a URL and show or send the response (main owner only)',
    category: 'developer',
    handler: async (client, m, ctx) => {
      const { NotOwner, reply, text, prefix } = ctx;
      if (!isMainOwner(ctx)) throw NotOwner;
      const url = String(text || '').trim();
      if (!url) return reply(`Usage: ${prefix}fetch <url>\nExample: ${prefix}fetch https://api.github.com/users/octocat`);
      if (!/^https?:\/\//i.test(url)) return reply('❌ The link must start with http:// or https://');
      const started = Date.now();
      let response;
      try {
        response = await axios.get(url, {
          responseType: 'arraybuffer',
          timeout: 20000,
          maxContentLength: 60 * 1024 * 1024,
          maxBodyLength: 60 * 1024 * 1024,
          validateStatus: () => true,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TESLA-MD)' },
        });
      } catch (error) {
        return reply(`❌ Request failed: ${error.message}`);
      }

      const type = String(response.headers['content-type'] || 'unknown').split(';')[0].trim().toLowerCase();
      const body = Buffer.from(response.data);
      const head = `🌐 *fetch*\nStatus: ${response.status}\nType: ${type}\nSize: ${body.length < 1024 ? `${body.length} B` : `${(body.length / 1024).toFixed(1)} KB`}\nTime: ${Date.now() - started} ms`;

      if (type.startsWith('image/')) return client.sendMessage(m.chat, { image: body, caption: head }, { quoted: m });
      if (type.startsWith('video/')) return client.sendMessage(m.chat, { video: body, caption: head }, { quoted: m });
      if (type.startsWith('audio/')) return client.sendMessage(m.chat, { audio: body, mimetype: type }, { quoted: m });

      const textual = /json|text|xml|javascript|html|csv/.test(type);
      if (!textual) {
        const ext = (type.split('/')[1] || 'bin').replace(/[^a-z0-9]/g, '') || 'bin';
        return client.sendMessage(m.chat, { document: body, mimetype: type, fileName: `fetched.${ext}`, caption: head }, { quoted: m });
      }

      let content = body.toString('utf8');
      if (type.includes('json')) {
        try {
          content = JSON.stringify(JSON.parse(content), null, 2);
        } catch (error) { }
      }
      if (head.length + content.length <= LIMIT) return client.sendMessage(m.chat, { text: `${head}\n\n${content}` }, { quoted: m });
      const ext = type.includes('json') ? 'json' : type.includes('html') ? 'html' : 'txt';
      return client.sendMessage(m.chat, { document: Buffer.from(content), mimetype: type, fileName: `fetched.${ext}`, caption: head }, { quoted: m });
    },
  },

  {
    command: ['logout'],
    aliases: ['signout'],
    description: 'Log the bot out of WhatsApp (main owner only)',
    category: 'developer',
    handler: async (client, m, ctx) => {
      const { NotOwner, reply, text, prefix } = ctx;
      if (!isMainOwner(ctx)) throw NotOwner;
      if (String(text || '').trim().toLowerCase() !== 'confirm') {
        return reply(`⚠️ This logs the bot out of WhatsApp and kills the current session. You will need a new SESSION to bring it back.\n\nType *${prefix}logout confirm* to continue.`);
      }
      await reply('👋 Logging out. The session is now invalid; deploy a new SESSION to bring the bot back.');
      setTimeout(async () => {
        try {
          await client.logout();
        } catch (error) {
          console.error('[logout]', error.message || error);
        }
      }, 1000);
    },
  },
];
