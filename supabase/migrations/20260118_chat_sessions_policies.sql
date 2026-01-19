-- Users can only see their own chat sessions
   CREATE POLICY "Users can view own chats"
   ON chat_sessions FOR SELECT
   USING (
     auth.uid() = holder_id OR 
     auth.uid() = tracker_id
   );
   
   -- System can create chats (through Edge Functions)
   CREATE POLICY "System can create chats"
   ON chat_sessions FOR INSERT
   WITH CHECK (true);