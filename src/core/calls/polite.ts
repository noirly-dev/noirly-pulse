export function politePeer(localUserId: string, remoteUserId: string): boolean {
  return localUserId < remoteUserId;
}
