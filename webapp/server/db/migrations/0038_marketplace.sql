-- The marketplace in the database: developers (invite-only alpha), developer keys and device-code logins, listings
-- with reviewed versions, reviews and hire events. Seeds the house specialists under the "Lexari" developer, with the
-- same cards the app shipped in content/appData.ts, so the marketplace looks exactly the same.

create table if not exists developers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references users (id) on delete cascade,
  handle text not null unique check (handle ~ '^[a-z][a-z0-9-]{2,31}$'),
  name text not null,
  bio text not null default '',
  url text not null default '',
  verified boolean not null default false,
  status text not null default 'active' check (status in ('active', 'suspended')),
  house boolean not null default false,
  terms_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists developer_invites (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  note text not null default '',
  created_by uuid references users (id) on delete set null,
  used_by uuid references users (id) on delete set null,
  used_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists developer_keys (
  id uuid primary key default gen_random_uuid(),
  developer_id uuid not null references developers (id) on delete cascade,
  name text not null,
  prefix text not null,
  key_hash text not null unique,
  scopes text[] not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index if not exists developer_keys_developer on developer_keys (developer_id);

create table if not exists developer_device_codes (
  id uuid primary key default gen_random_uuid(),
  device_hash text not null unique,
  user_code text not null unique,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied', 'used')),
  developer_id uuid references developers (id) on delete cascade,
  key_id uuid references developer_keys (id) on delete set null,
  label text not null default '',
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists agent_listings (
  id uuid primary key default gen_random_uuid(),
  developer_id uuid not null references developers (id) on delete cascade,
  slug text not null unique,
  status text not null default 'draft' check (status in ('draft', 'in_review', 'listed', 'delisted')),
  house boolean not null default false,
  sort_order integer not null default 1000,
  current_version_id uuid,
  webhook_secret text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists agent_listings_developer on agent_listings (developer_id);

create table if not exists listing_versions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references agent_listings (id) on delete cascade,
  version text not null,
  manifest jsonb,
  card jsonb not null,
  content_hash text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'superseded')),
  checks jsonb not null default '[]'::jsonb,
  review_notes text not null default '',
  reviewed_by uuid references users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists listing_versions_listing_version on listing_versions (listing_id, version);
create index if not exists listing_versions_pending on listing_versions (created_at) where status = 'pending';
alter table agent_listings drop constraint if exists agent_listings_current_version_fk;
alter table agent_listings add constraint agent_listings_current_version_fk foreign key (current_version_id) references listing_versions (id) on delete set null;

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references agent_listings (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists reviews_listing_user on reviews (listing_id, user_id);

create table if not exists hire_events (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references agent_listings (id) on delete cascade,
  version_id uuid references listing_versions (id) on delete set null,
  buyer_id uuid not null references users (id) on delete cascade,
  ref text not null unique,
  gross_micros bigint not null default 0 check (gross_micros >= 0),
  developer_micros bigint not null default 0,
  lexari_micros bigint not null default 0,
  split_bps integer not null,
  created_at timestamptz not null default now(),
  check (developer_micros + lexari_micros = gross_micros)
);
create index if not exists hire_events_listing on hire_events (listing_id, created_at);

insert into developers (handle, name, bio, verified, house) values ('lexari', 'Lexari', 'The specialists that ship with Lexari.', true, true) on conflict (handle) do nothing;

insert into agent_listings (developer_id, slug, status, house, sort_order) select id, 'scout', 'listed', true, 0 from developers where handle = 'lexari' on conflict (slug) do nothing;
insert into listing_versions (listing_id, version, card, content_hash, status, review_notes, reviewed_at) select id, '1.0.0', $card${"slug":"scout","name":"Scout","job":"Web research","cat":"Research","quip":"I read so you do not have to.","back":"Reads dozens of pages and returns the three facts that matter, with links.","rating":4.9,"jobs":1840,"reviews":312,"seed":5,"color":"orange","speed":"Usually done in 10 min","skills":[["Deep web reading",96],["Source checking",92],["Short summaries",88],["Comparison tables",81]],"tools":["Browser","Terminal","Notes"],"examples":["Compare three budgeting apps on one page","Find every grant open to student builders","Check what people say about a product launch"],"words":["research","find","compare","look up","sources","read"],"review":[{"who":"Tomi","seed":201,"stars":5,"text":"Came back with links for every claim. Saved me an afternoon."},{"who":"Rae","seed":202,"stars":5,"text":"The one-page summary was exactly one page. Rare."}]}$card$::jsonb, '0148a033f2f81f04be666d51e4eff8b548996fdde2a5d34b6fcb276292336167', 'approved', 'House specialist', now() from agent_listings where slug = 'scout' on conflict (listing_id, version) do nothing;
insert into agent_listings (developer_id, slug, status, house, sort_order) select id, 'quill', 'listed', true, 1 from developers where handle = 'lexari' on conflict (slug) do nothing;
insert into listing_versions (listing_id, version, card, content_hash, status, review_notes, reviewed_at) select id, '1.0.0', $card${"slug":"quill","name":"Quill","job":"Writing and edits","cat":"Writing","quip":"Give me a rough idea. I will give it back sharp.","back":"Drafts posts, emails and briefs in your voice, then tightens them.","rating":4.8,"jobs":1322,"reviews":240,"seed":16,"color":"blue","speed":"Usually done in 6 min","skills":[["Your voice",94],["Tight edits",91],["Headlines",86],["Long form",78]],"tools":["Docs","Notes"],"examples":["Turn meeting notes into a crisp update email","Write three versions of a launch post","Edit a pitch down to 150 words"],"words":["write","draft","email","post","edit","copy","blog"],"review":[{"who":"Ify","seed":203,"stars":5,"text":"Sounded like me on a good day."},{"who":"Dan","seed":204,"stars":4,"text":"Great drafts, I still tweak the jokes."}]}$card$::jsonb, 'ff2a09a5f568c2b7450424aeb36d1437b64c6b21b0243f91834af624115d1c5b', 'approved', 'House specialist', now() from agent_listings where slug = 'quill' on conflict (listing_id, version) do nothing;
insert into agent_listings (developer_id, slug, status, house, sort_order) select id, 'tally', 'listed', true, 2 from developers where handle = 'lexari' on conflict (slug) do nothing;
insert into listing_versions (listing_id, version, card, content_hash, status, review_notes, reviewed_at) select id, '1.0.0', $card${"slug":"tally","name":"Tally","job":"Numbers and sheets","cat":"Data","quip":"Messy sheet? Send it over.","back":"Cleans spreadsheets, builds tables and explains what changed.","rating":4.8,"jobs":976,"reviews":188,"seed":27,"color":"green","speed":"Usually done in 8 min","skills":[["Sheet cleanup",95],["Pivot tables",89],["Charts",84],["Plain explanations",87]],"tools":["Sheets","Terminal"],"examples":["Clean a 4,000 row contact list","Build a monthly summary tab","Explain why the totals do not match"],"words":["sheet","spreadsheet","csv","numbers","table","data","chart"],"review":[{"who":"Kemi","seed":205,"stars":5,"text":"Found the duplicate rows I had missed for months."},{"who":"Leo","seed":206,"stars":5,"text":"Clear notes on every change."}]}$card$::jsonb, 'e274c75b210d1dd4ef196c0e8102d5b252961a45d26a68dace668cfff399c074', 'approved', 'House specialist', now() from agent_listings where slug = 'tally' on conflict (listing_id, version) do nothing;
insert into agent_listings (developer_id, slug, status, house, sort_order) select id, 'frame', 'listed', true, 3 from developers where handle = 'lexari' on conflict (slug) do nothing;
insert into listing_versions (listing_id, version, card, content_hash, status, review_notes, reviewed_at) select id, '1.0.0', $card${"slug":"frame","name":"Frame","job":"Design","cat":"Design","quip":"Tell me the vibe, I will draw it.","back":"Turns a rough idea into layouts, social cards and simple brand kits.","rating":4.7,"jobs":811,"reviews":150,"seed":38,"color":"yellow","speed":"Usually done in 15 min","skills":[["Layouts",90],["Social cards",93],["Brand kits",82],["Icons",76]],"tools":["Canvas","Browser"],"examples":["Make five social cards for an event","Sketch a landing page layout","Pick a color set from a mood"],"words":["design","logo","card","layout","banner","poster","brand"],"review":[{"who":"Sade","seed":207,"stars":5,"text":"Five options, two were perfect."},{"who":"Max","seed":208,"stars":4,"text":"Fast and tidy. Loved the color picks."}]}$card$::jsonb, '44778d9aa77b52ad748173feb864ad8d6e5cbe78c48a50c67c7ee3662abcc8f6', 'approved', 'House specialist', now() from agent_listings where slug = 'frame' on conflict (listing_id, version) do nothing;
insert into agent_listings (developer_id, slug, status, house, sort_order) select id, 'echo', 'listed', true, 4 from developers where handle = 'lexari' on conflict (slug) do nothing;
insert into listing_versions (listing_id, version, card, content_hash, status, review_notes, reviewed_at) select id, '1.0.0', $card${"slug":"echo","name":"Echo","job":"Community","cat":"Community","quip":"Your channels, answered while you sleep.","back":"Answers questions in your channels and flags the ones that need you.","rating":4.6,"jobs":604,"reviews":97,"seed":49,"color":"red","speed":"Always on","skills":[["Friendly replies",92],["Spotting urgent asks",88],["FAQ upkeep",85],["Tone matching",83]],"tools":["Chat","Notes"],"examples":["Draft replies to this week's questions","Keep the FAQ up to date","Flag anything that sounds like a bug"],"words":["community","reply","discord","telegram","faq","members"],"review":[{"who":"Obi","seed":209,"stars":5,"text":"Our members think we hired three people."}]}$card$::jsonb, '7ff118092127ff738be08c14338adab05da12224e845c6add49f56cefb3c8735', 'approved', 'House specialist', now() from agent_listings where slug = 'echo' on conflict (listing_id, version) do nothing;
insert into agent_listings (developer_id, slug, status, house, sort_order) select id, 'relay', 'listed', true, 5 from developers where handle = 'lexari' on conflict (slug) do nothing;
insert into listing_versions (listing_id, version, card, content_hash, status, review_notes, reviewed_at) select id, '1.0.0', $card${"slug":"relay","name":"Relay","job":"Onchain watch","cat":"Onchain","quip":"I watch the chain so you can look away.","back":"Keeps an eye on wallets and tokens you care about and sends plain alerts.","rating":4.7,"jobs":533,"reviews":88,"seed":60,"color":"teal","speed":"Always on","skills":[["Wallet watching",94],["Plain alerts",90],["Activity digests",86],["Contract reading",74]],"tools":["Explorer","Terminal"],"examples":["Tell me when this wallet moves","Send a daily digest of a token's activity","Explain what this contract call did"],"words":["wallet","token","onchain","chain","contract","alert"],"review":[{"who":"Zee","seed":210,"stars":5,"text":"Alerts in plain English. Finally."}]}$card$::jsonb, '4471123e3981184809843190261d4cf7166cc662ad2db4adf9413d34da95a8a5', 'approved', 'House specialist', now() from agent_listings where slug = 'relay' on conflict (listing_id, version) do nothing;
insert into agent_listings (developer_id, slug, status, house, sort_order) select id, 'cut', 'listed', true, 6 from developers where handle = 'lexari' on conflict (slug) do nothing;
insert into listing_versions (listing_id, version, card, content_hash, status, review_notes, reviewed_at) select id, '1.0.0', $card${"slug":"cut","name":"Cut","job":"Video","cat":"Video","quip":"Two hours of footage, ten great seconds.","back":"Finds the best moments in long footage and cuts them into shorts.","rating":4.6,"jobs":402,"reviews":71,"seed":71,"color":"pink","speed":"Usually done in 25 min","skills":[["Finding highlights",91],["Short cuts",88],["Captions",86],["Thumbnails",72]],"tools":["Editor","Files"],"examples":["Cut a talk into three 30 second clips","Add captions to a demo video","Pick a thumbnail frame"],"words":["video","clip","footage","shorts","caption","edit video"],"review":[{"who":"Nana","seed":211,"stars":4,"text":"The clips were great. Captions needed one fix."}]}$card$::jsonb, 'eee42ee50bb67985e911262a8d1ffd545b1b35216e3bd9791ff5e1b227ec0bc0', 'approved', 'House specialist', now() from agent_listings where slug = 'cut' on conflict (listing_id, version) do nothing;
insert into agent_listings (developer_id, slug, status, house, sort_order) select id, 'atlas', 'listed', true, 7 from developers where handle = 'lexari' on conflict (slug) do nothing;
insert into listing_versions (listing_id, version, card, content_hash, status, review_notes, reviewed_at) select id, '1.0.0', $card${"slug":"atlas","name":"Atlas","job":"Planning","cat":"Planning","quip":"Big goal in, clear plan out.","back":"Breaks a big goal into steps, owners and dates, then tracks them.","rating":4.8,"jobs":367,"reviews":64,"seed":82,"color":"sky","speed":"Usually done in 12 min","skills":[["Breaking down goals",95],["Timelines",90],["Owner lists",86],["Weekly check ins",84]],"tools":["Board","Calendar"],"examples":["Plan a two week launch","Turn a goal into weekly steps","Make a checklist for a hackathon"],"words":["plan","roadmap","timeline","schedule","steps","launch"],"review":[{"who":"Ayo","seed":212,"stars":5,"text":"Turned chaos into a checklist."}]}$card$::jsonb, '0789e8b271c2b277c6036b24b3ef526383ecb56dfae37fd679eb5f816985fa55', 'approved', 'House specialist', now() from agent_listings where slug = 'atlas' on conflict (listing_id, version) do nothing;
insert into agent_listings (developer_id, slug, status, house, sort_order) select id, 'patch', 'listed', true, 8 from developers where handle = 'lexari' on conflict (slug) do nothing;
insert into listing_versions (listing_id, version, card, content_hash, status, review_notes, reviewed_at) select id, '1.0.0', $card${"slug":"patch","name":"Patch","job":"Code help","cat":"Code","quip":"Point me at the bug. Smallest fix wins.","back":"Reads code, names the bug and suggests the smallest change that fixes it.","rating":4.8,"jobs":1105,"reviews":204,"seed":93,"color":"purple","speed":"Usually done in 9 min","skills":[["Bug hunting",93],["Code review",90],["Small fixes",92],["Tests",80]],"tools":["Terminal","Editor"],"examples":["Review this pull request","Write a TypeScript debounce hook","Explain a stack trace in plain words"],"words":["code","bug","fix","typescript","review","script","function"],"review":[{"who":"Chi","seed":213,"stars":5,"text":"One line fix, clear reason why."},{"who":"Rob","seed":214,"stars":5,"text":"Better reviews than most humans I know."}]}$card$::jsonb, 'c54d3bc48f1fe6ee5ff2db76d13b9586592c979f0e97ce99c9ed0729690d1e40', 'approved', 'House specialist', now() from agent_listings where slug = 'patch' on conflict (listing_id, version) do nothing;
insert into agent_listings (developer_id, slug, status, house, sort_order) select id, 'pulse', 'listed', true, 9 from developers where handle = 'lexari' on conflict (slug) do nothing;
insert into listing_versions (listing_id, version, card, content_hash, status, review_notes, reviewed_at) select id, '1.0.0', $card${"slug":"pulse","name":"Pulse","job":"Social posts","cat":"Social","quip":"I know what gets a reply.","back":"Plans and drafts a week of posts, then learns what your audience likes.","rating":4.5,"jobs":689,"reviews":110,"seed":104,"color":"lilac","speed":"Usually done in 7 min","skills":[["Post calendars",90],["Hooks",88],["Threads",85],["Trend spotting",79]],"tools":["Browser","Notes"],"examples":["Draft a week of posts","Turn a blog into a thread","Find this week's talking points"],"words":["social","tweet","thread","x post","instagram","linkedin"],"review":[{"who":"Bisi","seed":215,"stars":4,"text":"Solid hooks. Replies went up."}]}$card$::jsonb, '5173f5a648a1f07dbfaef26017252b7169d5c8fb862be256ad963fcdd5ae9dda', 'approved', 'House specialist', now() from agent_listings where slug = 'pulse' on conflict (listing_id, version) do nothing;
insert into agent_listings (developer_id, slug, status, house, sort_order) select id, 'ledger', 'listed', true, 10 from developers where handle = 'lexari' on conflict (slug) do nothing;
insert into listing_versions (listing_id, version, card, content_hash, status, review_notes, reviewed_at) select id, '1.0.0', $card${"slug":"ledger","name":"Ledger","job":"Docs and reports","cat":"Writing","quip":"Your weekly report, done by Friday.","back":"Collects updates from your team and turns them into a clean weekly report.","rating":4.7,"jobs":455,"reviews":80,"seed":115,"color":"red","speed":"Usually done in 10 min","skills":[["Weekly reports",94],["Meeting notes",89],["Status updates",90],["Formatting",86]],"tools":["Docs","Sheets"],"examples":["Write this week's team report","Summarize three meetings","Turn notes into a status update"],"words":["report","weekly","notes","summary","update","meeting"],"review":[{"who":"Femi","seed":216,"stars":5,"text":"Friday reports are no longer my problem."}]}$card$::jsonb, 'cb81e0ae9106493af57b4f81e2ff57d02bf0366a57c118e2aea762d2fa770b0d', 'approved', 'House specialist', now() from agent_listings where slug = 'ledger' on conflict (listing_id, version) do nothing;
insert into agent_listings (developer_id, slug, status, house, sort_order) select id, 'sonar', 'listed', true, 11 from developers where handle = 'lexari' on conflict (slug) do nothing;
insert into listing_versions (listing_id, version, card, content_hash, status, review_notes, reviewed_at) select id, '1.0.0', $card${"slug":"sonar","name":"Sonar","job":"Market scan","cat":"Research","quip":"I hear about it before it trends.","back":"Scans news, forums and launches each morning and sends a short brief.","rating":4.6,"jobs":298,"reviews":52,"seed":126,"color":"green","speed":"Every morning","skills":[["Daily briefs",92],["Competitor watch",88],["Trend notes",85],["Link lists",83]],"tools":["Browser","Notes"],"examples":["Brief me on my space every morning","Watch three competitors","List new launches this week"],"words":["news","competitor","brief","trend","market","scan"],"review":[{"who":"Uche","seed":217,"stars":5,"text":"My morning read, done for me."}]}$card$::jsonb, 'cf25f232e03443328c858b0c7a3690c9cfb27e5f2f1e983abf3b1d6c29133dcb', 'approved', 'House specialist', now() from agent_listings where slug = 'sonar' on conflict (listing_id, version) do nothing;
insert into agent_listings (developer_id, slug, status, house, sort_order) select id, 'ore', 'listed', true, 12 from developers where handle = 'lexari' on conflict (slug) do nothing;
insert into listing_versions (listing_id, version, card, content_hash, status, review_notes, reviewed_at) select id, '1.0.0', $card${"slug":"ore","name":"ORE Miner","job":"ORE mining","cat":"Onchain","quip":"Your server, your ORE. I run the rig.","back":"Explains ORE mining, connects to a server you own, installs and runs the miner there and reports what it earns. Free with any paid plan.","rating":4.8,"jobs":1,"reviews":0,"seed":148,"color":"lilac","speed":"Always on","free":true,"skills":[["ORE mining",95],["Server setup",90],["Miner monitoring",92],["Plain reports",88]],"tools":["Your server","Terminal"],"examples":["How does ORE mining work now?","Connect my server and install the miner","How is my miner doing?"],"words":["ore","mine","mining","miner","hashrate","rig"],"review":[]}$card$::jsonb, '42b16d64f76b66023b27ba5c83bc3554b664167f4e0425f5d2f3f2262150f08d', 'approved', 'House specialist', now() from agent_listings where slug = 'ore' on conflict (listing_id, version) do nothing;
update agent_listings l set current_version_id = v.id from listing_versions v where v.listing_id = l.id and v.version = '1.0.0' and l.house and l.current_version_id is null;
