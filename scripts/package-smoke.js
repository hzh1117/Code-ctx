const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'code-ctx-pack-'));
const npmCli = process.env.npm_execpath;

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', stdio: 'pipe' });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed:\n${result.error?.message || result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

try {
  if (!npmCli) throw new Error('npm_execpath is unavailable; run this smoke test through npm');
  const npmArgs = args => [npmCli, ...args];
  const packOutput = JSON.parse(
    run(process.execPath, npmArgs(['pack', '--json', '--pack-destination', tempDir]), rootDir)
  );
  const tarball = path.join(tempDir, packOutput[0].filename);
  const installDir = path.join(tempDir, 'install');
  fs.mkdirSync(installDir);
  run(process.execPath, npmArgs(['init', '-y']), installDir);
  run(process.execPath, npmArgs(['install', '--ignore-scripts', tarball]), installDir);
  const packagedCli = path.join(installDir, 'node_modules', 'code-ctx', 'bin', 'cli.js');
  const version = run(process.execPath, [packagedCli, '--version'], installDir);
  if (version !== require('../package.json').version) {
    throw new Error(`packaged CLI version mismatch: ${version}`);
  }
  console.log(`Package smoke passed: code-ctx ${version}`);
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
