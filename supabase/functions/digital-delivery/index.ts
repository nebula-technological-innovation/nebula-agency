import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { zipSync, strToU8 } from "https://esm.sh/fflate@0.8.2";

type KitFile = { name: string; content: string };

const KITS: Record<string, KitFile[]> = {
  "client-handoff-pack": [
    { name: "README.md", content: "# Client Handoff Pack\n\nTransfer a completed project without losing ownership, access, acceptance criteria, or support boundaries.\n" },
    { name: "handoff-checklist.md", content: "# Handoff Checklist\n\n## Ownership\n- [ ] Production owner named\n- [ ] Repository ownership confirmed\n- [ ] Domains/DNS owner confirmed\n- [ ] Billing owner confirmed\n\n## Access\n- [ ] Admin roles reviewed\n- [ ] Shared credentials replaced with named access\n- [ ] Recovery contacts confirmed\n- [ ] Unneeded contractor access revoked\n\n## Operations\n- [ ] Deployment procedure documented\n- [ ] Rollback procedure tested\n- [ ] Monitoring/alerts documented\n- [ ] Backup/restore owner identified\n\n## Acceptance\n- [ ] Deliverables mapped to scope\n- [ ] Known limitations listed\n- [ ] Support window stated\n- [ ] Client acceptance recorded\n" },
    { name: "access-register.csv", content: "system,owner,access_level,recovery_contact,rotation_required,notes\nRepository,,,,,\nHosting,,,,,\nDNS,,,,,\nDatabase,,,,,\nPayments,,,,,\nAnalytics,,,,,\nSupport,,,,,\n" },
    { name: "acceptance-template.md", content: "# Delivery Acceptance\n\nProject:\nClient:\nDelivery date:\n\n## Accepted deliverables\n- \n\n## Known limitations / deferred items\n- \n\n## Support terms\nSupport contact:\nSupport window:\nExcluded work:\n\n## Acceptance\nClient representative:\nDecision: Accepted / Accepted with exceptions / Rejected\nExceptions:\n" },
  ],
  "offer-math-workbook": [
    { name: "README.md", content: "# Offer Math Workbook\n\nModel price, contribution margin, break-even volume, and acquisition-cost ceilings before publishing an offer.\n" },
    { name: "unit-economics.csv", content: "scenario,price,variable_cost,payment_fees,fulfillment_cost,support_cost,contribution_margin,contribution_margin_pct\nBase,0,0,0,0,0,=B2-SUM(C2:F2),=IFERROR(G2/B2,0)\nUpside,0,0,0,0,0,=B3-SUM(C3:F3),=IFERROR(G3/B3,0)\nDownside,0,0,0,0,0,=B4-SUM(C4:F4),=IFERROR(G4/B4,0)\n" },
    { name: "pricing-scenarios.csv", content: "offer,monthly_fixed_cost,target_monthly_profit,contribution_per_sale,break_even_sales,target_sales,max_cac_per_sale\nExample,0,0,0,=IFERROR(B2/D2,0),=IFERROR((B2+C2)/D2,0),0\n" },
    { name: "instructions.md", content: "# Instructions\n\n1. Include direct costs, payment fees, and fulfillment/support time.\n2. Calculate contribution margin before setting a CAC ceiling.\n3. Keep a downside scenario with higher costs and lower conversion.\n4. Do not scale paid acquisition until margin stays positive after refunds/support.\n" },
  ],
  "ship-gate-pack": [
    { name: "README.md", content: "# Ship Gate Pack\n\nRelease controls for deciding whether a change is safe to deploy and how to reverse it.\n" },
    { name: "go-no-go-checklist.md", content: "# Go / No-Go Checklist\n\n## Correctness\n- [ ] Focused tests pass\n- [ ] Critical path manually verified\n- [ ] Migrations reversible or forward-repairable\n\n## Security\n- [ ] No secrets added to source/logs\n- [ ] Auth/RBAC verified\n- [ ] External actions bounded\n\n## Revenue\n- [ ] Price/offer identity reconciled\n- [ ] Payment failure path tested\n- [ ] Fulfillment/provisioning evidence exists\n- [ ] Refund/reversal path defined\n\n## Reliability\n- [ ] Idempotency verified\n- [ ] Observability exists\n- [ ] Rollback owner named\n\nDecision: GO / NO-GO\nApprover:\nEvidence links:\n" },
    { name: "rollback-plan.md", content: "# Rollback Plan\n\nRelease:\nTrigger conditions:\n\n## Immediate rollback\n1.\n2.\n3.\n\n## Data repair\n- \n\n## Validation after rollback\n- [ ] Service health\n- [ ] Customer state\n- [ ] Payment/entitlement state\n- [ ] Error rate\n" },
    { name: "incident-template.md", content: "# Release Incident\n\nStart time:\nDetection source:\nCustomer impact:\nRevenue impact:\n\n## Timeline\n- \n\n## Containment\n- \n\n## Root cause\n- \n\n## Corrective actions\n- \n" },
  ],
  "collections-pack": [
    { name: "README.md", content: "# Collections Pack\n\nRun respectful, documented accounts-receivable follow-up without improvising every overdue invoice.\n" },
    { name: "collections-sop.md", content: "# Collections SOP\n\n1. Confirm invoice, due date, contact, and contract terms.\n2. Day 1 overdue: factual reminder and payment instructions.\n3. Day 7: request status and identify dispute/blocker.\n4. Day 14: escalate internally and offer a documented resolution path.\n5. Day 30+: follow contract/legal policy before service restriction or external collection.\n\nNever threaten actions you are not authorized to take. Record every contact and dispute.\n" },
    { name: "invoice-aging.csv", content: "customer,invoice_id,amount,currency,due_date,days_overdue,status,last_contact,next_action,owner\n,,,,,,,,,\n" },
    { name: "reminder-sequences.md", content: "# Reminder Sequence\n\n## First reminder\nOur records show invoice [ID] for [amount] was due [date]. If payment is already in process, no action is needed. Otherwise, please confirm timing or let us know if there is a billing issue.\n\n## Escalation\nWe have not yet confirmed payment or a billing dispute for invoice [ID]. Please reply with payment timing or the issue preventing payment so we can resolve it.\n" },
    { name: "escalation-matrix.md", content: "# Escalation Matrix\n\n0-6 days: AR owner\n7-13 days: account owner + AR\n14-29 days: finance lead + account owner\n30+ days: finance/legal policy review\n" },
  ],
  "agent-ops-pack": [
    { name: "README.md", content: "# Agent Ops Pack\n\nOperate tool-using AI agents with explicit permissions, evaluation criteria, audit evidence, and incident handling.\n" },
    { name: "agent-runbook.md", content: "# Agent Runbook\n\n## Scope\nAgent purpose:\nAllowed data:\nAllowed tools:\nForbidden actions:\nApproval-required actions:\n\n## Runtime controls\n- [ ] Tenant identity propagated\n- [ ] Tool calls audited\n- [ ] Idempotency keys on external writes\n- [ ] Rate/amount limits\n- [ ] Kill switch\n- [ ] Human escalation path\n" },
    { name: "tool-permissions.md", content: "# Tool Permission Matrix\n\n| Action | Default | Required control |\n|---|---|---|\n| Read internal data | Allow scoped | tenant/RBAC |\n| Create internal task | Allow bounded | audit + idempotency |\n| Send customer email/SMS | Approval/consent | policy + consent |\n| Refund/discount | Approval | amount limit + audit |\n| Move funds | Deny by default | explicit human authorization |\n| Change production infra | Approval | rollback + evidence |\n" },
    { name: "eval-scorecard.csv", content: "run_id,task,success,policy_compliant,tool_errors,human_correction,latency_ms,cost,notes\n,,,,,,,,\n" },
    { name: "incident-playbook.md", content: "# Agent Incident Playbook\n\n1. Disable the affected external-action capability.\n2. Preserve tool-call/audit logs.\n3. Identify affected tenants/actions.\n4. Reverse safe reversible actions.\n5. Notify the internal owner.\n6. Add a regression evaluation before re-enabling.\n" },
  ],
  "review-relay": [
    { name: "README.md", content: "# Review Relay\n\nTransparent customer-feedback workflow. Never suppress negative reviews or condition public-review access on sentiment.\n" },
    { name: "review-relay-sop.md", content: "# Review Relay SOP\n\n1. Ask every eligible customer for feedback using the same neutral request.\n2. Route private support requests to support.\n3. Provide the same public-review option regardless of rating/sentiment.\n4. Escalate safety, fraud, discrimination, or legal complaints to a human.\n5. Track response time and resolution, not only star rating.\n" },
    { name: "response-templates.md", content: "# Response Templates\n\nPositive: Thank you for the feedback. We appreciate the specific note about [detail].\n\nCritical: Thank you for raising this. We want to understand what happened and resolve the underlying issue. Please contact [support channel] with [reference].\n\nDo not ask customers to remove truthful criticism as a condition of support.\n" },
    { name: "feedback-triage.csv", content: "feedback_id,date,channel,topic,severity,owner,status,response_due,resolution\n,,,,,,,,\n" },
    { name: "ethics.md", content: "# Review Integrity Rules\n\n- No review gating.\n- No fabricated reviews.\n- No undisclosed incentives for positive sentiment.\n- Disclose material incentives where required.\n- Preserve complaint records according to retention policy.\n" },
  ],
  "after-hours-kit": [
    { name: "README.md", content: "# After Hours Kit\n\nRouting and escalation framework for inbound customer requests outside normal staffed hours.\n" },
    { name: "after-hours-runbook.md", content: "# After-Hours Runbook\n\n1. Identify customer and requested brand/service.\n2. Classify: routine, urgent business impact, payment dispute, security incident, safety/emergency.\n3. Emergency/safety: direct to appropriate emergency channel; do not improvise.\n4. Security/payment/legal: collect minimum facts and escalate.\n5. Routine: create ticket and provide expected response window.\n" },
    { name: "routing-tree.md", content: "# Routing Tree\n\nRoutine support -> ticket queue\nSales inquiry -> qualified lead queue\nProduction outage -> on-call operations\nSecurity incident -> security escalation\nPayment dispute -> human billing owner\nLegal/regulatory -> human owner\nEmergency/safety -> emergency guidance / human escalation\n" },
    { name: "escalation-matrix.csv", content: "category,severity,first_owner,backup_owner,target_response,auto_reply_allowed\nRoutine,low,Support,Customer Ops,next business day,yes\nOutage,high,Operations,Engineering,15 minutes,yes\nSecurity,critical,Security,Executive,15 minutes,limited\nPayment dispute,high,Billing,Finance,4 hours,limited\nLegal,high,Executive,Legal,4 hours,no\n" },
    { name: "voicemail-scripts.md", content: "# Scripts\n\nGeneral: You have reached [Company] outside staffed hours. Please leave your name, callback information, and a brief description. Do not include passwords or payment-card details.\n\nIncident: State the affected service and impact. Do not include credentials or secrets.\n" },
  ],
  "site-sprint-kit": [
    { name: "README.md", content: "# Site Sprint Kit\n\nPlan and ship a small business website with a bounded page map, content inputs, launch checks, and handoff criteria.\n" },
    { name: "page-map.md", content: "# Page Map\n\n## Home\nPrimary promise:\nPrimary CTA:\nProof:\n\n## Services / Product\nOffer:\nAudience:\nOutcome:\nConstraints:\n\n## About\nCredibility:\n\n## Contact\nRequired fields:\nResponse expectation:\n\nOptional: FAQ, case studies, privacy, terms.\n" },
    { name: "launch-checklist.md", content: "# Launch Checklist\n\n- [ ] Mobile layout reviewed\n- [ ] Forms deliver successfully\n- [ ] Analytics/consent configured\n- [ ] Metadata/title/description set\n- [ ] Canonical domain configured\n- [ ] HTTPS active\n- [ ] Privacy/terms links reviewed\n- [ ] Accessibility basics checked\n- [ ] Backup/rollback path known\n- [ ] Client acceptance recorded\n" },
    { name: "client-intake.md", content: "# Client Intake\n\nBusiness name:\nPrimary audience:\nPrimary offer:\nPrimary CTA:\nTop objections:\nBrand assets available:\nRequired pages:\nIntegrations:\nLaunch deadline:\nDomain/DNS owner:\nLegal/privacy requirements:\n" },
    { name: "prompt-library.md", content: "# Prompt Library\n\n## Homepage draft\nWrite a concise homepage for [business] serving [audience]. Lead with [outcome], avoid unsupported claims, and include one primary CTA: [CTA].\n\n## FAQ\nGenerate FAQs from these real customer objections: [list]. Do not invent policies, guarantees, certifications, or prices.\n\n## QA\nReview this page for unclear claims, missing CTA, accessibility issues, broken assumptions, and unsupported factual statements.\n" },
  ],
};

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function html(sessionId: string, message = ""): Response {
  const safeSession = sessionId.replace(/[^a-zA-Z0-9_\-]/g, "");
  const safeMessage = message.replace(/[<>&]/g, "");
  return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nebula secure delivery</title><style>body{font-family:system-ui;max-width:640px;margin:48px auto;padding:0 20px;background:#050816;color:#fff}input,button{font:inherit;padding:12px;width:100%;box-sizing:border-box;margin:8px 0}button{cursor:pointer}.msg{margin:12px 0;color:#ffd166}small{color:#aaa}</style></head><body><h1>Nebula secure delivery</h1><p>Enter the email address used at Stripe Checkout to unlock your purchased bundle.</p>${safeMessage ? `<p class="msg">${safeMessage}</p>` : ""}<form method="post"><input type="hidden" name="session_id" value="${safeSession}"><label>Email</label><input type="email" name="email" required autocomplete="email"><button type="submit">Download purchased bundle</button></form><small>Never enter passwords or payment-card details here.</small></body></html>`, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const sessionIdFromUrl = url.searchParams.get("session_id") ?? "";
  if (req.method === "GET") return html(sessionIdFromUrl);
  if (req.method !== "POST") return new Response("method_not_allowed", { status: 405 });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) return new Response("delivery_runtime_not_configured", { status: 503 });

  const form = await req.formData();
  const sessionId = String(form.get("session_id") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!sessionId || !email) return html(sessionId, "Session and email are required.");

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: order, error } = await admin
    .from("revenue_orders")
    .select("id,offer_id,offer_kind,fulfillment_status,customer_email_hash")
    .eq("provider", "stripe")
    .eq("provider_source_id", sessionId)
    .maybeSingle();

  if (error) return new Response("delivery_lookup_failed", { status: 500 });
  if (!order) return html(sessionId, "We could not find a completed purchase for this Checkout Session yet. If payment just completed, retry shortly.");
  if (order.offer_kind !== "digital" || order.fulfillment_status !== "delivery_ready") {
    return html(sessionId, "This purchase is not currently eligible for automated digital delivery.");
  }
  if (!order.customer_email_hash || await sha256Hex(email) !== order.customer_email_hash) {
    return html(sessionId, "The email does not match this purchase.");
  }

  const files = KITS[order.offer_id];
  if (!files) return new Response("bundle_not_configured", { status: 503 });

  const zipInput: Record<string, Uint8Array> = {};
  for (const file of files) zipInput[file.name] = strToU8(file.content);
  const zip = zipSync(zipInput, { level: 6 });

  await admin
    .from("revenue_orders")
    .update({ fulfillment_status: "delivered", updated_at: new Date().toISOString() })
    .eq("id", order.id);
  await admin.from("revenue_outbox").insert({
    event_type: "fulfillment.digital_delivered",
    aggregate_type: "revenue_order",
    aggregate_id: order.id,
    payload: { order_id: order.id, sku: order.offer_id },
  });

  return new Response(zip, {
    status: 200,
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${order.offer_id}.zip"`,
      "cache-control": "no-store, private",
    },
  });
});
