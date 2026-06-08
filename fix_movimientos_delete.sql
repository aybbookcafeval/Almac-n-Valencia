-- Add delete policy for movimientos
CREATE POLICY "Admins can delete movimientos" 
ON public.movimientos 
FOR DELETE 
TO authenticated 
USING (public.is_admin());
