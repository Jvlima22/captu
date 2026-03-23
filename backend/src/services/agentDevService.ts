import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const execPromise = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// A raiz do projeto CAPTU (indo de backend/src/services para a raiz do repositório)
const PROJECT_ROOT = path.resolve(__dirname, '../../../');

export interface CommandResult {
  stdout: string;
  stderr: string;
  success: boolean;
  error?: string;
}

export class AgentDevService {
  /**
   * Executa um comando no terminal a partir da raiz do projeto.
   */
  static async executeCommand(command: string): Promise<CommandResult> {
    console.log(`[AgentDev] Executando comando: ${command}`);
    try {
      // Bloqueio preventivo de comandos extremamente perigosos (opcional, já que é local)
      if (command.includes('rm -rf /') || command.includes(':(){ :|:& };:')) {
        throw new Error('Comando proibido por motivos de segurança.');
      }

      const { stdout, stderr } = await execPromise(command, { cwd: PROJECT_ROOT });
      return { stdout, stderr, success: true };
    } catch (error: any) {
      console.error(`[AgentDev] Erro ao executar ${command}:`, error.message);
      return { 
        stdout: error.stdout || '', 
        stderr: error.stderr || '', 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * Executa um comando com streaming real linha-a-linha via spawn.
   * Chama onLine para cada linha de stdout/stderr à medida que chega.
   * Retorna o código de saída do processo.
   */
  static executeCommandStream(
    command: string,
    onLine: (line: string, isStderr: boolean) => void
  ): Promise<{ exitCode: number; success: boolean }> {
    console.log(`[AgentDev STREAM] Iniciando: ${command}`);

    return new Promise((resolve) => {
      // Usa PowerShell no Windows para compatibilidade com cmd & git
      const isWindows = process.platform === 'win32';
      const shell = isWindows ? 'powershell.exe' : '/bin/sh';
      const shellFlag = isWindows ? '-Command' : '-c';

      const child = spawn(shell, [shellFlag, command], {
        cwd: PROJECT_ROOT,
        windowsHide: true,
      });

      const handleLine = (data: Buffer, isStderr: boolean) => {
        const lines = data.toString().split(/\r?\n/);
        for (const line of lines) {
          if (line.trim()) onLine(line, isStderr);
        }
      };

      child.stdout?.on('data', (d) => handleLine(d, false));
      child.stderr?.on('data', (d) => handleLine(d, true));

      child.on('close', (code) => {
        const exitCode = code ?? 1;
        console.log(`[AgentDev STREAM] Finalizado com código: ${exitCode}`);
        resolve({ exitCode, success: exitCode === 0 });
      });

      child.on('error', (err) => {
        console.error(`[AgentDev STREAM] Erro spawn:`, err.message);
        onLine(`ERRO: ${err.message}`, true);
        resolve({ exitCode: 1, success: false });
      });
    });
  }

  /**
   * Lê a estrutura de arquivos do projeto (de forma recursiva limitada).
   */
  static async getFileTree(dir: string = '.', maxDepth: number = 7): Promise<string[]> {
    const fullPath = path.resolve(PROJECT_ROOT, dir);
    const results: string[] = [];

    async function walk(currentDir: string, currentDepth: number) {
      if (currentDepth > maxDepth) return;
      
      const files = await fs.readdir(currentDir, { withFileTypes: true });
      for (const file of files) {
        const res = path.resolve(currentDir, file.name);
        const relativePath = path.relative(PROJECT_ROOT, res);
        
        // Ignorar node_modules, .git e pastas de build
        if (file.name === 'node_modules' || file.name === '.git' || file.name === 'dist' || file.name === '.next') {
          continue;
        }

        if (file.isDirectory()) {
          results.push(`${relativePath}/`);
          await walk(res, currentDepth + 1);
        } else {
          results.push(relativePath);
        }
      }
    }

    try {
      await walk(fullPath, 0);
      return results;
    } catch (e) {
      console.error('[AgentDev] Erro ao ler árvore de arquivos:', e);
      return [];
    }
  }

  /**
   * Tenta resolver o caminho do arquivo de forma inteligente caso a IA erre o nome.
   */
  static async resolvePath(filePath: string): Promise<string> {
    let fullPath = path.resolve(PROJECT_ROOT, filePath);
    
    // Tenta exato primeiro
    try { await fs.access(fullPath); return fullPath; } catch (e) {}
    
    // Tenta extensões comuns
    const extensions = ['.tsx', '.ts', '.js', '.jsx', '.css'];
    for (const ext of extensions) {
      try { await fs.access(fullPath + ext); return fullPath + ext; } catch (e) {}
    }
    
    // Tenta sufixo 'Page.tsx' comum em projetos React
    try { await fs.access(fullPath + 'Page.tsx'); return fullPath + 'Page.tsx'; } catch (e) {}

    // Busca difusa (Fuzzy match) no diretório pai se o diretório existir
    try {
      const dir = path.dirname(fullPath);
      const baseName = path.basename(fullPath).toLowerCase();
      
      const files = await fs.readdir(dir);
      const matchedFile = files.find(f => f.toLowerCase().includes(baseName) || baseName.includes(f.toLowerCase().replace(/\.[^/.]+$/, "")));
      
      if (matchedFile) {
        const fuzzyPath = path.join(dir, matchedFile);
        await fs.access(fuzzyPath);
        return fuzzyPath;
      }
    } catch (e) {}

    // Retorna o original para dar o erro ENOENT padrão caso tudo falhe
    return fullPath;
  }

  /**
   * Lê o conteúdo de um arquivo específico.
   */
  static async readFile(filePath: string): Promise<string | null> {
    try {
      const fullPath = await this.resolvePath(filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      return content;
    } catch (e: any) {
      console.error(`[AgentDev] Erro ao ler arquivo ${filePath}:`, e.message);
      return null;
    }
  }

  /**
   * Escreve ou sobrescreve o conteúdo de um arquivo.
   * Cria diretórios se necessário.
   */
  static async writeFile(filePath: string, content: string): Promise<boolean> {
    try {
      const fullPath = path.resolve(PROJECT_ROOT, filePath); // write sempre usa o path exato
      const dir = path.dirname(fullPath);
      
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(fullPath, content, 'utf-8');
      
      console.log(`[AgentDev] Arquivo escrito com sucesso: ${filePath}`);
      return true;
    } catch (e) {
      console.error(`[AgentDev] Erro ao escrever arquivo ${filePath}:`, e);
      return false;
    }
  }

  /**
   * Abstração para operações comuns de Git.
   */
  static async gitOperation(action: 'branch' | 'commit' | 'push' | 'status', params?: { name?: string, message?: string }) {
    switch (action) {
      case 'branch':
        return this.executeCommand(`git checkout -b ${params?.name || 'ai-feature'}`);
      case 'commit':
        await this.executeCommand('git add .');
        return this.executeCommand(`git commit -m "${params?.message || 'feat: update from Agent'}"`);
      case 'status':
        return this.executeCommand('git status');
      default:
        throw new Error('Ação Git não suportada.');
    }
  }

  /**
   * Patcheia um arquivo substituindo um trecho específico.
   * Inclui normalização básica para lidar com variações de aspas e espaços.
   */
  static async patchFile(filePath: string, search: string, replace: string): Promise<boolean> {
    try {
      const fullPath = await this.resolvePath(filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      
      // Tentativa 1: Match Exato
      if (content.includes(search)) {
        const newContent = content.replace(search, replace);
        await fs.writeFile(fullPath, newContent, 'utf-8');
        console.log(`[AgentDev] Patch exato aplicado: ${filePath}`);
        return true;
      }

      // Tentativa 2: Match Normalizado (ignora espaços extras e aspas simples/duplas no código)
      // Nota: Esta é uma estratégia simplificada para aumentar a taxa de sucesso do "Accept All"
      const normalize = (str: string) => str.replace(/\s+/g, ' ').trim();
      const normalizedContent = normalize(content);
      const normalizedSearch = normalize(search);

      if (normalizedContent.includes(normalizedSearch)) {
         console.warn(`[AgentDev] Match exato falhou, mas match normalizado encontrado em ${filePath}. Tentando patch via regex...`);
         // Cria uma regex que ignora espaços
         const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
         const regex = new RegExp(escapedSearch, 'g');
         const newContent = content.replace(regex, replace);
         
         if (newContent !== content) {
           await fs.writeFile(fullPath, newContent, 'utf-8');
           return true; 
         }
      }
      
      throw new Error(`Texto de busca não encontrado no arquivo: ${filePath}`);
    } catch (e: any) {
      console.error(`[AgentDev] Erro ao patchear arquivo ${filePath}:`, e.message);
      return false;
    }
  }
}
