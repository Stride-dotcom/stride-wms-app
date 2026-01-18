import { useEffect, useState } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { UserWithRoles, Role } from '@/hooks/useUsers';

const userSchema = z.object({
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  status: z.enum(['active', 'inactive', 'suspended']),
  roleIds: z.array(z.string()),
});

type UserFormData = z.infer<typeof userSchema>;

interface UserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  users: UserWithRoles[];
  roles: Role[];
  currentUserId?: string;
  onSuccess: () => void;
  onAssignRole: (userId: string, roleId: string) => Promise<void>;
  onRemoveRole: (userId: string, roleId: string) => Promise<void>;
}

export function UserDialog({
  open,
  onOpenChange,
  userId,
  users,
  roles,
  currentUserId,
  onSuccess,
  onAssignRole,
  onRemoveRole,
}: UserDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const user = users.find((u) => u.id === userId);
  const isCurrentUser = userId === currentUserId;

  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      status: 'active',
      roleIds: [],
    },
  });

  useEffect(() => {
    if (open && user) {
      form.reset({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        status: user.status as 'active' | 'inactive' | 'suspended',
        roleIds: user.roles.map((r) => r.id),
      });
    }
  }, [open, user, form]);

  const onSubmit = async (data: UserFormData) => {
    if (!userId) return;

    try {
      setLoading(true);

      // Update user details
      const { error: updateError } = await supabase
        .from('users')
        .update({
          first_name: data.first_name || null,
          last_name: data.last_name || null,
          status: data.status,
        })
        .eq('id', userId);

      if (updateError) throw updateError;

      // Handle role changes
      const currentRoleIds = user?.roles.map((r) => r.id) || [];
      const newRoleIds = data.roleIds;

      // Roles to add
      const rolesToAdd = newRoleIds.filter((id) => !currentRoleIds.includes(id));
      // Roles to remove
      const rolesToRemove = currentRoleIds.filter((id) => !newRoleIds.includes(id));

      // Add new roles
      for (const roleId of rolesToAdd) {
        await onAssignRole(userId, roleId);
      }

      // Remove old roles
      for (const roleId of rolesToRemove) {
        await onRemoveRole(userId, roleId);
      }

      toast({
        title: 'User updated',
        description: 'User has been updated successfully.',
      });

      onSuccess();
    } catch (error) {
      console.error('Error updating user:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update user',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update user details and manage their roles.
            {user && <span className="block mt-1 font-medium">{user.email}</span>}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={isCurrentUser}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                  {isCurrentUser && (
                    <p className="text-xs text-muted-foreground">
                      You cannot change your own status
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="roleIds"
              render={() => (
                <FormItem>
                  <FormLabel>Roles</FormLabel>
                  <div className="space-y-2 border rounded-md p-3">
                    {roles.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No roles available</p>
                    ) : (
                      roles.map((role) => (
                        <FormField
                          key={role.id}
                          control={form.control}
                          name="roleIds"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(role.id)}
                                  disabled={isCurrentUser && role.name === 'admin'}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      field.onChange([...field.value, role.id]);
                                    } else {
                                      field.onChange(
                                        field.value?.filter((id) => id !== role.id)
                                      );
                                    }
                                  }}
                                />
                              </FormControl>
                              <div className="flex-1">
                                <FormLabel className="font-normal cursor-pointer">
                                  {role.name}
                                </FormLabel>
                                {role.description && (
                                  <p className="text-xs text-muted-foreground">
                                    {role.description}
                                  </p>
                                )}
                              </div>
                            </FormItem>
                          )}
                        />
                      ))
                    )}
                  </div>
                  {isCurrentUser && (
                    <p className="text-xs text-muted-foreground">
                      You cannot remove your own admin role
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
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
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
