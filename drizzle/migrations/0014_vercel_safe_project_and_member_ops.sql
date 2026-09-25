
create or replace function public.can_edit_project_fiche(_u uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select public.has_role(_u,'admin') or public.has_position(_u,'Producteur général')
    or public.has_position(_u,'Producteur délégué') or public.has_position(_u,'Scénariste')
$$;

create or replace function public.update_project_fiche(_project uuid, _changes jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.projects; labels text := ''; ids uuid[];
begin
  if not public.can_edit_project_fiche(auth.uid()) then raise exception 'Votre poste ne permet pas de modifier ce projet.'; end if;
  select * into p from public.projects where id=_project;
  if not found then raise exception 'Projet introuvable'; end if;
  update public.projects set
    title = coalesce(nullif(trim(_changes->>'title'),''), title),
    logline = coalesce(_changes->>'logline', logline),
    synopsis = coalesce(_changes->>'synopsis', synopsis),
    script_title = coalesce(_changes->>'script_title', script_title),
    script_link = coalesce(_changes->>'script_link', script_link),
    intention_note = coalesce(_changes->>'intention_note', intention_note),
    intention_link = coalesce(_changes->>'intention_link', intention_link)
  where id=_project;
  -- les idées rattachées suivent aussi
  update public.ideas set
    project_title = coalesce(nullif(trim(_changes->>'title'),''), project_title),
    logline = coalesce(_changes->>'logline', logline),
    synopsis = coalesce(_changes->>'synopsis', synopsis)
  where project_id=_project;
  select array_agg(id) into ids from public.profiles where coalesce(active,true);
  perform public.notify_profiles(ids, 'Projet modifié',
    coalesce((select full_name from public.profiles where id=auth.uid()),'Un membre')
      || ' a modifié la fiche du projet « ' || coalesce(nullif(trim(_changes->>'title'),''), p.title) || ' ».',
    '/projets-approuves');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.soft_delete_project(_project uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not (public.has_role(auth.uid(),'admin') or public.has_position(auth.uid(),'Producteur général')
    or public.has_position(auth.uid(),'Producteur délégué') or public.has_position(auth.uid(),'Scénariste')
    or public.has_position(auth.uid(),'Réalisateur') or public.has_position(auth.uid(),'Comptable / Trésorier')) then
    raise exception 'Votre poste ne permet pas de supprimer un projet.';
  end if;
  update public.projects set deleted_at=now(), deleted_by=auth.uid() where id=_project;
end $$;

create or replace function public.admin_setup_member(
  _id uuid, _email text, _full_name text, _role app_role, _likes text, _dislikes text,
  _role_description text, _positions jsonb, _managers uuid[], _projects uuid[])
returns void language plpgsql security definer set search_path=public as $$
declare pos jsonb; first_name text; descr text;
begin
  if not (public.has_role(auth.uid(),'admin') or public.is_admin_or_general_producer(auth.uid())) then
    raise exception 'Accès refusé';
  end if;
  descr := nullif(trim(coalesce(_role_description,'')),'');
  if descr is null then
    select string_agg(name || ' : ' || description, E'\n\n') into descr from public.positions
    where id in (select (x->>'positionId')::uuid from jsonb_array_elements(_positions) x) and coalesce(trim(description),'')<>'';
  end if;
  insert into public.profiles(id,email,full_name,position,manager_id,likes,dislikes,role_description)
  values(_id,_email,_full_name,'',null,coalesce(_likes,''),coalesce(_dislikes,''),coalesce(descr,''))
  on conflict (id) do update set email=excluded.email, full_name=excluded.full_name,
    likes=excluded.likes, dislikes=excluded.dislikes, role_description=excluded.role_description;
  delete from public.user_roles where user_id=_id;
  insert into public.user_roles(user_id,role) values(_id,_role);
  if _role='mentor' then
    insert into public.conversations(kind,title,ref_id) values('mentor','Mentor — '||_full_name,_id)
    on conflict (kind,ref_id) do nothing;
  end if;
  delete from public.profile_positions where profile_id=_id;
  for pos in select * from jsonb_array_elements(coalesce(_positions,'[]'::jsonb)) loop
    insert into public.profile_positions(profile_id,position_id,rank_label)
    values(_id,(pos->>'positionId')::uuid,coalesce(pos->>'rank',''));
    insert into public.profile_position_history(profile_id,position_name,rank_label)
    select _id, name, coalesce(pos->>'rank','') from public.positions where id=(pos->>'positionId')::uuid;
  end loop;
  delete from public.profile_managers where profile_id=_id;
  insert into public.profile_managers(profile_id,manager_id)
  select _id, m from unnest(coalesce(_managers,'{}')) m where m<>_id;
  select name into first_name from public.positions where id=((_positions->0)->>'positionId')::uuid;
  update public.profiles set position=coalesce(first_name,''),
    manager_id=(select m from unnest(coalesce(_managers,'{}')) m where m<>_id limit 1) where id=_id;
  insert into public.project_members(project_id,profile_id,added_by,status)
  select pr, _id, auth.uid(), 'pending' from unnest(coalesce(_projects,'{}')) pr
  on conflict (project_id,profile_id) do nothing;
  insert into public.notifications(user_id,title,body,link)
  values(_id,'Bienvenue dans Ciné Tremplin','Bienvenue '||_full_name||' ! Votre poste : '||coalesce(first_name,'membre du club')||'.','/dashboard');
  perform public.notify_profiles(array(select m from unnest(coalesce(_managers,'{}')) m where m<>_id),
    'Un nouveau membre rejoint votre équipe', _full_name||' rejoint votre équipe.', '/organigramme');
end $$;

grant execute on function public.update_project_fiche(uuid,jsonb), public.soft_delete_project(uuid),
  public.admin_setup_member(uuid,text,text,app_role,text,text,text,jsonb,uuid[],uuid[]),
  public.can_edit_project_fiche(uuid) to authenticated;
