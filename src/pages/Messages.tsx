import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useMessages, MessageRecipient, InAppNotification } from '@/hooks/useMessages';
import { useDepartments } from '@/hooks/useDepartments';
import { useUsers } from '@/hooks/useUsers';
import { usePresence } from '@/hooks/usePresence';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AvatarWithPresence } from '@/components/ui/online-indicator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { ConversationView } from '@/components/messages/ConversationView';
import { MessageInputBar } from '@/components/messages/MessageInputBar';

export default function Messages() {
  const { profile } = useAuth();
  const {
    messages,
    notifications,
    unreadCount,
    loading,
    sendMessage,
    markMessageRead,
    markNotificationRead,
    markAllNotificationsRead,
    archiveMessage,
    deleteNotification,
    refetchMessages,
    refetchNotifications,
  } = useMessages();

  const { departments } = useDepartments();
  const { users, roles } = useUsers();
  const { getUserStatus, onlineCount } = usePresence();

  // Get initials from user
  const getInitials = (user: { first_name?: string | null; last_name?: string | null; email?: string | null }) => {
    if (user.first_name && user.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    }
    if (user.first_name) {
      return user.first_name.substring(0, 2).toUpperCase();
    }
    return user.email?.substring(0, 2).toUpperCase() || '??';
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'list' | 'conversation'>('list');
  const [composeOpen, setComposeOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [sending, setSending] = useState(false);

  // Compose form state
  const [newMessage, setNewMessage] = useState({
    subject: '',
    body: '',
    recipientType: 'user' as 'user' | 'role' | 'department',
    recipientIds: [] as string[],
    priority: 'normal' as 'low' | 'normal' | 'high' | 'urgent',
  });

  // Group messages into conversations by sender
  const conversations = useMemo(() => {
    const convMap = new Map<string, {
      contactId: string;
      contactName: string;
      lastMessage: string;
      lastMessageTime: string;
      unread: boolean;
      messages: MessageRecipient[];
    }>();

    for (const msg of messages) {
      const senderId = msg.message?.sender_id;
      if (!senderId) continue;

      const isFromMe = senderId === profile?.id;
      const contactId = isFromMe ? (msg.recipient_id || senderId) : senderId;
      const contactName = isFromMe
        ? 'Me'
        : `${msg.message?.sender?.first_name || ''} ${msg.message?.sender?.last_name || ''}`.trim() || 'Unknown';

      const existing = convMap.get(contactId);
      if (existing) {
        existing.messages.push(msg);
        if (!msg.is_read && !isFromMe) existing.unread = true;
        if (new Date(msg.created_at) > new Date(existing.lastMessageTime)) {
          existing.lastMessage = msg.message?.body?.substring(0, 80) || '';
          existing.lastMessageTime = msg.created_at;
        }
      } else {
        convMap.set(contactId, {
          contactId,
          contactName,
          lastMessage: msg.message?.body?.substring(0, 80) || '',
          lastMessageTime: msg.created_at,
          unread: !msg.is_read && !isFromMe,
          messages: [msg],
        });
      }
    }

    return Array.from(convMap.values()).sort(
      (a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
    );
  }, [messages, profile?.id]);

  // Filter conversations by search
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const query = searchQuery.toLowerCase();
    return conversations.filter((c) =>
      c.contactName.toLowerCase().includes(query) ||
      c.lastMessage.toLowerCase().includes(query)
    );
  }, [conversations, searchQuery]);

  // Get selected conversation
  const selectedConversation = useMemo(() => {
    return conversations.find((c) => c.contactId === selectedConversationId) || null;
  }, [conversations, selectedConversationId]);

  // Build conversation messages for the view
  const conversationMessages = useMemo(() => {
    if (!selectedConversation) return [];
    return selectedConversation.messages
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map((msg) => ({
        id: msg.id,
        content: msg.message?.body || '',
        sender_id: msg.message?.sender_id || '',
        sender_name: `${msg.message?.sender?.first_name || ''} ${msg.message?.sender?.last_name || ''}`.trim(),
        created_at: msg.created_at,
        is_sent: msg.message?.sender_id === profile?.id,
      }));
  }, [selectedConversation, profile?.id]);

  // Handle selecting a conversation
  const handleSelectConversation = async (contactId: string) => {
    setSelectedConversationId(contactId);
    setMobileView('conversation');

    const conv = conversations.find((c) => c.contactId === contactId);
    if (conv) {
      for (const msg of conv.messages) {
        if (!msg.is_read && msg.message_id) {
          await markMessageRead(msg.message_id);
        }
      }
    }
  };

  // Handle sending a message in conversation
  const handleSendInConversation = async (text: string) => {
    if (!selectedConversationId || !text.trim()) return;

    setSending(true);
    await sendMessage({
      subject: 'Message',
      body: text,
      recipients: [{ type: 'user', id: selectedConversationId }],
    });
    setSending(false);
  };

  // Handle sending a new compose message
  const handleSendMessage = async () => {
    if (!newMessage.subject.trim() || !newMessage.body.trim()) return;
    if (newMessage.recipientIds.length === 0) return;

    setSending(true);
    const success = await sendMessage({
      subject: newMessage.subject,
      body: newMessage.body,
      recipients: newMessage.recipientIds.map((id) => ({
        type: newMessage.recipientType,
        id,
      })),
      priority: newMessage.priority,
    });

    if (success) {
      setComposeOpen(false);
      setNewMessage({
        subject: '',
        body: '',
        recipientType: 'user',
        recipientIds: [],
        priority: 'normal',
      });
    }
    setSending(false);
  };

  // Format date for conversation list
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  // Get recipient options based on type
  const recipientOptions = useMemo(() => {
    switch (newMessage.recipientType) {
      case 'user':
        return users.map((u) => ({
          value: u.id,
          label: `${u.first_name || ''} ${u.last_name || ''} (${u.email})`.trim(),
        }));
      case 'role':
        return roles.map((r) => ({
          value: r.id,
          label: r.name,
        }));
      case 'department':
        return departments.map((d) => ({
          value: d.id,
          label: d.name,
        }));
      default:
        return [];
    }
  }, [newMessage.recipientType, users, roles, departments]);

  // Unread notifications count
  const unreadNotifications = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications]
  );

  // Filter notifications
  const filteredNotifications = useMemo(() => {
    if (!searchQuery.trim()) return notifications;
    const query = searchQuery.toLowerCase();
    return notifications.filter(
      (n) =>
        n.title?.toLowerCase().includes(query) ||
        n.body?.toLowerCase().includes(query)
    );
  }, [notifications, searchQuery]);

  // Handle selecting a notification
  const handleSelectNotification = async (notif: InAppNotification) => {
    if (!notif.is_read) {
      await markNotificationRead(notif.id);
    }
    if (notif.action_url) {
      window.location.href = notif.action_url;
    }
  };

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100dvh-3rem-env(safe-area-inset-top,0px))] overflow-hidden">
        {/* Left Panel - Conversation List */}
        <div
          className={cn(
            'w-full md:w-80 md:min-w-[320px] border-r flex flex-col bg-background',
            mobileView === 'conversation' && 'hidden md:flex'
          )}
        >
          {/* List header */}
          <div className="p-4 border-b space-y-3">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-semibold">Messages</h1>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 relative"
                  onClick={() => setNotificationsOpen(true)}
                  title="Notifications"
                >
                  <MaterialIcon name="notifications" size="sm" />
                  {unreadNotifications > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center h-4 min-w-[16px] px-1 text-[9px] font-bold bg-red-500 text-white rounded-full">
                      {unreadNotifications > 99 ? '99+' : unreadNotifications}
                    </span>
                  )}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setComposeOpen(true)}>
                  <MaterialIcon name="edit_square" size="sm" />
                </Button>
              </div>
            </div>
            <div className="relative">
              <MaterialIcon name="search" size="sm" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto">
            {loading && messages.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <MaterialIcon name="progress_activity" size="lg" className="animate-spin mx-auto mb-2" />
                <p className="text-sm">Loading...</p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <MaterialIcon name="chat" size="xl" className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No conversations</p>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const initial = conv.contactName.charAt(0).toUpperCase();
                const isSelected = conv.contactId === selectedConversationId;

                return (
                  <div
                    key={conv.contactId}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors',
                      isSelected
                        ? 'bg-primary/10 dark:bg-primary/20'
                        : 'hover:bg-muted/50'
                    )}
                    onClick={() => handleSelectConversation(conv.contactId)}
                  >
                    <AvatarWithPresence
                      status={getUserStatus(conv.contactId)}
                      indicatorSize="sm"
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="text-sm font-semibold bg-primary/10 text-primary">
                          {initial}
                        </AvatarFallback>
                      </Avatar>
                    </AvatarWithPresence>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold truncate">{conv.contactName}</span>
                        <span className="text-xs text-muted-foreground shrink-0 ml-2">
                          {formatDate(conv.lastMessageTime)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground truncate flex-1">
                          {conv.lastMessage}
                        </p>
                        {conv.unread && (
                          <span className="h-2.5 w-2.5 rounded-full bg-primary shrink-0" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Panel - Conversation Detail */}
        <div
          className={cn(
            'flex-1 flex flex-col bg-background',
            mobileView === 'list' && 'hidden md:flex'
          )}
        >
          {selectedConversation ? (
            <>
              {/* Conversation header */}
              <div className="border-b px-4 py-3 flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 md:hidden"
                  onClick={() => setMobileView('list')}
                >
                  <MaterialIcon name="arrow_back" size="md" />
                </Button>
                <AvatarWithPresence
                  status={getUserStatus(selectedConversation.contactId)}
                  indicatorSize="sm"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                      {selectedConversation.contactName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </AvatarWithPresence>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{selectedConversation.contactName}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {getUserStatus(selectedConversation.contactId)}
                  </p>
                </div>
              </div>

              {/* Messages */}
              <ConversationView
                messages={conversationMessages}
                currentUserId={profile?.id || ''}
              />

              {/* Input bar */}
              <MessageInputBar
                onSend={handleSendInConversation}
                disabled={sending}
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MaterialIcon name="chat_bubble_outline" size="xl" className="mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium">Select a conversation</p>
                <p className="text-xs mt-1">Choose a conversation to start messaging</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Notifications Dialog */}
      <Dialog open={notificationsOpen} onOpenChange={setNotificationsOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[80vh] flex flex-col">
          <DialogHeader className="flex-row items-center justify-between pr-8">
            <div>
              <DialogTitle>Notifications</DialogTitle>
              <DialogDescription>System alerts and updates</DialogDescription>
            </div>
            {unreadNotifications > 0 && (
              <Button variant="outline" size="sm" onClick={markAllNotificationsRead}>
                <MaterialIcon name="done_all" size="sm" className="mr-1" />
                Read All
              </Button>
            )}
          </DialogHeader>
          <div className="flex-1 overflow-y-auto divide-y -mx-6 px-6">
            {loading && notifications.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <MaterialIcon name="progress_activity" size="lg" className="animate-spin mx-auto mb-2" />
                Loading...
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <MaterialIcon name="notifications" size="xl" className="mx-auto mb-2 opacity-50" />
                No notifications
              </div>
            ) : (
              filteredNotifications.map((notif) => (
                <div
                  key={notif.id}
                  className={cn(
                    'py-3 cursor-pointer hover:bg-muted/50 transition-colors flex items-start justify-between gap-3',
                    !notif.is_read && 'bg-blue-50 dark:bg-blue-950 -mx-6 px-6'
                  )}
                  onClick={() => handleSelectNotification(notif)}
                >
                  <div className="flex items-start gap-2">
                    {!notif.is_read && (
                      <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-2" />
                    )}
                    <div className={cn(!notif.is_read ? '' : 'ml-4')}>
                      <p className="font-medium text-sm">{notif.title}</p>
                      {notif.body && (
                        <p className="text-xs text-muted-foreground mt-0.5">{notif.body}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <MaterialIcon name="schedule" size="sm" />
                        {formatDate(notif.created_at)}
                        <Badge variant="secondary" className="text-xs">{notif.category}</Badge>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(notif.id);
                    }}
                  >
                    <MaterialIcon name="delete" size="sm" className="text-muted-foreground" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Compose Message Dialog */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>New Message</DialogTitle>
            <DialogDescription>Send a message to users, roles, or departments</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Recipient Type</Label>
                <Select
                  value={newMessage.recipientType}
                  onValueChange={(v) => setNewMessage({
                    ...newMessage,
                    recipientType: v as 'user' | 'role' | 'department',
                    recipientIds: [],
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">
                      <div className="flex items-center gap-2">
                        <MaterialIcon name="person" size="sm" />
                        Individual User
                      </div>
                    </SelectItem>
                    <SelectItem value="role">
                      <div className="flex items-center gap-2">
                        <MaterialIcon name="group" size="sm" />
                        Role (All Users)
                      </div>
                    </SelectItem>
                    <SelectItem value="department">
                      <div className="flex items-center gap-2">
                        <MaterialIcon name="business" size="sm" />
                        Department
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={newMessage.priority}
                  onValueChange={(v) => setNewMessage({
                    ...newMessage,
                    priority: v as 'low' | 'normal' | 'high' | 'urgent',
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Recipients</Label>
              <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-1">
                {recipientOptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No {newMessage.recipientType}s available</p>
                ) : newMessage.recipientType === 'user' ? (
                  users.map((user) => (
                    <div
                      key={user.id}
                      className={cn(
                        'flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors',
                        newMessage.recipientIds.includes(user.id)
                          ? 'bg-primary/10'
                          : 'hover:bg-muted'
                      )}
                      onClick={() => {
                        if (newMessage.recipientIds.includes(user.id)) {
                          setNewMessage({
                            ...newMessage,
                            recipientIds: newMessage.recipientIds.filter((id) => id !== user.id),
                          });
                        } else {
                          setNewMessage({
                            ...newMessage,
                            recipientIds: [...newMessage.recipientIds, user.id],
                          });
                        }
                      }}
                    >
                      <Checkbox
                        id={user.id}
                        checked={newMessage.recipientIds.includes(user.id)}
                        onCheckedChange={() => {}}
                        className="pointer-events-none"
                      />
                      <AvatarWithPresence
                        status={getUserStatus(user.id)}
                        indicatorSize="sm"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {getInitials(user)}
                          </AvatarFallback>
                        </Avatar>
                      </AvatarWithPresence>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {user.first_name || user.last_name
                            ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
                            : 'Unnamed'}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  recipientOptions.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2 p-2">
                      <Checkbox
                        id={option.value}
                        checked={newMessage.recipientIds.includes(option.value)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setNewMessage({
                              ...newMessage,
                              recipientIds: [...newMessage.recipientIds, option.value],
                            });
                          } else {
                            setNewMessage({
                              ...newMessage,
                              recipientIds: newMessage.recipientIds.filter((id) => id !== option.value),
                            });
                          }
                        }}
                      />
                      <label htmlFor={option.value} className="text-sm cursor-pointer">
                        {option.label}
                      </label>
                    </div>
                  ))
                )}
              </div>
              {newMessage.recipientIds.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {newMessage.recipientIds.length} recipient(s) selected
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={newMessage.subject}
                onChange={(e) => setNewMessage({ ...newMessage, subject: e.target.value })}
                placeholder="Message subject"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="body">Message</Label>
              <Textarea
                id="body"
                value={newMessage.body}
                onChange={(e) => setNewMessage({ ...newMessage, body: e.target.value })}
                placeholder="Write your message..."
                rows={6}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setComposeOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSendMessage}
              disabled={sending || !newMessage.subject.trim() || !newMessage.body.trim() || newMessage.recipientIds.length === 0}
            >
              {sending && <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />}
              Send Message
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
