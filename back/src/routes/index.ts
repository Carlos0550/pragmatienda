import { Router } from "express";
import { healthRouter } from "./health";
import { businessRouter } from "./business.routes";
import { userRouter } from "./user.routes";

const router = Router();


router.use(healthRouter);
router.use(businessRouter);
router.use(userRouter);

export { router };
