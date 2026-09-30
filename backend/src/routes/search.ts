import { Router } from 'express';
import { searchController } from '../controllers/searchController';

export const searchRouter = Router();

searchRouter.get('/', searchController);
