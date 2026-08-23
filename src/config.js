import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CONFIG_DIR = path.join(os.homedir(), '.zyvop');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export const DEFAULT_ENDPOINT = process.env.ZYVOP_ENDPOINT || 'https://zyvop.com/graphql';
export const DEFAULT_WEB_URL = process.env.ZYVOP_WEB_URL || 'https://zyvop.com';

export function getStoredConfig() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      return {};
    }
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveStoredConfig(newConfig) {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    const existing = getStoredConfig();
    const merged = { ...existing, ...newConfig };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf-8');
    return merged;
  } catch (err) {
    throw new Error(`Failed to save config: ${err.message}`);
  }
}

export function clearStoredConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      fs.unlinkSync(CONFIG_FILE);
    }
  } catch {}
}

export function resolveAuthToken(cmdOption) {
  if (cmdOption) return cmdOption;
  if (process.env.ZYVOP_TOKEN) return process.env.ZYVOP_TOKEN;
  const config = getStoredConfig();
  return config.token || null;
}

export function resolveEndpoint(cmdOption) {
  if (cmdOption) return cmdOption;
  if (process.env.ZYVOP_ENDPOINT) return process.env.ZYVOP_ENDPOINT;
  const config = getStoredConfig();
  return config.endpoint || DEFAULT_ENDPOINT;
}

export function resolveWebUrl(slug = '', endpoint = '') {
  const cleanSlug = slug.replace(/^\//, '');
  
  if (process.env.ZYVOP_WEB_URL) {
    const base = process.env.ZYVOP_WEB_URL.replace(/\/+$/, '');
    return cleanSlug ? `${base}/${cleanSlug}` : base;
  }

  if (endpoint) {
    // If production endpoint
    if (endpoint.includes('zyvop.com')) {
      return cleanSlug ? `https://zyvop.com/${cleanSlug}` : 'https://zyvop.com';
    }
    // Dynamic fallback for custom or self-hosted endpoints
    const base = endpoint.replace(/\/graphql\/?$/, '').replace(/\/+$/, '');
    return cleanSlug ? `${base}/${cleanSlug}` : base;
  }

  return cleanSlug ? `${DEFAULT_WEB_URL}/${cleanSlug}` : DEFAULT_WEB_URL;
}
