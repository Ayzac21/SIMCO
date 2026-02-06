import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ArrowUpDown, X, FileText, Info, User } from "lucide-react";
import { toast } from "sonner";

const API = "http://localhost:4000/api";

const STATUS_FLOW = [7, 8, 9, 12, 14, 13, 11];

const STATUS_LABELS = {
  7: "Borrador",
  8: "Coordinación",
  9: "Secretaría",
  12: "Cotización",
  14: "Revisión",
  13: "Compra",
  11: "Finalizada",
  10: "Rechazada",
};

function getUserId() {
  try {
    const usuario = JSON.parse(localStorage.getItem("usuario"));
    return usuario?.id ? Number(usuario.id) : null;
  } catch {
    return null;
  }
}

function safeDate(d) {
  if (!d) return "—";
  try {
    return String(d).split("T")[0];
  } catch {
    return "—";
  }
}

/** ✅ Barra completa (para LISTA si quieres mantenerla ahí) */
const ProgressBar = ({ statusId }) => {
  const index = STATUS_FLOW.indexOf(Number(statusId));
  if (index === -1) return null;

  const pct = ((index + 1) / STATUS_FLOW.length) * 100;

  return (
    <div className="mt-2">
      <div className="flex justify-between text-[11px] font-medium text-gray-500">
        {STATUS_FLOW.map((id, i) => (
          <span
            key={id}
            className={i <= index ? "text-secundario font-semibold" : ""}
          >
            {STATUS_LABELS[id]}
          </span>
        ))}
      </div>

      <div className="h-2 bg-gray-200 rounded mt-1 overflow-hidden">
        <div
          className="h-2 bg-secundario rounded transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

/** ✅ NUEVO: SOLO estatus actual + mini progreso (para MODAL) */
const CurrentStatus = ({ statusId, statusName }) => {
  const st = Number(statusId);
  const label = statusName || STATUS_LABELS[st] || "Sin estatus";

  // Si está en flujo, mostramos barrita; si no (p.ej. rechazada 10), no.
  const idx = STATUS_FLOW.indexOf(st);
  const hasFlow = idx !== -1;

  const pct = hasFlow ? Math.round(((idx + 1) / STATUS_FLOW.length) * 100) : 0;

  return (
    <div className="mt-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-extrabold bg-secundario/10 text-secundario border border-secundario/20">
          {label}
        </span>

        {hasFlow && (
          <span className="text-xs text-gray-500">
            Paso <b>{idx + 1}</b> de <b>{STATUS_FLOW.length}</b>
          </span>
        )}
      </div>

      {hasFlow && (
        <div className="mt-2">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-2 rounded-full bg-secundario"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-1 text-[11px] text-gray-500">{pct}%</div>
        </div>
      )}
    </div>
  );
};

export default function ListaRequisiciones() {
  const navigate = useNavigate();

  const [requisiciones, setRequisiciones] = useState([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState("new");

  const [paginaActual, setPaginaActual] = useState(1);
  const POR_PAGINA = 6;

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState(null);

  const [rejectedPreview, setRejectedPreview] = useState({}); // { [id]: { notes, rejected_by_name } }

  const fetchRequisiciones = async () => {
    try {
      setLoading(true);
      const userId = getUserId();
      if (!userId) throw new Error("No se encontró el usuario");

      const res = await fetch(
        `${API}/requisiciones/mis-requisiciones/${userId}`
      );
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.message || "Error al cargar");

      const list = Array.isArray(data) ? data : [];
      setRequisiciones(list);
      setPaginaActual(1);

      // Precarga ligera para rechazadas (máx 8) para mostrar motivo en la lista
      const rejected = list.filter((r) => Number(r.statuses_id) === 10).slice(0, 8);
      if (rejected.length) {
        const entries = await Promise.all(
          rejected.map(async (r) => {
            try {
              const rr = await fetch(`${API}/requisiciones/${r.id}`);
              const dd = await rr.json().catch(() => ({}));
              if (!rr.ok) return [r.id, null];
              return [
                r.id,
                {
                  notes: dd?.notes || "",
                  rejected_by_name: dd?.rejected_by_name || dd?.rejected_by || "",
                },
              ];
            } catch {
              return [r.id, null];
            }
          })
        );

        const map = {};
        entries.forEach(([id, val]) => {
          if (val) map[id] = val;
        });
        setRejectedPreview(map);
      } else {
        setRejectedPreview({});
      }
    } catch (err) {
      console.error(err);
      toast.error("No se pudo cargar", {
        description: err?.message || "Intenta de nuevo",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequisiciones();
  }, []);

  const filtered = useMemo(() => {
    let list = [...requisiciones];

    const qq = q.trim().toLowerCase();
    if (qq) {
      list = list.filter((r) => {
        const a = String(r.categoria || "").toLowerCase();
        const b = String(r.estatus || "").toLowerCase();
        const c = String(r.area_folio || "").toLowerCase();
        const d = String(r.id || "").toLowerCase();
        return a.includes(qq) || b.includes(qq) || c.includes(qq) || d.includes(qq);
      });
    }

    if (statusFilter !== "all") {
      const st = Number(statusFilter);
      list = list.filter((r) => Number(r.statuses_id) === st);
    }

    list.sort((a, b) => {
      const da = new Date(a.created_at).getTime() || 0;
      const db = new Date(b.created_at).getTime() || 0;
      return sort === "new" ? db - da : da - db;
    });

    return list;
  }, [requisiciones, q, statusFilter, sort]);

  const totalPaginas = useMemo(
    () => Math.max(1, Math.ceil(filtered.length / POR_PAGINA)),
    [filtered.length]
  );

  const inicio = (paginaActual - 1) * POR_PAGINA;
  const fin = inicio + POR_PAGINA;
  const page = filtered.slice(inicio, fin);

  const closeModal = () => {
    setOpen(false);
    setSelected(null);
    setDetail(null);
    setDetailLoading(false);
  };

  const openModal = async (row) => {
    setSelected(row);
    setOpen(true);
    setDetail(null);

    try {
      setDetailLoading(true);
      const res = await fetch(`${API}/requisiciones/${row.id}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "No se pudo cargar el detalle");
      setDetail(data);
    } catch (e) {
      console.error(e);
      toast.error("No se pudo abrir", { description: e?.message || "Intenta de nuevo" });
    } finally {
      setDetailLoading(false);
    }
  };

  const continuar = () => {
    if (!selected) return;
    const st = Number(selected.statuses_id);
    const id = selected.id;

    closeModal();

    if (st === 7) return navigate(`/unidad/requisiciones/editar/${id}`);
    if (st === 14) return navigate(`/unidad/revision/${id}`);
    return navigate(`/unidad/mi-requisiciones`);
  };

  return (
    <div className="bg-white p-5 md:p-6 rounded-xl shadow-lg border border-gray-200">
      {/* ===== MODAL ===== */}
      {open && selected && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={closeModal} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
              <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <FileText className="text-secundario" size={18} />
                    <div className="font-extrabold text-gray-900 truncate">
                      {detail?.request_name || selected?.categoria || "Requisición"}
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 mt-1">
                    Folio: <b>#{selected.id}</b>{" "}
                    {selected.area_folio ? `• ${selected.area_folio}` : ""} •{" "}
                    {safeDate(selected.created_at)}
                  </div>

                  {/* ✅ AQUÍ: en MODAL ya NO mostramos todos los pasos */}
                  <CurrentStatus
                    statusId={selected.statuses_id}
                    statusName={selected.estatus}
                  />
                </div>

                <button
                  onClick={closeModal}
                  className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                >
                  <X size={18} className="text-gray-700" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {detailLoading ? (
                  <div className="text-sm text-gray-500">Cargando detalle...</div>
                ) : (
                  <>
                    {Number(selected.statuses_id) === 10 && (
                      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                        <div className="flex items-center gap-2 text-xs font-extrabold text-red-700">
                          <Info size={14} /> RECHAZADA
                        </div>
                        <div className="text-sm text-gray-800 mt-2">
                          <b>Motivo:</b>{" "}
                          {detail?.notes?.trim() ? (
                            detail.notes
                          ) : (
                            <span className="text-gray-600">No registrado</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-800 mt-1 flex items-center gap-2">
                          <User size={14} className="text-red-700" />
                          <b>Rechazó:</b>{" "}
                          {detail?.rejected_by_name?.trim() ? (
                            detail.rejected_by_name
                          ) : (
                            <span className="text-gray-600">No registrado</span>
                          )}
                        </div>
                      </div>
                    )}

                    {(detail?.partidas?.length ?? 0) > 0 ? (
                      <div className="border border-gray-200 rounded-xl overflow-hidden">
                        {/* ✅ Scroll interno para que no se aplaste */}
                        <div className="max-h-[260px] overflow-auto">
                          <table className="w-full text-sm">
                            <thead className="text-xs uppercase text-gray-500 bg-gray-50">
                              <tr>
                                <th className="text-left px-4 py-3">Producto</th>
                                <th className="text-left px-4 py-3">Descripción</th>
                                <th className="text-right px-4 py-3">Cant.</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {detail.partidas.map((p) => (
                                <tr key={p.id}>
                                  <td className="px-4 py-3 font-semibold text-gray-800">
                                    {p.product_name || "—"}
                                  </td>
                                  <td className="px-4 py-3 text-gray-700">
                                    {p.description || "—"}
                                  </td>
                                  <td className="px-4 py-3 text-right font-bold text-gray-900">
                                    {p.quantity ?? "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-600">Sin artículos.</div>
                    )}
                  </>
                )}
              </div>

              <div className="p-5 border-t border-gray-100 flex items-center justify-between gap-3">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 rounded-xl text-xs font-extrabold bg-gray-100 hover:bg-gray-200 text-gray-800"
                >
                  Cerrar
                </button>

                <button
                  onClick={continuar}
                  className="px-4 py-2 rounded-xl text-xs font-extrabold bg-secundario text-white shadow-sm hover:opacity-90"
                >
                  Continuar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== HEADER ===== */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-secundario">
            Mis requisiciones
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Filtra y abre una solicitud para ver su avance.
          </p>
        </div>

        <button
          onClick={fetchRequisiciones}
          className="px-4 py-2 bg-secundario text-white rounded-lg hover:opacity-90 text-sm font-semibold"
        >
          Actualizar
        </button>
      </div>

      {/* ===== FILTROS ===== */}
      <div className="flex flex-col lg:flex-row gap-3 lg:items-center mb-4">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar (folio, categoría, estatus)..."
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-secundario/20"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm bg-white"
        >
          <option value="all">Todos</option>
          <option value="7">Borrador</option>
          <option value="8">Coordinación</option>
          <option value="9">Secretaría</option>
          <option value="12">Cotización</option>
          <option value="14">Revisión</option>
          <option value="13">Compra</option>
          <option value="11">Finalizada</option>
          <option value="10">Rechazada</option>
        </select>

        <button
          onClick={() => setSort((p) => (p === "new" ? "old" : "new"))}
          className="px-3 py-2 border rounded-lg text-sm bg-white hover:bg-gray-50 flex items-center gap-2"
          title="Cambiar orden"
        >
          <ArrowUpDown size={16} className="text-gray-500" />
          {sort === "new" ? "Más recientes" : "Más antiguas"}
        </button>
      </div>

      {/* ===== LISTA ===== */}
      <div className="border rounded-lg overflow-hidden">
        <div className="grid grid-cols-12 gap-3 px-4 py-3 bg-gray-50 text-xs font-semibold text-gray-500">
          <div className="col-span-7">Solicitud</div>
          <div className="col-span-3">Estatus</div>
          <div className="col-span-2 text-right">Fecha</div>
        </div>

        {loading ? (
          <div className="p-6 text-center text-sm text-gray-500">Cargando...</div>
        ) : page.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">
            No hay requisiciones.
          </div>
        ) : (
          <div className="divide-y">
            {page.map((req) => {
              const st = Number(req.statuses_id);
              const preview = st === 10 ? rejectedPreview[req.id] : null;
              const motivo = preview?.notes?.trim() ? preview.notes.trim() : "";
              const quien = preview?.rejected_by_name?.trim()
                ? preview.rejected_by_name.trim()
                : "";

              return (
                <button
                  key={req.id}
                  type="button"
                  onClick={() => openModal(req)}
                  className="w-full text-left px-4 py-4 hover:bg-gray-50 transition focus:outline-none focus:ring-2 focus:ring-secundario/20"
                >
                  <div className="grid grid-cols-12 gap-3 items-start">
                    <div className="col-span-7 min-w-0">
                      <div className="font-bold text-secundario truncate text-[15px]">
                        {req.categoria}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Folio: <b>#{req.id}</b>{" "}
                        {req.area_folio ? `• ${req.area_folio}` : ""}
                      </div>

                      {/* (Dejé tu barra completa aquí porque dijiste que te gusta en la lista) */}
                      <div className="mt-2">
                        <ProgressBar statusId={st} />
                      </div>

                      {st === 10 && (
                        <div className="mt-2 text-sm text-gray-700">
                          <span className="font-semibold text-red-700">
                            Motivo:
                          </span>{" "}
                          {motivo ? (
                            <span className="text-gray-800">{motivo}</span>
                          ) : (
                            <span className="text-gray-500">No registrado</span>
                          )}
                          <span className="text-gray-400"> • </span>
                          <span className="font-semibold text-red-700">
                            Rechazó:
                          </span>{" "}
                          {quien ? (
                            <span className="text-gray-800">{quien}</span>
                          ) : (
                            <span className="text-gray-500">No registrado</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="col-span-3">
                      <div className="text-sm text-gray-800">
                        Estatus: <b>{req.estatus}</b>
                      </div>

                      <div className="mt-2">
                        <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold bg-gray-100 text-gray-700 border border-gray-200">
                          Ver
                        </span>
                      </div>
                    </div>

                    <div className="col-span-2 text-right text-sm text-gray-700">
                      {safeDate(req.created_at)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== PAGINACIÓN ===== */}
      <div className="mt-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center">
          <button
            onClick={() => setPaginaActual((p) => Math.max(p - 1, 1))}
            disabled={paginaActual === 1}
            className="px-4 py-2 bg-gray-200 rounded-md text-sm font-semibold hover:bg-gray-300 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← Anterior
          </button>

          <span className="text-sm text-gray-600 text-center">
            Página <b>{paginaActual}</b> de <b>{totalPaginas}</b>
          </span>

          <button
            onClick={() => setPaginaActual((p) => Math.min(p + 1, totalPaginas))}
            disabled={paginaActual === totalPaginas}
            className="px-4 py-2 bg-gray-200 rounded-md text-sm font-semibold hover:bg-gray-300 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Siguiente →
          </button>
        </div>
      </div>
    </div>
  );
}
