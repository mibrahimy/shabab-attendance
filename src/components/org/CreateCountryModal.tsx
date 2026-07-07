"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-gray-900 outline-none transition focus:border-[#2f55ea] focus:ring-2 focus:ring-[#2f55ea]/20";

export function CreateCountryModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const { t } = useTranslation("cities");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      const res = await fetch("/api/countries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast(json?.error?.message ?? t("createCountry.error"), "error");
        return;
      }
      toast(t("createCountry.created", { name }));
      setName("");
      onCreated();
      onClose();
    } catch {
      toast(t("toast.networkError"), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("createCountry.title")}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t("modal.cancel")}
          </Button>
          <Button onClick={submit} loading={saving} disabled={!name.trim()}>
            {t("createCountry.submit")}
          </Button>
        </div>
      }
    >
      <label className="mb-1.5 block text-sm font-medium text-gray-700">{t("createCountry.nameLabel")}</label>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("createCountry.namePlaceholder")}
        className={inputClass}
      />
    </Modal>
  );
}
