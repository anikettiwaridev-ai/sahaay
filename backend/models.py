# -*- coding: utf-8 -*-
"""SahiDwar core entities.

Spec: docs/ENGINE_SPEC.md §1 (StructuredProfile), §2 (Scheme), §3
(Recommendation, NearMiss, rules_fired), §4 (CostSchedule), §5 (Partner, Route),
§6 (Packet).

This module is the **single source of truth** for the shapes that cross the API
boundary (ARCHITECTURE §5, LOCKED). ``scripts/gen_types.py`` mirrors it into
``frontend/src/api/types.ts``; nobody hand-writes those TypeScript types.

Field names follow the spec's own JSON literally -- ``instalment`` not
``instalment_inr``, ``blocking_rule`` not ``blocking_rule_id`` -- because the
spec's payloads are what Phase 3 was written against.
"""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

ENGINE_VERSION = "0.3.0-phase2"

# ---------------------------------------------------------------- enums
Lang = Literal["hi", "en"]
Purpose = Literal["enterprise", "education"]
Sector = Literal[
    "tailoring", "shop", "transport", "agri_allied", "services",
    "manufacturing", "plantation", "construction", "other",
]
Education = Literal[
    "illiterate", "primary", "middle", "matric", "higher_secondary", "graduate",
]
CourseLevel = Literal["diploma", "bachelors", "masters", "doctoral", "professional"]
Frequency = Literal["quarterly", "half_yearly"]
FieldSource = Literal["llm", "fallback", "user"]
LocationSource = Literal["gazetteer", "gps", "manual"]

SchemeId = Literal["MFS", "TL", "AMY", "UNY", "ELS"]
PartnerType = Literal[
    "SCA", "PSB", "RRB", "NBFC_MFI", "COOP_BANK", "COOP_SOCIETY", "SFB", "OTHER",
]
ChannelRateKey = Literal["SCA", "CA", "NBFC_MFI", "COOP", "SFB"]
Band = Literal["strong", "ok", "slow", "weak", "none"]
ScaStatus = Literal[
    "derived_from_utilisation", "per_committee_non_performing", "no_sca_in_state",
]
GeocodeMethod = Literal[
    "pin_centroid", "pin_consensus", "district_place", "address",
    "state_centroid", "none",
]
Coverage = Literal["state", "national", "listed_office"]
Verdict = Literal["eligible", "near_miss", "ineligible", "eligible_no_channel"]
MoratoriumInterest = Literal["capitalise", "pay_as_you_go"]

RuleId = Literal["R_SC", "R_INCOME", "R_AMOUNT_MIN", "R_AMOUNT_MAX", "R_COURSE",
                 "R_DOCS", "F_PURPOSE"]
WarningId = Literal["band_warning", "no_sca_in_state"]


# ------------------------------------------------ StructuredProfile (§1)
class Location(BaseModel):
    lat: float
    lon: float
    source: LocationSource


class Course(BaseModel):
    category: Optional[str] = None          # one of data/courses_els.json ids
    level: Optional[CourseLevel] = None
    is_full_time_recognised: Optional[bool] = None
    duration_months: Optional[int] = None
    repayment_started: bool = False


class FieldMeta(BaseModel):
    confidence: float = Field(ge=0.0, le=1.0)
    source: FieldSource


class StructuredProfile(BaseModel):
    """What intake must produce. ENGINE_SPEC §1.

    ``amount_inr`` is the single money field: project cost for
    ``purpose=enterprise``, course fee for ``purpose=education``.

    ``is_sc`` defaults to None and is never inferred -- all eligibility rests on
    it, so it must be an explicit statement by the applicant.

    ``is_woman`` is collected and **no rule reads it**. NSFDC's current scheme
    page carries no women-specific scheme and no women's rate concession. The
    field exists because the application form asks for it and because women are
    67% of NSFDC's borrowers. A builder must not invent a gender rule.
    """

    lang: Lang = "hi"
    name: Optional[str] = None
    is_sc: Optional[bool] = None
    state: Optional[str] = None
    district: Optional[str] = None
    location: Optional[Location] = None

    purpose: Optional[Purpose] = None
    sector: Optional[Sector] = None
    activity_text: Optional[str] = None

    amount_inr: Optional[int] = None
    own_contribution_inr: Optional[int] = None
    annual_family_income_inr: Optional[int] = None

    education: Optional[Education] = None
    course: Course = Field(default_factory=Course)

    is_woman: Optional[bool] = None
    age: Optional[int] = None
    has_existing_enterprise: Optional[bool] = None
    enterprise_age_months: Optional[int] = None
    has_udyam: Optional[bool] = None
    has_caste_certificate: Optional[bool] = None
    has_income_certificate: Optional[bool] = None

    field_meta: dict[str, FieldMeta] = Field(default_factory=dict)
    # The only gate. /recommend returns 422 while this is non-empty.
    needs_confirmation: list[str] = Field(default_factory=list)


# ------------------------------------------------------------ Scheme (§2)
class Scheme(BaseModel):
    id: SchemeId
    name_en: str
    name_hi: str
    purpose: Purpose
    amount_min: int
    amount_max: int
    loan_pct: int
    loan_cap: int
    tenure_total_months: Optional[int] = None
    tenure_total_months_if_repayment_started: Optional[int] = None
    moratorium_months: Optional[int] = None
    moratorium_rule: Optional[str] = None
    moratorium_months_if_repayment_started: Optional[int] = None
    moratorium_sector_overrides: dict[str, int] = Field(default_factory=dict)
    frequency_default: Frequency
    frequency_allowed: list[Frequency]
    frequency_assumption_flag: Optional[str] = None
    nsfdc_to_ca_rate_pct: float
    beneficiary_rate_pct: dict[str, float]
    channel_types: list[PartnerType]
    requires_course_category: bool = False
    legacy_recognition_hi: Optional[str] = None
    legacy_recognition_applies_when: Optional[str] = None
    note: Optional[str] = None


# -------------------------------------------------------- CostSchedule (§4)
class Instalment(BaseModel):
    n: int
    due_month: int
    principal: float
    interest: float
    total: float
    balance: float


class CostSchedule(BaseModel):
    """ENGINE_SPEC §4.8. Never carries wrong_door_cost -- that is computed only
    in /recommend, because only /recommend knows the eligible set (§4.1).

    ``total_repayment == loan + total_interest`` exactly. Under
    ``pay_as_you_go`` the moratorium interest is paid during the moratorium
    rather than capitalised, and it is still interest the applicant bears, so it
    is inside ``total_interest`` either way. That is what makes the two flag
    settings comparable at all.
    """

    scheme_id: SchemeId
    channel_rate_key: ChannelRateKey
    loan: int
    own: int
    rate_annual: float
    frequency: Frequency
    n_instalments: int
    instalment: float
    moratorium_months: int
    moratorium_interest: float
    total_interest: int
    total_repayment: int
    monthly_equivalent: float
    moratorium_interest_treatment: MoratoriumInterest
    tenure_total_months: int
    repayment_months: int
    schedule: list[Instalment] = Field(default_factory=list)


# ------------------------------------------------- Partner and Route (§5)
class Geocode(BaseModel):
    method: GeocodeMethod
    confidence: float = Field(ge=0.0, le=1.0)
    is_head_office: bool


class Provenance(BaseModel):
    file: str
    list_title: Optional[str] = None
    srno: Optional[int] = None
    url: str


class Partner(BaseModel):
    id: str
    type: PartnerType
    name: str
    name_en: str
    name_hi: str
    state: Optional[str] = None
    state_name_en: Optional[str] = None
    address: Optional[str] = None
    address_en: Optional[str] = None
    address_hi: Optional[str] = None
    pin: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    geocode: Geocode
    coverage: Coverage
    channel_rate_key: ChannelRateKey
    serves_schemes: list[SchemeId]
    provenance: Provenance


class StateUtilisation(BaseModel):
    """The partner functioning signal. ENGINE_SPEC §5.3.

    No UI surface may attribute an NPA or an overdue to a named partner. The
    permitted sentence is: "This state used X% of its allocation in 2025-26
    (NSFDC data)."
    """

    state: str
    state_name_en: str
    state_name_hi: Optional[str] = None
    state_name_nsfdc: Optional[str] = None
    pct: float
    allocation_lakh: float
    actual_lakh: float
    band: Band
    has_sca: bool
    sca_status: ScaStatus
    fy: str
    as_of: str
    source: str


class Warning(BaseModel):
    id: WarningId
    text_hi: str
    text_en: str
    alternative_partner_id: Optional[str] = None


class Route(BaseModel):
    partner: Partner
    distance_km: Optional[float] = None      # None when unknown (§5.4)
    distance_note: Optional[str] = None
    rate: float
    cost_schedule: CostSchedule
    band: Optional[Band] = None
    score: float
    warnings: list[Warning] = Field(default_factory=list)
    why: list[str] = Field(default_factory=list)


# --------------------------------- Recommendation and NearMiss (§3)
class RuleFired(BaseModel):
    """ENGINE_SPEC §3.7. Rendered under "क्यों?" -- free, because the engine
    is a table rather than a model."""

    scheme_id: SchemeId
    rule_id: RuleId
    result: Literal["pass", "fail", "skip"]
    value_seen: Optional[str] = None
    threshold: Optional[str] = None


class Delta(BaseModel):
    field: str
    current: Optional[int] = None
    needed: Optional[int] = None


class NearMiss(BaseModel):
    """ENGINE_SPEC §3.6. Exactly one hard rule failed, it is non-terminal, and
    it has an unblock."""

    scheme_id: SchemeId
    blocking_rule: RuleId
    reason_id: str
    reason_text_en: str
    reason_text_hi: str
    unblock_id: str
    unblock_text_en: str
    unblock_text_hi: str
    delta: Optional[Delta] = None


class Recommendation(BaseModel):
    scheme: Scheme
    verdict: Verdict
    rank: int
    readiness: float = Field(ge=0.0, le=1.0)
    reasons: list[str] = Field(default_factory=list)
    cost: Optional[CostSchedule] = None
    routes: list[Route] = Field(default_factory=list)
    # eligible_no_channel only (§3.5)
    no_channel_reason: Optional[str] = None
    nearest_out_of_state_partner_id: Optional[str] = None


class Door(BaseModel):
    """An (eligible scheme x reachable partner) pair. ENGINE_SPEC §4.1."""

    scheme_id: SchemeId
    partner_id: str
    partner_name: str
    rate: float
    tenure_total_months: int
    frequency: Frequency
    total_interest: int
    band: Optional[Band] = None


class RecommendResponse(BaseModel):
    recommendations: list[Recommendation] = Field(default_factory=list)
    near_misses: list[NearMiss] = Field(default_factory=list)
    # None when fewer than two comparable doors exist -- the UI omits the hero
    # line rather than inventing a comparison (§4.1).
    wrong_door_cost: Optional[int] = None
    best_door: Optional[Door] = None
    worst_door: Optional[Door] = None
    collapsed: Optional[str] = None      # reason_id when §3.3's collapse fired
    engine_version: str = ENGINE_VERSION
    rules_fired: list[RuleFired] = Field(default_factory=list)


# ------------------------------------------------------------ Packet (§6)
class ChecklistItem(BaseModel):
    id: str
    label_hi: str
    label_en: str
    have: bool
    where_to_get_hi: Optional[str] = None
    where_to_get_en: Optional[str] = None


class Packet(BaseModel):
    profile: StructuredProfile
    scheme: Scheme
    partner: Partner
    cost: CostSchedule
    checklist: list[ChecklistItem] = Field(default_factory=list)
    next_steps_hi: list[str] = Field(default_factory=list)
    next_steps_en: list[str] = Field(default_factory=list)
    pm_suraj_url: str = "https://pmsuraj.dosje.gov.in/"
    pm_suraj_label_hi: str = "ऑनलाइन विकल्प"
    generated_at: str
    engine_version: str = ENGINE_VERSION


# ------------------------------------------------- wire shapes (§6 API)
GuardReason = Literal["no_speech", "too_short", "low_confidence"]


class TranscribeResponse(BaseModel):
    """ARCHITECTURE §6 plus the §4 step 3 guard.

    ``speech_ok=False`` means Whisper produced text but the audio does not
    support it -- silence, noise, or a sub-threshold transcript. S2 asks the
    person to repeat or type, and **the LLM is never called**, because a
    hallucinated transcript that reaches extraction produces a confident,
    entirely invented profile.
    """

    transcript: str
    lang: Lang
    duration_ms: int
    speech_ok: bool = True
    guard_reason: Optional[GuardReason] = None
    avg_logprob: Optional[float] = None


class ExtractRequest(BaseModel):
    text: str
    lang: Lang = "hi"


class RouteRequest(BaseModel):
    scheme_ids: list[SchemeId]
    amount_inr: int          # required: every route carries a cost_schedule
    lat: float
    lon: float
    state: str
    lang: Lang = "hi"
    frequency: Optional[Frequency] = None
    sector: Optional[Sector] = None
    course: Optional[Course] = None


class RouteResponse(BaseModel):
    routes: list[Route] = Field(default_factory=list)
    warnings: list[Warning] = Field(default_factory=list)


class CostRequest(BaseModel):
    scheme_id: SchemeId
    amount_inr: int
    channel_rate_key: ChannelRateKey
    frequency: Optional[Frequency] = None
    sector: Optional[Sector] = None
    course: Optional[Course] = None


class PacketRequest(BaseModel):
    profile: StructuredProfile
    scheme_id: SchemeId
    partner_id: str
    amount_inr: int
    frequency: Optional[Frequency] = None


class NeedsConfirmation(BaseModel):
    """The 422 body from /recommend when the profile is unconfirmed (§1)."""

    detail: str = "profile is unconfirmed"
    needs_confirmation: list[str] = Field(default_factory=list)


# Everything gen_types.py mirrors into TypeScript, in emit order.
EXPORTED = [
    Location, Course, FieldMeta, StructuredProfile,
    Scheme,
    Instalment, CostSchedule,
    Geocode, Provenance, Partner, StateUtilisation, Warning, Route,
    RuleFired, Delta, NearMiss, Recommendation, Door, RecommendResponse,
    ChecklistItem, Packet,
    TranscribeResponse, ExtractRequest, RouteRequest, RouteResponse,
    CostRequest, PacketRequest, NeedsConfirmation,
]
