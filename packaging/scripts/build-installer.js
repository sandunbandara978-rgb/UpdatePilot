/**
 * UpdatePilot Release Pipeline: Step 2 - Build Windows Installer
 * Compiles UpdatePilot-Agent.iss into UpdatePilot-Agent-Setup-1.0.0-x64.exe
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const PACKAGING_DIR = path.resolve(ROOT_DIR, 'packaging');
const ISS_FILE = path.resolve(PACKAGING_DIR, 'UpdatePilot-Agent.iss');
const DIST_DIR = path.resolve(ROOT_DIR, 'dist/installer');
const EXPECTED_INSTALLER = path.resolve(DIST_DIR, 'UpdatePilot-Agent-Setup-1.0.0-x64.exe');

function findIscc() {
  const candidates = [
    process.env.ISCC_PATH,
    path.join(process.env.LOCALAPPDATA || '', 'Programs/Inno Setup 6/ISCC.exe'),
    'C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe',
    'C:\\Program Files\\Inno Setup 6\\ISCC.exe',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // Fallback to checking PATH
  try {
    const whereOutput = execSync('where ISCC.exe', { encoding: 'utf-8' }).trim().split('\n')[0];
    if (whereOutput && fs.existsSync(whereOutput.trim())) {
      return whereOutput.trim();
    }
  } catch {}

  throw new Error(
    'Inno Setup Compiler (ISCC.exe) not found. Please install Inno Setup 6 or set ISCC_PATH.'
  );
}

function calculateSha256(filePath) {
  const hash = crypto.createHash('sha256');
  const buffer = fs.readFileSync(filePath);
  hash.update(buffer);
  return hash.digest('hex');
}

function main() {
  console.log('=== [UpdatePilot Release Pipeline] Step 2: Build Installer ===');

  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }

  const isccPath = findIscc();
  console.log(`[1/4] Found Inno Setup Compiler at: ${isccPath}`);

  if (!fs.existsSync(path.resolve(PACKAGING_DIR, 'staging/bin/node.exe'))) {
    throw new Error('Staging directory is missing or incomplete. Run "npm run release:stage" first.');
  }

  console.log(`[2/4] Compiling installer script: ${ISS_FILE}...`);
  try {
    execSync(`"${isccPath}" "${ISS_FILE}"`, {
      cwd: PACKAGING_DIR,
      stdio: 'inherit',
    });
  } catch (err) {
    console.error('ISCC compilation failed:', err);
    process.exit(1);
  }

  if (!fs.existsSync(EXPECTED_INSTALLER)) {
    throw new Error(`Expected installer was not generated at: ${EXPECTED_INSTALLER}`);
  }

  console.log('[3/4] Computing checksums and metadata...');
  const stats = fs.statSync(EXPECTED_INSTALLER);
  const sha256 = calculateSha256(EXPECTED_INSTALLER);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);

  console.log(`  -> Artifact: ${path.basename(EXPECTED_INSTALLER)}`);
  console.log(`  -> Size:     ${sizeMb} MB (${stats.size} bytes)`);
  console.log(`  -> SHA-256:  ${sha256}`);

  const manifest = {
    releaseVersion: '1.0.0',
    buildDate: new Date().toISOString(),
    platform: 'windows-x64',
    installer: {
      fileName: path.basename(EXPECTED_INSTALLER),
      sizeBytes: stats.size,
      sizeFormatted: `${sizeMb} MB`,
      sha256: sha256,
      targetScope: 'CurrentUser (Per-user, no elevation needed for install)',
      requiresWinGet: true,
      bundledNodeVersion: process.version,
    },
    components: [
      { name: 'UpdatePilot Agent Service', entryPoint: 'lib/agent/dist/index.js' },
      { name: 'UpdatePilot Setup Wizard', entryPoint: 'Setup-Wizard.ps1' },
      { name: 'Private Node.js x64 Runtime', entryPoint: 'bin/node.exe' },
      { name: 'CLI Utilities', entryPoint: ['UpdatePilot-Setup.cmd', 'UpdatePilot-Scan.cmd', 'UpdatePilot-Status.cmd', 'Stop-Agent.cmd'] },
    ],
  };

  const manifestPath = path.resolve(DIST_DIR, 'release-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  console.log(`  -> Manifest written to: ${manifestPath}`);

  const checksumsPath = path.resolve(DIST_DIR, 'SHA256SUMS.txt');
  fs.writeFileSync(checksumsPath, `${sha256}  ${path.basename(EXPECTED_INSTALLER)}\n`, 'utf-8');
  console.log(`  -> Checksums written to: ${checksumsPath}`);

  console.log('[4/4] Installer build finished successfully!');
}

main();
