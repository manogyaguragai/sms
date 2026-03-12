'use client';

import { useState } from 'react';
import type { FollowupWithDetails } from '@/lib/types';
import { updateFollowup, deleteFollowup, getAllProfiles } from '@/app/actions/followups';
import { RichTextEditor } from '@/components/rich-text-editor';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  PhoneCall,
  Calendar,
  Clock,
  User,
  FileText,
  Pencil,
  Trash2,
  Loader2,
  ChevronDown,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface FollowupDetailModalProps {
  followup: FollowupWithDetails | null;
  open: boolean;
  onClose: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
  onUpdated?: () => void;
}

interface ProfileOption {
  id: string;
  full_name: string | null;
  role: string;
}

export function FollowupDetailModal({
  followup,
  open,
  onClose,
  canEdit = false,
  canDelete = false,
  onUpdated,
}: FollowupDetailModalProps) {
  const [editing, setEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [editPhone, setEditPhone] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editMadeBy, setEditMadeBy] = useState<string[]>([]);
  const [editTime, setEditTime] = useState('');

  // Profiles for "Made By" edit
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [madeByOpen, setMadeByOpen] = useState(false);

  if (!followup) return null;

  const startEdit = async () => {
    setEditPhone(followup.phone_number || '');
    setEditNotes(followup.notes || '');
    setEditMadeBy(followup.made_by || []);
    setEditTime(followup.followup_time || '');
    setEditing(true);
    // Load profiles
    setLoadingProfiles(true);
    const profs = await getAllProfiles();
    setProfiles(profs);
    setLoadingProfiles(false);
  };

  const cancelEdit = () => {
    setEditing(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await updateFollowup(followup.id, {
        made_by: editMadeBy,
        phone_number: editPhone,
        followup_time: editTime,
        notes: editNotes,
      });
      if (result.success) {
        toast.success(result.message);
        setEditing(false);
        onUpdated?.();
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error('Failed to update followup');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const result = await deleteFollowup(followup.id);
      if (result.success) {
        toast.success(result.message);
        setShowDeleteConfirm(false);
        onUpdated?.();
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error('Failed to delete followup');
    } finally {
      setDeleting(false);
    }
  };

  const toggleMadeBy = (profileId: string) => {
    setEditMadeBy((prev) =>
      prev.includes(profileId)
        ? prev.filter((id) => id !== profileId)
        : [...prev, profileId]
    );
  };

  const getProfileName = (id: string) => {
    const p = profiles.find((p) => p.id === id);
    return p?.full_name && !p.full_name.includes('@') ? p.full_name : 'User';
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(val) => { if (!val) { setEditing(false); onClose(); } }}>
        <DialogContent className="bg-white border-slate-200 max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-slate-900 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <PhoneCall className="w-4 h-4 text-blue-600" />
                </div>
                {editing ? 'Edit Followup' : 'Followup Details'}
              </DialogTitle>
              {!editing && (canEdit || canDelete) && (
                <div className="flex items-center gap-1">
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={startEdit}
                      className="h-8 w-8 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          </DialogHeader>

          {editing ? (
            /* ───── EDIT MODE ───── */
            <div className="mt-3 space-y-4">
              {/* Subscriber (read-only) */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Subscriber</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-extrabold text-blue-700 bg-blue-100 border border-blue-300 px-1.5 py-0.5 rounded shadow-sm">
                    {followup.subscribers.master_id}
                  </span>
                  <span className="text-sm font-semibold text-slate-900">
                    {followup.subscribers.full_name}
                  </span>
                </div>
              </div>

              {/* Made By */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Made By</Label>
                <Popover open={madeByOpen} onOpenChange={setMadeByOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-between h-auto min-h-[40px] bg-white border-gray-200 hover:bg-gray-50 text-left"
                    >
                      <div className="flex flex-wrap gap-1 flex-1">
                        {editMadeBy.length === 0 ? (
                          <span className="text-gray-400">Select people...</span>
                        ) : (
                          editMadeBy.map((id) => (
                            <Badge
                              key={id}
                              className="bg-blue-50 text-blue-700 border-blue-200 text-xs"
                            >
                              {getProfileName(id)}
                              <span
                                role="button"
                                className="ml-1 hover:text-blue-900 cursor-pointer"
                                onClick={(e) => { e.stopPropagation(); toggleMadeBy(id); }}
                              >
                                <X className="w-3 h-3" />
                              </span>
                            </Badge>
                          ))
                        )}
                      </div>
                      <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 ml-2" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-2 bg-white border-gray-200 max-h-[240px] overflow-y-auto" align="start">
                    {loadingProfiles ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                      </div>
                    ) : (
                      <div className="space-y-0.5">
                        {profiles.map((profile) => (
                          <label
                            key={profile.id}
                            className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-gray-100 cursor-pointer transition-colors"
                          >
                            <Checkbox
                              checked={editMadeBy.includes(profile.id)}
                              onCheckedChange={() => toggleMadeBy(profile.id)}
                            />
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                                <User className="w-3 h-3 text-blue-600" />
                              </div>
                              <span className="text-sm text-gray-700 truncate">
                                {profile.full_name && !profile.full_name.includes('@')
                                  ? profile.full_name
                                  : 'User'}
                              </span>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Phone Number</Label>
                <Input
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="bg-white border-gray-200 h-10"
                />
              </div>

              {/* Time */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Time</Label>
                <Input
                  type="time"
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  className="bg-white border-gray-200 h-10"
                />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Notes</Label>
                <RichTextEditor
                  content={editNotes}
                  onChange={setEditNotes}
                  placeholder="Enter followup notes..."
                />
              </div>

              {/* Save / Cancel */}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={cancelEdit}
                  className="text-slate-500 border-slate-200"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-blue-600 text-white hover:bg-blue-700"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
            </div>
          ) : (
            /* ───── VIEW MODE ───── */
            <div className="mt-3 space-y-4">
              {/* Subscriber */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Subscriber</p>
                <Link
                  href={`/subscribers/${followup.subscriber_id}`}
                  className="inline-flex items-center gap-2 group"
                  onClick={onClose}
                >
                  <span className="text-xs font-mono font-extrabold text-blue-700 bg-blue-100 border border-blue-300 px-1.5 py-0.5 rounded shadow-sm">
                    {followup.subscribers.master_id}
                  </span>
                  <span className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                    {followup.subscribers.full_name}
                  </span>
                </Link>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Date</p>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-sm font-semibold text-slate-800">
                      {followup.followup_date}
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Time</p>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-sm text-slate-700">
                      {followup.followup_time || '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Phone Number */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Phone Number</p>
                <div className="flex items-center gap-1.5">
                  <PhoneCall className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-sm text-slate-700">
                    {followup.phone_number || '—'}
                  </span>
                </div>
              </div>

              {/* Made By */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Made By</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  {(followup.made_by_names || []).map((name, i) => (
                    <Badge
                      key={i}
                      className="bg-blue-50 text-blue-600 border-blue-200 text-xs px-2 py-0.5"
                    >
                      {name}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Notes</p>
                {followup.notes ? (
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
                    <div className="flex items-start gap-2">
                      <FileText className="w-3.5 h-3.5 text-slate-300 mt-0.5 shrink-0" />
                      <div
                        className="text-sm text-slate-700 leading-relaxed followup-notes-content"
                        dangerouslySetInnerHTML={{ __html: followup.notes }}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 italic">No notes recorded</p>
                )}
              </div>
              <style jsx global>{`
                .followup-notes-content h1 { font-size: 1.25rem; font-weight: 700; margin: 0.3rem 0; }
                .followup-notes-content h2 { font-size: 1.1rem; font-weight: 600; margin: 0.25rem 0; }
                .followup-notes-content h3 { font-size: 1rem; font-weight: 600; margin: 0.2rem 0; }
                .followup-notes-content ul { list-style-type: disc; padding-left: 1.5rem; margin: 0.3rem 0; }
                .followup-notes-content ol { list-style-type: decimal; padding-left: 1.5rem; margin: 0.3rem 0; }
                .followup-notes-content li { margin: 0.1rem 0; }
                .followup-notes-content mark { background-color: #fef08a; border-radius: 2px; padding: 0 2px; }
                .followup-notes-content p { margin: 0.15rem 0; }
              `}</style>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="bg-white border-slate-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-900">Delete Followup</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500">
              Are you sure you want to delete this followup record? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-200 text-slate-500">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
