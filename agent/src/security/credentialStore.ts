import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface AgentCredentials {
  serverUrl: string;
  deviceId: string;
  token: string;
  pairedAt: string;
}

export class CredentialStore {
  private configDir: string;
  private filePath: string;
  private keyFilePath: string;

  constructor() {
    const appData = process.env.LOCALAPPDATA || process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Local');
    this.configDir = path.join(appData, 'UpdatePilot');
    this.filePath = path.join(this.configDir, 'agent_credentials.enc');
    this.keyFilePath = path.join(this.configDir, 'agent_key.dat');
  }

  /**
   * Encrypts and saves credentials on the host.
   * On Windows, strictly uses Windows DPAPI (CurrentUser scope).
   * On non-Windows development/test environments, uses AES-256-GCM with a randomly generated 256-bit vault key.
   */
  async saveCredentials(creds: AgentCredentials): Promise<void> {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true, mode: 0o700 });
    }

    const json = JSON.stringify(creds);

    if (process.platform === 'win32') {
      try {
        const base64Encrypted = await this.encryptWithDPAPI(json);
        fs.writeFileSync(this.filePath, JSON.stringify({ method: 'dpapi', data: base64Encrypted }), {
          encoding: 'utf-8',
          mode: 0o600,
        });
        return;
      } catch (err) {
        throw new Error(
          `Security failure: Windows DPAPI encryption failed. Storing unencrypted credentials is prohibited: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    // Secure fallback for non-Windows developer/test environments using random 256-bit local key
    const key = this.getOrCreateLocalVaultKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    const payload = {
      method: 'aes-256-gcm',
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      data: encrypted.toString('hex'),
    };

    fs.writeFileSync(this.filePath, JSON.stringify(payload), { encoding: 'utf-8', mode: 0o600 });
  }

  /**
   * Reads and decrypts stored credentials.
   */
  async loadCredentials(): Promise<AgentCredentials | null> {
    if (!fs.existsSync(this.filePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(this.filePath, 'utf-8');
      const payload = JSON.parse(content);

      if (payload.method === 'dpapi') {
        const decryptedJson = await this.decryptWithDPAPI(payload.data);
        return JSON.parse(decryptedJson) as AgentCredentials;
      } else if (payload.method === 'aes-256-gcm') {
        if (!fs.existsSync(this.keyFilePath)) {
          return null;
        }
        const key = fs.readFileSync(this.keyFilePath);
        const iv = Buffer.from(payload.iv, 'hex');
        const tag = Buffer.from(payload.tag, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(tag);
        const decrypted = Buffer.concat([
          decipher.update(Buffer.from(payload.data, 'hex')),
          decipher.final(),
        ]);
        return JSON.parse(decrypted.toString('utf8')) as AgentCredentials;
      }
    } catch (err) {
      console.warn('Could not decrypt local credentials; might be corrupted or from another user:', err);
      return null;
    }

    return null;
  }

  /**
   * Clears stored credentials upon unpairing or revocation.
   */
  clearCredentials(): void {
    if (fs.existsSync(this.filePath)) {
      try {
        fs.unlinkSync(this.filePath);
      } catch {
        // ignore
      }
    }
  }

  /**
   * Uses Windows DPAPI (ProtectedData) via PowerShell with CurrentUser scope.
   */
  private async encryptWithDPAPI(plainText: string): Promise<string> {
    const script = `
      Add-Type -AssemblyName System.Security
      $bytes = [System.Text.Encoding]::UTF8.GetBytes('${plainText.replace(/'/g, "''")}')
      $enc = [System.Security.Cryptography.ProtectedData]::Protect($bytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
      [System.Convert]::ToBase64String($enc)
    `;
    const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command', script]);
    return stdout.trim();
  }

  /**
   * Decrypts Windows DPAPI cipher via PowerShell with CurrentUser scope.
   */
  private async decryptWithDPAPI(cipherBase64: string): Promise<string> {
    const script = `
      Add-Type -AssemblyName System.Security
      $bytes = [System.Convert]::FromBase64String('${cipherBase64.trim()}')
      $dec = [System.Security.Cryptography.ProtectedData]::Unprotect($bytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
      [System.Text.Encoding]::UTF8.GetString($dec)
    `;
    const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command', script]);
    return stdout.trim();
  }

  /**
   * Retrieves or generates a cryptographically random 256-bit vault key for non-Windows environments.
   */
  private getOrCreateLocalVaultKey(): Buffer {
    if (fs.existsSync(this.keyFilePath)) {
      return fs.readFileSync(this.keyFilePath);
    }
    const newKey = crypto.randomBytes(32);
    fs.writeFileSync(this.keyFilePath, newKey, { mode: 0o600 });
    return newKey;
  }
}
