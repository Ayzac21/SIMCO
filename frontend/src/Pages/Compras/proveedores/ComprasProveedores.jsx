import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import ConfirmModal from "../../../components/ConfirmModal";
import { ChevronDown, FileText, Pencil, ShieldCheck, Power, CheckCircle } from "lucide-react";

const API_CATEGORIES = "http://localhost:4000/api/categories";
const API_PROVIDERS_ADMIN = "http://localhost:4000/api/compras/providers/admin";
const API_PROVIDERS = "http://localhost:4000/api/compras/providers";

const STATUS_OPTIONS = [
  { id: 3, label: "Activo" },
  { id: 4, label: "Inactivo" },
  { id: 5, label: "Verificado" },
  { id: 6, label: "No verificado" },
];

const RFC_REGEX = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i;
const PHONE_REGEX = /^[0-9+()\\-\\s]{7,20}$/;

export default function ComprasProveedores() {
  const userStr = localStorage.getItem("usuario");
  const user = userStr ? JSON.parse(userStr) : null;
  const headers = {
    "Content-Type": "application/json",
    "x-user-id": String(user?.id || ""),
    "x-user-role": String(user?.role || ""),
  };
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [providers, setProviders] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editingOriginalRfc, setEditingOriginalRfc] = useState("");
  const [detailProvider, setDetailProvider] = useState(null);
  const [confirmAction, setConfirmAction] = useState({ open: false, provider: null, nextStatus: null });
  const [openActionsId, setOpenActionsId] = useState(null);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const formRef = useRef(null);
  const nameInputRef = useRef(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    rfc: "",
    address: "",
    statuses_id: 6,
    categories: [],
    phones: [""],
  });

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    const load = async () => {
      try {
        setLoadingCategories(true);
      const res = await fetch(API_CATEGORIES);
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
  }, []);

  const loadProviders = async () => {
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
  };

  useEffect(() => {
    loadProviders();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => loadProviders(), 250);
    return () => clearTimeout(t);
  }, [q, statusFilter]);

  const validate = () => {
    if (!form.name.trim()) {
      toast.error("Falta nombre");
      return false;
    }
    if (!form.rfc.trim()) {
      toast.error("Falta RFC");
      return false;
    }
    const currentRfc = form.rfc.trim().toUpperCase();
    if (editing?.id && editingOriginalRfc && currentRfc === editingOriginalRfc) {
      // RFC legacy: permitir si no cambió
    } else if (!RFC_REGEX.test(currentRfc)) {
      toast.error("RFC inválido");
      return false;
    }
    if (form.email && !String(form.email).includes("@")) {
      toast.error("Email inválido");
      return false;
    }

    const cleanRfc = form.rfc.trim().toUpperCase();
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
    if (!validate()) return;
    const toastId = toast.loading("Procesando...");

    try {
      setSaving(true);
      const isEdit = Boolean(editing?.id);
      const payload = {
        name: form.name.trim(),
        email: form.email.trim() || null,
        rfc: form.rfc.trim().toUpperCase(),
        address: form.address.trim() || null,
        statuses_id: Number(form.statuses_id),
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

  const startEdit = (p) => {
    setEditing(p);
    setEditingOriginalRfc(String(p.rfc || "").trim().toUpperCase());
    setForm({
      name: p.name || "",
      email: p.email || "",
      rfc: p.rfc || "",
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
  };

  const updateStatus = async (provider, nextStatus) => {
    if (!provider?.id) return;
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
      <section className="bg-white rounded-xl shadow-md border border-gray-200 p-6" ref={formRef}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Registro de Proveedores</h2>
            <p className="text-xs text-gray-500">
              Captura datos básicos, categorías y teléfonos.
            </p>
          </div>
          {editing && (
            <button
              onClick={cancelEdit}
              className="px-3 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
            >
              Cancelar edición
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-bold text-gray-500">Nombre</label>
            <input
              ref={nameInputRef}
              type="text"
              className="w-full mt-1 p-2 border rounded-md text-sm border-gray-300 focus:border-[#8B1D35] focus:ring-1 focus:ring-[#8B1D35] outline-none"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="Razón social / Nombre comercial"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-gray-500">RFC</label>
            <input
              type="text"
              className="w-full mt-1 p-2 border rounded-md text-sm border-gray-300 focus:border-[#8B1D35] focus:ring-1 focus:ring-[#8B1D35] outline-none"
              value={form.rfc}
              onChange={(e) => setField("rfc", e.target.value)}
              placeholder="RFC"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-gray-500">Email</label>
            <input
              type="email"
              className="w-full mt-1 p-2 border rounded-md text-sm border-gray-300 focus:border-[#8B1D35] focus:ring-1 focus:ring-[#8B1D35] outline-none"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              placeholder="correo@dominio.com"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-gray-500">Estatus</label>
            <select
              className="w-full mt-1 p-2 border rounded-md text-sm border-gray-300 focus:border-[#8B1D35] focus:ring-1 focus:ring-[#8B1D35] outline-none"
              value={form.statuses_id}
              onChange={(e) => setField("statuses_id", Number(e.target.value))}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="text-[11px] font-bold text-gray-500">Dirección</label>
            <input
              type="text"
              className="w-full mt-1 p-2 border rounded-md text-sm border-gray-300 focus:border-[#8B1D35] focus:ring-1 focus:ring-[#8B1D35] outline-none"
              value={form.address}
              onChange={(e) => setField("address", e.target.value)}
              placeholder="Dirección completa"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-[11px] font-bold text-gray-500">Teléfonos</label>
            <div className="space-y-2 mt-2">
              {form.phones.map((p, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    className="flex-1 p-2 border rounded-md text-sm border-gray-300 focus:border-[#8B1D35] focus:ring-1 focus:ring-[#8B1D35] outline-none"
                    value={p}
                    onChange={(e) => updatePhone(idx, e.target.value)}
                    placeholder="Teléfono"
                  />
                  {form.phones.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePhone(idx)}
                      className="px-2 py-1 text-xs border rounded-md hover:bg-gray-50"
                    >
                      Quitar
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addPhone}
                className="text-xs text-secundario font-semibold"
              >
                + Agregar teléfono
              </button>
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="text-[11px] font-bold text-gray-500">Categorías</label>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-auto border rounded-md p-2">
              {loadingCategories ? (
                <div className="text-sm text-gray-500">Cargando categorías...</div>
              ) : categories.length === 0 ? (
                <div className="text-sm text-gray-500">No hay categorías</div>
              ) : (
                categories.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.categories.includes(c.id)}
                      onChange={() => toggleCategory(c.id)}
                    />
                    <span>{c.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="md:col-span-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-secundario text-white px-4 py-2 rounded-md text-sm font-semibold shadow-md hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Guardando..." : editing ? "Actualizar proveedor" : "Crear proveedor"}
            </button>
          </div>
        </form>
      </section>

      <section className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
        <div className="flex flex-col md:flex-row md:items-end gap-4 md:justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-800">Proveedores</h3>
            <p className="text-xs text-gray-500">Administración y consulta.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              className="p-2 border rounded-md text-sm"
              placeholder="Buscar por nombre, RFC o email"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              className="p-2 border rounded-md text-sm"
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
              className="p-2 border rounded-md text-sm"
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

        <div className="mt-4 rounded-2xl border border-gray-200 overflow-hidden bg-gradient-to-b from-slate-50 to-white shadow-sm">
          <div className="grid grid-cols-8 bg-slate-100/80 text-[11px] font-bold text-slate-700 px-4 py-3 uppercase tracking-wide">
            <div className="col-span-3">Proveedor</div>
            <div className="col-span-2">Email</div>
            <div className="col-span-1">Estatus</div>
            <div className="col-span-2 text-right">Acciones</div>
          </div>

        </div>

        <div className="border-x border-b rounded-b-2xl overflow-visible bg-white/60 backdrop-blur">
          {loadingProviders ? (
            <div className="p-4 text-sm text-gray-500">Cargando proveedores...</div>
          ) : pagedProviders.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">Sin resultados</div>
          ) : (
            pagedProviders.map((p, idx) => (
              <div
                key={p.id}
                className={`relative grid grid-cols-8 px-4 py-3 text-sm border-t items-center ${
                  idx % 2 === 0 ? "bg-white" : "bg-slate-50/60"
                } hover:bg-secundario/5 transition`}
              >
                <div
                  className={`absolute left-0 top-0 h-full w-1 ${
                    Number(p.statuses_id) === 5
                      ? "bg-green-500"
                      : Number(p.statuses_id) === 3
                      ? "bg-blue-500"
                      : Number(p.statuses_id) === 4
                      ? "bg-red-500"
                      : "bg-slate-300"
                  }`}
                />
                <div className="col-span-3">
                  <div className="font-semibold text-gray-800">{p.name}</div>
                  <div className="text-xs text-gray-500">
                    {(p.phones || []).map((ph) => ph.phone).join(", ") || "—"}
                  </div>
                </div>
                <div className="col-span-2 text-gray-700">{p.email || "—"}</div>
                <div className="col-span-1">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold border shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] ${
                      Number(p.statuses_id) === 5
                        ? "bg-green-500/15 text-green-700 border-green-300/60"
                        : Number(p.statuses_id) === 3
                        ? "bg-blue-500/15 text-blue-700 border-blue-300/60"
                        : Number(p.statuses_id) === 4
                        ? "bg-red-500/15 text-red-700 border-red-300/60"
                        : "bg-slate-500/10 text-slate-700 border-slate-300/60"
                    }`}
                  >
                    {STATUS_OPTIONS.find((s) => s.id === Number(p.statuses_id))?.label || p.statuses_id}
                  </span>
                </div>
                <div className="col-span-2 text-right">
                  <div className="relative inline-flex justify-end" data-actions-menu>
                    <button
                      onClick={() => setOpenActionsId(openActionsId === p.id ? null : p.id)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-full bg-secundario text-white shadow-md hover:opacity-90"
                    >
                      Acciones
                      <ChevronDown size={14} />
                    </button>
                    {openActionsId === p.id && (
                      <div className="absolute right-0 mt-2 w-52 rounded-xl border border-gray-200 bg-white shadow-lg z-[9999] overflow-hidden">
                        <button
                          onClick={() => {
                            setOpenActionsId(null);
                            startEdit(p);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
                        >
                          <Pencil size={14} /> Editar proveedor
                        </button>
                        <button
                          onClick={() => {
                            setOpenActionsId(null);
                            setDetailProvider(p);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
                        >
                          <FileText size={14} /> Ver detalle
                        </button>
                        {Number(p.statuses_id) !== 5 && (
                          <button
                            onClick={() => {
                              setOpenActionsId(null);
                              updateStatus(p, 5);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-green-700 hover:bg-green-50"
                          >
                            <ShieldCheck size={14} /> Marcar verificado
                          </button>
                        )}
                        {Number(p.statuses_id) !== 3 && (
                          <button
                            onClick={() => {
                              setOpenActionsId(null);
                              updateStatus(p, 3);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-blue-700 hover:bg-blue-50"
                          >
                            <CheckCircle size={14} /> Activar
                          </button>
                        )}
                        {Number(p.statuses_id) !== 4 && (
                          <button
                            onClick={() => {
                              setOpenActionsId(null);
                              updateStatus(p, 4);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-700 hover:bg-red-50"
                          >
                            <Power size={14} /> Desactivar
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
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
