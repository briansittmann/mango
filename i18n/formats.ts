export const currencyFormatOptions = {
  style: "currency",
  trailingZeroDisplay: "stripIfInteger",
  useGrouping: "always",
  // `€`, `$`, `£`: never a three-letter code (`ARS` → `$`, `USD` → `$`).
  currencyDisplay: "narrowSymbol",
} as const;

export const compactFormatOptions = {
  notation: "compact",
} as const;
