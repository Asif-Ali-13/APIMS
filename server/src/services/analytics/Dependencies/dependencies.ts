/**
 * Wires the analytics vertical slice:
 * processor {@link MetricsRepository} + client {@link IClientRepository} + 
 * auth {@link AuthService} → {@link AnalyticsService} → {@link AnalyticsController}.
 *
 * @module services/analytics/Dependencies/dependencies
 */
import authModule from "../../auth/Dependencies/dependencies.ts";
import clientModule from "../../client/Dependencies/dependencies.ts";
import processorModule from "../../processor/Dependencies/dependencies.ts";

import { AnalyticsController } from "../controller/analyticsController.ts";
import { AnalyticsService } from "../service/analyticsService.ts";

import type { AuthService } from "../../auth/service/authService.ts";
import type { IClientRepository } from "../../client/repositories/IClientRepository.ts";
import type { MetricsRepository } from "../../processor/repository/MetricsRepository.ts";


/** Singleton-shaped registry produced by {@link AnalyticsContainer.create}. */
export interface AnalyticsModuleContainer {
    
    repositories: {
        clientRepository: IClientRepository;
        metricsRepository: MetricsRepository;
    };

    services: {
        analyticsService: AnalyticsService;
        authService: AuthService;
    };

    controllers: {
        analyticsController: AnalyticsController;
    };
}


/** Factory for the analytics module dependency graph. */
class AnalyticsContainer {
    
    /**
     * Instantiates {@link AnalyticsService} and {@link AnalyticsController}
     * using shared repositories from the client and processor modules.
     */
    static create(): AnalyticsModuleContainer {
        
        const repositories: AnalyticsModuleContainer["repositories"] = {
            clientRepository: clientModule.repositories.clientRepository,
            metricsRepository: processorModule.repositories.metricsRepository,
        };

        const analyticsService = new AnalyticsService({
            metricsRepository: repositories.metricsRepository,
        });

        const services: AnalyticsModuleContainer["services"] = {
            analyticsService,
            authService: authModule.services.authService,
        };

        const analyticsController = new AnalyticsController({
            analyticsService: services.analyticsService,
            authService: services.authService,
            clientRepository: repositories.clientRepository,
        });

        return {
            repositories,
            services,
            controllers: { analyticsController },
        };
    }
}

/** Default module container; import from routes to attach handlers. */
const analyticsModule = AnalyticsContainer.create();

export { AnalyticsContainer };
export default analyticsModule;
