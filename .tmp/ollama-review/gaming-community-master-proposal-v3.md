# Master Proposal: A Self-Organizing Gaming Community

> **The community's job isn't to keep people playing the same game. It's to make sure that changing games doesn't end relationships.**

A healthy community should survive the disappearance of any game, any moderator, any creator, and any member without losing its identity.

**People → Relationships → Groups → Games.**

**How relationships are supposed to form here.** Repeated interaction and ordinary conversation are the principal mechanisms through which this design attempts to turn co-play into durable relationships. The system's job is to make those repetitions easy to reach, not obligatory to attend. "Attempts to" is doing real work in that sentence: the mechanism is a design proposition this community intends to test, not a settled finding.

**What success means, stated as one outcome.** Success is relationship continuity across game changes — after a member or a group stops playing Game A, do relationships formed there continue into another activity, another game, or simply into staying in touch? Activity inside any single title is a leading indicator at best. It is not the target, and a design that maximizes it is optimizing for the wrong thing.

**Systems automate logistics. People create relationships.** "Systems don't run the community" overclaims — scheduling, archiving, and pod lifecycle genuinely do coordinate a great deal. What they must never do is manufacture the relationships themselves.

**The real enemy is entropy, not friction.** Communities rarely die from bad rules. They decay: people change jobs, become parents, move, switch games, drift. Removing friction doesn't stop any of that, and a design aimed only at friction is aimed at the wrong thing. What a system *can* do is narrow — it can't preserve a relationship, since only people do that, but it can make sure that changing games, going quiet, or coming back doesn't force a relationship to end. That's the whole ambition, stated honestly.

**The test this document is judged against is two people, not two hundred:**

```
Two people play together
  → they join a pod
  → they make a shared memory
  → they bring someone else in
  → a group forms
  → the group survives the game changing
```

If a rule below doesn't serve that sequence, it shouldn't exist.

**The irreducible core — five things, and everything else is scaffolding.** This document is long, and length invites the wrong reading: that all of it must exist before any of it works. It doesn't. If this launched tomorrow with thirty people, five mechanisms would be non-negotiable:

1. **Circles** — permanent belonging that outlives any game, made real through recurring rituals. A circle with no recurring reason to meet is a label, not a belonging; the ritual is not decoration on top of the circle, it is what the circle is made of.
2. **Pods** — temporary groups beneath them, forming and archiving freely.
3. **The Commons** — somewhere to go when the games stop mattering and the people don't.
4. **Ambient spaces** — places to just be around, with no signup and no attendance.
5. **Shared Memory** — a record of what happened, written by the people it happened to.

Everything past those five — voting, seasonality templates, spotlight rotation, enclaves, creator tooling, the advisory layer, cross-platform mirroring — is scaffolding for problems that only appear at scale. A community running on the five above is complete, not unfinished. Anything that would break the five is a mistake; anything that merely adds to them can wait, arrive late, or never arrive at all.

**Core versus operating environment.** The five mechanisms above are the social core. Safety controls, minimal moderation, and newcomer protection are operational prerequisites for running that core responsibly; they are not additional definitions of belonging. Recurring ritual used to sit in this list. It has been moved into Circles, because a recurring reason to meet is the thing that makes a circle exist rather than a condition for running one safely. Automation, voting, mirrors, and AI remain optional scaffolding.

**Three kinds of claim.** This document mixes things that research supports, things it is proposing to find out, and things it is building because it anticipates a failure. Conflating them is how a design document starts believing its own hypotheses. The full assignment is the list below, and the tags appear inline at the points where the distinction changes what someone should do; Appendix N holds the evidence behind them.

- **[E] Evidence-supported** — reasonably well supported by published work outside this community. Repeated interaction matters to group cohesion; researchers consistently describe player communities at micro, meso, and macro scales; governance workload grows with population; volunteer moderators quit from time pressure and from conflict with each other; most members will never write anything.
- **[H] Design hypothesis** — this document's own proposition, unvalidated, and the reason to run a pilot. Circles preserve identity across games; the Commons is where relationships survive when the games stop; Memory improves return and reconnection; two-person pods are the right growth path; ambient presence produces relationships rather than empty rooms; a human guide beats a bot-only arrival.
- **[O] Operational safeguard** — engineering or governance built because a specific failure is anticipated. Perimeter friction, the two-key lockdown, cooling threads, appeals separation, pod-scoped attendance, the AI restrictions, steward rotation.

**The honest position on evidence.** Published research supports several of the *mechanisms* this design uses. It does not support the *outcome* this design claims. No study measures whether relationships survive a change of game — the retention literature measures why people keep playing a particular title, which is a different and in one important respect opposite question (see Appendix N). The cross-game claim at the centre of this document is genuinely novel and genuinely untested. Everything marked [H] is here because it is worth finding out, not because it is known.

**Three layers.** The design separates: **social philosophy** (People → Relationships → Groups → Games), **community operating model** (Circles, Pods, Commons, Ambient, Committed, Memory, and human protection), and **runtime** (Discord, bot, database, APIs, and optional mirrors). Discord is the first runtime, not the definition of the architecture.

---

# PART I — THE FOUR PILLARS

Everything a member actually experiences lives here. Part II is implementation detail for whoever builds and runs the thing — a member never needs to read it.

## Pillar 1: Identity — Community Memory

What the community *is* once the channels are gone: event history, screenshots, member-written guides, milestones, moments.

- **Participants write their own context.** The sentence or two attached to a moment comes from someone who was there — never a bot, moderator, or curator narrating for others.
- **Two paths to archiving**, so significance isn't decided by popularity: ordinary preservation requires a save threshold scaled to pod size or one independent participant corroboration; a Golden Record requires the higher threshold or two independent corroborators. A six-person raid clear matters as much as a viral screenshot.
- **Capture is staged, so the archive fills even when nobody writes anything.** Most people won't document anything, and a system that needs them to will end up an abandoned channel. So participation is three separate asks, each optional and each smaller than the last:
  1. **Automatic capture** — the bot records that an event happened, who was there, when. No one does anything. This alone produces a usable record.
  2. **One-click preservation** — a single tap at the moment an event ends, while people are still in the channel, marking it worth keeping. No typing.
  3. **Optional storytelling** — the sentence or two of context, added by a participant whenever they feel like it, including days later.

  Only stage 3 needs a writer, which means the archive still works at a 5% storytelling rate. Realistic expectation is that most moments get stages 1 and 2 and never get stage 3; that's a functioning Memory, not a failed one.
- **Storylines — narrative, not just storage.** An archive answers *what happened*; a memory answers *what it was like*. "Raid completed" is documentation; "six exhausted people wiped for four hours before it finally clicked" is identity. So any member can thread related items into a named storyline at any time — unlimited, no nomination, no quarterly cap, no selection process. Threading is authorship, not curation: nothing competes for a slot, so nothing loses. Two pieces of hygiene keep unlimited from becoming unnavigable: the bot *suggests* merging storylines with identical tags and overlapping items (authors decide), and an author can mark a storyline **closed**, so a newcomer reads a finished arc rather than wondering whether it's still live.

**Open is the useful state, not the untidy one.** A closed storyline is an archive; an open one is something people are still writing together, and that is the version that does social work. Communities that persist around games with no shared session — speedrunning routes, maintained mods, category rulesets — cohere around an artifact that is still unfinished and that anyone can add to tonight. Storylines are meant to be that: **prospective shared artifacts**, threads members expect to revisit and extend, closed only when the thing they describe is genuinely over.
- **A newcomer's view of the past.** A filtered Memory view for the first weeks showing only circle highlights, low-stakes events, and welcoming moments — onboarding through history rather than dropping someone into years of accumulated context.
- **Member-controlled privacy:** opt out, redact, or delete (7 days), no justification needed.
- **Survives Discord** via an external tag-organized static mirror — with a higher consent bar than in-Discord storage, since content leaving the server is a stronger claim on someone's material (details in Part II).

## Pillar 2: Belonging — Circles, Pods, and Arrival

**Circles are permanent; pods are temporary.** This is the structural correction that makes the formula true instead of aspirational — organizing primarily around games is *Games → Groups*, backwards from what this document claims. So people belong to a circle first, and games come and go beneath it:

```
Explorers          Builders           Strategists        Competitors
├── Star Citizen   ├── Minecraft      ├── Civilization   ├── (PvP pods,
├── Elite          ├── Valheim        ├── Stellaris      │    Pillar 4)
└── No Man's Sky   └── Enshrouded     └── Total War

                        Commons
                   (no game beneath it)
```

A circle matches the playstyle labels from a member's profile. When a game dies, its pod archives and the circle is untouched — your people don't disappear with the game, which is the entire point.

**The Commons is a circle with no games under it, and it's the one this document's thesis requires.** The other four are playstyle identities — how you play. But a formula that runs *People → Relationships → Groups → Games* eventually produces people who have gone all the way through it: members who stayed across five game changes and now show up for the room rather than the activity. *I don't care what we're playing; I'm here because you're here.* Without a Commons, the design's own success stories have nowhere to belong — they linger in circles for games they no longer play, or they drift. **The Commons is deliberately the least organized space here — no steward, no rituals, no pods.** This is a correction to how it was first drafted, which gave it a steward and monthly rituals like any other circle. That was a mistake, and the reason is worth stating: the Commons is where veterans go, so it's where soft standing concentrates by default. Structuring it — giving it an organizer, a calendar, a program — would have turned the senior room into the *governing* room without anyone intending it, creating a hierarchy of circles out of nothing but organizational symmetry. So it stays a lounge and a Memory sink: people, conversation, and whatever they decide to do that evening. It's the destination the philosophy implies, and the right amount of system for a destination is very little.

Two things the Commons never does, because structure alone doesn't prevent drift:
- **It never hosts committed activities.** No rosters, no raid teams, no org ops. A veteran room that becomes the room where raids get organized is an elite raid lobby, which is the exact outcome removing the steward was meant to avoid.
- **It never hosts LFG or activity coordination.** Ambient presence and activity formation stay in circles or pods; the Commons remains social rather than functional.
- **No moderation decision is ever made there.** Conversations happen anywhere; decisions about people go through Pillar 4 channels and nowhere else. The informal version — a few veterans in the lounge reaching a conclusion about someone — is precisely how an unstructured space becomes a governing one.

**Circle membership is multi-select, and that's structural, not cosmetic.** Most people are Explorer *and* Strategist, or Builder *and* Competitor. Forcing a single choice would manufacture exactly the tribalism the document spends effort fighting elsewhere — and circle tribalism is harder to correct than pod tribalism, because circles are permanent while pods archive. Overlapping membership dissolves boundaries by construction: when a large share of Explorers are also Strategists, "Competitors take it too seriously / Explorers never commit" has fewer people left to say it. Cross-circle events help at the margins; overlapping identity is what actually prevents the problem.

**Pods** form automatically inside circles when ~3 members show interest, hibernate on a schedule matched to the game's real cadence, and stay visible while dormant. Full lifecycle mechanics in Part II.

**Circles need their own life, or they're just labels.** A circle whose only activity happens inside its pods dies quietly whenever the pods go quiet. So each circle has monthly circle-native rituals — an Explorer debrief, a Strategist map clinic, a Competitor VOD review — that belong to the circle rather than to any game, and one **circle steward** whose entire scope is: schedule one ritual a month, welcome arrivals tagged to that circle, surface circle-relevant memories. No moderation, no authority, no decisions about people.

Monthly is a floor, not a target. If a circle can sustain something weekly, it should — the ritual is the circle's heartbeat, and the irreducible core now says so directly.

**Arrival — apprenticeship, not just suggestions.** A bot that suggests, surfaces, and recommends helps people *discover* each other; it doesn't help them *bond*. So a new member is offered a real person:

- An opt-in **guide** — an existing member, opted in on their side too, matched by circle — for roughly the first two weeks. Not a mentor, not an authority: someone to answer questions and bring them to one thing.
- A deliberate first arc: **first conversation → first event → first memory contribution → first cross-circle activity.** None of it mandatory, all of it designed rather than left to chance.
- **Guides are protected, because guide supply is the real bottleneck.** Max 2 active newcomers at once, **a mandatory 3 weeks off after every 4 newcomers guided**, and a private guide channel for comparing notes and venting. The rest period is automatic and not declined — a guide who never stops is a guide about to stop permanently. Guiding also carries a short briefing before a first newcomer — roughly ten minutes, not a curriculum: no pressure to move off-platform, no private DMs without the newcomer's consent, and a concrete first task (bring them to one event, show them one Memory item). Micro-guiding pairs a volunteer with the newest and least-connected person in the building; the established-account floor is a check on who, and this is a check on what. Burned-out guides don't quit loudly — the system just silently degrades to bot-only, and arrival stops feeling human.
- **Supply gets replenished, not just rationed.** Caps and rest periods protect the guides you have; they don't produce new ones, and a community that grows faster than it recruits guides ends up bot-only anyway. So once a month each circle runs a deliberately low-stakes event framed exactly as *if you like welcoming people, try it once* — one newcomer, one evening, no ongoing commitment. Trying it once is how most people discover they're willing to do it again; a formal application program is how they discover they aren't.
- **Micro-guiding, offered alongside the full role rather than beneath it.** Guide supply realistically looks like 20 volunteers, 8 active, 3 good, 1 irreplaceable — so the two-week arc will never be the common case, and pretending otherwise sets up every arrival that isn't one to feel like a downgrade. Both are presented as normal ways to arrive, neither ranked above the other. Micro-guiding is deliberately **event-based, not a standing role**: you opt in when an event is starting, you're matched with one newcomer for that evening, and the arrangement ends when the event does. Nobody is on a micro-guide list, nobody accumulates micro-guide status, and there's no queue to check. Making it a role would recreate the commitment it exists to avoid. Guide availability doesn't scale linearly with membership — a community of 100 might have 10 guides, 3 good ones, and 1 person everything quietly depends on. So there's a smaller ask alongside the full role: **one evening, one newcomer, no matching, no ongoing obligation** — show someone around a single event and you're done. Most people will say yes to that who would never say yes to a fortnight, and it's the same principle as co-hosting versus hosting: lower the commitment rather than degrade the experience.
- **Growth spikes get an honest degraded mode, not a pretend one.** When arrivals outpace available guides, the bot pairs newcomers into a small cohort with one guide — **hard cap of 3, never more**, because the failure mode is one guide quietly ending up with ten people and an orientation becoming a lecture rather than queueing them or dropping straight to bot-only. Named plainly: a 1:1 guide is a relationship, a 3:1 cohort is an orientation — real, useful, and not the same thing. It has one genuine advantage worth stating, which is that newcomers who arrive together often bond with each other rather than only with the guide. It stays the fallback, not the plan; dressing it up as a feature would be the kind of spin this document has otherwise avoided.
- If nobody's available to guide at all, the member gets the bot-suggested version instead. Better than nothing, weaker than a person, and honest about which one they got.

**Returning after time away.** Missing an event is solved by rituals recurring. The harder problem is social: *everyone became friends while I was gone, where do I belong now?* A returning member gets a plain re-entry view — which pods in their circle are active now, which people they've previously played with are still around, and the next few low-stakes things they could show up to. Not forced reintegration; just making return cheap instead of awkward.

## Pillar 3: Coordination — Playing Together

**Not everything should be scheduled.** Scheduling isn't neutral infrastructure — it creates routine, routine creates expectation, expectation creates obligation, and obligation is FOMO wearing a calendar. A community where everything runs through signups behaves very differently from one where you can just show up. So activities split in two, and the split needs a mechanism rather than a preference, because anything ambient drifts toward the calendar the moment someone wants to guarantee attendance:

- **Coordinated** — raids, tournaments, large events. Full scheduling: timezone-aware, open enrollment until a fixed lock time, no first-come slots, auto-created voice channels, and opt-in reminders. Reminders use quiet hours, default to one reminder per activity, and respect a per-member daily ceiling; additional eligible reminders are deferred into a digest.
- **Ambient** — looking-for-group, drop-in sessions, small co-op. **No enrollment, no reminders, no attendance visibility.** Those three are the mechanism: the moment any of them attaches, obligation follows. An ambient activity is a lit room, not an appointment — nobody signs up, nobody is missed, nobody is counted.

**Ambient needs presence to be visible, or Discord kills it by default.** This is a platform problem, not a design one: Discord is built to push events, RSVPs, and notifications, and offers essentially nothing for passive gathering. Left alone, ambient rooms sit empty because nobody knows anyone's in them. The fix has to respect the mechanism above, which rules out the obvious approach — a weekly "3 people are playing, drop in?" nudge is a reminder with different wording, and reminders are one of the three things ambient is defined by not having. What works instead is **pull, not push**: a persistent, glanceable indicator of who's currently in an ambient space, visible when you look and silent when you don't. Presence you can see, never presence that pages you.

Specified precisely enough that an implementer can't drift back toward obligation: each ambient space shows **how many people are in it right now and which circles they're from — no names, no notifications, no pings, no expected-attendee count, no history of who was there earlier.** Counts and circle icons, nothing more. Names would make absence noticeable; an expected count would make it an appointment; history would make it attendance.

- **Committed** — raids, org operations, anything that needs a specific number of specific people in specific roles. Full enrollment plus **roster commitment, role slots, backups, and attendance tracking** — three things ambient forbids and coordinated doesn't require. Detailed below, because it's the one category that genuinely conflicts with the rest of this document.

**Recurrence anchors; ambient de-obligates.** An earlier draft made ambient the default and treated the calendar as the antagonist. That was the wrong ranking. What appears to hold relationships together is a recurring reason to meet — a night that comes back — while ambient space is what makes that recurrence safe to have, because missing one week costs nothing and there is still somewhere to be. The calendar's job is to make it easy to show up often without making any single night feel mandatory. Coordination is for things that break without it. Commitment is for things that break without *specific people*, and should stay the smallest category of the three.

Stated carefully, because the evidence here is indirect: work on multiplayer games finds that shared, repeated, structured activity slows the decay of social ties *inside* a game, and long-running scenes built on weekly local events have outlived the individual titles they were built around. Neither of those measures relationships surviving a change of game. The ranking above is therefore **[H]**, not **[E]** — recurrence over availability is this document's bet, not a demonstrated result.

**Committed activities — the honest exception.**

A 20-person raid with 18 people isn't a smaller raid, it's a cancelled evening: two no-shows cost eighteen other people their night. Star Citizen org operations have a similar shape for different reasons — fewer hard role requirements, but heavy dependence on specific *assets* (whoever owns the ship is a single point of failure) and long uninterrupted blocks where one disconnect ends the run for everyone. These activities break three rules this document otherwise holds firmly, and the honest move is to say so rather than pretend a raid is just a well-attended drop-in.

*What committed activities need that the other categories deny them:*
- **Roster commitment with role coverage.** Signing up means signing up. Slots are typed (tank/healer/DPS, pilot/gunner/engineer), because open enrollment produces four healers and no tank. Backups are recruited at the same time as the main roster, not after someone drops.
- **Attendance visibility inside the pod.** A raid leader needs to know who actually shows. This isn't surveillance; it's the difference between a raid that runs and one that doesn't.
- **Consequences for repeated no-shows** — losing a raid slot to someone on the backup list. Real, proportionate, and nothing more than that. A stated default so pods don't invent harsher systems from scratch: **two unexcused no-shows in six weeks moves you to the backup list.** Pods can loosen it; the point of naming a default is that the alternative is each pod reinventing one, usually angrier.

*The firewall that makes this compatible with everything else:* **commitment data is scoped to the pod that opted into it, permanently and completely.** Attendance and reliability are visible inside that raid pod and nowhere else. They never reach a member profile, never enter Community Memory, never appear in moderation logs, never inform matchmaking or spotlight, and never become a community-wide reputation. **A person can be an unreliable raider and a completely full member of this community**, and those two facts never meet. If a pod dissolves, its attendance history dissolves with it — nothing is retained, exported, or carried into a new pod.

**Committed-pod cleanup:** a committed pod with no completed run for eight consecutive weeks returns to ordinary pod status unless its members explicitly renew the committed mode. If it later archives, all pod-scoped attendance data is deleted with it.

*Raid leaders hold real authority, scoped to the run.* Someone has to make binding calls — assignments, strategy, when to call it for the night — and consensus doesn't work at 2am on a wipe night. Pretending this is stewardship rather than authority would be dishonest, so it isn't. It's constrained the way the other authority in this document is constrained: it exists only during the run, it's taken by volunteering rather than granted by anyone, it covers the activity and never the people (a raid leader has no standing in any dispute, no moderation role, no say over anyone outside the raid), and **it never converts into community authority** — the same firewall that applies to PvP skill and creator visibility.

*The limit, stated plainly: raiding is not FOMO-free and cannot be made so.* Sequential progression means missing four weeks leaves you behind in gear and mechanics. That's the game's design, not the community's, and no scheduling policy removes it. What the design can do is **contain** it — keep raid pressure inside the raid pod so it doesn't leak into the circles, the Commons, or anyone's standing anywhere else. Someone who steps away from raiding should lose a raid slot and nothing else: not their circle, not their friends, not their place. Containment is the achievable goal; elimination isn't.

**Choosing games** happens two ways, and only one involves a vote:
- **Tier 1** (community-wide support, promotion, prioritized slots): nomination → advisory analysis → ranked-choice vote, public aggregate results, and an outcome review at the next cycle. Nomination authorship is private by default and becomes public only when the author opts in. A preference outcome has no moderator override. Safety, legal, and technical-availability interventions are a separate human authority: they must be narrowly scoped, recorded with reasoning, and cannot be used to replace an unpopular preference with a moderator's taste.
- **Tier 2**: any group that reaches the pod threshold gets a pod, no vote required. Minority interests never need to win an election to exist.

The Tier-1 outcome review is mechanical and retrospective, not a second veto. At the next cycle the community records one of three states: **continue**, **occasional**, or **retire for now**. The review considers whether the game produced viable activities, not whether every member liked the vote. A retired game can be proposed again later.

**Fun is a design requirement, not a byproduct.** Every other rule in this document is defensive — it prevents a specific unfairness. Prevention alone produces a community that is fair and joyless, which is its own way of dying. So the calendar has a positive shape by default, not just an absence of problems:
- **Rituals over one-offs.** Recurring named nights people can anticipate — Screenshot Night, Patch Preview Night, Multi-Game Raid Night, Seasonal Kickoff — rotated across circles. Anticipation is the anti-FOMO mechanism that actually works: nothing is missable when it comes back.
- **Low-stakes by default.** Most events should require no preparation, no schedule commitment, and no skill floor. The high-effort raid night is the exception, not the template.
- **Celebrate what happened.** Milestones, anniversaries, in-jokes, and returning members get marked. This is what turns Pillar 1's archive into something alive rather than a museum.
- **Chaos slots, so structure doesn't strangle spontaneity.** One slot a week where any circle can propose anything up to 24 hours ahead. Rituals that are too regular and too formal become performances; this is the deliberate hole in the schedule. Selection isn't purely random, though — pure randomness lets whichever circle proposes most often win most often, so picks rotate across circles over time, and proposals carry a circle tag and an effort level (drop-in vs. organized) so nobody shows up expecting one and finding the other.
- **Rotate ritual times across time zones.** Fixed ritual hours quietly make everyone outside two continents a second-class member — the same structural exclusion the language rules exist to prevent, in a different form.

## Pillar 4: Protection — Moderation and Continuity

**Rule-based, action-based.** Defined violations, reported and confirmed, rule cited, tiered consequences. No character scores, no trait judgments, no penalty for being loud or competitive.

**Accountability, not objectivity.** Edge cases genuinely require judgment about which rule applies. The system doesn't pretend otherwise — it requires that judgment be written down with its reasoning and be appealable, in the member's own language where needed.

**Visibility without stigma.** A member sees their own full log; the community sees aggregate statistics only. Warnings expire at 90 days, timeouts at 180.

**Recognition, kept out of moderation entirely.** Positive-behavior reporting has been removed. Reports are social — friends report friends, popular members accumulate more of them — and unlike violation reports, which need a channel because consequences depend on them, positive recognition already exists four other ways (spotlight rotation, activity credit, Community Memory, hosting itself). A fifth channel added social bias without adding anything real.

**A rung between doing nothing and issuing a warning.** Most friction isn't a violation yet, and forcing moderators to choose between ignoring it and formalizing it pushes them toward premature punishment. So there's a **cooling channel**: anyone in a heated thread can move it there voluntarily — slow mode on, explicit de-escalation framing, no moderation record, no member record, and no consequence attached. It's a tool, not a sanction. A separate temporary safety counter may record cooling invitations for the initiating moderator only; it expires after 30 days, is never shown with a violation history, and may only flag that a moderator presence could help.

Purely voluntary use has an obvious hole, though: in the threads that need it most, nobody self-selects into it — stepping away first reads as conceding. So a moderator can also *invite* a thread in, with neutral non-accusatory framing (*this is getting heated, let's move it here for a bit*). The move stays voluntary and creates no moderation or member record; what changes is that someone else made the first move, which is the whole difference between a tool that exists and a tool that gets used.

**Cooling threads expire, because a permanent one is worse than none.** Left open-ended, this space stops being a cooling-off tool and becomes a venue — the place unresolved conflict lives indefinitely, rehashed weekly, which is more corrosive than the original argument. So a cooling thread auto-archives after 24–48 hours. If something genuinely isn't resolved by then, it's either a rule matter (Pillar 4's ordinary process) or a disagreement people are entitled to keep having in a normal channel — but not a standing grievance with a dedicated room.

**Mediation, for conflict that is not a violation.** Cooling is a time-out; it stops a thread getting worse and does nothing to repair it. Between "do nothing" and "open a case" there needs to be a repair path, because most damaged relationships here will involve no rule being broken at all. So any member may request **mediation**: a voluntary, time-boxed conversation facilitated by a neutral member or a moderator who is not party to it. It is not a sanction, produces no moderation record and no member record, and cannot be required of anyone. Either party may end it at any point with no inference drawn. Three categories, kept apart on purpose: a preference conflict is a conversation, a damaged relationship is mediation, a rule violation is moderation.

**Moderators burn out, and human-only judgment is expensive.** That's the real cost of the stance above, and pretending otherwise breaks the system quietly. Moderators can declare a sabbatical for a fixed period at any time, no explanation; the system tracks load across the team and prompts rotation before someone hits the wall rather than after. A permitted break that nobody takes is worth nothing, so there's also a stated cadence — **no one stays on active duty more than roughly six weeks without a break** — tracked and surfaced openly to the mod team. Making rest the expected rhythm rather than an admission of strain is the difference between a right on paper and one people use.

**Moderators need a conflict path too.** Time pressure is only half of moderation burnout; disagreement inside the team is the other half. A moderator who disputes a proposed finding writes the disagreement before action is taken. The case then moves to an uninvolved moderator; if the active team cannot supply one, it waits for a randomly selected panel of uninvolved established members rather than being decided by the people already in conflict. The same separation applies to appeals: **the moderator who made or materially shaped the original decision never decides its appeal.** Appeals may raise factual error, rule misapplication, new evidence, or a process failure. This is separation of instance, not a second hierarchy.

**Bad actors — friction at the perimeter, never in the interior.**

Every other threat in this document assumes a member acting in good faith who might drift, burn out, or lose their temper. That leaves a real gap: someone who joins specifically to harm. Worse, the mechanisms most exposed are exactly the ones built to be frictionless — a provisional two-person pod and normal three-member threshold can be targeted by throwaway accounts; participant-flag archiving needs one corroborator, so two accounts can push a scam link into permanent Memory; the cooling channel has no moderation or member record, which makes it a griefer's ideal loop (bait, get invited to cool off, repeat); micro-guiding hands an unvetted volunteer a private line to the newest, most vulnerable member in the building; and report-based moderation is itself attackable through coordinated false reports.

The resolution isn't to abandon the anti-friction philosophy. It's that **friction belongs at the door, not in the rooms.** Everything past the perimeter stays as open as designed.

*At the perimeter:*
- Discord verification level at medium or high, plus a bot-enforced account-age minimum. Discord's native levels provide verified-email and short server/account waiting periods; they do not provide the days-based age gate this design requires.
- AutoMod on links and known scam patterns, tightened for accounts inside the probation window below.
- Rate limits on every creation action — pods, threads, storylines, reports. A raid that can't create faster than a human can't exhaust anything.

*A probation window (Default: first ~7 days or first real participation, whichever comes first):* a new account can talk, play, join pods, and attend anything — the entire social experience is open immediately, because that's the point of the design. What it can't yet do is **create a pod, corroborate a Memory flag, or serve as a guide or micro-guide.** These are the three highest-leverage actions in the system, and none of them is something a genuine newcomer needs in their first week. Guiding in particular is the highest-trust position in the whole document and currently has the lowest barrier; it gets an explicit floor: an established member, never a new account.

*Corroboration means independent, not just plural.* Two accounts that arrived together and have never interacted with anyone else aren't two people confirming a moment — they're one person twice. Memory corroboration requires an account outside the probation window with prior unrelated activity.

*The cooling channel has a temporary safety signal, kept separate from member records — and members are told so upfront.* Cooling invitations are counted only for moderators, expire after 30 days, are never displayed alongside violation history or in an aggregate view, and are inadmissible in appeals or moderation decisions. A member who ends up in cooling five times in a month is not in trouble; the signal can only indicate that a moderator presence may help in a future thread.

Because private counting is exactly the shape of thing that breeds *am I being secretly scored*, it goes in the member-facing rules verbatim rather than being discovered later: **cooling-off invitations may be counted temporarily to detect repeated conflict. They are never treated as violations, never appear on your record, expire after 30 days, and cannot affect an appeal or consequence.** A quiet mechanism found out is worse than a disclosed one.

Disclosure alone isn't enough, though, because the risk isn't only that members suspect a shadow score — it's that moderators start reading one. A count sitting beside someone's violation history becomes soft evidence in a human head whatever the rules say. So three hard limits: cooling counts **expire after 30 days**, are **never displayed alongside violation history or in any aggregate view**, and are **inadmissible in an appeal or a moderation decision**. They exist to answer one question — is the same person in the same fight every week — and nothing else. Operationally that means exactly one permitted use: **flagging that a thread might need a moderator present.** Never justifying a timeout, a warning, or any other consequence. If a member's behavior warrants action, that action rests on a cited rule and a confirmed report, the same as everyone else's.

*Coordinated reporting is a violation like any other.* Organizing false reports against a member is itself a defined offense, handled through ordinary Pillar 4 process. Reports arriving in a coordinated burst against one target are flagged for that possibility rather than treated as corroboration — volume isn't evidence.

*Raids and server-level attacks* are an availability problem, not a governance one: lockdown mode (pause invites, restrict posting to established members, halt all creation actions) is a **[H] human-only** switch, and every steward and moderator should know where it is before it's needed. It's the one place in this document where speed matters more than deliberation.

It's also the only unilateral emergency power here, which means it needs the constraints every emergency power needs and usually doesn't get:
- **Two keys** — a moderator plus a steward, so panic isn't a single-person decision. If a raid is genuinely in progress, finding a second person takes under a minute; if it takes longer than that, it probably wasn't a raid.
- **Neither key can be someone currently party to a conflict.** This is the specific misuse the other constraints don't stop: a steward mid-argument, a moderator under pressure, someone being targeted or doing the targeting. Lockdown halts posting and creation for everyone, which makes it a usable weapon in a dispute if the person holding it is in one. Anyone involved steps back and finds two people who aren't.
- **Two hours by default**, extendable only with a written note saying why. It expires on its own, so nobody can quietly leave the community locked.
- **Announced where members already know to look.** A dedicated status channel, stated in the rules, so that when posting suddenly freezes people have somewhere to check instead of assuming they've been silenced. Unexplained silence is how a defensive measure reads as a punitive one.
- **A short public post-mortem afterward** — what happened, what was done, what changed. This is the part that matters most: an emergency power used without explanation is how emergency powers stop being emergencies. If lockdown gets flipped three times in a month, the post-mortems make that visible to everyone rather than only to the people flipping it.

**Five firewalls that never bend:**
- PvP standing never converts into community authority.
- Creator visibility never converts into community authority.
- Raid leadership and raid reliability never convert into community authority — a raid leader's word is binding during the run and carries nothing outside it, and a member's attendance record never leaves the pod that keeps it.
- In-game guild membership never converts into community membership. Whether someone holds a slot in the Free Company, made the roster, or plays on the right regional server is a game-account fact that determines nothing here. Games hand out scarcity for free; converting it into standing is a choice, and this community declines it.
- Operational authority never converts into social authority. Whoever can deploy the bot, restore the database, repair a stuck lifecycle state, or trigger a lockdown holds real and necessary power over *systems*, and none at all over people. The two are different kinds of authority and this document had been treating them as one, which pushed it toward weakening the operational kind in order to protect against the social kind.

**Credit sits on the activity, not on the person.** This replaces per-member contribution counters, which two rounds of review kept catching as an aristocracy problem — and the usual fix, shortening the window from lifetime totals to recent snapshots, doesn't work. "Recently hosted 3 events" still ranks someone above "0," it just ranks over 90 days instead of forever, and it additionally punishes the long-serving member who's finally taking the rest this document tells them to take. The problem was never the time range; it was attaching a number to a person at all.

So: *"this event was hosted by Priya"* — a credit, permanently attached to the thing that happened, visible in Community Memory. Not *"Priya has hosted 47 events"* — a scoreboard attached to Priya. Recognition survives completely; accumulation doesn't. And it answers the question a counter can't: **someone who contributes nothing is a full member**, because there is no per-person tally on which they could read as zero.

That distinction is enforced in retrieval, not only in presentation. Host attribution remains readable on an activity, but it is excluded from the People-tag index, profile queries, aggregate exports, and count endpoints. Otherwise "credit on the activity" is one query away from the scoreboard it claims to remove.

Contribution records never unlock permissions, privileges, moderation power, or a vote that counts more. Recognition, never advancement — and now, recognition of *work*, not ranking of *people*.

**Discoverability, without rebuilding the scoreboard.** Removing per-person counters removed something genuinely useful along with the ranking: a newcomer can no longer easily find out *who should I ask about raid setups, or Stellaris, or writing a guide.* The tempting fix is a set of community roles — Event Host, Guide Writer, Archivist — but that's a hierarchy with better manners, awarded by someone, held by some and not others, exactly what the firewalls exist to prevent. The narrow version that works: **self-declared, self-editable "ask me about" tags** on a profile. *Ask me about: Stellaris, raid comps, writing guides.* Nobody grants them, nobody earns them, nothing counts them, and anyone can add or drop one at any moment. Descriptive rather than comparative — it answers *who knows this* without ever answering *who has done more.* Two guardrails keep them meaningful: **a cap of five per member**, and each tag tied to a pod or circle the member actually participates in. Uncapped self-declared expertise inflates — everyone claims everything, newcomers get pointed at people who tagged aspirationally, and the tags stop answering the question they were added for.

**What this does not fix, stated plainly.** Someone whose name appears in twenty Memory entries accumulates standing anyway. Removing the counter removes the scoreboard, not the perception — and there's a fair objection that it makes soft power *harder to audit*, since there's no longer a number to check against. The response isn't that the problem is solved; it's that an explicit tally creates a hierarchy rather than merely reflecting one, and a visible ranking is a thing people optimize toward in a way they don't optimize toward showing up in other people's stories. Informal standing is unpreventable in any community that has ever existed. What this design prevents is *formalized* standing, and what it counts on instead is the two firewalls above plus rotation: soft standing that can't convert into a role, a permission, or a vote is standing that stays social. That's a real limit, not a solved problem.

**Friend groups need no feature.** People who play together across five games already have a group DM or a private channel, and that works. Naming them as a formal entity is how you end up with health metrics for friendships and lifecycle rules for people who like each other. Circles cover playstyle belonging; pods cover games; anything smaller and more personal than that is deliberately left alone — **the correct amount of system for a friendship is none.**

**When relationships outgrow the community, that is success.** Ten people who met here and left for their own private server did not fragment the community — they took the thing it exists to produce. This needs saying because every retention instinct in community design pulls the other way: toward keeping activity inside the walls, treating departure as leakage, adding reasons to stay. But the stated goal is that changing games shouldn't end relationships, and a relationship that outgrew the room is that goal reached, not evaded. So there is deliberately no mechanism here to detect, discourage, or win back a group that drifts into its own space — no clique metric, no re-engagement campaign. The door stays open, the re-entry view works whenever they use it, and the community counts it as a win rather than a loss.

**Stewardship, not authority.** Communities do depend on a small number of highly active people; pretending otherwise doesn't make it false. The distinction that matters: authority says *I control this space*; stewardship says *I maintain this space for now*. So the roles that must exist (crossplay matrix upkeep, event organizing, circle hosting) are named, **time-boxed, rotating, and voluntary** — real responsibility, publicly credited, with no decision-making power over other members and an expiry date by default. Concretely: **a maximum of 3 months in a steward role, then a mandatory break of at least one term.** Without a hard stop, time-boxed roles drift into the same three people forever by pure inertia, and nobody notices because nobody chose it.

**Social authority and operational authority are separate things.** *Social* authority — who belongs, who is important, who is subject to a consequence — is what this document resists, and it should keep resisting it. *Operational* authority — who may deploy, restore, reconfigure, disable a broken integration, or act during an attack — has to be real, has to be held by named people, and should get stronger rather than weaker as the system grows. A community where everyone has principles and nobody may act is its own failure mode. The steward charter therefore reads: **stewards hold authority over systems and none over people.**

**Rotation has a cost, and it is not only lost knowledge.** Research on player groups finds that a group's activity is influenced by how many organizers it has and how connected those organizers are to its members. A hard three-month cap rotates people out at roughly the point they become connected. The cap stays, but with three corrections: circle-steward terms may run longer than moderator terms; rotations are **staggered rather than synchronized**, so a circle never loses all its continuity at once; and every handoff includes an **overlap period** where the outgoing and incoming steward run one ritual together. Documentation transfers the system; overlap transfers the relationships.

Design intent doesn't govern social perception, though: people defer to whoever looks in charge, especially in a crisis. Two things counter that. A one-line **steward charter** — *stewards maintain systems; they do not decide outcomes* — shown to members wherever a steward's name appears, in the role description and circle info, not filed away where only operators read it. And a crisis protocol that routes any decision about a person to moderators explicitly, never to whichever steward happens to be present.

Neither fully solves it, and the document shouldn't pretend otherwise: stewards will still be read as soft leaders by some people some of the time. One cheap thing does help more than another rule would — a visible **rotation clock** beside the role (*circle steward, 3 weeks remaining*), which attacks the perception at its source by making impermanence something members see rather than something they're told. Beyond that it's a permanent tension to manage with framing, not a bug to add mechanisms against; every additional rule aimed at it would cost more legibility than it buys.

## The AI Question — What Members Are Owed

Part II specifies what AI may *decide* here: nothing about a person, ever. That's the governance answer, and it's airtight. It is not the answer members actually want, which is a different question — **how much AI am I dealing with, and did I agree to it?**

That question deserves a straight answer rather than a technical one, because the suspicion behind it is earned. Gaming audiences have watched generative art replace artists, AI voices replace actors, and chatbots replace support staff, and a community whose entire pitch is *relationships over systems* announcing an AI layer sounds, reasonably, like the opposite of what it claims. Nobody owes this design the benefit of the doubt.

**No AI in social spaces.** AI never analyzes, summarizes, ranks, or recommends from ordinary member conversation, ambient presence, Memory storytelling, or social relationships. The only exception is an explicitly requested, moderator-scoped conflict summary; it remains advisory, labeled, source-checked, and unavailable when a relevant member has opted out.

**Four commitments, stated to members rather than buried in an appendix:**

1. **This community runs without AI — and below about 300 active members, it runs with none at all.** That isn't a stance, it's arithmetic: maintaining an advisory layer costs more volunteer hours than it saves at that size, so there is simply nothing to opt out of. If the community never grows past 300, this section stays theoretical. Above it, every advisory function is still Phase 5 — built last, never load-bearing, degrading to manual rather than to a guess, expiring on a 12-month clock unless someone actively renews it. Switch the whole layer off tomorrow and nothing here stops working; some things get more tedious for moderators. Almost no platform can make that promise, and it's the strongest thing this design has to offer on the subject.

2. **AI does chores, not conversations.** No AI members, no AI personalities, no bot that talks like a person, no generated content presented as someone's contribution. Community Memory is participant-authored by rule — a model never narrates what a moment meant. The things AI touches are queues, drafts, and trend lines.

3. **You can always see when a model was involved.** Every advisory output carries a visible *model-generated* tag and is logged as advice. The temptation runs the other way — make the layer invisible and avoid the argument entirely — and that's refused deliberately: hiding it would trade a social problem for a trust problem, and the trust problem is worse. Members are told which things are automated even when telling them is inconvenient.

4. **You have a right to a human, guaranteed where it counts.** Any member can decline AI involvement in **moderation cases, appeals, and translations of decisions** — anywhere consequences land — with no explanation required, no disadvantage, and a human handling it instead. That guarantee is scoped deliberately rather than promised universally: for low-stakes logistics (a suggested event slot, a queue ordering), you can still opt out, but nobody promises a volunteer will personally redo it. A guarantee that can't be honored at 3am on a Tuesday is worth less than a narrower one that always is.

**The one place this genuinely cuts both ways, stated honestly.** A member contesting a moderation decision in their second language is better served by machine translation with human verification than by no path at all. Removing it for the sake of AI purity would harm precisely the people the language rules exist to protect, and the honest position is to say so rather than pretend every AI use is equally optional. It stays, it's labeled, a human verifies it before anything is acted on, and any member can refuse it and wait for a human translator instead.

**The test each advisory function has to pass** isn't only "does this decide anything" — nothing here does — but **"would a member resent knowing this ran?"** Some pass trivially: nobody objects to a bot noticing a game's patch cadence. Some don't. A model summarizing a conflict thread means something read a fight you were in, and *it was only advisory* is not a comforting sentence to be on the receiving end of. That one is opt-in per case by the moderator, not a default. When the two tests disagree, this one wins.

---

# PART II — IMPLEMENTATION APPENDIX

Mechanics for whoever builds and operates this. **Principle** = must stay true. **Default** = today's best guess, expected to be tuned.

**Design target (operating hypothesis): 75–300 active members, upper bound around 500.** These numbers are a starting assumption for Phase 0–1, not a validated limit. They were reached by two internal lines of argument — social reasoning and the channel budget — neither of which is external evidence, and the largest comparable study of self-governing game communities worked with target sizes whose *maximum* sits inside this band (see Appendix N). Phase 0 and Phase 1 exist partly to test whether the range is right. An **active member** is a member who has completed at least one meaningful community interaction in the previous 30 days: joining or hosting an activity, participating in a circle or pod conversation, preserving Memory, guiding, or contributing to a decision. Reading, passive Discord presence, and receiving a notification do not count. Every threshold below uses this definition. Below ~75 active, most of this machinery is unnecessary and Phase 0's manual version is the correct implementation. Above ~500, this stops being a community and becomes an institution: guides can't scale, moderators can't hold context, and Discord itself starts to be the bottleneck. The intended response at that point is **subdivision** — a second community with its own circles, sharing rituals and Memory conventions — not adding hierarchy to manage one large one. A design that claims to work at every scale works well at none.

**Threshold defaults, in one place.** These are defaults, not principles, and Phase 0 may change them based on observed behavior.

| Mechanism | Default | Purpose |
|---|---:|---|
| Provisional pod | 2 members / 14 days | Protect the two-person test |
| Normal pod | 3 members, or 2 plus one shared activity | Confirm a viable group |
| Established-member requirement | Outside probation window | Keep creation friction at the perimeter |
| Ordinary Memory corroboration | 1 independent participant | Prevent popularity bias |
| Golden Record corroboration | 2 independent participants | Reserve permanence for stronger consensus |
| Guide load | 2 active newcomers | Protect guide capacity |
| Guide recovery | 3 weeks after 4 guided newcomers | Prevent invisible dependency |
| Growth cohort | 3 newcomers per guide | Honest degraded onboarding |
| Pod sunset | 12 months dormant | Remove ghost structure while preserving Memory |
| AI advisory layer | 300 active members | Keep optional machinery proportional to need |

**Two norms that keep this appendix from leaking into the community.** Meta-heavy players — MMO, strategy, and sim people especially — genuinely enjoy systems, which makes it tempting to teach the machinery to everyone. Resist it:

1. **We don't talk governance at people.** Governance discussion lives in one dedicated meta channel. Everywhere else, members experience effects, not mechanics. This works as a *social* norm, not a rule enforced against anyone: in circle rituals and pods, governance talk gets a gentle redirect — *good one for the meta channel* — never a warning or a violation. The structural separation only holds if the culture does the redirecting, since a rule against discussing systems would itself be a system members have to know about.
2. **The member view test, applied to every new rule before it's added:** *does a member need to know this exists to feel safe and have fun?* If no, it stays in Part II and never becomes something anyone is expected to understand.
3. **The operator test, which nothing else in this document was protecting:** *if a moderator or steward has to hold more than about five systems in their head to do their job, the design is too complicated* — regardless of how invisible it is to members. The member view test keeps complexity away from members; it does nothing for the people running it, and the people running it are the ones who quit. Anything that fails this gets simplified, automated to the point of requiring no memory, or removed.

The implementation requirement that makes this test real is one **operator cockpit**, not seventeen admin surfaces. It shows only what needs attention now: reports and appeals, cooling escalations, guide shortages, upcoming coordinated activities, pods near lifecycle transitions, governance changes, and system health. It links to detail but does not require operators to remember which subsystem owns the state.

## 0. Automation Classification — What Runs Itself, What AI Advises, What Only Humans Decide

Nearly everything below is already deterministic by design. That's deliberate, and it's the reason an AI layer can be added safely — but only in a specific place. Every subsystem carries one of three tags:

- **[D] Deterministic** — a fixed rule with a fixed threshold. No model, no judgment, no variance. Same inputs always produce the same result, and anyone can verify why. Adding AI here would make the system less predictable and less auditable, which is the opposite of what this document optimizes for.
- **[A] AI-Advisory** — a model produces *information a human then acts on*: a summary, a translation draft, a flag, a suggestion, a detected trend. It never takes the action itself. The output is always visible as a suggestion, never applied silently.
- **[H] Human-Only** — a decision about a person's standing in the community. Never automated, never AI-determined, regardless of how capable the model becomes.

**The line that never moves.** No AI-determined violations, no AI-set consequences, no AI-decided appeals. Pillar 4's entire claim is that judgment is honest, written down with cited reasoning, and appealable. An AI verdict breaks all three: its reasoning is reconstructed after the fact rather than actually held, it isn't accountable to anyone, and there is no one to appeal *to*. "Human oversight" of automated moderation reliably decays into rubber-stamping under volume — which is precisely when the stakes are highest and the review is thinnest.

**The [A] layer does not exist below ~300 active members.** This is the first constraint and it overrides the rest, because the honest accounting says the overhead exceeds the benefit at this design's normal size. Look at what maintaining an advisory layer costs: named owners, annual renewal reviews, labeling, advisory logging, resentment testing, per-member opt-outs, and prompt changes routed through the decision log — all of it volunteer time. Look at what it buys at 120 active members: a moderation queue readable by hand in a few minutes, and trend detection over a community small enough that people already notice. The machinery costs more than the tedium it removes, and building it anyway would contradict this document's own preference for removal over addition. So it is gated by size, not just sequenced last: below ~300 active, there is no [A] layer, and everything below describes what happens *if* a community grows past that point.

**Six further constraints, once it does exist.** The first four follow from the failure model; the last two follow from what members are owed (Part I).
1. **Prompt changes are governance changes.** If a model shapes what gets flagged, summarized, or surfaced, then changing its instructions changes how the community is governed. Those changes are posted to the decision log like any other rule change — otherwise governance quietly moves somewhere nobody voted.
2. **Every [A] function degrades to nothing, not to a guess.** If the model is unavailable or wrong, the affected process falls back to its deterministic or manual form. No subsystem may *depend* on AI to function — the "bot maintainer leaves" scenario assumes every rule is written down and reproducible, and an interpretive layer nobody can fully specify would break that assumption.
3. **Every [A] output is visibly labeled and logged as advisory.** Anomaly flags, trend reports, and summaries carry a *model-generated* tag on their face and are recorded in the decision log as advice, never as findings. This closes the last hidden-lever gap in the design: an [A] function that takes no action still steers *attention*, and attention steered invisibly toward certain problems or certain groups is governance by another name. A moderator should always know when their eye was directed there by a model rather than by a person.
4. **Every [A] function sunsets and must be renewed annually.** Infrastructure becomes invisible, invisible becomes permanent, permanent stops being questioned — and an advisory function nobody has examined in three years is governance by inertia. So each one expires on a 12-month clock and has to be actively renewed, with the review asking not *did the model change* but *did the community change*. A function that no longer earns its place simply lapses, which is the cheapest possible way to remove machinery: doing nothing. For that lapse to be a decision rather than an accident, each function has a **registry entry**: a named owner (a moderator or steward), a one-line scope of what it touches, and a visible review date. "Expires unless someone renews it" means nothing without a someone.
5. **Per-member opt-out, honored without question.** Any member can decline AI involvement in anything concerning them personally — moderation case, appeal, translation, summarization. The flag sits on the member, applies automatically wherever it's relevant, requires no reason, and carries no disadvantage beyond a slower queue. A moderator handling that member's case sees the flag before the advisory output, not after.
6. **Every [A] function passes the resentment test before it ships.** Not *does it decide anything* — none of them do — but *would a member resent knowing this ran?* Functions that touch a member's own words or conflicts fail this by default and become opt-in per case by the moderator rather than automatic: conflict-thread summarization is the clear example. Functions that touch aggregate patterns (patch cadence, decline trends, queue ordering) pass. When this test and the member-view test disagree, this one wins — a member never having to think about the machinery is worth less than a member not resenting it.

| Subsystem | Class | Notes |
|---|---|---|
| Pod creation, archive, hibernation, sunset, split | **[D]** | Fixed thresholds only. |
| Pod merge proposal + veto | **[D]** | Proposed mechanically; members decide. |
| Seasonality template assignment | **[D]** | Set at creation from known cadence. |
| Seasonality template *correction suggestions* | **[A]** | Bot suggests; pod consensus applies. |
| Vote tallying, ranked-choice resolution | **[D]** | Never model-assisted. |
| Nomination caps, cooldowns, Tier-2 conversion | **[D]** | |
| Coordinated-voting anomaly flags | **[A]** | Flagged publicly for humans to weigh; never auto-invalidates a vote. |
| Scheduling, enrollment, lock times, reminders | **[D]** | |
| Spotlight rotation | **[D]** | Stated criteria, visible schedule. |
| Activity credit | **[D]** | Attached to the event, never tallied per member. |
| Memory archiving, Golden Record, decay, pruning | **[D]** | |
| Quarterly digest assembly | **[D]** | Chronological, unranked — ranking would need judgment. |
| Cross-platform mirroring and inbound triage routing | **[D]** | |
| Conflict-thread summarization for moderators | **[A]** | **Opt-in per case**, not automatic — fails the resentment test as a default. Summary only; the moderator reads the source before acting, and never runs it at all for a member who has opted out. |
| Report triage / "this may need attention" | **[A]** | Prioritizes a queue. Never decides an outcome. Steers attention, so labeling matters most here. |
| Translation drafts (announcements, summaries) | **[A]** | |
| Translation of rules, decisions, appeals | **[A] → [H]** | Drafted by model, **verified by a bilingual steward before it's acted on**. Member can decline the draft and wait for a human translator. |
| Slow-decline trend detection | **[A]** | Surfaces the trend; the response is the community's. |
| Whether a violation occurred | **[H]** | |
| What consequence applies | **[H]** | |
| Appeal outcomes | **[H]** | |
| Removals | **[H]** | |
| Rule changes and prompt changes | **[H]** | Both logged publicly. |
| Lockdown mode during a raid | **[H]** | Speed matters here more than deliberation; expires unless renewed. |
| Spam/scam-link filtering (AutoMod) | **[D]** | Pattern matching at the perimeter, not judgment about a member. |
| Coordinated-report burst detection | **[A]** | Flags possible coordination for a human; never invalidates a report by itself. |
| Roster slots, lock times, backup promotion | **[D]** | Mechanical scheduling; no judgment. |
| Pod-scoped attendance records | **[D]** | Recorded and displayed inside one pod; never joined to anything else, deleted with the pod. |
| Who leads a run, and every call during it | **[H]** | Real authority, scoped to the run, never converting outward. |

**What this buys and what it costs.** The [A] layer absorbs the genuinely tedious work — reading long threads, triaging queues, drafting translations, noticing a decline nobody felt yet. What it deliberately does not buy is a self-governing server: every decision that touches a person still requires a person, and that's the cost that keeps the accountability chain intact.


## A. Community Memory mechanics
Categories (Events, Screenshots, Guides, Milestones, Moments) and tags (Game, Pod, Circle, Season, Patch, People, Mood), with tag/category/seasonal search. **Every item carries provenance:** capture stage (automatic, one-click, or authored), participants, timestamp, pod, circle, corroborators, author of any context text, and privacy state. Provenance exists so the archive is auditable and so a disputed item can be traced to who was actually there — it is metadata on the item, never a queryable record of a person, and it inherits the same exclusion that governs host attribution. Decay: screenshots 12 months unless re-saved, guides 90 days unless updated, moments 6 months unless re-tagged. **A pod's decay clocks pause while it hibernates.** When the pod sunsets, every item still retained at that point keeps its participant-authored context and becomes exempt from routine decay; deletion and privacy requests still apply. Otherwise the memories of a dead game would be the ones most likely to disappear, reversing the purpose of Memory. **Golden Record** (permanent, exempt from decay) via either a pod-scaled save threshold at a higher tier *or* a participant flag corroborated by two others — never a flat global save count, which would reintroduce popularity bias. Quarterly guide pruning, annual inactive-pod media pruning, automatic duplicate removal. Moderation logs never feed Memory in either direction.

*External mirror consent.* Mirroring content outside Discord is a stronger claim than storing it inside, so it takes explicit per-member consent about what may be included, rather than a blanket opt-out. Faces are blurred and names removed by default in mirrored items; anyone appearing in an item can flag it as sensitive; deletion requests are honored within 7 days in the mirror as well as in Discord. Low-weight, non-Golden-Record items are pruned from the mirror annually to keep it a durable identity record rather than an indiscriminate copy.

*Quarterly digest.* Every quarter the bot posts a plain resurfacing of that period — Golden Record items, notable additions, milestones — so the archive is something the community re-reads rather than a museum nobody visits. Deliberately unweighted: it shows what the period contained, in chronological order, rather than ranking moments against each other. Ranking would quietly reintroduce the popularity filter that the two archiving paths exist to avoid. It is, however, **grouped by circle** — a chronological list across the whole community reads as a changelog, while the same items under Explorers, Builders, Strategists give each circle a visible arc. Grouping is shape without hierarchy; nothing is ranked, only sorted.

## B. Circle and pod mechanics
**Circles** are permanent, multi-select (members belong to as many as fit), never archive, and host cross-circle events. **Each pod has one primary circle for placement and lifecycle ownership, plus any number of discovery tags for other circles whose members actually participate.** A cross-playstyle game therefore has one thread rather than duplicate pods, but appears in every relevant circle's filtered view. Primary-circle placement is organization, not identity, and can be changed by pod consensus. The Commons remains the exception: it has no pods, no steward, and no rituals by design (see Pillar 2); it is a lounge, not a program.

*Creation (Default):* **Two members** may create a **provisional pod** for 14 days. It becomes a normal pod when a third participant joins or the pair completes one shared activity. A normal pod therefore requires **either three participants, or two participants who completed one shared activity during the provisional period**, and at least one established member outside the probation window with prior activity in that circle. A scheduled event or creator tag may surface interest, but neither can bypass the established-member requirement or create a pod by itself. The prior-activity requirement matters as much as the number: it keeps the philosophy honest (pods should emerge from relationships, not from signups), and it answers the proliferation worry without blocking the two-person test. Three accounts that all arrived yesterday aren't an emerging group, and three coordinated accounts can't spawn normal pods. Lowered from 5 deliberately: two or three friends trying an obscure indie title *is* the two-person test this document is built around, and a threshold of 5 forced exactly that group into DMs until they recruited strangers — hiding early momentum from the rest of the circle at the moment it's most fragile. The existing archive rules do the cleanup, so a pod that doesn't take costs nothing but a channel for a fortnight. The fair objection is proliferation — 100 members across 30 games could yield 20–30 pods, which is real channel sprawl and a discovery problem. **This is the first number Phase 0 should measure**, since it's the one change most likely to be wrong in either direction, and three months of manual running will say more than any argument about it.

*Seasonality templates* set the hibernation window — Live Service ~30 days, Expansion Cycle ~90, Annual Release ~180, Dormant Classic ~365, Ongoing 7-day warning/14-day archive. Pods adjust their own template by internal consensus.

*Template self-correction.* A pod tagged wrong at creation would otherwise stay wrong forever, so every 90 days the bot compares a pod's observed patch cadence and activity rhythm against its assigned template and **suggests** a change where they diverge. The suggestion is informational and the pod applies it by its own consensus — the bot never reassigns a template on its own, since the pod knows why it's quiet and the heuristic doesn't.

*Hibernation:* archived but visible, keeps tags and Memory. Wakes on patch detection, a creator event, or ≥5 member requests (vs. ≥3 for ordinary archived pods). Dormant pods are excluded from spotlight and merge proposals.

*Revival cooldown (Default):* 14 days after a revival before a pod can be revived again, so a pod that wakes and immediately goes quiet doesn't churn back and forth. Purely mechanical — no written justification is required with a revival request, since reading and weighing stated reasons would put a person back in the middle of a process designed not to need one.

*Sunset:* a pod dormant for 12 months with no revival requests sunsets — otherwise the server slowly fills with ghost pods nothing ever ends. Everything the pod contributed to Community Memory persists; only the empty channel structure goes. A sunset pod can still be recreated from scratch by the ordinary creation threshold if interest genuinely returns.

*Merging:* proposed (never instant) on overlap in both game **and** activity tags; 72-hour veto window; when both pods are small (<10 active), conflict-laden, and under 5% mutual cross-participation, the veto bar lowers but is never removed. Vetoed once → retry in 30 days; vetoed twice → permanently marked distinct.

*When several pods for the same game are legitimate.* The merge rules above say when not to combine pods, but "culturally distinct" needs a definition or it becomes whatever the loudest pod says it is. **The test: a split is legitimate when merging would force people to coordinate who genuinely can't — and illegitimate when it would only force people to socialize who'd rather not.** Constraint, not preference. Equivalently: the dividing axis must describe *what, when, or how* people play, never *who* they play with.

**Legitimate axes** (each one is a genuine inability to be one group):
- **Region or data-centre** — the hardest case. Two groups on locked regional servers cannot play together at all, whatever anyone prefers. Siblings with no parent (see the game-limits section), never a main and a satellite.
- **Clock** — an 20:00 CET group and an 20:00 PT group are not one raid team with scheduling difficulties; they're two groups. Time-zone rotation helps rituals; it doesn't fix a standing roster.
- **Mode** — PvE and PvP are different content with different friction, and this document already treats PvP as needing tighter automod and explicit opt-in. Splitting them is that principle applied at the pod layer, not a new rule.
- **Commitment level** — a committed roster with attendance tracking and a drop-in weekend group should never be the same pod, because committed status is a property the *pod* opts into. One pod can't be half-committed; that's the version where casual members quietly become unreliable members.

**Illegitimate axes:**
- **Skill tier.** "Advanced pod" and "casual pod" ranks people and then houses them accordingly, which is the aristocracy problem with architecture. Note the nuance: the same practical split is fine when named as *commitment level* rather than skill — a committed progression roster and a drop-in group are two activities, while "good players here, others there" is a hierarchy. The framing isn't cosmetic; one names what you're doing, the other names what you are.
- **Preference about individuals.** "We'd rather not be in a pod with X" is exclusion wearing a structural costume, and it's a Pillar 4 matter if it's a real conflict — not a pod split.
- **Nothing at all.** Same game, same mode, same clock, same commitment, different founder. This is what auto-merge exists to catch.

One consequence worth stating: **a legitimate split is not a failure of the community and shouldn't be treated as fragmentation.** Two EU/NA raid pods in the same circle, sharing rituals and Memory, are one community playing on two clocks. What holds them together was never the pod — it's the circle above it.

*Splitting (Default):* over 200 active members → General / Builds / LFG / Events. (Distinct from *several pods existing for one game*, covered above — that's about legitimate axes of difference, this is about one pod outgrowing itself.)

*No pod health score.* An earlier revision tracked cross-pod participation, event frequency, incident count, and new-member responsiveness as a health picture feeding spotlight rotation — informational only, never gating access. Removed, for the same reason per-member contribution counters were: a metric that exists gets optimized toward, and "informational only" is what every scoreboard says before it becomes a target. Pods would start performing cross-pod participation instead of having it. The individual facts still exist where they're actually needed — merge proposals read overlap and incident counts directly (above), and cross-circle activity remains a spotlight criterion for *people* — but there is no composite health number attached to a pod, and nothing ranks pods against each other.

*Conflict:* pod-vs-pod hostility is an ordinary violation; 3 confirmed between the same pair within 60 days triggers merge-or-sunset review, with the same veto window.

## C. Voting mechanics
Nomination cap of 2 per member per cycle. Losing nominations can't be renominated the immediately following cycle (a mechanical cooldown, not a "justification" review). The bot surfaces which genre clusters are underrepresented — informational only, never fabricating ballot entries. Coordination and genre-stacking patterns are flagged *publicly* alongside results, never held as silent signals. High-interest losses auto-convert to Tier-2 pods. Cadence monthly (large) or bi-monthly (small); no emergency votes.

## D. Onboarding mechanics
Skippable welcome flow on join. Guide matching within 48 hours where a volunteer exists, bot suggestions otherwise. Pods and circles that respond well to new joiners get surfaced more in suggestions — observed at the moment of use, not accumulated as a score. Light informational 30-day check-in, never scored, never a factor in anything else.

## E. Moderation mechanics
Warnings expire 90 days, timeouts 180, removals permanent for audit. Moderators record cited reasoning; members may add perspective and appeal (translated where needed). Appeals are assigned to an uninvolved moderator and may be based on factual error, rule misapplication, new evidence, or process failure; the original decision-maker is never the appeal decision-maker. If no uninvolved moderator is available, a randomly selected panel of uninvolved established members hears it. A private, member-only Clean Slate acknowledgment every 6 months once logs have expired — never a public badge, since a visible badge exposes moderation status by its absence. Logs never feed matchmaking, pod access, contribution history, or Memory.

## F. Credit and spotlight mechanics
Credit attaches to activities, never as a per-member tally — an event, guide, or ritual records who ran it, and that record lives with the event in Memory. Host attribution is not indexed as a People tag and no API may aggregate it by member. No profile counter, no lifetime total, no recent-activity snapshot; all three rank people, only over different windows. Graduated commitment levels (co-host, help set up) widen who can say yes. Spotlight criteria are stated publicly (breadth of involvement, onboarding support, cross-circle participation), the rotation schedule is visible, no member is spotlighted twice within 30 days, people who rarely appear are prioritized, and any member can opt out. Steward roles are time-boxed and rotating, with the remaining term shown beside the role. If nobody volunteers for something, it doesn't happen that week.

## G. Language mechanics
English for governance, PvP coordination, creator announcements, scheduling. **Language enclaves don't open below ~300 active members** — the same density argument as the [A] layer: at 150 members you might have 15 Greek speakers and 10 Czech, and an enclave of 15 fragments the community rather than serving anyone. Above that threshold, optional comfort enclaves for social conversation, with bot-translated summaries of announcements and vote outcomes, plus a translated appeals path. Monthly cross-enclave events. An enclave with 3 confirmed violations in 30 days sunsets.

*Quiet enclaves get invited, not merged.* An earlier rule folded any enclave under 5 active members for 30 days into a general multilingual space. That's a churn risk rather than a fix: a mixed-language channel serves a shrinking Greek or Czech group worse than their own quiet one did, and the realistic outcome isn't integration, it's those members leaving for an external single-language space. So a thinning enclave gets **direct invitations to cross-enclave events first** — a real attempt to connect it to the wider community — and only archives if it's genuinely inactive, on the same lifecycle terms as any pod. Small isn't the same as dead, and a language enclave is the one place where consolidation costs more than it saves.

*Human verification where translation carries consequences.* Machine translation is fine for announcements and general summaries. It is not fine for the three categories where a mistranslation changes an outcome rather than causing confusion: **rules, moderation decisions, and appeals**. Those get human verification before they're acted on — a bilingual volunteer steward confirms the translation, tracked as an ordinary contribution role. A member contesting a decision in their second language should never lose because a machine rendered their argument badly. Members can also request clarification in their own language at any point, relayed to moderators.

## H. Platform and scheduling mechanics
Platform support is capability-specific rather than a single "has an API" label. Steam account identity can be linked through its public Web API. Riot exposes documented game and account APIs, but member linking requires an approved application and the appropriate production access. Epic integration depends on the product and approved Epic Online Services flow. Xbox, PlayStation, Nintendo, Ubisoft, and EA remain manual and unverified unless an approved integration exists. Publishing to a platform community is assessed separately from account linking; a platform can support identity lookup without offering a community-posting API. A per-game crossplay matrix is maintained by 3–5 rotating stewards, with bot alerts at 60+ days stale. Events aren't created for non-crossplay games without existing platform groups.

*Committed-activity mechanics (raids, org ops).* **Commitment is opt-in per pod and never automatic**, including for games with raids in them — a casual WoW pod doesn't inherit roster machinery just because WoW has raids. It isn't a property of the pod, it's a mode the pod turns on, and it can turn it off. Once on:
- **Typed roster slots** with counts (e.g. 2 tank / 4 healer / 14 DPS; or pilot / gunner / engineer / medic), plus a named backup list filled at signup rather than scrambled for on the night.
- **Asset dependencies flagged at signup** where the game has them — Star Citizen's "whoever owns the Carrack" is a single point of failure worth naming in advance rather than discovering at start time.
- **Commitment lock** at a stated time before the run; after lock, dropping notifies backups automatically.
- **Attendance recorded, pod-scoped — enforced technically, not culturally.** Visible to the pod's roster and its leaders. Stored **local to the pod, in a store that no other subsystem can query**, with automatic deletion when the pod archives. "It never leaves the pod" is a promise until it's a constraint; build it as a constraint, because every future feature will otherwise find a reason to read it.
- **Slot loss is the only consequence available.** Repeated no-shows lose a roster slot to a backup. Not a violation, not a moderation matter, not recorded anywhere outside the pod.
- **A no-show record can be corrected inside the pod.** Attendance is recorded by people and people mistype. Any member may ask the pod to correct an incorrectly recorded absence, and the pod adjusts it. This is a pod-level correction, deliberately *not* a community appeal — routing a raid-slot dispute through moderation would import exactly the standing that the containment firewall exists to prevent.
- **Rotation for leaders too.** Raid leading burns out the same way moderating does; the six-week cadence norm applies here as well, and the backup-leader slot exists so a run isn't cancelled when one person needs a night off.

*Where committed status is refused:* a pod cannot make attendance a condition of pod membership, only of roster slots. Someone who stops raiding stays in the pod, keeps their friends, keeps their Memory, and simply isn't on the roster. The pod is the social unit; the roster is a scheduling artifact.

*Game-imposed limits, and the one rule that survives all of them.* Games don't care about this document's structure. They impose hard caps that cut across it, and the caps differ enough per game that no single mapping works:

| Constraint | Examples | What it breaks |
|---|---|---|
| **Guild/org member cap** | FFXIV Free Companies cap at 512; ESO guilds cap at 500; GW2 guild capacity starts smaller and can be upgraded to 500 | A community larger than the cap cannot all be in one in-game guild |
| **One-guild-only games** | FFXIV: one Free Company per character | No overflow option — membership is genuinely zero-sum |
| **Multi-guild games** | ESO and GW2 allow ~5 guilds per player | Overflow is easy; coordination across them is not |
| **Region / data-centre locks** | Region-locked accounts, limited data-centre travel, separate regional servers | Friends who can't play together at all, permanently |
| **Group and instance caps** | 4–8 for most content, up to 20–40 for large raids | The pod is always bigger than what can play together at once |

**The rule that survives all of it: in-game guild membership is never community membership.** Whoever is in the Free Company, whoever got a slot, whoever is on the EU server — that's a game-account fact, and it determines nothing about standing here. A member outside the in-game guild is a full member of the community: same circles, same Memory, same voice, same everything. This is the same firewall applied to PvP standing and raid reliability, aimed at the one source of hierarchy the community doesn't control and can't remove. Games hand out scarcity for free; the community's job is to refuse to convert it into status.

Practically:
- **The pod is the social unit; the guild is a game feature.** A 30-person pod in a game with 8-person instances doesn't fragment — it spawns runs beneath itself and stays whole. Pods should never be sized to the game's group cap.
- **When a guild fills, sister guilds are peers, never tiers.** No "main guild" and "overflow guild" — that's a hierarchy the game created and the community ratified. Equal names, equal standing, rotating membership if someone wants to move, and everything social (pods, circles, Memory, events) lives above the guild layer where the cap doesn't reach.
- **Never allocate scarce guild slots by merit, contribution, or activity.** That converts a technical limit into a ranking, which is exactly what the credit model was rebuilt to prevent. If slots must be freed, free them by asking who's inactive *in the game* and would rather not hold one — never by asking who deserves them.
- **Region locks can't be fixed, only survived.** If a game splits the group by region, the pod splits into regional siblings with no parent — never a "main" region and a satellite. What holds across the split is everything above the game: the circle, Memory, the Commons, and the friendships. This is the clearest case in the document of a game changing and relationships continuing anyway, which is the entire thesis.
- **Star Citizen's shape specifically:** the main-org / affiliate-org structure maps cleanly onto sister guilds — affiliates are peers, and the org someone flies under says nothing about who they are here.

## I. Creator mechanics
**Why this program exists, since it otherwise reads as an exception to the formula:** community storytelling and event promotion. A creator is someone who makes the community's shared experience legible to itself and visible outward — an extension of Pillar 1, not a separate track. Recruitment is a side effect, not a goal, and the program is explicitly not an education or status program; treating it as all four at once is what made it feel disconnected.

Opt-in ambassador role. Max 3 events/week, 1/day, 1 overlapping a pod event. Cooldowns of 48 hours after major community events and 24 after pod events, waived only on non-discretionary triggers (patch day, expansion launch, detected pod surge, seasonal wake-up) or when ≥3 members of a pod formally request coverage. No scheduling during active pod conflict resolution.

## J. Cross-platform presence
**Discord remains the only place governance, pods, voting, and moderation happen.** Everything else is a door in or a window out.

*Automatable where current API access permits:* Twitch (chat bridge, stream detection), YouTube (comments, live chat, cross-posting), Reddit, Bluesky. *Manual, approval-gated, or budget-gated:* Twitter/X, Instagram and Facebook, and Steam Community publishing. This does not contradict Steam account linking in Section H: identity lookup and community publishing are different API capabilities.

Outbound: Memory highlights, vote results, and event announcements auto-crosspost from content that already exists. Inbound: all comments and mentions funnel into one Discord triage channel — replies happen in Discord, so discussion doesn't fragment across ten venues. Live chat is an ephemeral extension of a creator's activity, never its own pod or hierarchy. Subreddit, Facebook group, and Steam group are mirrors, never branches. Social media support is credited like any other work, on the activity rather than as a personal tally.

*Tone guidance, not rules.* Each platform has a natural register — Twitch for live shared moments, YouTube for long-form memory and guides, Reddit for slower theorycraft, Bluesky/X for lightweight updates. Useful for whoever's posting; deliberately left informal rather than specified, because external platforms are the one place where less structure is correct and a posting policy would add operator burden with no governance benefit.

## K. Platform constraints — Discord's hard limits

These are technical ceilings, not design choices, and two of them shape the architecture directly. Verified as of August 2026; worth re-checking, since Discord changes them rarely but does change them.

| Limit | Value | Consequence here |
|---|---|---|
| Channels per server | **500** (text + voice + categories all count) | The binding constraint. Discord has not been raising it. |
| Channels per category | **50** | Circle nesting cannot absorb unlimited channel sets even before the server-wide cap. |
| Categories per server | **50** | Another reason to keep circles coarse and pods inside forums. |
| Roles per server | **250** (managed bot/booster roles can exceed) | Not a real constraint if roles stay coarse. |
| Active threads per server | **1000** (archived threads unlimited) | Archived is free — this is what makes the pod model work. |
| Forum channel active posts | **1000** | Same shape as threads. |
| Thread auto-archive | 1, 3, or 7 days of inactivity | Maps onto pod dormancy almost exactly. |
| Discord audit-log retention | **45 days** | Moderation and governance events need independent persistence from Phase 1. |

**Pods should be forum posts or threads, not channel sets.** This matters more than it sounds. At roughly four channels per pod (general, LFG, media, voice), 30 pods costs 120 channels, and with circles, the Commons, enclaves, ambient rooms, governance, and categories on top, a server hits 500 somewhere around 60–80 pods. Lowering the pod threshold to 3 made that arrive sooner. As threads inside a per-circle forum, pods cost nothing against the channel budget, and **archived threads don't count against the 1000-thread ceiling at all** — which means hibernation, the mechanic this document already specifies, is free: a dormant pod becomes an archived thread that still reads, still holds its history, and revives on demand. The lifecycle in Section B was designed on social grounds and happens to be exactly what the platform rewards.

Corollary: keep roles coarse. One per circle (5–6 total), plus moderator, steward, and guide. Pod access comes from forum tags, not roles. A role-per-pod scheme would burn the 250 cap and gain nothing.

**Native versus bot-owned controls.** Discord supplies verification levels, AutoMod, invite pausing, slow mode, and — where available — Raid Protection with automated CAPTCHA for suspicious join waves. A days-based account-age gate, probation capabilities, per-action creation limits, the two-key/two-hour lockdown workflow, independent record retention, and anonymous ambient indicators are bot-owned. Phase 1 cannot describe that second set as free configuration; it is the minimum safety implementation.

**Ambient presence needs a second surface.** Discord voice channels display participant names and the bot cannot suppress them. The privacy rule therefore applies to the glanceable indicator: a bot-maintained embed or channel topic shows only current count and circle icons, with no history or notification. Opening or joining the underlying voice channel still reveals the people present through Discord's native UI. This is a known runtime compromise, not anonymous voice occupancy.

**The thread ceiling is an attack surface.** Threads can be created faster than moderators can remove them, and a raid that spawns 1000 threads denies service to the entire server — every forum, every pod, all at once. This is why creation rate limits and the probation window in Pillar 4 are load-bearing rather than precautionary, and why lockdown mode has to halt creation actions specifically, not just posting.

**Independent corroboration of the design target.** The channel budget runs out around 60–80 pods, which at the pods-per-member ratios this design implies lands close to the same place the social reasoning did: comfortable to ~300 active, strained at 500, subdivide beyond. Two unrelated lines of argument reaching the same ceiling is reason to trust it.

## L. Failure model

| Scenario | What happens |
|---|---|
| **Slow decline with nothing visibly wrong** | The most likely death, and the one a crisis-focused model misses entirely. The bot tracks a rolling 90-day trend in *distinct* active members, events held, new-member arrivals, and — the metric that actually tests this document's thesis — **returning-member reactivation rate**. If people who drift away come back, the design works; if they don't, nothing else in the trend matters much. All of it is reported publicly and plainly, because a community that can see itself cooling can respond while there's still something to respond with. Seasonal quiet is distinguished from genuine decline by comparing against the same period in prior cycles and against pod seasonality templates, so a between-patches lull doesn't read as collapse. No automated intervention: the system surfaces the trend and names it; what to do about it is the community's decision, not the bot's. |
| Most popular game dies | Its pod hibernates per template; the circle is untouched. |
| 50% of moderators leave | Rules and cited reasoning are written down — replacements apply the same log. |
| A creator builds a cult of personality | Authority firewall (Pillar 4). |
| Nobody volunteers to host | It doesn't happen that week; graduated commitments widen who can say yes first. |
| Two pods turn hostile | Ordinary violations → merge-or-sunset review with veto window. |
| Community doubles | Pod splitting at 200 active members. |
| Community shrinks 70% | Pods archive per lifecycle; circles, the Commons, and permanent layers remain. Enclaves get cross-enclave invitations rather than forced merging. Below the ~75-member design floor, the correct response is reverting to the Phase 0 manual model, not maintaining machinery for a size it wasn't built for. |
| **A coordinated raid** | Lockdown mode (Pillar 4): invites paused, posting restricted to established members, all creation actions halted. Temporary by construction — expires unless renewed. |
| **Spam or scam-link accounts** | Account-age minimum and verification level stop most at the door; AutoMod catches links; probation limits what a fresh account can do even if it gets in. |
| **Thread-flood denial of service** | Creation rate limits plus probation; the 1000-active-thread ceiling (Section K) is the thing being protected, and archived threads don't count toward it. |
| **Sockpuppets corroborating a fake Memory** | Corroboration requires an independent account outside probation with prior unrelated activity — two accounts that arrived together are one person twice. |
| **A griefer cycling the cooling channel** | Invitations are counted privately for moderators. Not a violation, not on any record — but the pattern stops being invisible. |
| **Coordinated false reporting** | A defined violation in its own right; reports arriving in a burst against one target are flagged as possible coordination rather than read as corroboration. |
| **A bad actor volunteering as a guide** | Guiding requires an established account, never a new one — the highest-trust position gets the highest floor rather than the lowest. |
| **Members object to AI involvement** | The whole [A] layer is Phase 5 and removable — switching it off costs moderators tedium and costs members nothing. Individually, the per-member opt-out honors any objection without argument. |
| **An advisory function is quietly resented** | The resentment test gates it before launch; the annual sunset means anything that erodes trust lapses by default rather than requiring someone to fight to remove it. |
| **Advisory upkeep eats more volunteer time than it saves** | The ~300-member gate prevents it from existing at that scale at all; above it, registry owners and annual review make the cost visible enough to decide against. |
| **Lockdown is overused or used in panic** | Two keys, a 2-hour default, and a public post-mortem after each use — visible enough that a pattern of flipping it becomes everyone's business. |
| **Operators drown in systems members never see** | The operator test (Part II): more than ~five systems to hold in your head means simplify, automate to zero-memory, or remove. |
| **The Commons becomes the de facto governing room** | It has no steward, no rituals, and no program — the least organized space here precisely because it's where standing would otherwise concentrate. |
| **The Commons stops being socially relevant** | The other Commons failure, and the more likely one. A room defined by having no shared activity is the one place where the tie-preserving ingredient has been deliberately removed. The signal is not a quiet week — a quiet Commons may simply mean everyone is happily playing — but sustained absence of the thing it exists for: spontaneous conversation, cross-game interaction, people returning to it independently of any organized activity. Operators watch for "almost no organic use in six weeks." The first response is **Memory resurfacing** (one old Commons moment, resurfaced weekly, deterministically), not programming. Giving it a steward or a calendar is the last resort, because it is also the failure above. |
| **Lockdown used as a weapon in a dispute** | Neither key can be someone party to the conflict; two uninvolved people are required, and the post-mortem is public. |
| **Cooling counts drift into a shadow reputation** | 30-day expiry, never shown beside violation history, inadmissible in appeals — diagnostic only. |
| **Three coordinated accounts spawn pods** | Pod creation requires at least one member with prior activity in that circle, on top of the probation window. |
| **A raid roster collapses from no-shows** | Backups are recruited at signup, not after; repeated no-shows lose the slot to a backup. The consequence stays inside the pod. |
| **Raid standing starts leaking into community standing** | Third firewall (Pillar 4): attendance is pod-scoped and undeletable-elsewhere-because-it-was-never-there; leadership expires with the run. |
| **Someone burns out on raiding** | They lose a roster slot and nothing else — pod membership, friends, circles, and Memory are untouched. Raid FOMO is contained, not exported. |
| **A raid leader burns out** | Same six-week rotation norm as moderators; the backup-leader slot means one person's night off doesn't cancel the run. |
| **The in-game guild fills up** | Sister guilds as peers, never a main/overflow tier. Slots are never allocated by merit or contribution — only by asking who'd rather not hold one. Everything social lives above the guild layer. |
| **A game region-locks part of the group** | The pod splits into regional siblings with no parent; the circle, Memory, and Commons hold across the split. Unfixable at the game layer, survivable at every layer above it. |
| **A game's group cap is smaller than the pod** | Expected, not a problem — pods spawn runs beneath themselves and are never sized to the game's instance cap. |
| **Several pods form for one game** | Legitimate on region, clock, mode, or commitment level — all constraints. Illegitimate on skill tier, dislike of individuals, or nothing at all; auto-merge catches the last. Split pods stay one community via the shared circle. |
| **The Commons becomes an elite raid lobby** | It never hosts committed activities and never hosts moderation decisions — the two ways an unstructured veteran space acquires power without anyone granting it. |
| **Attendance data leaks out of a raid pod** | Pod-local storage no other subsystem can query, deleted on archive. Enforced as a constraint rather than a policy. |
| **Nobody writes Memory context** | Expected. Stages 1 and 2 (automatic capture, one-click preservation) need no writer, so the archive fills regardless; storytelling is the optional third stage. |
| **Stewards and guides become the same people forever** | Hard stops: 3-month steward maximum then a mandatory break, 3 weeks off per 4 newcomers guided. Inertia is the default outcome unless something interrupts it. |
| A group of friends leaves for their own private server | Counted as success (Pillar 4), not churn. No mechanism detects, discourages, or wins them back; the re-entry view works whenever they return. |
| Growth pushes past ~500 active members | Subdivide into a second community with its own circles, sharing rituals and Memory conventions — never add hierarchy to manage one oversized one. |
| Bot fails | Every process has the manual fallback it ran on in Phase 1. |
| Discord API breaks | Memory's external mirror preserves identity. |
| Bot maintainer leaves | Two maintainers have deploy access; hosting ownership, bot application ownership, credentials recovery, budget, and release/restore steps have a tested handoff. No subsystem depends on one person's account or tribal knowledge. The [A] layer is advisory only, so an incoming maintainer inherits specifications, not an unspecifiable interpretive system. |
| The AI layer is unavailable | Every [A] function degrades to its deterministic or manual form — triage becomes an unsorted queue, translations wait for a human, trends go unnoticed until someone looks. Nothing that decides anything stops working, because nothing that decides anything was AI in the first place. |
| The AI layer is subtly wrong | Its outputs are suggestions a human reads before acting, and each is visibly labeled as model output — a bad summary or a false flag costs attention, not someone's standing. |
| Database lost | External mirror plus public log postings preserve history and precedent. |
| A platform's API is revoked or repriced | That platform degrades to manual or is dropped — governance never lived there. |
| Dormant pods accumulate as clutter | 12-month sunset with Memory preserved; the 14-day revival cooldown prevents churn in the other direction. |
| A member requests deletion | Processed within 7 days, in the external mirror as well as in Discord. |
| Guides burn out and arrival goes bot-only | Caps (2 at a time) and rest periods protect existing guides; the monthly try-it-once event replenishes supply. If it still runs dry, arrival degrades visibly to bot suggestions rather than silently, so the gap is noticed. |
| The moderation team quietly exhausts itself | The six-week rotation cadence and tracked load surface it before collapse; the cooling channel absorbs friction that would otherwise become formal cases. |
| A member returns after months away | Re-entry view shows active pods, familiar faces still around, and the next low-stakes things — return is cheap rather than awkward. |

**Governance records survive independently.** Vote results, decision logs, and moderation history mirror externally alongside Community Memory — the community's precedent doesn't live only in Discord. Governance *process* stays in Discord deliberately: moving voting or appeals to an external platform reintroduces exactly the participation friction that kills adoption, which is the founding premise of this entire design. Records: portable. Process: where people already are.

This creates two separate resilience goals. **Historical resilience** means preserving Memory, decisions, and precedent in an exportable form. **Operational resilience** means being able to reconstruct current pods, guides, schedules, rosters, open appeals, and permissions after a database or runtime failure. The first does not guarantee the second. Before automation, the community maintains a human-readable weekly operating snapshot and a documented restore procedure; no external mirror is described as a complete operational backup.

**The dependency this leaves, named rather than argued away.** Memory, governance records, and historical decisions are portable. Pods, circles, scheduling, arrival, and every moderation workflow are not — they live in Discord, and if Discord changes its terms, prices, or moderation policy in a way that doesn't suit this community, those are rebuilt somewhere else from scratch. That's a real single point of organizational failure, and no amount of external mirroring changes it. The trade is accepted knowingly: a portable system nobody uses is worth less than a dependent one people are already in. But it should be on the page as a cost, not buried under the argument for why the cost is worth paying.

**The human runtime has the same requirement.** Server ownership, bot application ownership, hosting access, domain/DNS access, backup credentials, and the operating budget cannot sit with one person. At least two current maintainers can deploy and restore; recovery material is held outside any one maintainer's personal account; and the handoff is exercised before launch and every six months. Documentation without access is not continuity.

## M. Build order

**Phase 0 — the pilot, before a single line of code.** The irreducible core only (circles, pods, Commons, ambient spaces, shared Memory): ten people, two circles, one guide, one recurring ritual, one shared-memory channel, three months. Everything run by hand. If that works, build Phase 1; if it doesn't, no amount of automation will rescue it, and finding out costs three months instead of a year of engineering. This phase exists because every subsystem below is a way of *scaling* something that has to work at ten people first — none of them create the thing, they only keep it from breaking at two hundred. Build pods as forum threads from the start (Section K) — retrofitting from channels later is painful and the platform limits make it necessary anyway.

**A pilot without a fail condition is just three months of hoping.** At ten people, percentage targets are one or two people and cannot distinguish a mechanism from noise. Phase 0 therefore uses event tests that the group can actually falsify:

| Event test | Pass condition |
|---|---|
| A game is abandoned or deliberately retired during the pilot | At least one relationship or pod continues into another game or the Commons without an organizer rebuilding it |
| A member goes quiet for at least 30 days | At least one returns to a specific meaningful interaction, and the group can name what made the return cheap |
| Guiding is offered | At least one guide action happens without the pilot operator asking that person twice |
| Pods form at the provisional threshold | At least one becomes a real recurring group, and unused provisional threads disappear without manual conflict |
| Memory capture is offered in three stages | At least one item reaches preservation without storytelling, and at least one participant later adds their own context |

The pilot also records directional measures — pod count and churn, guide asks and acceptances, Memory stage conversion, multi-circle participation, and every 30-day return — but does not pretend percentages at n=10 are thresholds.

**Guide efficacy is a Phase 1 question, deliberately.** The open question is not whether guides can be recruited but whether being guided actually helps: the mentoring literature from comparable volunteer communities is mixed, and at least one analysis finds expert involvement associated with better first contributions and *worse* retention. That is worth knowing before Phase 1 encodes caps, rest periods, and cohort fallbacks around the role. It cannot be answered here. Ten people over three months produces perhaps three or four arrivals, and a guided-versus-bot comparison on that base is two against two. So Phase 0 does one thing: for every arrival, record whether they got a guide, a micro-guide, or the bot path, and whether they were still around a month later. That is raw material. **The comparison runs in Phase 1**, over enough arrivals to mean something, and until it does the guide system is marked **[H]** rather than assumed. The 3-member pod threshold remains the number most likely to be wrong in either direction.

Missing these doesn't mean building anyway with more automation. It means the social design is wrong and needs changing before any of it gets encoded. The point of doing this by hand is that changing your mind is still cheap.

**Rule amendments.** Any member may propose a change to a default or operating rule in the meta channel. The proposal stays open for seven days and receives a plain-language steward summary of arguments. **Ordinary preference rules — calendar shape, pod thresholds, ritual cadence, circle structure — are ratified by members**, with the reasoning recorded in Community Memory and the decision log. Moderators hold a narrow, stated veto over safety and legal matters only, exercised in writing with reasons. Moderators enforce boundaries; they do not decide taste. An earlier draft had moderators ratifying every rule change, which quietly made the safety role into the legislature. Amendments may not weaken the authority firewalls, the right to inactivity, the separation of committed attendance, or the human-only moderation boundary; changing those principles requires a new charter agreed by the community.

**Phase 1 — reasons to stay:** perimeter defenses first (native verification, AutoMod, invite pausing, and Raid Protection where available; bot-owned account-age enforcement, probation, creation rate limits, and the two-key lockdown), social and governance channels, circles with their monthly rituals and monthly guide-recruitment event, plus the Commons (an unstructured lounge — no steward, no rituals), arrival flow with guide caps and micro-guiding (manual guides are fine), Memory logging with participant-authored context, storylines, and privacy opt-outs, independently persisted moderation and governance records from day one, manual rule-based moderation with independent appeals, visibility rules, and the cooling channel (member- and moderator-initiated, with expiry), steward charter shown wherever steward names appear, mod rotation cadence from day one, manual reactivation tracking, ambient drop-in spaces with a separate count-and-circle indicator (nothing that notifies; Discord still shows names inside voice), a minimal operator cockpit showing only current reports, appeals, guide shortages, lifecycle transitions, and system health, two-maintainer ownership and restore handoff, and a few recurring ritual nights plus one chaos slot from week one.

**Phase 2 — reduce friction:** Tier-1 voting bot with anti-gaming heuristics, reactivation-rate automation, committed-activity rosters for any pod that needs them (raid-shaped games need this early, not at scale), open-enrollment scheduling bot for coordinated activities only (ambient stays untooled by design), timezone-rotating ritual slots, returning-member re-entry view, decision log automation, decline-trend reporting, moderator load tracking and sabbaticals.

**Phase 3 — personalize:** profiles with self-declared "ask me about" tags, approved platform linking, pod automation (seasonality with 90-day template self-correction, hibernation with revival cooldown and 12-month sunset, merge-with-veto, lifecycle signals but no health score), platform-aware scheduling, language enclaves (only above ~300 active) with translation and human verification for rules/decisions/appeals, Memory categories/decay/Golden Record/quarterly digest/newcomer view/consent-tracked external mirror, automated cross-posting for API-friendly platforms.

**Phase 4 — only at scale:** PvP enclave automation, creator tooling, activity credit records and spotlight rotation, guide-overflow cohort pairing.

**Phase 5 — the [A] layer, which only exists above ~300 active members** (below that the overhead exceeds the benefit and this phase is skipped entirely), never load-bearing, on a 12-month renewal clock with a named owner per function, and announced to members before anything ships: report triage, conflict-thread summarization, translation drafting, decline-trend detection, seasonality suggestions — none of which ships without model-generated labeling and advisory logging in place first, since an unlabeled advisory output is just a hidden lever. Built last on purpose — every one of these makes an existing deterministic process less tedious, and none of them makes a process possible that wasn't already working without it. If the community isn't at a volume where reading the queue by hand hurts, this phase isn't needed at all.

## N. Evidence ledger and open questions

This appendix exists so that no future revision has to re-derive what the outside research does and does not establish. Every entry was checked against the source rather than a summary of it.

**What holds up.**

- *Repeated, structured, shared activity slows the decay of social ties.* Network studies of long-running multiplayer games find that shared group membership and similarity of circumstance reduce tie decay. Measured **inside** one game.
- *Group containers outperform bare friend lists for retention.* A survival analysis of an MMORPG found the guild system a stronger retention effect than the friend system. This is the strongest external support for pods as a mechanism and for leaving friendships untooled.
- *Player communities are consistently described at three scales* — micro (groups and teams), meso (guilds and organizations), macro (communities and networks). Note what this is: a systematic review of how researchers framed their objects between 2000 and 2010, in a literature the reviewers describe as often conceptually undefined or overlapping, and predominantly qualitative. It is consistent with the circle/pod/community architecture; it does not validate it.
- *Governance workload grows with population, and formal rules help more at larger sizes.* From a study of 5,216 self-governing game-server communities. Two caveats travel with every use of it. First, the only robust success predictors were rule **count** in interaction with size, and rules managing the platform's technical constraints; rules that empower administrators predicted *target size* and showed **no significant effect on success**, and rule **diversity** flipped significantly negative in the full model despite being the measure the study's own theory is named after. Second, that study's communities had a median target size of 6 and a maximum of 284, with large professional servers excluded — its entire size range sits at or below this document's design band.
- *Volunteer moderators quit from time pressure and from conflict with each other*, roughly equally. The second half is why Pillar 4 has a moderator conflict path.
- *Most members never write anything.* Participation is steeply unequal in every community ever measured; small communities do better than the classic ratios, but not enough to build on. This is why Memory capture is staged.

**What does not hold up, and one thing that runs the other way.**

The retention literature measures why people keep playing a *particular game*. The most cited study in that line models relationships as producing **relational switching cost** — social capital accumulates, leaving becomes expensive, players stay. That is a clean description of the mechanism this document is trying to replace. If this design works, it *reduces* relational switching cost, because it decouples the value of the relationship from continuing to play the title. Retention findings are therefore useful evidence about *mechanisms* — repetition, group structure, communication — and are not evidence for this document's outcome. They are, on the specific point of leaving a game, evidence about the opposite outcome. Its dependent variable is also self-reported continuance *intention*, not behaviour.

**The thesis is untested.** Nothing in the literature measures whether relationships survive a change of game. That is the claim this community is making and the thing a pilot exists to find out.

**Validate experimentally.** These are neither established nor speculative; they are good hypotheses that should be settled by running the thing rather than argued about. Each carries the phase at which it can honestly be answered.

| Question | Earliest honest phase |
|---|---|
| Does a pod or relationship survive a game being abandoned? | Phase 0 (event test) |
| Does the Commons become where relationships survive the games, or a quiet lobby? | Phase 0 (observation), Phase 1 (judgement) |
| Do ambient spaces produce relationships, or empty rooms? | Phase 1 |
| Does a human guide outperform the bot-only path? | Phase 1, needs dozens of arrivals |
| Does multi-select circle membership produce more cross-game continuity than game-based roles? | Phase 1–2 |
| Does the 2-member provisional threshold create groups or channel sprawl? | Phase 0 (watch), Phase 1 (decide) |
| Does Memory measurably increase return and reconnection? | Phase 2 |
| Does pod-scoped containment actually keep raid standing out of community standing? | Phase 2 |

**Open design questions this revision did not resolve.**

*Pods have one parent circle; members have several.* Circle membership is multi-select by design, but each pod lives inside exactly one circle — and as a forum thread, physically so. Games that span playstyles have no correct home: Star Citizen is plausibly Explorer, Builder, Strategist, and Competitor at once. The likely fix is that pods carry circle **tags** rather than a single parent, and discovery reads tags, which costs nothing in the forum model. It is not adopted here because it changes how every pod is filed and Phase 0 should say whether it matters.

*How relationship continuity gets measured without surveillance.* The primary outcome above needs an instrument. Acceptable: anonymous aggregate counts, participant self-report, optional transition surveys, Memory-linked group continuity, conversations with returning members. Not acceptable, and ruled out permanently: an internal relationship graph, per-member centrality, dependency diagnostics, or any stored answer to "who does this person depend on." Those would tell operators far more about members' relationships than this design needs to know, and every one of them becomes a shadow reputation system. The measurement problem is real and stays open; it is not open enough to reconsider building a social graph.

---

# Core Insight

Treat the community as an ecosystem, not a government. Every rule exists to remove one specific point of unfairness or friction — never to run the community's social life, and never to judge who someone is rather than what they did.

Two things follow that the earlier drafts of this document got wrong. First, preventing failure is not the same as creating joy: a community optimized purely against unfairness is fair and empty, so rituals, celebration, and low-stakes fun are load-bearing requirements rather than decoration. Second, complexity is now the real risk — most of Part II is machinery a member never sees, and it must stay that way. If a member ever has to understand merge vetoes or seasonality templates to feel at home here, the system has failed regardless of how fair it is.

Natural leaders, experts, and organizers will still emerge. The goal was never to suppress them — it's to keep recognition attached to work rather than accumulating on people, and to keep it from converting into authority over anyone else. Everything here exists to protect the conditions under which people choose to stay, and to keep working when any single piece disappears.

**The question this document asks of itself is now two questions, because the old one conflated two layers.** For members: *what can we remove while preserving the core principle?* That question stands, and it produced the most valuable change any revision has made — per-member contribution counters removed, replaced by credit that lives on the activity. For operators it is the opposite question: *what must we integrate so that the people running this can hold it?* Minimalism is right for the member surface and wrong for the operator surface, and the operator cockpit exists because of it. The largest study of self-governing game communities finds that formal, code-mediated rules matter *more* as a community gets larger, with the clearest benefit going to rules that manage the platform's hard constraints — which here means the channel and thread ceilings, the lifecycle, and the finite attention of a handful of volunteers. That is not an argument for governing members harder. It is an argument for the machinery they never see.

Every future addition should still have to justify itself against a removal, and every claim in this document should have to declare whether it is **[E]**, **[H]**, or **[O]**.

In one sentence: **build a place where people can stop playing the same game without stopping being a community.**
