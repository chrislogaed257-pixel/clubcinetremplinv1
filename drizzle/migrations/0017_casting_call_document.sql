ALTER TABLE public.casting_calls ADD COLUMN IF NOT EXISTS document jsonb NOT NULL DEFAULT '{}'::jsonb;

INSERT INTO public.casting_calls (title, description, public_token, is_open, document)
SELECT 'Court métrage « HOMME NOIR »',
 'Drame / Sensibilisation : en français et en kirundi',
 replace(gen_random_uuid()::text,'-',''), true,
 jsonb_build_object(
  'schedule', jsonb_build_array(
    jsonb_build_object('label','Casting','text','Dimanche 18 octobre 2026, à 15h00 — Gitega Study Space (GSS)'),
    jsonb_build_object('label','Tournage','text','3 jours, entre le 5 et le 8 novembre 2026'),
    jsonb_build_object('label','Répétitions','text','Dimanche 25 octobre à 15h et mercredi 28 octobre à 17h30')),
  'roles', jsonb_build_array(
    jsonb_build_object('name','ALICIA','age','18-30 ans','character','Jeune femme sociable, pleine d''énergie et de joie de vivre. Elle aime profiter de l''instant présent, parfois sans mesurer les conséquences.','line','Insouciance et légèreté → charme et liberté → trouble diffus → peur → panique → épuisement → désespoir muet.'),
    jsonb_build_object('name','JUSTIN','age','23-40 ans','character','Médecin, sérieux, attentionné et protecteur envers Alicia. Discipliné, mais capable de se détendre par amitié.','line','Complicité détendue → professionnalisme contrarié → inquiétude → alarme → compatissant.'),
    jsonb_build_object('name','LE JEUNE HOMME','age','20-30 ans','character','Charmant, sûr de lui, désinvolte. Une présence brève et séduisante.','line','Rôle bref : charme et désinvolture.'),
    jsonb_build_object('name','L''HOMME EN NOIR','age','23-40 ans','character','Il observe avant d''agir. Fasciné, patient, jamais pressé, toujours maître de lui. Une élégance froide.','line','Fascination silencieuse → désir contenu → possession douce et implacable → satisfaction froide.')),
  'max_roles', 2,
  'shoot_days', jsonb_build_array('Jeu. 5 nov.','Ven. 6 nov.','Sam. 7 nov.','Dim. 8 nov.','Disponible pour les 3 jours de tournage'),
  'rehearsal_days', jsonb_build_array('Dim. 25 octobre','Mer. 28 octobre'),
  'casting_presence', 'Je serai présent(e) le dimanche 18 octobre 2026 à 15h00 au Gitega Study Space',
  'languages', jsonb_build_array('Français','Kirundi'))
WHERE NOT EXISTS (SELECT 1 FROM public.casting_calls WHERE title = 'Court métrage « HOMME NOIR »');