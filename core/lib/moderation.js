const ACTIONS = ['delete', 'warn', 'kick'];
const WARN_WINDOW_MS = 24 * 60 * 60 * 1000;
const warnings = new Map();

function strike(bucket, chat, user) {
  const now = Date.now();
  for (const [key, entry] of warnings) if (now - entry.at > WARN_WINDOW_MS) warnings.delete(key);
  const key = `${bucket}|${chat}|${user}`;
  const entry = warnings.get(key) || { count: 0, at: now };
  entry.count += 1;
  entry.at = now;
  warnings.set(key, entry);
  return entry.count;
}

function clear(bucket, chat, user) {
  warnings.delete(`${bucket}|${chat}|${user}`);
}

async function enforce(client, m, { bucket, title, noun, action, limit }) {
  const user = m.sender;
  const tag = `@${String(user).split('@')[0]}`;
  const kind = ACTIONS.includes(action) ? action : 'kick';
  const max = Math.max(1, parseInt(limit, 10) || 3);

  await client.sendMessage(m.chat, {
    delete: { remoteJid: m.chat, fromMe: false, id: m.key.id, participant: m.key.participant || user },
  }).catch(() => { });

  const say = (body) => client.sendMessage(m.chat, { text: body, mentions: [user] }, { quoted: m }).catch(() => { });

  if (kind === 'delete') {
    await say(`${title}\n\n${tag}, ${noun} are not allowed here. Your message was deleted.`);
    return true;
  }

  let note = '';
  if (kind === 'warn') {
    const count = strike(bucket, m.chat, user);
    if (count < max) {
      await say(`${title}\n\n${tag}, ${noun} are not allowed here.\n\n⚠️ Warning ${count}/${max}. You will be removed at ${max}.`);
      return true;
    }
    note = `\n\n⚠️ Warning ${count}/${max}. Limit reached.`;
  }

  clear(bucket, m.chat, user);
  await client.groupParticipantsUpdate(m.chat, [user], 'remove').catch(() => { });
  await say(`${title}\n\n${tag} was removed for using ${noun}.${note}`);
  return true;
}

module.exports = { ACTIONS, enforce, clear };
