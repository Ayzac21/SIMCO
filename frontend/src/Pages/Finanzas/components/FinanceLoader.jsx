export default function FinanceLoader({ label = "Cargando..." }) {
  return (
    <div className="flex w-full flex-col items-center justify-center gap-4 py-10">
      <div className="flex h-20 w-20 animate-spin items-center justify-center rounded-full border-4 border-transparent border-t-secundario text-4xl text-secundario">
        <div className="flex h-16 w-16 animate-spin items-center justify-center rounded-full border-4 border-transparent border-t-principal text-2xl text-principal" />
      </div>
      <div className="mt-2 text-xs text-gray-500">{label}</div>
    </div>
  );
}
