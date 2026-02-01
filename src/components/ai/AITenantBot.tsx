import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { MaterialIcon } from '@/components/ui/MaterialIcon';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface UIContext {
  route?: string;
  selected_item_ids?: string[];
  selected_shipment_id?: string;
}

export function AITenantBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { profile } = useAuth();
  const { toast } = useToast();
  const location = useLocation();

  // Dragging state
  const [position, setPosition] = useState({ x: 24, y: 24 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);

  const getUIContext = useCallback((): UIContext => {
    return {
      route: location.pathname,
      selected_item_ids: undefined,
      selected_shipment_id: undefined,
    };
  }, [location.pathname]);

  const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    dragRef.current = {
      startX: clientX,
      startY: clientY,
      startPosX: position.x,
      startPosY: position.y,
    };
    setIsDragging(true);
  };

  const handleDragMove = useCallback((e: TouchEvent | MouseEvent) => {
    if (!isDragging || !dragRef.current) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const deltaX = dragRef.current.startX - clientX;
    const deltaY = dragRef.current.startY - clientY;

    setPosition({
      x: Math.max(8, Math.min(window.innerWidth - 48, dragRef.current.startPosX + deltaX)),
      y: Math.max(8, Math.min(window.innerHeight - 48, dragRef.current.startPosY + deltaY)),
    });
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    dragRef.current = null;
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDragMove);
      window.addEventListener('touchend', handleDragEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tenant-chat`;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userContent = input.trim();
    const userMessage: Message = { role: 'user', content: userContent };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    let assistantContent = '';

    try {
      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      const uiContext = getUIContext();

      const response = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          message: userMessage.content,
          tenantId: profile?.tenant_id,
          uiContext,
          conversationHistory,
        }),
      });

      if (response.status === 429) {
        toast({
          title: 'Rate Limited',
          description: 'Too many requests. Try again shortly.',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      if (response.status === 402) {
        toast({
          title: 'Payment Required',
          description: 'AI credits exhausted.',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      if (!response.ok || !response.body) {
        throw new Error('Failed to get response');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';

      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              setMessages(prev => {
                const newMessages = [...prev];
                const lastIdx = newMessages.length - 1;
                if (newMessages[lastIdx]?.role === 'assistant') {
                  newMessages[lastIdx] = { ...newMessages[lastIdx], content: assistantContent };
                }
                return newMessages;
              });
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      if (assistantContent) {
        setMessages(prev => {
          const newMessages = [...prev];
          const lastIdx = newMessages.length - 1;
          if (newMessages[lastIdx]?.role === 'assistant') {
            newMessages[lastIdx] = { ...newMessages[lastIdx], content: assistantContent };
          }
          return newMessages;
        });
      }
    } catch (error) {
      console.error('Chat error:', error);
      toast({
        title: 'Error',
        description: 'Failed to get response. Try again.',
        variant: 'destructive',
      });
      setMessages(prev => prev.filter((m, i) => !(i === prev.length - 1 && m.role === 'assistant' && !m.content)));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearConversation = () => {
    setMessages([]);
  };

  const renderMessageContent = (message: Message) => {
    if (!message.content) {
      return isLoading ? <MaterialIcon name="progress_activity" size="sm" className="animate-spin" /> : null;
    }

    const content = message.content;
    const lines = content.split('\n');

    return (
      <div className="whitespace-pre-wrap font-mono text-xs">
        {lines.map((line, idx) => {
          // Bold text
          const boldRegex = /\*\*(.*?)\*\*/g;
          const parts: (string | JSX.Element)[] = [];
          let lastIndex = 0;
          let match;

          while ((match = boldRegex.exec(line)) !== null) {
            if (match.index > lastIndex) {
              parts.push(line.slice(lastIndex, match.index));
            }
            parts.push(<strong key={`bold-${idx}-${match.index}`}>{match[1]}</strong>);
            lastIndex = match.index + match[0].length;
          }

          if (lastIndex < line.length) {
            parts.push(line.slice(lastIndex));
          }

          // List items
          const isListItem = line.trim().startsWith('- ') || line.trim().startsWith('* ');
          if (isListItem) {
            const listContent = line.replace(/^[\s]*[-*]\s*/, '');
            return (
              <div key={idx} className="flex items-start gap-1 pl-2">
                <span className="text-muted-foreground">-</span>
                <span>{listContent}</span>
              </div>
            );
          }

          // Numbered items
          const numberedMatch = line.trim().match(/^(\d+)\.\s+(.*)/);
          if (numberedMatch) {
            return (
              <div key={idx} className="flex items-start gap-2 pl-2">
                <span className="text-muted-foreground min-w-[1.25rem]">{numberedMatch[1]}.</span>
                <span>{numberedMatch[2]}</span>
              </div>
            );
          }

          return (
            <div key={idx}>
              {parts.length > 0 ? parts : line}
            </div>
          );
        })}
      </div>
    );
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => !isDragging && setIsOpen(true)}
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
        className={`fixed h-12 w-12 rounded-full bg-slate-800 text-white shadow-lg flex items-center justify-center z-50 transition-shadow duration-200 ${
          isDragging ? 'shadow-2xl scale-110 cursor-grabbing' : 'hover:shadow-xl hover:bg-slate-700 cursor-grab'
        }`}
        style={{
          right: position.x,
          bottom: position.y,
          transition: isDragging ? 'none' : 'box-shadow 0.2s, transform 0.2s',
        }}
        title="Stride Ops Assistant"
      >
        <MaterialIcon name="terminal" size="md" />
      </button>
    );
  }

  if (isMinimized) {
    return (
      <Card className="fixed bottom-6 right-6 w-72 shadow-lg z-50 bg-slate-900 border-slate-700">
        <CardHeader className="p-3 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <MaterialIcon name="terminal" size="md" className="text-green-400" />
            <CardTitle className="text-sm text-slate-100">Ops Assistant</CardTitle>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-white" onClick={() => setIsMinimized(false)}>
              <MaterialIcon name="open_in_full" size="sm" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-white" onClick={() => setIsOpen(false)}>
              <MaterialIcon name="close" size="sm" />
            </Button>
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="fixed bottom-6 right-6 w-[420px] h-[560px] shadow-lg z-50 flex flex-col bg-slate-900 border-slate-700">
      <CardHeader className="p-3 border-b border-slate-700 flex flex-row items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <MaterialIcon name="terminal" size="md" className="text-green-400" />
          <div>
            <CardTitle className="text-sm text-slate-100">Ops Assistant</CardTitle>
            <p className="text-xs text-slate-400">Warehouse operations</p>
          </div>
        </div>
        <div className="flex gap-1">
          {messages.length > 0 && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-white" onClick={clearConversation} title="Clear">
              <MaterialIcon name="delete_sweep" size="sm" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-white" onClick={() => setIsMinimized(true)}>
            <MaterialIcon name="minimize" size="sm" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-white" onClick={() => setIsOpen(false)}>
            <MaterialIcon name="close" size="sm" />
          </Button>
        </div>
      </CardHeader>

      <ScrollArea ref={scrollRef} className="flex-1 p-4 bg-slate-950">
        {messages.length === 0 ? (
          <div className="text-slate-400 py-6">
            <p className="text-sm font-medium text-slate-200 mb-3">Stride Ops Assistant</p>
            <p className="text-xs mb-4">Search inventory, manage tasks, validate shipments.</p>
            <div className="space-y-2 text-xs font-mono bg-slate-900/50 rounded p-3 border border-slate-800">
              <p className="text-slate-500"># Examples</p>
              <p><span className="text-green-400">$</span> Where is item 12345?</p>
              <p><span className="text-green-400">$</span> What's in shipment 45678?</p>
              <p><span className="text-green-400">$</span> Create inspections for shipment SHP-99110</p>
              <p><span className="text-green-400">$</span> Move item 3435678 to B1-04</p>
              <p><span className="text-green-400">$</span> What's blocking outbound SHP-78901?</p>
              <p><span className="text-green-400">$</span> Who moved item 998877 last?</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex items-start gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`p-1.5 rounded shrink-0 ${
                  msg.role === 'user' ? 'bg-blue-600' : 'bg-slate-700'
                }`}>
                  {msg.role === 'user' ? (
                    <MaterialIcon name="person" size="sm" className="text-white" />
                  ) : (
                    <MaterialIcon name="terminal" size="sm" className="text-green-400" />
                  )}
                </div>
                <div className={`rounded p-2.5 max-w-[85%] ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-100'
                }`}>
                  {renderMessageContent(msg)}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <CardContent className="p-3 border-t border-slate-700 shrink-0 bg-slate-900">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Search, query, or command..."
            disabled={isLoading}
            className="flex-1 bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 font-mono text-sm"
          />
          <Button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            size="icon"
            className="bg-green-600 hover:bg-green-500"
          >
            {isLoading ? (
              <MaterialIcon name="progress_activity" size="sm" className="animate-spin" />
            ) : (
              <MaterialIcon name="send" size="sm" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
