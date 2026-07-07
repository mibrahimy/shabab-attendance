"use client";

// Single name-input modal used for both "add child" and "rename" — same shape,
// different title/initial value. The caller does the fetch + toast.

import { useState } from "react";
import { useTranslation } from "react-i18next";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";

// Mount this only while open (the parent conditionally renders it) so the field
// initializes fresh each time — no reset effect needed.
export function NodeNameModal({
  title,
  label,
  initialValue = "",
  submitLabel,
  saving,
  onSubmit,
  onClose,
}: {
  title: string;
  label: string;
  initialValue?: string;
  submitLabel: string;
  saving: boolean;
  onSubmit: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialValue);
  const { t } = useTranslation("hierarchy");

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t("modal.cancel")}
          </Button>
          <Button onClick={() => onSubmit(name.trim())} loading={saving} disabled={!name.trim()}>
            {submitLabel}
          </Button>
        </div>
      }
    >
      <label className="mb-1.5 block text-sm font-medium text-gray-700">{label}</label>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && name.trim() && !saving) onSubmit(name.trim());
        }}
        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-gray-900 outline-none transition focus:border-[#2f55ea] focus:ring-2 focus:ring-[#2f55ea]/20"
      />
    </Modal>
  );
}
