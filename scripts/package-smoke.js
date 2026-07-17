const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'code-ctx-pack-'));
const npmCli = process.env.npm_execpath;

function run(command, args, cwd, options = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: 'pipe',
    env: { ...process.env, ...(options.env || {}) }
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed:\n${result.error?.message || result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function createProject(parentDir, name) {
  const projectDir = path.join(parentDir, name);
  fs.mkdirSync(path.join(projectDir, 'src'), { recursive: true });
  fs.writeFileSync(
    path.join(projectDir, 'package.json'),
    JSON.stringify({ name, private: true, dependencies: { express: '^5.0.0' } }, null, 2) + '\n'
  );
  fs.writeFileSync(path.join(projectDir, 'src', 'index.js'), 'module.exports = { ready: true };\n');
  return projectDir;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
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
  assert(version === require('../package.json').version, `packaged CLI version mismatch: ${version}`);

  const configHelp = run(process.execPath, [packagedCli, 'config', '--help'], installDir);
  const setupHelp = run(process.execPath, [packagedCli, 'config', 'setup', '--help'], installDir);
  assert(configHelp.includes('setup'), 'packaged CLI does not expose config setup');
  assert(configHelp.includes('validate'), 'packaged CLI does not expose config validate');
  assert(setupHelp.includes('--no-test'), 'packaged CLI setup help is missing --no-test');

  const offlineProject = createProject(tempDir, 'offline-project');
  run(process.execPath, [packagedCli, 'init', '--skip-ai'], offlineProject);
  run(process.execPath, [packagedCli, 'config', 'validate'], offlineProject);
  const offlineConfig = readJson(path.join(offlineProject, 'code-ctx.config.json'));
  assert(offlineConfig.projects?.length === 1, 'offline onboarding did not persist the detected project');
  assert(fs.existsSync(path.join(offlineProject, 'ai-docs', 'OVERVIEW.md')), 'offline onboarding missed OVERVIEW.md');
  const prompt = run(
    process.execPath,
    [packagedCli, 'use', '-s', 'A', '-n', '--no-ai-match', '--stdout', 'Inspect project structure'],
    offlineProject
  );
  assert(prompt.includes('Inspect project structure'), 'offline onboarding did not generate the requested prompt');

  const configuredProject = createProject(tempDir, 'configured-project');
  run(
    process.execPath,
    [
      packagedCli,
      'config',
      'setup',
      '--provider',
      'openai',
      '--base-url',
      'https://api.openai.com/v1',
      '--model',
      'gpt-5.5',
      '--no-test'
    ],
    configuredProject,
    { env: { CODE_CTX_SETUP_API_KEY: 'package-smoke-secret' } }
  );
  run(process.execPath, [packagedCli, 'init', '--skip-ai'], configuredProject);
  run(process.execPath, [packagedCli, 'config', 'validate'], configuredProject);
  const configured = readJson(path.join(configuredProject, 'code-ctx.config.json'));
  assert(configured.ai?.protocol === 'openai', 'configured onboarding lost the selected provider');
  assert(configured.projects?.length === 1, 'configured onboarding did not persist the detected project');
  assert(configured.projectName === 'configured-project', 'configured onboarding did not persist projectName');
  assert(
    fs.readFileSync(path.join(configuredProject, '.env'), 'utf8').includes('OPENAI_API_KEY=package-smoke-secret'),
    'config setup did not persist the provider key'
  );
  assert(
    fs.readFileSync(path.join(configuredProject, '.gitignore'), 'utf8').includes('.env'),
    'config setup missed .env'
  );
  assert(
    fs.existsSync(path.join(configuredProject, 'ai-docs', 'OVERVIEW.md')),
    'configured onboarding missed OVERVIEW.md'
  );

  console.log(`Package onboarding smoke passed: code-ctx ${version}`);
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
