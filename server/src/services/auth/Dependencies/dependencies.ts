/**
 * Wires the auth vertical slice: 
 * {@link MongoUserRepository} → {@link AuthService} → {@link AuthController}.
 *
 * @module services/auth/Dependencies/dependencies
 */
import { AuthController } from "../controller/authController.ts";
import { AuthService } from "../service/authService.ts";
import { MongoUserRepository } from "../repository/UserRepository.ts";
import type { IUserRepository } from "../repository/IUserRepository.ts";


/** Singleton-shaped registry produced by {@link AuthContainer.create}. */
export interface AuthModuleContainer {
    repositories: { userRepository: IUserRepository };
    services: { authService: AuthService };
    controllers: { authController: AuthController };
}

/** Factory for the auth module dependency graph. */
class AuthContainer {
    /**
     * Instantiates repository, service, and controller with default implementations.
     */
    static create(): AuthModuleContainer {
        
        const userRepository: IUserRepository = new MongoUserRepository();
        const authService = new AuthService({ userRepository });
        const authController = new AuthController({ authService });

        return {
            repositories: { userRepository },
            services: { authService },
            controllers: { authController },
        };
    }
}

/** Default module container; import this from routes to attach handlers. */
const authModule = AuthContainer.create();

export { AuthContainer };
export default authModule;
