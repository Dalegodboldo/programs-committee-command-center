# AITCF Programs Committee Command Center

Private, password-protected dashboard for the Always In The Club Foundation Programs Committee: everything the committee needs to run its youth programs between monthly meetings.

- **Overview:** next meeting, the December scorecard, overdue and upcoming items, "my action items", progress by workstream, recent activity.
- **Action items:** every task with owner, due date, status and workstream. Views for mine, overdue, next 7 days and done; filter by person or workstream.
- **Meetings & decisions:** monthly meetings (agenda, attendees, recap, files), a decisions log, and open questions waiting on the committee.
- **Plan & goals:** the December scorecard, the Spotlight roadmap with its phase gates, first-year targets, and the operating rules (safety rules, mentee path, weekly Spotlight rhythm).
- **Spotlight:** the artist roster (with CSV import), guardian outreach status and releases, and the Monday, Wednesday and Friday content calendar. Posts flag any artist whose release isn't signed.
- **Mentoring:** mentee pipeline from inquiry to ambassador, a session log that flags any session without a second adult, and mentors with background check, code of conduct and capacity.
- **Partners & funding:** partners by region and status with next steps, grants with deadlines and totals, and Florida provider class ideas through to listing.
- **Documents:** private file storage in folders (Committee Meetings, Plans & Strategy, Spotlight, Releases & Consent, Mentoring & Intake, Safeguarding Policies, Background Checks, Partners & Schools, Grants & Funding, Florida Provider, Showcases & Events, Marketing & Social, Templates & Forms, Admin only). Access per folder is enforced by the database. Files can be attached to meetings, partners, grants, classes, artists, mentees and mentors (📎 on each row).
- **Team:** access requests, roles and email alerts.
- **Ask Claude:** a chat assistant on every page for questions, summaries, agendas, document search (including inside PDFs and Word files) and small edits the person confirms. It can't change people, access, files, private mentee or artist records, code or settings.
- **Backup (admins):** one-click export of every table and document into a zip.

Every page updates live.

## Privacy

Mentees, mentoring sessions and the Spotlight roster hold details about minors and their families. Only admins and committee members can see them; viewers never can, and the activity log records only that something changed, not names. Background check reports live in an admins-only folder.

## Built with

Next.js 14 (hosted on Vercel), Supabase (logins, Postgres database, file storage, live updates). Code lives in GitHub. Same setup as the BIFF Command Center.

## One-time setup

1. **Supabase:** create a new project (separate from BIFF's), then open **SQL Editor**, paste all of `supabase/schema.sql` and click **Run**. It creates every table, the access rules, the private file bucket, and the starting data from Meeting 1 (action items, decisions, open questions, goals, mentors, partners).
2. In Supabase, **Authentication > Sign In / Providers:** turn **on** "Allow new users to sign up" and turn **off** "Confirm email". This powers the **Request access** page: anyone can submit a request, but a new login sees nothing until an admin approves it on the **Team** page.
3. **Authentication > URL Configuration:** set **Site URL** to the Vercel address, and add `https://YOUR-SITE/auth/callback` under **Redirect URLs**.
4. **Vercel:** import this GitHub repository and add two environment variables from Supabase **Project Settings > API**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY` on older projects)

   For access-request emails, also add (from resend.com):
   - `RESEND_API_KEY`
   - `ADMIN_NOTIFY_EMAILS` (comma-separated admin addresses)
   - optional `NOTIFY_FROM`, once a sending domain is verified in Resend

   For Ask Claude, also add (from console.anthropic.com, AITCF's account, with a monthly spend limit set there):
   - `ANTHROPIC_API_KEY`
   - optional `ANTHROPIC_MODEL` (default `claude-sonnet-5-5`; `claude-haiku-5-5` costs less)
   - optional `ASSISTANT_DAILY_LIMIT` (questions per person per day, default 60)
5. **People:** they use **Request access** on the sign-in page; admins approve them on **Team**. Set the first admin once in **SQL Editor**:
   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.org';
   ```
   Committee members should sign up with their full name as it appears on action items (for example "Dale Eugene") so "My action items" finds their tasks. Admins can fix names on the **Team** page.
6. **Spotlight roster:** open **Spotlight > Roster > Import from CSV** and load the roster file (columns: name, discipline, handle, notes). It isn't stored in this repository because it lists minors.

## Roles

| Role | Can do |
|---|---|
| admin | Everything, including access, backups and background check reports |
| member (committee member) | Edits every working record, including the Spotlight roster, mentees and sessions; uploads and organizes files |
| viewer | Reads action items, meetings, plans, partners, grants and shared folders; never sees mentee, family or artist records |

## Updating the database later

`schema.sql` is safe to re-run: it recreates the rules and only adds starting rows to empty tables. Put future changes in `supabase/migrations/` as numbered files and run them in order.

## Local development

```bash
cp .env.example .env.local   # fill in the two Supabase values
npm install
npm run dev
```
