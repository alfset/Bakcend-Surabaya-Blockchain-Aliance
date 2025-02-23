import express from 'express';
import { checkTwitterStatus, checkDiscordStatus, checkTelegramStatus } from '../controllers/socialController';

const router = express.Router();

router.get('/check/twitter', checkTwitterStatus);
router.get('/check/discord', checkDiscordStatus);
router.get('/check/telegram', checkTelegramStatus);

export default router;
