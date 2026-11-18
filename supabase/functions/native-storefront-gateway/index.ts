import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ALLOWED_ORIGIN = "https://youssefhellal05.github.io";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "content-type, apikey, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin"
};

function json(body: unknown, status = 200, extra: Record<string,string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type":"application/json", "Cache-Control":"no-store", ...extra }
  });
}

async function rpc(name: string, args: Record<string, unknown>) {
  const response = await fetch(SUPABASE_URL + "/rest/v1/rpc/" + name, {
    method:"POST",
    headers:{apikey:SERVICE_KEY,Authorization:"Bearer "+SERVICE_KEY,"Content-Type":"application/json"},
    body:JSON.stringify(args),
    redirect:"error",
    signal:AbortSignal.timeout(12000)
  });
  const raw=await response.text();
  let data: any=null;
  try{data=raw?JSON.parse(raw):null}catch{data=raw}
  if(!response.ok)throw new Error(String(data?.message||data?.error||data||"Checkout request failed"));
  return data;
}

async function fingerprint(req: Request) {
  const forwarded=(req.headers.get("x-forwarded-for")||"").split(",")[0].trim();
  const network=req.headers.get("cf-connecting-ip")||req.headers.get("x-real-ip")||forwarded||"unknown";
  const agent=req.headers.get("user-agent")||"";
  const bytes=new TextEncoder().encode(network+"|"+agent);
  const digest=await crypto.subtle.digest("SHA-256",bytes);
  return Array.from(new Uint8Array(digest)).map(v=>v.toString(16).padStart(2,"0")).join("");
}

function validMapUrl(value: unknown): string|null {
  const raw=String(value??"").trim();
  if(!raw)return null;
  try{
    const url=new URL(raw);
    if(url.protocol!=="https:")return null;
    const host=url.hostname.toLowerCase();
    if(host==="maps.app.goo.gl"||host==="maps.google.com"||host.endsWith(".google.com")&&url.pathname.startsWith("/maps"))return url.href;
  }catch{}
  return null;
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS"){
    const origin=req.headers.get("origin")||"";
    if(origin!==ALLOWED_ORIGIN)return new Response(null,{status:403});
    return new Response(null,{status:204,headers:corsHeaders});
  }
  const origin=req.headers.get("origin")||"";
  if(origin!==ALLOWED_ORIGIN)return json({error:"This checkout request did not come from the published IzzyDrop storefront."},403);
  if(req.method!=="POST")return json({error:"Method not allowed."},405);
  if(!SUPABASE_URL||!SERVICE_KEY)return json({error:"Checkout is not configured yet. Please try again later."},503);

  let body: any;
  try{body=await req.json()}catch{return json({error:"Invalid order request."},400)}
  if(body&&String(body.website||"").trim())return json({ok:true},200);

  const slug=String(body?.slug||"").trim().toLowerCase();
  const variantId=String(body?.variant_id||"").trim();
  const quantity=Number(body?.quantity??1);
  const customerName=String(body?.customer_name||"").trim();
  const customerPhone=String(body?.customer_phone||"").trim();
  const customerEmail=String(body?.customer_email||"").trim();
  const address1=String(body?.address1||"").trim();
  const city=String(body?.city||"").trim();
  const governorate=String(body?.governorate||"").trim();
  const mapUrl=validMapUrl(body?.map_url);
  const key=String(body?.idempotency_key||"").trim();

  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length>100)return json({error:"Invalid store link."},400);
  if(!/^[0-9a-f-]{36}$/i.test(variantId))return json({error:"Choose an available product option."},400);
  if(!Number.isInteger(quantity)||quantity<1||quantity>50)return json({error:"Quantity must be from 1 to 50."},400);
  if(customerName.length<2||customerName.length>120||customerPhone.replace(/[^0-9+]/g,"").length<8||customerPhone.length>40)return json({error:"Enter your name and a valid phone number."},400);
  if(customerEmail.length>254)return json({error:"Email address is too long."},400);
  if(address1.length<3||address1.length>500||city.length<2||city.length>120||governorate.length<2||governorate.length>80)return json({error:"Enter your complete delivery address."},400);
  if(governorate.toLowerCase()!=="cairo"&&governorate!=="القاهرة")return json({error:"Delivery is currently available in Cairo only."},400);
  if(body?.map_url&&!mapUrl)return json({error:"Enter a valid Google Maps link or leave it blank."},400);
  if(!/^[0-9a-f-]{36}$/i.test(key))return json({error:"Refresh the checkout and try again."},400);

  try{
    const store=await rpc("public_dropshipper_store_by_slug",{_slug:slug});
    if(!store?.store?.id)return json({error:"This store is not available for ordering."},404);
    const limit=await rpc("storefront_check_rate_limit",{_token:store.store.id,_client_hash:await fingerprint(req)});
    if(limit?.allowed!==true){
      const seconds=Math.max(1,Number(limit?.retry_after_seconds||60));
      return json({error:"Too many order attempts. Please wait and try again."},429,{"Retry-After":String(seconds)});
    }
    const result=await rpc("native_storefront_create_order",{
      _slug:slug,_variant_id:variantId,_quantity:quantity,
      _customer_name:customerName,_customer_phone:customerPhone,
      _customer_email:customerEmail||null,
      _shipping_address:{address1,city,governorate,map_url:mapUrl},
      _idempotency_key:key
    });
    return json({ok:true,...result},200);
  }catch(error){
    const message=error instanceof Error?error.message:"Could not place this order.";
    const status=/not available|not configured|not enough stock|Cairo|delivery address|selling price|product option/i.test(message)?409:400;
    return json({error:message},status);
  }
});