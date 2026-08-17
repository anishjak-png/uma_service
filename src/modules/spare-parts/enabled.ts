/** Spare-parts billing block. Set SPARE_PARTS_ENABLED / NEXT_PUBLIC_SPARE_PARTS_ENABLED to "false" to hide it. */
export function isSparePartsEnabled() {
  const value =
    process.env.NEXT_PUBLIC_SPARE_PARTS_ENABLED ??
    process.env.SPARE_PARTS_ENABLED ??
    "true";
  return value.trim().toLowerCase() !== "false";
}
