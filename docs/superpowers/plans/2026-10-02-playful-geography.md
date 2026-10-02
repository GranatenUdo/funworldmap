# Playful geography implementation plan

Approved by the user 2026-10-02. Implement inline; preserve existing game rules/scoring and static delivery. Reference the chat audit and independent review by /root/adversarial_plan_review (GPT-6 Astra, medium), completed before implementation. One reviewer; all nine findings resolved below without changing approved direction.

## Design contract
- Root entry: globe-backed chooser, Find countries (3 lives) and Locate cities (10 rounds), scoring explanations, Explore map. Deep links bypass. Dismissal lasts page lifetime; Choose another game explicitly opens chooser; Explore explicitly dismisses; replay is atomic and works with unchanged game hash.
- Playful geography: remove hex pattern, warm bright rounded panels, blue actions/orange accents, Outfit with readable prose, 44px touch controls, brief reduced-motion-aware feedback. Preserve all themes, datasets, source links and routes.
- Manual Next on every reveal; See results on terminal reveal. Facts close independently. No timer or global key may advance. Escape closes topmost overlay before end-game behavior.
- Results: country score/correct/accuracy/streak; city score/answered/skipped/mean actual-guess distance (exclude skips). Empty runs explicit. Current-run chronological review, no persistence of round history.
- Review is nonmodal desktop side panel/mobile compact sheet, retaining results actions and map navigation. Static historical reveal, cancel previous animations, never synthetic playable session or score mutation.
- Mobile country/compare details have explicit View map / View details, bounded scrollable content and reachable close controls. Preserve production attribution and Explore Next.
- Source timestamps labelled dataset updated; no invented measurement dates or scope.

## Task 1: Reconciled baseline
Merge production c12a99d into isolated branch based on 89e7495; retain all unrelated crash-screen, neutrals, region-tint fixes and instruction migration. Inspect conflicts, run unit/type/lint baseline. Record pre-redesign build weight. No production merge/deploy.

## Task 2: Session and readiness contracts
Append CompletedRound {round,input,outcome} only in accepted reducer attempt. Guard terminal advance, double submit and continuation. Add targetCountryCca3 to city round generation. Result receipt captures previous/current PB, first result, persistence outcome exactly once. Record data remains immutable during review. Router uses explicit required-map-layer readiness plus pools, cancels stale pending route, handles back/forward/mode changes and camera reset after readiness. Show recovery rather than covered WebGL failure.

## Task 3: Entry and presentation
Implement chooser lifecycle and playful token/layout changes, preserve labelled Play on phone, scrollable dialogs, metadata/title game-first. Focus trap only for true modals; inert background there. Root chooser visible during loading; starts gated until ready. Use existing helper patterns and remove obsolete expectations.

## Task 4: Player-controlled feedback and review
One authoritative controller continuation. Split map reveal renderer from guess listener; renderer accepts live or historical outcome. Keep session game-over during review. Facts disclosure and help own dismissal, no advancement on close. Statistics and review list derive from completed records. Review selection never invokes recording. Retain actual guess distance and skip kind.

## Task 5: Reference mobile and quality
Mobile map/details transition, accessible source dates/disclosure, fix focus and unsupported-map readiness. Tests: fresh/deep-linked load, delayed load/cancel/recovery, same-mode replay, browser history, correct/wrong/ocean/skips/terminal/empty/early exit, keyboard focus/escape/facts, storage failure and reduced motion. At least one real UI Next/review path in addition to test seams. Browser matrix: desktop, 390x844,568x320,200% zoom; themes/map types. Run lint,typecheck,unit,build and affected GPU/mobile suites (local-only exclusions do not count as CI coverage). Compare baseline assets and real browser rendering conditions without unsupported performance claims.

## Delivery
One final independent code review, resolve important findings with tests. Commit and create reviewable PR with visual evidence. No merge/deploy until user visual review.

## Execution ledger
- Pre-flight: producer/consumer contracts: CompletedRound -> statistics/review; shared map readiness -> router/input/reveal; result receipt -> results throughout review; launcher intent -> explicit route exits. Corrected as above.
- Review finding dispositions: all nine incorporated: nonmodal review; deep-link readiness; route/intent transitions; single advance/dismiss owner; separate presentation/input; city CCA3; immutable receipt; reducer guards/statistics; reconciled baseline/local-only tests.

- Baseline: 1599702 reconciles production and design changes; lint/typecheck and 681 unit tests passed before redesign tests. First baseline build command encountered newly added RED type checks, so no unqualified baseline build claim.
- Tasks 2–4: accepted history/terminal/readiness tests RED→GREEN; original auto-advance implementation fails new manual-reveal regression with matchMedia stub. Storage receipt, stats, modal isolation and explicit transitions implemented.
- Ruling: historical reveals use zero-duration easeTo with screen offset rather than jumpTo, because the latter lacks offset; no animation under reduced motion. Live reveals also offset around the result panel after browser inspection showed target occlusion.
- Browser defect fixed: React-controlled inert and modal cleanup had two owners; removed the duplicate owner. Root-launch browser regression failed against pre-fix bundle and passes in matrix.
- Initial matrix: 22/22 new-flow and launcher checks across desktop/mobile Chromium, WebKit, Firefox touch. Final verification after camera refinement pending.

- Final independent code review: /root/redesign_code_review, GPT-6 Astra medium, read-only review of 1599702..e87d4c1. Four important findings; no deferred minors.
- Final fixed: readiness recovery replayed completed sessions. Router tracks navigation intent separately from readiness; completed-session recovery unit regression RED→GREEN.
- Final fixed: historical reveal cleanup cancelled replay's home flight. New-game reset is atomic jumpTo with canonical world center/zoom/pitch; ordinary-motion browser regression RED→GREEN.
- Final fixed: modal results hid recovery and replay silently no-op'd. Results provide reachable Retry map, disable unavailable replay/review, and retain session. Result-preserving retries never schedule fallback page reload. Browser + timer regression RED→GREEN.
- Final fixed: review camera ignored viewport changes. Resize repositions the same target in unobscured map space and cancels obsolete animation. Desktop↔phone browser regression RED→GREEN.
- Ruling: preserve normal map Retry's existing reload fallback, but suppress it for in-results Retry so failure cannot silently discard in-memory review. If recovery remains unavailable, results remain usable and the user can explicitly leave.
- Ruling: reveal CSS must override Tailwind's individual translate property as well as transform; fixed after screenshot inspection. Root-launch tests additionally assert the map is not left inert.
- Verification: lint/typecheck + 684 unit tests passed after reviewer fixes. Browser final matrix and screenshot pass recorded in completion note.
- Production JS asset comparison with same dependencies/compiler: reconciled baseline 2,603,005 raw /704,323 calculated-gzip bytes; redesign 2,609,993 raw /707,169 calculated-gzip bytes (+2,846 gzip, 0.40%). Includes mandatory geometry chunks; excludes imagery/network transfer and is not a frame-rate claim.
- Visual capture renderer: NVIDIA GeForce RTX 5070 Ti via ANGLE D3D11. Real external basemap tiles; reduced-motion static captures with readiness/tiles settled before screenshots.

- Ruling: retained the branch's documented Fuse threshold 0.3/noise filtering. Its stale e2e 'Untied' case assumed the retired 0.4 threshold; test now uses the explicitly supported 'Germani' typo, preserving fuzzy-search coverage without reintroducing noisy matches. Short transpositions remain outside that guarantee.
- Full-suite compatibility: replaced obsolete global-Escape advancement and mobile expand/grabber tests with manual-continuation and explicit Map/Details assertions; fixed invalid symbol-layer stubs to use local GeoJSON rather than malformed empty vector resources. Cold-load tests now await gameplay readiness, not merely test-hook registration.
- Focus correction: modal focus honours the enabled preferred action (including the last-played launcher card). Disabled actions are never selected for initial focus.

- Completion verification (2026-10-03): 684 unit tests; complete 234-test browser run green; lint/typecheck/production build passed. Evidence, reviewer dispositions, tradeoffs and three screenshots: ../reviews/2026-10-03-playful-geography/README.md. No deferred minors. Review-ready only: not merged/deployed.
