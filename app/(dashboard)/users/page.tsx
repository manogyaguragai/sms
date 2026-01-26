'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getManageableUsers, createUser, deleteUser, updateUserRole } from '@/lib/rbac';
import { logUserCreated, logUserDeleted } from '@/lib/activity-logger';
import { useRole, getRoleLabel, getRoleBadgeColor } from '@/lib/hooks/use-role';
import type { Profile, UserRole } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import {
  Users,
  UserPlus,
  Trash2,
  Shield,
  Loader2,
  Mail,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';

export default function UsersPage() {
  const router = useRouter();
  const { role, isLoading: roleLoading, hasPermission, profile } = useRole();
  
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Add user dialog
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('staff');
  const [creating, setCreating] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Check permissions
  useEffect(() => {
    if (!roleLoading && !hasPermission('VIEW_USERS')) {
      router.push('/dashboard');
    }
  }, [roleLoading, hasPermission, router]);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const data = await getManageableUsers();
    setUsers(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!roleLoading && hasPermission('VIEW_USERS')) {
      fetchUsers();
    }
  }, [roleLoading, hasPermission, fetchUsers]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newUserEmail || !newUserPassword) {
      toast.error('Email and password are required');
      return;
    }

    if (newUserPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setCreating(true);

    try {
      const result = await createUser(newUserEmail, newUserPassword, newUserRole, newUserName);
      
      if (result.success) {
        toast.success(`${getRoleLabel(newUserRole)} user created successfully`);
        // Log the action
        if (result.userId) {
          await logUserCreated(result.userId, newUserEmail, newUserRole);
        }
        setShowAddDialog(false);
        setNewUserEmail('');
        setNewUserPassword('');
        setNewUserName('');
        setNewUserRole('staff');
        fetchUsers();
      } else {
        toast.error(result.error || 'Failed to create user');
      }
    } catch (error) {
      toast.error('Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;

    setDeleting(true);

    try {
      const result = await deleteUser(deleteTarget.id);
      
      if (result.success) {
        toast.success('User deleted successfully');
        await logUserDeleted(deleteTarget.id, deleteTarget.full_name || 'Unknown', deleteTarget.role);
        setDeleteTarget(null);
        fetchUsers();
      } else {
        toast.error(result.error || 'Failed to delete user');
      }
    } catch (error) {
      toast.error('Failed to delete user');
    } finally {
      setDeleting(false);
    }
  };

  if (roleLoading || loading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Determine which roles the current user can create
  const creatableRoles: UserRole[] = role === 'super_admin' 
    ? ['admin', 'staff'] 
    : ['staff'];

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            User Management
          </h1>
          <p className="text-gray-500 mt-1">
            Manage system users and their roles
          </p>
        </div>
        <Button
          onClick={() => setShowAddDialog(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
        >
          <UserPlus className="w-4 h-4" />
          Add User
        </Button>
      </div>

      {/* Users Grid */}
      {users.length === 0 ? (
        <Card className="bg-white border-gray-200">
          <CardContent className="p-12 text-center text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>No users to manage</p>
            <p className="text-sm mt-1">
              {role === 'admin' 
                ? 'You can manage staff users only'
                : 'Add users to get started'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map((user) => (
            <Card key={user.id} className="bg-white border-gray-200 hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <Shield className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {user.full_name || 'Unnamed User'}
                      </p>
                      <Badge className={`text-xs ${getRoleBadgeColor(user.role)}`}>
                        {getRoleLabel(user.role)}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-gray-400 hover:text-red-600 hover:bg-red-50"
                    onClick={() => setDeleteTarget(user)}
                    disabled={user.id === profile?.id}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="mt-4 space-y-2 text-sm">
                  {user.phone && (
                    <div className="flex items-center gap-2 text-gray-500">
                      <Mail className="w-4 h-4" />
                      {user.phone}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-gray-500">
                    <Calendar className="w-4 h-4" />
                    Joined {formatDate(user.created_at)}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add User Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Create a new user account with the specified role
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newUserName">Full Name</Label>
              <Input
                id="newUserName"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="John Doe"
                className="bg-gray-50 border-gray-200"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newUserEmail">Email *</Label>
              <Input
                id="newUserEmail"
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="user@example.com"
                required
                className="bg-gray-50 border-gray-200"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newUserPassword">Password *</Label>
              <Input
                id="newUserPassword"
                type="password"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="bg-gray-50 border-gray-200"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newUserRole">Role</Label>
              <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as UserRole)}>
                <SelectTrigger className="bg-gray-50 border-gray-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {creatableRoles.map((r) => (
                    <SelectItem key={r} value={r}>
                      {getRoleLabel(r)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddDialog(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={creating}
              >
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create User'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.full_name || 'this user'}</strong>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
