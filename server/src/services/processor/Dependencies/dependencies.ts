/**
 * Wires the processor vertical slice:
 * {@link ApiHitRepository} + {@link MetricsRepository} → {@link ProcessorService}.
 *
 * @module services/processor/Dependencies/dependencies
 */
import ApiHit from "../../../shared/models/ApiHits.ts";
import logger from "../../../shared/config/logger.ts";
import postgres from "../../../shared/config/postgres.ts";

import { ApiHitRepository } from "../repository/ApiHitRepository.ts";
import { MetricsRepository } from "../repository/MetricsRepository.ts";
import { ProcessorService } from "../service/processorService.ts";


/**
 * Singleton-shaped registry produced by {@link Container.init}.
 */
export interface ProcessorModuleContainer {
    repositories: {
        apiHitRepository: ApiHitRepository;
        metricsRepository: MetricsRepository;
    };
    
    services: {
        processorService: ProcessorService;
    };
}


/**
 * Factory for the processor module dependency graph.
 */
class Container {
    /**
     * Instantiates repositories and processor service with default implementations.
     */
    static init(): ProcessorModuleContainer {
        
        const repositories: ProcessorModuleContainer["repositories"] = {
            apiHitRepository: new ApiHitRepository({ model: ApiHit, logger }),
            metricsRepository: new MetricsRepository({ logger, postgres }),
        };

        const services: ProcessorModuleContainer["services"] = {
            processorService: new ProcessorService(repositories),
        };

        return { repositories, services };
    }
}

const initialized = Container.init();
export { Container };
export default initialized;
