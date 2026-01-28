import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { MessageCircle, X, Send, Loader2, Bot, User, Minimize2 } from 'lucide-react';
import { parseMessageWithLinks, extractEntityNumbers, EntityMap } from '@/utils/parseEntityLinks';
import { resolveEntities, buildEntityMap } from '@/services/entityResolver';
import { EntityType } from '@/config/entities';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  entityMap?: EntityMap;
}

export function AIClientBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { profile } = useAuth();
  const { toast } = useToast();

  // Dragging state
  const [position, setPosition] = useState({ x: 24, y: 24 }); // bottom-right default
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);

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

  // Add global event listeners for drag
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

  const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/client-chat`;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Resolve entities in a message
  const resolveMessageEntities = useCallback(async (content: string): Promise<EntityMap> => {
    const entityNumbers = extractEntityNumbers(content);
    if (entityNumbers.length === 0) return {};

    try {
      const resolved = await resolveEntities(entityNumbers);
      return buildEntityMap(resolved);
    } catch (error) {
      console.error('Error resolving entities:', error);
      return {};
    }
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userContent = input.trim();

    // Resolve entities in user message
    const userEntityMap = await resolveMessageEntities(userContent);

    const userMessage: Message = {
      role: 'user',
      content: userContent,
      entityMap: userEntityMap,
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    let assistantContent = '';

    try {
      const response = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          message: userMessage.content,
          tenantId: profile?.tenant_id,
          // Include resolved entities for context
          entityContext: Object.entries(userEntityMap)
            .filter(([_, info]) => info.exists)
            .map(([num, info]) => `${num}: ${info.summary}`)
            .join('\n'),
        }),
      });

      if (response.status === 429) {
        toast({
          title: 'Rate Limited',
          description: 'Too many requests. Please try again later.',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      if (response.status === 402) {
        toast({
          title: 'Payment Required',
          description: 'AI credits have been exhausted.',
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

      // Add initial assistant message
      setMessages(prev => [...prev, { role: 'assistant', content: '', entityMap: {} }]);

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

      // After streaming complete, resolve entities in assistant response
      if (assistantContent) {
        const assistantEntityMap = await resolveMessageEntities(assistantContent);
        // Merge with any entities from user message
        const combinedEntityMap: EntityMap = { ...userEntityMap, ...assistantEntityMap };

        setMessages(prev => {
          const newMessages = [...prev];
          const lastIdx = newMessages.length - 1;
          if (newMessages[lastIdx]?.role === 'assistant') {
            newMessages[lastIdx] = {
              ...newMessages[lastIdx],
              content: assistantContent,
              entityMap: combinedEntityMap,
            };
          }
          return newMessages;
        });
      }
    } catch (error) {
      console.error('Chat error:', error);
      toast({
        title: 'Error',
        description: 'Failed to get response. Please try again.',
        variant: 'destructive',
      });
      // Remove the empty assistant message if there was an error
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

  // Render message content with entity links
  const renderMessageContent = (message: Message) => {
    if (!message.content) {
      return isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null;
    }

    // Parse message and convert entity references to clickable links
    const parsed = parseMessageWithLinks(message.content, message.entityMap);

    return (
      <span className="whitespace-pre-wrap">
        {parsed.map((node, idx) => (
          <span key={idx}>{node}</span>
        ))}
      </span>
    );
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => !isDragging && setIsOpen(true)}
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
        className={`fixed h-10 w-10 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center z-50 transition-shadow duration-200 ${
          isDragging ? 'shadow-2xl scale-110 cursor-grabbing' : 'hover:shadow-xl cursor-grab'
        }`}
        style={{
          right: position.x,
          bottom: position.y,
          transition: isDragging ? 'none' : 'box-shadow 0.2s, transform 0.2s',
        }}
      >
        🤖
      </button>
    );
  }

  if (isMinimized) {
    return (
      <Card className="fixed bottom-6 right-6 w-72 shadow-lg z-50">
        <CardHeader className="p-3 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm">AI Assistant</CardTitle>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsMinimized(false)}>
              <Minimize2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="fixed bottom-6 right-6 w-96 h-[500px] shadow-lg z-50 flex flex-col">
      <CardHeader className="p-3 border-b flex flex-row items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <CardTitle className="text-sm">AI Assistant</CardTitle>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsMinimized(true)}>
            <Minimize2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Hi! I can help you find information about:</p>
            <ul className="text-xs mt-2 space-y-1">
              <li>• Tasks (e.g., "What's the status of TSK-00142?")</li>
              <li>• Shipments (e.g., "Show me SHP-00891")</li>
              <li>• Items (e.g., "Where is ITM-12345?")</li>
              <li>• Quotes (e.g., "Find quote EST-00001")</li>
              <li>• And more - just ask!</li>
            </ul>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div
                  className={`p-2 rounded-full shrink-0 ${
                    msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </div>
                <div
                  className={`rounded-lg p-3 max-w-[80%] text-sm ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  {renderMessageContent(msg)}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <CardContent className="p-3 border-t shrink-0">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about tasks, shipments, items..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button onClick={sendMessage} disabled={isLoading || !input.trim()} size="icon">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
