import os from 'node:os';
import { spawn } from 'node:child_process';

function getLocalLanIp() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const name of Object.keys(interfaces)) {
    for (const detail of interfaces[name] || []) {
      if (!detail.internal && detail.family === 'IPv4') {
        candidates.push(detail.address);
      }
    }
  }

  return candidates.find((ip) => !ip.startsWith('169.254')) || candidates[0] || 'localhost';
}

const lanIp = getLocalLanIp();
const env = { ...process.env, VITE_API_URL: `http://${lanIp}:4000/api` };
const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const child = spawn(command, ['vite', '--host', '0.0.0.0', '--port', '5173'], {
  stdio: 'inherit',
  env,
});

child.on('exit', (code) => process.exit(code ?? 0));
child.on('error', (error) => {
  console.error('Failed to start Vite:', error);
  process.exit(1);
});

console.log(`LAN mode: http://${lanIp}:5173`);
console.log(`API target: http://${lanIp}:4000/api`);
