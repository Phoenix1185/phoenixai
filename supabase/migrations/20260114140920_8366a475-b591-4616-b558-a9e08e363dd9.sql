-- Create user preference types
CREATE TYPE public.preferred_style AS ENUM ('formal', 'casual', 'witty');
CREATE TYPE public.response_length AS ENUM ('concise', 'balanced', 'detailed');
CREATE TYPE public.expertise_level AS ENUM ('beginner', 'intermediate', 'expert');

-- Create profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    display_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user preferences table (AI learning data)
CREATE TABLE public.user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    preferred_style preferred_style DEFAULT 'casual',
    response_length response_length DEFAULT 'balanced',
    expertise_level expertise_level DEFAULT 'intermediate',
    interests TEXT[] DEFAULT '{}',
    theme TEXT DEFAULT 'dark',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create conversations table
CREATE TABLE public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL DEFAULT 'New Chat',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create messages table
CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    rating INTEGER CHECK (rating IN (-1, 0, 1)),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create feedback table for learning
CREATE TABLE public.feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
    feedback_type TEXT NOT NULL,
    feedback_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for user_preferences
CREATE POLICY "Users can view their own preferences" ON public.user_preferences
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own preferences" ON public.user_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own preferences" ON public.user_preferences
    FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for conversations
CREATE POLICY "Users can view their own conversations" ON public.conversations
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own conversations" ON public.conversations
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own conversations" ON public.conversations
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own conversations" ON public.conversations
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for messages
CREATE POLICY "Users can view their own messages" ON public.messages
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own messages" ON public.messages
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own messages" ON public.messages
    FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for feedback
CREATE POLICY "Users can view their own feedback" ON public.feedback
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own feedback" ON public.feedback
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at
    BEFORE UPDATE ON public.user_preferences
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at
    BEFORE UPDATE ON public.conversations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to auto-create profile and preferences on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, display_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
    
    INSERT INTO public.user_preferences (user_id)
    VALUES (NEW.id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to run on user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();