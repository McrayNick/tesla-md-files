const fs = require('fs');
const path = require('path');
const vm = require('vm');
const axios = require('axios');

const REPO = process.env.PLUGINS_REPO || 'ignatiusmkuu-spec/Perez';
const BRANCH = process.env.PLUGINS_BRANCH || 'main';
const REMOTE_DIR = (process.env.PLUGINS_PATH || 'plugins').replace(/^\/+|\/+$/g, '');
const TARGET = path.join(__dirname, '..', 'plugins');
const MANIFEST = path.join(TARGET, '.synced.json');
const AGENT = { 'User-Agent': 'tesla-md-plugin-sync' };
const NAME_PATTERN = /^[\w.-]+\.js$/;

let running = null;

function readManifest() {
  try {
    const list = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function checkSyntax(code) {
  new vm.Script(`(function (require, module, exports, __dirname, __filename) {${code}\n})`);
}

async function listNames() {
  const url = `https://api.github.com/repos/${REPO}/contents/${REMOTE_DIR}`;
  const { data } = await axios.get(url, {
    params: { ref: BRANCH },
    headers: { ...AGENT, Accept: 'application/vnd.github+json' },
    timeout: 20000,
  });
  if (!Array.isArray(data)) throw new Error(`${REMOTE_DIR} is not a folder in ${REPO}`);
  return data.filter((item) => item.type === 'file' && NAME_PATTERN.test(item.name)).map((item) => item.name);
}

async function downloadFile(name) {
  const url = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${REMOTE_DIR}/${name}`;
  const { data } = await axios.get(url, {
    headers: AGENT,
    responseType: 'text',
    transformResponse: (body) => body,
    timeout: 30000,
  });
  return data;
}

async function chooseNames() {
  try {
    return { names: await listNames(), authoritative: true };
  } catch (error) {
    const status = error.response && error.response.status;
    const why = status === 403 || status === 429 ? 'GitHub rate limit' : status === 404 ? 'repo, branch or folder not found' : error.message;
    const fromEnv = String(process.env.PLUGINS_LIST || '').split(',').map((name) => name.trim()).filter((name) => NAME_PATTERN.test(name));
    const names = [...new Set([...readManifest(), ...fromEnv])];
    if (!names.length) throw new Error(`could not list ${REMOTE_DIR}/ (${why}) and there is no saved list`);
    console.warn(`[PLUGINS] Could not list ${REMOTE_DIR}/ (${why}); refreshing the ${names.length} known plugin file(s) instead.`);
    return { names, authoritative: false };
  }
}

function localCount() {
  try {
    return fs.readdirSync(TARGET).filter((name) => name.endsWith('.js')).length;
  } catch {
    return 0;
  }
}

async function run() {
  if (String(process.env.PLUGINS_SYNC || '').toLowerCase() === 'false') {
    console.log('[PLUGINS] Sync disabled (PLUGINS_SYNC=false); using local plugins.');
    return { synced: [], failed: [], skipped: true };
  }

  const synced = [];
  const failed = [];
  let chosen;
  try {
    chosen = await chooseNames();
  } catch (error) {
    console.error(`[PLUGINS] Plugin sync skipped: ${error.message}`);
    console.log(`[PLUGINS] Using ${localCount()} local plugin file(s).`);
    return { synced, failed, error };
  }

  fs.mkdirSync(TARGET, { recursive: true });

  await Promise.all(chosen.names.map(async (name) => {
    try {
      const code = await downloadFile(name).catch(() => downloadFile(name));
      if (!code || !code.trim()) throw new Error('empty file');
      checkSyntax(code);
      const file = path.join(TARGET, name);
      fs.writeFileSync(`${file}.tmp`, code, 'utf8');
      fs.renameSync(`${file}.tmp`, file);
      synced.push(name);
    } catch (error) {
      failed.push({ file: name, error: error.message });
      console.error(`[PLUGINS] ${name} not updated: ${error.message}`);
    }
  }));

  const previous = readManifest();
  const listed = new Set(chosen.names);
  if (chosen.authoritative) {
    for (const name of previous) {
      if (!listed.has(name) && NAME_PATTERN.test(name)) {
        try {
          fs.unlinkSync(path.join(TARGET, name));
          console.log(`[PLUGINS] Removed ${name} (no longer in ${REPO}).`);
        } catch (error) {
          if (error.code !== 'ENOENT') console.error(`[PLUGINS] Could not remove ${name}: ${error.message}`);
        }
      }
    }
  }
  const keep = chosen.authoritative
    ? [...new Set([...synced, ...previous.filter((name) => listed.has(name))])].sort()
    : [...new Set([...previous, ...synced])].sort();
  try {
    fs.writeFileSync(MANIFEST, JSON.stringify(keep, null, 2));
  } catch {
    console.error('[PLUGINS] Could not write the sync list.');
  }

  console.log(`[PLUGINS] Synced ${synced.length}/${chosen.names.length} plugin file(s) from ${REPO}@${BRANCH}` + (failed.length ? `, ${failed.length} failed` : ''));
  return { synced, failed };
}

function syncPlugins() {
  if (!running) {
    running = run().catch((error) => {
      console.error('[PLUGINS] Sync failed:', error.message || error);
      return { synced: [], failed: [], error };
    });
  }
  return running;
}

module.exports = { syncPlugins };
