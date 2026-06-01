/**
 * Analytics HTTP routes. Every path uses `authenticate`; authorization and client scoping
 * are enforced in {@link AnalyticsController}.
 *
 * @module services/analytics/routes/analyticsRoutes
 */
import express from "express";

import authenticate from "../../../shared/middlewares/authenticate.ts";
import analyticsModule from "../Dependencies/dependencies.ts";


const router = express.Router();
const { analyticsController } = analyticsModule.controllers;

router.use(authenticate);

/** Overall hit statistics for the resolved client or global scope (super admin). */
router.get("/stats", analyticsController.getStats);

/** Dashboard bundle: stats, top endpoints, and recent time-series activity. */
router.get("/dashboard", analyticsController.getDashboard);


export default router;
