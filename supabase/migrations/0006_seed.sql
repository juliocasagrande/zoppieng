-- Standard Zoppi accessory catalog (section 4.3 of the spec)
insert into accessory_catalog (scope, name, category, manufacturer, spec_diameter_mm, spec_load_capacity_kn, spec_notes) values
  ('zoppi_standard', 'Chumbador químico M12 (com ampola/resina)', 'chumbador_quimico', 'Zoppi Padrão', 12, 25, 'Instalação com resina epóxi, cura conforme ficha técnica do fabricante.'),
  ('zoppi_standard', 'Chumbador químico M16 (com ampola/resina)', 'chumbador_quimico', 'Zoppi Padrão', 16, 40, 'Instalação com resina epóxi, cura conforme ficha técnica do fabricante.'),
  ('zoppi_standard', 'Chumbador mecânico M12 (parabolt)', 'chumbador_mecanico', 'Zoppi Padrão', 12, 20, 'Expansão mecânica, torque conforme ficha técnica do fabricante.'),
  ('zoppi_standard', 'Chumbador mecânico M16 (parabolt)', 'chumbador_mecanico', 'Zoppi Padrão', 16, 32, 'Expansão mecânica, torque conforme ficha técnica do fabricante.'),
  ('zoppi_standard', 'Olhal de ancoragem forjado', 'olhal', 'Zoppi Padrão', 16, 25, 'Dimensionamento de catálogo, verificar capacidade de carga junto ao fabricante.'),
  ('zoppi_standard', 'Barra roscada inox A4', 'barra_roscada', 'Zoppi Padrão', 12, 20, 'Aço inoxidável, resistente a corrosão.'),
  ('zoppi_standard', 'Dinamômetro de teste 3T', 'dinamometro', 'Zoppi Padrão', null, 30, 'Capacidade de 3 toneladas, calibração conforme certificado vigente.');

insert into best_practices_content (module_id, slug, title, body_html, summary, step_context, sort_order)
select m.id, v.slug, v.title, v.body_html, v.summary, v.step_context, v.sort_order
from modules m,
  (values
    ('fotos-gerais', 'Boas práticas: fotos gerais',
     '<p>Tire fotos com boa iluminação, enquadrando o ponto de ancoragem por inteiro e o entorno imediato. Evite fotos tremidas ou fora de foco.</p>',
     'Boa iluminação, ponto inteiro no enquadramento.', 'anchor_point_photos', 1),
    ('teste-arrancamento', 'Boas práticas: teste de arrancamento',
     '<p>Confirme a calibração do dinamômetro antes de iniciar. Aplique a carga de forma gradual e registre o valor máximo atingido durante o tempo de teste definido.</p>',
     'Calibrar o instrumento e aplicar carga gradualmente.', 'anchor_point_test', 2),
    ('identificacao-pontos', 'Boas práticas: identificação dos pontos',
     '<p>Numere cada ponto de forma sequencial e visível, preferencialmente com a etiqueta física já fixada antes da foto.</p>',
     'Numerar e etiquetar antes de fotografar.', 'anchor_point_tag', 3)
  ) as v(slug, title, body_html, summary, step_context, sort_order)
where m.slug = 'ancoragem';
