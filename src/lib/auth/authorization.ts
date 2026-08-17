import type { Role,SessionUser } from "@/types";
const roleRank:Record<Role,number>={customer:0,staff:1,admin:2,owner:3};
export function hasMinimumRole(role:Role,minimum:Exclude<Role,"customer">):boolean{return roleRank[role]>=roleRank[minimum]}
export function canAccessCustomerResource(user:SessionUser,customerId:string|null):boolean{return user.role!=="customer"||customerId===user.id}
