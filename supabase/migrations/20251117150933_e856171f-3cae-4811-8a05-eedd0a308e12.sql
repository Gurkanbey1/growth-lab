-- Create project_payments table for payment history
CREATE TABLE IF NOT EXISTS public.project_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view project payments"
  ON public.project_payments
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create project payments"
  ON public.project_payments
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can delete project payments"
  ON public.project_payments
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- Create index for better query performance
CREATE INDEX idx_project_payments_project_id ON public.project_payments(project_id);
CREATE INDEX idx_project_payments_payment_date ON public.project_payments(payment_date DESC);