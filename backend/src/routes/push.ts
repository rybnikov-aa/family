import { Router } from 'express';
import { pushConfigController, subscribePushController, unsubscribePushController } from '../controllers/pushController';

export const pushRouter = Router();

pushRouter.get('/config', pushConfigController);
pushRouter.post('/subscribe', subscribePushController);
pushRouter.delete('/subscribe', unsubscribePushController);
