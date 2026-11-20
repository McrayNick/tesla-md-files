const { getSettings } = require('../database/config');

const BOT_NAME = process.env.BOT_NAME || 'TESLA-MD';

const idOf = (participant) => (typeof participant === 'string' ? participant : participant && participant.id) || '';
const mentionOf = (participant) => (typeof participant === 'string' ? participant : participant && (participant.phoneNumber || participant.id)) || '';
const numberOf = (jid) => String(jid || '').split('@')[0].split(':')[0];

async function Events(client, update) {
  try {
    if (!update || !update.id || !Array.isArray(update.participants)) return;
    if (update.action !== 'add' && update.action !== 'remove') return;

    const settings = await getSettings();
    if (!settings || settings.welcome !== 'on') return;

    const metadata = await client.groupMetadata(update.id);
    const botIds = [client.user && client.user.id, client.user && client.user.lid]
      .filter(Boolean)
      .map((id) => String(id).split('@')[0].split(':')[0]);

    for (const participant of update.participants) {
      const id = idOf(participant);
      if (!id) continue;
      if (botIds.includes(id.split('@')[0].split(':')[0])) continue;

      const mention = mentionOf(participant);
      const number = numberOf(mention);
      const text = update.action === 'add'
        ? `@${number} Holla 👋\n\nWelcome to *${metadata.subject}*.\n\nPlease read the group description and follow the group rules to avoid being removed.\n\nMembers: ${metadata.participants.length}\n\n${BOT_NAME}`
        : `@${number} has left the group.\n\nGoodbye 👋\n\n${BOT_NAME}`;

      let picture = null;
      try {
        picture = await client.profilePictureUrl(id, 'image');
      } catch (error) {
        picture = null;
      }

      const message = picture ? { image: { url: picture }, caption: text, mentions: [mention] } : { text, mentions: [mention] };
      try {
        await client.sendMessage(update.id, message);
      } catch (error) {
        if (picture) await client.sendMessage(update.id, { text, mentions: [mention] });
        else throw error;
      }
    }
  } catch (error) {
    console.log('Welcome message failed: ' + (error && error.message ? error.message : error));
  }
}

module.exports = Events;
