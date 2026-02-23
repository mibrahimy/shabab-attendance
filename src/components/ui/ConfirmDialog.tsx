"use client";

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
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p className="text-sm text-gray-600 mb-6">{message}</p>
      <div className="flex gap-2">
        <Button
          onClick={onConfirm}
          variant={variant === "danger" ? "danger" : "primary"}
          className="flex-1"
          disabled={loading}
        >
          {loading ? "Processing..." : confirmLabel}
        </Button>
        <Button
          onClick={onCancel}
          variant="secondary"
          className="flex-1"
          disabled={loading}
        >
          {cancelLabel}
        </Button>
      </div>
    </Modal>
  );
}
