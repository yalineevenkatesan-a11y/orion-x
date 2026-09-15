import React, { useState, useEffect, useRef } from 'react';

export interface LogPacket {
  id: string;
  lineNum: number;
  timestamp: string;
  source: string;
  level: 'INFO' | 'WARN' | 'OK' | 'ERR' | 'DEBUG' | string;
  message: string;
}

interface TelemetryTerminalProps {
  wsUrl?: string;
}

const DEFAULT_WS_URL = 'ws://127.0.0.1:8000/ws/logs';

export const TelemetryTerminal: React.FC<TelemetryTerminalProps> = ({ wsUrl = DEFAULT_WS_URL }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [logs, setLogs] = useState<LogPacket[]>([]);
  const [autoscroll, setAutoscroll] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'CONNECTED' | 'CONNECTING' | 'RECONNECTING' | 'DISCONNECTED'>('CONNECTING');
  const [filterText, setFilterText] = useState('');
  const [simulationActive, setSimulationActive] = useState(false);

  const logsEndRef = useRef<HTMLDivElement | null>(null);
  const logContainerRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const simIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lineCounterRef = useRef<number>(1);

  // Format timestamp helper
  const getFormattedTime = () => {
    const now = new Date();
    return now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');
  };

  // Add a log packet
  const appendLog = (packet: Partial<LogPacket>) => {
    const currentLine = lineCounterRef.current++;
    const rawLevel = (packet.level || 'INFO').toUpperCase();
    const normalizedLevel = rawLevel === 'ERROR' ? 'ERR' : rawLevel === 'SUCCESS' ? 'OK' : rawLevel;

    const newPacket: LogPacket = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      lineNum: currentLine,
      timestamp: packet.timestamp || getFormattedTime(),
      source: packet.source || 'ORION-CORE',
      level: normalizedLevel,
      message: packet.message || ''
    };

    setLogs(prev => {
      const next = [...prev, newPacket];
      if (next.length > 1000) return next.slice(-1000);
      return next;
    });
  };

  // Listen for custom events to auto-open terminal
  useEffect(() => {
    const handleOpen = () => setIsExpanded(true);
    window.addEventListener('orion:sandbox-start', handleOpen);
    window.addEventListener('orion:open-terminal', handleOpen);
    return () => {
      window.removeEventListener('orion:sandbox-start', handleOpen);
      window.removeEventListener('orion:open-terminal', handleOpen);
    };
  }, []);

  // Handle Autoscroll
  useEffect(() => {
    if (autoscroll && logsEndRef.current && isExpanded) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoscroll, isExpanded]);

  // WebSocket Connection with Automatic Reconnection
  useEffect(() => {
    let shouldReconnect = true;

    const connectWebSocket = () => {
      try {
        setConnectionStatus('CONNECTING');
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setConnectionStatus('CONNECTED');
          appendLog({
            source: 'WEBSOCKET',
            level: 'OK',
            message: `Stream established on ${wsUrl}`
          });
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (typeof data === 'object' && data !== null) {
              const src = String(data.source || '');
              const lvl = String(data.level || '');
              if (src.includes('SANDBOX') || src.includes('DOCKER') || lvl.includes('SANDBOX')) {
                setIsExpanded(true);
              }
              appendLog({
                timestamp: data.timestamp ? String(data.timestamp) : getFormattedTime(),
                source: data.source ? String(data.source) : 'DAEMON',
                level: data.level ? String(data.level) : 'INFO',
                message: data.message ? String(data.message) : JSON.stringify(data)
              });
            } else {
              appendLog({
                source: 'RAW-STREAM',
                level: 'INFO',
                message: String(event.data)
              });
            }
          } catch (parseErr) {
            appendLog({
              source: 'DAEMON',
              level: 'INFO',
              message: String(event.data)
            });
          }
        };

        ws.onerror = () => {
          setConnectionStatus('RECONNECTING');
        };

        ws.onclose = () => {
          if (shouldReconnect) {
            setConnectionStatus('RECONNECTING');
            reconnectTimeoutRef.current = setTimeout(() => {
              connectWebSocket();
            }, 3000);
          } else {
            setConnectionStatus('DISCONNECTED');
          }
        };
      } catch (err) {
        setConnectionStatus('RECONNECTING');
        if (shouldReconnect) {
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, 4000);
        }
      }
    };

    connectWebSocket();

    return () => {
      shouldReconnect = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [wsUrl]);

  // Telemetry Simulator: Provides immediate verification feedback when backend server is offline
  useEffect(() => {
    if (simulationActive) {
      const sources = ['GO-AST', 'DOCKER-SANDBOX', 'FAISS-KERNEL', 'CRITICAL-SWARM', 'ORION-ROUTER'];
      const levels = ['INFO', 'OK', 'INFO', 'WARN', 'DEBUG'];
      const sampleMessages = [
        'AST Subtree parsed 1,420 tokens in 4.2ms [status: clean]',
        'Docker container c-8942 mounted in rootless sandbox',
        'FAISS vector index re-clustered across 768 dimensions (IVF-PQ)',
        'Autonomous Blast-Radius Shader calculated 0 boundary leaks',
        'Heartbeat broadcast emitted to swarm consensus channel',
        'Memory buffer synchronized with IPC Context Bridge',
        'Garbage collection completed. 24.8MB reclaimed.'
      ];

      simIntervalRef.current = setInterval(() => {
        const randSource = sources[Math.floor(Math.random() * sources.length)];
        const randLevel = levels[Math.floor(Math.random() * levels.length)];
        const randMsg = sampleMessages[Math.floor(Math.random() * sampleMessages.length)];
        appendLog({
          source: randSource,
          level: randLevel,
          message: randMsg
        });
      }, 2500);
    } else {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    }

    return () => {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    };
  }, [simulationActive]);

  // Initial greeting logs
  useEffect(() => {
    appendLog({
      source: 'KERNEL',
      level: 'OK',
      message: 'Telemetry Terminal initialized. Listening for packets...'
    });
    appendLog({
      source: 'LOGISTICS',
      level: 'INFO',
      message: 'ORION-X Critical Protocol Drawer mounted [Phase 1 Active]'
    });
  }, []);

  const handleClearLogs = () => {
    setLogs([]);
  };

  // Filtered log display
  const filteredLogs = logs.filter(log => {
    if (!filterText) return true;
    const q = filterText.toLowerCase();
    return (
      log.message.toLowerCase().includes(q) ||
      log.source.toLowerCase().includes(q) ||
      log.level.toLowerCase().includes(q)
    );
  });

  return (
    <>
      {/* 1. SLEEK COMPACT STATUS BAR TRIGGER BUTTON (Fixed at bottom-right corner) */}
      {!isExpanded && (
        <div className="fixed bottom-3 right-6 z-[155] pointer-events-auto">
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-md bg-[#090d16]/95 hover:bg-[#0d1424] border border-cyan-500/30 hover:border-cyan-400 shadow-[0_4px_16px_rgba(0,0,0,0.7)] hover:shadow-[0_0_12px_rgba(0,229,255,0.3)] transition-all duration-200 group cursor-pointer backdrop-blur-md"
            title="Open Orion Telemetry Terminal Drawer"
          >
            <span className="font-mono text-xs font-bold text-gray-300 group-hover:text-cyan-300 tracking-wider">
              &gt;_ TERMINAL
            </span>

            {/* Active WebSocket ping dot */}
            <span className="flex items-center gap-1.5 text-[10px] font-mono">
              <span className="relative flex h-2 w-2">
                {connectionStatus === 'CONNECTED' && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                )}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${
                  connectionStatus === 'CONNECTED' 
                    ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' 
                    : connectionStatus === 'RECONNECTING' || connectionStatus === 'CONNECTING' 
                    ? 'bg-amber-400 animate-pulse' 
                    : 'bg-red-400'
                }`} />
              </span>
              <span className={connectionStatus === 'CONNECTED' ? 'text-emerald-400 font-bold' : 'text-gray-400'}>
                {connectionStatus === 'CONNECTED' ? 'LIVE' : connectionStatus === 'RECONNECTING' ? 'RETRY' : 'OFFLINE'}
              </span>
            </span>
          </button>
        </div>
      )}

      {/* 2. SLIDE-UP TERMINAL DRAWER (Integrated IDE Developer Drawer) */}
      <div 
        className={`fixed bottom-0 left-0 right-0 z-[160] flex flex-col pointer-events-auto transition-all duration-300 overflow-hidden shadow-[0_-12px_32px_rgba(0,0,0,0.85)] ${
          isExpanded ? 'h-[38vh]' : 'h-0 pointer-events-none'
        }`}
        style={{
          transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* HEADER BAR (Height: 36px, Dark Obsidian fill #090d16, Top Border) */}
        <div className="h-[36px] bg-[#090d16] border-t border-cyan-500/20 border-b border-[#1b2234] px-4 flex items-center justify-between flex-shrink-0 select-none font-mono">
          
          {/* Left: Title & Connection Pill */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-cyan-400 font-bold text-xs">&gt;_</span>
              <h3 className="text-[11px] font-bold text-cyan-400 tracking-[0.15em] uppercase">
                ORION-X TELEMETRY KERNEL // STREAM
              </h3>
            </div>

            {/* Connection Status Pill */}
            <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] transition-all ${
              connectionStatus === 'CONNECTED'
                ? 'bg-emerald-950/40 border-emerald-500/40 shadow-[0_0_10px_rgba(52,211,153,0.25)]'
                : 'bg-[#111726] border-[#212c44]'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                connectionStatus === 'CONNECTED' 
                  ? 'bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse' 
                  : connectionStatus === 'CONNECTING' || connectionStatus === 'RECONNECTING'
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-red-400'
              }`} />
              <span className={`font-semibold ${
                connectionStatus === 'CONNECTED'
                  ? 'text-emerald-400'
                  : connectionStatus === 'CONNECTING' || connectionStatus === 'RECONNECTING'
                  ? 'text-amber-400'
                  : 'text-red-400'
              }`}>
                {connectionStatus === 'CONNECTED' ? 'LIVE (CONNECTED)' : connectionStatus === 'RECONNECTING' ? 'RECONNECTING...' : connectionStatus === 'CONNECTING' ? 'CONNECTING...' : 'OFFLINE'}
              </span>
              <span className="text-gray-500 hidden sm:inline text-[9px]">
                ({wsUrl})
              </span>
            </div>

            {/* Total Event Count */}
            <span className="text-[10px] text-gray-500 hidden md:inline">
              [{logs.length} events]
            </span>
          </div>

          {/* Right: Actions Bar */}
          <div className="flex items-center gap-2 text-xs">
            {/* Filter Input */}
            <input
              type="text"
              placeholder="Filter..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="bg-[#111726] border border-[#212c44] rounded px-2 py-0.5 text-[10px] text-gray-200 placeholder-gray-500 outline-none focus:border-cyan-500/50 w-24 sm:w-32 font-mono"
            />

            {/* Fallback Simulator Toggle */}
            <button
              type="button"
              onClick={() => setSimulationActive(!simulationActive)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono tracking-wider transition-all border ${
                simulationActive 
                  ? 'bg-purple-950/60 text-purple-300 border-purple-500/50' 
                  : 'bg-[#111726] text-gray-400 border-[#212c44] hover:text-gray-200'
              }`}
              title="Toggle simulated telemetry stream when backend is offline"
            >
              [SIM: {simulationActive ? 'ON' : 'OFF'}]
            </button>

            {/* Auto-Scroll Toggle */}
            <button
              type="button"
              onClick={() => setAutoscroll(!autoscroll)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono tracking-wider transition-all border ${
                autoscroll
                  ? 'bg-cyan-950/50 text-cyan-300 border-cyan-500/40'
                  : 'bg-[#111726] text-gray-400 border-[#212c44] hover:text-gray-200'
              }`}
            >
              [ AUTOSCROLL: {autoscroll ? 'ON' : 'OFF'} ]
            </button>

            {/* Clear Logs */}
            <button
              type="button"
              onClick={handleClearLogs}
              className="px-2 py-0.5 rounded text-[10px] font-mono tracking-wider text-gray-400 hover:text-red-300 bg-[#111726] hover:bg-red-950/30 border border-[#212c44] hover:border-red-500/40 transition-all"
            >
              [ CLEAR ]
            </button>

            {/* Minimize / Close Chevron (▾) */}
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="px-2 py-0.5 rounded text-gray-400 hover:text-cyan-300 hover:bg-[#111726] transition-colors font-mono font-bold"
              title="Minimize Drawer"
            >
              ▾
            </button>
          </div>
        </div>

        {/* LOG VIEWPORT (Background: pitch-black obsidian #05080e, scanline/grid texture) */}
        <div 
          ref={logContainerRef}
          className="flex-1 overflow-y-auto p-2.5 font-mono text-[12px] space-y-0.5 selection:bg-cyan-950 selection:text-cyan-200"
          style={{
            backgroundColor: '#05080e',
            backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(0, 229, 255, 0.02) 0%, transparent 60%), repeating-linear-gradient(0deg, rgba(0,0,0,0.2), rgba(0,0,0,0.2) 1px, transparent 1px, transparent 2px)',
            fontFamily: '"Fira Code", "JetBrains Mono", Consolas, Menlo, monospace'
          }}
        >
          {filteredLogs.length === 0 ? (
            <div className="py-8 text-center text-gray-600 font-mono text-xs">
              // No logs matching criteria. Waiting for incoming telemetry packets...
            </div>
          ) : (
            filteredLogs.map((log) => {
              // Color coding by log level: Cyan for INFO, Amber for WARN, Emerald for OK, Crimson for ERR
              const levelColor = 
                log.level === 'ERR' ? 'text-red-400 font-bold' :
                log.level === 'WARN' ? 'text-amber-400 font-bold' :
                log.level === 'OK' ? 'text-emerald-400 font-bold' :
                log.level === 'DEBUG' ? 'text-purple-400' :
                'text-cyan-400 font-bold';

              // High-contrast agent role badge pills
              let sourceBadge = 'text-purple-300 font-semibold';
              const srcUpper = (log.source || '').toUpperCase();
              if (srcUpper.includes('ARCHITECT')) {
                sourceBadge = 'bg-purple-950/80 border border-purple-500/50 text-purple-300 px-1.5 py-0.5 rounded shadow-[0_0_8px_rgba(168,85,247,0.35)] font-bold';
              } else if (srcUpper.includes('DEVELOPER')) {
                sourceBadge = 'bg-cyan-950/80 border border-cyan-500/50 text-cyan-300 px-1.5 py-0.5 rounded shadow-[0_0_8px_rgba(6,182,212,0.35)] font-bold';
              } else if (srcUpper.includes('AUDITOR')) {
                sourceBadge = 'bg-amber-950/80 border border-amber-500/50 text-amber-300 px-1.5 py-0.5 rounded shadow-[0_0_8px_rgba(245,158,11,0.35)] font-bold';
              } else if (srcUpper.includes('SECURITY')) {
                sourceBadge = 'bg-red-950/80 border border-red-500/50 text-red-300 px-1.5 py-0.5 rounded shadow-[0_0_8px_rgba(239,68,68,0.35)] font-bold';
              } else if (srcUpper.includes('SWARM')) {
                sourceBadge = 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 px-1.5 py-0.5 rounded shadow-[0_0_8px_rgba(16,185,129,0.35)] font-bold';
              } else if (srcUpper.includes('DOCKER') || srcUpper.includes('SANDBOX')) {
                sourceBadge = 'bg-blue-950/80 border border-blue-500/50 text-blue-300 px-1.5 py-0.5 rounded font-bold';
              }

              return (
                <div 
                  key={log.id} 
                  className="flex items-start gap-2 leading-relaxed hover:bg-white/[0.02] px-1 py-0.5 rounded transition-colors font-mono"
                >
                  {/* Line Number */}
                  <span className="text-[#3b4252] select-none shrink-0 w-8 text-right pr-2 text-[11px]">
                    {String(log.lineNum).padStart(3, '0')}
                  </span>

                  {/* Timestamp */}
                  <span className="text-gray-500 text-[11px] shrink-0 select-none">
                    [{log.timestamp}]
                  </span>

                  {/* Source tag */}
                  <span className={`shrink-0 text-[10px] ${sourceBadge}`}>
                    [{log.source}]
                  </span>

                  {/* Color-Coded Level */}
                  <span className={`shrink-0 text-[11px] ${levelColor}`}>
                    [{log.level}]
                  </span>

                  {/* Message */}
                  <span className="text-gray-200 break-all text-[12px]">
                    {log.message}
                  </span>
                </div>
              );
            })
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
    </>
  );
};

export default TelemetryTerminal;
