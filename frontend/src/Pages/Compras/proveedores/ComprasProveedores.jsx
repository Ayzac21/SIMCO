import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import ConfirmModal from "../../../components/ConfirmModal";
import { ChevronDown, FileText, Pencil, ShieldCheck, Power, Upload } from "lucide-react";
import { API_BASE_URL } from "../../../api/config";
import useEscapeKey from "../../../hooks/useEscapeKey";
import { useSearchParams } from "react-router-dom";

const API_CATEGORIES = `${API_BASE_URL}/categories`;
const API_PROVIDERS_ADMIN = `${API_BASE_URL}/compras/providers/admin`;
const API_PROVIDERS = `${API_BASE_URL}/compras/providers`;

const STATUS_OPTIONS = [
  { id: 3, label: "Activo" },
  { id: 4, label: "Inactivo" },
  { id: 5, label: "Verificado" },
  { id: 6, label: "No verificado" },
];

const RFC_REGEX = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i;
const PHONE_REGEX = /^[0-9+()\-\s]{7,20}$/;
const normalizeRfc = (value = "") =>
  String(value)
    .toUpperCase()
    .replace(/[\s-]+/g, "")
    .replace(/[^A-Z0-9Ñ&]/g, "");

export default function ComprasProveedores() {
  const [searchParams, setSearchParams] = useSearchParams();
  const userStr = localStorage.getItem("usuario");
  const user = userStr ? JSON.parse(userStr) : null;
  const token = localStorage.getItem("token");
  const headers = useMemo(() => ({
    "Content-Type": "application/json",
    "x-user-id": String(user?.id || ""),
    "x-user-role": String(user?.role || ""),
    Authorization: token ? `Bearer ${token}` : "",
  }), [token, user?.id, user?.role]);
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [providers, setProviders] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editingOriginalRfc, setEditingOriginalRfc] = useState("");
  const [detailProvider, setDetailProvider] = useState(null);
  const [confirmAction, setConfirmAction] = useState({ open: false, provider: null, nextStatus: null });
  const [openActionsId, setOpenActionsId] = useState(null);
  const [autoOpenedProviderId, setAutoOpenedProviderId] = useState(null);
  useEscapeKey(Boolean(detailProvider), () => setDetailProvider(null));

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const formRef = useRef(null);
  const nameInputRef = useRef(null);
  const importInputRef = useRef(null);

  const isAdmin = user?.role === "compras_admin";
  const isExportOnlyMode = false;
  const labelClass = "text-[11px] font-bold uppercase tracking-wide text-slate-600";
  const inputClass =
    "w-full mt-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition focus:border-[#8B1D35] focus:ring-2 focus:ring-[#8B1D35]/20";

  const [form, setForm] = useState({
    name: "",
    razon_social: "",
    email: "",
    rfc: "",
    address: "",
    statuses_id: 6,
    categories: [],
    phones: [""],
  });

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const setRfcField = (value) => setField("rfc", normalizeRfc(value));
  const uploadHeaders = useMemo(
    () => ({
      "x-user-id": String(user?.id || ""),
      "x-user-role": String(user?.role || ""),
      Authorization: token ? `Bearer ${token}` : "",
    }),
    [token, user?.id, user?.role]
  );

  useEffect(() => {
    const load = async () => {
      try {
        setLoadingCategories(true);
      const res = await fetch(API_CATEGORIES, { headers });
        const data = await res.json();
        setCategories(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
        toast.error("Error al cargar categorías");
      } finally {
        setLoadingCategories(false);
      }
    };
    load();
  }, [headers]);

  const loadProviders = useCallback(async () => {
    try {
      setLoadingProviders(true);
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`${API_PROVIDERS_ADMIN}?${params.toString()}`, {
        headers,
      });
      const data = await res.json();
      setProviders(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      toast.error("Error al cargar proveedores");
    } finally {
      setLoadingProviders(false);
    }
  }, [headers, q, statusFilter]);

  const handleImportExcel = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!isAdmin) {
      toast.warning("Solo Compras Admin puede importar proveedores");
      event.target.value = "";
      return;
    }

    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      toast.error("Archivo inválido. Usa .xlsx, .xls o .csv");
      event.target.value = "";
      return;
    }

    const toastId = toast.loading("Importando proveedores...");
    try {
      setImporting(true);
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_PROVIDERS}/import`, {
        method: "POST",
        headers: uploadHeaders,
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "No se pudo importar");

      toast.success(data?.message || "Importación completada", { id: toastId });
      if (Array.isArray(data?.errors) && data.errors.length > 0) {
        toast.warning(`Se omitieron ${data.errors.length} fila(s).`, { duration: 5000 });
        console.table(data.errors.slice(0, 30));
      }
      await loadProviders();
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Error al importar proveedores", { id: toastId });
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

  useEffect(() => {
    const t = setTimeout(() => loadProviders(), 250);
    return () => clearTimeout(t);
  }, [q, statusFilter, loadProviders]);

  const validate = () => {
    if (!form.name.trim()) {
      toast.error("Falta nombre");
      return false;
    }
    const currentRfc = normalizeRfc(form.rfc);
    if (editing?.id && editingOriginalRfc && currentRfc === editingOriginalRfc) {
      // RFC legacy: permitir si no cambió
    } else if (currentRfc && !RFC_REGEX.test(currentRfc)) {
      toast.error("RFC inválido");
      return false;
    }
    if (form.email && !String(form.email).includes("@")) {
      toast.error("Email inválido");
      return false;
    }

    const cleanRfc = currentRfc;
    const cleanEmail = form.email.trim().toLowerCase();
    const dup = providers.find((p) => {
      if (editing?.id && Number(p.id) === Number(editing.id)) return false;
      if (cleanRfc && String(p.rfc || "").trim().toUpperCase() === cleanRfc) return true;
      if (cleanEmail && String(p.email || "").trim().toLowerCase() === cleanEmail) return true;
      return false;
    });
    if (dup) {
      toast.error("RFC o email ya registrado");
      return false;
    }

    const cleanPhones = form.phones
      .map((p) => String(p || "").trim())
      .filter(Boolean);
    const uniquePhones = new Set();
    for (const p of cleanPhones) {
      if (!PHONE_REGEX.test(p)) {
        toast.error("Teléfono inválido");
        return false;
      }
      const key = p.replace(/\s+/g, "");
      if (uniquePhones.has(key)) {
        toast.error("Teléfonos duplicados");
        return false;
      }
      uniquePhones.add(key);
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!isAdmin) {
      toast.error("Solo Compras Admin puede guardar proveedores");
      return;
    }
    if (!validate()) return;
    const toastId = toast.loading("Procesando...");

    try {
      setSaving(true);
      const isEdit = Boolean(editing?.id);
      const payload = {
        name: form.name.trim(),
        razon_social: form.razon_social.trim() || null,
        email: form.email.trim() || "",
        rfc: normalizeRfc(form.rfc) || null,
        address: form.address.trim() || null,
        statuses_id: isEdit ? Number(editing?.statuses_id || 6) : 6,
        categories: form.categories.map((c) => Number(c)),
        phones: form.phones.map((p) => p.trim()).filter(Boolean),
      };

      const res = await fetch(isEdit ? `${API_PROVIDERS}/${editing.id}` : API_PROVIDERS, {
        method: isEdit ? "PUT" : "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Error al guardar proveedor");

      toast.success(isEdit ? "Proveedor actualizado" : "Proveedor creado", { id: toastId });
      setForm({
        name: "",
        razon_social: "",
        email: "",
        rfc: "",
        address: "",
        statuses_id: 6,
        categories: [],
        phones: [""],
      });
      setEditing(null);
      setEditingOriginalRfc("");
      await loadProviders();
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Error al guardar proveedor", { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const startEdit = useCallback((p) => {
    if (!isAdmin) {
      toast.error("Solo Compras Admin puede editar proveedores");
      return;
    }
    setEditing(p);
    setEditingOriginalRfc(normalizeRfc(p.rfc || ""));
    setForm({
      name: p.name || "",
      razon_social: p.razon_social || "",
      email: p.email || "",
      rfc: normalizeRfc(p.rfc || ""),
      address: p.address || "",
      statuses_id: Number(p.statuses_id || 6),
      categories: (p.categories || []).map((c) => c.id),
      phones: (p.phones || []).map((ph) => ph.phone),
    });
    toast("Editando proveedor...");
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      nameInputRef.current?.focus();
    });
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin || loadingProviders) return;
    const rawProviderId = String(searchParams.get("editProviderId") || "").trim();
    if (!rawProviderId) return;
    const providerId = Number(rawProviderId);
    if (!Number.isFinite(providerId)) return;
    if (autoOpenedProviderId === providerId) return;

    const target = providers.find((p) => Number(p.id) === providerId);
    if (!target) {
      toast.error("No se encontró el proveedor para editar");
      setAutoOpenedProviderId(providerId);
      return;
    }

    startEdit(target);
    setAutoOpenedProviderId(providerId);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("editProviderId");
    setSearchParams(nextParams, { replace: true });
  }, [
    autoOpenedProviderId,
    isAdmin,
    loadingProviders,
    providers,
    startEdit,
    searchParams,
    setSearchParams,
  ]);

  const updateStatus = async (provider, nextStatus) => {
    if (!provider?.id) return;
    if (!isAdmin) {
      toast.error("Solo Compras Admin puede cambiar estatus");
      return;
    }
    if (Number(nextStatus) === 4) {
      setConfirmAction({ open: true, provider, nextStatus });
      return;
    }
    const toastId = toast.loading("Procesando...");
    try {
      const res = await fetch(`${API_PROVIDERS}/${provider.id}/status`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ statuses_id: Number(nextStatus) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Error al actualizar estatus");
      toast.success("Estatus actualizado", { id: toastId });
      await loadProviders();
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Error al actualizar estatus", { id: toastId });
    }
  };

  const confirmDeactivate = async () => {
    const provider = confirmAction.provider;
    if (!provider?.id) {
      setConfirmAction({ open: false, provider: null, nextStatus: null });
      return;
    }
    if (!isAdmin) {
      toast.error("Solo Compras Admin puede cambiar estatus");
      setConfirmAction({ open: false, provider: null, nextStatus: null });
      return;
    }
    const toastId = toast.loading("Procesando...");
    try {
      const res = await fetch(`${API_PROVIDERS}/${provider.id}/status`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ statuses_id: Number(confirmAction.nextStatus) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Error al actualizar estatus");
      toast.success("Proveedor desactivado", { id: toastId });
      await loadProviders();
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Error al actualizar estatus", { id: toastId });
    } finally {
      setConfirmAction({ open: false, provider: null, nextStatus: null });
    }
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditingOriginalRfc("");
    setForm({
      name: "",
      razon_social: "",
      email: "",
      rfc: "",
      address: "",
      statuses_id: 6,
      categories: [],
      phones: [""],
    });
  };

  const toggleCategory = (id) => {
    setForm((f) => {
      const exists = f.categories.includes(id);
      return {
        ...f,
        categories: exists ? f.categories.filter((x) => x !== id) : [...f.categories, id],
      };
    });
  };

  const updatePhone = (index, value) => {
    setForm((f) => {
      const next = [...f.phones];
      next[index] = value;
      return { ...f, phones: next };
    });
  };

  const addPhone = () => setForm((f) => ({ ...f, phones: [...f.phones, ""] }));
  const removePhone = (index) =>
    setForm((f) => ({ ...f, phones: f.phones.filter((_, i) => i !== index) }));

  const filteredProviders = useMemo(() => {
    return providers;
  }, [providers]);

  const totalPages = Math.max(1, Math.ceil(filteredProviders.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageEnd = pageStart + pageSize;
  const pagedProviders = filteredProviders.slice(pageStart, pageEnd);
  const pageWindowStart = Math.max(1, safePage - 2);
  const pageWindowEnd = Math.min(totalPages, safePage + 2);
  const pageNumbers = Array.from(
    { length: pageWindowEnd - pageWindowStart + 1 },
    (_, i) => pageWindowStart + i
  );

  useEffect(() => {
    setPage(1);
  }, [q, statusFilter, pageSize]);

  useEffect(() => {
    if (!openActionsId) return;
    const onClickOutside = (e) => {
      const el = e.target;
      if (el?.closest?.("[data-actions-menu]")) return;
      setOpenActionsId(null);
    };
    const onEsc = (e) => {
      if (e.key === "Escape") setOpenActionsId(null);
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, [openActionsId]);

  return (
    <div className="space-y-8">
      {isAdmin && !isExportOnlyMode && (
      <section className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-6 shadow-md" ref={formRef}>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Registro de Proveedores</h2>
            <p className="text-sm text-slate-500">
              Alta rápida con datos mínimos y actualización progresiva de la ficha.
            </p>
          </div>
          {editing && (
            <button
              onClick={cancelEdit}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Cancelar edición
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className={labelClass}>Nombre</label>
            <input
              ref={nameInputRef}
              type="text"
              className={inputClass}
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="Nombre comercial"
            />
          </div>

          <div>
            <label className={labelClass}>Razón social</label>
            <input
              type="text"
              className={inputClass}
              value={form.razon_social}
              onChange={(e) => setField("razon_social", e.target.value)}
              placeholder="Opcional"
            />
          </div>

          <div>
            <label className={labelClass}>RFC</label>
            <input
              type="text"
              className={inputClass}
              value={form.rfc}
              onChange={(e) => setRfcField(e.target.value)}
              onBlur={(e) => setRfcField(e.target.value)}
              placeholder="XAXX010101000"
              maxLength={13}
            />
            <p className="mt-1 text-[11px] text-slate-500">Opcional por ahora. Si se captura: 12 o 13 caracteres, sin espacios ni guiones.</p>
          </div>

          <div>
            <label className={labelClass}>Email</label>
            <input
              type="email"
              className={inputClass}
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              placeholder="Opcional"
            />
          </div>

          <div className="md:col-span-2">
            <label className={labelClass}>Dirección</label>
            <input
              type="text"
              className={inputClass}
              value={form.address}
              onChange={(e) => setField("address", e.target.value)}
              placeholder="Dirección completa"
            />
          </div>

          <div className="md:col-span-2">
            <label className={labelClass}>Teléfonos</label>
            <div className="mt-2 space-y-2 rounded-xl border border-slate-200 bg-white p-3">
              {form.phones.map((p, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    className={`${inputClass} mt-0 flex-1`}
                    value={p}
                    onChange={(e) => updatePhone(idx, e.target.value)}
                    placeholder="Teléfono"
                  />
                  {form.phones.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePhone(idx)}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                    >
                      Quitar
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addPhone}
                className="text-xs font-semibold text-secundario hover:underline"
              >
                + Agregar teléfono
              </button>
            </div>
          </div>

          <div className="md:col-span-2">
            <label className={labelClass}>Categorías</label>
            <div className="mt-2 rounded-xl border border-slate-200 bg-white p-3">
              {loadingCategories ? (
                <div className="text-sm text-slate-500">Cargando categorías...</div>
              ) : categories.length === 0 ? (
                <div className="text-sm text-slate-500">No hay categorías</div>
              ) : (
                <div className="flex max-h-44 flex-wrap gap-2 overflow-auto pr-1">
                  {categories.map((c) => {
                    const selected = form.categories.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleCategory(c.id)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                          selected
                            ? "border-[#8B1D35] bg-[#8B1D35] text-white shadow-sm"
                            : "border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="md:col-span-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-secundario px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Guardando..." : editing ? "Actualizar proveedor" : "Crear proveedor"}
            </button>
          </div>
        </form>
      </section>
      )}

      <section className="relative overflow-visible rounded-2xl border border-slate-200 bg-white p-6 shadow-md">
        <div className="flex flex-col md:flex-row md:items-end gap-4 md:justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-800">Directorio de Proveedores</h3>
            <p className="text-sm text-slate-500">Consulta rápida de proveedores, estatus y acciones disponibles.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            {isAdmin && !isExportOnlyMode && (
              <>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleImportExcel}
                />
                <button
                  type="button"
                  onClick={() => importInputRef.current?.click()}
                  disabled={importing}
                  className={`inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 ${
                    importing ? "cursor-not-allowed opacity-60" : "hover:bg-slate-100"
                  }`}
                  title="Importar archivo Excel con columnas Nombre, Razón social y RFC"
                >
                  <Upload size={14} />
                  {importing ? "Importando..." : "Importar Excel"}
                </button>
              </>
            )}
            <input
              type="text"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#8B1D35] focus:ring-2 focus:ring-[#8B1D35]/20"
              placeholder="Buscar por nombre, RFC o email"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#8B1D35] focus:ring-2 focus:ring-[#8B1D35]/20"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Todos</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.label}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#8B1D35] focus:ring-2 focus:ring-[#8B1D35]/20"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              {[5, 10, 20, 50].map((s) => (
                <option key={s} value={s}>
                  {s} por página
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 overflow-visible rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loadingProviders ? (
            <div className="p-4 text-sm text-gray-500">Cargando proveedores...</div>
          ) : pagedProviders.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">Sin resultados</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100/80 text-[11px] uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold">Proveedor</th>
                    <th className="px-4 py-3 text-left font-bold">Contacto</th>
                    <th className="px-4 py-3 text-left font-bold">Estatus</th>
                    {isAdmin && !isExportOnlyMode && <th className="px-4 py-3 text-right font-bold">Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {pagedProviders.map((p, idx) => (
                    <tr key={p.id} className="border-t border-slate-200 hover:bg-slate-50/70">
                      <td className="px-4 py-3 align-top">
                        <div className="font-semibold text-slate-800">{p.name}</div>
                        <div className="mt-1 text-xs text-slate-500">RFC: {p.rfc || "Pendiente"}</div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="text-slate-700">{p.email || "Sin correo"}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {(p.phones || []).map((ph) => ph.phone).join(", ") || "Sin teléfonos"}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                            Number(p.statuses_id) === 5
                              ? "border-green-300/60 bg-green-500/15 text-green-700"
                              : Number(p.statuses_id) === 3
                              ? "border-blue-300/60 bg-blue-500/15 text-blue-700"
                              : Number(p.statuses_id) === 4
                              ? "border-red-300/60 bg-red-500/15 text-red-700"
                              : "border-slate-300/60 bg-slate-500/10 text-slate-700"
                          }`}
                        >
                          {STATUS_OPTIONS.find((s) => s.id === Number(p.statuses_id))?.label || p.statuses_id}
                        </span>
                      </td>
                      {isAdmin && !isExportOnlyMode && (
                        <td className="px-4 py-3 text-right align-top">
                          <div className="relative inline-flex justify-end" data-actions-menu>
                            <button
                              onClick={() => setOpenActionsId(openActionsId === p.id ? null : p.id)}
                              className="inline-flex items-center gap-2 rounded-full bg-secundario px-3 py-1.5 text-xs text-white shadow-md hover:opacity-90"
                            >
                              Acciones
                              <ChevronDown size={14} />
                            </button>
                            {openActionsId === p.id && (
                              <div
                                className={`absolute right-0 z-[9999] w-56 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg ${
                                  idx >= pagedProviders.length - 2 ? "bottom-full mb-2" : "mt-2"
                                }`}
                              >
                                <button
                                  onClick={() => {
                                    setOpenActionsId(null);
                                    startEdit(p);
                                  }}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
                                >
                                  <Pencil size={14} /> Editar proveedor
                                </button>
                                <button
                                  onClick={() => {
                                    setOpenActionsId(null);
                                    setDetailProvider(p);
                                  }}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
                                >
                                  <FileText size={14} /> Ver detalle
                                </button>
                                {Number(p.statuses_id) !== 5 && (
                                  <button
                                    onClick={() => {
                                      setOpenActionsId(null);
                                      updateStatus(p, 5);
                                    }}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-xs text-green-700 hover:bg-green-50"
                                  >
                                    <ShieldCheck size={14} /> Marcar verificado
                                  </button>
                                )}
                                {Number(p.statuses_id) !== 4 && (
                                  <button
                                    onClick={() => {
                                      setOpenActionsId(null);
                                      updateStatus(p, 4);
                                    }}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-700 hover:bg-red-50"
                                  >
                                    <Power size={14} /> Desactivar
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            Página {safePage} de {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="px-2 py-1 text-xs border rounded disabled:opacity-50"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
            >
              Anterior
            </button>
            {pageNumbers.map((n) => (
              <button
                key={n}
                className={`px-2 py-1 text-xs border rounded ${n === safePage ? "bg-secundario text-white" : ""}`}
                onClick={() => setPage(n)}
              >
                {n}
              </button>
            ))}
            <button
              className="px-2 py-1 text-xs border rounded disabled:opacity-50"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
            >
              Siguiente
            </button>
          </div>
        </div>
      </section>

      {detailProvider && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDetailProvider(null)}
          />
          <div className="relative w-[92%] max-w-3xl bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-secundario to-secundario/80 text-white flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-white/80">Ficha de proveedor</div>
                <div className="text-sm font-bold">{detailProvider.name}</div>
              </div>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold border ${
                  Number(detailProvider.statuses_id) === 5
                    ? "bg-green-500/20 text-green-50 border-green-300/40"
                    : Number(detailProvider.statuses_id) === 3
                    ? "bg-blue-500/20 text-blue-50 border-blue-300/40"
                    : Number(detailProvider.statuses_id) === 4
                    ? "bg-red-500/20 text-red-50 border-red-300/40"
                    : "bg-white/20 text-white border-white/30"
                }`}
              >
                {STATUS_OPTIONS.find((s) => s.id === Number(detailProvider.statuses_id))?.label || detailProvider.statuses_id}
              </span>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm bg-gradient-to-b from-white to-slate-50">
              <div className="md:col-span-1 space-y-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-[11px] text-slate-500 font-bold uppercase tracking-wide">Razón social</div>
                <div className="text-gray-800 mt-1">{detailProvider.razon_social || "—"}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-[11px] text-slate-500 font-bold uppercase tracking-wide">RFC</div>
                <div className="text-gray-800 mt-1">{detailProvider.rfc || "—"}</div>
              </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-[11px] text-slate-500 font-bold uppercase tracking-wide">Email</div>
                  <div className="text-gray-800 mt-1 break-words">{detailProvider.email || "—"}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-[11px] text-slate-500 font-bold uppercase tracking-wide">Dirección</div>
                  <div className="text-gray-800 mt-1 break-words">{detailProvider.address || "—"}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-[11px] text-slate-500 font-bold uppercase tracking-wide">Teléfonos</div>
                  <div className="mt-2 flex flex-col gap-1">
                    {(detailProvider.phones || []).length === 0 ? (
                      <span className="text-gray-500 text-xs">—</span>
                    ) : (
                      detailProvider.phones.map((ph) => (
                        <span
                          key={ph.id}
                          className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 w-fit"
                        >
                          {ph.phone}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>
              <div className="md:col-span-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-[11px] text-slate-500 font-bold uppercase tracking-wide">Categorías</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(detailProvider.categories || []).length === 0 ? (
                    <span className="text-gray-500 text-xs">—</span>
                  ) : (
                    detailProvider.categories.map((c) => (
                      <span
                        key={c.id}
                        className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700 border border-slate-200"
                      >
                        {c.name}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
            <div className="px-5 pb-5 flex justify-end gap-2">
              <button
                onClick={() => setDetailProvider(null)}
                className="px-4 py-2 rounded-lg text-xs font-bold border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmAction.open}
        title="Desactivar proveedor"
        headerText="Confirmar"
        description={`Vas a desactivar a ${confirmAction.provider?.name || "este proveedor"}.`}
        confirmText="Desactivar"
        variant="danger"
        onCancel={() => setConfirmAction({ open: false, provider: null, nextStatus: null })}
        onConfirm={confirmDeactivate}
      />

    </div>
  );
}
