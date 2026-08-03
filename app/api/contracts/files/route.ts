import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/server-auth";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request:Request){const auth=await requireApiProfile(request);if("error"in auth)return auth.error;const path=new URL(request.url).searchParams.get("path");if(!path)return NextResponse.json({error:"Brak pliku."},{status:400});const{data,error}=await auth.supabaseAdmin.storage.from("contract-files").createSignedUrl(path,300);if(error)return NextResponse.json({error:error.message},{status:400});return NextResponse.json({url:data.signedUrl});}

export async function POST(request: Request) {
  const auth = await requireApiProfile(request); if ("error" in auth) return auth.error;
  const form = await request.formData(); const file = form.get("file"); const leadId = String(form.get("lead_id") || ""); const kind = String(form.get("kind") || "");
  if (!(file instanceof File) || !leadId || !["contract_pdf","photo","video"].includes(kind)) return NextResponse.json({error:"Niepoprawny plik."},{status:400});
  const limits:Record<string,number>={contract_pdf:25,photo:15,video:200};
  if(file.size>limits[kind]*1024*1024)return NextResponse.json({error:`Plik przekracza limit ${limits[kind]} MB.`},{status:400});
  if(kind==="contract_pdf"&&file.type!=="application/pdf")return NextResponse.json({error:"Umowa musi być plikiem PDF."},{status:400});
  if(kind==="photo"&&!file.type.startsWith("image/"))return NextResponse.json({error:"Wybierz zdjęcie."},{status:400});
  if(kind==="video"&&!file.type.startsWith("video/"))return NextResponse.json({error:"Wybierz plik wideo."},{status:400});
  const {data:lead}=await auth.supabaseAdmin.from("leads").select("id").eq("id",leadId).eq("crm_environment",auth.profile.crm_environment).single();if(!lead)return NextResponse.json({error:"Brak dostępu."},{status:403});
  await auth.supabaseAdmin.storage.createBucket("contract-files",{public:false,fileSizeLimit:209715200}).catch(()=>null);
  const path=`${auth.profile.crm_environment}/${leadId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
  const {error}=await auth.supabaseAdmin.storage.from("contract-files").upload(path,Buffer.from(await file.arrayBuffer()),{contentType:file.type});if(error)return NextResponse.json({error:error.message},{status:400});
  const record={id:crypto.randomUUID(),name:file.name,kind,path,mime:file.type,size:file.size};
  await auth.supabaseAdmin.from("lead_history").insert({lead_id:leadId,user_id:auth.profile.id,action_type:"contract_file",description:`Dodano załącznik: ${file.name}`,new_value:record});
  const {data:history}=await auth.supabaseAdmin.from("lead_history").select("action_type,new_value").eq("lead_id",leadId).in("action_type",["contract_file","contract_record"]).order("created_at",{ascending:false});
  const kinds=new Set((history||[]).filter(row=>row.action_type==="contract_file").map(row=>String(row.new_value?.kind||"")));
  const current=(history||[]).find(row=>row.action_type==="contract_record")?.new_value as Record<string,unknown>|undefined;
  if(current&&kinds.has("contract_pdf")&&kinds.has("photo")&&current.process_status==="incomplete")await auth.supabaseAdmin.from("lead_history").insert({lead_id:leadId,user_id:auth.profile.id,action_type:"contract_record",description:"Umowa kompletna — przekazana do weryfikacji.",new_value:{...current,process_status:"verification",is_process_visible:true}});
  return NextResponse.json({file:record});
}
