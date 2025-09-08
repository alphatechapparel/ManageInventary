
export function transformGenderSKU(sku) {
  const parts = sku.split('-');
  if (parts.length < 2) {
    throw new Error(`Invalid SKU format: ${sku} (must have at least two parts)`);
  }
  const gender = parts[parts.length - 1];
  if (gender !== 'M' && gender !== 'W') {
    throw new Error(`Invalid gender in SKU: ${sku} (last part must be M or W)`);
  }
  const newGender = gender === 'M' ? 'W' : 'M';
  parts[parts.length - 1] = newGender;
  return parts.join('-');
}
