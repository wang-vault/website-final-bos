import { describe,expect,it } from "vitest";
import { priceConfiguration } from "@/lib/pricing";
import { resourceMap } from "@/lib/cms/resources";
import { orderSchema } from "./index";
const base={name:"Budi",whatsapp:"081234567890",email:"budi@example.test",serverName:"Server Budi",note:"",coupon:"",tier:"low" as const,packageId:null,cpu:2,ram:4,storage:20,acceptedPolicy:true as const};
describe("integritas order dan katalog admin",()=>{
  it("mengabaikan harga client dan menghitung subtotal otoritatif",()=>{const parsed=orderSchema.parse({...base,clientPrice:1});expect(parsed.clientPrice).toBe(1);expect(priceConfiguration(parsed).price).toBe(45000)});
  it("menolak field diskon hasil manipulasi",()=>{expect(orderSchema.safeParse({...base,clientDiscount:44999}).success).toBe(false)});
  it("hanya menerima paket admin untuk tier Medium dan status valid",()=>{const valid={id:"medium-2c4g",tier:"medium",name:"Medium 2C4G",cpu:2,ram:4,storage:30,price:150000,status:"available",popular:false};expect(resourceMap.packages.schema.safeParse(valid).success).toBe(true);expect(resourceMap.packages.schema.safeParse({...valid,tier:"high"}).success).toBe(false);expect(resourceMap.packages.schema.safeParse({...valid,status:"unknown"}).success).toBe(false)});
});
