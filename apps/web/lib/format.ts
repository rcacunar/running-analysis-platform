export function fmt(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return "n/d";
  return value.toFixed(digits);
}

export function statusLabel(status: string) {
  switch (status) {
    case "completed":
      return "Completada";
    case "processing":
      return "Procesando";
    case "failed":
      return "Falló";
    case "pending":
      return "Pendiente";
    default:
      return status;
  }
}
