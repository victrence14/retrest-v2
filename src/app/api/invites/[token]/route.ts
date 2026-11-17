import { getDb, demoEnabled } from "@/lib/db";
import { trustedMutation } from "@/lib/session";
import { jsonBody } from "@/lib/api";
import { money } from "@/lib/format";
import type { Currency } from "@/lib/types";

export async function POST(request:Request,context:{params:Promise<{token:string}>}) {
  if(!demoEnabled()||!trustedMutation(request))return Response.json({error:"Demo contributions unavailable"},{status:403});
  const {token}=await context.params;const body=await jsonBody(request);
  if(!body||typeof body.email!=="string")return Response.json({error:"Enter your invited email"},{status:400});
  const db=getDb();db.exec("BEGIN IMMEDIATE");
  try{
    const member=db.prepare("SELECT m.*,p.currency FROM pool_members m JOIN split_pools p ON p.id=m.pool_id WHERE p.invite_token=? AND m.email=?").get(token,body.email.trim().toLowerCase());
    if(!member){db.exec("ROLLBACK");return Response.json({error:"This email is not on the invite list. Ask your host to check the address."},{status:404});}
    if(member.payment_status==="PAID"){db.exec("COMMIT");return Response.json({message:"You’re all paid up. Your contribution is already in the pool."});}
    if(member.user_id){
      const column=member.currency==="USD"?"usd_balance":"ngn_balance";
      const changed=db.prepare(`UPDATE users SET ${column}=${column}-? WHERE id=? AND ${column}>=?`).run(Number(member.share_amount),String(member.user_id),Number(member.share_amount));
      if(!changed.changes){db.exec("ROLLBACK");return Response.json({error:"Your demo wallet has insufficient funds."},{status:400});}
    }
    db.prepare("UPDATE pool_members SET payment_status='PAID',auto_debit_scheduled=0 WHERE id=?").run(String(member.id));
    db.prepare("UPDATE split_pools SET pool_balance=pool_balance+?,status='ACTIVE' WHERE id=?").run(Number(member.share_amount),String(member.pool_id));
    db.exec("COMMIT");return Response.json({message:`Your ${money(Number(member.share_amount),member.currency as Currency)} demo contribution is in. You’re good to go.`});
  }catch{db.exec("ROLLBACK");return Response.json({error:"Could not settle contribution"},{status:500});}
}
