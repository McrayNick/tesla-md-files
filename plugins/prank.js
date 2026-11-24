const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const between = (low, high) => Math.floor(Math.random() * (high - low + 1)) + low;
const hex = (length) => Array.from({ length }, () => between(0, 15).toString(16)).join('');
const bar = (percent) => {
  const filled = Math.round(percent / 5);
  return `[${'█'.repeat(filled)}${'░'.repeat(20 - filled)}] ${percent}%`;
};

function targetOf(m) {
  const mentioned = m.mentionedJid || (m.msg && m.msg.contextInfo && m.msg.contextInfo.mentionedJid) || [];
  const jid = mentioned[0] || (m.quoted && m.quoted.sender) || null;
  if (!jid) return { jid: null, name: 'the target' };
  return { jid, name: `@${String(jid).split('@')[0]}` };
}

function fakeDevice() {
  return {
    ip: `${between(41, 197)}.${between(0, 255)}.${between(0, 255)}.${between(1, 254)}`,
    mac: Array.from({ length: 6 }, () => hex(2)).join(':').toUpperCase(),
    device: pick(['Infinix Hot 30', 'Tecno Spark 10', 'Samsung Galaxy A14', 'Redmi Note 12', 'Itel A60s', 'Oppo A17']),
    port: between(1024, 65535),
    battery: between(8, 96),
  };
}

function reply(client, m, mentions) {
  let key = null;
  return async (text) => {
    const payload = { text, mentions };
    if (!key) {
      const sent = await client.sendMessage(m.chat, payload, { quoted: m });
      key = sent && sent.key;
      return;
    }
    await client.sendMessage(m.chat, { ...payload, edit: key });
  };
}

async function run(client, m, mentions, frames, delay = 1200) {
  const show = reply(client, m, mentions);
  for (const frame of frames) {
    await show(frame);
    await sleep(delay);
  }
}

module.exports = [
  {
    command: ['hack'],
    aliases: [],
    description: 'Fake hacking animation',
    category: 'prank',
    handler: async (client, m, { NotOwner, Owner }) => {
      if (!Owner) throw NotOwner;
      try {
        const { jid, name } = targetOf(m);
        const mentions = jid ? [jid] : [];
        const d = fakeDevice();
        const frames = [
          `⚠️ *INITIALIZING HACKING TOOLS* ⚠️\n\nTarget: ${name}`,
          `\`\`\`$ nmap -sS -p- ${d.ip}\nStarting scan...\nHost is up (0.0${between(10, 99)}s latency).\nPORT   ${d.port}/tcp  open\`\`\``,
          `\`\`\`Device found: ${d.device}\nMAC: ${d.mac}\nIP: ${d.ip}\nBattery: ${d.battery}%\`\`\``,
          `\`\`\`Bypassing WhatsApp encryption...\n${bar(20)}\`\`\``,
          `\`\`\`Injecting payload 0x${hex(8)}...\n${bar(45)}\`\`\``,
          `\`\`\`Cloning contacts and gallery...\n${bar(70)}\`\`\``,
          `\`\`\`Extracting saved passwords...\n${bar(92)}\`\`\``,
          `\`\`\`Uploading ${between(120, 980)} MB to remote server...\n${bar(100)}\`\`\` ✅`,
          `\`\`\`Wiping logs and closing connection...\`\`\``,
          `✅ *HACK COMPLETE* ✅\n\n${name}, your device has been owned.\n\n_Just kidding 😂 it was only a prank. Nothing was touched._`,
        ];
        await run(client, m, mentions, frames);
      } catch (error) {
        console.error('Error during prank:', error);
      }
    },
  },

  {
    command: ['virus'],
    aliases: ['fakevirus'],
    description: 'Fake virus scan on someone',
    category: 'prank',
    handler: async (client, m, { NotOwner, Owner }) => {
      if (!Owner) throw NotOwner;
      try {
        const { jid, name } = targetOf(m);
        const mentions = jid ? [jid] : [];
        const threats = [
          'Trojan.Android.Banker.' + hex(4),
          'Worm.WhatsApp.Spread.' + hex(3),
          'Adware.Pop.Annoying.' + hex(4),
          'Spyware.Selfie.Leak.' + hex(3),
          'Miner.Crypto.PhoneHeater.' + hex(3),
        ];
        const frames = [
          `🛡️ *TESLA ANTIVIRUS*\n\nScanning ${name}'s phone...`,
          `\`\`\`Scanning system files...\n${bar(15)}\`\`\``,
          `\`\`\`Scanning apps and downloads...\n${bar(40)}\`\`\``,
          `\`\`\`⚠️ Threat found: ${threats[0]}\nScanning...\n${bar(55)}\`\`\``,
          `\`\`\`⚠️ Threat found: ${threats[1]}\n⚠️ Threat found: ${threats[2]}\n${bar(75)}\`\`\``,
          `\`\`\`⚠️ Threat found: ${threats[3]}\n⚠️ Threat found: ${threats[4]}\n${bar(95)}\`\`\``,
          `🚨 *${between(5, 49)} THREATS FOUND* 🚨\n\n${threats.map((t) => `• ${t}`).join('\n')}\n\n${name}, your phone is in danger!`,
          `🧹 Quarantining threats...\n${bar(100)}\n\n_Relax 😂 it was a prank. Your phone is fine._`,
        ];
        await run(client, m, mentions, frames);
      } catch (error) {
        console.error('Error during prank:', error);
      }
    },
  },

  {
    command: ['cyberpolice'],
    aliases: ['arrest'],
    description: 'Fake cyber police investigation joke',
    category: 'prank',
    handler: async (client, m, { NotOwner, Owner }) => {
      if (!Owner) throw NotOwner;
      try {
        const { jid, name } = targetOf(m);
        const mentions = jid ? [jid] : [];
        const caseId = `TSL-${between(1000, 9999)}-${hex(3).toUpperCase()}`;
        const charge = pick([
          'sending good morning texts to 400 people',
          'leaving people on blue ticks for 3 days',
          'being too fine to be online',
          'stealing the last chapati',
          'saying "I\'m coming" while still in bed',
          'using 2% battery and still replying',
        ]);
        const frames = [
          `🚔 *TESLA CYBER POLICE (JOKE UNIT)* 🚔\n\nOpening case ${caseId}...`,
          `\`\`\`Suspect: ${name}\nCase: ${caseId}\nStatus: UNDER INVESTIGATION\n${bar(25)}\`\`\``,
          `\`\`\`Reviewing chat history...\nCollecting evidence...\n${bar(55)}\`\`\``,
          `\`\`\`Interviewing witnesses...\nWitness 1: "I saw everything."\nWitness 2: "It was him."\n${bar(85)}\`\`\``,
          `⚖️ *VERDICT* ⚖️\n\nSuspect: ${name}\nCharge: ${charge}\nSentence: *Buy the group airtime* 📱\n\nCase ${caseId} closed.\n\n_Obviously a joke 😂 no real police involved._`,
        ];
        await run(client, m, mentions, frames, 1500);
      } catch (error) {
        console.error('Error during prank:', error);
      }
    },
  },
];
