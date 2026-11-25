const axios = require('axios');

const TRIVIA_SECONDS = Number(process.env.TRIVIA_SECONDS) || 30;
const LOBBY_SECONDS = 120;
const LETTERS = ['A', 'B', 'C', 'D'];

const scores = new Map();
const ttt = new Map();
const trivia = new Map();
const hangman = new Map();
const rpsStreaks = new Map();

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const between = (low, high) => Math.floor(Math.random() * (high - low + 1)) + low;
const shuffle = (list) => {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};
const tag = (jid) => `@${String(jid).split('@')[0].split(':')[0]}`;

function addScore(chat, user, points) {
  if (!scores.has(chat)) scores.set(chat, new Map());
  const board = scores.get(chat);
  board.set(user, (board.get(user) || 0) + points);
  return board.get(user);
}

function leaderboard(chat, limit = 10) {
  const board = scores.get(chat);
  if (!board) return [];
  return [...board.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

const WINS = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const NUMBERS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
const MARK = { X: '❌', O: '⭕' };

function winnerOf(board) {
  for (const [a, b, c] of WINS) if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  return board.every(Boolean) ? 'draw' : null;
}

function renderBoard(board) {
  const cell = (i) => (board[i] ? MARK[board[i]] : NUMBERS[i]);
  return [0, 3, 6].map((row) => `${cell(row)}${cell(row + 1)}${cell(row + 2)}`).join('\n');
}

function minimax(board, turn, me) {
  const result = winnerOf(board);
  if (result === me) return { score: 1 };
  if (result === 'draw') return { score: 0 };
  if (result) return { score: -1 };
  const moves = [];
  board.forEach((v, i) => {
    if (v) return;
    board[i] = turn;
    moves.push({ index: i, score: minimax(board, turn === 'X' ? 'O' : 'X', me).score });
    board[i] = null;
  });
  const best = turn === me ? Math.max(...moves.map((m) => m.score)) : Math.min(...moves.map((m) => m.score));
  const choice = pick(moves.filter((m) => m.score === best));
  return { score: best, index: choice.index };
}

function botMove(board) {
  const open = board.map((v, i) => (v ? null : i)).filter((i) => i !== null);
  if (Math.random() < 0.2) return pick(open);
  return minimax([...board], 'O', 'O').index;
}

function tttStatus(game) {
  const who = game.turn === 'X' ? game.X : game.O;
  const name = who === 'BOT' ? 'Tesla 🤖' : tag(who);
  return `${renderBoard(game.board)}\n\n${MARK[game.turn]} ${name}, pick a number 1-9.`;
}

async function tttStart(client, m, { opponent }) {
  const chat = m.chat;
  const existing = ttt.get(chat);
  if (existing) {
    if (existing.state === 'lobby') return m.reply('⏳ A Tic-Tac-Toe game is waiting for a second player. Use *ttt join*.');
    return client.sendMessage(chat, { text: `🎮 A game is already running.\n\n${tttStatus(existing)}`, mentions: [existing.X, existing.O].filter((j) => j !== 'BOT') }, { quoted: m });
  }

  if (opponent === 'bot') {
    const game = { state: 'play', board: Array(9).fill(null), X: m.sender, O: 'BOT', turn: 'X' };
    ttt.set(chat, game);
    return client.sendMessage(chat, { text: `⭕❌ *TIC-TAC-TOE*\n\n${tag(m.sender)} (❌) vs Tesla 🤖 (⭕)\n\n${tttStatus(game)}`, mentions: [m.sender] }, { quoted: m });
  }

  const game = { state: 'lobby', board: Array(9).fill(null), X: m.sender, O: null, turn: 'X' };
  game.timer = setTimeout(() => {
    if (ttt.get(chat) === game && game.state === 'lobby') {
      ttt.delete(chat);
      client.sendMessage(chat, { text: '⌛ Nobody joined the Tic-Tac-Toe game. Lobby closed.' }).catch(() => { });
    }
  }, LOBBY_SECONDS * 1000);
  ttt.set(chat, game);
  const mentions = [m.sender, ...(opponent && opponent !== 'open' ? [opponent] : [])];
  const target = opponent && opponent !== 'open' ? `${tag(opponent)}, you were challenged! ` : '';
  return client.sendMessage(chat, { text: `⭕❌ *TIC-TAC-TOE*\n\n${tag(m.sender)} wants to play.\n${target}Type *ttt join* to accept.`, mentions }, { quoted: m });
}

async function tttJoin(client, m) {
  const game = ttt.get(m.chat);
  if (!game || game.state !== 'lobby') return m.reply('No Tic-Tac-Toe lobby is open. Start one with *ttt pvp*.');
  if (game.X === m.sender) return m.reply('You cannot play against yourself 😄');
  clearTimeout(game.timer);
  game.O = m.sender;
  game.state = 'play';
  return client.sendMessage(m.chat, { text: `⭕❌ *TIC-TAC-TOE*\n\n${tag(game.X)} (❌) vs ${tag(game.O)} (⭕)\n\n${tttStatus(game)}`, mentions: [game.X, game.O] });
}

function tttEnd(chat) {
  const game = ttt.get(chat);
  if (!game) return false;
  clearTimeout(game.timer);
  ttt.delete(chat);
  return true;
}

async function tttMove(client, m, text) {
  const game = ttt.get(m.chat);
  if (!game || game.state !== 'play' || !/^[1-9]$/.test(text)) return false;
  const current = game.turn === 'X' ? game.X : game.O;
  if (current !== m.sender) return false;
  const index = Number(text) - 1;
  if (game.board[index]) {
    await m.reply('That square is taken. Pick another number.');
    return true;
  }
  game.board[index] = game.turn;

  const finish = async (result) => {
    ttt.delete(m.chat);
    if (result === 'draw') {
      await client.sendMessage(m.chat, { text: `${renderBoard(game.board)}\n\n🤝 *It's a draw!*` });
      return;
    }
    const winner = result === 'X' ? game.X : game.O;
    if (winner === 'BOT') {
      await client.sendMessage(m.chat, { text: `${renderBoard(game.board)}\n\n🤖 *Tesla wins!* Better luck next time.` });
      return;
    }
    const total = addScore(m.chat, winner, 3);
    await client.sendMessage(m.chat, { text: `${renderBoard(game.board)}\n\n🏆 ${tag(winner)} *wins!* (+3 points, total ${total})`, mentions: [winner] });
  };

  let result = winnerOf(game.board);
  if (result) {
    await finish(result);
    return true;
  }
  game.turn = game.turn === 'X' ? 'O' : 'X';

  if (game.O === 'BOT' && game.turn === 'O') {
    game.board[botMove(game.board)] = 'O';
    result = winnerOf(game.board);
    if (result) {
      await finish(result);
      return true;
    }
    game.turn = 'X';
  }

  await client.sendMessage(m.chat, { text: tttStatus(game), mentions: [game.X, game.O].filter((j) => j !== 'BOT') });
  return true;
}

const FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

function parseDice(text) {
  const clean = String(text || '').trim().toLowerCase();
  if (!clean) return { count: 1, sides: 6 };
  const match = clean.match(/^(\d{0,2})d(\d{1,4})$/) || clean.match(/^(\d{1,2})$/);
  if (!match) return null;
  if (match.length === 2 && !clean.includes('d')) return { count: Number(match[1]), sides: 6 };
  const count = match[1] === '' ? 1 : Number(match[1]);
  const sides = Number(match[2]);
  if (count < 1 || count > 20 || sides < 2 || sides > 1000) return null;
  return { count, sides };
}

function rollDice({ count, sides }) {
  const rolls = Array.from({ length: count }, () => between(1, sides));
  return { rolls, total: rolls.reduce((a, b) => a + b, 0) };
}

function showRolls(rolls, sides) {
  return sides === 6 ? rolls.map((r) => FACES[r - 1]).join(' ') : rolls.join(', ');
}

const BANK = [
  ['Geography', 'What is the capital city of Kenya?', 'Nairobi', ['Mombasa', 'Kisumu', 'Nakuru']],
  ['Geography', 'Which is the longest river in Africa?', 'The Nile', ['The Congo', 'The Niger', 'The Zambezi']],
  ['Geography', 'Mount Kilimanjaro is located in which country?', 'Tanzania', ['Kenya', 'Uganda', 'Ethiopia']],
  ['Geography', 'Which is the largest ocean on Earth?', 'Pacific Ocean', ['Atlantic Ocean', 'Indian Ocean', 'Arctic Ocean']],
  ['Science', 'What is the chemical symbol for gold?', 'Au', ['Ag', 'Go', 'Gd']],
  ['Science', 'How many planets are in our solar system?', '8', ['7', '9', '10']],
  ['Science', 'Which gas do plants absorb from the air?', 'Carbon dioxide', ['Oxygen', 'Nitrogen', 'Hydrogen']],
  ['Science', 'What is the hardest natural substance?', 'Diamond', ['Gold', 'Iron', 'Quartz']],
  ['Technology', 'What does CPU stand for?', 'Central Processing Unit', ['Computer Personal Unit', 'Central Program Utility', 'Core Processing Unit']],
  ['Technology', 'Which company created the Android operating system?', 'Android Inc. (later bought by Google)', ['Apple', 'Microsoft', 'Nokia']],
  ['Technology', 'What does HTML stand for?', 'HyperText Markup Language', ['HighText Machine Language', 'HyperTool Multi Language', 'Home Text Markup Language']],
  ['Technology', 'Which language runs in a web browser?', 'JavaScript', ['Python', 'C++', 'Java']],
  ['History', 'In which year did Kenya gain independence?', '1963', ['1960', '1965', '1970']],
  ['History', 'Who was the first President of Kenya?', 'Jomo Kenyatta', ['Daniel arap Moi', 'Mwai Kibaki', 'Tom Mboya']],
  ['Sports', 'How many players are on the field for one football team?', '11', ['9', '10', '12']],
  ['Sports', 'Which country won the 2018 FIFA World Cup?', 'France', ['Croatia', 'Brazil', 'Germany']],
  ['Sports', 'In which sport do you perform a slam dunk?', 'Basketball', ['Volleyball', 'Tennis', 'Rugby']],
  ['General', 'How many days are there in a leap year?', '366', ['365', '364', '367']],
  ['General', 'Which animal is known as the king of the jungle?', 'Lion', ['Tiger', 'Elephant', 'Leopard']],
  ['General', 'How many continents are there?', '7', ['5', '6', '8']],
  ['Math', 'What is 12 multiplied by 12?', '144', ['124', '132', '154']],
  ['Math', 'What is the square root of 81?', '9', ['8', '7', '11']],
  ['Entertainment', 'Which fictional country is Black Panther the king of?', 'Wakanda', ['Zamunda', 'Genovia', 'Latveria']],
  ['Entertainment', 'Who is the lead singer of the band Coldplay?', 'Chris Martin', ['Bono', 'Adam Levine', 'Thom Yorke']],
];

function localQuestion(difficulty) {
  const [category, question, correct, wrong] = pick(BANK);
  return { category, question, correct, options: shuffle([correct, ...wrong]), difficulty: difficulty || 'easy', source: 'built-in' };
}

async function fetchQuestion(difficulty) {
  try {
    const params = { amount: 1, type: 'multiple', encode: 'url3986' };
    if (difficulty) params.difficulty = difficulty;
    const { data } = await axios.get('https://opentdb.com/api.php', { params, timeout: 8000 });
    const item = data && data.response_code === 0 && data.results && data.results[0];
    if (!item) throw new Error('no question');
    const decode = (value) => decodeURIComponent(value);
    const correct = decode(item.correct_answer);
    return {
      category: decode(item.category),
      question: decode(item.question),
      correct,
      options: shuffle([correct, ...item.incorrect_answers.map(decode)]),
      difficulty: item.difficulty,
      source: 'Open Trivia DB',
    };
  } catch (error) {
    return localQuestion(difficulty);
  }
}

const TRIVIA_POINTS = { easy: 1, medium: 2, hard: 3 };

async function triviaStart(client, m, difficulty) {
  const chat = m.chat;
  if (trivia.has(chat)) return m.reply('❓ A trivia question is already running. Answer it with A, B, C or D.');
  const q = await fetchQuestion(difficulty);
  if (trivia.has(chat)) return null;
  const game = { ...q, answered: new Set(), asked: m.sender };
  game.timer = setTimeout(() => {
    if (trivia.get(chat) !== game) return;
    trivia.delete(chat);
    client.sendMessage(chat, { text: `⌛ *Time is up!*\n\nThe answer was *${LETTERS[game.options.indexOf(game.correct)]}. ${game.correct}*` }).catch(() => { });
  }, TRIVIA_SECONDS * 1000);
  trivia.set(chat, game);
  const lines = game.options.map((option, i) => `${LETTERS[i]}. ${option}`).join('\n');
  return client.sendMessage(chat, {
    text: `🧠 *TRIVIA*  (${game.difficulty}, ${game.category})\n\n${game.question}\n\n${lines}\n\nReply with *A*, *B*, *C* or *D*. You have ${TRIVIA_SECONDS}s. One try each.`,
  }, { quoted: m });
}

function triviaStop(chat) {
  const game = trivia.get(chat);
  if (!game) return null;
  clearTimeout(game.timer);
  trivia.delete(chat);
  return game;
}

async function triviaAnswer(client, m, text) {
  const game = trivia.get(m.chat);
  const letter = String(text).trim().replace(/[.)]$/, '').toUpperCase();
  if (!game || !LETTERS.includes(letter) || game.answered.has(m.sender)) return false;
  game.answered.add(m.sender);
  const guess = game.options[LETTERS.indexOf(letter)];
  if (!guess) return false;
  if (guess === game.correct) {
    clearTimeout(game.timer);
    trivia.delete(m.chat);
    const points = TRIVIA_POINTS[game.difficulty] || 1;
    const total = addScore(m.chat, m.sender, points);
    await client.sendMessage(m.chat, { text: `✅ ${tag(m.sender)} got it right!\n\n*${letter}. ${game.correct}*\n\n+${points} point${points === 1 ? '' : 's'} (total ${total})`, mentions: [m.sender] }, { quoted: m });
  } else {
    await client.sendMessage(m.chat, { text: `❌ ${tag(m.sender)}, not quite. Others can still answer.`, mentions: [m.sender] }, { quoted: m });
  }
  return true;
}

const WORDS = [
  'nairobi', 'mombasa', 'kisumu', 'safari', 'elephant', 'giraffe', 'zebra', 'savannah', 'kilimanjaro', 'victoria',
  'computer', 'keyboard', 'internet', 'database', 'program', 'network', 'software', 'hardware', 'browser', 'server',
  'whatsapp', 'javascript', 'function', 'variable', 'algorithm', 'battery', 'charger', 'monitor', 'printer', 'laptop',
  'football', 'basketball', 'athletics', 'marathon', 'stadium', 'champion', 'trophy', 'goalkeeper', 'referee', 'tournament',
  'chapati', 'ugali', 'sukuma', 'mandazi', 'pilau', 'githeri', 'nyama', 'chai', 'banana', 'avocado',
  'rainbow', 'mountain', 'thunder', 'sunshine', 'universe', 'planet', 'galaxy', 'rocket', 'adventure', 'friendship',
];

const STAGES = [
  '  +---+\n  |   |\n      |\n      |\n      |\n      |\n=======',
  '  +---+\n  |   |\n  O   |\n      |\n      |\n      |\n=======',
  '  +---+\n  |   |\n  O   |\n  |   |\n      |\n      |\n=======',
  '  +---+\n  |   |\n  O   |\n /|   |\n      |\n      |\n=======',
  '  +---+\n  |   |\n  O   |\n /|\\  |\n      |\n      |\n=======',
  '  +---+\n  |   |\n  O   |\n /|\\  |\n /    |\n      |\n=======',
  '  +---+\n  |   |\n  O   |\n /|\\  |\n / \\  |\n      |\n=======',
];

const MAX_WRONG = 6;

const wrongCount = (game) => game.wrongLetters.size + game.wrongWords;

function hangmanView(game) {
  const word = [...game.word].map((c) => (game.letters.has(c) ? c.toUpperCase() : '_')).join(' ');
  const wrong = [...game.wrongLetters].map((c) => c.toUpperCase());
  return `\`\`\`${STAGES[wrongCount(game)]}\`\`\`\n${word}\n\nWrong (${wrongCount(game)}/${MAX_WRONG}): ${wrong.join(' ') || 'none'}`;
}

async function hangmanStart(client, m) {
  if (hangman.has(m.chat)) return client.sendMessage(m.chat, { text: `🔤 A hangman game is already running.\n\n${hangmanView(hangman.get(m.chat))}` }, { quoted: m });
  const game = { word: pick(WORDS), letters: new Set(), wrongLetters: new Set(), wrongWords: 0 };
  hangman.set(m.chat, game);
  return client.sendMessage(m.chat, { text: `🔤 *HANGMAN*\n\nGuess the word, one letter at a time with *hg <letter>*, or the whole word with *hg <word>*.\n\n${hangmanView(game)}` }, { quoted: m });
}

async function hangmanGuess(client, m, raw) {
  const game = hangman.get(m.chat);
  if (!game) return m.reply('No hangman game is running. Start one with *hangman*.');
  const guess = String(raw || '').trim().toLowerCase();
  if (!/^[a-z]+$/.test(guess)) return m.reply('Send a single letter or a whole word, like *hg e*.');

  let note;
  if (guess.length > 1) {
    if (guess === game.word) {
      [...game.word].forEach((c) => game.letters.add(c));
    } else {
      game.wrongWords += 1;
      note = `❌ *${guess.toUpperCase()}* is not the word.`;
    }
  } else {
    if (game.letters.has(guess) || game.wrongLetters.has(guess)) return m.reply(`You already guessed *${guess.toUpperCase()}*.`);
    if (game.word.includes(guess)) {
      game.letters.add(guess);
      note = `✅ *${guess.toUpperCase()}* is in the word!`;
    } else {
      game.wrongLetters.add(guess);
      note = `❌ *${guess.toUpperCase()}* is not in the word.`;
    }
  }

  if ([...game.word].every((c) => game.letters.has(c))) {
    hangman.delete(m.chat);
    const total = addScore(m.chat, m.sender, 2);
    return client.sendMessage(m.chat, { text: `🎉 ${tag(m.sender)} solved it! The word was *${game.word.toUpperCase()}*.\n\n+2 points (total ${total})`, mentions: [m.sender] }, { quoted: m });
  }

  if (wrongCount(game) >= MAX_WRONG) {
    hangman.delete(m.chat);
    return client.sendMessage(m.chat, { text: `💀 *Game over!*\n\n\`\`\`${STAGES[MAX_WRONG]}\`\`\`\nThe word was *${game.word.toUpperCase()}*.` }, { quoted: m });
  }
  return client.sendMessage(m.chat, { text: `${note}\n\n${hangmanView(game)}` }, { quoted: m });
}

function hangmanEnd(chat) {
  const game = hangman.get(chat);
  if (!game) return null;
  hangman.delete(chat);
  return game;
}

const RPS = { rock: '🪨', paper: '📄', scissors: '✂️' };
const BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
const RPS_ALIASES = { r: 'rock', p: 'paper', s: 'scissors', stone: 'rock', scissor: 'scissors' };

function playRps(chat, user, raw) {
  const text = String(raw || '').trim().toLowerCase();
  const choice = RPS[text] ? text : RPS_ALIASES[text];
  if (!choice) return null;
  const bot = pick(Object.keys(RPS));
  const key = `${chat}|${user}`;
  let outcome = 'draw';
  if (choice !== bot) outcome = BEATS[choice] === bot ? 'win' : 'lose';
  const streak = outcome === 'win' ? (rpsStreaks.get(key) || 0) + 1 : 0;
  rpsStreaks.set(key, streak);
  let total = null;
  if (outcome === 'win') total = addScore(chat, user, 1);
  return { choice, bot, outcome, streak, total };
}

async function onMessage(client, m, text) {
  try {
    if (!text) return false;
    if (/^[1-9]$/.test(text)) return await tttMove(client, m, text);
    if (/^[a-dA-D][.)]?$/.test(text)) return await triviaAnswer(client, m, text);
    return false;
  } catch (error) {
    console.error('[games]', error.message || error);
    return false;
  }
}

module.exports = {
  tag, leaderboard, addScore,
  tttStart, tttJoin, tttEnd, tttStatus, ttt,
  parseDice, rollDice, showRolls,
  triviaStart, triviaStop,
  hangmanStart, hangmanGuess, hangmanEnd,
  playRps, RPS,
  onMessage,
};
