"use strict";
/**
 * The twelve personas, read from the fixture the Python baseline emitted.
 *
 * Deliberately not retyped. `backend/tests/personas.py` (since removed, along
 * with the rest of the retired Python engine -- see `../../STACK-CONTEXT.md`)
 * was the one definition; its output was captured here so a persona could not
 * be edited on one side of the migration and quietly not the other. This
 * fixture is now the pinned record of what that definition was.
 */

const { golden } = require("./parity");

const PERSONAS = golden("personas");

module.exports = { PERSONAS };
