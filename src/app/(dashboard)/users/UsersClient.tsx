"use client";

import { useState, useMemo } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import SearchInput from "@/components/ui/SearchInput";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { createUser, toggleUserActive, linkUserToMember, unlinkUserFromMember } from "@/actions/users";
import { getInitials } from "@/lib/utils";
import type { BadgeColor } from "@/types";

interface UserData {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  roles: string;
  isActive: boolean;
  memberships: { id: string; name: string; positionLabel: string }[];
}

interface MemberOption {
  id: string;
  name: string;
  positionLabel: string;
}

interface UsersClientProps {
  users: UserData[];
  unlinkedMembers: MemberOption[];
  currentUserId: string;
  isSuperAdmin: boolean;
}

const ROLE_COLORS: Record<string, BadgeColor> = {
  super_admin: "purple",
  admin: "blue",
  teacher: "green",
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  teacher: "Teacher",
};

export default function UsersClient({ users, unlinkedMembers, currentUserId, isSuperAdmin }: UsersClientProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [linkingUserId, setLinkingUserId] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [confirmDeactivate, setConfirmDeactivate] = useState<UserData | null>(null);
  const [confirmUnlink, setConfirmUnlink] = useState<{ memberId: string; memberName: string; userName: string } | null>(null);
  const { toast } = useToast();

  // Create user form state
  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    phone: "",
    roles: "teacher",
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const result = await createUser(form);

    if (result.error) {
      toast(result.error, "error");
    } else {
      toast("User created successfully");
      setShowCreate(false);
      setForm({ email: "", password: "", name: "", phone: "", roles: "teacher" });
    }
    setSaving(false);
  }

  async function handleToggleActive(userId: string) {
    const result = await toggleUserActive(userId);
    if (result.error) {
      toast(result.error, "error");
    } else {
      toast("User status updated");
    }
  }

  async function handleLink() {
    if (!linkingUserId || !selectedMemberId) return;
    setSaving(true);

    const result = await linkUserToMember(linkingUserId, selectedMemberId);

    if (result.error) {
      toast(result.error, "error");
    } else {
      toast("User linked to member");
      setLinkingUserId(null);
      setSelectedMemberId("");
    }
    setSaving(false);
  }

  async function handleUnlink(memberId: string) {
    const result = await unlinkUserFromMember(memberId);
    if (result.error) {
      toast(result.error, "error");
    } else {
      toast("User unlinked from member");
    }
  }

  const filteredUsers = useMemo(() => {
    if (!search) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (ROLE_LABELS[u.roles] || u.roles).toLowerCase().includes(q)
    );
  }, [users, search]);

  const roleOptions = isSuperAdmin
    ? [
        { value: "teacher", label: "Teacher" },
        { value: "admin", label: "Admin" },
        { value: "super_admin", label: "Super Admin" },
      ]
    : [
        { value: "teacher", label: "Teacher" },
        { value: "admin", label: "Admin" },
      ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl lg:text-2xl font-semibold text-gray-900">Users</h1>
        <Button onClick={() => setShowCreate(true)}>Create User</Button>
      </div>

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search by name, email, or role..."
        className="mb-4"
      />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-2 font-medium text-gray-500">User</th>
                <th className="text-left py-3 px-2 font-medium text-gray-500 hidden sm:table-cell">Email</th>
                <th className="text-left py-3 px-2 font-medium text-gray-500">Role</th>
                <th className="text-left py-3 px-2 font-medium text-gray-500 hidden md:table-cell">Linked Member</th>
                <th className="text-left py-3 px-2 font-medium text-gray-500">Status</th>
                <th className="text-right py-3 px-2 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => {
                const linkedMember = user.memberships[0] || null;
                return (
                  <tr key={user.id} className="border-b border-gray-100 last:border-0">
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold shrink-0">
                          {getInitials(user.name)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{user.name}</p>
                          <p className="text-xs text-gray-500 sm:hidden">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-gray-600 hidden sm:table-cell">{user.email}</td>
                    <td className="py-3 px-2">
                      <Badge color={ROLE_COLORS[user.roles] || "gray"}>
                        {ROLE_LABELS[user.roles] || user.roles}
                      </Badge>
                    </td>
                    <td className="py-3 px-2 hidden md:table-cell">
                      {linkedMember ? (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-900">{linkedMember.name}</span>
                          <button
                            onClick={() => setConfirmUnlink({ memberId: linkedMember.id, memberName: linkedMember.name, userName: user.name })}
                            className="text-xs text-red-500 hover:text-red-700"
                            title="Unlink"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setLinkingUserId(user.id);
                            setSelectedMemberId("");
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          Link to member
                        </button>
                      )}
                    </td>
                    <td className="py-3 px-2">
                      <Badge color={user.isActive ? "green" : "red"}>
                        {user.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="py-3 px-2 text-right">
                      {user.id !== currentUserId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => user.isActive ? setConfirmDeactivate(user) : handleToggleActive(user.id)}
                        >
                          {user.isActive ? "Deactivate" : "Activate"}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create User Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create User">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="Optional"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              value={form.roles}
              onChange={(e) => setForm({ ...form, roles: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {roleOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? "Creating..." : "Create User"}
            </Button>
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      {/* Link to Member Modal */}
      <Modal
        open={linkingUserId !== null}
        onClose={() => setLinkingUserId(null)}
        title="Link User to Member"
      >
        {unlinkedMembers.length === 0 ? (
          <p className="text-sm text-gray-500">No unlinked members available.</p>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Member
              </label>
              <select
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Choose a member...</option>
                {unlinkedMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {m.positionLabel}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleLink}
                className="flex-1"
                disabled={!selectedMemberId || saving}
              >
                {saving ? "Linking..." : "Link"}
              </Button>
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setLinkingUserId(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmDeactivate !== null}
        onConfirm={async () => {
          if (confirmDeactivate) {
            await handleToggleActive(confirmDeactivate.id);
            setConfirmDeactivate(null);
          }
        }}
        onCancel={() => setConfirmDeactivate(null)}
        title="Deactivate User"
        message={`Are you sure you want to deactivate ${confirmDeactivate?.name ?? "this user"}? They will lose access.`}
        confirmLabel="Deactivate"
        variant="danger"
      />

      <ConfirmDialog
        open={confirmUnlink !== null}
        onConfirm={async () => {
          if (confirmUnlink) {
            await handleUnlink(confirmUnlink.memberId);
            setConfirmUnlink(null);
          }
        }}
        onCancel={() => setConfirmUnlink(null)}
        title="Unlink Member"
        message={`Unlink ${confirmUnlink?.memberName ?? "member"} from ${confirmUnlink?.userName ?? "user"}? The member will no longer be associated with this account.`}
        confirmLabel="Unlink"
        variant="danger"
      />
    </div>
  );
}
