"use client";

import { useTranslation } from "react-i18next";
import Modal from "./Modal";
import Button from "./Button";

interface ConfirmDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  loading?: boolean;
}

export default function ConfirmDialog({
  open,
  onConfirm,
  onCancel,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = "default",
  loading = false,
}: ConfirmDialogProps) {
  const { t } = useTranslation("common");
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p className="text-sm text-gray-600 mb-6">{message}</p>
      {/* Cancel-left / confirm-right — the destructive action isn't the leading
          target, reducing accidental confirms. */}
      <div className="flex gap-2">
        <Button onClick={onCancel} variant="secondary" className="flex-1" disabled={loading}>
          {cancelLabel ?? t("actions.cancel")}
        </Button>
        <Button
          onClick={onConfirm}
          variant={variant === "danger" ? "danger" : "primary"}
          className="flex-1"
          disabled={loading}
        >
          {loading ? t("actions.processing") : (confirmLabel ?? t("actions.confirm"))}
        </Button>
      </div>
    </Modal>
  );
}
