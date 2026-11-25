const games = require('../lib/games');

const targetOf = (m) => {
  const mentioned = m.mentionedJid || (m.msg && m.msg.contextInfo && m.msg.contextInfo.mentionedJid) || [];
  return mentioned[0] || (m.quoted && m.quoted.sender) || null;
};

module.exports = [
  {
    command: ['games'],
    aliases: ['gamelist'],
    description: 'List the available games',
    category: 'games',
    handler: async (client, m, { prefix }) => {
      m.reply([
        '🎮 *TESLA GAMES*',
        '',
        `⭕❌ *${prefix}ttt* - Tic-Tac-Toe vs the bot`,
        `   ${prefix}ttt pvp [@user] - play a friend, then they send ${prefix}ttt join`,
        `   Moves: just send a number from 1 to 9`,
        `🎲 *${prefix}dice* - roll dice, like ${prefix}dice 2d6 or ${prefix}dice duel`,
        `🧠 *${prefix}trivia* - quiz question, answer A, B, C or D`,
        `🔤 *${prefix}hangman* - guess the word with ${prefix}hg <letter>`,
        `🪨 *${prefix}rps* - rock, paper, scissors vs the bot`,
        `🏆 *${prefix}leaderboard* - top players in this chat`,
      ].join('\n'));
    },
  },

  {
    command: ['tictactoe'],
    aliases: ['ttt'],
    description: 'Play Tic-Tac-Toe: ttt, ttt pvp [@user], ttt join, ttt end',
    category: 'games',
    handler: async (client, m, { text, prefix, isAdmin, Owner }) => {
      const sub = String(text || '').trim().split(/\s+/)[0].toLowerCase();

      if (sub === 'join') return games.tttJoin(client, m);

      if (sub === 'end' || sub === 'stop') {
        const game = games.ttt.get(m.chat);
        if (!game) return m.reply('No Tic-Tac-Toe game is running.');
        const player = game.X === m.sender || game.O === m.sender;
        if (!player && !isAdmin && !Owner) return m.reply('Only a player or an admin can end the game.');
        games.tttEnd(m.chat);
        return m.reply('🛑 Tic-Tac-Toe game ended.');
      }

      if (sub === 'board' || sub === 'status') {
        const game = games.ttt.get(m.chat);
        if (!game || game.state !== 'play') return m.reply(`No game is running. Start one with *${prefix}ttt*.`);
        return client.sendMessage(m.chat, { text: games.tttStatus(game), mentions: [game.X, game.O].filter((j) => j !== 'BOT') }, { quoted: m });
      }

      if (sub === 'pvp' || sub === 'friend') {
        return games.tttStart(client, m, { opponent: targetOf(m) || 'open' });
      }

      if (targetOf(m)) return games.tttStart(client, m, { opponent: targetOf(m) });
      return games.tttStart(client, m, { opponent: 'bot' });
    },
  },

  {
    command: ['dice'],
    aliases: ['roll'],
    description: 'Roll dice: dice, dice 2d6, dice d20, dice duel',
    category: 'games',
    handler: async (client, m, { text, prefix }) => {
      const input = String(text || '').trim().toLowerCase();

      if (input === 'duel') {
        const mine = games.rollDice({ count: 2, sides: 6 });
        const theirs = games.rollDice({ count: 2, sides: 6 });
        let verdict = '🤝 *It\'s a draw!*';
        if (mine.total > theirs.total) {
          const total = games.addScore(m.chat, m.sender, 1);
          verdict = `🏆 ${games.tag(m.sender)} *wins!* (+1 point, total ${total})`;
        } else if (mine.total < theirs.total) {
          verdict = '🤖 *Tesla wins!*';
        }
        return client.sendMessage(m.chat, {
          text: `🎲 *DICE DUEL*\n\nYou: ${games.showRolls(mine.rolls, 6)} = *${mine.total}*\nTesla: ${games.showRolls(theirs.rolls, 6)} = *${theirs.total}*\n\n${verdict}`,
          mentions: [m.sender],
        }, { quoted: m });
      }

      const spec = games.parseDice(input);
      if (!spec) return m.reply(`Usage: *${prefix}dice* (one d6), *${prefix}dice 3* (three d6), *${prefix}dice 2d20*, *${prefix}dice duel*\n\nUp to 20 dice and 1000 sides.`);
      const { rolls, total } = games.rollDice(spec);
      const label = `${spec.count}d${spec.sides}`;
      const detail = spec.count > 1 ? `\n${games.showRolls(rolls, spec.sides)}\nTotal: *${total}*` : `\n${games.showRolls(rolls, spec.sides)}  →  *${total}*`;
      return m.reply(`🎲 *${label}*${detail}`);
    },
  },

  {
    command: ['trivia'],
    aliases: ['quiz'],
    description: 'Trivia question: trivia [easy|medium|hard], trivia stop',
    category: 'games',
    handler: async (client, m, { text, isAdmin, Owner }) => {
      const input = String(text || '').trim().toLowerCase();
      if (input === 'stop' || input === 'end') {
        if (!isAdmin && !Owner) return m.reply('Only an admin can stop the trivia.');
        const game = games.triviaStop(m.chat);
        if (!game) return m.reply('No trivia question is running.');
        return m.reply(`🛑 Trivia stopped. The answer was *${game.correct}*.`);
      }
      const difficulty = ['easy', 'medium', 'hard'].includes(input) ? input : undefined;
      return games.triviaStart(client, m, difficulty);
    },
  },

  {
    command: ['hangman'],
    aliases: [],
    description: 'Start a hangman game (hangman end to stop)',
    category: 'games',
    handler: async (client, m, { text, isAdmin, Owner }) => {
      const input = String(text || '').trim().toLowerCase();
      if (input === 'end' || input === 'stop') {
        if (!isAdmin && !Owner) return m.reply('Only an admin can end the game.');
        const game = games.hangmanEnd(m.chat);
        if (!game) return m.reply('No hangman game is running.');
        return m.reply(`🛑 Hangman ended. The word was *${game.word.toUpperCase()}*.`);
      }
      return games.hangmanStart(client, m);
    },
  },

  {
    command: ['hg'],
    aliases: ['guess'],
    description: 'Guess a letter or the word in hangman',
    category: 'games',
    handler: async (client, m, { text }) => games.hangmanGuess(client, m, text),
  },

  {
    command: ['rps'],
    aliases: ['rockpaperscissors'],
    description: 'Rock, paper, scissors against the bot',
    category: 'games',
    handler: async (client, m, { text, prefix }) => {
      const result = games.playRps(m.chat, m.sender, text);
      if (!result) return m.reply(`Usage: *${prefix}rps rock*, *${prefix}rps paper* or *${prefix}rps scissors*`);
      const verdict = { win: '🏆 *You win!*', lose: '🤖 *Tesla wins!*', draw: '🤝 *Draw!*' }[result.outcome];
      const streak = result.streak > 1 ? `\n🔥 ${result.streak} wins in a row` : '';
      const points = result.outcome === 'win' ? `\n+1 point (total ${result.total})` : '';
      return client.sendMessage(m.chat, {
        text: `${games.RPS[result.choice]} vs ${games.RPS[result.bot]}\n\nYou: ${result.choice}\nTesla: ${result.bot}\n\n${verdict}${streak}${points}`,
      }, { quoted: m });
    },
  },

  {
    command: ['leaderboard'],
    aliases: ['gamescores', 'scores', 'lb'],
    description: 'Top game players in this chat',
    category: 'games',
    handler: async (client, m) => {
      const top = games.leaderboard(m.chat, 10);
      if (!top.length) return m.reply('No scores yet. Play a game with *games*!');
      const medals = ['🥇', '🥈', '🥉'];
      const lines = top.map(([jid, points], i) => `${medals[i] || `${i + 1}.`} ${games.tag(jid)} - ${points} pt${points === 1 ? '' : 's'}`);
      return client.sendMessage(m.chat, { text: `🏆 *LEADERBOARD*\n\n${lines.join('\n')}\n\n_Scores reset when the bot restarts._`, mentions: top.map(([jid]) => jid) }, { quoted: m });
    },
  },
];
