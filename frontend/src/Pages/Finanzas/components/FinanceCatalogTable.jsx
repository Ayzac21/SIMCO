import { AlertTriangle, Edit3, Power, Search } from "lucide-react";

const money = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;
};

export default function FinanceCatalogTable({
  rows,
  loading,
  query,
  statusFilter,
  yearFilter,
  fiscalYearOptions,
  totalRows,
  onQueryChange,
  onStatusFilterChange,
  onYearFilterChange,
  onEdit,
  onToggleStatus,
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-4 py-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="font-extrabold text-gray-900">Registros</h3>
          <p className="text-xs text-gray-500">
            Administra las opciones que verá Finanzas al revisar requisiciones.
          </p>
        </div>
        <div className="relative w-full md:w-80">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-xs outline-none focus:border-[#8B1D35]"
            placeholder="Buscar por nombre, clave o descripción"
          />
        </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="inline-grid grid-cols-3 rounded-xl border border-gray-200 bg-gray-50 p-1">
            {[
              { key: "all", label: "Todos" },
              { key: "active", label: "Activos" },
              { key: "inactive", label: "Inactivos" },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => onStatusFilterChange(item.key)}
                className={`rounded-lg px-3 py-2 text-xs font-extrabold transition ${
                  statusFilter === item.key
                    ? "bg-white text-[#8B1D35] shadow-sm ring-1 ring-gray-200"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              value={yearFilter}
              onChange={(event) => onYearFilterChange(event.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-700 outline-none focus:border-[#8B1D35]"
            >
              <option value="all">Todos los ejercicios</option>
              {fiscalYearOptions.map((year) => (
                <option key={year} value={year}>
                  Ejercicio {year}
                </option>
              ))}
            </select>
            <span className="text-xs font-semibold text-gray-400">
              Mostrando {rows.length} de {totalRows}
            </span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="px-4 py-12 text-center text-sm text-gray-500">Cargando catálogo...</div>
      ) : rows.length === 0 ? (
        <div className="px-4 py-12 text-center">
          <p className="text-sm font-bold text-gray-700">
            {totalRows > 0 ? "Sin resultados con los filtros actuales" : "Sin registros"}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {totalRows > 0
              ? "Ajusta búsqueda, estatus o ejercicio para ver más registros."
              : "Crea el primer registro para usarlo en revisión financiera."}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {rows.map((row) => {
            const isActive = Number(row.is_active) === 1;
            return (
            <div key={row.id} className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_110px_130px_110px] md:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-extrabold text-gray-900">{row.name}</p>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                      isActive
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-gray-200 bg-gray-100 text-gray-500"
                    }`}
                  >
                    {isActive ? "Activo" : "Inactivo"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {row.code || "Sin clave"} {row.description ? `· ${row.description}` : ""}
                </p>
                {Number(row.usage_count || 0) > 0 && (
                  <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800">
                    <AlertTriangle size={12} />
                    Usado en historial; desactivar solo bloquea nuevas revisiones
                  </div>
                )}
              </div>
              <div className="text-xs font-semibold text-gray-600">Ejercicio: {row.fiscal_year || "—"}</div>
              <div>
                <p className="text-xs font-bold text-[#8B1D35]">{money(row.budget_amount)}</p>
                <p className="mt-1 text-[10px] font-semibold text-gray-400">
                  Usado en {Number(row.usage_count || 0)} requisición(es)
                </p>
              </div>
              <div className="flex justify-start gap-2 md:justify-end">
                <button
                  type="button"
                  onClick={() => onEdit(row)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
                >
                  <Edit3 size={13} />
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => onToggleStatus(row)}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition ${
                    isActive
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm hover:bg-emerald-100"
                      : "border-gray-200 bg-gray-100 text-gray-400 hover:bg-gray-200"
                  }`}
                  title={isActive ? "Desactivar" : "Activar"}
                  aria-pressed={isActive}
                >
                  <Power size={14} />
                </button>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
