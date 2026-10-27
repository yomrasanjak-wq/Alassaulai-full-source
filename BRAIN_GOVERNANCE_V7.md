# ALASSAUL-AI Brain Governance — V7

## Changes in this iteration
- Added an owner-only `brain.reviewProposal` route. It requires the configured `OWNER_OPEN_ID` identity and records approve/reject decisions with a note, reviewer identity, and timestamp.
- Approval records a review decision only. It does not execute commands, publish deployments, delete data, or change security settings.
- Tightened the public Control Room submission route: public callers are always recorded as `visitor`; they cannot claim to be the AI/system or a partner by supplying a requester type.
- Added regression tests for public approval denial and prevention of public callers spoofing their requester type.

## Security behavior
- Owner-only review fails closed if `OWNER_OPEN_ID` is not configured or does not match the signed-in user's stable `openId`.
- Admins may prepare proposals, but only the configured owner can record an approval/rejection decision.
- Proposal approval is not an execution authorization; future execution actions need separate allowlisted handlers, audit logging, and confirmation boundaries.

## Verification status
- Source changes and regression test added.
- A TypeScript compiler pass was attempted in this environment, but project dependencies are absent. The compiler reported missing modules/types, so full typecheck, unit tests, and build are not claimed as passed.

## إضافات تشخيص مسار الرد — V8
- تحسين استخراج النص من Responses API: إذا أعاد الوسيط `output_text` فارغاً مع وجود النص داخل `output[].content[]`، يستخرج الرد الداخلي بدلاً من إرجاع إجابة فارغة.
- ضمان تنظيف مؤقّت طلب الشبكة حتى عند فشل `fetch`، مع الحفاظ على مهلة الإلغاء حتى لو أضيفت إشارة إلغاء من المستدعي لاحقاً.
- إضافة اختبار نقل مستقل لـ Responses API يتحقق من عنوان البوابة، وبنية الطلب، واستخراج الرد الداخلي والاستخدام.
- الاختبار أُضيف إلى المصدر، لكن لم يُشغّل بسبب عدم توافر اعتماديات المشروع في بيئة العمل؛ لا يُدّعى نجاح البناء أو الاختبارات الكاملة.
