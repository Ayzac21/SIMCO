import { Link } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  CircleCheckBig,
  FileSearch,
  Landmark,
  ShieldCheck,
  ShoppingCart,
} from "lucide-react";

const flow = [
  {
    phase: "Etapa 1",
    title: "Registro de la solicitud",
    detail: "La URE documenta la requisición con formato institucional y soporte requerido.",
    icon: FileSearch,
  },
  {
    phase: "Etapa 2",
    title: "Validación administrativa",
    detail: "Coordinación y Secretaría verifican procedencia, consistencia y cumplimiento.",
    icon: CircleCheckBig,
  },
  {
    phase: "Etapa 3",
    title: "Gestión institucional de compra",
    detail: "Compras ejecuta cotización, análisis comparativo y seguimiento hasta cierre.",
    icon: ShoppingCart,
  },
];

export default function Hero() {
  return (
    <div className="relative h-[calc(100vh-82px)] overflow-hidden bg-[#f4f1ee]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-[#7a1f32]/12 via-[#7a1f32]/6 to-transparent" />
        <div className="absolute -left-24 top-16 h-72 w-72 rounded-full bg-[#b37c44]/10 blur-3xl" />
        <div className="absolute right-0 top-28 h-80 w-80 rounded-full bg-[#7a1f32]/10 blur-3xl" />
      </div>

      <main className="relative mx-auto h-full w-full max-w-[90rem] px-4 py-2 sm:px-6 md:py-3 lg:px-8">
        <section className="flex h-full w-full flex-col gap-3 rounded-3xl border border-[#7a1f32]/15 bg-white/95 p-4 shadow-[0_16px_40px_rgba(53,24,30,0.1)] sm:p-5">
          <div className="mb-3 inline-flex w-fit items-center gap-2 whitespace-nowrap rounded-full border border-[#7a1f32]/20 bg-[#7a1f32]/5 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7a1f32]">
            <Landmark size={14} />
            Sistema Institucional CUAltos
          </div>

          <h1
            className="text-3xl font-extrabold leading-tight text-[#2f2a29] sm:text-4xl lg:text-5xl"
            style={{ fontFamily: "Georgia, Cambria, 'Times New Roman', serif" }}
          >
            Plataforma oficial para{" "}
            <span className="text-[#7a1f32]">requisiciones</span> y gestión de{" "}
            <span className="text-[#9d3e54]">compras universitarias</span>
          </h1>

          <p className="mt-2 inline-flex w-fit rounded-lg border border-[#7a1f32]/20 bg-[#7a1f32]/5 px-2.5 py-1 text-xs font-semibold text-[#7a1f32]">
            SIMCO: Sistema Institucional para la Gestión y Control de Compras.
          </p>

          <p
            className="mt-2 max-w-4xl text-sm leading-relaxed text-[#4f4744] sm:text-base"
            style={{ fontFamily: "Georgia, Cambria, 'Times New Roman', serif" }}
          >
            Centraliza el flujo completo de requisiciones, desde el registro y la validación administrativa hasta la
            gestión de compra, con trazabilidad por estatus y control documental en una sola plataforma institucional.
          </p>

          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-[#7a1f32]/10 bg-[#faf6f4] p-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6f6461]">Ámbito</p>
              <p className="mt-1 text-sm font-bold text-[#2f2a29]">Centro Universitario de los Altos</p>
            </div>
            <div className="rounded-xl border border-[#7a1f32]/10 bg-[#faf6f4] p-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6f6461]">Institución</p>
              <p className="mt-1 text-sm font-bold text-[#2f2a29]">Universidad de Guadalajara</p>
            </div>
            <div className="rounded-xl border border-[#7a1f32]/10 bg-[#faf6f4] p-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6f6461]">Cobertura</p>
              <p className="mt-1 text-sm font-bold text-[#2f2a29]">Flujo completo de requisición a compra</p>
            </div>
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {flow.map((step) => {
              const Icon = step.icon;
              return (
                <article
                  key={step.title}
                  className="flex items-start gap-2 rounded-xl border border-[#e8dfdb] bg-white p-3 transition hover:border-[#7a1f32]/30"
                >
                  <div className="mt-0.5 rounded-lg bg-[#7a1f32]/10 p-1.5 text-[#7a1f32]">
                    <Icon size={14} />
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7a1f32]/75">
                      {step.phase}
                    </p>
                    <h3 className="text-sm font-bold text-[#2f2a29]">{step.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-[#5b5451]">{step.detail}</p>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="mt-3 rounded-2xl border border-[#d9cbc6] bg-[#fbf9f8] p-3 sm:p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[#7a1f32]">
                  <Building2 size={14} />
                  Acceso institucional
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-[#514947]">
                  Ingreso para personal autorizado con permisos por perfil y trazabilidad de acciones por estatus.
                </p>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs text-[#4f4744]">
                  <span className="rounded-full border border-[#e5d6d1] bg-white px-2 py-0.5">Unidades</span>
                  <span className="rounded-full border border-[#e5d6d1] bg-white px-2 py-0.5">Coordinación</span>
                  <span className="rounded-full border border-[#e5d6d1] bg-white px-2 py-0.5">Secretaría</span>
                  <span className="rounded-full border border-[#e5d6d1] bg-white px-2 py-0.5">Compras</span>
                </div>
              </div>

              <div className="md:pl-4 md:border-l md:border-[#e6d8d3]">
                <div className="mb-2 flex items-start gap-2 rounded-xl border border-[#7a1f32]/15 bg-[#faf6f4] p-2.5">
                  <ShieldCheck size={14} className="mt-0.5 shrink-0 text-[#7a1f32]" />
                  <p className="text-xs leading-relaxed text-[#5a4f4d]">
                    El acceso es institucional y exclusivo.
                  </p>
                </div>
                <Link
                  to="/login"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#7a1f32] px-4 py-2.5 text-base font-bold text-white transition hover:bg-[#651a2a]"
                >
                  Acceder al sistema
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
