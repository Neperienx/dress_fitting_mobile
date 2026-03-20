alter table public.session_feedback
drop constraint if exists session_feedback_reaction_check;

alter table public.session_feedback
add constraint session_feedback_reaction_check check (
  feedback_reaction is null or feedback_reaction in ('up', 'down')
);
