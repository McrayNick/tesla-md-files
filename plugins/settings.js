const { getSettings, updateSetting } = require('../database/config');

const ACTION_LIST = ['delete', 'warn', 'kick'];

function guardCommand({ command, aliases, key, label, description }) {
  return {
    command: [command],
    aliases,
    description,
    category: 'settings',
    handler: async (client, m, { NotOwner, Owner, reply, text, prefix }) => {
      if (!Owner) throw NotOwner;
      const settings = await getSettings();
      const parts = String(text || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
      const sub = parts[0];
      const value = parts[1];
      const summary = () => [
        `🛡️ *${label.toUpperCase()}*`,
        '',
        `• Status: ${settings[key] === 'on' ? '🟢 ON' : '🔴 OFF'}`,
        `• Action: ${String(settings[key + 'action'] || 'kick').toUpperCase()}`,
        `• Warnings before removal: ${settings[key + 'warns'] || 3}`,
        '',
        `${prefix}${command} on/off`,
        `${prefix}${command} action delete/warn/kick`,
        `${prefix}${command} warns 3`,
      ].join('\n');

      if (!sub || sub === 'status') return reply(summary());

      if (sub === 'on' || sub === 'off') {
        if (settings[key] === sub) return reply(`✅ ${label} is already *${sub.toUpperCase()}*`);
        await updateSetting(key, sub);
        return reply(`✅ ${label} has been turned *${sub.toUpperCase()}*`);
      }

      if (sub === 'action') {
        if (!ACTION_LIST.includes(value)) return reply(`Usage: ${prefix}${command} action delete/warn/kick`);
        await updateSetting(key + 'action', value);
        return reply(`✅ ${label} action set to *${value.toUpperCase()}*`);
      }

      if (sub === 'warns') {
        const count = parseInt(value, 10);
        if (!count || count < 1 || count > 10) return reply(`Usage: ${prefix}${command} warns 1-10`);
        await updateSetting(key + 'warns', String(count));
        return reply(`✅ Members are removed after *${count}* warning${count === 1 ? '' : 's'}`);
      }

      reply(summary());
    },
  };
}

module.exports = [

  guardCommand({ command: 'antigroupstatus', aliases: ['antigstatus', 'antigs'], key: 'antigroupstatus', label: 'Anti group status', description: 'Block group status posts: on/off, action delete|warn|kick, warns <n>' }),
  guardCommand({ command: 'antigroupmention', aliases: ['antigmention', 'antigm'], key: 'antigroupmention', label: 'Anti group mention', description: 'Block group mentions in statuses: on/off, action delete|warn|kick, warns <n>' }),
  guardCommand({ command: 'antitagall', aliases: ['antimasstag'], key: 'antitagall', label: 'Anti tag all', description: 'Block mass tagging: on/off, action delete|warn|kick, warns <n>' }),

  {
    command: ['menutype'],
    aliases: ['menustyle'],
    description: 'Set how the menu is sent: text, image or video',
    category: 'settings',
    handler: async (client, m, { NotOwner, Owner, reply, text }) => {
      if (!Owner) throw NotOwner;
      const settings = await getSettings();
      const current = String(settings.menutype || 'VIDEO').toLowerCase();
      const wanted = String(text || '').trim().toLowerCase();
      if (!wanted) return reply(`📜 Menu type is currently *${current.toUpperCase()}*\n\nUsage: menutype text/image/video`);
      if (!['text', 'image', 'video'].includes(wanted)) return reply('Usage: menutype text/image/video');
      if (wanted === current) return reply(`✅ Menu type is already *${wanted.toUpperCase()}*`);
      const saved = await updateSetting('menutype', wanted.toUpperCase());
      if (!saved) return reply('❌ Could not save the menu type. Try again.');
      reply(`✅ Menu type updated to *${wanted.toUpperCase()}*`);
    },
  },

  {
    command: ['settings'],
    aliases: ['setting', 'botsettings'],
    description: 'Show every database setting and its current state',
    category: 'settings',
    handler: async (client, m, { NotOwner, Owner, reply }) => {
      if (!Owner) throw NotOwner;
      const settings = await getSettings();
      const labels = {
        mode: 'Mode',
        prefix: 'Prefix',
        menutype: 'Menu type',
        wapresence: 'Presence',
        autoread: 'Auto read',
        autoview: 'Auto view status',
        autolike: 'Auto like status',
        autobio: 'Auto bio',
        antilink: 'Anti link',
        antilinkall: 'Anti link all',
        antilinkaction: 'Anti link action',
        antilinkwarns: 'Anti link warnings',
        antitag: 'Anti tag',
        antigroupstatus: 'Anti group status',
        antigroupstatusaction: 'Anti group status action',
        antigroupstatuswarns: 'Anti group status warnings',
        antigroupmention: 'Anti group mention',
        antigroupmentionaction: 'Anti group mention action',
        antigroupmentionwarns: 'Anti group mention warnings',
        antitagall: 'Anti tag all',
        antitagallaction: 'Anti tag all action',
        antitagallwarns: 'Anti tag all warnings',
        antibot: 'Anti bot',
        antidelete: 'Anti delete',
        anticall: 'Anti call',
        antidemote: 'Anti demote',
        antipromote: 'Anti promote',
        badword: 'Bad word filter',
        badwordaction: 'Bad word action',
        badwordwarns: 'Bad word warnings',
        welcome: 'Welcome',
        gptdm: 'GPT in DMs',
      };
      const show = (value) => {
        const v = String(value);
        if (v === 'on') return '🟢 ON';
        if (v === 'off') return '🔴 OFF';
        return `🔹 ${v.toUpperCase()}`;
      };
      const lines = Object.keys(labels)
        .filter((key) => settings[key] !== undefined)
        .map((key) => `• ${labels[key]} (${key}): ${key === 'prefix' ? `[ ${settings[key]} ]` : show(settings[key])}`);
      const sudoCount = String(settings.sudo || '').split(',').map((n) => n.trim()).filter(Boolean).length;
      lines.push(`• Sudo users (sudo): ${sudoCount}`);
      reply(`⚙️ *BOT SETTINGS*\n\n${lines.join('\n')}\n\n_Change one with its command, for example: antilink on_`);
    },
  },
  {
    command: ['antibot'],
    aliases: [],
    description: 'Remove other bots that join your group (on/off)',
    category: 'settings',
    handler: async (client, m, { NotOwner, Owner, reply, text }) => {
    {
    	if(!Owner) throw NotOwner;
      const settings = await getSettings();
      const current = settings.antibot;
      if (!text) return reply(`👾 Antibot is currently *${current.toUpperCase()}*`);
      if (!["on", "off"].includes(text)) return reply("Usage: antibot on/off");
      if (text === current) return reply(`✅ Antibot is already *${text.toUpperCase()}*`);
      await updateSetting("antibot", text);
      reply(`✅ Antibot has been turned *${text.toUpperCase()}*`);
    }
    },
  },

  {
    command: ['anticall'],
    aliases: [],
    description: 'Reject incoming calls automatically (on/off)',
    category: 'settings',
    handler: async (client, m, { NotOwner, Owner, reply, text }) => {
    {
    	if(!Owner) throw NotOwner;
      const settings = await getSettings();
      const current = settings.anticall;
      if (!text) return reply(`🔰 Anticall is currently *${current.toUpperCase()}*`);
      if (!["on", "off"].includes(text)) return reply("Usage: Anticall on/off");
      if (text === current) return reply(`✅ Anticall is already *${text.toUpperCase()}*`);
      await updateSetting("anticall", text);
      reply(`✅ Anticall has been turned *${text.toUpperCase()}*`);
    }
    },
  },

  {
    command: ['antidelete'],
    aliases: [],
    description: 'Resend messages that get deleted (on/off)',
    category: 'settings',
    handler: async (client, m, { NotOwner, Owner, reply, text }) => {
    {
    	if(!Owner) throw NotOwner;
      const settings = await getSettings();
      const current = settings.antidelete;
      if (!text) return reply(`😊 Antidelete is currently *${current.toUpperCase()}*`);
      if (!["chat", "private", "both", "on",  "off"].includes(text)) return reply("USAGE:\n\n- antidelete on - To initialize antidelete\n- Antidelete chat - To ennable on present chat\n- Antidelete private - Send notification on the bot number only\n- Antidelete off - To put off the system\n- Antidelete both - To enable on both chat and owner bot");
      if (text === current) return reply(`✅ Antidelete is already *${text.toUpperCase()}*`);
      await updateSetting("antidelete", text);
      reply(`✅ Antidelete has been turned *${text.toUpperCase()}*`);
    }
    },
  },

  {
    command: ['antilink'],
    aliases: [],
    description: 'Antilink: on/off, action delete|warn|kick, warns <n>, allow/unallow <domain>, list',
    category: 'settings',
    handler: async (client, m, { NotOwner, Owner, reply, text, prefix }) => {
      if (!Owner) throw NotOwner;
      const antilink = require('../lib/antilink');
      const settings = await getSettings();
      const parts = String(text || '').trim().split(/\s+/).filter(Boolean);
      const sub = (parts[0] || '').toLowerCase();
      const value = (parts[1] || '').toLowerCase();
      const allowList = antilink.parseList(settings.antilinkallow);

      const summary = () => [
        '🛡️ *ANTILINK*',
        '',
        `• Group links (antilink): ${settings.antilink === 'on' ? '🟢 ON' : '🔴 OFF'}`,
        `• All links (antilinkall): ${settings.antilinkall === 'on' ? '🟢 ON' : '🔴 OFF'}`,
        `• Action: ${String(settings.antilinkaction || 'kick').toUpperCase()}`,
        `• Warnings before removal: ${settings.antilinkwarns || 3}`,
        `• Allowed domains: ${allowList.length ? allowList.join(', ') : 'none'}`,
        '',
        `${prefix}antilink on/off`,
        `${prefix}antilink action delete/warn/kick`,
        `${prefix}antilink warns 3`,
        `${prefix}antilink allow youtube.com`,
        `${prefix}antilink unallow youtube.com`,
      ].join('\n');

      if (!sub || sub === 'list' || sub === 'status') return reply(summary());

      if (sub === 'on' || sub === 'off') {
        if (settings.antilink === sub) return reply(`✅ Antilink is already *${sub.toUpperCase()}*`);
        await updateSetting('antilink', sub);
        return reply(`✅ Antilink has been turned *${sub.toUpperCase()}*`);
      }

      if (sub === 'action') {
        if (!antilink.ACTIONS.includes(value)) return reply(`Usage: ${prefix}antilink action delete/warn/kick`);
        await updateSetting('antilinkaction', value);
        return reply(`✅ Antilink action set to *${value.toUpperCase()}*`);
      }

      if (sub === 'warns') {
        const count = parseInt(value, 10);
        if (!count || count < 1 || count > 10) return reply(`Usage: ${prefix}antilink warns 1-10`);
        await updateSetting('antilinkwarns', String(count));
        return reply(`✅ Members are removed after *${count}* warning${count === 1 ? '' : 's'}`);
      }

      if (sub === 'allow' || sub === 'unallow') {
        const domain = antilink.parseList(value)[0];
        if (!domain || !domain.includes('.')) return reply(`Usage: ${prefix}antilink ${sub} youtube.com`);
        const next = sub === 'allow' ? [...new Set([...allowList, domain])] : allowList.filter((entry) => entry !== domain);
        await updateSetting('antilinkallow', next.join(','));
        return reply(sub === 'allow' ? `✅ *${domain}* is now allowed` : `✅ *${domain}* is no longer allowed`);
      }

      reply(summary());
    },
  },

  {
    command: ['antilinkall'],
    aliases: [],
    description: 'Remove members who send any link (on/off)',
    category: 'settings',
    handler: async (client, m, { NotOwner, Owner, reply, text }) => {
    {
    	if(!Owner) throw NotOwner;
      const settings = await getSettings();
      const current = settings.antilinkall;
      if (!text) return reply(`🛡️ Antilinkall is currently *${current.toUpperCase()}*`);
      if (!["on", "off"].includes(text)) return reply("Usage: antilinkall on/off");
      if (text === current) return reply(`✅ Antilinkall is already *${text.toUpperCase()}*`);
      await updateSetting("antilinkall", text);
      reply(`✅ Antilinkall has been turned *${text.toUpperCase()}*`);
    }
    },
  },

  {
    command: ['antitag'],
    aliases: [],
    description: 'Anti mass-tagging protection (on/off)',
    category: 'settings',
    handler: async (client, m, { NotOwner, Owner, reply, text }) => {
    {
    	if(!Owner) throw NotOwner;
      const settings = await getSettings();
      const current = settings.antitag;
      if (!text) return reply(`🤖 Antitag is currently *${current.toUpperCase()}*`);
      if (!["on", "off"].includes(text)) return reply("Usage: antitag on/off");
      if (text === current) return reply(`✅ Antitag is already *${text.toUpperCase()}*`);
      await updateSetting("antitag", text);
      reply(`✅ Antitag has been turned *${text.toUpperCase()}*`);
    }
    },
  },

  {
    command: ['autobio'],
    aliases: [],
    description: 'Update the bot bio automatically (on/off)',
    category: 'settings',
    handler: async (client, m, { NotOwner, Owner, reply, text }) => {
    {
    	if(!Owner) throw NotOwner;
      const settings = await getSettings();
      const current = settings.autobio;
      if (!text) return reply(`😇 Autobio is currently *${current.toUpperCase()}*`);
      if (!["on", "off"].includes(text)) return reply("Usage: autobio on/off");
      if (text === current) return reply(`✅ Autobio is already *${text.toUpperCase()}*`);
      await updateSetting("autobio", text);
      reply(`✅ Autobio has been turned *${text.toUpperCase()}*`);

    }
    },
  },

  {
    command: ['autolike'],
    aliases: [],
    description: 'Like statuses automatically (on/off)',
    category: 'settings',
    handler: async (client, m, { NotOwner, Owner, reply, text }) => {
    {
    	if(!Owner) throw NotOwner;
      const settings = await getSettings();
      const current = settings.autolike;
      if (!text) return reply(`🫠 Autolike is currently *${current.toUpperCase()}*`);
      if (!["on", "off"].includes(text)) return reply("Usage: autolike on/off");
      if (text === current) return reply(`✅ Autolike is already *${text.toUpperCase()}*`);
      await updateSetting("autolike", text);
      reply(`✅ Autolike has been turned *${text.toUpperCase()}*`);

    }
    },
  },

  {
    command: ['autoread'],
    aliases: [],
    description: 'Read messages automatically (on/off)',
    category: 'settings',
    handler: async (client, m, { NotOwner, Owner, reply, text }) => {
    {
    	if(!Owner) throw NotOwner;
      const settings = await getSettings();
      const current = settings.autoread;
      if (!text) return reply(`📨 Autoread is currently *${current.toUpperCase()}*`);
      if (!["on", "off"].includes(text)) return reply("Usage: autoread on/off");
      if (text === current) return reply(`✅ Autoread is already *${text.toUpperCase()}*`);
      await updateSetting("autoread", text);
      reply(`✅ Autoread has been set to *${text.toUpperCase()}*`);
    }
    },
  },

  {
    command: ['autoview'],
    aliases: [],
    description: 'View statuses automatically (on/off)',
    category: 'settings',
    handler: async (client, m, { NotOwner, Owner, reply, text }) => {
    {
    	if(!Owner) throw NotOwner;
      const settings = await getSettings();
      const current = settings.autoview;
      if (!text) return reply(`👀 Auto view status is currently *${current.toUpperCase()}*`);
      if (!["on", "off"].includes(text)) return reply("Usage: autoview on/off");
      if (text === current) return reply(`✅ Auto view status is already *${text.toUpperCase()}*`);
      await updateSetting("autoview", text);
      reply(`✅ Auto view status updated to *${text.toUpperCase()}*`);

    }
    },
  },

  {
    command: ['badword'],
    aliases: ['badwords'],
    description: 'Bad word filter: on/off, add/remove <word>, list, action delete|warn|kick, warns <n>',
    category: 'settings',
    handler: async (client, m, { NotOwner, Owner, reply, text, prefix }) => {
      if (!Owner) throw NotOwner;
      const badword = require('../lib/badword');
      const settings = await getSettings();
      const parts = String(text || '').trim().split(/\s+/).filter(Boolean);
      const sub = (parts[0] || '').toLowerCase();
      const value = (parts[1] || '').toLowerCase();
      const words = badword.parseWords(settings.badwords);

      const summary = () => [
        '🤬 *BAD WORD FILTER*',
        '',
        `• Filter: ${settings.badword === 'on' ? '🟢 ON' : '🔴 OFF'}`,
        `• Action: ${String(settings.badwordaction || 'kick').toUpperCase()}`,
        `• Warnings before removal: ${settings.badwordwarns || 3}`,
        `• Words in the list: ${words.length}`,
        '',
        `${prefix}badword on/off`,
        `${prefix}badword add <word>`,
        `${prefix}badword remove <word>`,
        `${prefix}badword list`,
        `${prefix}badword action delete/warn/kick`,
        `${prefix}badword warns 3`,
      ].join('\n');

      if (!sub || sub === 'status') return reply(summary());

      if (sub === 'on' || sub === 'off') {
        if (settings.badword === sub) return reply(`✅ Badword is already *${sub.toUpperCase()}*`);
        await updateSetting('badword', sub);
        return reply(`✅ Badword has been turned *${sub.toUpperCase()}*`);
      }

      if (sub === 'list') {
        return reply(words.length ? `🤬 *Bad words (${words.length})*\n\n${words.join(', ')}` : 'The bad word list is empty.');
      }

      if (sub === 'add' || sub === 'remove') {
        const entries = badword.parseWords(parts.slice(1).join(','));
        if (!entries.length) return reply(`Usage: ${prefix}badword ${sub} <word>`);
        const next = sub === 'add' ? [...new Set([...words, ...entries])] : words.filter((word) => !entries.includes(word));
        await updateSetting('badwords', next.join(','));
        return reply(sub === 'add' ? `✅ Added ${entries.length} word${entries.length === 1 ? '' : 's'}` : `✅ Removed ${entries.length} word${entries.length === 1 ? '' : 's'}`);
      }

      if (sub === 'action') {
        if (!badword.ACTIONS.includes(value)) return reply(`Usage: ${prefix}badword action delete/warn/kick`);
        await updateSetting('badwordaction', value);
        return reply(`✅ Badword action set to *${value.toUpperCase()}*`);
      }

      if (sub === 'warns') {
        const count = parseInt(value, 10);
        if (!count || count < 1 || count > 10) return reply(`Usage: ${prefix}badword warns 1-10`);
        await updateSetting('badwordwarns', String(count));
        return reply(`✅ Members are removed after *${count}* warning${count === 1 ? '' : 's'}`);
      }

      reply(summary());
    },
  },

  {
    command: ['gptdm'],
    aliases: [],
    description: 'AI auto-reply in private chats (on/off)',
    category: 'settings',
    handler: async (client, m, { NotOwner, Owner, reply, text }) => {
    {
    	if(!Owner) throw NotOwner;
      const settings = await getSettings();
      const current = settings.gptdm;
      if (!text) return reply(`🙂‍↕️ gptdm is currently *${current.toUpperCase()}*`);
      if (!["on", "off"].includes(text)) return reply("Usage: gptdm on/off");
      if (text === current) return reply(`✅ Gptdm is already *${text.toUpperCase()}*`);
      await updateSetting("gptdm", text);
      reply(`✅ Gptdm has been turned *${text.toUpperCase()}*`);
    }
    },
  },

  {
    command: ['mode'],
    aliases: [],
    description: 'Switch the bot between public and private mode',
    category: 'settings',
    handler: async (client, m, { NotOwner, Owner, reply, text }) => {
    {
    	if(!Owner) throw NotOwner;
      const settings = await getSettings();
      const current = settings.mode;
      if (!text) return reply(`👥️ Mode is currently *${current.toUpperCase()}*`);
      if (!["public", "private"].includes(text)) return reply("Usage: mode public/private");
      if (text === current) return reply(`✅ Mode is already *${text.toUpperCase()}*`);
      await updateSetting("mode", text);
      reply(`✅ Mode changed to *${text.toUpperCase()}*`);
    }
    },
  },

  {
    command: ['prefix'],
    aliases: [],
    description: 'Change the command prefix',
    category: 'settings',
    handler: async (client, m, { NotOwner, Owner, args }) => {
    {
    if(!Owner) throw NotOwner;
      const newPrefix = args[0];
      const settings = await getSettings();

    if (newPrefix === 'none') {
          if (!settings.prefix) {
            return await m.reply(`✅ The bot was already prefixless.`);
          }
          await updateSetting('prefix', '');
          await m.reply(`✅ The bot is now prefixless.`);
        } else if (newPrefix) {
          if (settings.prefix === newPrefix) {
            return await m.reply(`✅ The prefix was already set to: ${newPrefix}`);
          }
          await updateSetting('prefix', newPrefix);
          await m.reply(`✅ Prefix has been updated to: ${newPrefix}`);
        } else {
          await m.reply(`👤 Prefix is currently: ${settings.prefix || 'No prefix set.'}\n\nUse _${settings.prefix || '.'}prefix none to remove the prefix.`);
        }
      }
    },
  },

  {
    command: ['wapresence'],
    aliases: [],
    description: 'Set the bot presence: typing, recording or online',
    category: 'settings',
    handler: async (client, m, { NotOwner, Owner, reply, text }) => {
    {
           if(!Owner) throw NotOwner;
      const settings = await getSettings();
      const current = settings.wapresence;
      if (!text) return reply(`👤 Presence is currently *${current}*`);
      if (!["typing", "online", "recording"].includes(text)) return reply("Usage: wapresence typing/online/recording");
      if (text === current) return reply(`✅ Presence is already *${text}*`);
      await updateSetting("wapresence", text);
      reply(`✅ Presence updated to *${text}*`);
    }
    },
  },

  {
    command: ['welcome'],
    aliases: [],
    description: 'Welcome messages for new group members (on/off)',
    category: 'settings',
    handler: async (client, m, { NotOwner, Owner, reply, text }) => {
    {
    	if(!Owner) throw NotOwner;
      const settings = await getSettings();
      const current = settings.welcome;
      if (!text) return reply(`🕳 Welcome is currently *${current.toUpperCase()}*`);
      if (!["on", "off"].includes(text)) return reply("Usage: welcome on/off");
      if (text === current) return reply(`✅ Welcome is already *${text.toUpperCase()}*`);
      await updateSetting("welcome", text);
      reply(`✅ Welcome has been turned *${text.toUpperCase()}*`);

    }
    },
  },
];
