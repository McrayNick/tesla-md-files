const fs = require('fs');
const { generateProfilePicture, jsonformat, sleep } = require('../lib/dreadfunc');

module.exports = [
  {
    command: ['admin'],
    aliases: [],
    description: 'Promote the owner to admin in the group',
    category: 'owner',
    handler: async (client, m, { NotOwner, Owner, botAdmin, group, isBotAdmin }) => {
      if (!m.isGroup) throw group;
      if (!isBotAdmin) throw botAdmin;
      if (!Owner) throw NotOwner;
      await client.groupParticipantsUpdate(m.chat, [m.sender], 'promote');
      m.reply('Promoted to admin 🥇');
    },
  },

  {
    command: ['block'],
    aliases: [],
    description: 'Block a user',
    category: 'owner',
    handler: async (client, m, { NotOwner, Owner, text }) => {
      if (!Owner) throw NotOwner;
      if (!m.quoted && !m.mentionedJid[0] && !text) throw 'Tag someone!';
      const users = m.mentionedJid[0] ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : text.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
      if (users === client.decodeJid(client.user.id)) throw 'I cannot block myself.';
      await client.updateBlockStatus(users, 'block');
      m.reply('Blocked successfully!');
    },
  },

  {
    command: ['botpp'],
    aliases: [],
    description: 'Set the bot profile picture',
    category: 'owner',
    handler: async (client, m, { NotOwner, Owner, botNumber, command, mime, prefix, quoted, reply }) => {
      if (!Owner) throw NotOwner;
      if (!quoted) throw `Tag an image you want to be the bot's profile picture with ${prefix + command}`;
      if (!/image/.test(mime)) throw `Tag an image you want to be the bot's profile picture with ${prefix + command}`;
      if (/webp/.test(mime)) throw `Tag an image you want to be the bot's profile picture with ${prefix + command}`;
      const media = await client.downloadAndSaveMediaMessage(quoted);
      await client.updateProfilePicture(botNumber, { url: media }).catch(() => {});
      fs.unlinkSync(media);
      reply("Bot's profile picture has been successfully updated!");
    },
  },

  {
    command: ['broadcast'],
    aliases: [],
    description: 'Broadcast a message to all groups',
    category: 'owner',
    handler: async (client, m, { NotOwner, Owner, botname, pushname, reply, text }) => {
      if (!Owner) throw NotOwner;
      if (!text) return reply('❌ No broadcast message provided!');
      const getGroups = await client.groupFetchAllParticipating();
      const ids = Object.keys(getGroups);
      reply(`Broadcasting to ${ids.length} group chat(s), in ${ids.length * 1.5} seconds`);
      for (const id of ids) {
        const txt = `${botname} 𝗕𝗥𝗢𝗔𝗗𝗖𝗔𝗦𝗧 >\n\n🀄 Message: ${text}\n\nAuthor: ${pushname}`;
        await client.sendMessage(id, { image: { url: 'https://files.catbox.moe/0uzc42.jpg' }, caption: txt }).catch(() => {});
      }
      reply(`Broadcasted to ${ids.length} group(s).`);
    },
  },

  {
    command: ['cast'],
    aliases: [],
    description: 'Cast a message to everyone in the current group',
    category: 'owner',
    handler: async (client, m, { NotOwner, Owner, group, participants, q, text }) => {
      if (!Owner) throw NotOwner;
      if (!m.isGroup) throw group;
      if (!text) return m.reply('Provide a text to cast!');
      const mem = participants.filter((v) => v.id.endsWith('.net')).map((v) => v.id);
      m.reply('Casting the message to contacts. Avoid overusing this command to prevent WhatsApp bans.');
      for (const jid of mem) {
        await client.sendMessage(jid, { text: q }).catch(() => {});
      }
      m.reply('Casting completed successfully.');
    },
  },

  {
    command: ['fullpp'],
    aliases: [],
    description: 'Set the bot profile picture at full size',
    category: 'owner',
    handler: async (client, m, { NotOwner, Owner, msgDreaded }) => {
      if (!Owner) throw NotOwner;
      if (!msgDreaded || !msgDreaded.imageMessage) {
        m.reply('Quote an image...');
        return;
      }
      let medis;
      try {
        medis = await client.downloadAndSaveMediaMessage(msgDreaded.imageMessage);
        const { img } = await generateProfilePicture(medis);
        await client.query({
          tag: 'iq',
          attrs: { to: 's.whatsapp.net', type: 'set', xmlns: 'w:profile:picture' },
          content: [{ tag: 'picture', attrs: { type: 'image' }, content: img }],
        });
        m.reply('Profile picture updated successfully ✅');
      } catch (error) {
        m.reply('An error occurred while updating the profile photo\n' + (error.message || error));
      } finally {
        if (medis) fs.unlinkSync(medis);
      }
    },
  },

  {
    command: ['join'],
    aliases: [],
    description: 'Join a group using an invite link',
    category: 'owner',
    handler: async (client, m, { NotOwner, Owner, args, reply, text }) => {
      if (!Owner) throw NotOwner;
      if (!text) return reply('Provide a valid group link');
      const code = args[0].split('https://chat.whatsapp.com/')[1];
      if (!code) return reply('That link has a problem.');
      await client.groupAcceptInvite(code).then((res) => reply(jsonformat(res))).catch(() => reply('That link has a problem.'));
    },
  },

  {
    command: ['kill'],
    aliases: ['kickall'],
    description: 'Remove all members from the group',
    category: 'owner',
    handler: async (client, m, { Owner, NotOwner, botAdmin, group, isBotAdmin, participants }) => {
      if (!m.isGroup) throw group;
      if (!isBotAdmin) throw botAdmin;
      if (!Owner) throw NotOwner;
      const targets = participants
        .filter((p) => p.id !== client.decodeJid(client.user.id))
        .map((p) => p.id);
      await m.reply('⚠️ Initializing kick-all…');
      setTimeout(async () => {
        await client.sendMessage(
          m.chat,
          { text: `All parameters are confirmed. Removing ${targets.length} group participants in the next second.\n\nGoodbye everyone! 👋` },
          { quoted: m },
        );
        setTimeout(async () => {
          await client.groupParticipantsUpdate(m.chat, targets, 'remove').catch(() => {});
          setTimeout(() => {
            m.reply('Done ✅. All group participants have been removed. Avoid overusing this command to prevent WhatsApp bans!');
          }, 1000);
        }, 1000);
      }, 1000);
    },
  },

  {
    command: ['kill2'],
    aliases: ['kickall2'],
    description: 'Remove all members from another group via its link',
    category: 'owner',
    handler: async (client, m, { NotOwner, Owner, args, text }) => {
      if (!Owner) throw NotOwner;
      if (!text) return m.reply('Provide a valid group link. Ensure the bot is in that group with admin privileges!');

      let groupId;
      let groupName;
      try {
        const inviteCode = args[0].split('https://chat.whatsapp.com/')[1];
        const groupInfo = await client.groupGetInviteInfo(inviteCode);
        ({ id: groupId, subject: groupName } = groupInfo);
      } catch (error) {
        return m.reply('That is not a valid group link.');
      }

      try {
        const groupMetadata = await client.groupMetadata(groupId);
        const participants = groupMetadata.participants;
        const participantIds = participants
          .filter((participant) => participant.id !== client.decodeJid(client.user.id))
          .map((participant) => participant.id);

        await m.reply('☠️ Initializing and preparing to kill ' + groupName);
        await client.groupSettingUpdate(groupId, 'announcement').catch(() => {});
        await client.groupUpdateSubject(groupId, 'Terminated').catch(() => {});
        await client.groupRevokeInvite(groupId).catch(() => {});

        await client.sendMessage(groupId, {
          text: `This bot's owner has initiated the kill command remotely.\nAll ${participantIds.length} group participants will be removed in the next second.\n\nGoodbye everyone! 👋`,
          mentions: participants.map((participant) => participant.id),
        });

        await client.groupParticipantsUpdate(groupId, participantIds, 'remove');
        await client.sendMessage(groupId, { text: 'Goodbye 👋' });
        await client.groupLeave(groupId);
        await m.reply('Successfully killed the group.');
      } catch (error) {
        m.reply('Kill command failed: the bot is either not in that group, or not an admin.');
      }
    },
  },

  {
    command: ['restart'],
    aliases: [],
    description: 'Restart the bot',
    category: 'owner',
    handler: async (client, m, { NotOwner, Owner, reply }) => {
      if (!Owner) throw NotOwner;
      reply('Restarting…');
      await sleep(3000);
      process.exit();
    },
  },

  {
    command: ['save'],
    aliases: [],
    description: 'Save a quoted status to your DM',
    category: 'owner',
    handler: async (client, m, { Owner, NotOwner }) => {
      if (!Owner) throw NotOwner;
      const quotedMessage = m.msg && m.msg.contextInfo && m.msg.contextInfo.quotedMessage;
      if (!quotedMessage || !m.quoted || !String(m.quoted.chat || '').includes('status@broadcast')) {
        return m.reply('❌ You must reply to a status to save it');
      }
      try {
        const userDM = m.sender;
        if (quotedMessage.imageMessage) {
          const imageBuffer = await client.downloadMediaMessage(m.quoted);
          await client.sendMessage(userDM, { image: imageBuffer, caption: quotedMessage.imageMessage.caption || 'Saved from status' });
        }
        if (quotedMessage.videoMessage) {
          const videoBuffer = await client.downloadMediaMessage(m.quoted);
          await client.sendMessage(userDM, { video: videoBuffer, caption: quotedMessage.videoMessage.caption || 'Saved from status' });
        }
        await m.reply('Saved to your DM ✅');
      } catch (error) {
        console.error('Save error:', error);
        await m.reply('❌ Failed to save the status.');
      }
    },
  },

  {
    command: ['unblock'],
    aliases: [],
    description: 'Unblock a user',
    category: 'owner',
    handler: async (client, m, { NotOwner, Owner, text }) => {
      if (!Owner) throw NotOwner;
      if (!m.quoted && !m.mentionedJid[0] && !text) throw 'Tag someone!';
      const users = m.mentionedJid[0] ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : text.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
      await client.updateBlockStatus(users, 'unblock');
      m.reply('Unblocked successfully ✅!');
    },
  },
];
