import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export interface Message {
  id: string;
  tenant_id: string;
  sender_id: string;
  subject: string;
  body: string;
  message_type: 'message' | 'alert' | 'system';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  related_entity_type?: string;
  related_entity_id?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  sender?: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

export interface MessageRecipient {
  id: string;
  message_id: string;
  recipient_type: 'user' | 'role' | 'department';
  recipient_id: string;
  user_id: string;
  is_read: boolean;
  read_at?: string;
  is_archived: boolean;
  created_at: string;
  message?: Message;
}

export interface InAppNotification {
  id: string;
  tenant_id: string;
  user_id: string;
  title: string;
  body?: string;
  icon?: string;
  category: string;
  related_entity_type?: string;
  related_entity_id?: string;
  action_url?: string;
  is_read: boolean;
  read_at?: string;
  priority: string;
  created_at: string;
}

export interface SendMessageParams {
  subject: string;
  body: string;
  recipients: {
    type: 'user' | 'role' | 'department';
    id: string;
  }[];
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  related_entity_type?: string;
  related_entity_id?: string;
}

export function useMessages() {
  const { toast } = useToast();
  const { profile } = useAuth();
  const [messages, setMessages] = useState<MessageRecipient[]>([]);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Fetch messages for the current user
  const fetchMessages = useCallback(async (options?: { archived?: boolean }) => {
    if (!profile?.id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('message_recipients')
        .select(`
          id, message_id, recipient_type, recipient_id, user_id,
          is_read, read_at, is_archived, created_at,
          messages!inner (
            id, tenant_id, sender_id, subject, body, message_type, priority,
            related_entity_type, related_entity_id, metadata, created_at,
            users!messages_sender_id_fkey (first_name, last_name, email)
          )
        `)
        .eq('user_id', profile.id)
        .is('deleted_at', null)
        .eq('is_archived', options?.archived || false)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const transformed = (data || []).map((r: any) => ({
        ...r,
        message: {
          ...r.messages,
          sender: r.messages?.users,
        },
      }));

      // Also fetch messages SENT by this user so they appear in conversations
      if (!options?.archived) {
        const { data: sentData } = await (supabase as any)
          .from('messages')
          .select(`
            id, tenant_id, sender_id, subject, body, message_type, priority,
            related_entity_type, related_entity_id, metadata, created_at,
            sender:users!messages_sender_id_fkey (first_name, last_name, email),
            recipients:message_recipients (id, message_id, recipient_type, recipient_id, user_id, is_read, read_at, is_archived, created_at)
          `)
          .eq('sender_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(100);

        const sentTransformed = (sentData || []).flatMap((msg: any) =>
          (msg.recipients || []).map((r: any) => ({
            ...r,
            message: {
              id: msg.id,
              tenant_id: msg.tenant_id,
              sender_id: msg.sender_id,
              subject: msg.subject,
              body: msg.body,
              message_type: msg.message_type,
              priority: msg.priority,
              related_entity_type: msg.related_entity_type,
              related_entity_id: msg.related_entity_id,
              metadata: msg.metadata,
              created_at: msg.created_at,
              sender: msg.sender,
            },
          }))
        );

        // Merge and deduplicate by recipient record ID
        const allMessages = [...transformed, ...sentTransformed];
        const seen = new Set<string>();
        const deduped = allMessages.filter((m) => {
          if (seen.has(m.id)) return false;
          seen.add(m.id);
          return true;
        });

        setMessages(deduped);
      } else {
        setMessages(transformed);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load messages',
      });
    } finally {
      setLoading(false);
    }
  }, [profile?.id, toast]);

  // Fetch notifications for the current user
  const fetchNotifications = useCallback(async () => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
        .from('in_app_notifications')
        .select('*')
        .eq('user_id', profile.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setNotifications((data || []) as InAppNotification[]);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  }, [profile?.id]);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase.rpc('get_total_unread_count', {
        p_user_id: profile.id,
      });

      if (error) throw error;
      setUnreadCount(data || 0);
    } catch (error) {
      console.error('Error fetching unread count:', error);
      // Fallback to manual count if RPC doesn't exist yet
      const { count: msgCount } = await supabase
        .from('message_recipients')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('is_read', false)
        .is('deleted_at', null);

      const { count: notifCount } = await supabase
        .from('in_app_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('is_read', false)
        .is('deleted_at', null);

      setUnreadCount((msgCount || 0) + (notifCount || 0));
    }
  }, [profile?.id]);

  // Send a new message
  const sendMessage = useCallback(async (params: SendMessageParams): Promise<boolean> => {
    if (!profile?.id || !profile?.tenant_id) {
      toast({ variant: 'destructive', title: 'Error', description: 'Not authenticated' });
      return false;
    }

    try {
      // Create the message
      const { data: message, error: msgError } = await supabase
        .from('messages')
        .insert({
          tenant_id: profile.tenant_id,
          sender_id: profile.id,
          subject: params.subject,
          body: params.body,
          message_type: 'message',
          priority: params.priority || 'normal',
          related_entity_type: params.related_entity_type || null,
          related_entity_id: params.related_entity_id || null,
        })
        .select('id')
        .single();

      if (msgError) throw msgError;

      // Create recipients
      const recipientInserts = params.recipients.map((r) => ({
        message_id: message.id,
        recipient_type: r.type,
        recipient_id: r.id,
        user_id: r.type === 'user' ? r.id : null, // Will be expanded by trigger for role/department
      }));

      const { error: recipError } = await supabase
        .from('message_recipients')
        .insert(recipientInserts);

      if (recipError) throw recipError;

      toast({ title: 'Message sent', description: 'Your message has been sent.' });
      return true;
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to send message',
      });
      return false;
    }
  }, [profile?.id, profile?.tenant_id, toast]);

  // Mark a message as read
  const markMessageRead = useCallback(async (messageId: string): Promise<boolean> => {
    if (!profile?.id) return false;

    try {
      const { error } = await supabase
        .from('message_recipients')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('message_id', messageId)
        .eq('user_id', profile.id);

      if (error) throw error;

      // Update local state
      setMessages((prev) =>
        prev.map((m) =>
          m.message_id === messageId ? { ...m, is_read: true, read_at: new Date().toISOString() } : m
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      return true;
    } catch (error) {
      console.error('Error marking message read:', error);
      return false;
    }
  }, [profile?.id]);

  // Mark a notification as read
  const markNotificationRead = useCallback(async (notificationId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('in_app_notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      return true;
    } catch (error) {
      console.error('Error marking notification read:', error);
      return false;
    }
  }, []);

  // Mark all notifications as read
  const markAllNotificationsRead = useCallback(async (): Promise<boolean> => {
    if (!profile?.id) return false;

    try {
      const { error } = await supabase
        .from('in_app_notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', profile.id)
        .eq('is_read', false);

      if (error) throw error;

      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );
      await fetchUnreadCount();

      return true;
    } catch (error) {
      console.error('Error marking all read:', error);
      return false;
    }
  }, [profile?.id, fetchUnreadCount]);

  // Archive a message
  const archiveMessage = useCallback(async (messageId: string): Promise<boolean> => {
    if (!profile?.id) return false;

    try {
      const { error } = await supabase
        .from('message_recipients')
        .update({ is_archived: true, archived_at: new Date().toISOString() })
        .eq('message_id', messageId)
        .eq('user_id', profile.id);

      if (error) throw error;

      setMessages((prev) => prev.filter((m) => m.message_id !== messageId));
      return true;
    } catch (error) {
      console.error('Error archiving message:', error);
      return false;
    }
  }, [profile?.id]);

  // Delete a notification
  const deleteNotification = useCallback(async (notificationId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('in_app_notifications')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      return true;
    } catch (error) {
      console.error('Error deleting notification:', error);
      return false;
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (profile?.id) {
      fetchMessages();
      fetchNotifications();
      fetchUnreadCount();
    }
  }, [profile?.id, fetchMessages, fetchNotifications, fetchUnreadCount]);

  // Set up realtime subscription for new messages
  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel('messages-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_recipients',
          filter: `user_id=eq.${profile.id}`,
        },
        () => {
          fetchMessages();
          fetchUnreadCount();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'in_app_notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        () => {
          fetchNotifications();
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, fetchMessages, fetchNotifications, fetchUnreadCount]);

  return {
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
    refetchMessages: fetchMessages,
    refetchNotifications: fetchNotifications,
    refetchUnreadCount: fetchUnreadCount,
  };
}
