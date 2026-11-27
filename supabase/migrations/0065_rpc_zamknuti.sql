-- 0065: obnov_referencni_ceny je zapisujici funkce – nesmi ji volat anon.
-- PostgREST zverejnuje kazdou funkci spustitelnou danou roli, takze bez revoke
-- by ji kdokoliv mohl opakovane spoustet (zatezova zranitelnost, ne datova).
revoke execute on function public.obnov_referencni_ceny() from public;
revoke execute on function public.obnov_referencni_ceny() from anon;
revoke execute on function public.obnov_referencni_ceny() from authenticated;
grant execute on function public.obnov_referencni_ceny() to service_role;
