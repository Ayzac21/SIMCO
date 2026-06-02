import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Banknote, FolderKanban, Power, Target } from "lucide-react";
import { toast } from "sonner";
import { API_BASE_URL } from "../../../api/config";
import { getAuthHeaders } from "../../../api/auth";
import ConfirmModal from "../../../components/ConfirmModal";
import FinanceCatalogForm from "../components/FinanceCatalogForm";
import FinanceCatalogTable from "../components/FinanceCatalogTable";

const catalogTypes = {
  project: {
    label: "Proyectos",
    singular: "Proyecto",
    icon: FolderKanban,
    description: "Define proyectos disponibles para clasificar requisiciones.",
  },
  fund: {
    label: "Fondos",
    singular: "Fondo",
    icon: Banknote,
    description: "Administra fondos, ejercicios y montos autorizados.",
  },
  program: {
    label: "Programas",
    singular: "Programa estratégico",
    icon: Target,
    description: "Mantén programas estratégicos homologados para revisión financiera.",
  },
};

const emptyForm = (type) => ({
  id: null,
  catalog_type: type,
  code: "",
  name: "",
  fiscal_year: "",
  budget_amount: "",
  description: "",
  is_active: true,
});

export default function FinanzasCatalogos() {
  const [type, setType] = useState("project");
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [form, setForm] = useState(emptyForm("project"));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusChange, setStatusChange] = useState(null);
  const [changingStatus, setChangingStatus] = useState(false);

  const activeConfig = catalogTypes[type];
  const editing = Boolean(form.id);

  const loadRows = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        type,
        q: query.trim(),
        include_inactive: "1",
      });
      const resp = await fetch(`${API_BASE_URL}/finanzas/catalogos?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      const data = await resp.json().catch(() => []);
      if (!resp.ok) throw new Error(data?.message || "Error al cargar catálogo");
      setRows(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error(error?.message || "No se pudo cargar el catálogo financiero");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(loadRows, 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, query]);

  useEffect(() => {
    setForm(emptyForm(type));
    setQuery("");
    setStatusFilter("all");
    setYearFilter("all");
  }, [type]);

  const counts = useMemo(
    () => ({
      total: rows.length,
      active: rows.filter((row) => Number(row.is_active) === 1).length,
      inactive: rows.filter((row) => Number(row.is_active) !== 1).length,
    }),
    [rows]
  );

  const fiscalYearOptions = useMemo(() => {
    const years = rows
      .map((row) => Number(row.fiscal_year || 0))
      .filter((year) => Number.isInteger(year) && year > 0);
    return [...new Set(years)].sort((a, b) => b - a);
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const active = Number(row.is_active) === 1;
      if (statusFilter === "active" && !active) return false;
      if (statusFilter === "inactive" && active) return false;
      if (yearFilter !== "all" && String(row.fiscal_year || "") !== String(yearFilter)) return false;
      return true;
    });
  }, [rows, statusFilter, yearFilter]);

  const updateForm = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetForm = () => {
    setForm(emptyForm(type));
  };

  const handleEdit = (row) => {
    setForm({
      id: row.id,
      catalog_type: row.catalog_type || type,
      code: row.code || "",
      name: row.name || "",
      fiscal_year: row.fiscal_year || "",
      budget_amount: row.budget_amount ?? "",
      description: row.description || "",
      is_active: Number(row.is_active) === 1,
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!String(form.name || "").trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }

    try {
      setSaving(true);
      const url = editing
        ? `${API_BASE_URL}/finanzas/catalogos/${form.id}`
        : `${API_BASE_URL}/finanzas/catalogos`;
      const resp = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          ...form,
          catalog_type: type,
          fiscal_year: form.fiscal_year || null,
          budget_amount: form.budget_amount || null,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.message || "No se pudo guardar");
      toast.success(editing ? "Registro actualizado" : "Registro creado");
      resetForm();
      await loadRows();
    } catch (error) {
      toast.error(error?.message || "No se pudo guardar el catálogo");
    } finally {
      setSaving(false);
    }
  };

  const applyStatusChange = async (row, nextActive) => {
    try {
      setChangingStatus(true);
      const resp = await fetch(`${API_BASE_URL}/finanzas/catalogos/${row.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ is_active: nextActive }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.message || "No se pudo actualizar estatus");
      if (nextActive) {
        toast.success("Registro activado");
      } else {
        toast.warning("Registro desactivado");
      }
      await loadRows();
    } catch (error) {
      toast.error(error?.message || "No se pudo actualizar el registro");
    } finally {
      setChangingStatus(false);
      setStatusChange(null);
    }
  };

  const toggleStatus = (row) => {
    const nextActive = Number(row.is_active) === 1 ? 0 : 1;
    if (nextActive) {
      applyStatusChange(row, nextActive);
      return;
    }
    setStatusChange({ row, nextActive });
  };

  const pendingUsageCount = Number(statusChange?.row?.usage_count || 0);

  return (
    <section className="space-y-5 text-gray-900">
      <ConfirmModal
        open={Boolean(statusChange)}
        title={`Desactivar ${activeConfig.singular.toLowerCase()}`}
        headerText="Confirmar desactivación"
        description={
          pendingUsageCount > 0
            ? `Este registro ya se usa en ${pendingUsageCount} requisición(es). Al desactivarlo no aparecerá para nuevas revisiones, pero el historial conservará el dato registrado.`
            : "Este registro dejará de aparecer para nuevas revisiones de Finanzas. Podrás activarlo nuevamente después."
        }
        confirmText="Desactivar"
        cancelText="Mantener activo"
        loading={changingStatus}
        variant="warning"
        icon={pendingUsageCount > 0 ? AlertTriangle : Power}
        highlight={statusChange?.row?.name}
        onCancel={() => {
          if (!changingStatus) setStatusChange(null);
        }}
        onConfirm={() => applyStatusChange(statusChange.row, statusChange.nextActive)}
      />

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-[#8B1D35]">Administración Finanzas</p>
        <h2 className="mt-1 text-2xl font-extrabold text-gray-900">Catálogos financieros</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-500">
          Controla proyectos, fondos y programas estratégicos para que la revisión financiera use datos consistentes.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {Object.entries(catalogTypes).map(([key, config]) => {
          const Icon = config.icon;
          const active = type === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setType(key)}
              className={`rounded-xl border p-4 text-left shadow-sm transition ${
                active
                  ? "border-[#8B1D35] bg-[#8B1D35] text-white"
                  : "border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon size={20} />
                <div>
                  <p className="text-sm font-extrabold">{config.label}</p>
                  <p className={`text-xs ${active ? "text-white/80" : "text-gray-500"}`}>{config.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-gray-200 bg-white p-3 text-center shadow-sm">
              <p className="text-[10px] font-bold uppercase text-gray-400">Total</p>
              <p className="text-xl font-extrabold text-gray-900">{counts.total}</p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-center shadow-sm">
              <p className="text-[10px] font-bold uppercase text-emerald-600">Activos</p>
              <p className="text-xl font-extrabold text-emerald-700">{counts.active}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-center shadow-sm">
              <p className="text-[10px] font-bold uppercase text-gray-400">Inactivos</p>
              <p className="text-xl font-extrabold text-gray-700">{counts.inactive}</p>
            </div>
          </div>

          <FinanceCatalogForm
            form={form}
            typeLabel={activeConfig.singular}
            saving={saving}
            editing={editing}
            onChange={updateForm}
            onSubmit={handleSubmit}
            onCancel={resetForm}
          />
        </div>

        <FinanceCatalogTable
          rows={filteredRows}
          loading={loading}
          query={query}
          statusFilter={statusFilter}
          yearFilter={yearFilter}
          fiscalYearOptions={fiscalYearOptions}
          totalRows={rows.length}
          onQueryChange={setQuery}
          onStatusFilterChange={setStatusFilter}
          onYearFilterChange={setYearFilter}
          onEdit={handleEdit}
          onToggleStatus={toggleStatus}
        />
      </div>
    </section>
  );
}
