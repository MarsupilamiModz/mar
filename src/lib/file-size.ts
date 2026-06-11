export function fileSizeNumber(size: bigint | number | null | undefined): number {
  if (size == null) return 0;
  return typeof size === "bigint" ? Number(size) : size;
}

export function fileSizeBigInt(size: number | bigint): bigint {
  return typeof size === "bigint" ? size : BigInt(Math.floor(size));
}

export function formatBytes(bytes: bigint | number): string {
  const n = fileSizeNumber(bytes);
  if (n === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(k)), sizes.length - 1);
  return `${parseFloat((n / k ** i).toFixed(i > 1 ? 1 : 0))} ${sizes[i]}`;
}
