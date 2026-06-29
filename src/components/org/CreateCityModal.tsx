"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { CountryNode } from "./CitiesManager";
import type { ProvisionedAdmin } from "./TempPasswordDialog";

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-gray-900 outline-none transition focus:border-[#2f55ea] focus:ring-2 focus:ring-[#2f55ea]/20";

// Opening with a `country` shows the modal; closing clears it. On success the
// parent surfaces the one-time temp password.
export function CreateCityModal({
  country,
  onClose,
  onCreated,
}: {
  country: CountryNode | null;
  onClose: () => void;
  onCreated: (admin: ProvisionedAdmin) => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [cnic, setCnic] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setName("");
    setAdminName("");
    setCnic("");
    setPhone("");
  }

  async function submit() {
    if (!country) return;
    setSaving(true);
    try {
      const res = await fetch("/api/cities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countryId: country.id,
          name,
          admin: { name: adminName, cnic, phone: phone || undefined },
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast(json?.error?.message ?? "Could not create city", "error");
        return;
      }
      toast(`Created ${name}`);
      reset();
      onCreated({
        cityName: name,
        adminName,
        cnic: json.data.admin.cnic,
        tempPassword: json.data.admin.tempPassword,
      });
    } catch {
      toast("Network error", "error");
    } finally {
      setSaving(false);
    }
  }

  const canSubmit = !!name.trim() && !!adminName.trim() && !!cnic.trim() && !saving;

  return (
    <Modal
      open={!!country}
      onClose={onClose}
      title={country ? `Add city in ${country.name}` : "Add city"}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving} disabled={!canSubmit}>
            Create city & admin
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">City name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Islamabad" className={inputClass} />
        </div>

        <div className="rounded-xl bg-gray-50 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            City admin (provisioned now)
          </p>
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Full name</label>
              <input value={adminName} onChange={(e) => setAdminName(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">CNIC (login username)</label>
              <input value={cnic} onChange={(e) => setCnic(e.target.value)} placeholder="00000-0000000-0" className={inputClass} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Phone (optional)</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
