import { Container } from '@cloudflare/containers';
import { env } from 'cloudflare:workers';

export class EcuComputeContainer extends Container {
  defaultPort = 8080;
  sleepAfter = '2m';
  enableInternet = true;
  envVars = {
    ECU_COMPUTE_TOKEN: env.ECU_COMPUTE_TOKEN,
  };
}
