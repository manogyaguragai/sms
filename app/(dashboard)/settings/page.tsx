'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Settings, User, Mail, Lock, Loader2, LogOut, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { testCronJobAction } from '@/app/actions/cron';
import { sendTestEmailAction } from '@/app/actions/email';

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [testingCron, setTestingCron] = useState(false);
  const [cronResult, setCronResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [sendingTestEmail, setSendingTestEmail] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setPasswordLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast.success('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Error updating password:', error);
      toast.error('Failed to update password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    router.push('/login');
  };

  const testCronJob = async () => {
    setTestingCron(true);
    setCronResult(null);

    try {
      const result = await testCronJobAction();

      if (result.success) {
        setCronResult({
          success: true,
          message: `${result.message} ${result.emailsSent} emails sent.`,
        });
      } else {
        setCronResult({
          success: false,
          message: result.message || 'Failed to execute cron job',
        });
      }
    } catch (error) {
      setCronResult({
        success: false,
        message: 'Failed to execute cron job',
      });
    } finally {
      setTestingCron(false);
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail) {
      toast.error('Please enter an email address');
      return;
    }

    setSendingTestEmail(true);
    try {
      const result = await sendTestEmailAction(testEmail);
      if (result.success) {
        toast.success('Test email sent successfully');
        setTestEmail('');
      } else {
        toast.error(result.message || 'Failed to send test email');
      }
    } catch (error) {
      toast.error('Failed to send test email');
    } finally {
      setSendingTestEmail(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="w-6 h-6 text-blue-600" />
          Settings
        </h1>
        <p className="text-gray-500 mt-1">
          Manage your account and system settings
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Account Settings */}
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-gray-900 flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              Account
            </CardTitle>
            <CardDescription className="text-gray-500">
              Manage your account settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-gray-400" />
                <span className="text-gray-700">Session Status</span>
              </div>
              <Badge className="bg-green-50 text-green-600 border-green-200">
                Active
              </Badge>
            </div>

            <Separator className="bg-gray-200" />

            <Button
              variant="ghost"
              onClick={handleSignOut}
              disabled={loading}
              className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <LogOut className="w-4 h-4 mr-2" />
              )}
              Sign Out
            </Button>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-gray-900 flex items-center gap-2">
              <Lock className="w-5 h-5 text-blue-600" />
              Change Password
            </CardTitle>
            <CardDescription className="text-gray-500">
              Update your account password
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-gray-700">
                  New Password
                </Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:ring-blue-600"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-gray-700">
                  Confirm New Password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:ring-blue-600"
                />
              </div>
              <Button
                type="submit"
                disabled={passwordLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {passwordLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Password'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-gray-900 flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-600" />
              Email Configuration
            </CardTitle>
            <CardDescription className="text-gray-500">
              Configure and test email settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900">Send Test Email</h3>
                <p className="text-sm text-gray-500">
                  Send a test email to verify your email provider configuration.
                </p>
                <form onSubmit={handleSendTestEmail} className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="Enter email address"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    className="flex-1 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:ring-blue-600"
                  />
                  <Button
                    type="submit"
                    disabled={sendingTestEmail}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {sendingTestEmail ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Send'
                    )}
                  </Button>
                </form>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium text-gray-900">Test Reminder Cron</h3>
                <p className="text-sm text-gray-500">
                  Manually trigger the daily reminder check to see if any emails would be sent today.
                </p>
                <div className="flex items-start gap-4">
                  <Button
                    variant="outline"
                    onClick={testCronJob}
                    disabled={testingCron}
                    className="border-gray-300 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  >
                    {testingCron ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Trigger Cron Job'
                    )}
                  </Button>
                  {cronResult && (
                    <div
                      className={`text-sm p-2 rounded-md ${
                        cronResult.success
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}
                    >
                      {cronResult.message}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
