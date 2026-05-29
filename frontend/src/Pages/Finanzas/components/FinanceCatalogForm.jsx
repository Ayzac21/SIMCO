import { Save, X } from "lucide-react";

const moneyPlaceholderByType = {
  fund: "Ej. 250000.00",
  project: "Opcional",
  program: "Opcional",
};

export default function FinanceCatalogForm({
  form,
  typeLabel,
  saving,
  editing,
  onChange,
  onSubmit,
  onCancel,
}) {
  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[#8B1D35]">
            {editing ? "Editar registro" : "Nuevo registro"}
          </p>
          <h3 className="text-lg font-extrabold text-gray-900">{typeLabel}</h3>
        </div>
        {editing && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
            aria-label="Cancelar edición"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="block text-xs font-bold uppercase text-gray-600">
          Nombre <span className="text-red-600">*</span>
          <input
            value={form.name}
            onChange={(event) => onChange("name", event.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm normal-case outline-none focus:border-[#8B1D35] focus:ring-2 focus:ring-[#8B1D35]/10"
            placeholder="Nombre visible en Finanzas"
          />
        </label>

        <label className="block text-xs font-bold uppercase text-gray-600">
          Clave
          <input
            value={form.code}
            onChange={(event) => onChange("code", event.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm normal-case outline-none focus:border-[#8B1D35] focus:ring-2 focus:ring-[#8B1D35]/10"
            placeholder="Ej. P-2026"
          />
        </label>

        <label className="block text-xs font-bold uppercase text-gray-600">
          Ejercicio
          <input
            value={form.fiscal_year}
            onChange={(event) => onChange("fiscal_year", event.target.value)}
            inputMode="numeric"
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm normal-case outline-none focus:border-[#8B1D35] focus:ring-2 focus:ring-[#8B1D35]/10"
            placeholder="Ej. 2026"
          />
        </label>

        <label className="block text-xs font-bold uppercase text-gray-600">
          Monto autorizado
          <input
            value={form.budget_amount}
            onChange={(event) => onChange("budget_amount", event.target.value)}
            inputMode="decimal"
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm normal-case outline-none focus:border-[#8B1D35] focus:ring-2 focus:ring-[#8B1D35]/10"
            placeholder={moneyPlaceholderByType[form.catalog_type] || "Opcional"}
          />
        </label>
      </div>

      <label className="mt-3 block text-xs font-bold uppercase text-gray-600">
        Descripción
        <textarea
          value={form.description}
          onChange={(event) => onChange("description", event.target.value)}
          rows={3}
          className="mt-1 w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm normal-case outline-none focus:border-[#8B1D35] focus:ring-2 focus:ring-[#8B1D35]/10"
          placeholder="Notas internas para Finanzas"
        />
      </label>

      <label className="mt-3 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-bold text-gray-700">
        <input
          type="checkbox"
          checked={Boolean(form.is_active)}
          onChange={(event) => onChange("is_active", event.target.checked)}
        />
        Activo
      </label>

      <div className="mt-4 flex justify-end gap-2">
        {editing && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-[#8B1D35] px-4 py-2 text-xs font-bold text-white hover:bg-[#74182c] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save size={14} />
          {saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear registro"}
        </button>
      </div>
    </form>
  );
}
