"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formatCnic } from "@/lib/cnic";
import type { Credentials } from "@/components/ui/CredentialsDialog";
import type { CountryNode } from "./CitiesManager";

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
  onCreated: (creds: Credentials) => void;
}) {
  const { toast } = useToast();
  const { t } = useTranslation("cities");
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
        toast(json?.error?.message ?? t("createCity.error"), "error");
        return;
      }
      toast(t("createCity.created", { name }));
      reset();
      onCreated({
        name: adminName,
        cnic: json.data.admin.cnic,
        tempPassword: json.data.admin.tempPassword,
        context: t("createCity.adminContext", { name }),
      });
    } catch {
      toast(t("toast.networkError"), "error");
    } finally {
      setSaving(false);
    }
  }

  const canSubmit = !!name.trim() && !!adminName.trim() && !!cnic.trim() && !saving;

  return (
    <Modal
      open={!!country}
      onClose={onClose}
      title={country ? t("createCity.title", { country: country.name }) : t("createCity.titleFallback")}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t("modal.cancel")}
          </Button>
          <Button onClick={submit} loading={saving} disabled={!canSubmit}>
            {t("createCity.submit")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">{t("createCity.nameLabel")}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("createCity.namePlaceholder")} className={inputClass} />
        </div>

        <div className="rounded-xl bg-gray-50 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            {t("createCity.adminSection")}
          </p>
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">{t("createCity.adminName")}</label>
              <input value={adminName} onChange={(e) => setAdminName(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">{t("createCity.adminCnic")}</label>
              <input value={cnic} onChange={(e) => setCnic(formatCnic(e.target.value))} inputMode="numeric" maxLength={15} placeholder={t("createCity.cnicPlaceholder")} className={inputClass} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">{t("createCity.adminPhone")}</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
