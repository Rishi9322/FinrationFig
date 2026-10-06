-- Also record server-side AI call timings (no prompt or reply content).
alter table public.client_events drop constraint client_events_kind_check;
alter table public.client_events add constraint client_events_kind_check
  check (kind in ('cma_upload_start', 'cma_upload_end', 'ai_chat'));
