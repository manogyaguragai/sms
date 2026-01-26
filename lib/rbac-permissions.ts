import type { UserRole } from '@/lib/types';

// =============================================
// Permission Matrix
// =============================================

export const PERMISSIONS = {
  // Subscriber operations
  VIEW_SUBSCRIBERS: ['super_admin', 'admin', 'staff'] as UserRole[],
  CREATE_SUBSCRIBER: ['super_admin', 'admin', 'staff'] as UserRole[],
  UPDATE_SUBSCRIBER: ['super_admin', 'admin', 'staff'] as UserRole[],
  DELETE_SUBSCRIBER: ['super_admin', 'admin'] as UserRole[],

  // Payment operations
  VIEW_PAYMENTS: ['super_admin', 'admin', 'staff'] as UserRole[],
  CREATE_PAYMENT: ['super_admin', 'admin', 'staff'] as UserRole[],
  DELETE_PAYMENT: ['super_admin', 'admin'] as UserRole[],

  // User management
  VIEW_USERS: ['super_admin', 'admin'] as UserRole[],
  CREATE_USER: ['super_admin', 'admin'] as UserRole[],
  DELETE_USER: ['super_admin', 'admin'] as UserRole[],

  // Activity logs
  VIEW_ALL_LOGS: ['super_admin'] as UserRole[],
  VIEW_STAFF_LOGS: ['super_admin', 'admin'] as UserRole[],
  VIEW_COMMUNICATION_LOGS: ['super_admin'] as UserRole[],

  // Settings & Admin functions
  TEST_EMAIL: ['super_admin'] as UserRole[],
  TEST_SMS: ['super_admin'] as UserRole[],
  TRIGGER_CRON: ['super_admin'] as UserRole[],
  EXPORT_DATA: ['super_admin'] as UserRole[],
} as const;

export type Permission = keyof typeof PERMISSIONS;
