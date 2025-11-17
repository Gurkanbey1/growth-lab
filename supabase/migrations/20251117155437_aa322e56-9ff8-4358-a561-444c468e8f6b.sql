-- Create ai_prompt_history table
CREATE TABLE IF NOT EXISTS public.ai_prompt_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  result_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_prompt_history ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own prompt history"
  ON public.ai_prompt_history
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own prompts"
  ON public.ai_prompt_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_ai_prompt_history_user_id ON public.ai_prompt_history(user_id, created_at DESC);