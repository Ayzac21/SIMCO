import React, { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, RotateCw, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getAuthHeaders } from "../api/auth";
import { API_BASE_URL } from "../api/config";

const API_NOTIFICATIONS = `${API_BASE_URL}/notifications`;

function formatWhen(value) {
  if (!value) return "";
  const created = new Date(value).getTime();
  if (!Number.isFinite(created)) return "";
  const diff = Date.now() - created;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Ahora";
  if (min < 60) return `Hace ${min} min`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `Hace ${hrs} h`;
  const days = Math.floor(hrs / 24);
  return `Hace ${days} d`;
}

function normalizeActionPath(notification) {
  const base = String(notification?.action_path || "").trim();
  const reqId = Number(notification?.entity_id || 0);
  if (!base) return "";

  const isRequisition = String(notification?.entity_type || "") === "requisition";
  if (!isRequisition || !reqId) return base;

  const hasOpenReq = base.includes("openReq=");
  if (hasOpenReq) return base;

  if (
    base.startsWith("/coordinador/requisiciones") ||
    base.startsWith("/secretaria/recibidas") ||
    base.startsWith("/unidad/mi-requisiciones") ||
    base.startsWith("/compras/dashboard")
  ) {
    const joiner = base.includes("?") ? "&" : "?";
    return `${base}${joiner}openReq=${reqId}`;
  }
  return base;
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [rows, setRows] = useState([]);
  const [unread, setUnread] = useState(0);
  const hasAttention = unread > 0 && !open;
  const actionBtnBase =
    "h-7 px-2.5 text-[11px] font-semibold inline-flex items-center gap-1.5 rounded border border-gray-200 bg-white transition disabled:opacity-50 disabled:cursor-not-allowed";

  const loadNotifications = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch(`${API_NOTIFICATIONS}?limit=12`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error();
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setUnread(Number(data.unread || 0));
    } catch {
      if (!silent) {
        setRows([]);
        setUnread(0);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
    const timer = setInterval(() => loadNotifications({ silent: true }), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const onDocClick = (evt) => {
      if (!rootRef.current?.contains(evt.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const markRead = async (id) => {
    try {
      await fetch(`${API_NOTIFICATIONS}/${id}/read`, {
        method: "PATCH",
        headers: getAuthHeaders(),
      });
      setRows((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n)));
      setUnread((prev) => Math.max(0, prev - 1));
    } catch {
      // noop
    }
  };

  const markAllRead = async () => {
    try {
      setMarkingAll(true);
      await fetch(`${API_NOTIFICATIONS}/read-all`, {
        method: "PATCH",
        headers: getAuthHeaders(),
      });
      setRows((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
      setUnread(0);
    } catch {
      // noop
    } finally {
      setMarkingAll(false);
    }
  };

  const onItemClick = async (n) => {
    if (!Number(n.is_read)) await markRead(n.id);
    setOpen(false);
    const target = normalizeActionPath(n);
    if (target) navigate(target);
  };

  const handleManualRefresh = async () => {
    if (refreshing) return;
    try {
      setRefreshing(true);
      await Promise.all([
        loadNotifications({ silent: true }),
        new Promise((resolve) => setTimeout(resolve, 1200)),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const clearAll = async () => {
    if (clearing) return;
    try {
      setClearing(true);
      await fetch(`${API_NOTIFICATIONS}/clear`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      setRows([]);
      setUnread(0);
    } catch {
      // noop
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="relative" ref={rootRef}>
      <style>{`
        @keyframes notif-wiggle {
          0%, 100% { transform: rotate(0deg); }
          20% { transform: rotate(10deg); }
          40% { transform: rotate(-8deg); }
          60% { transform: rotate(6deg); }
          80% { transform: rotate(-4deg); }
        }
        .notif-wiggle {
          animation: notif-wiggle 0.8s ease-in-out infinite;
          transform-origin: top center;
        }
      `}</style>
      <button
        type="button"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) loadNotifications();
        }}
        className={`relative p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition ${
          hasAttention ? "ring-2 ring-red-200" : ""
        }`}
        title={unread > 0 ? `Tienes ${unread} notificación(es)` : "Notificaciones"}
      >
        <Bell size={18} className={`text-gray-600 ${hasAttention ? "notif-wiggle" : ""}`} />
        {unread > 0 && (
          <>
            <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
              {unread > 99 ? "99+" : unread}
            </span>
            <span className="absolute -top-1 -right-1 min-w-5 h-5 rounded-full bg-red-500/50 animate-ping" />
          </>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[380px] max-w-[92vw] bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="px-3 py-3 border-b border-gray-100 bg-gray-50 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold text-gray-700">Notificaciones</p>
              <p className="text-[11px] text-gray-500">
                {unread > 0 ? `${unread} pendiente(s)` : "Sin pendientes"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <button
                type="button"
                onClick={handleManualRefresh}
                disabled={refreshing}
                className={`${actionBtnBase} ${
                  refreshing
                    ? "text-secundario bg-secundario/10 border-secundario/30 cursor-wait"
                    : "text-gray-600 hover:text-gray-800"
                }`}
              >
                <RotateCw size={13} className={refreshing ? "animate-spin" : ""} />
                {refreshing ? "Actualizando..." : "Actualizar"}
              </button>
              <button
                type="button"
                onClick={markAllRead}
                disabled={markingAll || unread === 0}
                className={`${actionBtnBase} text-gray-600 hover:text-gray-800`}
              >
                <CheckCheck size={13} />
                {markingAll ? "Marcando..." : "Marcar todo"}
              </button>
              <button
                type="button"
                onClick={clearAll}
                disabled={clearing || rows.length === 0}
                className={`${actionBtnBase} text-gray-600 hover:text-red-700`}
                title="Limpiar notificaciones"
              >
                <Trash2 size={13} />
                {clearing ? "Limpiando..." : "Limpiar"}
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-sm text-gray-500">Cargando...</div>
            ) : rows.length === 0 ? (
              <div className="p-5 text-sm text-gray-500 text-center">Sin notificaciones.</div>
            ) : (
              rows.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => onItemClick(n)}
                  className={`w-full text-left px-3 py-3 border-b border-gray-100 transition ${
                    Number(n.is_read)
                      ? "bg-white hover:bg-rose-50/30"
                      : "bg-gradient-to-r from-rose-50 via-red-50 to-white hover:from-rose-100 hover:to-red-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {!Number(n.is_read) ? (
                        <span className="w-2.5 h-2.5 rounded-full bg-secundario shrink-0 mt-0.5 shadow-sm shadow-secundario/30" />
                      ) : (
                        <span className="w-2.5 h-2.5 rounded-full bg-gray-300 shrink-0 mt-0.5" />
                      )}
                      <p className="text-xs font-bold text-gray-800 truncate">{n.title}</p>
                    </div>
                    <span className="text-[10px] text-gray-500 shrink-0">{formatWhen(n.created_at)}</span>
                  </div>
                  <p className="text-[11px] text-gray-700 mt-1 leading-snug pl-4">{n.message}</p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
