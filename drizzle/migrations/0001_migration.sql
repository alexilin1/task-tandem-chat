
create policy "attach read" on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and public.is_conv_member(((storage.foldername(name))[1])::uuid));
create policy "attach insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and public.is_conv_member(((storage.foldername(name))[1])::uuid));
