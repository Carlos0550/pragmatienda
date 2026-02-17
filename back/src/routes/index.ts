import { Router } from "express";
import { adminRouter } from "./admin.routes";
import { cartRouter } from "./cart.routes";
import { paymentsRouter } from "./payments.routes";
import { publicRouter } from "./public.routes";
import { userRouter } from "./user.routes";

const router = Router();

router.use("/public", publicRouter);
router.use("/admin", adminRouter);
router.use("/user", userRouter);
router.use("/cart", cartRouter);
router.use("/payments", paymentsRouter);

export { router as apiRouter };
