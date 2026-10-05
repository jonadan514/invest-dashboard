// Read-only recovery. Run locally after `vercel login` (CLI 62.2.0).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';

const deployment = 'dpl_CaDft12jiovHiYNoV5Be7aUkoCxc';
const project = 'prj_uLmeAGg5f3xljjIK3Mmv1QU3fOzx';
const team = 'team_H5PNF38AqngHBQjtIgWnjjdi';
const out = path.resolve('vercel-original-2026-09-09');
const archive = `${out}.tar.gz`;
if (fs.existsSync(out) || fs.existsSync(archive)) throw new Error('Output already exists; move it before rerunning.');

function api(endpoint) {
  // Fixed identifiers / validated SHA-1s only. No token is printed or copied.
  const r = spawnSync(process.platform === 'win32' ? 'vercel.cmd' : 'vercel',
    ['api', `${endpoint}?teamId=${team}`, '--raw'],
    { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024, timeout: 120000,
      shell: process.platform === 'win32', env: { ...process.env, VERCEL_TELEMETRY_DISABLED: '1' } });
  if (r.error || r.status !== 0) throw new Error(`GET failed: ${endpoint}. Check local Vercel login. ${r.error?.message ?? ''}`);
  const json = JSON.parse(r.stdout);
  if (json.error || json.truncated) throw new Error(`Incomplete API response: ${endpoint}`);
  return json;
}

const info = api(`/v13/deployments/${deployment}`);
if ((info.id ?? info.uid) !== deployment || (info.projectId ?? info.project?.id) !== project)
  throw new Error('Deployment/project identity mismatch.');
const tree = api(`/v6/deployments/${deployment}/files`);
const roots = Array.isArray(tree) ? tree : tree.files;
if (!Array.isArray(roots)) throw new Error('Unexpected deployment tree.');
const source = roots.find(n => n.name === 'src' && n.type === 'directory');
if (!source) throw new Error('Canonical src/ tree missing.');
const files = [];
function walk(node, parent = '') {
  if (!node || typeof node !== 'object') throw new Error('Truncated source tree.');
  if (typeof node.name !== 'string' || !node.name || /[\\/\0]/.test(node.name) || ['.', '..'].includes(node.name))
    throw new Error('Unsafe source path.');
  const name = parent ? `${parent}/${node.name}` : node.name;
  if (node.type === 'file') {
    if (!/^[a-f0-9]{40}$/.test(node.uid)) throw new Error(`Unexpected file UID: ${name}`);
    files.push({ path: name, uid: node.uid, mode: node.mode });
  } else if (node.type === 'directory') {
    for (const child of node.children ?? []) walk(child, name);
  } else throw new Error(`Unexpected source node: ${name}`);
}
for (const child of source.children ?? []) walk(child);
if (!files.length || new Set(files.map(f => f.path)).size !== files.length) throw new Error('Empty or duplicate file list.');
fs.mkdirSync(path.join(out, 'source'), { recursive: true });
fs.writeFileSync(path.join(out, 'deployment-files.json'), JSON.stringify(tree, null, 2) + '\n');
const manifest = [];
for (const f of files.sort((a,b) => a.path.localeCompare(b.path))) {
  const result = api(`/v8/deployments/${deployment}/files/${f.uid}`);
  if (typeof result.data !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(result.data))
    throw new Error(`Invalid base64: ${f.path}`);
  const bytes = Buffer.from(result.data, 'base64');
  const sha1 = crypto.createHash('sha1').update(bytes).digest('hex');
  if (sha1 !== f.uid) throw new Error(`Hash mismatch: ${f.path}`);
  const target = path.join(out, 'source', ...f.path.split('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes);
  manifest.push({ ...f, bytes: bytes.length, sha1, sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
  console.log(`${manifest.length}/${files.length} verified: ${f.path}`);
}
const metadata = { deployment, project, team, complete: true, fileCount: files.length, files: manifest };
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(metadata, null, 2) + '\n');

// Portable tar.gz, so no extra archive package or OS command is needed.
const chunks = [];
function addTar(name, bytes) {
  const h = Buffer.alloc(512);
  if (Buffer.byteLength(name) > 100) throw new Error(`Archive path exceeds ustar name limit: ${name}`);
  h.write(name, 0, 100);
  h.write('0000644\0', 100, 8); h.write('0000000\0', 108, 8); h.write('0000000\0', 116, 8);
  h.write(bytes.length.toString(8).padStart(11, '0') + '\0', 124, 12);
  h.write('00000000000\0', 136, 12); h.fill(32, 148, 156); h[156] = 48;
  h.write('ustar\0', 257, 6); h.write('00', 263, 2);
  h.write([...h].reduce((a,b) => a+b, 0).toString(8).padStart(6, '0') + '\0 ', 148, 8);
  chunks.push(h, bytes, Buffer.alloc((512 - bytes.length % 512) % 512));
}
for (const f of manifest) addTar(`source/${f.path}`, fs.readFileSync(path.join(out, 'source', ...f.path.split('/'))));
for (const p of ['manifest.json', 'deployment-files.json']) addTar(p, fs.readFileSync(path.join(out, p)));
chunks.push(Buffer.alloc(1024));
fs.writeFileSync(archive, zlib.gzipSync(Buffer.concat(chunks)));
console.log(`Complete: ${manifest.length} hash-verified original files. Upload ${archive}`);
