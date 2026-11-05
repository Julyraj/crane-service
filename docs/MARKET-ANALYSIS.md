# Market Analysis: On-Demand Crane Booking

**Business:** Sri Venkateswara Crane Service, Salem, Tamil Nadu
**Fleet:** Hydra 13 / 15 / 16 t; telescopic/mobile 60 / 100 / 150 t; 24x7; short and long-term hire
**Product:** a crane booking platform (web, mobile PWA/Capacitor, Electron desktop) with three roles: customer, operator, admin/dispatcher
**Prepared:** November 2026. Facts were checked against the sources in section 8. Every figure quoted has a source. Where sources disagree or are out of date, the text says so. Fees and rules change often, so re-check them before quoting to customers or partners.

---

## 1. Executive summary

- **The model to copy is a mix: Porter's B2B goods-vehicle booking plus Uber/Ola's trip lifecycle.** Uber, Ola and Rapido give us upfront fares, live tracking, OTP to start a trip, SOS and two-way ratings. Porter and Borzo give us goods-vehicle selection, business accounts, cash on delivery and multi-stop jobs. Crane booking needs both, but the order of priority is different.
- **India's ride-hailing market has moved away from commission.** Namma Yatri started with a flat driver fee. Rapido, Uber and Ola then moved autos and cabs to subscription or "zero commission" plans (2023-2025). For a single-owner fleet this matters little now. It matters a lot if we later bring third-party crane owners onto the platform.
- **Crane hire is low-frequency, high-ticket, B2B and planned in advance.** Most value lies in a quick, transparent quote, a safe and documented job, and clean GST invoicing. "Instant matching in 3 minutes" adds little.
- **Online crane booking in India is still early.** MYCRANE (Dubai-based, with an India operation) is the main verified online crane marketplace. It works by quote request, not instant booking. The local Salem/Tamil Nadu market still runs on phone calls, WhatsApp and brokers, so a fleet owner with a good app has a real edge.
- **Several "obvious" peers have failed or left.** Dunzo went offline in January 2025. Lalamove was on India's 2020 list of banned Chinese apps. Good UX alone does not pay for unit economics, so the MVP should stay small and serve our own fleet first.
- **The MVP is a job workflow, not a marketplace:** a capacity recommender, a rule-based quote, scheduled booking, dispatcher assignment, operator app with live GPS and job-start OTP, photo/checklist proof, and a GST invoice. A marketplace and third-party owners come later.
- **Compliance needs to be designed in from day one.** That covers 18% GST invoicing, DPDP Act 2023 (rules notified November 2025, core duties phased in by about May 2027), operator competence records under BOCW rules, insurance, and payment flows through a licensed payment aggregator.

---

## 2. Per-service breakdown

Key: "Commission" means a percentage cut of each fare. "Subscription" means the driver pays a flat daily or monthly fee instead.

### 2a. Passenger mobility

| Service | Business model | Booking flow | Pricing / take model | Partner onboarding | Trust & safety | Tracking | Payments | B2B |
|---|---|---|---|---|---|---|---|---|
| **Uber** (incl. Connect, Freight) | Two-sided marketplace. Uber Connect (parcel, launched in India in May 2020) is another option inside the same app. Uber Freight is a shipper/carrier platform. The sources we found cover only its US product, not India. | Pickup/drop → pick vehicle type → upfront fare → match → driver arrives → trip → rate | Upfront fare with dynamic (surge) pricing. India surge is now capped at 2x the state base fare (MoRTH 2025 guidelines). Moved autos to a subscription "zero-commission" model in February 2025. | Document upload and verification in the driver app | Safety Toolkit: share trip with up to 5 trusted contacts, SOS button, 24x7 safety helpline, driver details shown. Start-of-trip PIN/OTP. | Live map for rider and shared contacts | Cash, UPI, cards, wallet | Uber for Business. Connect added cash payment and concurrent deliveries for small businesses (2022). |
| **Ola** | Marketplace for cabs, autos and bikes | Same as Uber | Moved cabs to zero commission in 2025 after trying it on autos and bikes. Reported driver pass: Rs 2,010 for 30 days (Rs 67/day). | In-app document KYC | Ride OTP, SOS, trip sharing | Live | Cash, UPI, Ola Money | Corporate accounts |
| **Rapido** | Started with bike taxis, then autos and cabs. Also does parcels. | Same as Uber. Parcel pickup confirmed with an OTP. | **SaaS / zero-commission.** Cabs (December 2023): drivers paid directly, with a Rs 500 subscription once earnings reach Rs 10,000 (outlets report the threshold differently). Autos (February 2024): small daily fees, reported at Rs 5-29 or Rs 9-29. | Captains register in the Rapido Captain app and submit documents | OTP at start and pickup, ratings. One customer complaint (2026) describes impersonators getting a parcel OTP. **Lesson: tie the OTP to the assigned operator's identity.** | Live | Cash, UPI, wallet | Little published on corporate accounts |
| **Namma Yatri** (Moving Tech) | Open-source app built on Beckn and listed on ONDC. Spun out of Juspay in March 2024. | Same as Uber. Also usable from other ONDC buyer apps. | **No commission. Flat driver subscription.** Autos (2023): Rs 25/day for unlimited rides, or Rs 3.50/trip for up to 10 trips. Cabs (2024): Rs 90/day after a free period. Cab service launched with a "zero surge" promise. | Driver app KYC. Grew with support from driver unions. | OTP, SOS, ratings | Live | Mostly direct to driver (UPI/cash) | Little. The open protocol is the main differentiator. |
| **BlaBlaCar** | Long-distance carpool marketplace. Left India in 2017, came back, and in 2025 said India was its largest market. | Driver posts route and seats → passengers book seats in advance | Not currently monetising in India (TechCrunch, October 2025) | Profile and ID verification | Verified profiles, ratings, reviews | None (scheduled trips) | Mostly offline | None |

### 2b. Goods, parcel and logistics

| Service | Business model | Booking flow | Pricing / take model | Partner onboarding | Trust & safety | Tracking | Payments | B2B |
|---|---|---|---|---|---|---|---|---|
| **Porter** | Intra-city and inter-city goods-vehicle marketplace, from 2-wheelers and 3-wheelers to Tata Ace and 1-7 t trucks | Pickup/drop → pick vehicle by size/payload → fare estimate → book (now or scheduled) → track → pay | Fare estimate based on distance, vehicle type and extras such as helpers. Commission figures are only in secondary sources (up to 30% reported, **unverified**). | Partner form plus documents: RC, fitness certificate, insurance, PUC, driving licence, PAN, bank details, address proof. Vendor team helps with onboarding. | Partner verification, ratings, geo-fence alerts if a vehicle leaves the route | Live tracking and ETA | Porter wallet, UPI, cash | **Porter Enterprise**: serves both B2B and B2C, with tracking and ETA for business shipments |
| **Lalamove** | Hong Kong on-demand intra-city logistics company. Entered India in 2019. **Status:** it was on the November 2020 list of banned Chinese apps in India. Current India operations are **unverified**. | App: vehicle type → stops → quote | Upfront quote | Driver app | Ratings | Live | Wallet, cash | Business accounts |
| **Borzo** (formerly WeFast) | Same-day intra-city delivery for SMEs. Launched in India in 2016 as WeFast, rebranded globally to Borzo in 2021. Has added 3-wheeler and mini-truck delivery (up to 1,000 kg). | Order → multi-stop route → courier assigned → delivery | Upfront fare by distance, weight and vehicle. Says pricing is the same at night. Mumbai page lists Rs 48 base and Rs 9/km in zone 1. Was testing rider subscriptions in 2025. | Courier app | Ratings | Real-time tracking | **Cash on delivery collected by the courier and remitted weekly**, UPI | Shopify integration, multi-stop delivery, scheduling |
| **Dunzo** | Hyperlocal pick-up/drop and later quick commerce | Not applicable | Not applicable | Not applicable | Not applicable | Not applicable | Not applicable | **App and website offline since January 2025.** Creditors took it to NCLT and Reliance wrote off its investment. |
| **Shadowfax** | Asset-light third-party logistics (3PL) with a large crowdsourced last-mile fleet. Owns no vehicles. IPO in January 2026. | B2B integration (API), not a consumer app | Charges clients per successful delivery. Net margin below 2% in FY25. | Crowdsourced riders | Process controls | Shipment tracking | Not applicable (B2B) | Entirely B2B: express parcels, reverse logistics, quick commerce |

### 2c. Equipment and crane rental platforms relevant to India (verified to exist)

| Platform | What it is | Model | Notes |
|---|---|---|---|
| **MYCRANE** (in.my-crane.com) | Dubai-based online crane rental marketplace with a wholly owned India operation | Customer posts the lift requirement for free → registered rental companies send commercial offers → customer chooses. Free for both sides. Has an inspection app (owner uploads photos and runs checks) and star ratings for suppliers. | Said in 2025 that it had passed 1,000 registered customers and 1,000 suppliers in India (company-sourced). Signed an MoU with Equip9. **This is the closest direct comparable. It is quote-based, not instant.** |
| **Equip9** (Pune) | Construction-equipment discovery and information app | Mainly discovery and listings, not transactional booking | MoU with MYCRANE (Excon) |
| **EquipShare** (Mumbai) | Peer-to-peer marketplace for idle construction equipment | Reported 5% transaction fee in 2018. Listings include backhoes and excavators. | Source is from 2018. **Current activity not verified.** |

Older profiles also mention small marketplaces such as Machine Shoppers (Delhi) and Heavy Equipmentz (Bharuch). They are left out because we could not confirm they still operate.

---

## 3. Feature patterns worth copying, and their crane equivalents

| Pattern (source) | Crane-booking equivalent | Role(s) | Phase |
|---|---|---|---|
| Vehicle-type selection (Uber, Porter) | **Capacity recommender.** Customer enters load weight, lift height, radius (distance from crane centre to load) and site access. The app suggests Hydra 13/15/16 t or telescopic 60/100/150 t using simplified load-chart rules plus a safety margin. A dispatcher confirms the choice. | Customer, Admin | MVP |
| Upfront fare (Uber, Borzo) | **Transparent quote**: mobilisation (yard to site in km, both ways) + hourly rate × max(actual hours, minimum billable hours) + night/holiday surcharge + extras (rigger, extra counterweight trips, waiting) + 18% GST. Shown as line items and stored with the booking. Long jobs priced as daily or monthly rates. | Customer, Admin | MVP |
| Surge pricing (Uber, Ola) | **Rule-based surcharges only**: night, Sunday/holiday and short notice. No algorithmic surge. B2B customers dislike it, and the 2025 MoRTH guidelines show regulators capping it for passenger aggregators. | Admin | MVP |
| Ride OTP (Uber, Ola, Rapido) | **Job-start OTP** sent to the site supervisor's phone. The operator enters it to start the billing clock. A **job-end OTP or signature** confirms hours. The OTP only works for the assigned operator's login and crane, which closes the impersonation hole seen in the Rapido complaint. | Customer, Operator | MVP |
| Scheduled rides (Uber, Porter) | **Scheduled bookings as the default flow**: date and time window, multi-day blocks, a calendar view of crane availability for the dispatcher. "Now" bookings are the exception (breakdown recovery, urgent lifts). | All | MVP |
| Live tracking and ETA (all) | Operator app shares GPS from dispatch to site arrival, and optionally during the job for site-to-site moves. Customer gets an ETA. Admin sees a fleet map. | Operator, Customer, Admin | MVP |
| Share trip / trusted contacts (Uber) | Share the job's tracking link with the project manager, safety officer or client by WhatsApp | Customer | MVP |
| SOS / safety helpline (Uber) | **Operator SOS and incident report** (near miss, ground failure, overload alarm) with photos, sent to the admin and the owner's phone | Operator, Admin | v2 |
| Two-way ratings (all) | Customer rates operator and job. Operator rates the site (access, ground prep, rigger quality, payment behaviour). Used internally for dispatch and credit decisions, not shown publicly at first. | Customer, Operator | v2 |
| Partner KYC (Porter, Rapido) | **Operator and crane compliance records**: driving licence, operator training/competence record, medical fitness, crane RC/fitness/insurance, last load test or third-party inspection date, with expiry alerts. Dispatch is blocked if any are expired. | Admin, Operator | MVP (records), v2 (alerts) |
| Pre-trip inspection (MYCRANE inspection app) | **Daily pre-start checklist** (outriggers, hydraulics, wire rope, hook, limit switches) with photos, logged against each job | Operator | MVP |
| Business accounts (Porter Enterprise, Uber for Business) | **Contractor accounts**: GSTIN, multiple site addresses, several people allowed to book, PO numbers, credit limit, monthly statement, monthly hire contracts | Customer, Admin | v2 |
| Cash on delivery with remittance (Borzo) | **Collect on site**: operator records cash/UPI collected. The system reconciles it against the invoice and flags advances owed. | Operator, Admin | MVP |
| Multi-stop delivery (Borzo, Uber Connect concurrent) | **Multi-site day plan**: one crane booked for several short lifts at nearby sites, billed as one block with travel between sites | Customer, Admin | v2 |
| In-app invoices and receipts (all) | **GST tax invoice** (GSTIN, HSN/SAC, place of supply, CGST+SGST or IGST) produced when the job closes, plus a job sheet with hours, OTP times and photos | Admin, Customer | MVP |
| Quote request from many suppliers (MYCRANE) | **"Request a quote" for heavy lifts** beyond the standard fleet (for example 200 t+). The admin quotes by hand or sources a partner crane. | Customer, Admin | v2 |
| Open network (Namma Yatri / ONDC) | Watch for ONDC services or logistics categories as a future discovery channel. Not worth building for now. | Not applicable | v3 |

---

## 4. Why crane booking differs from taxi and parcel booking

| Dimension | Taxi / parcel | Crane hire | Design consequence |
|---|---|---|---|
| Frequency and ticket size | Many cheap trips | Few, expensive jobs (hours to months) | Optimise for quote accuracy and follow-up, not matching speed. A WhatsApp handoff to a human is acceptable. |
| Planning horizon | Mostly "now" | Mostly scheduled days ahead, often multi-day | Calendar and availability engine come first. "Now" is secondary. |
| Matching | Nearest free driver | Right **capacity** for weight × radius × height, then availability, then distance | Recommender plus dispatcher confirmation. No auto-assignment on heavy lifts. |
| Safety | Passenger safety in transit | Lifting operations risk (tip-over, overload, ground failure, overhead power lines) | Checklists, load-chart guidance, a site-readiness questionnaire, incident reporting |
| People | Licensed driver | Operator, plus rigger/signaller and site supervisor | Collect the site contact and supervisor OTP, and record rigger details |
| Regulation | Aggregator guidelines, permits | BOCW rules (operator must be over 18 and competent; lifting gear tested by a competent person), vehicle permits for moving mobile cranes on roads, site permits | Store compliance documents with expiry dates. Leave route/permit planning to the admin. |
| Pricing | Distance × time, surge | Mobilisation km + minimum hours + hourly/daily/monthly + night + extras + GST. Often negotiated. | Rule-based quote engine with an admin override and a discount field (and an audit trail) |
| Mobilisation | Small dead mileage | Big cost: slow travel, sometimes escort or permits, counterweight trips | Charge mobilisation separately and show it on the quote |
| Weather and site | Mostly ignorable | Wind and rain stop lifts. Site may not be ready (ground, access, clearance). | Statuses for "standby/weather hold" and "site not ready", plus a waiting-charge policy |
| Customers | Consumers | Contractors, factories, builders, logistics firms; repeat B2B | Accounts, credit terms, PO references, monthly statements |
| Culture | Fixed app fares accepted | Negotiation, relationships, phone/WhatsApp first | Show the quote as a starting point, allow "request a call back", one-tap WhatsApp to 97894 73129 |
| Supply | Thousands of drivers | Our own small fleet (6 crane classes) | Fleet-first tool. A marketplace makes sense only after the workflow works. |

---

## 5. Gaps and opportunities (Tamil Nadu / India)

1. **No instant, transparent pricing locally.** The only verified online crane platform (MYCRANE) is quote-request based. Showing a clear indicative price for Hydra jobs in the Salem area would set us apart.
2. **Fragmented, informal supply.** Industry sources (mostly vendors) describe the Indian crane rental market as highly fragmented, with price pressure and uneven service. A verified fleet with documented compliance is a selling point to contractors with safety audits.
3. **Proof of work and billing disputes.** Hour disputes are common in hire work. OTP-stamped start/end times, GPS and photos give an auditable job sheet, which no local competitor offers.
4. **Contractor compliance packs.** Large sites ask for operator credentials, crane insurance and inspection certificates. Producing a downloadable "compliance pack" per job is a cheap, valued feature.
5. **Operator shortage.** Sources point to a lack of trained heavy-equipment operators. Operator-side tools (schedules, earnings, document reminders) help retain them.
6. **Tier-2/3 cities are under-served.** App-based crane booking is reported to be emerging mainly in metros such as Delhi and Bengaluru. Salem, Namakkal, Erode, Dharmapuri, Krishnagiri and the industrial corridors are a natural first territory.
7. **Partner overflow (later).** Requests above our fleet (above 150 t) or when the fleet is fully booked can be routed to trusted partner owners. This starts the marketplace without building one up front.
8. **Tamil-first UX.** Local SMEs and site supervisors will respond better to Tamil and English UI, voice-note job descriptions and WhatsApp-native flows.

---

## 6. Recommended MVP, roadmap and monetisation

### MVP (own fleet only)

- **Customer:** sign-in with phone OTP. Booking wizard: site location on a map, date/time window, load weight, lift height, radius, site photos. Capacity recommendation. Line-item quote (mobilisation, minimum hours, rate, surcharges, GST). Confirm or "call me". Booking status. Live tracking link. Job sheet and GST invoice PDF. WhatsApp deep link.
- **Operator:** assigned jobs list. Navigate to site. Live GPS sharing (foreground, with battery-aware intervals). Pre-start checklist with photos. Enter job-start OTP. Pause/resume (weather, site not ready). Job-end OTP or signature. Record cash/UPI collection.
- **Admin/dispatcher:** fleet registry (6 crane classes, units, status). Operator registry with document expiry dates. Calendar of availability. Manual assignment with conflict checks. Pricing rule tables (rates, minimum hours, mobilisation per km, night window and surcharge, GST rate). Quote override with reason. Live fleet map. Dashboard (bookings, utilisation, revenue, receivables).
- **Platform:** booking state machine (requested → quoted → confirmed → assigned → en route → on site → working → paused → completed → invoiced → paid / cancelled). Audit log. Notifications by SMS/WhatsApp. Offline-tolerant operator PWA.

### v2 (B2B depth)

- Contractor accounts: GSTIN, multiple sites, multiple bookers, PO numbers, credit limits, monthly statements, long-term and monthly hire contracts.
- Online payments through a licensed payment aggregator (UPI/cards/netbanking). Advances and deposits. Payment links.
- Two-way ratings (internal). Operator SOS and incident reports. Document expiry alerts.
- Multi-site day plans. Heavy-lift "request a quote" flow. Tamil UI.
- Reports: utilisation per crane, idle days, revenue per km mobilised, receivables ageing.

### v3 (network)

- Partner owner onboarding (KYC, crane documents, inspection photos) for overflow jobs, with partner payouts.
- Telematics integration (engine hours, overload alarms) where cranes support it.
- Dynamic availability-based discounts (fill idle days). Corporate API/integrations.
- Explore ONDC/open-network discovery and expansion to other Tamil Nadu clusters.

### Monetisation options

| Option | When | Notes |
|---|---|---|
| Own-fleet hire revenue (the core) | MVP | The platform is a cost-saver and sales channel. Measure utilisation, quote-to-booking conversion and days-to-cash. |
| Convenience/urgent booking fee | v2 | Only for "now" or short-notice jobs, shown openly |
| Contractor plan (monthly fee) | v2 | Priority scheduling, credit terms, compliance packs, consolidated billing |
| Commission on partner jobs | v3 | Industry norm is a percentage. Keep it transparent. |
| Partner subscription (Namma Yatri / Rapido style) | v3 | Flat monthly fee for partner owners instead of commission. Attractive to owner-operators and easier to explain. |
| Value-added services | v3 | Rigging crews, lift planning, third-party inspection referrals, insurance tie-ups |

---

## 7. Risks and compliance

| Area | Requirement / risk | Mitigation |
|---|---|---|
| **GST invoicing** | Crane hire is widely treated as **18% GST**, with or without operator. An AAR (Telangana, 2024) applied 18% to equipment hire with operator. The correct **SAC code** for hire *with* operator is debated (997313 vs other entries), and rates were revised in September 2025. | Keep GST rate and SAC in configurable tables. Have the CA confirm. Invoices carry GSTIN, place of supply, CGST+SGST vs IGST logic and sequential numbering. Plan for e-invoicing if turnover thresholds apply. |
| **DPDP Act 2023 and DPDP Rules 2025** | Rules notified November 2025 with phased start dates. Core duties (notice, consent, security safeguards, breach reporting, retention) apply about 18 months later (about May 2027). The SPDI Rules 2011 apply in the meantime. We process phone numbers, names, site locations and **continuous operator GPS**. | Collect only what is needed. Clear consent notice in Tamil/English. Location tracking limited to on-duty or active-job time. Retention limits for GPS trails. Access controls by role. Breach response plan. Process for data deletion and correction requests. |
| **Operator competence and site safety** | BOCW Central Rules require that lifting appliances are operated or signalled only by persons over 18 who are competent. Lifting gear needs periodic testing by a competent person. Tamil Nadu has its own BOCW rules. | Store training/competence records, medical fitness and inspection certificates with expiry dates. Block dispatch if expired. Pre-start checklist. Clear contract terms on who is responsible for the site (ground, permits, rigging). |
| **Motor vehicle and road movement** | Mobile cranes need valid RC, fitness certificate, insurance, PUC and permits to move on public roads. Oversized moves may need extra permissions. | Track crane documents with expiry. The admin plans routes for heavy cranes. |
| **Insurance and liability** | Damage to the load, third-party property or injury during lifts | Equipment and third-party liability cover. Show insurance in the compliance pack. Terms and conditions accepted at booking. Record incidents. |
| **Payments** | A platform that collects money on behalf of others (partner owners in v3) falls under RBI payment aggregator rules (PA Directions 2025: funds held in escrow with a scheduled commercial bank). | MVP: collect only our own revenue through a licensed PA/PG (Razorpay, PhonePe PG, etc.). v3: use the PA's split-settlement/route product rather than holding partner money ourselves. |
| **Aggregator rules creep** | The MoRTH Motor Vehicle Aggregator Guidelines 2025 target passenger transport, but they show the direction of regulation (state base fares, 2x surge cap). | Avoid algorithmic surge. Keep pricing rule-based and transparent. Watch for state rules covering goods or equipment aggregators. |
| **Business model risk** | Dunzo's shutdown and Shadowfax's thin margins show that on-demand logistics is cash-hungry | Fleet-first MVP. No subsidy-led growth. Measure utilisation and collections. |
| **Adoption risk** | Customers prefer phone/WhatsApp and negotiation | Keep WhatsApp and call-back paths. Admin can create bookings for walk-in or phone customers. Treat the app quote as an anchor, not a fixed price. |
| **Technical** | Patchy GPS and network at rural/industrial sites. Background location limits on Android/iOS. | Offline queueing in the operator PWA/Capacitor app. Manual status fallback. Battery-aware tracking. |

---

## 8. Sources

- Rapido zero-commission cabs (Dec 2023): https://yourstory.com/2023/12/rapido-launches-cab-services-with-a-saas-platform
- Rapido extends SaaS model to autos (Feb 2024): https://business-standard.com/companies/start-ups/after-cabs-rapido-extends-saas-based-zero-commission-model-to-auto-drivers-124021300846_1.html
- Ola extends zero-commission to cabs; Uber autos model; fee comparison (June 2025): https://www.medianama.com/2025/06/223-ola-expands-zero-commission-model-to-cab-drivers/
- Namma Yatri auto subscription plans (2023): https://yourstory.com/2023/08/namma-yatri-app-charge-subscription-fee-drivers
- Namma Yatri cab launch, zero surge (2024): https://www.deccanherald.com/india/karnataka/bengaluru/namma-yatri-launches-cab-service-in-bengaluru-promises-zero-surge-pricing-2981204
- Namma Yatri on ONDC: https://yourstory.com/2023/03/ondc-onboards-auto-booking-app-namma-yatri
- Google backs Namma Yatri / Moving Tech: https://techcrunch.com/2024/07/15/google-backs-indian-open-source-uber-rival-namma-yatri/
- Uber Connect launch (India newsroom): https://www.uber.com/en-IN/newsroom/uber-launches-uber-connect-a-new-package-delivery-service-to-connect-with-family-and-friends/
- Uber Connect growth for small businesses (2022): https://bsppd.business-standard.com/article/companies/uber-s-package-delivery-service-drives-rapid-growth-for-small-businesses-122061500793_1.html
- Uber Freight shipper platform (US): https://www.freightwaves.com/news/technology-uber-freight-launches-shipper-platform
- Uber Safety Toolkit in India: https://yourstory.com/2018/08/uber-launches-its-safety-toolkit-for-india
- Uber safety features update (2022): https://yourstory.com/2022/11/uber-introduces-new-tech-features-support-safety
- MoRTH Motor Vehicle Aggregator Guidelines 2025 (2x surge cap): https://www.business-standard.com/india-news/cab-aggregators-surge-pricing-rapido-uber-ola-125070200228_1.html
- BlaBlaCar India now its largest market: https://techcrunch.com/2025/10/25/india-the-market-blablacar-once-walked-away-from-is-now-its-biggest
- Porter Enterprise: https://porter.in/enterprise
- Porter trucks and fare factors: https://porter.in/trucks
- Porter partner onboarding: https://porter.in/partners
- Porter geo-fencing / tracking (blog): https://porter.in/blog/?p=6569
- Lalamove India entry: https://yourstory.com/2019/11/lalamove-india-uber-logistics-unicorn-startup
- Lalamove in 2020 app ban: https://www.businesstoday.in/technology/news/story/chinese-lala-cannot-move-in-india-279714-2020-11-26
- WeFast rebrands to Borzo: https://www.prnewswire.com/in/news-releases/same-day-delivery-service-wefast-rebrands-to-borzo-and-raises-35m-in-series-c-847362450.html
- Borzo Mumbai pricing: https://borzodelivery.com/in/cities/delivery-service-mumbai
- Borzo cash on delivery: https://borzodelivery.com/in/cities/cash-on-delivery-in-india
- Borzo rider subscription test (2025): https://www.business-standard.com/amp/companies/news/borzo-targets-group-profitability-fy26-ceo-125092601230_1.html
- Dunzo goes offline (Jan 2025): https://www.businesstoday.in/technology/news/story/dunzo-goes-offline-after-cofounder-kabeer-biswas-joins-flipkart-460763-2025-01-15
- Dunzo overview: https://en.wikipedia.org/wiki/Dunzo
- Shadowfax IPO and business model: https://fyers.in/blog/shadowfax-ipo/
- Shadowfax IPO review: https://www.finnovate.in/learn/blog/shadowfax-ipo-review-details-investment-guide
- Rapido parcel OTP impersonation complaint (anecdotal): https://www.consumercomplaints.in/rapido-roppen-transportation-services-pvt-ltd-parcel-collected-by-impersonator-during-rapido-booking-iphone-missing-c3539708
- MYCRANE platform explained: https://my-crane.com/mycrane_world/simplifying-crane-rentals-how-mycrane-online-platform-works
- MYCRANE passes 1,000 customers in India: https://www.rermag.com/business-technology/international-rental-business/article/55376605/mycrane-surpasses-1000-customers-as-india-turns-to-online-crane-rentals
- MYCRANE on India crane rental market (fragmentation, operator shortage): https://my-crane.com/mycrane_world/development-of-india-s-crane-rental-market-and-future-prospects/
- MYCRANE and Equip9 MoU: https://equipmentindia.com/construction-machinery-news/top-equipment-news/webexclusive/MYCRANE-signs-MOU-with-Equip9-at-Excon/129073
- EquipShare (2018): https://yourstory.com/2018/03/unused-construction-equipment-lying-idle-rent-it-out-with-equipshare/
- India tower crane rental market (online platforms limited outside metros): https://www.bonafideresearch.com/product/6507690206/india-tower-crane-rental-market
- DPDP Rules 2025 notified, 18-month rollout: https://yourstory.com/2025/11/digital-personal-data-protection-dpdp-rules-2025-rollout-over-18-months
- DPDP enforcement dates: https://www.amsshardul.com/insight/enforcement-of-the-dpdp-act-and-notification-of-the-dpdp-rules/
- GST on crane / construction equipment rental (SAC 997313): https://busy.in/sac-code-997313/
- GST for JCB/crane hire owners (18%, Sept 2025 changes): https://taxgarden.in/blog/income-tax-gst-for-jcb-earthmover-crane-hire-owners-india-ay-2026-27
- Telangana AAR, Ventair Engineers (hire with operator at 18%): https://gstcouncil.gov.in/sites/default/files/AAR/tsaar_order_no.02-2024_dt.09-01-2024_ms.ventair_engineers.pdf
- BOCW Rules, lifting appliance operators (via Indian Kanoon): https://future.indiankanoon.org/doc/86825487/
- RBI Payment Aggregator Directions 2025 (summary): https://sarafpartners.com/?p=37896
- RBI PA/PG guidelines 2020 (escrow, marketplaces): https://indiacorplaw.in/2020/05/rbis-guidelines-on-regulation-of-payment-aggregators-and-payment-gateways.html?amp=1
