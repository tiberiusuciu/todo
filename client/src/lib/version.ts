export function parseVersion(v: string): [number, number, number] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(v.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function isClientOutdated(client: string, server: string): boolean {
  const clientParts = parseVersion(client);
  const serverParts = parseVersion(server);
  if (!clientParts || !serverParts) return false;

  for (let i = 0; i < 3; i++) {
    if (serverParts[i] > clientParts[i]) return true;
    if (serverParts[i] < clientParts[i]) return false;
  }

  return false;
}
