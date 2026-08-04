import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/server-auth";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request:Request){const auth=await requireApiProfile(request);if("error"in auth)return auth.error;const path=new URL(request.url).searchParams.get("path");if(!path)return NextResponse.json({error:"Brak pliku."},{status:400});const{data,error}=await auth.supabaseAdmin.storage.from("contract-files").createSignedUrl(path,300);if(error)return NextResponse.json({error:error.message},{status:400});return NextResponse.json({url:data.signedUrl});}

export async function POST(request: Request) {
  const auth = await requireApiProfile(request); if ("error" in auth) return auth.error;
  const body = await request.json() as Record<string, unknown>;
  const action = String(body.action || "");
  const leadId = String(body.lead_id || "");
  const contractId = String(body.contract_id || "");
  const kind = String(body.kind || "");
  const fileName = String(body.file_name || "");
  const mime = String(body.mime || "application/octet-stream");
  const size = Number(body.size || 0);
  if (!leadId || !contractId || !fileName || !["contract_pdf","photo","video"].includes(kind)) return NextResponse.json({error:"Niepoprawny plik."},{status:400});
  const limits:Record<string,number>={contract_pdf:25,photo:15,video:200};
  if(!Number.isFinite(size)||size<=0||size>limits[kind]*1024*1024)return NextResponse.json({error:`Plik przekracza limit ${limits[kind]} MB albo jest pusty.`},{status:400});
  if(kind==="contract_pdf"&&mime!=="application/pdf")return NextResponse.json({error:"Umowa musi być plikiem PDF."},{status:400});
  if(kind==="photo"&&!mime.startsWith("image/"))return NextResponse.json({error:"Wybierz zdjęcie."},{status:400});
  if(kind==="video"&&!mime.startsWith("video/"))return NextResponse.json({error:"Wybierz plik wideo."},{status:400});
  const [{data:lead},{data:contract}]=await Promise.all([
    auth.supabaseAdmin.from("leads").select("id").eq("id",leadId).eq("crm_environment",auth.profile.crm_environment).single(),
    auth.supabaseAdmin.from("contracts").select("id,lead_id,created_by,process_status").eq("id",contractId).eq("lead_id",leadId).eq("crm_environment",auth.profile.crm_environment).maybeSingle()
  ]);
  if(!lead)return NextResponse.json({error:"Brak dostępu."},{status:403});
  if(contract&&auth.profile.role==="handlowiec"&&contract.created_by!==auth.profile.id)return NextResponse.json({error:"Brak dostępu do tej umowy."},{status:403});

  await auth.supabaseAdmin.storage.createBucket("contract-files",{public:false,fileSizeLimit:209715200}).catch(()=>null);
  const prefix=`${auth.profile.crm_environment}/${leadId}/`;
  if(action==="prepare"){
    const path=`${prefix}${crypto.randomUUID()}-${fileName.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
    const {data,error}=await auth.supabaseAdmin.storage.from("contract-files").createSignedUploadUrl(path);
    if(error)return NextResponse.json({error:error.message},{status:400});
    return NextResponse.json({path,token:data.token});
  }
  if(action!=="finalize")return NextResponse.json({error:"Niepoprawna operacja przesyłania."},{status:400});
  const path=String(body.path||"");
  if(!path.startsWith(prefix))return NextResponse.json({error:"Niepoprawna ścieżka pliku."},{status:400});
  const record={id:crypto.randomUUID(),name:fileName,kind,path,mime,size,created_at:new Date().toISOString()};
  const historyResult=await auth.supabaseAdmin.from("lead_history").insert({lead_id:leadId,user_id:auth.profile.id,action_type:"contract_file",description:`Dodano załącznik: ${fileName}`,new_value:record});
  const fileResult=contract?await auth.supabaseAdmin.from("contract_files").insert({id:record.id,contract_id:contractId,uploaded_by:auth.profile.id,kind,file_name:fileName,file_path:path,mime_type:mime,file_size:size}):{error:null};
  if(historyResult.error&&fileResult.error){await auth.supabaseAdmin.storage.from("contract-files").remove([path]);return NextResponse.json({error:"Nie udało się zapisać informacji o załączniku."},{status:400});}
  const {data:history}=await auth.supabaseAdmin.from("lead_history").select("action_type,new_value").eq("lead_id",leadId).in("action_type",["contract_file","contract_record"]).order("created_at",{ascending:false});
  const kinds=new Set((history||[]).filter(row=>row.action_type==="contract_file").map(row=>String(row.new_value?.kind||"")));
  const current=(history||[]).find(row=>row.action_type==="contract_record")?.new_value as Record<string,unknown>|undefined;
  if(contract&&kinds.has("contract_pdf")&&kinds.has("photo")&&contract.process_status==="incomplete")await auth.supabaseAdmin.from("contracts").update({process_status:"verification",is_process_visible:true,updated_at:new Date().toISOString()}).eq("id",contractId);
  if(current&&kinds.has("contract_pdf")&&kinds.has("photo")&&current.process_status==="incomplete")await auth.supabaseAdmin.from("lead_history").insert({lead_id:leadId,user_id:auth.profile.id,action_type:"contract_record",description:"Umowa kompletna — przekazana do weryfikacji.",new_value:{...current,process_status:"verification",is_process_visible:true}});
  return NextResponse.json({file:record});
}
