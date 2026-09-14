import core from './worker-entry.js';
import { createIntegrationHub } from './application/integrations/hub.js';

export default createIntegrationHub(core);
