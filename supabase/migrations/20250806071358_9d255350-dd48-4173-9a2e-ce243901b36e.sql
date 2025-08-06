-- Create table for monthly status sheets
CREATE TABLE public.monthly_status_sheets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  month_year TEXT NOT NULL, -- Format: 'YYYY-MM'
  day_number INTEGER NOT NULL CHECK (day_number >= 1 AND day_number <= 31),
  status TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, month_year, day_number)
);

-- Enable Row Level Security
ALTER TABLE public.monthly_status_sheets ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own monthly status sheets" 
ON public.monthly_status_sheets 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own monthly status sheets" 
ON public.monthly_status_sheets 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own monthly status sheets" 
ON public.monthly_status_sheets 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own monthly status sheets" 
ON public.monthly_status_sheets 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_monthly_status_sheets_updated_at
BEFORE UPDATE ON public.monthly_status_sheets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();