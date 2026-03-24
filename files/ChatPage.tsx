import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bot, Send, Loader2, Trash2, Shield, Terminal,
  AlertTriangle, BookOpen, Sparkles, Copy, Check
} from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://192.168.1.101:3001';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  context?: string; // article context if passed in
}

interface ChatPageProps {
  /** Optional pre-filled context from vulnerability article */
  initialContext?: string;
  /** Optional initial question */
  initialQuestion?: string;
}

export function ChatPage({ initialContext, initialQuestion }: ChatPageProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => `chat-${Date.now()}`);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasProcessedInitial = useRef(false);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle initial context from article navigation
  useEffect(() => {
    if (hasProcessedInitial.current) return;
    if (initialContext || initialQuestion) {
      hasProcessedInitial.current = true;

      if (initialContext) {
        // Add a system message showing the context
        setMessages(prev => [...prev, {
          id: `sys-${Date.now()}`,
          role: 'system',
          content: `Article context loaded. You can now ask questions about this vulnerability.`,
          timestamp: new Date(),
          context: initialContext
        }]);
      }

      if (initialQuestion) {
        // Auto-send the initial question
        setTimeout(() => {
          sendMessage(initialQuestion, initialContext);
        }, 500);
      }
    }
  }, [initialContext, initialQuestion]);

  const sendMessage = useCallback(async (text?: string, context?: string) => {
    const messageText = text || input.trim();
    if (!messageText) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          sessionId,
          context: context || undefined
        })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();

      const assistantMsg: ChatMessage = {
        id: `asst-${Date.now()}`,
        role: 'assistant',
        content: data.reply || 'I was unable to generate a response.',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMsg]);

    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `Connection error: ${err.message}. Make sure the backend is running at ${BACKEND_URL} with Groq API key or Ollama configured.`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [input, sessionId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = async () => {
    setMessages([]);
    try {
      await fetch(`${BACKEND_URL}/api/chat/${sessionId}`, { method: 'DELETE' });
    } catch { /* ignore */ }
  };

  const copyMessage = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Quick suggestion buttons
  const suggestions = [
    'Explain the latest critical CVEs and how to protect my pfSense firewall',
    'How do I configure Suricata IDS rules for SSH brute force detection?',
    'What pfBlockerNG lists should I enable for maximum protection?',
    'Analyze my network architecture for security weaknesses',
    'How to set up proper firewall segmentation with VLANs on pfSense',
  ];

  const glassStyle = { background: 'rgba(20, 24, 40, 0.5)', backdropFilter: 'blur(10px)' };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/30">
            <Bot className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Security Expert Chat</h2>
            <p className="text-sm text-muted-foreground">
              Network &amp; cybersecurity assistant powered by AI
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground border border-border rounded-lg px-3 py-1.5">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            AI Online
          </div>
          <button
            onClick={clearChat}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted transition-colors"
          >
            <Trash2 className="h-4 w-4" /> Clear
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto rounded-lg border border-border p-4 space-y-4 min-h-0" style={glassStyle}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 mb-6">
              <Shield className="h-12 w-12 text-primary/40" />
            </div>
            <h3 className="text-lg font-medium mb-2">Cybersecurity Expert Assistant</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-8">
              Ask me about network security, pfSense configuration, vulnerability analysis,
              incident response, or anything cybersecurity related.
            </p>
            <div className="grid grid-cols-1 gap-2 max-w-lg w-full">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s)}
                  className="text-left text-sm px-4 py-3 rounded-lg border border-border hover:border-primary/30 hover:bg-primary/5 transition-colors text-muted-foreground hover:text-foreground"
                >
                  <Sparkles className="h-3 w-3 inline mr-2 text-primary" />{s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role !== 'user' && (
              <div className={`shrink-0 h-8 w-8 rounded-lg flex items-center justify-center ${msg.role === 'system' ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-primary/10 border border-primary/30'}`}>
                {msg.role === 'system' ? <AlertTriangle className="h-4 w-4 text-yellow-400" /> : <Bot className="h-4 w-4 text-primary" />}
              </div>
            )}
            <div className={`max-w-[75%] rounded-lg px-4 py-3 text-sm group relative ${
              msg.role === 'user'
                ? 'bg-primary/10 border border-primary/30 text-foreground'
                : msg.role === 'system'
                  ? 'bg-yellow-500/5 border border-yellow-500/20 text-yellow-200'
                  : 'bg-card border border-border text-foreground'
            }`}>
              {/* System context indicator */}
              {msg.context && (
                <div className="mb-2 pb-2 border-b border-border/50">
                  <div className="flex items-center gap-1.5 text-xs text-primary">
                    <BookOpen className="h-3 w-3" />
                    Article context attached
                  </div>
                </div>
              )}

              {/* Message content with basic markdown rendering */}
              <div className="whitespace-pre-wrap break-words leading-relaxed">
                {msg.content.split('\n').map((line, i) => {
                  // Bold
                  const formatted = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
                  // Code inline
                  const withCode = formatted.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-black/30 text-primary text-xs font-mono">$1</code>');
                  // Bullet points
                  if (line.startsWith('- ') || line.startsWith('• ')) {
                    return <div key={i} className="ml-3" dangerouslySetInnerHTML={{ __html: '• ' + withCode.slice(2) }} />;
                  }
                  return <div key={i} dangerouslySetInnerHTML={{ __html: withCode }} />;
                })}
              </div>

              {/* Copy button */}
              {msg.role === 'assistant' && (
                <button
                  onClick={() => copyMessage(msg.id, msg.content)}
                  className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-muted transition-all"
                >
                  {copiedId === msg.id ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
                </button>
              )}

              <div className="mt-1.5 text-[10px] text-muted-foreground/60">
                {msg.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3">
            <div className="shrink-0 h-8 w-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div className="rounded-lg bg-card border border-border px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing...
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="mt-4 shrink-0">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about network security, firewall rules, vulnerabilities..."
              rows={1}
              className="w-full rounded-lg border border-border bg-card px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-30"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground text-center">
          <Terminal className="h-3 w-3 inline mr-1" />
          Shift+Enter for new line · AI may produce inaccurate information
        </p>
      </div>
    </div>
  );
}
