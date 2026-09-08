# -*- coding: utf-8 -*-
"""Intake: speech and free text in, ``StructuredProfile`` out.

ARCHITECTURE §4 (LOCKED): **the LLM extracts; it never decides.** Nothing in
this package knows a scheme id, an income ceiling or a loan band. It converts
what a person said into fields, marks how sure it is, and hands the result to
the confirm screen. Every decision downstream of that is deterministic.
"""
