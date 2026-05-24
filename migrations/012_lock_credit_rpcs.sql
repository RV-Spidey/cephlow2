-- Security fix: revoke public execute on all credit-mutating RPCs.
-- These functions must only be called by the Express API (service-role key).
-- Without this, any authenticated user can call them directly via supabase.rpc()
-- and drain or inflate any account's credits.

revoke execute on function public.redeem_creator_credits(text, numeric)    from public, authenticated;
revoke execute on function public.refund_creator_credits(text, numeric)    from public, authenticated;
revoke execute on function public.transfer_creator_credits(text, uuid, numeric) from public, authenticated;

-- Sanity-check: service role retains execute (it is not affected by these revokes).
-- The Express API uses the service-role key and will continue to work normally.
