-- Create enum types
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.company_type AS ENUM ('customer', 'freelancer', 'supplier');
CREATE TYPE public.expense_frequency AS ENUM ('once', 'monthly', 'quarterly', 'biannual', 'yearly');
CREATE TYPE public.project_status AS ENUM ('active', 'completed', 'cancelled', 'pending');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create user_roles table for role management
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create companies table
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type company_type NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  tax_number TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Create projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status project_status NOT NULL DEFAULT 'active',
  budget DECIMAL(15,2) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  remaining_amount DECIMAL(15,2) GENERATED ALWAYS AS (budget - paid_amount) STORED,
  start_date DATE,
  end_date DATE,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Create social_media_accounts table
CREATE TABLE public.social_media_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  platform TEXT NOT NULL,
  account_name TEXT NOT NULL,
  monthly_fee DECIMAL(10,2),
  renewal_date DATE NOT NULL,
  last_renewed_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.social_media_accounts ENABLE ROW LEVEL SECURITY;

-- Create domains table
CREATE TABLE public.domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  domain_name TEXT NOT NULL,
  type TEXT NOT NULL, -- domain, hosting, ssl
  start_date DATE,
  expire_date DATE NOT NULL,
  registrar TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;

-- Create revenues table
CREATE TABLE public.revenues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL,
  description TEXT NOT NULL,
  revenue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  invoice_number TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.revenues ENABLE ROW LEVEL SECURITY;

-- Create expenses table
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  amount DECIMAL(15,2) NOT NULL,
  description TEXT NOT NULL,
  category TEXT,
  frequency expense_frequency NOT NULL DEFAULT 'once',
  payment_day INTEGER, -- day of month for recurring expenses (1-31)
  next_payment_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Create expense_payments table for tracking payments
CREATE TABLE public.expense_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID REFERENCES public.expenses(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  payment_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  is_paid BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.expense_payments ENABLE ROW LEVEL SECURITY;

-- Create security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email
  );
  
  -- First user becomes admin
  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for new user
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Add updated_at triggers
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.social_media_accounts FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.domains FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.revenues FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- RLS Policies for user_roles
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for companies
CREATE POLICY "Authenticated users can view companies" ON public.companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create companies" ON public.companies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update companies they created or admins can update all" ON public.companies FOR UPDATE TO authenticated 
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete companies" ON public.companies FOR DELETE TO authenticated 
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for projects
CREATE POLICY "Users can view projects" ON public.projects FOR SELECT TO authenticated 
  USING (assigned_to = auth.uid() OR created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can create projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update assigned or created projects, admins can update all" ON public.projects FOR UPDATE TO authenticated 
  USING (assigned_to = auth.uid() OR created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete projects" ON public.projects FOR DELETE TO authenticated 
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for social_media_accounts
CREATE POLICY "Authenticated users can view social media accounts" ON public.social_media_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create social media accounts" ON public.social_media_accounts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update accounts they created or admins can update all" ON public.social_media_accounts FOR UPDATE TO authenticated 
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete social media accounts" ON public.social_media_accounts FOR DELETE TO authenticated 
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for domains
CREATE POLICY "Authenticated users can view domains" ON public.domains FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create domains" ON public.domains FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update domains they created or admins can update all" ON public.domains FOR UPDATE TO authenticated 
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete domains" ON public.domains FOR DELETE TO authenticated 
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for revenues
CREATE POLICY "Authenticated users can view revenues" ON public.revenues FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create revenues" ON public.revenues FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update revenues they created or admins can update all" ON public.revenues FOR UPDATE TO authenticated 
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete revenues" ON public.revenues FOR DELETE TO authenticated 
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for expenses
CREATE POLICY "Authenticated users can view expenses" ON public.expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create expenses" ON public.expenses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update expenses they created or admins can update all" ON public.expenses FOR UPDATE TO authenticated 
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete expenses" ON public.expenses FOR DELETE TO authenticated 
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for expense_payments
CREATE POLICY "Authenticated users can view expense payments" ON public.expense_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create expense payments" ON public.expense_payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update expense payments" ON public.expense_payments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete expense payments" ON public.expense_payments FOR DELETE TO authenticated 
  USING (public.has_role(auth.uid(), 'admin'));

-- Create indexes for better performance
CREATE INDEX idx_companies_type ON public.companies(type);
CREATE INDEX idx_companies_created_by ON public.companies(created_by);
CREATE INDEX idx_projects_company_id ON public.projects(company_id);
CREATE INDEX idx_projects_assigned_to ON public.projects(assigned_to);
CREATE INDEX idx_projects_status ON public.projects(status);
CREATE INDEX idx_social_media_renewal_date ON public.social_media_accounts(renewal_date);
CREATE INDEX idx_domains_expire_date ON public.domains(expire_date);
CREATE INDEX idx_revenues_revenue_date ON public.revenues(revenue_date);
CREATE INDEX idx_revenues_company_id ON public.revenues(company_id);
CREATE INDEX idx_expenses_next_payment_date ON public.expenses(next_payment_date);
CREATE INDEX idx_expense_payments_expense_id ON public.expense_payments(expense_id);
CREATE INDEX idx_expense_payments_payment_date ON public.expense_payments(payment_date);