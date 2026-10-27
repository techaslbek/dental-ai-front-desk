-- Same-clinic foreign keys are two-column (x_id, clinic_id); index them as such
-- so cascades and joins don't scan.

drop index public.messages_conversation_idx;
create index messages_conversation_idx on public.messages (conversation_id, clinic_id, created_at);

drop index public.appointment_requests_conversation_idx;
drop index public.appointment_requests_service_idx;
drop index public.appointment_requests_dentist_idx;
create index appointment_requests_conversation_idx on public.appointment_requests (conversation_id, clinic_id);
create index appointment_requests_service_idx on public.appointment_requests (service_id, clinic_id);
create index appointment_requests_dentist_idx on public.appointment_requests (dentist_id, clinic_id);

drop index public.handoffs_conversation_idx;
create index handoffs_conversation_idx on public.handoffs (conversation_id, clinic_id);
