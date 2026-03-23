import { WebSocket } from 'ws';
import { AgentDevService } from './agentDevService.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../../');

export class TerminalSessionManager {
  private static instance: TerminalSessionManager;
  private activeWs: Set<WebSocket> = new Set();
  
  private constructor() {}

  static getInstance(): TerminalSessionManager {
    if (!TerminalSessionManager.instance) {
      TerminalSessionManager.instance = new TerminalSessionManager();
    }
    return TerminalSessionManager.instance;
  }

  addSession(ws: WebSocket) {
    this.activeWs.add(ws);
  }

  removeSession(ws: WebSocket) {
    this.activeWs.delete(ws);
  }

  hasActiveSession(): boolean {
    return this.activeWs.size > 0;
  }

  broadcast(data: string) {
    for (const ws of this.activeWs) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'output', data }));
      }
    }
  }

  /**
   * Executa um comando orquestrado pela IA no servidor e transmite para os webSockets abertos do terminal.
   */
  async executeCommandInTerminal(command: string, onLine?: (line: string, isStderr: boolean) => void) {
    // Escreve no terminal antes de iniciar
    this.broadcast(`\r\n\x1b[36m[CAPTU AI] Executando comando:\x1b[0m ${command}\r\n`);
    
    const result = await AgentDevService.executeCommandStream(command, (line, isStderr) => {
      // Transmite ao vivo para o terminal embutido 
      const prefix = isStderr ? '\x1b[31m' : '';
      const suffix = isStderr ? '\x1b[0m' : '';
      const formattedLine = `${prefix}${line.replace(/\n/g, '\r\n')}${suffix}\r\n`;
      this.broadcast(formattedLine);
      
      // Retorna para o despachante SSE o callback da IA
      if (onLine) onLine(line, isStderr);
    });

    // Restaurar prompt pro usuário se ele estiver vendo o terminal dps q a IA terminar
    this.broadcast(`\r\n\x1b[32mPS \x1b[36m${PROJECT_ROOT}\x1b[0m\x1b[32m>\x1b[0m `);

    return result;
  }
}
