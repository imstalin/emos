Explaining about the project in detail

We have core team and delivery team.

core team is responsible for the core functionality of the project.
delivery team is responsible for the delivery of the project.

core team is responsible for the following:

1. The core functionality of the project.
2. The core architecture of the project.
3. The core database of the project.
4. The core UI of the project.
5. The core API of the project.
6. The core security of the project.
7. The core performance of the project.

delivery team is responsible for the following:
1. client specifc customizations.
2. core team used share the customizations with the delivery team.
3. mobile team intergration  work is there 


I need to plan to manage both things effectively. Code merge activity time consuming activities to delivery team. 




JayapalMuruganandham

https://gitlab.biw-services.com/JayapalMuruganandham.atom?feed_token=glft-ceaf94e4d74be7c4e31de6611f07d12d9e6c1dec31d36b29342f1ae359120157-403

KumarSaravana

https://gitlab.biw-services.com/KumarSaravana.atom?feed_token=glft-ad62de5bf6bf67c86af909f8837a0d7915f684a773795caf2fc453728637ea28-403


DuraisamyManikandaprabu

https://gitlab.biw-services.com/DuraisamyManikandaprabu.atom?feed_token=glft-ffc885c19021ca8b8d6c759cc6e8da025fbb774ad224583dd5e9aca9546f8b72-403


RajGowtham

https://gitlab.biw-services.com/RajGowtham.atom?feed_token=glft-f2512a6177d1e506e6eb4346e5bfc58a1b00231ed657b24b3d469fc0425cd3ea-403


SankarasubbuRamanathan

https://gitlab.biw-services.com/SankarasubbuRamanathan.atom?feed_token=glft-f74cd9dbe02ab9a60cc1322e946feeca7248a1c860791cdce2a4f912edb98dd5-403

SubburajanJawahar

https://gitlab.biw-services.com/SubburajanJawahar.atom?feed_token=glft-ebbcac8e84ac623f88e76755f3eb13870fc6d1c36256d0fc463bcf1767a8f330-403


VeluruPreethi

https://gitlab.biw-services.com/VeluruPreethi.atom?feed_token=glft-37b16cf370435e76e12ab18b488191b3ebba9711c366edcdf19e9760ae9f53d3-403

SubramanianRuthrakkanth

https://gitlab.biw-services.com/SubramanianRuthrakkanth.atom?feed_token=glft-9bbc1b9373efd761763ce28e9d50773103ff33bfaa4ebf0c75110f38f5092e7e-403


SelvamKadarkarai

https://gitlab.biw-services.com/SelvamKadarkarai.atom?feed_token=glft-67c69699826fb2ff57ce3afe2ff900eb8be7f9a5e944aa06457e29cacfbfdb6a-403# Feature: Engineering Manager Progress Dashboard from GitLab Team Activity

## Objective

Build a new feature in the existing application that converts raw GitLab activity from multiple team members into a concise **Engineering Manager Progress Dashboard**.

The purpose is not to measure developer productivity by commits, activity count, merge requests, or comments.

The purpose is to help an Engineering Manager understand:

* whether committed priorities are progressing,
* what meaningful work moved today,
* which items are blocked or stagnant,
* where cross-team dependencies exist,
* whether people are working on too many parallel items,
* what unplanned work appeared,
* what is approaching QA, PPRD, release, or production,
* and what requires manager attention.

The core transformation should be:

```text
GitLab Feeds
    ↓
Normalized Activities
    ↓
Work Items
    ↓
Priority Alignment
    ↓
Lifecycle Progress
    ↓
Blockers / Risks
    ↓
Manager Attention
    ↓
Engineering Manager Dashboard
```

---

# 1. Inspect Existing Application First

Before implementing anything, inspect the existing repository and understand:

* current backend architecture,
* frontend architecture,
* database/schema,
* authentication and authorization,
* GitLab integrations,
* existing activity/feed processing,
* background jobs/schedulers,
* team/member configuration,
* dashboard/reporting components,
* API conventions,
* logging,
* error handling,
* secret-management approach,
* testing conventions.

Do not introduce a parallel architecture if existing patterns can be reused.

Before coding, produce:

```text
Existing architecture
Relevant reusable components
Proposed architecture
Database/schema changes
Files/modules to change
Implementation phases
Risks/assumptions
```

Then proceed with implementation.

---

# 2. GitLab Team Activity Sources

The feature should ingest GitLab Atom activity feeds for configured team members.

Initial members:

```text
JayapalMuruganandham
KumarSaravana
DuraisamyManikandaprabu
RajGowtham
SankarasubbuRamanathan
SubburajanJawahar
VeluruPreethi
SubramanianRuthrakkanth
SelvamKadarkarai
```

The administrator will provide the corresponding GitLab Atom feed URLs.

These URLs contain private `feed_token` values.

---

# 3. Security Requirements

Never:

```text
Hardcode GitLab feed tokens
Commit feed URLs with tokens
Expose feed tokens through frontend APIs
Display tokens in UI
Log complete authenticated feed URLs
Store tokens in browser/localStorage
```

Use the application's existing secret-management mechanism.

Examples:

```text
Environment Variables
Secret Manager
Vault
Kubernetes Secrets
Encrypted Database Fields
```

Possible environment-variable naming:

```text
GITLAB_FEED_JAYAPAL_MURUGANANDHAM
GITLAB_FEED_KUMAR_SARAVANA
GITLAB_FEED_DURAISAMY_MANIKANDAPRABU
GITLAB_FEED_RAJ_GOWTHAM
GITLAB_FEED_SANKARASUBBU_RAMANATHAN
GITLAB_FEED_SUBBURAJAN_JAWAHAR
GITLAB_FEED_VELURU_PREETHI
GITLAB_FEED_SUBRAMANIAN_RUTHRAKKANTH
GITLAB_FEED_SELVAM_KADARKARAI
```

Do not hardcode these variable names if the application already has a better configuration model.

Support feed-token rotation without losing historical activity.

---

# 4. Team Configuration

Do not permanently encode team membership in source code.

Support configurable teams and members.

Initial conceptual grouping:

```text
Phoenix Core

JayapalMuruganandham
KumarSaravana
DuraisamyManikandaprabu
RajGowtham
SankarasubbuRamanathan
SubburajanJawahar


Phoenix QA

VeluruPreethi
SubramanianRuthrakkanth
SelvamKadarkarai
```

The configuration must allow:

```text
Add member
Disable member
Change team
Change role
Replace feed
Rotate token
Pause ingestion
Reactivate member
```

Historical activity must remain available even when a member is disabled.

---

# 5. GitLab Feed Polling

Create a scheduled background process.

Default polling:

```text
Every 10–15 minutes
```

Make the interval configurable.

For every active member:

```text
Fetch GitLab Atom Feed
        ↓
Parse Atom/XML
        ↓
Normalize Entries
        ↓
Deduplicate
        ↓
Store Activity
```

Do not fetch/process feeds synchronously during dashboard page load.

---

# 6. Idempotency

Processing the same feed multiple times must not duplicate data.

Use identifiers such as:

```text
Atom Entry ID
GitLab User
Timestamp
GitLab URL
Event Type
```

Prefer Atom entry ID as the primary external event identifier where available.

Track:

```text
Last successful fetch
Last processed event
Last event timestamp
Feed health
```

---

# 7. Supported Activity Types

Normalize GitLab events such as:

```text
Push to branch
Branch created
Branch deleted

Commit

Merge request opened
Merge request updated
Merge request approved
Merge request merged/accepted
Merge request closed
Merge request commented

Issue opened
Issue updated
Issue commented
Issue closed

Tag
Release
Pipeline
Deployment
```

Support additional GitLab event types when encountered.

Preserve original event information.

---

# 8. Normalized Activity Model

For each GitLab activity capture where available:

```text
GitLab username
Display name
Team
Timestamp
Project
Repository
Event type
Title
Description
URL
Commit SHA
Branch
Merge Request Number
Issue Number
Pipeline ID
Deployment/Environment
Raw external event ID
Raw payload
```

Original GitLab data must remain immutable evidence.

---

# 9. Work Item Correlation

Raw activities belonging to the same logical work should be grouped into one Work Item.

Use signals such as:

```text
Issue number
MR number
Issue/MR links
Branch names
Commit messages
Labels
Milestones
Project
Ticket IDs
Release names
Configurable keywords
```

Example:

```text
feature/TSC-123
Issue #123
MR !1108
Commit "TSC delivery fix"
```

should ideally become:

```text
Work Item: TSC-123
```

rather than four independent records.

---

# 10. Correlation Confidence

Store confidence for automatically derived relationships:

```text
High
Medium
Low
```

Examples:

High:

```text
MR directly references Issue #123
```

Medium:

```text
Branch includes TSC-123
```

Low:

```text
Commit message contains "TSC"
```

Allow managers to correct mappings.

Do not overwrite raw activity.

Store corrections/overrides separately.

---

# 11. Priority / Workstream Configuration

Allow Engineering Managers to define current priorities.

Example:

```text
TSC Production
Platform Core + Extension
Mobile Coupon Claim
Cash Rewards Phase 2
Release Observation Issues
Salesforce Connector
```

Priorities should include:

```text
Name
Description
Team
Priority order
Status
Owner
Target date
Release date if applicable
Keywords/project mappings
```

---

# 12. Priority Alignment

Every Work Item should be classified as:

```text
Aligned
Supporting
Unplanned
Unknown
```

Do not automatically interpret `Unknown` as bad work.

Surface it for manager review.

Allow manager override.

---

# 13. Work Classification

Where possible classify work as:

```text
Planned Feature
Enhancement
Defect
Hotfix
Production Support
Technical Maintenance
Unplanned
Unknown
```

This helps managers see whether planned roadmap work is being displaced.

---

# 14. Work Lifecycle

Use a configurable engineering lifecycle.

Default:

```text
Backlog
→ Development
→ Code Review
→ QA Ready
→ QA
→ PPRD / Pre-production
→ Release Ready
→ Production
→ Completed
```

Do not assume all projects use exactly the same lifecycle.

Allow stage mappings to be configured.

---

# 15. Meaningful Progress Detection

The system should identify **stage movement**, not activity volume.

Examples of meaningful movement:

```text
Development → MR Opened
MR Opened → Approved
Approved → Merged
Merged → QA Ready
QA Ready → QA
QA → PPRD
PPRD → Release Ready
Release Ready → Production
Issue → Closed
Blocker → Resolved
```

Represent as:

```text
↑ Meaningful Progress
```

---

# 16. Activity Without Stage Movement

Examples:

```text
Several commits to same branch
Multiple comments
Repeated pushes
MR discussion
Investigation
Code changes without lifecycle transition
```

Represent as:

```text
→ Active / No Milestone Movement
```

Do not treat this as poor performance.

---

# 17. Daily Progress Indicators

Use:

```text
↑ Meaningful progress
→ Active / no stage movement
⚠ Blocked / attention needed
↓ Slipping / delayed
✓ Completed
```

Never generate:

```text
Developer productivity score
Commit score
Activity score
Leaderboard
Most active developer
Least active developer
Performance ranking
```

---

# 18. Blocker Detection

Detect explicit and possible blockers from:

```text
GitLab comments
Failed pipelines
Unresolved discussions
Missing approvals
Waiting for review
Waiting for QA
PPRD/environment problems
External dependencies
Product decisions
Release dependencies
No movement on high-priority work
```

Blocker categories:

```text
Technical
QA
Environment
Product Decision
External Team
Review
Release
Infrastructure
Unknown
```

If blocker detection is inferred, display:

```text
Possible blocker
```

Do not present an inference as confirmed fact.

---

# 19. Manager Attention Rules

Create a **Manager Attention** section containing only exceptions that may require intervention.

Examples:

```text
Priority has not moved for 2–3 working days

MR waiting for review for more than 1 working day

QA-ready item has not entered QA

Release approaching with unresolved work

Cross-team dependency blocking committed item

High-priority work waiting on environment

Excessive active WIP

Significant unplanned work

Failed deployment/pipeline

Missing owner

Missing target date
```

All thresholds should be configurable.

---

# 20. Stagnation Detection

Suggested defaults:

```text
High-priority development item:
Warning after 2 working days without meaningful movement

MR awaiting review:
Warning after 1 working day

QA-ready item:
Warning after 1 working day without QA progress

Release-ready item:
Warning based on proximity to release date
```

Respect weekends and configured company holidays where such calendar support exists.

---

# 21. WIP / Context-Switching Detection

Calculate genuinely active work items per member.

Example:

```text
Active WIP: 5
Recommended: 2–3
```

Flag:

```text
Possible context-switching risk
```

Do not call it poor productivity.

Do not include completed, dormant, or waiting items in active WIP without reason.

---

# 22. Core Manager Data Model

For each work item derive:

```text
Work Item
Owner
Contributors
Team
Priority
Work Classification
Current Stage
Progress Today
Previous Stage
Blocker
Risk
Next Action
Target Date
Last Meaningful Progress
Manager Attention
Evidence
```

---

# 23. Suggested Domain Entities

Adapt these concepts to the existing schema:

```text
Team
TeamMember
GitLabFeed
GitLabActivity
Priority
WorkItem
WorkItemActivity
ProgressSnapshot
Blocker
ManagerAttention
ManagerOverride
```

Potential fields:

```text
Priority

id
name
teamId
ownerId
priorityOrder
status
targetDate


WorkItem

id
externalReference
title
project
ownerId
teamId
priorityId
classification
stage
status
targetDate
lastMeaningfulProgressAt


GitLabActivity

id
gitlabEventId
memberId
project
eventType
title
url
timestamp
rawPayload


ProgressSnapshot

workItemId
date
previousStage
currentStage
movement
summary
blocker
risk
```

Do not blindly create these tables if equivalent models already exist.

---

# 24. Processing Pipeline

Implement:

```text
GitLab Feeds
    ↓
Fetch
    ↓
Parse
    ↓
Normalize
    ↓
Deduplicate
    ↓
Resolve Team Member
    ↓
Resolve Project
    ↓
Correlate Work Item
    ↓
Map Priority
    ↓
Determine Stage
    ↓
Compare Previous State
    ↓
Detect Progress
    ↓
Detect Blocker
    ↓
Detect Manager Attention
    ↓
Store Snapshot
    ↓
Render Dashboard
```

---

# 25. Main Engineering Manager Dashboard

Create a manager dashboard route following existing application conventions.

Conceptually:

```text
/manager/progress
```

Primary table:

| Priority | Owner | Team | Progress Today | Stage | Blocker | Target | Manager Attention |
| -------- | ----- | ---- | -------------- | ----- | ------- | ------ | ----------------- |

Filters:

```text
Date
Team
Owner
Priority
Project
Stage
Status
Manager Attention
Work Classification
```

Default:

```text
Today
All authorized teams
Active priorities
```

---

# 26. Dashboard Sections

The manager landing page should answer:

```text
What moved today?
What didn't move?
What is blocked?
What needs me?
```

Recommended sections:

```text
1. Priorities Moving Today
2. Priorities With No Movement
3. Blocked Work
4. Manager Attention
5. Release / Production Readiness
6. Cross-Team Dependencies
7. Unplanned / Support Work
8. Team Progress
```

---

# 27. Priority View

Example:

```text
TSC Production

Status: 🟢 On Track
Stage: Release Ready

Today:
Business changes merged.
Admin changes merged.
API changes merged.

Contributors:
Selvam
Saravana
Jawahar

Next:
QA/PPRD confirmation

Blocker:
None

Target:
11 Aug
```

---

# 28. Team View

Group work by configured team.

Example:

```text
CORE

TSC Production
Owner: Selvam
Stage: Release Ready
Progress: ↑
Next: PPRD validation


QA

Rewards Expiry
Owner: Selvam
Stage: Validation
Progress: ↑
Blocker: Expiry-enabled test tenant unavailable
```

Teams must come from configuration, not hardcoded presentation logic.

---

# 29. Person Drill-Down

Provide a secondary person-level view.

Show:

```text
Current priorities
Current work items
Today's meaningful movement
Blockers
Next milestones
Unplanned work
Active WIP
GitLab evidence
```

Example:

```text
Selvam

TSC Production
↑ Moved to Release Ready

Advanced Search
↑ Admin/API integration completed
Mobile validation pending

Rewards Expiry
↑ Hotfix merged
PPRD validation pending

Unplanned Work
1 production-support activity
```

This is for context, not ranking.

---

# 30. Evidence View

Every derived conclusion must be explainable.

Example:

```text
Advanced Search
Stage: Integration Complete

Evidence:

10:52 — Admin MR !2463 merged
12:26 — API Proxy MR !286 merged
12:07 — Mobile MR !195 approved
```

Each evidence item should link to GitLab when possible.

Manager must always be able to answer:

```text
Why did the system classify this as progressing?
```

---

# 31. Daily Manager Summary

Generate a concise manager-oriented summary.

Example:

```text
Engineering Progress — 10 Aug

Overall:
3 priorities moved forward.
1 priority is blocked.
2 items reached release-ready/integration-complete stages.

Major Progress:
- TSC delivery changes merged.
- Advanced Search Admin/API integration completed.
- Rewards-expiry hotfix merged.

Manager Attention:
- PPRD expiry validation blocked by test-environment availability.
- Mobile regression validation remains pending.

No Movement:
- Cash Rewards Phase 2.
```

Prefer deterministic structured data for facts.

---

# 32. DSM View

Create a compact DSM mode.

Per owner show only:

```text
Priority
Yesterday's Movement
Today's Milestone
Blocker
Target
```

Example:

```text
Selvam

TSC
Yesterday:
Merged to main

Today:
Complete release validation

Blocker:
None

Target:
11 Aug


Advanced Search

Yesterday:
API/Admin integration completed

Today:
Mobile regression validation

Blocker:
None
```

Allow:

```text
Copy as Markdown
Export
```

---

# 33. Planned vs Unplanned Work

Provide team-level views showing:

```text
Planned Work
Unplanned Work
Production Support
Defects
Hotfixes
Technical Maintenance
```

Focus on whether unplanned work is displacing committed priorities.

Do not equate unplanned work with poor performance.

---

# 34. Weekly Trend View

Provide weekly management indicators:

```text
Priorities completed
Priorities progressed
Items blocked
Items stagnant
Unplanned work
MR review delays
QA waiting time
Cycle time
Production completions
Release readiness
```

Avoid commit count as a KPI.

---

# 35. Manager Overrides

Allow authorized managers to:

```text
Change priority
Change owner
Change lifecycle stage
Set target date
Mark blocker
Clear blocker
Change classification
Merge work items
Split work items
Mark unplanned
Ignore irrelevant activity
Correct correlation
```

Never alter the original GitLab event.

Store managerial corrections separately.

---

# 36. Feed Health Monitoring

Since the feature depends on GitLab feeds, provide feed-health monitoring.

Track:

```text
Member
Feed enabled
Last successful fetch
Last event received
HTTP status/error
Parsing error
Last failure
```

Example:

```text
JayapalMuruganandham      Healthy
KumarSaravana             Healthy
DuraisamyManikandaprabu   Healthy
RajGowtham                Healthy
SankarasubbuRamanathan    Healthy
SubburajanJawahar         Healthy
VeluruPreethi             Healthy
SubramanianRuthrakkanth   Healthy
SelvamKadarkarai          Healthy
```

When a feed fails:

```text
Feed data unavailable
```

Never infer:

```text
No work happened
```

from a failed or stale feed.

---

# 37. AI Usage

If the existing application has LLM capability, AI may help with:

```text
Summarizing long discussions
Extracting possible blockers
Grouping semantically related work
Generating manager-readable daily summaries
Classifying ambiguous work items
```

AI must not be the source of truth for:

```text
MR merged status
Issue status
Pipeline status
Deployment status
Dates
GitLab actor
Environment
Commit SHA
```

These must come from GitLab/system data.

All AI-derived statements should retain evidence links and confidence.

---

# 38. Permissions

Respect existing authorization.

Possible roles:

```text
Engineering Manager
Team Lead
Administrator
Individual Contributor
```

Managers should only see teams/projects they are authorized to manage.

Do not expose GitLab activity or feed details outside authorized boundaries.

---

# 39. API

Follow existing API conventions.

Conceptually:

```text
GET /api/manager/progress
GET /api/manager/progress/daily
GET /api/manager/progress/weekly

GET /api/manager/team/:teamId
GET /api/manager/member/:memberId

GET /api/work-items/:id
GET /api/work-items/:id/evidence

PATCH /api/work-items/:id

GET /api/gitlab/feed-health
```

Do not use these exact routes if existing project conventions differ.

---

# 40. Performance

Do not parse all Atom feeds when the user opens the dashboard.

Use:

```text
Background ingestion
+
Normalized persistence
+
Progress snapshots
+
Efficient dashboard queries
```

Add appropriate indexes for:

```text
Date
Member
Team
Priority
Work Item
Stage
Manager Attention
Project
GitLab Event ID
```

---

# 41. Testing

Add automated tests.

## Feed Parsing

Test:

```text
Push
Commit
Branch creation
Branch deletion
MR opened
MR approved
MR merged
MR closed
Issue comment
Issue closure
```

## Idempotency

Processing the same Atom entry multiple times must not duplicate activity.

## Correlation

Test:

```text
Issue + branch + MR + commits grouped correctly

Unrelated activities remain separate

Confidence levels applied correctly
```

## Lifecycle

Test:

```text
Development → Review
Review → Approved
Approved → Merged
Merged → QA Ready
QA → PPRD
PPRD → Production
```

## Blockers

Test:

```text
Waiting for review
Failed pipeline
Environment unavailable
Explicit blocker comment
Cross-team dependency
```

## Manager Attention

Test threshold behavior.

## Permissions

Managers cannot access unauthorized teams.

## Feed Failure

Feed outage must not become "no work".

---

# 42. UI Principles

Use the application's existing design system.

Prioritize:

```text
Outcomes
Milestones
Risks
Blockers
Dependencies
Next Actions
Manager Attention
```

over activity volume.

Status indicators:

```text
🟢 On Track
🟡 Attention
🔴 Blocked / Risk
⚪ No Movement
✅ Completed
```

Avoid unnecessary dashboards and excessive charts.

The manager should understand the team's state within a few seconds.

---

# 43. Example Input

Suppose Selvam's feed contains:

```text
Approved Business MR !1108
Merged Business MR !1108

Approved Admin MR !2463
Merged Admin MR !2463

Opened API Proxy MR !286
Approved API Proxy MR !286
Merged API Proxy MR !286

Approved Mobile MR !195

Merged Rewards Expiry hotfix

Commented that PPRD validation cannot currently proceed because an appropriate tenant is unavailable
```

Do not display:

```text
Selvam
10 activities today
```

Instead derive:

```text
TSC Production

Status:
🟢 On Track

Stage:
Release Ready

Movement:
↑

Today:
Business/Admin/API delivery changes progressed to main.

Next:
QA/PPRD release confirmation.


Advanced Search

Status:
🟡 Attention

Stage:
Validation

Movement:
↑

Today:
Admin/API integration completed.
Mobile changes approved.

Next:
Mobile regression validation.


Rewards Expiry

Status:
🟡 Attention

Stage:
PPRD Validation

Movement:
↑

Today:
Hotfix merged.

Possible Blocker:
Suitable expiry-enabled PPRD tenant unavailable.

Manager Action:
Resolve test-environment dependency.
```

---

# 44. Desired Manager Behaviour

The dashboard must help the manager ask:

```text
Which committed deliverable moved?

What milestone changed?

What remains before Done?

What is blocking the next step?

Who owns that next step?

Are we still on target?

What requires my intervention?
```

The system should not encourage questions like:

```text
Why did this developer only make two commits?

Who generated the most GitLab activity?
```

---

# 45. Acceptance Criteria

The feature is complete when the Engineering Manager can open one dashboard and immediately understand:

1. What are our current priorities?
2. Which priorities moved today?
3. What meaningful milestone changed?
4. What did not move?
5. What is blocked?
6. What dependencies exist?
7. What work is unplanned?
8. Who owns the next action?
9. What is approaching QA/PPRD/release/production?
10. What requires manager intervention?
11. What evidence supports every conclusion?
12. Are GitLab feeds healthy and current?

The Engineering Manager should no longer need to manually open each person's GitLab Atom feed.

---

# 46. Implementation Sequence

Follow this implementation order:

```text
1. Inspect repository and architecture

2. Identify reusable GitLab/feed components

3. Design team/member/feed configuration

4. Implement secure feed configuration

5. Implement Atom feed parser

6. Implement normalized GitLab activity model

7. Implement scheduled/idempotent ingestion

8. Implement work-item correlation

9. Implement priority mapping

10. Implement lifecycle/stage inference

11. Implement meaningful-progress detection

12. Implement blockers/risks

13. Implement manager-attention rules

14. Implement progress snapshots

15. Implement dashboard APIs

16. Build Engineering Manager dashboard

17. Build Priority view

18. Build Team view

19. Build Member drill-down

20. Build Evidence drawer

21. Build DSM view

22. Build weekly trend view

23. Implement manager overrides

24. Implement feed-health page

25. Add tests

26. Run lint/typecheck/tests

27. Fix regressions

28. Document architecture and configuration

29. Provide final implementation summary
```

Do not rewrite unrelated application modules.

Prefer incremental implementation with clean commits.

---

# Final Product Goal

Build an Engineering Manager system that transforms:

```text
"What did everyone do today?"
```

into:

```text
"What important outcomes moved today,
what is blocked,
what is next,
and where does the manager need to intervene?"
```

GitLab activity is evidence.

**Delivery progress is the product.**
