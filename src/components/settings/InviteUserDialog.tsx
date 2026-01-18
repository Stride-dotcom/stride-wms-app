import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Mail, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Role } from '@/hooks/useUsers';

const inviteSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  role_id: z.string().min(1, 'Please select a role'),
});

type InviteFormData = z.infer<typeof inviteSchema>;

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: Role[];
  onSuccess: () => void;
}

export function InviteUserDialog({
  open,
  onOpenChange,
  roles,
  onSuccess,
}: InviteUserDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { profile } = useAuth();

  const form = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: '',
      first_name: '',
      last_name: '',
      role_id: '',
    },
  });

  const onSubmit = async (data: InviteFormData) => {
    if (!profile?.tenant_id || !profile?.id) return;

    try {
      setLoading(true);

      // Check if user already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id, email, deleted_at')
        .eq('email', data.email.toLowerCase())
        .eq('tenant_id', profile.tenant_id)
        .maybeSingle();

      if (existingUser && !existingUser.deleted_at) {
        toast({
          variant: 'destructive',
          title: 'User already exists',
          description: 'A user with this email already exists in your organization.',
        });
        return;
      }

      // Create a pending user record
      // Note: password_hash is set to a placeholder - actual auth is handled by Supabase Auth
      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert({
          email: data.email.toLowerCase(),
          first_name: data.first_name || null,
          last_name: data.last_name || null,
          tenant_id: profile.tenant_id,
          status: 'pending',
          password_hash: 'PENDING_INVITE', // Placeholder - actual auth via Supabase Auth
        })
        .select()
        .single();

      if (userError) throw userError;

      // Assign the selected role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: newUser.id,
          role_id: data.role_id,
          assigned_by: profile.id,
        });

      if (roleError) throw roleError;

      toast({
        title: 'Invitation sent',
        description: `An invitation has been created for ${data.email}. They will receive access when they sign up with this email.`,
      });

      form.reset();
      onSuccess();
    } catch (error) {
      console.error('Error inviting user:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to create invitation. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite User
          </DialogTitle>
          <DialogDescription>
            Add a new user to your organization. They will receive access when they sign up.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder="user@example.com" 
                        className="pl-9"
                        {...field} 
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="first_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="last_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="role_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          <div className="flex flex-col">
                            <span className="font-medium capitalize">{role.name}</span>
                            {role.description && (
                              <span className="text-xs text-muted-foreground">
                                {role.description}
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    This determines what the user can access
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Invitation
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}