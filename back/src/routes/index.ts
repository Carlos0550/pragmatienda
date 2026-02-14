import { Router } from "express";
import { healthRouter } from "./health";
import { adminRouter } from "./admin.routes";
import { platformRouter } from "./platform.routes";
import { userRouter } from "./user.routes";

const router = Router();

router.use(healthRouter);
router.use(platformRouter);
router.use(adminRouter);
router.use(userRouter);

export { router };
