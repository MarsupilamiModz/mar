"use client";

import { useEffect, useState } from "react";
import { slugify } from "@/lib/slug";

/** Keeps slug in sync with name until the user edits slug manually. */
export function useSlugField(name: string, initialSlug = "") {
  const [slug, setSlugState] = useState(initialSlug);
  const [manual, setManual] = useState(Boolean(initialSlug));

  useEffect(() => {
    if (!manual) setSlugState(slugify(name));
  }, [name, manual]);

  const setSlug = (value: string) => {
    setManual(true);
    setSlugState(value);
  };

  const resetFromName = () => {
    setManual(false);
    setSlugState(slugify(name));
  };

  return { slug, setSlug, resetFromName, isManual: manual };
}
