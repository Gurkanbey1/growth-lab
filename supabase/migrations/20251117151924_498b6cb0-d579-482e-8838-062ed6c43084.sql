-- Add UPDATE policy for project_payments
CREATE POLICY "Authenticated users can update project payments"
ON public.project_payments
FOR UPDATE
USING (true);

-- Add function to check upcoming domain expirations
CREATE OR REPLACE FUNCTION public.get_upcoming_domain_expirations(days_ahead integer DEFAULT 30)
RETURNS TABLE (
  domain_id uuid,
  domain_name text,
  expire_date date,
  days_until_expiry integer,
  company_id uuid,
  company_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    d.id as domain_id,
    d.domain_name,
    d.expire_date,
    (d.expire_date - CURRENT_DATE) as days_until_expiry,
    c.id as company_id,
    c.name as company_name
  FROM domains d
  LEFT JOIN companies c ON d.company_id = c.id
  WHERE d.expire_date BETWEEN CURRENT_DATE AND CURRENT_DATE + days_ahead
  ORDER BY d.expire_date ASC;
$$;

-- Add function to get projects with remaining debt
CREATE OR REPLACE FUNCTION public.get_projects_with_debt()
RETURNS TABLE (
  project_id uuid,
  project_name text,
  remaining_amount numeric,
  company_id uuid,
  company_name text,
  company_email text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id as project_id,
    p.name as project_name,
    p.remaining_amount,
    c.id as company_id,
    c.name as company_name,
    c.email as company_email
  FROM projects p
  LEFT JOIN companies c ON p.company_id = c.id
  WHERE p.remaining_amount > 0
  ORDER BY p.remaining_amount DESC;
$$;