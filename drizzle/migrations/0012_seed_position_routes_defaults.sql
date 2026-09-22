-- Rubriques recommandées par poste. Ajout uniquement : aucune ligne existante n'est modifiée.
-- Les postes de direction (Producteur général / délégué / exécutif) restent sans restriction.
WITH base(route) AS (
  VALUES ('/dashboard'), ('/taches'), ('/rapports'), ('/conges'), ('/equipes'),
         ('/organigramme'), ('/ressources'), ('/discussion'), ('/messagerie'),
         ('/reunions'), ('/feuille-de-service'), ('/archives'), ('/nouveau-projet'),
         ('/projets-approuves'), ('/vote')
), extra(pname, route) AS (
  VALUES
    ('Directeur de production', '/budget-previsionnel'),
    ('Directeur de production', '/comptabilite'),
    ('Directeur de production', '/contrats'),
    ('Directeur de production', '/analyse'),
    ('Directeur de production', '/idees'),
    ('Administrateur de production', '/budget-previsionnel'),
    ('Administrateur de production', '/comptabilite'),
    ('Administrateur de production', '/contrats'),
    ('Administrateur de production', '/analyse'),
    ('Comptable / Trésorier', '/budget-previsionnel'),
    ('Comptable / Trésorier', '/comptabilite'),
    ('Comptable / Trésorier', '/contrats'),
    ('Chargé des partenariats et du financement', '/budget-previsionnel'),
    ('Chargé des partenariats et du financement', '/contrats'),
    ('Chargé des partenariats et du financement', '/festivals'),
    ('Régisseur général', '/budget-previsionnel'),
    ('Régisseur général', '/contrats'),
    ('Auteur', '/idees'),
    ('Scénariste', '/idees'),
    ('Consultant scénario (Script-doctor)', '/idees'),
    ('Réalisateur', '/idees'),
    ('Réalisateur', '/casting'),
    ('Assistant réalisateur (1er AR)', '/casting'),
    ('2e assistant réalisateur', '/casting'),
    ('Directeur de casting', '/casting'),
    ('Directeur d''acteurs', '/casting'),
    ('Chargé des festivals (Programmateur / Booking)', '/festivals'),
    ('Diffuseur', '/festivals'),
    ('Distributeur', '/festivals'),
    ('Gestionnaire de communication (Communication Manager)', '/festivals'),
    ('Gestionnaire de communication (Communication Manager)', '/casting')
)
INSERT INTO public.position_routes (position_id, route)
SELECT p.id, r.route
FROM public.positions p
CROSS JOIN base r
WHERE p.name NOT IN ('Producteur général', 'Producteur délégué', 'Producteur exécutif')
UNION
SELECT p.id, e.route
FROM public.positions p
JOIN extra e ON e.pname = p.name
ON CONFLICT DO NOTHING;