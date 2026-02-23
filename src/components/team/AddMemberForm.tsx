"use client";

import { useState } from "react";
import { addMember } from "@/actions/members";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { ParkOption, MemberOption } from "@/types";

interface AddMemberFormProps {
  parks: ParkOption[];
  members: MemberOption[];
  onDone: () => void;
}

export default function AddMemberForm({ parks, members, onDone }: AddMemberFormProps) {
  const [isTeaching, setIsTeaching] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    try {
      const form = new FormData(e.currentTarget);
      const result = await addMember({
        name: form.get("name") as string,
        phone: form.get("phone") as string,
        positionLabel: form.get("positionLabel") as string,
        parkId: form.get("parkId") as string,
        parentId: form.get("parentId") as string,
        isTeaching,
        classAssignment: form.get("classAssignment") as string,
        canManageTeam: form.get("canManageTeam") === "on",
      });

      if (result?.error) {
        toast(result.error, "error");
        setLoading(false);
        return;
      }

      toast("Member added successfully");
      onDone();
    } catch {
      toast("Something went wrong", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Name *
        </label>
        <input
          name="name"
          required
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Full name"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Phone
        </label>
        <input
          name="phone"
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="+923001234567"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Position Label *
        </label>
        <input
          name="positionLabel"
          required
          defaultValue="Member"
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="e.g., Zonal Lead, Teacher, Member"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Park
        </label>
        <select
          name="parkId"
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">No park</option>
          {parks.map((park) => (
            <option key={park.id} value={park.id}>
              {park.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Reports To
        </label>
        <select
          name="parentId"
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">No parent (root member)</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.positionLabel})
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 min-h-[44px] cursor-pointer">
          <input
            type="checkbox"
            checked={isTeaching}
            onChange={(e) => setIsTeaching(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Is Teaching</span>
        </label>

        <label className="flex items-center gap-2 min-h-[44px] cursor-pointer">
          <input
            type="checkbox"
            name="canManageTeam"
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Can Manage Team</span>
        </label>
      </div>

      {isTeaching && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Class Assignment
          </label>
          <input
            name="classAssignment"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="e.g., Grade 5A"
          />
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? "Adding..." : "Add Member"}
        </Button>
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
