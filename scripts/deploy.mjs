#!/usr/bin/env node
/**
 * Deploy to family.rybnikov.su
 *
 * Flow:
 *   1. Build frontend + backend (unless --no-build)
 *   2. Bundle the builds + backend runtime files into a tarball
 *   3. Upload the tarball and the remote script via scp
 *   4. On the server: extract to
 *        - /var/www/family.rybnikov.su/public_html  (frontend)
 *        - /var/www/family.rybnikov.su/server       (backend)
 *      Projects: the repo's projects/ folder is mirrored 1:1 into
 *      public_html/projects/ (shared files AND project subfolders, e.g.
 *      /projects/renovation/).
 *   5. Install production deps (npm install --omit=dev)
 *   6. Restart the backend under pm2 (family-backend)
 *
 * Usage:
 *   npm run deploy                  # full deploy
 *   npm run deploy -- --no-build    # skip local build
 *   npm run deploy -- --no-restart  # skip pm2 restart
 *
 * Configuration via env vars (all optional):
 *   DEPLOY_HOST          default: family.rybnikov.su
 *   DEPLOY_USER          default: root
 *   DEPLOY_PORT          default: 22
 *   DEPLOY_FRONTEND_DIR  default: /var/www/family.rybnikov.su/public_html
 *   DEPLOY_BACKEND_DIR   default: /var/www/family.rybnikov.su/server
 *   DEPLOY_PM2_APP       default: family-backend
 *   DEPLOY_NODE_PATH     bin dir with node/npm on the SERVER (e.g. /home/rybnikov/.nvm/versions/node/v20.19.0/bin).
 *                        If unset, the remote script auto-detects node/npm (profiles, nvm, common paths).
 *
 * Requires the OpenSSH client (ssh/scp) on PATH — built into Windows 10+.
 * Auth is interactive (password/key prompt). An SSH key is recommended so
 * the deploy runs without prompts. No secrets are stored in this repo.
 */

import { execFileSync, execSync } from 'node:child_process';
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Minimal .env loader (no external dependencies).
 * Reads <root>/.env if present. Values there do NOT override variables
 * that are already set in the real environment.
 */
function loadEnvFile() {
  const envFile = join(ROOT, '.env');
  if (!existsSync(envFile)) return;
  for (const rawLine of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      const comment = value.search(/[ \t]#/);
      if (comment !== -1) value = value.slice(0, comment).trim();
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile();

const cfg = {
  host: process.env.DEPLOY_HOST ?? 'family.rybnikov.su',
  user: process.env.DEPLOY_USER ?? 'root',
  port: process.env.DEPLOY_PORT ?? '22',
  frontendDir: process.env.DEPLOY_FRONTEND_DIR ?? '/var/www/family.rybnikov.su/public_html',
  backendDir: process.env.DEPLOY_BACKEND_DIR ?? '/var/www/family.rybnikov.su/server',
  pm2App: process.env.DEPLOY_PM2_APP ?? 'family-backend',
  // Server-side directory containing node/npm (used in the remote script)
  nodePath: process.env.DEPLOY_NODE_PATH ?? '',
  build: !process.argv.includes('--no-build'),
  restart: !process.argv.includes('--no-restart'),
};

const target = `${cfg.user}@${cfg.host}`;
const sshBase = [
  '-p',
  cfg.port,
  '-o',
  'StrictHostKeyChecking=accept-new',
  '-o',
  'ConnectTimeout=20',
  target,
];
const scpBase = [
  '-P',
  cfg.port,
  '-o',
  'StrictHostKeyChecking=accept-new',
  '-o',
  'ConnectTimeout=20',
];

function run(cmd, args, opts = {}) {
  console.log(`\n$ ${cmd} ${args.join(' ')}`);
  return execFileSync(cmd, args, { stdio: 'inherit', ...opts });
}

function log(msg) {
  console.log(`\n[deploy] ${msg}`);
}

function copyContents(src, dest) {
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const from = join(src, entry.name);
    const to = join(dest, entry.name);
    if (entry.isDirectory()) {
      cpSync(from, to, { recursive: true, force: true });
    } else {
      copyFileSync(from, to);
    }
  }
}

const REMOTE_TAR = '/tmp/family-deploy.tar.gz';
const REMOTE_SCRIPT_PATH = '/tmp/family-deploy.sh';

/**
 * Generates the bash script that runs on the server after the archive
 * is uploaded. Preview it with: node scripts/deploy.mjs --print-script
 */
function buildRemoteScript() {
  return `
set -e
PUBLIC="${cfg.frontendDir}"
SERVER="${cfg.backendDir}"

# --- Ensure node/npm/pm2 are available ---
# Non-interactive SSH sessions often have a minimal PATH, so Node.js
# (nvm, custom installs, ...) may not be visible. Try to locate it.
if [ -n "${cfg.nodePath}" ]; then
  export PATH="${cfg.nodePath}:\${PATH}"
fi

if ! command -v npm >/dev/null 2>&1; then
  # 1) source common profile files (loads nvm and friends)
  for f in "$HOME/.profile" "$HOME/.bash_profile" "$HOME/.bashrc" "$HOME/.nvm/nvm.sh"; do
    if [ -f "$f" ]; then . "$f" 2>/dev/null || true; fi
  done
fi

if ! command -v npm >/dev/null 2>&1; then
  # 2) fall back to common install locations
  for d in \\
    "$HOME/.nvm/versions/node"/*/bin \\
    /usr/local/bin \\
    /usr/bin \\
    /usr/local/node*/bin \\
    /opt/node*/bin \\
    "$HOME/node"*/bin \\
    "$HOME/.local/bin"; do
    if [ -x "$d/npm" ]; then
      export PATH="$d:\${PATH}"
      break
    fi
  done
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "[deploy] ERROR: npm not found on the server."
  echo "[deploy] Install Node.js or set DEPLOY_NODE_PATH to the bin directory containing node/npm."
  exit 1
fi

echo "[deploy] npm: $(command -v npm)"

# 1. Extract the bundle
rm -rf /tmp/family-deploy
mkdir -p /tmp/family-deploy
tar -xzf "${REMOTE_TAR}" -C /tmp/family-deploy

# 2. Replace frontend files (public_html).
#    The folder itself is NEVER deleted — only its contents:
#    top-level files (index.html, ...) are removed and the app's
#    assets/ subfolder is removed; other subfolders (.well-known, ...) are kept.
mkdir -p "$PUBLIC"
find "$PUBLIC" -maxdepth 1 -type f -delete
rm -rf "$PUBLIC/assets"
cp -a /tmp/family-deploy/frontend/. "$PUBLIC"/

# 2b. Copy projects into the web root.
#     The repo's projects/ folder mirrors the web root's /projects/ folder
#     1:1: shared files (styles.css, theme.js, icon-sprite.svg) AND project
#     subfolders (renovation/ etc.) all go to public_html/projects/.
#     Project pages are served at /projects/<slug>/ (e.g. /projects/renovation/,
#     see docs/server.md). Only entries present in the repo are overwritten;
#     other subfolders on the server are preserved. No backup is created.
if [ -d /tmp/family-deploy/projects ]; then
  mkdir -p "$PUBLIC/projects"
  for p in /tmp/family-deploy/projects/*; do
    [ -e "$p" ] || continue
    name=$(basename "$p")
    # Project subfolder or shared file -> /projects/ (repo mirrors web root 1:1)
    cp -a "$p" "$PUBLIC/projects/"
  done
  echo "[deploy] Projects copied to $PUBLIC/projects"
fi

# 3. Replace backend files (server).
#    The folder itself is kept; .env and data/ (SQLite DB) are preserved.
mkdir -p "$SERVER"
find "$SERVER" -maxdepth 1 -mindepth 1 ! -name '.env' ! -name 'data' -exec rm -rf {} +
cp -a /tmp/family-deploy/backend/. "$SERVER"/

# 4. Install production dependencies
cd "$SERVER"
npm install --omit=dev

# 5. Restart the backend under pm2
if ${cfg.restart ? 'true' : 'false'}; then
  # pm2 may be installed for a different Node version — look for it there too
  if ! command -v pm2 >/dev/null 2>&1; then
    for d in \\
      "$HOME/.nvm/versions/node"/*/bin \\
      /usr/local/bin \\
      /usr/bin \\
      /usr/local/node*/bin \\
      /opt/node*/bin \\
      "$HOME/node"*/bin \\
      "$HOME/.local/bin"; do
      if [ -x "$d/pm2" ]; then
        export PATH="$d:\${PATH}"
        break
      fi
    done
  fi

  # Install pm2 globally if it is still missing
  if ! command -v pm2 >/dev/null 2>&1; then
    echo "[deploy] pm2 not found — installing globally (npm install -g pm2)..."
    npm install -g pm2 >/dev/null 2>&1 || {
      echo "[deploy] ERROR: could not install pm2 — backend was NOT restarted."
      echo "[deploy] Install it manually: ssh ${target} 'npm install -g pm2'"
      exit 1
    }
  fi

  # Make sure the npm global bin directory is on PATH
  case ":\${PATH}:" in
    *":$(npm prefix -g)/bin:"*) ;;
    *) export PATH="$(npm prefix -g)/bin:\${PATH}" ;;
  esac

  if ! command -v pm2 >/dev/null 2>&1; then
    echo "[deploy] ERROR: pm2 not found after install — backend was NOT restarted."
    exit 1
  fi

  echo "[deploy] pm2: $(command -v pm2)"
  # Run the API in production mode. The app listens only when
  # NODE_ENV=production (under pm2 the script is loaded through pm2's fork
  # container, so the argv-based entry check in app.ts cannot be used).
  export NODE_ENV=production
  if pm2 describe ${cfg.pm2App} >/dev/null 2>&1; then
    pm2 restart ${cfg.pm2App} --update-env
  else
    pm2 start dist/app.cjs --name ${cfg.pm2App} --cwd "$SERVER"
  fi
  pm2 save >/dev/null 2>&1 || true
else
  echo "[deploy] restart skipped (--no-restart)"
fi

# 6. Cleanup temp files
rm -f "${REMOTE_TAR}" ${REMOTE_SCRIPT_PATH}
rm -rf /tmp/family-deploy

echo "[deploy] Done. Frontend: $PUBLIC | Backend: $SERVER"
`.trim();
}

function main() {
  console.log('[deploy] Config:');
  console.log(`  target      : ${target}:${cfg.port}`);
  console.log(`  frontend    : ${cfg.frontendDir}`);
  console.log(`  backend     : ${cfg.backendDir}`);
  console.log(`  pm2 app     : ${cfg.pm2App}`);
  console.log(`  build       : ${cfg.build ? 'yes' : 'no (--no-build)'}`);
  console.log(`  restart     : ${cfg.restart ? 'yes' : 'no (--no-restart)'}`);

  // Just print the resolved config and exit (no deployment)
  if (process.argv.includes('--print-config')) {
    return;
  }

  // Print the remote bash script and exit (no deployment)
  if (process.argv.includes('--print-script')) {
    console.log(buildRemoteScript());
    return;
  }

  let staging;
  try {
    // 1) Build
    if (cfg.build) {
      log('Building frontend & backend...');
      if (process.platform === 'win32') {
        // npm is npm.cmd on Windows; .cmd files must run via cmd.exe.
        // A command string (not an args array) avoids Node's DEP0190 warning.
        execSync('npm.cmd run build', { stdio: 'inherit', shell: true });
      } else {
        run('npm', ['run', 'build']);
      }
    }

    // 2) Staging directory
    staging = mkdtempSync(join(tmpdir(), 'family-deploy-'));
    const stageFrontend = join(staging, 'frontend');
    const stageBackend = join(staging, 'backend');
    mkdirSync(stageFrontend, { recursive: true });
    mkdirSync(stageBackend, { recursive: true });

    const frontendDist = join(ROOT, 'frontend', 'dist');
    const backendDist = join(ROOT, 'backend', 'dist');

    for (const [label, src] of [
      ['frontend build', frontendDist],
      ['backend build', backendDist],
    ]) {
      if (!existsSync(src)) {
        console.error(`[deploy] Missing ${label}: ${src}`);
        console.error('[deploy] Run `npm run build` first or drop `--no-build`.');
        process.exitCode = 1;
        return;
      }
    }

    // Frontend -> public_html root: index.html, assets/ ...
    copyContents(frontendDist, stageFrontend);

    // Backend keeps its dist/ layout so the server mirrors the repo:
    // server/dist/app.cjs — matches `pm2 start dist/app.cjs` and `node dist/app.cjs`.
    mkdirSync(join(stageBackend, 'dist'), { recursive: true });
    copyContents(backendDist, join(stageBackend, 'dist'));

    // Runtime files the backend needs on the server
    for (const file of ['package.json', 'package-lock.json']) {
      const p = join(ROOT, 'backend', file);
      if (existsSync(p)) copyFileSync(p, join(stageBackend, file));
    }

    // Projects -> public_html/projects/ (repo mirrors web root /projects/ 1:1:
    // shared files styles.css/theme.js AND project subfolders like renovation/).
    // Project pages are served at /projects/<slug>/ (e.g. /projects/renovation/).
    // Service entries starting with '_' (e.g. _template) are skipped.
    const stageProjects = join(staging, 'projects');
    let haveProjects = false;
    const projectsRoot = join(ROOT, 'projects');
    if (existsSync(projectsRoot)) {
      mkdirSync(stageProjects, { recursive: true });
      for (const entry of readdirSync(projectsRoot, { withFileTypes: true })) {
        if (entry.name.startsWith('_')) continue;
        cpSync(join(projectsRoot, entry.name), join(stageProjects, entry.name), {
          recursive: true,
          force: true,
        });
        haveProjects = true;
      }
    }

    // 3) Create the archive
    const archive = join(staging, 'family-deploy.tar.gz');
    log('Creating deployment archive...');
    const tarArgs = ['-czf', archive, '-C', staging, 'frontend', 'backend'];
    if (haveProjects) tarArgs.push('projects');
    run('tar', tarArgs);

    // Remote script (runs on the server)
    const remoteScript = buildRemoteScript();
    writeFileSync(join(staging, 'remote.sh'), remoteScript, 'utf8');

    // 4) Upload archive + remote script
    log(`Uploading archive to ${target}...`);
    run('scp', [...scpBase, archive, `${target}:${REMOTE_TAR}`]);
    log('Uploading remote script...');
    run('scp', [...scpBase, join(staging, 'remote.sh'), `${target}:${REMOTE_SCRIPT_PATH}`]);

    // 5) Run the remote script
    log('Applying on the server...');
    run('ssh', [...sshBase, `bash ${REMOTE_SCRIPT_PATH}`]);

    log('Deployment finished ✔');
  } catch (err) {
    console.error('\n[deploy] Deployment failed:');
    console.error(err.message || err);
    process.exitCode = 1;
  } finally {
    if (staging) rmSync(staging, { recursive: true, force: true });
  }
}

main();
