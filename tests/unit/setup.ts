import { initLogger } from "../../src/logger.js";

// Silence all logging during unit tests
initLogger("silent");
