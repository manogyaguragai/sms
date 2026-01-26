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
import { Skeleton } from '@/components/ui/skeleton';
import { testCronJobAction } from '@/app/actions/cron';
import { sendTestEmailAction } from '@/app/actions/email';
import { sendTestSMSAction } from '@/app/actions/sms';
import { exportData } from '@/app/actions/export';
import { useRole, getRoleLabel, getRoleBadgeColor } from '@/lib/hooks/use-role';
import { Settings, User, Mail, Lock, Loader2, LogOut, Smartphone, Download, Shield } from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const { role, profile, isLoading: roleLoading, hasPermission } = useRole();

  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [testingCron, setTestingCron] = useState(false);
  const [cronResult, setCronResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [testPhone, setTestPhone] = useState('+977');
  const [sendingTestSMS, setSendingTestSMS] = useState(false);

  // Export states
  const [exportType, setExportType] = useState<'subscribers' | 'payments' | 'both'>('subscribers');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exporting, setExporting] = useState(false);

  // Permission checks
  const canTestEmail = hasPermission('TEST_EMAIL');
  const canTestSMS = hasPermission('TEST_SMS');
  const canTriggerCron = hasPermission('TRIGGER_CRON');
  const canExportData = hasPermission('EXPORT_DATA');

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

  const handleSendTestSMS = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone || testPhone === '+977') {
      toast.error('Please enter a valid phone number');
      return;
    }

    setSendingTestSMS(true);
    try {
      const result = await sendTestSMSAction(testPhone);
      if (result.success) {
        toast.success('Test SMS sent successfully');
      } else {
        toast.error((result as { error?: string }).error || 'Failed to send test SMS');
      }
    } catch (error) {
      toast.error('Failed to send test SMS');
    } finally {
      setSendingTestSMS(false);
    }
  };

  const handleExport = async () => {
    // Validate dates if needed, though they are optional in our logic
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      toast.error('Start date cannot be after end date');
      return;
    }

    setExporting(true);
    try {
      const result = await exportData(exportType, startDate, endDate);

      if (!result.success) {
        toast.error(result.error || 'Failed to export data');
        return;
      }

      const downloadFile = (content: string, filename: string) => {
        const blob = new Blob([content], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      };

      if (result.subscribers) {
        downloadFile(result.subscribers, `subscribers_${new Date().toISOString().split('T')[0]}.csv`);
      }
      if (result.payments) {
        // Small delay to ensure browser handles double download nicely if needed
        setTimeout(() => {
          downloadFile(result.payments!, `payments_${new Date().toISOString().split('T')[0]}.csv`);
        }, 100);
      }

      toast.success('Export completed successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  if (roleLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

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
            {/* User Profile Info */}
            {profile && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{profile.full_name || 'User'}</p>
                    <Badge className={`text-xs ${getRoleBadgeColor(profile.role)}`}>
                      {getRoleLabel(profile.role)}
                    </Badge>
                  </div>
                </div>
              </div>
            )}

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

        {/* Email Configuration - Super Admin only */}
        {(canTestEmail || canTriggerCron) && (
          <Card className="bg-white border-gray-200 shadow-sm lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-gray-900 flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-600" />
                Email Configuration
                <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs ml-2">
                  Super Admin Only
                </Badge>
              </CardTitle>
              <CardDescription className="text-gray-500">
                Configure and test email settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {canTestEmail && (
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
                )}

                {canTriggerCron && (
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
                          className={`text-sm p-2 rounded-md ${cronResult.success
                              ? 'bg-green-50 text-green-700 border border-green-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                            }`}
                        >
                          {cronResult.message}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* SMS Configuration - Super Admin only */}
        {canTestSMS && (
          <Card className="bg-white border-gray-200 shadow-sm lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-gray-900 flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-blue-600" />
                SMS Configuration
                <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs ml-2">
                  Super Admin Only
                </Badge>
              </CardTitle>
              <CardDescription className="text-gray-500">
                Configure and test SMS notifications via NotificationAPI
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900">Send Test SMS</h3>
                <p className="text-sm text-gray-500">
                  Send a test SMS to verify your SMS provider configuration. Use international format: +[country code][number]
                </p>
                <form onSubmit={handleSendTestSMS} className="flex gap-2">
                  <Input
                    type="tel"
                    placeholder="+9779860560444"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    className="flex-1 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:ring-blue-600"
                  />
                  <Button
                    type="submit"
                    disabled={sendingTestSMS}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {sendingTestSMS ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Send SMS'
                    )}
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Export Data - Super Admin only */}
        {canExportData && (
          <Card className="bg-white border-gray-200 shadow-sm lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-gray-900 flex items-center gap-2">
                <Download className="w-5 h-5 text-blue-600" />
                Export Data
                <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs ml-2">
                  Super Admin Only
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex flex-col gap-4">
                  <div className="space-y-2">
                    <Label>Data to Export</Label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input
                          type="radio"
                          name="exportType"
                          value="subscribers"
                          checked={exportType === 'subscribers'}
                          onChange={(e) => setExportType(e.target.value as 'subscribers')}
                          className="text-blue-600 focus:ring-blue-600 border-gray-300"
                        />
                        Subscribers
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input
                          type="radio"
                          name="exportType"
                          value="payments"
                          checked={exportType === 'payments'}
                          onChange={(e) => setExportType(e.target.value as 'payments')}
                          className="text-blue-600 focus:ring-blue-600 border-gray-300"
                        />
                        Payments
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input
                          type="radio"
                          name="exportType"
                          value="both"
                          checked={exportType === 'both'}
                          onChange={(e) => setExportType(e.target.value as 'both')}
                          className="text-blue-600 focus:ring-blue-600 border-gray-300"
                        />
                        Both
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="startDate">Start Date</Label>
                      <Input
                        id="startDate"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="bg-gray-50 border-gray-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endDate">End Date</Label>
                      <Input
                        id="endDate"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="bg-gray-50 border-gray-200"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={handleExport}
                    disabled={exporting}
                    className="w-full md:w-auto self-start bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {exporting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Export CSV
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
