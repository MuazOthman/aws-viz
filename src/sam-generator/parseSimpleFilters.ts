export function parseSimpleFilters(s: string): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  if (s) {
    const pairs = s.split(/[\n\r,]/g);
    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i];
      const parts = pair.split('=');
      if (parts.length === 2) {
        result[parts[0].trim()] = [parts[1].replace(/\"/g, '').trim()];
      }
    }
  }
  return result;
}
