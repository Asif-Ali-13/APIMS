/**
 * Wires the client vertical slice:
 * {@link MongoClientRepository} / {@link MongoApiKeyRepository} / {@link MongoUserRepository}
 * → {@link ClientService} → {@link ClientController}. The controller receives the auth module's
 * `AuthService` for super-admin checks.
 *
 * @module services/client/Dependencies/dependencies
 */
import authModule from "../../auth/Dependencies/dependencies.ts";

import { MongoUserRepository } from "../../auth/repository/UserRepository.ts";
import { MongoApiKeyRepository } from "../repositories/ApiKeyRepository.ts";
import { MongoClientRepository } from "../repositories/ClientRepository.ts";

import { ClientService } from "../service/clientService.ts";
import { ClientController } from "../controller/clientController.ts";

import type { IUserRepository } from "../../auth/repository/IUserRepository.ts";
import type { IApiKeyRepository } from "../repositories/IApiKeyRepository.ts";
import type { IClientRepository } from "../repositories/IClientRepository.ts";


/** Singleton-shaped registry produced by {@link ClientContainer.create}. */
export interface ClientModuleContainer {
    repositories: {
        clientRepository: IClientRepository;
        apiKeyRepository: IApiKeyRepository;
        userRepository: IUserRepository;
    };
    services: {
        clientService: ClientService;
    };
    controllers: {
        clientController: ClientController;
    };
}


/** Factory for the client module dependency graph. */
class ClientContainer {
    /**
     * Instantiates repositories, {@link ClientService}, and {@link ClientController}
     * with default Mongoose implementations.
     */
    static create(): ClientModuleContainer {
        const clientRepository: IClientRepository = new MongoClientRepository();
        const apiKeyRepository: IApiKeyRepository = new MongoApiKeyRepository();
        const userRepository: IUserRepository = new MongoUserRepository();

        const clientService = new ClientService({
            clientRepository,
            apiKeyRepository,
            userRepository,
        });

        const clientController = new ClientController({
            clientService,
            authService: authModule.services.authService,
        });

        return {
            repositories: {
                clientRepository,
                apiKeyRepository,
                userRepository,
            },
            services: { clientService },
            controllers: { clientController },
        };
    }
}


/** Default module container; import from routes to attach handlers. */
const clientModule = ClientContainer.create();

export { ClientContainer };
export default clientModule;