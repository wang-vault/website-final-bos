import { describe,expect,it } from "vitest";
import type { SessionUser } from "@/types";
import { canAccessCustomerResource,hasMinimumRole } from "./authorization";
const user=(id:string,role:SessionUser["role"]):SessionUser=>({id,role,email:`${id}@example.test`,name:id,emailVerified:true});
describe("otorisasi role dan ownership",()=>{
  it("menerapkan hierarki RBAC",()=>{expect(hasMinimumRole("staff","admin")).toBe(false);expect(hasMinimumRole("admin","staff")).toBe(true);expect(hasMinimumRole("owner","owner")).toBe(true)});
  it("membatasi customer ke resource miliknya",()=>{expect(canAccessCustomerResource(user("a","customer"),"a")).toBe(true);expect(canAccessCustomerResource(user("a","customer"),"b")).toBe(false);expect(canAccessCustomerResource(user("admin","admin"),"b")).toBe(true)});
});
