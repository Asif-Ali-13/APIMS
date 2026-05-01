/**
 * Client admin HTTP routes. Every path uses `authenticate`; bodies are validated with Zod
 * in {@link ClientController} (`parseBody`).
 *
 * @module services/client/routes/clientRouter
 */
import express from "express";
import clientModule from "../Dependencies/dependencies.ts";
import authenticate from "../../../shared/middlewares/authenticate.ts";

const router = express.Router();
const { clientController } = clientModule.controllers;

router.use(authenticate);

/** Onboard a new tenant client. Caller must be super admin (enforced in controller). */
router.post(
    "/admin/clients/onboard", 
    clientController.createClient
);

/** Create a user under `:clientId`. */
router.post(
    "/admin/clients/:clientId/users", 
    clientController.createClientUser
);

/** Create an API key for `:clientId`; response includes the secret once. */
router.post(
    "/admin/clients/:clientId/api/keys", 
    clientController.createApiKey
);

/** List API keys for `:clientId` (no secret material). */
router.get(
    "/admin/clients/:clientId/api/keys", 
    clientController.getClientApiKeys
);

export default router;