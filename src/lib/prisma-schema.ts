import { Prisma } from "@prisma/client";

const modelFieldsCache = new Map<string, Set<string>>();

function getModelFields(modelName: string): Set<string> {
  let cached = modelFieldsCache.get(modelName);
  if (cached) return cached;

  const model = Prisma.dmmf.datamodel.models.find((m) => m.name === modelName);
  cached = new Set(model?.fields.map((f) => f.name) ?? []);
  modelFieldsCache.set(modelName, cached);
  return cached;
}

export function prismaModelHasField(modelName: string, fieldName: string): boolean {
  return getModelFields(modelName).has(fieldName);
}

export function prismaModelExists(modelName: string): boolean {
  return Prisma.dmmf.datamodel.models.some((m) => m.name === modelName);
}

/** Drop keys that are not on the generated Prisma model (safe pre/post migration). */
export function pickPrismaModelFields<T extends Record<string, unknown>>(
  modelName: string,
  data: T
): Partial<T> {
  const fields = getModelFields(modelName);
  return Object.fromEntries(
    Object.entries(data).filter(([key, value]) => fields.has(key) && value !== undefined)
  ) as Partial<T>;
}

export function buildPrismaSelect(
  modelName: string,
  fields: Record<string, true>
): Record<string, true> {
  const known = getModelFields(modelName);
  return Object.fromEntries(
    Object.entries(fields).filter(([key]) => known.has(key))
  ) as Record<string, true>;
}
