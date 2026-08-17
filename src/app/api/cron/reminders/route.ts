import { handleApiError,fail,ok } from "@/lib/api";
import { runServiceReminders } from "@/lib/db/repository";
async function run(request:Request){try{const secret=process.env.CRON_SECRET;if(!secret||request.headers.get("authorization")!==`Bearer ${secret}`)return fail("FORBIDDEN","Kredensial penjadwal tidak valid.",403);return ok(await runServiceReminders())}catch(error){return handleApiError(error)}}
export const GET=run;export const POST=run;
export const dynamic="force-dynamic";
