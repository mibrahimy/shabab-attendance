"use client";

// One-time credentials reveal for any admin-provisioned account (city admin,
// staff member, …). The temp password is shown only once; the account holder is
// forced to change it on first login.

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";

export type Credentials = {
  name: string;
  cnic: string;
  tempPassword: string;
  context?: string; // e.g. a city or role, shown as "can sign in to {context}"
};

export function CredentialsDialog({
  creds,
  onClose,
}: {
  creds: Credentials | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!creds) return;
    await navigator.clipboard.writeText(creds.tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Modal
      open={!!creds}
      onClose={onClose}
      title="Account created"
      footer={
        <div className="flex justify-end">
          <Button onClick={onClose}>Done</Button>
        </div>
      }
    >
      {creds && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            <span className="font-medium text-gray-900">{creds.name}</span> can now sign in
            {creds.context ? (
              <>
                {" "}
                as <span className="font-medium text-gray-900">{creds.context}</span>
              </>
            ) : null}
            . Share these credentials securely — the password is shown only once.
          </p>
          <dl className="rounded-xl bg-gray-50 p-4 text-sm">
            <div className="flex justify-between py-1">
              <dt className="text-gray-500">CNIC (username)</dt>
              <dd className="font-mono text-gray-900">{creds.cnic}</dd>
            </div>
            <div className="flex items-center justify-between py-1">
              <dt className="text-gray-500">Temp password</dt>
              <dd className="flex items-center gap-2">
                <span className="font-mono text-gray-900">{creds.tempPassword}</span>
                <button
                  onClick={copy}
                  className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </dd>
            </div>
          </dl>
          <p className="text-xs text-gray-400">
            They’ll be required to set a new password on first login.
          </p>
        </div>
      )}
    </Modal>
  );
}
