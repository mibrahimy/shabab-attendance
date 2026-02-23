"use client";

import { useState } from "react";
import { removeMember } from "@/actions/members";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { getInitials } from "@/lib/utils";

interface MemberDetailData {
  id: string;
  name: string;
  positionLabel: string;
  isTeaching: boolean;
  classAssignment: string | null;
  canManageTeam: boolean;
  phone: string | null;
  park?: { id: string; name: string } | null;
  user?: { id: string; email: string } | null;
}

interface MemberDetailProps {
  member: MemberDetailData;
  onClose: () => void;
}

export default function MemberDetail({ member, onClose }: MemberDetailProps) {
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const { toast } = useToast();

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

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 z-40 lg:hidden"
        onClick={onClose}
      />

      <div className="fixed bottom-0 inset-x-0 lg:top-0 lg:bottom-auto lg:left-auto lg:right-0 lg:w-[380px] lg:h-full bg-white z-50 rounded-t-xl lg:rounded-none border-t lg:border-l border-gray-200 shadow-lg overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Member Details</h2>
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
        </div>
      </div>
    </>
  );
}
