import React from "react";
import { AlertTriangle } from "lucide-react";

export default function ConfirmModal({
  open,
  title = "Confirmar",
  headerText = "Confirmación",
  description,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  loading = false,
  variant = "primary",
  highlight,
  icon: Icon = AlertTriangle,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  const styles = {
    primary: {
      header: "bg-secundario",
      confirm: "bg-principal",
      ring: "ring-principal/10",
      iconBg: "bg-principal/10",
      iconText: "text-principal",
    },
    success: {
      header: "bg-secundario",
      confirm: "bg-principal",
      ring: "ring-principal/10",
      iconBg: "bg-principal/10",
      iconText: "text-principal",
    },
    warning: {
      header: "bg-secundario",
      confirm: "bg-principal",
      ring: "ring-principal/10",
      iconBg: "bg-principal/10",
      iconText: "text-principal",
    },
    danger: {
      header: "bg-secundario",
      confirm: "bg-principal",
      ring: "ring-principal/10",
      iconBg: "bg-principal/10",
      iconText: "text-principal",
    },
  };

  const s = styles[variant] || styles.primary;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={loading ? undefined : onCancel}
      />

      <div className={`relative w-[92%] max-w-md bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden ring-1 ${s.ring}`}>
        <div className={`px-5 py-4 ${s.header}`}>
          <div className="text-white font-bold text-sm uppercase tracking-wide">{headerText}</div>
          <div className="text-white/90 text-xs mt-1">Verifica antes de continuar</div>
        </div>

        <div className="p-5">
          <div className="flex items-start gap-3">
            <div className={`shrink-0 h-10 w-10 rounded-full ${s.iconBg} flex items-center justify-center ${s.iconText}`}>
              <Icon size={18} />
            </div>
            <div className="min-w-0">
              <div className="text-base font-bold text-gray-900">{title}</div>
              {highlight && (
                <div className="mt-1 inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                  {highlight}
                </div>
              )}
              <div className="mt-2 text-sm text-gray-700 leading-relaxed">{description}</div>
              <div className="mt-3 text-[11px] text-gray-500">
                * Esta acción no se puede deshacer.
              </div>
            </div>
          </div>

          <div className="mt-5 flex gap-2 justify-end">
            <button
              onClick={onCancel}
              disabled={loading}
              className="px-4 py-2 rounded-lg text-xs font-bold border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              {cancelText}
            </button>

            <button
              onClick={onConfirm}
              disabled={loading}
              className={`px-4 py-2 rounded-lg text-xs font-bold text-white ${s.confirm} disabled:opacity-60`}
            >
              {loading ? "PROCESANDO..." : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
