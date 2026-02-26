"use client";

import { useState } from "react";
import { removeMember, updateMember } from "@/actions/members";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { getInitials } from "@/lib/utils";
import type { ParkOption, MemberOption } from "@/types";

interface MemberDetailData {
  id: string;
  name: string;
  positionLabel: string;
  isTeaching: boolean;
  classAssignment: string | null;
  canManageTeam: boolean;
  phone: string | null;
  parentId?: string | null;
  park?: { id: string; name: string } | null;
  user?: { id: string; email: string } | null;
}

interface MemberDetailProps {
  member: MemberDetailData;
  onClose: () => void;
  parks?: ParkOption[];
  allMembers?: MemberOption[];
}

export default function MemberDetail({ member, onClose, parks, allMembers }: MemberDetailProps) {
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Edit form state
  const [form, setForm] = useState({
    name: member.name,
    phone: member.phone || "",
    positionLabel: member.positionLabel,
    isTeaching: member.isTeaching,
    classAssignment: member.classAssignment || "",
    canManageTeam: member.canManageTeam,
    parkId: member.park?.id || "",
    parentId: member.parentId || "",
  });

  async function handleRemove() {
    setRemoving(true);

    try {
      const result = await removeMember(member.id);

      if (result?.error) {
        toast(result.error, "error");
        setRemoving(false);
        return;
      }

      toast("Member removed successfully");
      onClose();
    } catch {
      toast("Something went wrong", "error");
    } finally {
      setRemoving(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const result = await updateMember(member.id, {
        name: form.name,
        phone: form.phone || undefined,
        positionLabel: form.positionLabel,
        isTeaching: form.isTeaching,
        classAssignment: form.isTeaching ? form.classAssignment || undefined : undefined,
        canManageTeam: form.canManageTeam,
        parkId: form.parkId || undefined,
        parentId: form.parentId || undefined,
      });

      if (result?.error) {
        toast(result.error, "error");
        setSaving(false);
        return;
      }

      toast("Member updated successfully");
      onClose();
    } catch {
      toast("Something went wrong", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40 lg:hidden animate-[modalBackdropIn_0.2s_ease-out]"
        onClick={onClose}
      />

      <div className="fixed bottom-0 inset-x-0 lg:top-0 lg:bottom-auto lg:left-auto lg:right-0 lg:w-[380px] lg:h-full bg-white z-50 rounded-t-xl lg:rounded-none border-t lg:border-l border-gray-200/80 shadow-xl overflow-y-auto animate-[modalSheetIn_0.25s_ease-out]">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {editing ? "Edit Member" : "Member Details"}
          </h2>
          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] lg:min-h-0 lg:min-w-0 lg:p-1 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 lg:p-6 space-y-6">
          {editing ? (
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  id="edit-name"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="edit-phone" className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  id="edit-phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="edit-position" className="block text-sm font-medium text-gray-700 mb-1">Position *</label>
                <input
                  id="edit-position"
                  required
                  value={form.positionLabel}
                  onChange={(e) => setForm({ ...form, positionLabel: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              {parks && parks.length > 0 && (
                <div>
                  <label htmlFor="edit-park" className="block text-sm font-medium text-gray-700 mb-1">Park</label>
                  <select
                    id="edit-park"
                    value={form.parkId}
                    onChange={(e) => setForm({ ...form, parkId: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">None</option>
                    {parks.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {allMembers && allMembers.length > 0 && (
                <div>
                  <label htmlFor="edit-parent" className="block text-sm font-medium text-gray-700 mb-1">Reports To</label>
                  <select
                    id="edit-parent"
                    value={form.parentId}
                    onChange={(e) => setForm({ ...form, parentId: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">None (root)</option>
                    {allMembers.filter((m) => m.id !== member.id).map((m) => (
                      <option key={m.id} value={m.id}>{m.name} — {m.positionLabel}</option>
                    ))}
                  </select>
                </div>
              )}
              <label className="flex items-center gap-2 min-h-[44px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isTeaching}
                  onChange={(e) => setForm({ ...form, isTeaching: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Teaching member</span>
              </label>
              {form.isTeaching && (
                <div>
                  <label htmlFor="edit-class" className="block text-sm font-medium text-gray-700 mb-1">Class Assignment</label>
                  <input
                    id="edit-class"
                    value={form.classAssignment}
                    onChange={(e) => setForm({ ...form, classAssignment: e.target.value })}
                    placeholder="e.g., Grade 5A"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}
              <label className="flex items-center gap-2 min-h-[44px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.canManageTeam}
                  onChange={(e) => setForm({ ...form, canManageTeam: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Can manage own team</span>
              </label>

              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={saving} className="flex-1">
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-lg font-semibold">
                  {getInitials(member.name)}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {member.name}
                  </h3>
                  <p className="text-sm text-gray-500">{member.positionLabel}</p>
                </div>
              </div>

              <div className="space-y-3">
                {member.phone && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Phone</span>
                    <span className="text-gray-900">{member.phone}</span>
                  </div>
                )}
                {member.park && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Park</span>
                    <span className="text-gray-900">{member.park.name}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Teaching</span>
                  <span>
                    {member.isTeaching ? (
                      <Badge color="blue">{member.classAssignment || "Yes"}</Badge>
                    ) : (
                      <span className="text-gray-400">No</span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Can Manage Team</span>
                  <span className="text-gray-900">
                    {member.canManageTeam ? "Yes" : "No"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">User Account</span>
                  <span className="text-gray-900">
                    {member.user ? member.user.email : <span className="text-gray-400">Not linked</span>}
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200 space-y-2">
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => setEditing(true)}
                >
                  Edit Member
                </Button>
                {!confirmRemove ? (
                  <Button
                    variant="danger"
                    className="w-full"
                    onClick={() => setConfirmRemove(true)}
                  >
                    Remove Member
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">
                      Are you sure? Children will be moved to this member&apos;s parent.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="danger"
                        className="flex-1"
                        disabled={removing}
                        onClick={handleRemove}
                      >
                        {removing ? "Removing..." : "Confirm"}
                      </Button>
                      <Button
                        variant="secondary"
                        className="flex-1"
                        onClick={() => setConfirmRemove(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
