export function prismaErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "code" in err) {
    const code = String((err as { code: string }).code);
    if (code === "P2002") return "A record with this value already exists";
    if (code === "P2025") return "Record not found";
    if (code === "P2003") return "Related record not found";
  }
  if (err instanceof Error) return err.message;
  return "An unexpected error occurred";
}
