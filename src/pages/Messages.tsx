import { useState, useMemo, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useMessages, Message, MessageRecipient, InAppNotification, SendMessageParams } from '@/hooks/useMessages';
import { useDepartments } from '@/hooks/useDepartments';
import { useUsers } from '@/hooks/useUsers';
import { usePresence } from '@/hooks/usePresence';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AvatarWithPresence, OnlineIndicator } from '@/components/ui/online-indicator';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import {
  MessageSquare,
  Bell,
  Send,
  RefreshCw,
  Plus,
  Inbox,
  Archive,
  Search,
  Check,
  CheckCheck,
  Mail,
  MailOpen,
  Trash2,
  Clock,
  User as UserIcon,
  Users,
  Building2,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

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

  const [activeTab, setActiveTab] = useState('inbox');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<MessageRecipient | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [sending, setSending] = useState(false);

  // Compose form state
  const [newMessage, setNewMessage] = useState({
    subject: '',
    body: '',
    recipientType: 'user' as 'user' | 'role' | 'department',
    recipientIds: [] as string[],
    priority: 'normal' as 'low' | 'normal' | 'high' | 'urgent',
  });

  // Reply form state
  const [replyBody, setReplyBody] = useState('');

  // Filter messages based on search
  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    const query = searchQuery.toLowerCase();
    return messages.filter(
      (m) =>
        m.message?.subject?.toLowerCase().includes(query) ||
        m.message?.body?.toLowerCase().includes(query) ||
        m.message?.sender?.first_name?.toLowerCase().includes(query) ||
        m.message?.sender?.last_name?.toLowerCase().includes(query)
    );
  }, [messages, searchQuery]);

  // Filter notifications based on search
  const filteredNotifications = useMemo(() => {
    if (!searchQuery.trim()) return notifications;
    const query = searchQuery.toLowerCase();
    return notifications.filter(
      (n) =>
        n.title?.toLowerCase().includes(query) ||
        n.body?.toLowerCase().includes(query)
    );
  }, [notifications, searchQuery]);

  // Unread messages count
  const unreadMessages = useMemo(
    () => messages.filter((m) => !m.is_read).length,
    [messages]
  );

  // Unread notifications count
  const unreadNotifications = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications]
  );

  // Handle selecting a message
  const handleSelectMessage = async (msg: MessageRecipient) => {
    setSelectedMessage(msg);
    if (!msg.is_read && msg.message_id) {
      await markMessageRead(msg.message_id);
    }
  };

  // Handle selecting a notification
  const handleSelectNotification = async (notif: InAppNotification) => {
    if (!notif.is_read) {
      await markNotificationRead(notif.id);
    }
    // If there's an action URL, navigate to it
    if (notif.action_url) {
      window.location.href = notif.action_url;
    }
  };

  // Handle sending a new message
  const handleSendMessage = async () => {
    if (!newMessage.subject.trim() || !newMessage.body.trim()) {
      return;
    }
    if (newMessage.recipientIds.length === 0) {
      return;
    }

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

  // Handle replying to a message
  const handleReply = async () => {
    if (!replyBody.trim() || !selectedMessage?.message?.sender_id) {
      return;
    }

    setSending(true);
    const success = await sendMessage({
      subject: `Re: ${selectedMessage.message.subject}`,
      body: replyBody,
      recipients: [{ type: 'user', id: selectedMessage.message.sender_id }],
    });

    if (success) {
      setReplyOpen(false);
      setReplyBody('');
    }
    setSending(false);
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
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

  // Get priority badge
  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <Badge variant="destructive">Urgent</Badge>;
      case 'high':
        return <Badge className="bg-orange-500">High</Badge>;
      case 'low':
        return <Badge variant="secondary">Low</Badge>;
      default:
        return null;
    }
  };

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-6 space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <MessageSquare className="h-6 w-6" />
              Messages
            </h1>
            <p className="text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { refetchMessages(); refetchNotifications(); }}>
              <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setComposeOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Message
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="inbox" className="flex items-center gap-2">
              <Inbox className="h-4 w-4" />
              Inbox
              {unreadMessages > 0 && (
                <Badge variant="secondary" className="ml-1">{unreadMessages}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notifications
              {unreadNotifications > 0 && (
                <Badge variant="secondary" className="ml-1">{unreadNotifications}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Inbox Tab */}
          <TabsContent value="inbox" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              {/* Message List */}
              <Card className="lg:col-span-1">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Messages</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y max-h-[60vh] overflow-y-auto">
                    {loading && messages.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                        Loading...
                      </div>
                    ) : filteredMessages.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground">
                        <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        No messages
                      </div>
                    ) : (
                      filteredMessages.map((msg) => (
                        <div
                          key={msg.id}
                          className={cn(
                            "p-3 cursor-pointer hover:bg-muted/50 transition-colors",
                            !msg.is_read && "bg-blue-50 dark:bg-blue-950",
                            selectedMessage?.id === msg.id && "bg-muted"
                          )}
                          onClick={() => handleSelectMessage(msg)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                {!msg.is_read && (
                                  <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                                )}
                                {msg.message?.sender_id && (
                                  <OnlineIndicator
                                    status={getUserStatus(msg.message.sender_id)}
                                    size="sm"
                                    showPulse={false}
                                  />
                                )}
                                <span className="font-medium text-sm truncate">
                                  {msg.message?.sender?.first_name} {msg.message?.sender?.last_name}
                                </span>
                              </div>
                              <p className="text-sm font-medium truncate mt-1">
                                {msg.message?.subject}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {msg.message?.body?.substring(0, 60)}...
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-xs text-muted-foreground">
                                {formatDate(msg.created_at)}
                              </span>
                              {msg.message?.priority && msg.message.priority !== 'normal' && (
                                getPriorityBadge(msg.message.priority)
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Message Detail */}
              <Card className="lg:col-span-2">
                <CardContent className="p-6">
                  {selectedMessage?.message ? (
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <h2 className="text-xl font-semibold">{selectedMessage.message.subject}</h2>
                          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                            <UserIcon className="h-4 w-4" />
                            From: {selectedMessage.message.sender?.first_name} {selectedMessage.message.sender?.last_name}
                            <span className="text-muted-foreground">
                              ({selectedMessage.message.sender?.email})
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            {new Date(selectedMessage.created_at).toLocaleString()}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {selectedMessage.message.priority && selectedMessage.message.priority !== 'normal' && (
                            getPriorityBadge(selectedMessage.message.priority)
                          )}
                          {selectedMessage.is_read ? (
                            <Badge variant="outline" className="text-green-600">
                              <CheckCheck className="h-3 w-3 mr-1" />
                              Read
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              <Check className="h-3 w-3 mr-1" />
                              Unread
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Body */}
                      <div className="border-t pt-4">
                        <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                          {selectedMessage.message.body}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-4 border-t">
                        <Button onClick={() => setReplyOpen(true)}>
                          <Send className="h-4 w-4 mr-2" />
                          Reply
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            archiveMessage(selectedMessage.message_id);
                            setSelectedMessage(null);
                          }}
                        >
                          <Archive className="h-4 w-4 mr-2" />
                          Archive
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground py-20">
                      <div className="text-center">
                        <MailOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Select a message to read</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Online Users Sidebar */}
              <Card className="hidden lg:block">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    Online Now ({onlineCount})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[60vh]">
                    <div className="p-3 space-y-1">
                      {users.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No users found
                        </p>
                      ) : (
                        users.map((user) => {
                          const status = getUserStatus(user.id);
                          return (
                            <div
                              key={user.id}
                              className={cn(
                                "flex items-center gap-3 p-2 rounded-lg transition-colors",
                                status === 'online' && "bg-green-50 dark:bg-green-950/30"
                              )}
                            >
                              <AvatarWithPresence
                                status={status}
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
                                <p className="text-xs text-muted-foreground capitalize">
                                  {status}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="mt-4">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <div>
                  <CardTitle>Notifications</CardTitle>
                  <CardDescription>System alerts and updates</CardDescription>
                </div>
                {unreadNotifications > 0 && (
                  <Button variant="outline" size="sm" onClick={markAllNotificationsRead}>
                    <CheckCheck className="h-4 w-4 mr-2" />
                    Mark All Read
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {loading && notifications.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                      Loading...
                    </div>
                  ) : filteredNotifications.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      No notifications
                    </div>
                  ) : (
                    filteredNotifications.map((notif) => (
                      <div
                        key={notif.id}
                        className={cn(
                          "p-4 cursor-pointer hover:bg-muted/50 transition-colors flex items-start justify-between gap-4",
                          !notif.is_read && "bg-blue-50 dark:bg-blue-950"
                        )}
                        onClick={() => handleSelectNotification(notif)}
                      >
                        <div className="flex items-start gap-3">
                          {!notif.is_read && (
                            <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-2" />
                          )}
                          <div className={cn(!notif.is_read ? "" : "ml-4")}>
                            <p className="font-medium">{notif.title}</p>
                            {notif.body && (
                              <p className="text-sm text-muted-foreground mt-1">{notif.body}</p>
                            )}
                            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {formatDate(notif.created_at)}
                              <Badge variant="secondary" className="text-xs">{notif.category}</Badge>
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notif.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

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
                          <UserIcon className="h-4 w-4" />
                          Individual User
                        </div>
                      </SelectItem>
                      <SelectItem value="role">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Role (All Users)
                        </div>
                      </SelectItem>
                      <SelectItem value="department">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
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
                    // User list with avatars and presence
                    users.map((user) => (
                      <div
                        key={user.id}
                        className={cn(
                          "flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors",
                          newMessage.recipientIds.includes(user.id)
                            ? "bg-primary/10"
                            : "hover:bg-muted"
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
                    // Roles or departments without avatars
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
                {sending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Send Message
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reply Dialog */}
        <Dialog open={replyOpen} onOpenChange={setReplyOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Reply to Message</DialogTitle>
              <DialogDescription>
                Replying to: {selectedMessage?.message?.subject}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="reply">Your Reply</Label>
                <Textarea
                  id="reply"
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder="Write your reply..."
                  rows={6}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setReplyOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleReply} disabled={sending || !replyBody.trim()}>
                {sending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Send Reply
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
