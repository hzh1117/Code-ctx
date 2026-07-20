const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

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

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(error => (error ? reject(error) : resolve(port)));
    });
  });
}

function requestDashboard(port) {
  return new Promise((resolve, reject) => {
    const request = http.get({ hostname: '127.0.0.1', port, path: '/', timeout: 1000 }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        body += chunk;
      });
      response.on('end', () => resolve({ status: response.statusCode, body }));
    });
    request.on('timeout', () => request.destroy(new Error('Dashboard request timed out')));
    request.on('error', reject);
  });
}

async function waitForDashboard(child, port, readOutput, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`packaged Dashboard exited before startup:\n${readOutput()}`);
    }
    try {
      const response = await requestDashboard(port);
      if (response.status === 200) return response;
    } catch {
      // The server may still be binding the port.
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`packaged Dashboard did not start within ${timeoutMs}ms:\n${readOutput()}`);
}

function stopChild(child) {
  if (!child || child.exitCode !== null) return Promise.resolve();
  return new Promise(resolve => {
    const forceTimer = setTimeout(() => {
      if (child.exitCode === null) child.kill('SIGKILL');
    }, 2000);
    child.once('exit', () => {
      clearTimeout(forceTimer);
      resolve();
    });
    child.kill();
  });
}

async function main() {
  let dashboardProcess;
  try {
    if (!npmCli) throw new Error('npm_execpath is unavailable; run this smoke test through npm');
    assert(fs.existsSync(path.join(rootDir, 'web', 'dist', 'index.html')), 'run npm run build:web before pack:smoke');
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
    const packagedDashboard = path.join(installDir, 'node_modules', 'code-ctx', 'web', 'dist', 'index.html');
    assert(fs.existsSync(packagedDashboard), 'published package is missing web/dist/index.html');
    const version = run(process.execPath, npmArgs(['exec', '--', 'code-ctx', '--version']), installDir);
    assert(version === require('../package.json').version, `packaged CLI version mismatch: ${version}`);

    const configHelp = run(process.execPath, [packagedCli, 'config', '--help'], installDir);
    const setupHelp = run(process.execPath, [packagedCli, 'config', 'setup', '--help'], installDir);
    assert(configHelp.includes('setup'), 'packaged CLI does not expose config setup');
    assert(configHelp.includes('validate'), 'packaged CLI does not expose config validate');
    assert(setupHelp.includes('--no-test'), 'packaged CLI setup help is missing --no-test');

    const offlineProject = createProject(tempDir, 'offline-project');
    run(process.execPath, [packagedCli, 'init', '--skip-ai'], offlineProject);
    run(process.execPath, [packagedCli, 'config', 'validate'], offlineProject);
    run(process.execPath, [packagedCli, 'doctor'], offlineProject);
    const offlineConfig = readJson(path.join(offlineProject, 'code-ctx.config.json'));
    assert(offlineConfig.projects?.length === 1, 'offline onboarding did not persist the detected project');
    assert(fs.existsSync(path.join(offlineProject, 'ai-docs', 'OVERVIEW.md')), 'offline onboarding missed OVERVIEW.md');
    const prompt = run(
      process.execPath,
      [packagedCli, 'use', '-s', 'A', '-n', '--no-ai-match', '--stdout', 'Inspect project structure'],
      offlineProject
    );
    assert(prompt.includes('Inspect project structure'), 'offline onboarding did not generate the requested prompt');

    const dashboardPort = await getFreePort();
    let dashboardOutput = '';
    dashboardProcess = spawn(
      process.execPath,
      [packagedCli, 'dashboard', '--dir', offlineProject, '--port', String(dashboardPort)],
      { cwd: installDir, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    dashboardProcess.stdout.on('data', chunk => {
      dashboardOutput += chunk.toString();
    });
    dashboardProcess.stderr.on('data', chunk => {
      dashboardOutput += chunk.toString();
    });
    const dashboardResponse = await waitForDashboard(dashboardProcess, dashboardPort, () => dashboardOutput);
    assert(dashboardResponse.body.includes('id="app"'), 'packaged Dashboard returned an unexpected document');
    assert(
      dashboardOutput.includes(path.join(offlineProject, 'code-ctx.config.json')),
      'packaged Dashboard did not select code-ctx.config.json'
    );
    assert(!dashboardOutput.includes('构建前端资源'), 'packaged Dashboard attempted a runtime frontend build');
    await stopChild(dashboardProcess);
    dashboardProcess = null;

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
    run(process.execPath, [packagedCli, 'doctor'], configuredProject);
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
    await stopChild(dashboardProcess);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
