import type { Request, Response } from 'express';
import { search, SearchHttpError } from '../services/searchService';

export function searchController(req: Request, res: Response): void {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    res.json({ results: search(query) });
  } catch (error) {
    if (error instanceof SearchHttpError) {
      res.status(error.status).json({ message: error.message });
      return;
    }
    throw error;
  }
}
