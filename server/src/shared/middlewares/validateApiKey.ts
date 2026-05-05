import type { NextFunction, Request, Response } from "express";

import ResponseFormatter from "../utils/responseFormatter.ts";
import logger from "../config/logger.ts";
import clientContainer from "../../services/client/Dependencies/dependencies.ts";
import type { IApiKey } from "../models/ApiKey.ts";
import type { IClient } from "../models/Client.ts";


/**
 * Middleware to validate API keys against database
 * Used for external services posting events
 */
const validateApiKey = async (
    req: Request, res: Response, next: NextFunction
): Promise<void> => {
    const requestWithClientContext = req as Request & { client?: IClient; apiKey?: IApiKey };
    
    try {
        const apiKey = req.headers['x-api-key'];
        const keyValue = typeof apiKey === "string" ? apiKey : Array.isArray(apiKey) ? apiKey[0] : undefined;

        if (!keyValue) {
            logger.warn('API request without API key', {
                path: req.path,
                ip: req.ip,
            });
            
            res.status(401).json(ResponseFormatter.error('API key is required', 401));
            return;
        }

        // Get client and API key from database
        const result = await clientContainer.services.clientService.getClientByApiKey(keyValue);

        if (!result) {
            logger.warn('Invalid API key attempted', {
                path: req.path,
                ip: req.ip,
                apiKey: keyValue.substring(0, 8) + '...', // Log partial key for security
            });

            res.status(403).json(ResponseFormatter.error('Invalid API key', 403));
            return;
        }

        const { client, apiKey: apiKeyObj } = result;

        // Check if client is active
        if (!client.isActive) {
            logger.warn('Inactive client attempted API access', {
                path: req.path,
                ip: req.ip,
                clientId: client._id,
            });

            res.status(403).json(ResponseFormatter.error('Client account is inactive', 403));
            return;
        }

        // Usage limits removed — no monthly usage checks

        // Check API key permissions
        if (!apiKeyObj.permissions?.canIngest) {
            logger.warn('API key without ingest permission attempted access', {
                path: req.path,
                ip: req.ip,
                apiKeyId: apiKeyObj._id,
            });

            res.status(403).json(
                ResponseFormatter.error('API key does not have ingest permissions', 403)
            );
            return;
        }

        // No API key usage tracking required

        // Add client and API key info to request
        requestWithClientContext.client = client;
        requestWithClientContext.apiKey = apiKeyObj;

        logger.debug('API key validated successfully', {
            clientId: client._id,
            clientName: client.name,
            apiKeyId: apiKeyObj._id,
        });

        next();
    } 
    catch (error) {
        logger.error('Error validating API key:', error);
        res.status(500).json(ResponseFormatter.error('Internal server error', 500));
        return;
    }
};

export default validateApiKey;
