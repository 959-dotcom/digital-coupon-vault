import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));

export function loadLuaScript(fileName: string): string {
  const source = readFileSync(join(directory, 'scripts', fileName), 'utf8');
  if (source.trim().length === 0) {
    throw new Error(`Lua script ${fileName} is empty`);
  }
  return source;
}

export const reserveBalanceLua = loadLuaScript('reserve-balance.lua');
export const releaseBalanceLua = loadLuaScript('release-balance.lua');
export const captureHoldLua = loadLuaScript('capture-hold.lua');
export const creditBalanceLua = loadLuaScript('credit-balance.lua');
export const releaseLockLua = loadLuaScript('release-lock.lua');
