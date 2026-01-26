'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getActivityLogs, getLogUsers, canViewCommunicationLogs, type ActivityLogsResult } from '@/app/actions/activity-logs';
import { useRole, getRoleLabel, getRoleBadgeColor } from '@/lib/hooks/use-role';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Activity,
  Filter,
  Calendar,
  User,
  Mail,
  Smartphone,
  Trash2,
  Plus,
  Edit,
  Download,
  Clock,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import type { ActivityLog, ActionType, ACTION_CATEGORIES } from '@/lib/types';

// Action type display config
const ACTION_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  USER_LOGIN: { label: 'Login', color: 'bg-gray-100 text-gray-700', icon: <User className="w-3 h-3" /> },
  USER_LOGOUT: { label: 'Logout', color: 'bg-gray-100 text-gray-700', icon: <User className="w-3 h-3" /> },
  USER_CREATED: { label: 'User Created', color: 'bg-green-100 text-green-700', icon: <Plus className="w-3 h-3" /> },
  USER_DELETED: { label: 'User Deleted', color: 'bg-red-100 text-red-700', icon: <Trash2 className="w-3 h-3" /> },
  SUBSCRIBER_CREATED: { label: 'Subscriber Created', color: 'bg-green-100 text-green-700', icon: <Plus className="w-3 h-3" /> },
  SUBSCRIBER_UPDATED: { label: 'Subscriber Updated', color: 'bg-blue-100 text-blue-700', icon: <Edit className="w-3 h-3" /> },
  SUBSCRIBER_DELETED: { label: 'Subscriber Deleted', color: 'bg-red-100 text-red-700', icon: <Trash2 className="w-3 h-3" /> },
  PAYMENT_CREATED: { label: 'Payment Recorded', color: 'bg-green-100 text-green-700', icon: <Plus className="w-3 h-3" /> },
  PAYMENT_DELETED: { label: 'Payment Deleted', color: 'bg-red-100 text-red-700', icon: <Trash2 className="w-3 h-3" /> },
  EMAIL_SENT: { label: 'Email Sent', color: 'bg-blue-100 text-blue-700', icon: <Mail className="w-3 h-3" /> },
  SMS_SENT: { label: 'SMS Sent', color: 'bg-blue-100 text-blue-700', icon: <Smartphone className="w-3 h-3" /> },
  DATA_EXPORTED: { label: 'Data Exported', color: 'bg-purple-100 text-purple-700', icon: <Download className="w-3 h-3" /> },
  SETTINGS_UPDATED: { label: 'Settings Updated', color: 'bg-yellow-100 text-yellow-700', icon: <Edit className="w-3 h-3" /> },
  CRON_TRIGGERED: { label: 'Cron Triggered', color: 'bg-gray-100 text-gray-700', icon: <Clock className="w-3 h-3" /> },
};

export default function ActivityLogsPage() {
  const router = useRouter();
  const { role, isLoading: roleLoading, hasPermission } = useRole();
  
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<{ id: string; full_name: string | null; role: string }[]>([]);
  const [canViewComms, setCanViewComms] = useState(false);

  // Filters
  const [filterUser, setFilterUser] = useState('all');
  const [filterAction, setFilterAction] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showCommsOnly, setShowCommsOnly] = useState(false);

  // Selected log for detail view
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);

  // Check permissions
  useEffect(() => {
    if (!roleLoading && !hasPermission('VIEW_STAFF_LOGS')) {
      router.push('/dashboard');
    }
  }, [roleLoading, hasPermission, router]);

  // Fetch filter options
  useEffect(() => {
    async function fetchOptions() {
      const [usersData, canViewCommsData] = await Promise.all([
        getLogUsers(),
        canViewCommunicationLogs(),
      ]);
      setUsers(usersData);
      setCanViewComms(canViewCommsData);
    }
    fetchOptions();
  }, []);

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    
    let actionFilter = filterAction;
    if (showCommsOnly) {
      actionFilter = 'EMAIL_SENT'; // Will handle both in query
    }

    const result = await getActivityLogs({
      page,
      pageSize,
      userId: filterUser === 'all' ? undefined : filterUser,
      actionType: actionFilter === 'all' ? undefined : actionFilter,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });

    // If showing comms only, filter client-side for SMS too
    let filteredLogs = result.logs;
    if (showCommsOnly) {
      filteredLogs = result.logs.filter(
        log => log.action_type === 'EMAIL_SENT' || log.action_type === 'SMS_SENT'
      );
    }

    setLogs(filteredLogs);
    setTotalCount(result.totalCount);
    setTotalPages(result.totalPages);
    setLoading(false);
  }, [page, pageSize, filterUser, filterAction, startDate, endDate, showCommsOnly]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [filterUser, filterAction, startDate, endDate, showCommsOnly]);

  if (roleLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-600" />
            Activity Logs
          </h1>
          <p className="text-gray-500 mt-1">
            Track all user actions and system events
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchLogs}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card className="bg-white border-gray-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* User Filter */}
            <div className="space-y-2">
              <Label className="text-xs text-gray-500">User</Label>
              <Select value={filterUser} onValueChange={setFilterUser}>
                <SelectTrigger className="bg-gray-50 border-gray-200">
                  <SelectValue placeholder="All Users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name || 'Unknown'} ({getRoleLabel(user.role as any)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Action Type Filter */}
            <div className="space-y-2">
              <Label className="text-xs text-gray-500">Action Type</Label>
              <Select value={filterAction} onValueChange={setFilterAction} disabled={showCommsOnly}>
                <SelectTrigger className="bg-gray-50 border-gray-200">
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {Object.entries(ACTION_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Start Date */}
            <div className="space-y-2">
              <Label className="text-xs text-gray-500">From Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-gray-50 border-gray-200"
              />
            </div>

            {/* End Date */}
            <div className="space-y-2">
              <Label className="text-xs text-gray-500">To Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-gray-50 border-gray-200"
              />
            </div>

            {/* Communication Logs Toggle (Super Admin only) */}
            {canViewComms && (
              <div className="space-y-2">
                <Label className="text-xs text-gray-500">Communication Logs</Label>
                <Button
                  variant={showCommsOnly ? 'default' : 'outline'}
                  className={`w-full ${showCommsOnly ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                  onClick={() => setShowCommsOnly(!showCommsOnly)}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  {showCommsOnly ? 'Showing Comms' : 'Show Comms Only'}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card className="bg-white border-gray-200">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Activity className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No activity logs found</p>
              <p className="text-sm mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="divide-y divide-gray-100">
                {logs.map((log) => {
                  const config = ACTION_CONFIG[log.action_type] || {
                    label: log.action_type,
                    color: 'bg-gray-100 text-gray-700',
                    icon: <Activity className="w-3 h-3" />,
                  };

                  return (
                    <div
                      key={log.id}
                      className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => setSelectedLog(selectedLog?.id === log.id ? null : log)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          {/* Action Badge */}
                          <Badge className={`${config.color} shrink-0 flex items-center gap-1`}>
                            {config.icon}
                            {config.label}
                          </Badge>

                          {/* Description */}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-gray-900 truncate">
                              {log.description}
                            </p>
                            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                              {log.profiles && (
                                <>
                                  <span className="flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    {log.profiles.full_name || 'Unknown'}
                                  </span>
                                  <Badge className={`text-xs ${getRoleBadgeColor(log.profiles.role)}`}>
                                    {getRoleLabel(log.profiles.role)}
                                  </Badge>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Timestamp */}
                        <div className="text-xs text-gray-400 whitespace-nowrap flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(log.created_at)}
                        </div>
                      </div>

                      {/* Expanded Detail View */}
                      {selectedLog?.id === log.id && (
                        <div className="mt-4 p-4 bg-gray-50 rounded-lg text-sm">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {log.target_table && (
                              <div>
                                <span className="text-gray-500">Target:</span>{' '}
                                <span className="text-gray-900">{log.target_table}</span>
                              </div>
                            )}
                            {log.target_id && (
                              <div>
                                <span className="text-gray-500">Target ID:</span>{' '}
                                <code className="text-xs bg-gray-200 px-1 rounded">{log.target_id}</code>
                              </div>
                            )}
                          </div>
                          {Object.keys(log.metadata).length > 0 && (
                            <div className="mt-3">
                              <span className="text-gray-500 block mb-2">Metadata:</span>
                              <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-gray-100">
              <p className="text-sm text-gray-500">
                Showing {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, totalCount)} of {totalCount}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1 || loading}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-gray-500">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages || loading}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
