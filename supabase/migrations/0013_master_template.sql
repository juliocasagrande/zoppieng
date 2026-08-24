-- Aligns the report schema with the master anchoring laudo template
-- (Laudo_Ancoragem_Modelo_Mestre_Zoppi): cover/identification metadata, system
-- description, rastreabilidade/verification, non-conformities, revision
-- control and periodic-inspection history. The list-shaped sections
-- (components, verification checks, non-conformities, revisions, inspection
-- history) are stored as jsonb arrays authored by the engineer during review
-- rather than normalized tables, since they're small, per-report, and never
-- queried independently of the report.
-- ART and O.S./contrato are entered by the engineer during review (not known
-- to the subscriber company at report creation time), so they only live here
-- as engineer-editable fields — see review/routes.ts PATCH /:id/details.
alter table reports
  add column art_number text,
  add column revision text not null default '00',
  add column site_area text,
  add column os_contract_number text,
  add column survey_date date,
  add column objective_text text,
  add column scope_text text,
  add column recommendations_text text,
  add column conclusion_text text,
  add column accompanying_client_name text,
  add column accompanying_client_role text,
  add column field_executor_accepted_at timestamptz,
  add column accompanying_client_accepted_at timestamptz,
  add column verification_checks jsonb not null default '[]'::jsonb,
  add column components jsonb not null default '[]'::jsonb,
  add column nonconformities jsonb not null default '[]'::jsonb,
  add column revisions jsonb not null default '[]'::jsonb,
  add column inspection_history jsonb not null default '[]'::jsonb;

-- System description (tipo do sistema, finalidade, capacidade, estrutura
-- suporte, modo de fixação detalhado, condição ambiental) varies point to
-- point in practice (different anchors can sit on different structures), so
-- it's captured by the field technician per anchor point rather than once
-- per report.
alter table anchor_points
  add column test_reference_load_kgf numeric,
  add column test_load_direction text,
  add column fixation_material_reference text,
  add column system_type text,
  add column system_purpose text,
  add column capacity_users text,
  add column support_structure text,
  add column fixation_mode_detail text,
  add column environment_condition text;
