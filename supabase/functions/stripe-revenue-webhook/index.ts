import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CanonicalForwardError, forwardCanonicalEntitlement } from "../_shared/canonical-entitlement-forwarder.ts";

const SERVICE_OFFERS = new Set([
  "ai_automation_assessment", "atlas-assessment", "atlas_ai_automation_pilot", "atlas-pilot",
  "b2b_revenue_operations_sprint", "production_safe_security_assessment", "data_integration_analytics_assessment",
  "defensive_security_assessment", "security_assessment", "integration_analytics_assessment",
  "data_integration_assessment", "technical_documentation_sprint", "automation_integration_sprint_deposit",
  "automation_integration_sprint", "strategy_architecture_discovery", "ai-task-sprint", "ai-native-website-launch-sprint",
]);
const DIGITAL_OFFERS = new Set([
  "ai-automation-starter-kit", "client-handoff-pack", "offer-math-workbook", "ship-gate-pack",
  "collections-pack", "agent-ops-pack", "review-relay", "after-hours-kit", "site-sprint-kit",
]);
const OFFER_ALIASES: Record<string,string> = { "ai_native_website_launch_sprint": "ai-native-website-launch-sprint" };
const JSON_HEADERS = { "content-type": "application/json", "cache-control": "no-store" };
const json = (status:number, body:Record<string,unknown>) => new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });

function hexToBytes(hex:string){ if(!/^[0-9a-f]+$/i.test(hex)||hex.length%2) throw new Error("invalid_hex"); const out=new Uint8Array(hex.length/2); for(let i=0;i<out.length;i++) out[i]=Number.parseInt(hex.slice(i*2,i*2+2),16); return out; }
function constantTimeEqualHex(a:string,b:string){ try{const aa=hexToBytes(a),bb=hexToBytes(b); if(aa.length!==bb.length)return false; let d=0; for(let i=0;i<aa.length;i++)d|=aa[i]^bb[i]; return d===0;}catch{return false;} }
async function hmacSha256Hex(secret:string,payload:string){ const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]); const sig=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(payload)); return [...new Uint8Array(sig)].map(b=>b.toString(16).padStart(2,"0")).join(""); }
async function verifyStripeSignature(raw:string,header:string|null,secret:string){ if(!header||!secret)return false; const p=header.split(",").map(x=>x.trim()); const t=p.find(x=>x.startsWith("t=")); const sigs=p.filter(x=>x.startsWith("v1=")).map(x=>x.slice(3)); if(!t||!sigs.length)return false; const ts=Number(t.slice(2)); if(!Number.isFinite(ts)||Math.abs(Math.floor(Date.now()/1000)-ts)>300)return false; const expected=await hmacSha256Hex(secret,`${ts}.${raw}`); return sigs.some(s=>constantTimeEqualHex(s,expected)); }
async function sha256Hex(v:string){ const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v)); return [...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,"0")).join(""); }
function stringId(v:any):string|null{ return typeof v==="string"&&v?v:v&&typeof v.id==="string"?v.id:null; }
function subscriptionIdFromInvoice(i:any){ return stringId(i.subscription)??stringId(i.parent?.subscription_details?.subscription)??stringId(i.lines?.data?.[0]?.subscription); }
function priceFromLine(l:any){ return l?.price??l?.pricing?.price_details?.price??l?.pricing?.price_details??null; }
type SoftwareIdentity={sku:string;tier:string;periodEnd:string|null;providerPriceId:string|null;canonicalPriceId:string|null;fulfillment:string|null};
function softwareIdentityFromInvoice(invoice:any):SoftwareIdentity|null{ for(const line of invoice?.lines?.data??[]){ const price=priceFromLine(line),m=price?.metadata??line?.metadata??{}; const sku=String(m.nebula_sku??"").trim(); if(!sku)continue; const tier=String(m.nebula_tier??"basic").trim()||"basic"; const pe=Number(line?.period?.end); const pid=stringId(price); const lk=typeof price?.lookup_key==="string"?price.lookup_key.trim():""; const cp=String(m.canonical_price_id??lk).trim()||null; const f=String(m.nebula_fulfillment??m.nebula_fulfillment_type??m.fulfillment_type??"").trim()||null; return {sku,tier,periodEnd:Number.isFinite(pe)?new Date(pe*1000).toISOString():null,providerPriceId:pid,canonicalPriceId:cp,fulfillment:f}; } return null; }
function canonicalForwardFailure(error:unknown){ if(error instanceof CanonicalForwardError)return json(503,{error:error.code,retryable:true,upstream_status:error.status}); return json(503,{error:"canonical_entitlement_forward_failed",retryable:true}); }
function canonicalOffer(raw:string){ return OFFER_ALIASES[raw]??raw; }
function checkoutIdentity(m:Record<string,any>){ const ro=canonicalOffer(String(m.commercial_offer_id??m.offer_id??m.offer??m.nebula_offer_id??"").trim()); const rs=canonicalOffer(String(m.sku??m.product_id??"").trim()); if(ro&&SERVICE_OFFERS.has(ro))return{offerId:ro,kind:"service" as const}; if(rs&&DIGITAL_OFFERS.has(rs))return{offerId:rs,kind:"digital" as const}; if(ro&&DIGITAL_OFFERS.has(ro))return{offerId:ro,kind:"digital" as const}; if(rs&&SERVICE_OFFERS.has(rs))return{offerId:rs,kind:"service" as const}; return{offerId:ro||rs||"unknown",kind:"unknown" as const}; }

Deno.serve(async(req:Request)=>{
  if(req.method!=="POST")return json(405,{error:"method_not_allowed"});
  const supabaseUrl=Deno.env.get("SUPABASE_URL"),serviceRole=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); if(!supabaseUrl||!serviceRole)return json(503,{error:"supabase_runtime_not_configured"});
  const admin=createClient(supabaseUrl,serviceRole,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:secret,error:secretError}=await admin.rpc("get_runtime_secret",{p_key:"stripe_webhook_secret"}); if(secretError||typeof secret!=="string"||!secret)return json(503,{error:"webhook_secret_not_configured"});
  const raw=await req.text(); if(!(await verifyStripeSignature(raw,req.headers.get("stripe-signature"),secret)))return json(400,{error:"invalid_signature"});
  let event:any; try{event=JSON.parse(raw)}catch{return json(400,{error:"invalid_json"})} if(event?.livemode!==true)return json(200,{received:true,status:"non_live_ignored"});
  const eventType=String(event?.type??""),obj=event?.data?.object??{};

  if(new Set(["checkout.session.completed","checkout.session.async_payment_succeeded"]).has(eventType)){
    const session=obj; if(session.payment_status!=="paid")return json(200,{received:true,status:"unpaid_ignored"}); if(typeof event.id!=="string"||!event.id||typeof session.id!=="string"||!session.id)return json(400,{error:"missing_provider_identity"});
    const metadata=session.metadata??{},identity=checkoutIdentity(metadata); const fulfillmentStatus=identity.kind==="service"?"intake_required":identity.kind==="digital"?"delivery_ready":"pending_review";
    const email=String(session.customer_details?.email??session.customer_email??"").trim().toLowerCase(),emailHash=email?await sha256Hex(email):null;
    const safeMetadata:Record<string,unknown>={}; for(const key of ["commercial_offering_id","commercial_offer_id","canonical_price_id","entitlement_tier","provider_price_id","offer","offer_id","nebula_offer_id","sku","product_id","product_name","revenue_stream","catalog","mode","payment_stage","payment_role","business_unit","business_owner","fulfillment","fulfillment_type"]) if(metadata[key]!=null)safeMetadata[key]=metadata[key]; safeMetadata.canonical_offer_id=identity.offerId;
    const intakePayload:Record<string,unknown>={}; if(identity.kind==="service"&&Array.isArray(session.custom_fields))for(const field of session.custom_fields){const value=field?.text?.value??field?.numeric?.value??field?.dropdown?.value; if(typeof field?.key==="string"&&field.key&&value!=null)intakePayload[field.key]=value;}
    const amountTotal=Number.isSafeInteger(session.amount_total)&&session.amount_total>=0?session.amount_total:null; const currency=typeof session.currency==="string"&&/^[a-z]{3}$/i.test(session.currency)?session.currency.toLowerCase():null;
    const {data:recorded,error:recordError}=await admin.rpc("record_revenue_checkout",{p_provider:"stripe",p_provider_event_id:event.id,p_provider_source_id:session.id,p_offer_id:identity.offerId,p_offer_kind:identity.kind,p_amount_total:amountTotal,p_currency:currency,p_payment_status:"paid",p_fulfillment_status:fulfillmentStatus,p_customer_email_hash:emailHash,p_metadata:safeMetadata,p_intake_payload:intakePayload});
    if(recordError||!Array.isArray(recorded)||recorded.length!==1)return json(500,{error:"atomic_revenue_persistence_failed"}); const row=recorded[0] as {fulfillment_status?:string;duplicate?:boolean};
    let canonicalForwarding=false, canonicalStatus="not_required";
    if(identity.kind!=="unknown"&&email){ try{ await forwardCanonicalEntitlement(admin,"/internal/payment-events",{event_id:event.id,event_type:eventType,paid:true,customer_email:email,product_id:identity.offerId,product_name:String(metadata.product_name??identity.offerId),tier:String(metadata.entitlement_tier??(identity.kind==="service"?"service":"digital")),fulfillment_type:identity.kind==="service"?"professional_service":"digital_delivery",amount:amountTotal??0,currency:currency??"usd",payment_intent_id:stringId(session.payment_intent),checkout_session_id:session.id,needs_license_key:false,needs_api_key:false,commercial_offering_id:metadata.commercial_offering_id??null,commercial_offer_id:identity.offerId,canonical_price_id:metadata.canonical_price_id??null,entitlement_tier:metadata.entitlement_tier??null,payment_provider:"stripe",provider_price_id:metadata.provider_price_id??null}); canonicalForwarding=true; canonicalStatus="forwarded"; }
      catch(error){ return canonicalForwardFailure(error); }
    } else if(identity.kind!=="unknown"&&!email) canonicalStatus="customer_email_unresolved";
    return json(200,{received:true,verified:true,canonical_forwarding:canonicalForwarding,canonical_status:canonicalStatus,offer_id:identity.offerId,offer_kind:identity.kind,fulfillment_status:row.fulfillment_status??fulfillmentStatus,duplicate:Boolean(row.duplicate)});
  }

  if(eventType==="invoice.paid"){
    const sid=subscriptionIdFromInvoice(obj),identity=softwareIdentityFromInvoice(obj); if(!sid||!identity)return json(200,{received:true,status:"software_identity_unresolved"}); const email=String(obj.customer_email??"").trim().toLowerCase(); if(!email)return json(200,{received:true,status:"customer_email_unresolved"});
    const amount=Number.isSafeInteger(obj.amount_paid)&&obj.amount_paid>=0?obj.amount_paid:Number.isSafeInteger(obj.total)&&obj.total>=0?obj.total:0; const currency=typeof obj.currency==="string"&&/^[a-z]{3}$/i.test(obj.currency)?obj.currency.toLowerCase():"usd"; const needsApiKey=identity.fulfillment==="api_key"||identity.fulfillment==="software_entitlement"||identity.sku.includes("api");
    try{await forwardCanonicalEntitlement(admin,"/internal/payment-events",{event_id:event.id,event_type:eventType,paid:true,customer_email:email,product_id:identity.sku,product_name:identity.sku,tier:identity.tier,fulfillment_type:"software_entitlement",amount,currency,payment_intent_id:stringId(obj.payment_intent),subscription_id:sid,needs_license_key:false,needs_api_key:needsApiKey,canonical_price_id:identity.canonicalPriceId,entitlement_tier:identity.tier,payment_provider:"stripe",provider_price_id:identity.providerPriceId})}catch(error){return canonicalForwardFailure(error)}
    const {data,error}=await admin.rpc("process_software_entitlement_event",{p_event_id:event.id,p_event_type:eventType,p_action:"active",p_subscription_id:sid,p_customer_id:stringId(obj.customer),p_customer_email_hash:await sha256Hex(email),p_product_sku:identity.sku,p_tier:identity.tier,p_period_end:identity.periodEnd}); if(error)return json(500,{error:"entitlement_event_failed"}); return json(200,{received:true,canonical_forwarding:true,entitlement:data?.[0]?.result??"processed",product_sku:identity.sku});
  }
  if(eventType==="invoice.payment_failed"){
    const sid=subscriptionIdFromInvoice(obj); if(!sid)return json(200,{received:true,status:"subscription_unresolved"}); try{await forwardCanonicalEntitlement(admin,"/internal/subscription-events",{event_id:event.id,event_type:eventType,subscription_id:sid,action:"past_due"})}catch(error){return canonicalForwardFailure(error)} const {data,error}=await admin.rpc("process_software_entitlement_event",{p_event_id:event.id,p_event_type:eventType,p_action:"past_due",p_subscription_id:sid}); if(error)return json(500,{error:"entitlement_event_failed"}); return json(200,{received:true,canonical_forwarding:true,entitlement:data?.[0]?.result??"processed",status:"past_due"});
  }
  if(eventType==="customer.subscription.deleted"){
    const sid=stringId(obj.id); if(!sid)return json(400,{error:"subscription_identity_missing"}); try{await forwardCanonicalEntitlement(admin,"/internal/subscription-events",{event_id:event.id,event_type:eventType,subscription_id:sid,action:"cancelled"})}catch(error){return canonicalForwardFailure(error)} const {data,error}=await admin.rpc("process_software_entitlement_event",{p_event_id:event.id,p_event_type:eventType,p_action:"cancelled",p_subscription_id:sid}); if(error)return json(500,{error:"entitlement_event_failed"}); return json(200,{received:true,canonical_forwarding:true,entitlement:data?.[0]?.result??"processed",status:"cancelled"});
  }
  if(eventType==="customer.subscription.updated"){
    const sid=stringId(obj.id),s=String(obj.status??""); const action=s==="past_due"||s==="unpaid"?"past_due":s==="paused"?"paused":s==="canceled"?"cancelled":null; if(!sid||!action)return json(200,{received:true,status:"subscription_update_ignored"}); try{await forwardCanonicalEntitlement(admin,"/internal/subscription-events",{event_id:event.id,event_type:eventType,subscription_id:sid,action})}catch(error){return canonicalForwardFailure(error)} const {data,error}=await admin.rpc("process_software_entitlement_event",{p_event_id:event.id,p_event_type:eventType,p_action:action,p_subscription_id:sid}); if(error)return json(500,{error:"entitlement_event_failed"}); return json(200,{received:true,canonical_forwarding:true,entitlement:data?.[0]?.result??"processed",status:action});
  }
  return json(200,{received:true,status:"event_ignored"});
});
