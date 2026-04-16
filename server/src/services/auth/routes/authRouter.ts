/**
 * Auth HTTP routes. Request bodies are validated with Zod in the auth controller
 * (`parseBody`); responses set or clear the `authToken` cookie where applicable.
 *
 * @module services/auth/routes/authRouter
 */
import express from "express";
import authModule from "../Dependencies/dependencies.ts";
import authenticate from "../../../shared/middlewares/authenticate.ts";
import authorize from "../../../shared/middlewares/authorize.ts";
import requestLogger from "../../../shared/middlewares/requestLogger.ts";
import { APPLICATION_ROLES } from "../../../shared/constants/roles.ts";

const router = express.Router();
const { authController } = authModule.controllers;

/**
 * Bootstrap the first super admin when no users exist. Public; no session required.
 */
router.post(
    "/onboard-super-admin",
    requestLogger,
    authController.onboardSuperAdmin
);

/**
 * Create a user. Requires an authenticated super admin (`authenticate` + `authorize`).
 */
router.post(
    "/register",
    requestLogger,
    authenticate,
    authorize([APPLICATION_ROLES.SUPER_ADMIN]),
    authController.register
);

/** Issue JWT and set auth cookie. Public. */
router.post("/login", requestLogger, authController.login);

/** Return the current user from JWT. Requires `authenticate`. */
router.get(
    "/profile",
    requestLogger,
    authenticate,
    authController.getProfile
);

/** Clear auth cookie. Does not require a valid session. */
router.get("/logout", requestLogger, authController.logout);

export default router;
