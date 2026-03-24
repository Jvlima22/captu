import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { X, Minus, Maximize2, RotateCcw, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import '@xterm/xterm/css/xterm.css';

interface TerminalPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const WS_URL = (() => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.hostname;
  return `${protocol}//${host}:3000/ws/terminal`;
})();

// Prompt visual
const buildPrompt = (cwd: string) =>
  `\x1b[32mPS \x1b[36m${cwd}\x1b[0m\x1b[32m>\x1b[0m `;

export function TerminalPanel({ isOpen, onClose }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const inputRef = useRef('');         // linha atual sendo digitada
  const cwdRef = useRef('C:\\...');    // diretório atual
  const historyRef = useRef<string[]>([]); // histórico de comandos
  const histIdxRef = useRef(-1);

  const [isConnected, setIsConnected] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [copied, setCopied] = useState(false);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Envia mensagem para o WS ─────────────────────────────────────────────
  const wsSend = useCallback((type: string, data?: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, data }));
    }
  }, []);

  // ─── Escreve no terminal ──────────────────────────────────────────────────
  const write = useCallback((text: string) => {
    termRef.current?.write(text);
  }, []);

  // ─── Mostra o prompt ──────────────────────────────────────────────────────
  const showPrompt = useCallback(() => {
    write(buildPrompt(cwdRef.current));
    inputRef.current = '';
    histIdxRef.current = -1;
  }, [write]);

  // ─── Conecta WebSocket ────────────────────────────────────────────────────
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const term = termRef.current;
        if (!term) return;

        switch (msg.type) {
          case 'welcome':
            term.write(msg.data);
            break;

          case 'output':
            term.write(msg.data);
            break;

          case 'prompt':
            cwdRef.current = msg.data || cwdRef.current;
            showPrompt();
            break;

          case 'clear':
            term.clear();
            break;

          case 'error':
            term.write(`\x1b[31m${msg.data}\x1b[0m\r\n`);
            showPrompt();
            break;
        }
      } catch {
        termRef.current?.write(event.data);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      write('\r\n\x1b[33m[Desconectado. Reconectando em 3s...]\x1b[0m\r\n');
      reconnectTimer.current = setTimeout(() => {
        if (wsRef.current?.readyState !== WebSocket.OPEN) connect();
      }, 3000);
    };

    ws.onerror = () => {
      setIsConnected(false);
    };
  }, [showPrompt, write]);

  // ─── Inicializa o terminal xterm ─────────────────────────────────────────
  const initTerm = useCallback(() => {
    if (!containerRef.current || termRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: '"Cascadia Code", "JetBrains Mono", "Fira Code", Consolas, monospace',
      fontSize: 13,
      lineHeight: 1.5,
      theme: {
        background: '#0d1117',
        foreground: '#e6edf3',
        cursor: '#58a6ff',
        selectionBackground: '#264f78',
        black: '#0d1117', red: '#ff7b72', green: '#3fb950',
        yellow: '#d29922', blue: '#58a6ff', magenta: '#bc8cff',
        cyan: '#39c5cf', white: '#e6edf3',
        brightBlack: '#6e7681', brightRed: '#ffa198', brightGreen: '#56d364',
        brightYellow: '#e3b341', brightBlue: '#79c0ff', brightMagenta: '#d2a8ff',
        brightCyan: '#56d4dd', brightWhite: '#f0f6fc',
      },
      scrollback: 5000,
      convertEol: false,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());

    term.open(containerRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitRef.current = fitAddon;

    // ─── Lida com cada tecla do usuário ────────────────────────────────────
    term.onKey(({ key, domEvent }) => {
      const ev = domEvent as KeyboardEvent;

      // Ctrl+C = interrompe processo
      if (ev.ctrlKey && ev.key === 'c') {
        wsSend('interrupt');
        const line = inputRef.current;
        if (line) { write('^C\r\n'); inputRef.current = ''; }
        else { write('^C\r\n'); showPrompt(); }
        return;
      }

      // Ctrl+L = limpa
      if (ev.ctrlKey && ev.key === 'l') {
        term.clear();
        showPrompt();
        return;
      }

      switch (domEvent.key) {
        case 'Enter': {
          const cmd = inputRef.current;
          write('\r\n');
          if (cmd.trim()) {
            // Adiciona ao histórico
            historyRef.current.unshift(cmd);
            if (historyRef.current.length > 100) historyRef.current.pop();
          }
          wsSend('command', cmd);
          inputRef.current = '';
          histIdxRef.current = -1;
          break;
        }

        case 'Backspace': {
          if (inputRef.current.length > 0) {
            inputRef.current = inputRef.current.slice(0, -1);
            // Move o cursor para trás, apaga o caracter, volta
            write('\b \b');
          }
          break;
        }

        case 'ArrowUp': {
          const hist = historyRef.current;
          if (hist.length === 0) break;
          histIdxRef.current = Math.min(histIdxRef.current + 1, hist.length - 1);
          const entry = hist[histIdxRef.current];
          // Limpa linha atual e escreve o histórico
          write('\r\x1b[2K' + buildPrompt(cwdRef.current) + entry);
          inputRef.current = entry;
          break;
        }

        case 'ArrowDown': {
          const hist = historyRef.current;
          histIdxRef.current = Math.max(histIdxRef.current - 1, -1);
          const entry = histIdxRef.current >= 0 ? hist[histIdxRef.current] : '';
          write('\r\x1b[2K' + buildPrompt(cwdRef.current) + entry);
          inputRef.current = entry;
          break;
        }

        case 'Tab': {
          // Tab simples: só previne comportamento padrão por enquanto
          break;
        }

        default: {
          // Ignora teclas de controle que não produzem caracter visível
          if (key && key.length === 1 && !ev.ctrlKey && !ev.altKey && !ev.metaKey) {
            inputRef.current += key;
            write(key);
          }
          break;
        }
      }
    });
  }, [wsSend, showPrompt, write]);

  // ─── Lifecycle: abre ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => {
      initTerm();
      connect();
    }, 80);
    return () => clearTimeout(t);
  }, [isOpen, initTerm, connect]);

  // ─── Resize ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || isMinimized) return;
    const onResize = () => setTimeout(() => fitRef.current?.fit(), 50);
    window.addEventListener('resize', onResize);
    onResize();
    return () => window.removeEventListener('resize', onResize);
  }, [isOpen, isMinimized]);

  // ─── Cleanup ao desmontar ────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      termRef.current?.dispose();
      termRef.current = null;
    };
  }, []);

  // ─── Reconectar manualmente ──────────────────────────────────────────────
  const reconnect = () => {
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    wsRef.current?.close();
    wsRef.current = null;
    termRef.current?.clear();
    inputRef.current = '';
    connect();
  };

  const copySelection = () => {
    const sel = termRef.current?.getSelection();
    if (sel) {
      navigator.clipboard.writeText(sel);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    wsRef.current?.close();
    wsRef.current = null;
    termRef.current?.dispose();
    termRef.current = null;
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end pointer-events-none animate-in fade-in duration-200">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] pointer-events-auto"
        onClick={handleClose}
      />

      {/* Painel */}
      <div
        className={cn(
          'relative w-full pointer-events-auto flex flex-col',
          'bg-[#0d1117] border-t border-[#30363d] shadow-2xl shadow-black/70',
          'transition-[height] duration-300 ease-out',
          isMinimized ? 'h-10' : 'h-[48vh] min-h-[300px]'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra de título */}
        <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-[#30363d] flex-shrink-0 select-none">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-2.5 h-2.5 rounded-full transition-all duration-300',
              isConnected
                ? 'bg-[#3fb950] shadow-[0_0_8px_rgba(63,185,80,0.6)]'
                : 'bg-[#6e7681] animate-pulse'
            )} />
            <span className="text-[12px] font-bold text-[#e6edf3] font-mono tracking-wide">
              CAPTU Terminal
            </span>
            <span className="text-[10px] text-[#6e7681] font-mono bg-[#21262d] px-2 py-0.5 rounded border border-[#30363d]">
              powershell.exe · {isConnected ? 'ativo' : 'reconectando...'}
            </span>
          </div>

          <div className="flex items-center gap-0.5">
            <button
              onClick={copySelection}
              className="p-1.5 rounded hover:bg-[#21262d] text-[#6e7681] hover:text-[#e6edf3] transition-colors"
              title="Copiar seleção (Ctrl+C no mouse)"
            >
              {copied ? <Check size={13} className="text-[#3fb950]" /> : <Copy size={13} />}
            </button>

            <button
              onClick={reconnect}
              className="p-1.5 rounded hover:bg-[#21262d] text-[#6e7681] hover:text-[#e6edf3] transition-colors"
              title="Nova sessão"
            >
              <RotateCcw size={13} />
            </button>

            <button
              onClick={() => setIsMinimized(p => !p)}
              className="p-1.5 rounded hover:bg-[#21262d] text-[#6e7681] hover:text-[#e6edf3] transition-colors"
              title={isMinimized ? 'Expandir' : 'Minimizar'}
            >
              {isMinimized ? <Maximize2 size={13} /> : <Minus size={13} />}
            </button>

            <button
              onClick={handleClose}
              className="p-1.5 rounded hover:bg-[#ff7b72]/20 text-[#6e7681] hover:text-[#ff7b72] transition-colors"
              title="Fechar"
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* Área xterm */}
        {!isMinimized && (
          <div
            ref={containerRef}
            className="flex-1 min-h-0 overflow-hidden cursor-text"
            style={{ padding: '8px', backgroundColor: '#0d1117' }}
          />
        )}
      </div>
    </div>
  );
}
