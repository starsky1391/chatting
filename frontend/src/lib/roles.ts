export interface RoleLike {
  id?: number;
  name: string;
  position?: number;
}

export interface MemberLike {
  id: number;
  username: string;
  isOnline?: boolean;
  role?: string;
  groupRole?: string;
}

const SYSTEM_ROLE_WEIGHT: Record<string, number> = {
  owner: -10000,
  admin: 100,
  moderator: 200,
  guest: 900,
  member: 1000,
};

export function getMemberRoleName(member: Pick<MemberLike, 'role' | 'groupRole'>) {
  return member.groupRole || member.role || 'member';
}

export function roleLabel(name: string) {
  switch (name) {
    case 'owner':
      return '所有者';
    case 'admin':
      return '管理员';
    case 'moderator':
      return '协管';
    case 'guest':
    case 'member':
      return '嘉宾';
    default:
      return name;
  }
}

export function roleWeight(roleName: string, roles: RoleLike[] = []) {
  if (roleName === 'owner') return SYSTEM_ROLE_WEIGHT.owner;

  const configuredRole = roles.find((role) => role.name === roleName);
  if (configuredRole) {
    return configuredRole.position ?? SYSTEM_ROLE_WEIGHT[roleName] ?? 500;
  }

  return SYSTEM_ROLE_WEIGHT[roleName] ?? 500;
}

export function sortMembersByRole<T extends MemberLike>(members: T[], roles: RoleLike[] = []) {
  return [...members].sort((a, b) => {
    const roleDiff = roleWeight(getMemberRoleName(a), roles) - roleWeight(getMemberRoleName(b), roles);
    if (roleDiff !== 0) return roleDiff;
    const onlineDiff = Number(Boolean(b.isOnline)) - Number(Boolean(a.isOnline));
    if (onlineDiff !== 0) return onlineDiff;
    return a.username.localeCompare(b.username, 'zh-Hans-CN') || a.id - b.id;
  });
}

