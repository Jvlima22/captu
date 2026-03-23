import { WebSocketServer, WebSocket } from 'ws';
import { spawn } from 'child_process';
import { IncomingMessage } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { TerminalSessionManager } from '../services/terminalSessionManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '../../../');

function send(ws: WebSocket, type: string, data: string) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, data }));
  }
}

export function createTerminalWss(server: any): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws/terminal' });
  console.log('[Terminal WS] Pronto em /ws/terminal');

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    console.log(`[Terminal WS] Conexão: ${req.socket.remoteAddress}`);

    // Registra a sessão
    TerminalSessionManager.getInstance().addSession(ws);

    // Envia mensagem de boas-vindas e o prompt inicial
    send(ws, 'welcome', [
      '\x1b[32m╔════════════════════════════════╗\r\n',
      '\x1b[32m║   CAPTU Terminal · PowerShell  ║\r\n',
      '\x1b[32m╚════════════════════════════════╝\x1b[0m\r\n\r\n',
    ].join(''));
    send(ws, 'prompt', PROJECT_ROOT);

    let isRunning = false;
    let currentProcess: ReturnType<typeof spawn> | null = null;

    ws.on('message', async (raw: Buffer) => {
      let msg: { type: string; data?: string };
      try { msg = JSON.parse(raw.toString()); }
      catch { return; }

      // ─── Executar comando completo ─────────────────────────────────────────
      if (msg.type === 'command' && msg.data !== undefined) {
        const command = msg.data.trim();

        // Comando vazio: só reenvia o prompt
        if (!command) {
          send(ws, 'prompt', PROJECT_ROOT);
          return;
        }

        if (isRunning) {
          send(ws, 'output', '\x1b[33m[Aguarde o comando anterior terminar...]\x1b[0m\r\n');
          return;
        }

        isRunning = true;

        // Suporte a "cd" nativo (PWD do processo filho não persiste entre chamadas)
        // Resolva "clear" / "cls" localmente
        if (command === 'clear' || command === 'cls') {
          send(ws, 'clear', '');
          send(ws, 'prompt', PROJECT_ROOT);
          isRunning = false;
          return;
        }

        // Executa no PowerShell com streaming de output
        const child = spawn('powershell.exe', [
          '-NoLogo',
          '-NonInteractive',
          '-Command', command
        ], {
          cwd: PROJECT_ROOT,
          windowsHide: true,
          env: { ...process.env },
        });

        currentProcess = child;

        child.stdout.on('data', (data: Buffer) => {
          send(ws, 'output', data.toString().replace(/\n/g, '\r\n'));
        });

        child.stderr.on('data', (data: Buffer) => {
          send(ws, 'output', `\x1b[31m${data.toString().replace(/\n/g, '\r\n')}\x1b[0m`);
        });

        child.on('close', (code) => {
          isRunning = false;
          currentProcess = null;
          if (ws.readyState === WebSocket.OPEN) {
            if (code !== 0 && code !== null) {
              send(ws, 'output', `\x1b[33m[Saiu com código ${code}]\x1b[0m\r\n`);
            }
            send(ws, 'prompt', PROJECT_ROOT);
          }
        });

        child.on('error', (err) => {
          isRunning = false;
          currentProcess = null;
          send(ws, 'output', `\x1b[31mErro: ${err.message}\x1b[0m\r\n`);
          send(ws, 'prompt', PROJECT_ROOT);
        });
      }

      // ─── Ctrl+C: mata o processo atual ────────────────────────────────────
      if (msg.type === 'interrupt') {
        if (currentProcess && !currentProcess.killed) {
          currentProcess.kill('SIGTERM');
          send(ws, 'output', '\r\n\x1b[33m^C\x1b[0m\r\n');
        }
      }
    });

    ws.on('close', () => {
      TerminalSessionManager.getInstance().removeSession(ws);
      if (currentProcess && !currentProcess.killed) {
        currentProcess.kill('SIGTERM');
      }
      console.log('[Terminal WS] Conexão encerrada.');
    });

    ws.on('error', (err) => {
      console.error('[Terminal WS] Erro:', err.message);
    });
  });

  return wss;
}
