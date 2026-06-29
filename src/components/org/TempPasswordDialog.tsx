"use client";

// Shows the city admin's one-time temp password. It is NOT recoverable later — the
// superadmin must share it now; the admin is forced to change it on first login.

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";

export type ProvisionedAdmin = {
  cityName: string;
  adminName: string;
  cnic: string;
  tempPassword: string;
};

export function TempPasswordDialog({
  admin,
  onClose,
}: {
  admin: ProvisionedAdmin | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!admin) return;
    await navigator.clipboard.writeText(admin.tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Modal
      open={!!admin}
      onClose={onClose}
      title="City admin created"
      footer={
        <div className="flex justify-end">
          <Button onClick={onClose}>Done</Button>
        </div>
      }
    >
      {admin && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            <span className="font-medium text-gray-900">{admin.adminName}</span> can now sign in to{" "}
            <span className="font-medium text-gray-900">{admin.cityName}</span>. Share these
            credentials securely — the password is shown only once.
          </p>
          <dl className="rounded-xl bg-gray-50 p-4 text-sm">
            <div className="flex justify-between py-1">
              <dt className="text-gray-500">CNIC (username)</dt>
              <dd className="font-mono text-gray-900">{admin.cnic}</dd>
            </div>
            <div className="flex items-center justify-between py-1">
              <dt className="text-gray-500">Temp password</dt>
              <dd className="flex items-center gap-2">
                <span className="font-mono text-gray-900">{admin.tempPassword}</span>
                <button
                  onClick={copy}
                  className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </dd>
            </div>
          </dl>
          <p className="text-xs text-gray-400">They’ll be required to set a new password on first login.</p>
        </div>
      )}
    </Modal>
  );
}
