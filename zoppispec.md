# Zoppi — Plataforma de Laudos Técnicos
## Especificação funcional e técnica para desenvolvimento (v1 — módulo Ancoragem)

> Este documento foi elaborado a partir de uma sessão de refinamento com o time Zoppi e serve como input para o Claude Code iniciar a implementação. Ele cobre a plataforma base (multi-módulo, assinatura), o detalhamento completo do primeiro módulo (**Laudo de Ancoragem**) e os tokens do design system **Zoppi Segurança**.

---

## 1. Visão geral do produto

A Zoppi é uma plataforma SaaS multi-módulo de **laudos técnicos de segurança do trabalho**. Empresas assinam módulos específicos (um módulo = um tipo de laudo/verticais de inspeção). O primeiro módulo é o de **Ancoragem** (pontos de ancoragem / linha de vida, contexto NR-35), mas a arquitetura deve ser construída para que novos módulos (ex.: guindastes, outros equipamentos) sejam adicionados no futuro sem redesenhar o núcleo da plataforma.

Fluxo de valor central do módulo de Ancoragem:

1. A empresa assinante solicita um laudo dentro da plataforma (autenticada).
2. A plataforma gera um **link único, tokenizado, sem necessidade de login**, e a empresa o envia para a pessoa que vai a campo (técnico).
3. O técnico abre o link no celular, preenche os dados básicos e tira as fotos exigidas — inclusive **offline**, se necessário.
4. Os dados sobem para a plataforma Zoppi, entram na fila de revisão de um engenheiro responsável.
5. O engenheiro revisa, corrige se necessário, e assina digitalmente (certificado ICP-Brasil).
6. O laudo em PDF é entregue por e-mail, WhatsApp e fica disponível no painel da empresa assinante.

---

## 2. Arquitetura da plataforma (shell)

A aplicação tem duas superfícies distintas, que **não devem ser confundidas**:

### 2.1 Shell autenticado (área logada)
- Tela de login (Supabase Auth).
- Sidebar de navegação + área de conteúdo (`content area`), no padrão de dashboards SaaS.
- Módulos aparecem na sidebar como itens habilitados conforme a assinatura ativa da empresa (ex.: se a empresa só assina "Ancoragem", só esse módulo aparece; a estrutura deve prever novos módulos sendo adicionados à sidebar sem refatoração).
- Usado por: equipe Zoppi (admins e engenheiros) e usuários das empresas assinantes.

### 2.2 Fluxo público de campo (sem login)
- Rota separada, fora do shell autenticado, otimizada para mobile (PWA instalável — "Adicionar à tela inicial").
- Acesso via link com token único (JWT ou similar), vinculado a **um laudo específico**.
- Sem sidebar, sem menu — fluxo guiado passo a passo (wizard), focado 100% em captura de fotos e preenchimento rápido.
- Token expira após uso completo ou após prazo configurável (ex.: 7 dias), evitando reuso indevido do link.

### 2.3 Multi-módulo desde o núcleo
Mesmo com um único módulo ativo hoje, as seguintes entidades já devem nascer "module-aware": usuários, assinaturas/billing, sidebar, modelo de laudo (`reports`). Isso evita retrabalho ao adicionar o segundo módulo.

---

## 3. Perfis de usuário e permissões

| Perfil | Login? | Onde atua | Principais ações |
|---|---|---|---|
| **Zoppi Admin** | Sim (shell) | Painel interno Zoppi | Gerencia empresas, assinaturas, catálogo padrão de acessórios, engenheiros |
| **Zoppi Engenheiro** | Sim (shell) | Fila de revisão | Revisa laudos, solicita correção, assina digitalmente (ICP-Brasil) |
| **Empresa assinante — Admin** | Sim (shell) | Painel da empresa | Gerencia usuários da própria empresa, solicita laudos, gera links de campo, vê billing/assinatura, acessa histórico |
| **Empresa assinante — Operacional** *(opcional, ver nota)* | Sim (shell) | Painel da empresa | Solicita laudos e gera links, sem acesso a billing |
| **Técnico de campo** | **Não** — link tokenizado | Fluxo público mobile | Preenche formulário do laudo, tira fotos, envia dados (mesmo offline) |

> **Nota:** o perfil "Operacional" é uma recomendação (para empresas com mais de uma pessoa solicitando laudos); confirmar com o time se o MVP precisa dele ou se todo usuário de empresa assinante tem acesso total ao painel da própria empresa.

### 3.1 Tipos de empresa assinante
Conforme definido, a plataforma suporta dois perfis de negócio para o assinante, sem diferença estrutural de conta — a diferença aparece no preenchimento do laudo:
- **Prestadora de serviço (contratada):** instala/inspeciona pontos de ancoragem para terceiros. Ao gerar um laudo, preenche tanto os dados da própria empresa (contratada) quanto os do cliente final (contratante).
- **Dona do imóvel/instalação (contratante final):** assina diretamente para obter laudos periódicos dos próprios pontos. Nesse caso, contratante e contratada podem ser a mesma empresa, ou a contratada fica em branco/preenchida como "Zoppi" ou terceirizada, conforme o caso real de uso.

---

## 4. Módulo 1 — Laudo de Ancoragem: requisitos funcionais

Baseado na referência funcional (PPTX) fornecida pelo time.

### 4.1 Criação do laudo
- Ao iniciar uma nova solicitação, a empresa assinante escolhe o **nome do laudo** a partir de uma lista em cascata de opções pré-definidas (ex.: "Laudo de Inspeção de Pontos de Ancoragem", "Laudo de Instalação de Linha de Vida") **ou** personaliza o nome livremente.
- A empresa informa dados básicos do local/edificação onde os pontos serão inspecionados (endereço, identificação da obra/planta).
- Sistema gera o link único e o QR code/URL para envio ao técnico.

### 4.2 Cadastro das empresas (contratante e contratada)
Campos por empresa (ambas as partes usam a mesma estrutura):
- Razão social, CNPJ, endereço completo.
- Responsável/contato (nome, cargo, telefone, e-mail).
- Vínculo com o cadastro de "empresa assinante" quando aplicável (evita redigitação em laudos futuros).

### 4.3 Catálogo de acessórios de ancoragem (modelo híbrido)
- **Catálogo padrão Zoppi:** itens pré-cadastrados com ficha técnica e certificado, por exemplo:
  - Chumbador químico (com ampola/resina) e chumbador mecânico (parabolt), com dimensões/capacidades de catálogo.
  - Olhal de ancoragem, com dimensionamento de catálogo (diâmetro, capacidade de carga).
  - Barra roscada inox.
  - Dinamômetro para teste (capacidade, ex.: 3 toneladas).
- **Itens customizados por empresa:** cada empresa assinante pode cadastrar acessórios próprios e subir certificados específicos quando o item não está no catálogo padrão.
- Ao preencher um ponto no laudo, o técnico/engenheiro seleciona o acessório usado a partir desse catálogo combinado (padrão + customizado da empresa).

### 4.4 Ficha técnica por ponto de ancoragem
Cada ponto de ancoragem inspecionado registra:
- **Tag/numeração do ponto** (ex.: "Ponto 01").
- **Acessório utilizado** (selecionado do catálogo — item 4.3).
- **Modo de instalação:** químico ou mecânico (campo obrigatório, dedicado).
- **Profundidade do chumbador** (mm).
- **Distância entre pontos** (mm), quando aplicável.
- **Teste de arrancamento/resistência:**
  - Instrumento usado (ex.: dinamômetro, capacidade).
  - Carga aplicada.
  - Tempo de teste.
  - Resultado (aprovado/reprovado).
- **Fotos do ponto** (múltiplas) + campo de **"foto extra"** para registro complementar.
- **Observações** livres por ponto.

### 4.5 Anexos de certificados dos acessórios
- Upload de certificado por acessório utilizado.
- **Suporte a certificados multi-página:** um certificado pode cobrir vários componentes/lotes ao mesmo tempo — a interface deve permitir anexar um PDF/imagem de várias páginas e associá-lo a mais de um item, quando for o caso.

### 4.6 Etiquetas de numeração para impressão *(incluído no MVP)*
- Geração de um modelo pronto (PDF ou imagem) com a numeração/identificação de cada ponto de ancoragem do laudo, para o cliente imprimir e fixar fisicamente no local.

### 4.7 Lembrete de revalidação *(incluído no MVP)*
- Cada laudo tem uma **data de validade** (padrão configurável — referência comum é revalidação anual em contextos de NR-35, mas deve ser um parâmetro configurável, não fixo no código).
- Sistema envia notificação automática ao assinante conforme a validade se aproxima (ex.: 30 e 7 dias antes do vencimento).

### 4.8 Mini manual de boas práticas *(incluído no MVP)*
- Conteúdo estático (texto/imagens) com orientações de boas práticas para a coleta em campo — acessível tanto no painel da empresa assinante quanto, de forma resumida, dentro do fluxo do técnico de campo (ex.: dicas contextuais antes de cada etapa de foto).
- Conteúdo gerenciável pelo Zoppi Admin (não precisa ser hardcoded).

### 4.9 Geração do laudo em PDF
- Compila: dados das empresas, dados do local, todos os pontos de ancoragem (com fotos e testes), certificados anexados, etiquetas de numeração (se aplicável), e a assinatura digital do engenheiro responsável.
- Recomendação: incluir QR code de verificação de autenticidade no PDF, apontando para uma página pública simples de validação do laudo.
- **Requisitos obrigatórios de formatação (documento com validade legal/ART):**
  - Página em **tamanho A4** (210 × 297mm), com margens consistentes (sugestão: 20–25mm) em todas as páginas.
  - **Controle explícito de quebra de página e de linha** — o layout não pode simplesmente "estourar" o conteúdo:
    - Cada ponto de ancoragem (dados + fotos do item) deve, sempre que possível, permanecer **inteiro na mesma página** (`page-break-inside: avoid` ou equivalente); se um ponto não couber no restante da página, ele inteiro passa para a próxima, em vez de ser cortado no meio.
    - Título de seção nunca fica sozinho no rodapé da página, separado do conteúdo que introduz (evitar "títulos órfãos").
    - Tabelas (ex.: lista de pontos, resumo de testes) devem repetir o cabeçalho ao quebrar entre páginas.
    - Imagens devem ser redimensionadas/comprimidas para caber no layout sem distorcer proporção, com legenda abaixo (ex.: "Ponto 03 — foto 2 de 3").
  - **Cabeçalho e rodapé em todas as páginas:** logo Zoppi, nome/identificação do laudo, numeração de página (ex.: "Página 3 de 12"), e no rodapé dados mínimos de rodapé legal (nome do engenheiro responsável, CREA, número do laudo).
  - **Layout profissional e sóbrio**, aplicando os tokens do design system (seção 10) de forma comedida: usar a paleta e tipografia da marca nos títulos e realces (ex.: barra ou faixa de título em `navy-dark`, textos em Barlow/Inter), mas manter o corpo do documento com boa legibilidade de impressão — fundo branco, alto contraste, sem depender de cores para transmitir informação crítica (sempre complementar cor com texto/ícone, útil também se o laudo for impresso em P&B).
  - Página de rosto (capa) com identificação clara do laudo, empresas envolvidas (contratante/contratada), data de emissão e validade.
  - Página final ou seção de assinatura com o carimbo da assinatura digital ICP-Brasil e QR code de verificação.

---

## 5. Fluxo do técnico de campo (PWA sem login)

1. Empresa assinante, dentro do shell autenticado, cria a solicitação de laudo e gera o link.
2. Link é enviado (copiar/colar, WhatsApp, e-mail — a critério da empresa) para a pessoa em campo.
3. Técnico abre o link no celular. PWA carrega uma tela de boas-vindas simples (nome do laudo, empresa solicitante, instruções).
4. Preenchimento guiado em etapas (wizard):
   - Dados básicos do local/veículo/instalação.
   - Para cada ponto de ancoragem: seleção do acessório, modo de instalação, medições, dados do teste, fotos.
   - Revisão final antes de enviar.
5. **Captura de fotos:** integração direta com a câmera do dispositivo (`<input capture>` ou API de câmera via navegador), sem exigir app nativo.
6. **Modo offline (essencial no MVP):**
   - Service Worker + armazenamento local (IndexedDB) guardam fotos e dados preenchidos enquanto não há conexão.
   - Indicador visual de status (ex.: "salvo localmente, aguardando envio" vs. "enviado").
   - Sincronização automática em background assim que a conexão for reestabelecida, sem exigir que o técnico refaça qualquer etapa.
7. Ao concluir o envio, o laudo muda de status para **"aguardando revisão de engenharia"** e a empresa assinante é notificada.
8. Token do link é invalidado após o envio completo (evita reenvio duplicado); Zoppi Admin pode gerar um novo link caso o engenheiro solicite correção/complemento de dados.

---

## 6. Revisão, fila de engenheiros e assinatura digital

- Todo laudo enviado do campo entra em uma **fila de revisão**.
- A Zoppi pode ter **múltiplos engenheiros responsáveis**, cada um com seu próprio registro profissional (CREA) e certificado digital ICP-Brasil.
- A plataforma precisa de um mecanismo de **atribuição de laudos a engenheiros** (fila compartilhada com atribuição manual, e/ou distribuição automática simples — critério exato de distribuição a definir com o time durante a implementação).
- Ações do engenheiro durante a revisão:
  - Aprovar e assinar.
  - Solicitar correção/complemento — reabre um novo link tokenizado para o técnico de campo preencher o que falta, sem precisar refazer o laudo inteiro.
  - Rejeitar (caso excepcional).
- **Assinatura digital:** integração com certificado ICP-Brasil. Recomenda-se abstrair o "assinador" atrás de uma interface própria no backend (`SignatureProvider`), para permitir trocar de provedor (ex.: Assinafy, Clicksign, ou biblioteca própria de assinatura PAdES) sem redesenhar o fluxo de revisão. **A escolha do provedor específico de assinatura ICP-Brasil fica para ser definida durante a implementação** — é o ponto de maior risco técnico do projeto e vale uma validação de viabilidade/custo antes de travar a escolha.

---

## 7. Billing e assinatura de módulos

- Modelo: **mensalidade por módulo** — a empresa paga um valor fixo mensal para ter acesso a um módulo (ex.: "Ancoragem").
- Uma empresa pode assinar múltiplos módulos simultaneamente (estrutura de billing já modelada para isso, mesmo com um único módulo ativo hoje).
- **Gateway de pagamento: Mercado Pago** (cobrança recorrente — Pix, boleto e cartão).
- Estados da assinatura: ativa, inadimplente, cancelada (avaliar se haverá período de trial no MVP — não definido, sugerido como parâmetro configurável).
- Regra de acesso: assinatura inativa/inadimplente bloqueia a criação de **novos** laudos, mas mantém o histórico de laudos já emitidos acessível para consulta e download.

---

## 8. Stack técnica

| Camada | Escolha |
|---|---|
| Frontend (shell + fluxo de campo) | React + Vite, como PWA (manifest.json, service worker, instalável via "Adicionar à tela inicial") |
| Backend / API | Node.js (Express ou Fastify), API REST |
| Banco de dados relacional | Postgres via **Supabase** |
| Armazenamento de imagens/arquivos | **Supabase Storage** |
| Autenticação (shell) | **Supabase Auth** |
| Acesso do técnico de campo | Token de uso único (JWT assinado, com expiração) — fluxo **separado** do Supabase Auth, sem criação de usuário |
| Geração de PDF | Renderização de template HTML/CSS para PDF no backend (ex.: Puppeteer/Playwright com `page.pdf({ format: 'A4', printBackground: true, margin: {...} })`), com CSS de impressão dedicado (`@page`, `page-break-inside: avoid`, `break-inside: avoid`, cabeçalho/rodapé via template de PDF) — ver requisitos detalhados na seção 4.9 |
| Processamento assíncrono | Fila para geração de PDF e envio de notificações — no MVP pode ser uma fila simples baseada em tabela no Postgres, evoluindo para BullMQ + Redis se o volume justificar |
| Notificação por e-mail | Provedor a definir (ex.: Resend, SendGrid) |
| Notificação por WhatsApp | API oficial do WhatsApp Business ou provedor (ex.: Twilio, Z-API) — a definir |
| Assinatura digital | Provedor ICP-Brasil a definir (ver seção 6) |
| Hospedagem | A definir — Supabase cobre banco/storage/auth; hospedagem do frontend/API ainda em aberto (ex.: Railway, Vercel) |
| Modo offline | Service Worker + IndexedDB (fila local no fluxo do técnico de campo) |

**Preparação para app nativo futuro:** manter o frontend como PWA "instalável" desde já (manifest completo, ícones, splash screen) e evitar dependências específicas de navegador que dificultem um wrap futuro via Capacitor/React Native — mas sem implementar nada nativo agora.

---

## 9. Modelo de dados (alto nível)

Não é um schema definitivo — serve de ponto de partida para o Claude Code desenhar as tabelas.

- `companies` — empresa assinante (flag indicando prestadora de serviço / dona de imóvel / ambos).
- `users` — usuários do shell (Zoppi Admin, Zoppi Engenheiro, usuários de empresa assinante), com papel (`role`) e vínculo a `company_id` quando aplicável.
- `modules` — catálogo de módulos disponíveis na plataforma (ex.: "ancoragem").
- `module_subscriptions` — vínculo `company_id` x `module_id`, status (ativa/inadimplente/cancelada), plano/valor.
- `reports` (laudos) — `module_id`, `company_id`, status (rascunho → aguardando campo → em revisão → assinado → entregue), engenheiro responsável, data de emissão, data de validade, nome do laudo.
- `report_field_links` — token único vinculado a um `report_id`, status (pendente/usado/expirado), timestamps.
- `report_parties` — dados de contratante e contratada específicos daquele laudo (podem ou não coincidir com `companies`).
- `anchor_points` — pontos de ancoragem de um laudo: tag, acessório usado (`accessory_id`), modo de instalação, profundidade, distância, dados do teste, observações.
- `accessory_catalog` — catálogo de acessórios (Zoppi padrão + customizado por empresa), com ficha técnica.
- `accessory_certificates` — certificados vinculados a itens do catálogo, com suporte a múltiplas páginas/arquivos.
- `photos` — fotos vinculadas a um `anchor_point` ou ao laudo em geral.
- `signatures` — registro da assinatura digital aplicada (engenheiro, certificado/provedor usado, timestamp, hash do documento assinado).
- `notifications_log` — histórico de envios (e-mail/WhatsApp) por laudo.

---

## 10. Design System — Zoppi Segurança

Extraído do arquivo enviado pelo time (`Zoppi Segurança — Design System.dc.html`). Base visual herdada do site institucional Zoppi Engenharia, estendida com cores semânticas de status para um painel de segurança do trabalho (incidentes, inspeções, treinamentos, laudos).

O Claude Code deve implementar esses valores como **tokens centralizados** (variáveis CSS / arquivo de tema único) — nunca hardcoded espalhado pelos componentes — para facilitar ajustes finos depois.

### 10.1 Cores de marca
| Token | Hex | Uso |
|---|---|---|
| `navy` | `#1D2B7F` | Cor secundária de ação, texto de destaque, avatar, info |
| `navy-dark` | `#151F5C` | Header fixo, sidebar, hover de botão navy |
| `navy-light` | `#2E3FA0` | Variação de apoio |
| `orange` (primária) | `#E86020` | Ação primária, destaque, tab ativa, progress bar |
| `orange-hover` | `#CF521A` | Hover de botão/elemento laranja |

### 10.2 Cores semânticas (status)
| Token | Hex | Significado |
|---|---|---|
| `success` | `#2E9E58` | Seguro / aprovado / resolvido |
| `warning` | `#E86020` | Atenção (mesma cor da marca primária) |
| `danger` | `#D93636` | Crítico / reprovado (hover/tom escuro: `#B82C2C`) |
| `info` | `#1D2B7F` | Em análise (usa o navy) |

### 10.3 Neutros
| Token | Hex | Uso |
|---|---|---|
| `white` | `#FFFFFF` | Fundos de card, inputs |
| `off-white` | `#F4F5F8` | Fundo geral da aplicação |
| `gray-light` | `#E8EAF0` | Bordas, divisores, fundo de barra de progresso |
| `gray` | `#8892A4` | Texto secundário, labels, metadados |
| `text` | `#2D2D2D` | Texto de corpo |
| `dark` | `#1A1C2E` | Títulos, texto de maior contraste |

### 10.4 Tipografia
Fontes via Google Fonts: **Barlow** (300–800), **Barlow Condensed** (600–800), **Inter** (400–600).

| Estilo | Fonte / peso | Uso |
|---|---|---|
| Títulos / headers de seção | Barlow Condensed 800, sempre **uppercase**, letter-spacing 0.02–0.03em | H1/H2 de página, títulos de card de destaque |
| Rótulos de UI | Barlow 600 (semibold) | Nome de card, texto de botão, item de navegação |
| Corpo de texto | Barlow 400 | Descrições, parágrafos, conteúdo geral |
| Eyebrows / labels de formulário / metadados | Inter 500, uppercase, letter-spacing 0.15em, tamanho pequeno (~0.7–0.75rem), cor `gray` | Labels de input, tags, categorias acima de títulos |

### 10.5 Raio, sombra e espaçamento
- **Border radius único: `4px`** em toda a aplicação (cantos discretos — não usar outros valores de raio).
- Sombra padrão: `0 8px 32px rgba(29,43,127,0.12)`.
- Sombra elevada (modais, dropdowns): `0 20px 60px rgba(29,43,127,0.18)`.
- Cards: fundo branco, borda `1px solid #E8EAF0`, padding `24px` (formulários maiores usam `32px`).

### 10.6 Componentes de referência
- **Botões** (radius 4px, padding `12px 26px`, fonte Barlow 600, borda de 2px na mesma cor do fundo):
  - Primário (laranja): fundo/borda `#E86020`, texto branco; hover `#CF521A`.
  - Secundário (navy): fundo/borda `#1D2B7F`, texto branco; hover `#151F5C`.
  - Terciário/outline: fundo transparente, texto navy, borda `#E8EAF0`; hover borda navy.
  - Destrutivo: fundo/borda `#D93636`, texto branco; hover `#B82C2C`.
  - Desabilitado: fundo/borda `#E8EAF0`, texto `#8892A4`, cursor not-allowed.
- **Selos de status** (pill, radius 20px, padding `6px 14px`, fonte Inter 600 uppercase, com dot de 6px): tom pastel de fundo (~8% opacidade da cor), borda ~25% opacidade, texto na cor sólida — success/warning/danger/info conforme 10.2.
- **Tags técnicas** (ex.: "NR-35", "EPI"): fundo laranja 8% opacidade, borda laranja 16%, texto laranja, fonte Inter 0.66rem uppercase, **sem** radius pill (quadradas, padding `5px 8px`).
- **Alertas/banners**: linha com dot de 8px + texto, radius 4px, padding `14px 18px`, fonte Barlow; usar tom escuro do texto (ex. `#A8460F` sobre fundo laranja claro, `#A02323` sobre fundo vermelho claro) para manter contraste de leitura.
- **Cards de KPI/estatística**: eyebrow (Inter uppercase gray) + número grande (Barlow Condensed 800, ~2.2–2.6rem) na cor semântica correspondente.
- **Formulários**: wrapper em card branco; label acima do campo (Inter 500 uppercase gray); input/select/textarea com padding `12px 14px`, borda `#E8EAF0`, radius 4px, fonte Barlow.
- **Sidebar**: fundo `navy-dark` (`#151F5C`), item ativo com fundo laranja a 16% de opacidade e texto branco (Barlow 600), itens inativos em branco a 70% de opacidade (Barlow 500), padding do item `11px 14px`, radius 4px. Rótulo de seção acima da navegação em Inter uppercase, branco a 35% de opacidade.
- **Header fixo (topo)**: fundo `navy-dark`, texto branco, padding `18px 40px`, sombra `0 4px 24px rgba(0,0,0,0.18)`; logo em caixa branca com radius 4px; nome do produto em Barlow Condensed 800 uppercase; tagline em Inter uppercase pequeno, branco a 55%.
- **Layout padrão de tela autenticada**: grid `240px` (sidebar) + `1fr` (conteúdo), conteúdo com fundo off-white e padding `36px 40px` — **este é o layout de referência para o shell da seção 2.1** (sidebar + content area).
- O arquivo original inclui um logo "Zoppi Engenharia" embutido (imagem) — o Claude Code deve extrair esse asset do design system ao montar o header/login.

### 10.7 Aplicação ao módulo de Ancoragem
- Usar `success`/`warning`/`danger` para o resultado do teste de arrancamento por ponto (aprovado/atenção/reprovado) e para o status geral do laudo.
- Usar tags técnicas no estilo "NR-35" para marcar cada laudo/ponto com a norma de referência.
- Tela do técnico de campo (fluxo público, seção 2.2/5) deve seguir a mesma linguagem visual (cores, tipografia, radius 4px), mas em layout mobile-first de coluna única, sem sidebar — herdando os componentes de formulário e botões primários/secundários do design system.

---

## 11. Nome do produto e identidade

- Nome do app/produto: **Zoppi** (aparece no título da plataforma, no PDF do laudo, no manifest do PWA).

---

## 12. Fora de escopo do MVP (mas a arquitetura deve prever)

- **Loja/aluguel de acessórios** (venda de lacres, olhais, ampolas químicas) — mencionado como ideia futura no material de referência; não faz parte do MVP.
- **Publicação em lojas de aplicativo** (App Store/Play Store) — fase atual é 100% PWA; manter o frontend "instalável" facilita a migração futura.
- **Módulos além de Ancoragem** — o shell, billing e modelo de `reports` já nascem multi-módulo, mas nenhum outro módulo será implementado agora.

---

## 13. Pontos em aberto para validar durante a implementação

- Critério exato de distribuição de laudos entre engenheiros na fila de revisão (manual vs. automática).
- Provedor definitivo de assinatura digital ICP-Brasil (avaliar custo/integração: Assinafy, Clicksign, ou outro).
- Provedor de e-mail transacional e de envio via WhatsApp Business.
- Hospedagem do frontend/API (Supabase já resolve banco/storage/auth).
- Se haverá perfil "Operacional" dentro da empresa assinante ou se todo usuário da empresa tem acesso total ao painel (seção 3).
- Regra padrão de validade do laudo (ex.: 12 meses) — deve ser configurável, mas precisa de um valor default para o MVP.
