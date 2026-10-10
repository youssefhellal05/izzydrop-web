-- IzzyDrop policy implementation stage 1:
-- Dropshipper payout destination storage. This does NOT send money or alter settlements.
-- Restrict the existing supplier destination table to least-privilege access.
-- RLS already limits access to the supplier owner and IzzyDrop administrators.
REVOKE ALL ON TABLE public.supplier_payout_details FROM anon, PUBLIC;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.supplier_payout_details FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.supplier_payout_details TO authenticated;

CREATE TABLE IF NOT EXISTS public.dropshipper_payout_details (
  dropshipper_id uuid PRIMARY KEY REFERENCES public.dropshippers(id) ON DELETE CASCADE,
  payout_method text NOT NULL CHECK (payout_method IN ('instapay','bank_transfer','mobile_wallet')),
  payout_details jsonb NOT NULL CHECK (
    jsonb_typeof(payout_details) = 'object'
    AND octet_length(payout_details::text) <= 2048
    AND coalesce(jsonb_typeof(payout_details -> 'beneficiary_name'), '') = 'string'
    AND length(btrim(coalesce(payout_details ->> 'beneficiary_name', ''))) BETWEEN 1 AND 120
    AND coalesce(jsonb_typeof(payout_details -> 'destination'), '') = 'string'
    AND length(btrim(coalesce(payout_details ->> 'destination', ''))) BETWEEN 1 AND 120
    AND (
      payout_method <> 'bank_transfer'
      OR (coalesce(jsonb_typeof(payout_details -> 'bank_name'), '') = 'string'
          AND length(btrim(coalesce(payout_details ->> 'bank_name', ''))) BETWEEN 1 AND 120)
    )
  ),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.dropshipper_payout_details ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dropshipper_payout_details FROM anon, PUBLIC;
REVOKE ALL ON public.dropshipper_payout_details FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.dropshipper_payout_details TO authenticated;
CREATE POLICY "dropshipper_payout_owner_read"
  ON public.dropshipper_payout_details FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.dropshippers d
    WHERE d.id = dropshipper_id AND d.profile_id = auth.uid()
  ));
CREATE POLICY "dropshipper_payout_owner_insert"
  ON public.dropshipper_payout_details FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.dropshippers d
    WHERE d.id = dropshipper_id AND d.profile_id = auth.uid()
  ));
CREATE POLICY "dropshipper_payout_owner_update"
  ON public.dropshipper_payout_details FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.dropshippers d
    WHERE d.id = dropshipper_id AND d.profile_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.dropshippers d
    WHERE d.id = dropshipper_id AND d.profile_id = auth.uid()
  ));
CREATE POLICY "dropshipper_payout_admin_read"
  ON public.dropshipper_payout_details FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));
COMMENT ON TABLE public.dropshipper_payout_details
  IS 'Private beneficiary instructions; no automated transfer; read by owner or admin only.';
