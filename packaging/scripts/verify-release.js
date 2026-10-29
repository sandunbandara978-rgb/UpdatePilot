/**
 * UpdatePilot Release Pipeline: Step 3 - Verify Release Integrity
 * Validates the generated installer, checksums, manifest, and staging isolation.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const DIST_DIR = path.resolve(ROOT_DIR, 'dist/installer');
const STAGING_DIR = path.resolve(ROOT_DIR, 'packaging/staging');
const INSTALLER_PATH = path.resolve(DIST_DIR, 'UpdatePilot-Agent-Setup-1.0.0-x64.exe');
const MANIFEST_PATH = path.resolve(DIST_DIR, 'release-manifest.json');
const CHECKSUMS_PATH = path.resolve(DIST_DIR, 'SHA256SUMS.txt');

function calculateSha256(filePath) {
  const hash = crypto.createHash('sha256');
  const buffer = fs.readFileSync(filePath);
  hash.update(buffer);
  return hash.digest('hex');
}

function verifyNoSymlinks(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`Symlink detected in staging: ${fullPath}`);
    }
    if (entry.isDirectory()) {
      verifyNoSymlinks(fullPath);
    }
  }
}

function verifyNoForbiddenPatterns(dir) {
  const forbiddenPatterns = [
    /\.env/i,
    /\.git/i,
    /\.tsbuildinfo/i,
    /\.test\.ts$/i,
    /\.spec\.ts$/i,
    /__tests__/i,
  ];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(entry.name)) {
        throw new Error(`Forbidden file/directory detected in staging: ${fullPath}`);
      }
    }
    if (entry.isDirectory()) {
      verifyNoForbiddenPatterns(fullPath);
    }
  }
}

function main() {
  console.log('=== [UpdatePilot Release Pipeline] Step 3: Verify Release ===');

  // 1. Verify installer presence and size
  console.log('[1/5] Verifying installer artifact...');
  if (!fs.existsSync(INSTALLER_PATH)) {
    throw new Error(`Installer missing at: ${INSTALLER_PATH}`);
  }
  const stats = fs.statSync(INSTALLER_PATH);
  const sizeMb = stats.size / (1024 * 1024);
  console.log(`  -> File size: ${sizeMb.toFixed(2)} MB`);
  if (sizeMb < 10) {
    throw new Error(`Installer is suspiciously small (${sizeMb.toFixed(2)} MB). Check bundling!`);
  }

  // 2. Verify SHA-256 and checksum files
  console.log('[2/5] Verifying SHA-256 integrity...');
  const calculatedSha = calculateSha256(INSTALLER_PATH);
  console.log(`  -> Computed SHA-256: ${calculatedSha}`);

  if (!fs.existsSync(MANIFEST_PATH)) {
    throw new Error(`Manifest missing at: ${MANIFEST_PATH}`);
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
  if (manifest.installer.sha256 !== calculatedSha) {
    throw new Error(`Manifest SHA-256 mismatch! Expected ${manifest.installer.sha256}, got ${calculatedSha}`);
  }

  if (!fs.existsSync(CHECKSUMS_PATH)) {
    throw new Error(`Checksums file missing at: ${CHECKSUMS_PATH}`);
  }
  const checksumsContent = fs.readFileSync(CHECKSUMS_PATH, 'utf-8');
  if (!checksumsContent.includes(calculatedSha)) {
    throw new Error(`SHA256SUMS.txt does not contain matching hash!`);
  }
  console.log('  -> SHA-256 verified against manifest and checksums file.');

  // 3. Verify staging purity
  console.log('[3/5] Verifying staging isolation (no symlinks, no dev secrets)...');
  verifyNoSymlinks(STAGING_DIR);
  verifyNoForbiddenPatterns(STAGING_DIR);
  console.log('  -> Staging directory is clean and strictly isolated.');

  // 4. Test bundled runtime in isolation
  console.log('[4/5] Testing bundled private Node.js runtime...');
  const bundledNode = path.resolve(STAGING_DIR, 'bin/node.exe');
  if (!fs.existsSync(bundledNode)) {
    throw new Error('Bundled node.exe not found in staging bin/');
  }
  const nodeVer = execSync(`"${bundledNode}" --version`, { encoding: 'utf-8' }).trim();
  console.log(`  -> Bundled Node runtime reports version: ${nodeVer}`);

  // 5. Test bundled agent CLI entry point with bundled node
  console.log('[5/5] Testing staged agent entry point with bundled runtime...');
  const agentEntry = path.resolve(STAGING_DIR, 'lib/agent/dist/index.js');
  const agentHelp = execSync(`"${bundledNode}" "${agentEntry}" --help`, {
    cwd: STAGING_DIR,
    encoding: 'utf-8',
  });
  if (!agentHelp.includes('UpdatePilot Windows Desktop Agent') && !agentHelp.includes('updatepilot-agent')) {
    throw new Error(`Bundled agent CLI did not output expected help header! Output:\n${agentHelp}`);
  }
  console.log('  -> Staged agent CLI successfully executed with bundled private runtime.');

  console.log('\n======================================================');
  console.log('✔ ALL RELEASE VERIFICATION CHECKS PASSED SUCCESSFULLY!');
  console.log(`Artifact: UpdatePilot-Agent-Setup-1.0.0-x64.exe (${sizeMb.toFixed(2)} MB)`);
  console.log(`SHA-256:  ${calculatedSha}`);
  console.log('======================================================\n');
}

main();
